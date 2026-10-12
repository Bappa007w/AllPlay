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
  const rooms = new RoomCoordinator(
    testStore ?? redis?.store ?? new MemoryStateStore(),
    config.ROOM_STORE === "redis",
  );
  const production = config.NODE_ENV === "production";
  const httpServer = createServer(createApp(rooms, config.WEB_ORIGIN, production));
  const ready = (redis?.ready ?? Promise.resolve()).then(async () => {
    if (redis) {
      io.adapter(redis.adapter());
      await redis.subscribed();
    }
  });
  void ready.catch(() => {});
  const { io, stop } = createSocketServer(
    httpServer,
    config.WEB_ORIGIN,
    rooms,
    production,
    config.ROOM_STORE === "redis",
    ready,
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

  return { httpServer, io, close, ready };
}
