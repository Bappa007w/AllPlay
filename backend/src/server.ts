import { createServer } from "node:http";
import { createApp } from "./app.js";
import type { ServerEnvironment } from "./config/environment.js";
import { createSocketServer } from "./realtime/create-socket-server.js";
import { RoomCoordinator, MemoryStateStore, type StateStore } from "./modules/rooms/coordinator.js";
import { createRedisResources } from "./services/redis.js";

export function createRuntime(config: ServerEnvironment, testStore?: StateStore) {
  const redis =
    config.ROOM_STORE === "redis"
      ? createRedisResources(config.REDIS_URL!, config.REDIS_KEY_PREFIX)
      : null;
  const store = testStore ?? redis?.store ?? new MemoryStateStore();
  const coordinatedStore: StateStore = {
    async read() {
      await ensureReady();
      return store.read();
    },
    async compareAndSet(expected, next) {
      await ensureReady();
      return store.compareAndSet(expected, next);
    },
  };
  const rooms = new RoomCoordinator(coordinatedStore, config.ROOM_STORE === "redis");
  const production = config.NODE_ENV === "production";
  const httpServer = createServer(createApp(rooms, config.WEB_ORIGIN, production));
  let adapterInstalled = false;
  let initializing: Promise<void> | undefined;
  function ensureReady(): Promise<void> {
    if (!redis) return Promise.resolve();
    initializing ??= (async () => {
      await redis.ready();
      if (!adapterInstalled) {
        io.adapter(redis.adapter());
        adapterInstalled = true;
      }
      await redis.subscribed();
    })().finally(() => {
      initializing = undefined;
    });
    return initializing;
  }
  const { io, stop } = createSocketServer(
    httpServer,
    config.WEB_ORIGIN,
    rooms,
    production,
    config.ROOM_STORE === "redis",
    ensureReady,
  );
  let closing: Promise<void> | undefined;

  function close(): Promise<void> {
    stop();
    closing ??= new Promise<void>((resolve) => {
      io.close(() => {
        redis?.close();
        resolve();
      });
      httpServer.closeIdleConnections();
    });
    return closing;
  }

  return {
    httpServer,
    io,
    close,
    get ready() {
      return ensureReady();
    },
  };
}
