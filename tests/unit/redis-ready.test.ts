import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import { afterEach, expect, it, vi } from "vitest";
import { createRedisReady } from "../../backend/src/services/redis-ready.js";

class Connection extends EventEmitter {
  status: Redis["status"] = "wait";
  connect = vi.fn(async () => {
    this.status = "ready";
    this.emit("ready");
  });
}
afterEach(() => vi.useRealTimers());

it("connects on demand and shares concurrent initialization", async () => {
  const client = new Connection();
  client.connect.mockImplementation(async () => {
    client.status = "connecting";
  });
  const ready = createRedisReady(client);
  expect(client.connect).not.toHaveBeenCalled();
  const first = ready();
  const second = ready();
  expect(first).toBe(second);
  client.status = "ready";
  client.emit("ready");
  await first;
  await ready();
  expect(client.connect).toHaveBeenCalledTimes(1);
  expect(client.listenerCount("error")).toBe(0);
});

it("retries after a rejected initial connection", async () => {
  const client = new Connection();
  client.connect.mockRejectedValueOnce(new Error("temporary failure"));
  const ready = createRedisReady(client);
  await expect(ready()).rejects.toThrow("temporary failure");
  await expect(ready()).resolves.toBeUndefined();
  expect(client.connect).toHaveBeenCalledTimes(2);
});

it("bounds reconnect waits and allows a later recovery", async () => {
  vi.useFakeTimers();
  const client = new Connection();
  client.status = "reconnecting";
  const ready = createRedisReady(client, 100);
  const rejected = expect(ready()).rejects.toThrow("readiness timeout");
  await vi.advanceTimersByTimeAsync(100);
  await rejected;
  expect(client.listenerCount("ready")).toBe(0);
  client.status = "ready";
  await expect(ready()).resolves.toBeUndefined();
  expect(client.connect).not.toHaveBeenCalled();
});
