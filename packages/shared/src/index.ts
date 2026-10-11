import { z } from "zod";

export const APP_NAME = "AllPlay";
export const APP_TAGLINE = "One Beat. Every Device.";
export const PROTOCOL_VERSION = 1;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("allplay-server"),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// Phase 1 intentionally has no application socket events or room permissions.
export type ClientToServerEvents = Record<never, never>;
export type ServerToClientEvents = Record<never, never>;
