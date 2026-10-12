import { Router } from "express";
import { entrySchema, roomIdSchema } from "@allplay/shared";
import { RoomFailure, type RoomService } from "./room-service.js";

export function cookieToken(header: string | undefined, name: string) {
  const value = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
export function roomRouter(service: RoomService, origin: string, production: boolean) {
  const router = Router();
  const cookieName = production ? "__Host-allplay_guest" : "allplay_guest";
  router.use((request, _response, next) => {
    try {
      service.limit(`http:${request.socket.remoteAddress ?? "unknown"}`, 240);
      if (request.method !== "GET" && request.headers.origin !== origin)
        throw new RoomFailure("ORIGIN_REJECTED", "Untrusted request origin.", 403);
      next();
    } catch (error) {
      next(error);
    }
  });
  router.post("/session", (request, response) => {
    const { session, token } = service.bootstrap(cookieToken(request.headers.cookie, cookieName));
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
  router.post(["/rooms", "/rooms/:roomId/join"], (request, response) => {
    const session = service.authorize(
      cookieToken(request.headers.cookie, cookieName),
      request.headers["x-csrf-token"],
    );
    service.limit(`entry:${session.id}`, 20);
    const body = entrySchema.parse(request.body);
    const roomId =
      request.params.roomId === undefined ? undefined : roomIdSchema.parse(request.params.roomId);
    response.json({
      ok: true,
      data: service.enter(session, body.displayName, body.requestId, roomId),
    });
  });
  router.get("/rooms/:roomId", (request, response) => {
    const session = service.session(cookieToken(request.headers.cookie, cookieName));
    response.json({
      ok: true,
      data: service.membership(session, roomIdSchema.parse(request.params.roomId)),
    });
  });
  return router;
}
