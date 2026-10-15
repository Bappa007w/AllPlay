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

export const roomIdSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{12}$/);
export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .refine(
    (value) =>
      !Array.from(value).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ),
    "Control characters are not allowed",
  );
export const entrySchema = z
  .object({ displayName: displayNameSchema, requestId: z.uuid() })
  .strict();
export const commandSchema = z
  .object({ requestId: z.uuid(), expectedRevision: z.number().int().nonnegative() })
  .strict();
export const socketAuthSchema = z
  .object({ roomId: roomIdSchema, csrfToken: z.string().length(43) })
  .strict();
export const participantCommandSchema = commandSchema.extend({ participantId: z.uuid() });
export type ParticipantCommand = z.infer<typeof participantCommandSchema>;
export type ParticipantAction = "officer:promote" | "officer:demote" | "participant:remove";
export const MAX_OFFICERS = 3;
export type RoomParticipant = {
  id: string;
  displayName: string;
  role: "host" | "officer" | "participant";
  connected: boolean;
};
export type RoomState = {
  id: string;
  revision: number;
  createdAt: number;
  expiresAt: number;
  capacity: number;
  participants: RoomParticipant[];
};
export type RoomCommand = z.infer<typeof commandSchema>;
export type RoomError = { code: string; message: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: RoomError };
export type Membership = { room: RoomState; participantId: string };
export type Ack<T> = (result: Result<T>) => void;
export type ClientToServerEvents = {
  "officer:promote": (command: ParticipantCommand, ack: Ack<Membership>) => void;
  "officer:demote": (command: ParticipantCommand, ack: Ack<Membership>) => void;
  "participant:remove": (command: ParticipantCommand, ack: Ack<Membership>) => void;
  "room:state": (ack: Ack<Membership>) => void;
  "room:leave": (command: RoomCommand, ack: Ack<null>) => void;
  "room:close": (command: RoomCommand, ack: Ack<null>) => void;
};
export type ServerToClientEvents = {
  "participant:removed": () => void;
  "room:state": (state: RoomState) => void;
  "room:closed": (reason: string) => void;
  "session:replaced": () => void;
};
