import { Router } from "express";
import { entrySchema, roomIdSchema } from "@allplay/shared";
import { RoomFailure } from "./room-service.js";
import type { RoomCoordinator } from "./coordinator.js";

export function cookieToken(header: string | undefined, name: string) {
  const value = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
export function roomRouter(coordinator: RoomCoordinator, origin: string, production: boolean) {
  const router = Router();
  const cookieName = production ? "__Host-allplay_guest" : "allplay_guest";
  router.use((request, _response, next) => {
    if (request.method !== "GET" && request.headers.origin !== origin)
      return next(new RoomFailure("ORIGIN_REJECTED", "Untrusted request origin.", 403));
    next();
  });
  router.post("/session", async (request, response) => {
    const { session, token } = await coordinator.run((rooms) => {
      rooms.limit(`http:${request.socket.remoteAddress ?? "unknown"}`, 240);
      return rooms.bootstrap(cookieToken(request.headers.cookie, cookieName));
    });
    if (token)
      response.cookie(cookieName, token, {
        httpOnly: true,
        secure: production,
        sameSite: "strict",
        path: "/",
        maxAge: session.expiresAt - Date.now(),
      });
    response.json({
      ok: true,
      data: { csrfToken: session.csrfToken, expiresAt: session.expiresAt, roomId: session.roomId },
    });
  });
  router.post(["/rooms", "/rooms/:roomId/join"], async (request, response) => {
    const membership = await coordinator.run((rooms) => {
      const session = rooms.authorize(
        cookieToken(request.headers.cookie, cookieName),
        request.headers["x-csrf-token"],
      );
      rooms.limit(`entry:${session.id}`, 20);
      const body = entrySchema.parse(request.body);
      const roomId =
        request.params.roomId === undefined ? undefined : roomIdSchema.parse(request.params.roomId);
      return rooms.enter(session, body.displayName, body.requestId, roomId);
    });
    response.json({ ok: true, data: membership });
  });
  router.get("/rooms/:roomId", async (request, response) => {
    const roomId = roomIdSchema.parse(request.params.roomId);
    const membership = await coordinator.run((rooms) => {
      const session = rooms.session(cookieToken(request.headers.cookie, cookieName));
      rooms.limit(`read:${session.id}`, 60);
      return rooms.membership(session, roomId);
    });
    response.json({ ok: true, data: membership });
  });
  return router;
}
