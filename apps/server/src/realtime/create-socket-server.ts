import type { Server as HttpServer } from "node:http";
import type { ClientToServerEvents, ServerToClientEvents } from "@allplay/shared";
import { Server } from "socket.io";

export function createSocketServer(httpServer: HttpServer, webOrigin: string) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    serveClient: false,
    maxHttpBufferSize: 16 * 1024,
    cors: { origin: webOrigin, credentials: true, methods: ["GET", "POST"] },
    allowRequest: (request, callback) => {
      callback(null, request.headers.origin === webOrigin);
    },
  });

  // Fail closed until Phase 3 introduces server-validated guest sessions.
  io.use((_socket, next) => {
    next(new Error("ROOM_SESSIONS_NOT_AVAILABLE"));
  });

  return io;
}
