import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import type { StateStore, StoredState } from "../modules/rooms/coordinator.js";

export const compareAndSetScript = `
local current = redis.call('HGET', KEYS[1], 'version')
if (current or '') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'version', ARGV[2], 'value', ARGV[3])
redis.call('EXPIRE', KEYS[1], 93600)
return 1
`;
export function createRedisResources(url: string, prefix: string) {
  const publisher = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const subscriber = publisher.duplicate();
  // Never log Redis errors: provider URLs may contain credentials.
  publisher.on("error", () => {});
  subscriber.on("error", () => {});
  const ready = Promise.all([publisher.connect(), subscriber.connect()]).then(() => {});
  void ready.catch(() => {});
  const key = `${prefix}:state:v1`;
  // The adapter does not await these fire-and-forget methods. Reconciliation
  // repairs missed messages; prevent provider failures becoming unhandled rejections.
  const adapterClient = (client: Redis) =>
    new Proxy(client, {
      get(target, property) {
        if (property === "publish")
          return (channel: string, message: string | Buffer) =>
            target.publish(channel, message).catch(() => 0);
        if (property === "subscribe")
          return (channels: string[]) => target.subscribe(...channels).catch(() => 0);
        if (property === "unsubscribe")
          return (channels: string[]) => target.unsubscribe(...channels).catch(() => 0);
        if (property === "punsubscribe")
          return (channel: string) => target.punsubscribe(channel).catch(() => 0);
        if (property === "psubscribe")
          return (channel: string) => target.psubscribe(channel).catch(() => 0);
        const value: unknown = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  const store: StateStore = {
    async read() {
      await ready;
      const [version, value] = await publisher.hmget(key, "version", "value");
      if (!version && !value) return null;
      if (!version || !value) throw new Error("Invalid stored state");
      return { version, value };
    },
    async compareAndSet(expected: string | null, next: StoredState) {
      await ready;
      return (
        (await publisher.eval(
          compareAndSetScript,
          1,
          key,
          expected ?? "",
          next.version,
          next.value,
        )) === 1
      );
    },
  };
  return {
    store,
    ready,
    adapter: () =>
      createAdapter(adapterClient(publisher), adapterClient(subscriber), {
        key: `${prefix}:socket`,
        publishOnSpecificResponseChannel: true,
      }),
    subscribed: () => subscriber.ping(),
    healthy: () => publisher.status === "ready" && subscriber.status === "ready",
    close: () => {
      publisher.disconnect();
      subscriber.disconnect();
    },
  };
}
