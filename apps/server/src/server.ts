import { createServer } from "node:http";
import { createApp } from "./app.js";
import type { ServerEnvironment } from "./config/environment.js";
import { createSocketServer } from "./realtime/create-socket-server.js";
import { RoomService } from "./modules/rooms/room-service.js";

export function createRuntime(config: ServerEnvironment) {
  const rooms = new RoomService();
  const production = config.NODE_ENV === "production";
  const httpServer = createServer(createApp(rooms, config.WEB_ORIGIN, production));
  const io = createSocketServer(httpServer, config.WEB_ORIGIN, rooms, production);
  const cleanup = setInterval(() => rooms.sweep(), 1000);
  cleanup.unref();
  let closing: Promise<void> | undefined;

  function close(): Promise<void> {
    clearInterval(cleanup);
    closing ??= new Promise<void>((resolve) => {
      io.close(() => resolve());
      httpServer.closeIdleConnections();
    });
    return closing;
  }

  return { httpServer, io, close };
}
