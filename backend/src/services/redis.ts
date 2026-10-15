import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import type { StateStore, StoredState } from "../modules/rooms/coordinator.js";
import { createRedisReady } from "./redis-ready.js";

export const compareAndSetScript = `
local current = redis.call('HGET', KEYS[1], 'version')
if (current or '') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'version', ARGV[2], 'value', ARGV[3])
redis.call('EXPIRE', KEYS[1], 93600)
return 1
`;

// Return fixed labels only: provider errors can embed credentials or hostnames.
export function redisFailureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/WRONGPASS|NOAUTH|invalid password|authentication/i.test(message)) return "AUTH_FAILED";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return "DNS_FAILED";
  if (/certificate|TLS|SSL/i.test(message)) return "TLS_FAILED";
  if (/quota|limit exceeded|max.*requests/i.test(message)) return "QUOTA_EXCEEDED";
  if (/NOPERM|not allowed|not supported|unknown command/i.test(message)) return "COMMAND_REJECTED";
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) return "TIMEOUT";
  if (/ECONNREFUSED|ECONNRESET|closed|not writeable/i.test(message)) return "CONNECTION_FAILED";
  return "UNAVAILABLE";
}

export function createRedisResources(url: string, prefix: string) {
  const reported = new Set<string>();
  const report = (error: unknown) => {
    const category = redisFailureCategory(error);
    if (!reported.has(category)) {
      reported.add(category);
      console.warn(`AllPlay Redis: ${category}`);
    }
  };
  const publisher = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const subscriber = publisher.duplicate();
  publisher.on("error", report);
  subscriber.on("error", report);
  const publisherReady = createRedisReady(publisher);
  const subscriberReady = createRedisReady(subscriber);
  let closed = false;
  const ready = async () => {
    if (closed) throw new Error("Redis resources closed");
    try {
      await Promise.all([publisherReady(), subscriberReady()]);
    } catch (error) {
      report(error);
      throw error;
    }
  };
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
      await ready();
      const [version, value] = await publisher
        .hmget(key, "version", "value")
        .catch((error: unknown) => {
          report(error);
          throw error;
        });
      if (!version && !value) return null;
      if (!version || !value) throw new Error("Invalid stored state");
      return { version, value };
    },
    async compareAndSet(expected: string | null, next: StoredState) {
      await ready();
      return (
        (await publisher
          .eval(compareAndSetScript, 1, key, expected ?? "", next.version, next.value)
          .catch((error: unknown) => {
            report(error);
            throw error;
          })) === 1
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
      closed = true;
      publisher.disconnect();
      subscriber.disconnect();
    },
  };
}
