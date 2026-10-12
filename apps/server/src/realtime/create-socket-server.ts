import type { Server as HttpServer } from "node:http";
import {
  commandSchema,
  socketAuthSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type Ack,
} from "@allplay/shared";
import { Server, type Socket } from "socket.io";
import { cookieToken } from "../modules/rooms/http.js";
import { RoomFailure, type RoomService } from "../modules/rooms/room-service.js";

export function createSocketServer(
  httpServer: HttpServer,
  webOrigin: string,
  service: RoomService,
  production: boolean,
) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    serveClient: false,
    maxHttpBufferSize: 16 * 1024,
    cors: { origin: webOrigin, credentials: true, methods: ["GET", "POST"] },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      let sameOriginGet = false;
      // Browsers omit Origin on same-origin polling GETs. Require both metadata
      // signals in that case; never fall back for an explicit untrusted Origin.
      if (
        !origin &&
        request.method === "GET" &&
        request.headers["sec-fetch-site"] === "same-origin"
      ) {
        try {
          sameOriginGet = new URL(request.headers.referer ?? "").origin === webOrigin;
        } catch {
          /* reject malformed referrer */
        }
      }
      callback(null, origin === webOrigin || sameOriginGet);
    },
  });

  const cookieName = production ? "__Host-allplay_guest" : "allplay_guest";
  const identity = (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const auth = socketAuthSchema.parse(socket.handshake.auth);
    const session = service.authorize(
      cookieToken(socket.handshake.headers.cookie, cookieName),
      auth.csrfToken,
    );
    return { session, roomId: auth.roomId };
  };
  io.use((socket, next) => {
    try {
      service.limit(`connect:${socket.handshake.address}`, 120);
      service.session(cookieToken(socket.handshake.headers.cookie, cookieName));
      const { session, roomId } = identity(socket);
      service.membership(session, roomId);
      next();
    } catch (error) {
      next(new Error(error instanceof RoomFailure ? error.code : "INVALID_REQUEST"));
    }
  });
  service.onChange = (state) => io.to(state.id).emit("room:state", state);
  service.onEvict = (socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    socket?.emit("room:closed", "Your guest session expired. Join again.");
    socket?.disconnect(true);
  };
  service.onClose = (roomId, reason) => {
    io.to(roomId).emit("room:closed", reason);
    setImmediate(() => io.in(roomId).disconnectSockets(true));
  };
  io.on("connection", (socket) => {
    try {
      const { session, roomId } = identity(socket);
      socket.join(roomId);
      const previous = service.attach(session, roomId, socket.id);
      if (previous && previous !== socket.id) {
        io.sockets.sockets.get(previous)?.emit("session:replaced");
        io.sockets.sockets.get(previous)?.disconnect(true);
      }
      socket.on("disconnect", () => service.detach(session, roomId, socket.id));
      const execute = <T>(ack: Ack<T>, action: () => T) => {
        if (typeof ack !== "function") return;
        try {
          service.limit(`socket:${session.id}`);
          identity(socket);
          ack({ ok: true, data: action() });
        } catch (error) {
          ack({
            ok: false,
            error: {
              code: error instanceof RoomFailure ? error.code : "INVALID_REQUEST",
              message: error instanceof RoomFailure ? error.message : "Invalid room command.",
            },
          });
        }
      };
      socket.on("room:state", (ack) => execute(ack, () => service.membership(session, roomId)));
      socket.on("room:leave", (command, ack) =>
        execute(ack, () => {
          service.command(session, roomId, socket.id, "leave", commandSchema.parse(command));
          socket.leave(roomId);
          setImmediate(() => socket.disconnect(true));
          return null;
        }),
      );
      socket.on("room:close", (command, ack) =>
        execute(ack, () => {
          service.command(session, roomId, socket.id, "close", commandSchema.parse(command));
          return null;
        }),
      );
    } catch {
      socket.disconnect(true);
    }
  });

  return io;
}
