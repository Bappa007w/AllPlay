import { PROTOCOL_VERSION, type HealthResponse } from "@allplay/shared";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { roomRouter } from "./modules/rooms/http.js";
import { RoomFailure } from "./modules/rooms/room-service.js";
import type { RoomCoordinator } from "./modules/rooms/coordinator.js";

export function createApp(service: RoomCoordinator, origin: string, production: boolean) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  // Liveness only. No database, storage, room or synchronization readiness is implied.
  app.get("/api/v1/health", (_request, response) => {
    const body: HealthResponse = {
      status: "ok",
      service: "allplay-server",
      protocolVersion: PROTOCOL_VERSION,
    };
    response.json(body);
  });

  app.use("/api/v1", express.json({ limit: "16kb" }), roomRouter(service, origin, production));
  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const failure =
      error instanceof RoomFailure
        ? error
        : error instanceof ZodError || error instanceof SyntaxError
          ? new RoomFailure("INVALID_REQUEST", "Check the submitted room details.")
          : typeof error === "object" && error !== null && "status" in error && error.status === 413
            ? new RoomFailure("PAYLOAD_TOO_LARGE", "Request is too large.", 413)
            : new RoomFailure("INTERNAL_ERROR", "Something went wrong. Please retry.", 500);
    response
      .status(failure.status)
      .json({ ok: false, error: { code: failure.code, message: failure.message } });
  };
  app.use(errors);
  return app;
}
