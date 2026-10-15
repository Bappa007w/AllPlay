import type { Server as HttpServer } from "node:http";
import {
  commandSchema,
  participantCommandSchema,
  socketAuthSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type Ack,
} from "@allplay/shared";
import { Server } from "socket.io";
import { cookieToken } from "../modules/rooms/http.js";
import { RoomFailure, type RoomService } from "../modules/rooms/room-service.js";
import type { RoomCoordinator } from "../modules/rooms/coordinator.js";

export function createSocketServer(
  httpServer: HttpServer,
  webOrigin: string,
  coordinator: RoomCoordinator,
  production: boolean,
  cloud: boolean,
  ready: () => Promise<void>,
) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    serveClient: false,
    maxHttpBufferSize: 16 * 1024,
    ...(cloud ? { transports: ["websocket" as const] } : {}),
    cors: { origin: webOrigin, credentials: true, methods: ["GET", "POST"] },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      let sameOriginGet = false;
      if (
        !origin &&
        request.method === "GET" &&
        request.headers["sec-fetch-site"] === "same-origin"
      ) {
        try {
          sameOriginGet = new URL(request.headers.referer ?? "").origin === webOrigin;
        } catch {
          /* reject */
        }
      }
      callback(null, origin === webOrigin || sameOriginGet);
    },
  });
  const cookieName = production ? "__Host-allplay_guest" : "allplay_guest";
  const connections = new Map<
    string,
    { token: string; roomId: string; csrfToken: string; socketId: string }
  >();
  coordinator.onChange = (state) => io.to(state.id).emit("room:state", state);
  coordinator.onRemove = (socketId) => {
    io.to(socketId).emit("participant:removed");
    io.in(socketId).disconnectSockets(true);
  };
  coordinator.onEvict = (socketId) => {
    io.to(socketId).emit("room:closed", "Your guest session expired. Join again.");
    io.in(socketId).disconnectSockets(true);
  };
  coordinator.onClose = (roomId, reason) => {
    io.to(roomId).emit("room:closed", reason);
    setImmediate(() => io.in(roomId).disconnectSockets(true));
  };
  io.use(async (socket, next) => {
    try {
      const token = cookieToken(socket.handshake.headers.cookie, cookieName);
      if (!token) return next(new Error("AUTH_REQUIRED"));
      const auth = socketAuthSchema.parse(socket.handshake.auth);
      await ready();
      const previous = await coordinator.run((rooms) => {
        const session = rooms.authorize(token, auth.csrfToken);
        rooms.limit(`connect:${session.id}`, 60);
        return rooms.attach(session, auth.roomId, socket.id);
      });
      if (socket.conn.readyState !== "open") {
        await coordinator.run((rooms) =>
          rooms.detach(rooms.session(token), auth.roomId, socket.id),
        );
        return next(new Error("CONNECTION_CLOSED"));
      }
      connections.set(socket.id, {
        token,
        roomId: auth.roomId,
        csrfToken: auth.csrfToken,
        socketId: socket.id,
      });
      await socket.join(auth.roomId);
      if (previous && previous !== socket.id) {
        io.to(previous).emit("session:replaced");
        io.in(previous).disconnectSockets(true);
      }
      next();
    } catch (error) {
      next(new Error(error instanceof RoomFailure ? error.code : "CONNECTION_UNAVAILABLE"));
    }
  });
  io.on("connection", (socket) => {
    const identity = connections.get(socket.id)!;
    socket.on("disconnect", () => {
      connections.delete(socket.id);
      void coordinator
        .run((rooms) => {
          rooms.detach(rooms.session(identity.token), identity.roomId, socket.id);
        })
        .catch(() => {
          /* Persisted lease expires even if the instance cannot write. */
        });
    });
    const execute = async <T>(ack: Ack<T>, action: (rooms: RoomService) => T) => {
      if (typeof ack !== "function") return false;
      try {
        const data = await coordinator.run((rooms) => {
          rooms.authorize(identity.token, identity.csrfToken);
          rooms.limit(`socket:${rooms.session(identity.token).id}`);
          return action(rooms);
        });
        ack({ ok: true, data });
        return true;
      } catch (error) {
        ack({
          ok: false,
          error: {
            code: error instanceof RoomFailure ? error.code : "INVALID_REQUEST",
            message: error instanceof RoomFailure ? error.message : "Invalid room command.",
          },
        });
        return false;
      }
    };
    socket.on(
      "room:state",
      (ack) =>
        void execute(ack, (rooms) =>
          rooms.membership(rooms.session(identity.token), identity.roomId),
        ),
    );
    for (const action of ["officer:promote", "officer:demote", "participant:remove"] as const) {
      socket.on(
        action,
        (command, ack) =>
          void execute(ack, (rooms) =>
            rooms.manageParticipant(
              rooms.session(identity.token),
              identity.roomId,
              socket.id,
              action,
              participantCommandSchema.parse(command),
            ),
          ),
      );
    }
    socket.on("room:leave", (command, ack) => {
      void execute(ack, (rooms) => {
        rooms.command(
          rooms.session(identity.token),
          identity.roomId,
          socket.id,
          "leave",
          commandSchema.parse(command),
        );
        return null;
      })
        .then((left) => {
          if (left) {
            socket.leave(identity.roomId);
            setImmediate(() => socket.disconnect(true));
          }
        })
        .catch(() => {});
    });
    socket.on(
      "room:close",
      (command, ack) =>
        void execute(ack, (rooms) => {
          rooms.command(
            rooms.session(identity.token),
            identity.roomId,
            socket.id,
            "close",
            commandSchema.parse(command),
          );
          return null;
        }),
    );
  });
  let refreshing = false;
  async function refresh() {
    if (refreshing || connections.size === 0) return;
    refreshing = true;
    try {
      const states = await coordinator.run((rooms) =>
        rooms.heartbeat(Array.from(connections.values())),
      );
      for (const { socketId, membership } of states) {
        const socket = io.sockets.sockets.get(socketId);
        if (!socket) continue;
        if (membership) socket.emit("room:state", membership.room);
        else {
          socket.emit(
            "room:closed",
            "Your room session ended. Refresh to check its current state.",
          );
          socket.disconnect(true);
        }
      }
    } catch {
      // A forced transport close lets clients reconnect when storage recovers.
      for (const socket of io.sockets.sockets.values()) socket.conn.close();
    } finally {
      refreshing = false;
    }
  }
  const heartbeat = setInterval(() => void refresh(), cloud ? 30_000 : 1000);
  heartbeat.unref();
  return { io, stop: () => clearInterval(heartbeat) };
}
