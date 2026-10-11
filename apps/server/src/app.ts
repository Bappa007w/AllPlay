import { PROTOCOL_VERSION, type HealthResponse } from "@allplay/shared";
import express from "express";

export function createApp() {
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

  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  return app;
}
