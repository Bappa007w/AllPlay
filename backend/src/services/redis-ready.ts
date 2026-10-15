import type { EventEmitter } from "node:events";
import type { Redis } from "ioredis";

type Connection = Pick<Redis, "status" | "connect"> & Pick<EventEmitter, "on" | "off">;

// Never retain a rejected startup promise: a later request can retry after recovery.
export function createRedisReady(client: Connection, timeoutMs = 8000) {
  let pending: Promise<void> | undefined;
  return function ready(): Promise<void> {
    if (client.status === "ready") return Promise.resolve();
    if (pending) return pending;
    pending = new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        client.off("ready", onReady);
        client.off("error", onError);
        client.off("end", onEnd);
        if (error) reject(error);
        else resolve();
      };
      const onReady = () => finish();
      const onError = (error: Error) => finish(error);
      const onEnd = () => finish(new Error("Redis connection closed"));
      const timer = setTimeout(() => finish(new Error("Redis readiness timeout")), timeoutMs);
      client.on("ready", onReady);
      client.on("error", onError);
      client.on("end", onEnd);
      if (client.status === "wait" || client.status === "end") {
        void client.connect().catch(onError);
      }
    }).finally(() => {
      pending = undefined;
    });
    return pending;
  };
}
