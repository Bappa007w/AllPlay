import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Membership, RoomCommand, RoomState, RoomParticipant } from "@allplay/shared";

const MINUTE = 60_000;
const LIFETIME = 24 * 60 * MINUTE;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function generateRoomId() {
  return Array.from(randomBytes(12), (byte) => alphabet[byte % 32]).join("");
}
export class RoomFailure extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type Session = {
  id: string;
  csrfToken: string;
  expiresAt: number;
  roomId: string | null;
  requests: Map<string, { fingerprint: string; roomId: string }>;
};
type Member = RoomParticipant & {
  sessionId: string;
  socketId: string | null;
  disconnectedAt: number;
};
type Room = Omit<RoomState, "participants"> & {
  participants: Map<string, Member>;
  emptySince: number | null;
};
export class RoomService {
  private sessions = new Map<string, Session>();
  private rooms = new Map<string, Room>();
  private limits = new Map<string, { count: number; until: number }>();
  onChange: (state: RoomState) => void = () => {};
  onClose: (roomId: string, reason: string) => void = () => {};
  onEvict: (socketId: string) => void = () => {};
  constructor(private now = Date.now) {}

  limit(key: string, maximum = 60) {
    const time = this.now();
    let bucket = this.limits.get(key);
    if (!bucket || bucket.until <= time) {
      if (!bucket && this.limits.size >= 10_000)
        throw new RoomFailure("BUSY", "Please try again later.", 503);
      bucket = { count: 0, until: time + MINUTE };
      this.limits.set(key, bucket);
    }
    if (++bucket.count > maximum)
      throw new RoomFailure("RATE_LIMITED", "Too many requests. Wait a minute and retry.", 429);
  }
  session(token: string | undefined): Session {
    const session = token ? this.sessions.get(digest(token)) : undefined;
    if (!session || session.expiresAt <= this.now())
      throw new RoomFailure("AUTH_REQUIRED", "Your guest session expired. Join again.", 401);
    return session;
  }
  bootstrap(token: string | undefined) {
    this.sweep();
    try {
      return { session: this.session(token), token: null };
    } catch {
      /* expired or absent */
    }
    if (this.sessions.size >= 5000)
      throw new RoomFailure("BUSY", "Guest capacity reached. Try later.", 503);
    const secret = randomBytes(32).toString("base64url");
    const session: Session = {
      id: digest(secret),
      csrfToken: randomBytes(32).toString("base64url"),
      expiresAt: this.now() + LIFETIME,
      roomId: null,
      requests: new Map(),
    };
    this.sessions.set(session.id, session);
    return { session, token: secret };
  }
  authorize(token: string | undefined, csrf: unknown) {
    const session = this.session(token);
    if (typeof csrf !== "string" || digest(csrf) !== digest(session.csrfToken))
      throw new RoomFailure("CSRF_REJECTED", "Refresh the page and retry.", 403);
    return session;
  }
  private room(id: string) {
    const room = this.rooms.get(id);
    if (!room)
      throw new RoomFailure("ROOM_NOT_FOUND", "This room is unavailable or has expired.", 404);
    return room;
  }
  private snapshot(room: Room): RoomState {
    return {
      id: room.id,
      revision: room.revision,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      capacity: room.capacity,
      participants: Array.from(
        room.participants.values(),
        ({ id, displayName, role, connected }) => ({ id, displayName, role, connected }),
      ),
    };
  }
  private changed(room: Room) {
    room.revision++;
    const empty = !Array.from(room.participants.values()).some((member) => member.connected);
    room.emptySince = empty ? (room.emptySince ?? this.now()) : null;
    this.onChange(this.snapshot(room));
  }
  membership(session: Session, roomId: string): Membership {
    this.sweep();
    const room = this.room(roomId);
    const member = room.participants.get(session.id);
    if (!member) throw new RoomFailure("NOT_A_MEMBER", "Enter your name to join this room.", 403);
    return { room: this.snapshot(room), participantId: member.id };
  }
  enter(session: Session, displayName: string, requestId: string, roomId?: string): Membership {
    this.sweep();
    const fingerprint = JSON.stringify([roomId ?? "create", displayName]);
    const previous = session.requests.get(requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new RoomFailure("REQUEST_CONFLICT", "Use a new request ID for new details.", 409);
      return this.membership(session, previous.roomId);
    }
    if (session.roomId) {
      if (session.roomId === roomId) return this.membership(session, roomId);
      throw new RoomFailure(
        "ALREADY_IN_ROOM",
        "Leave or close your current room before entering another.",
        409,
      );
    }
    if (session.requests.size >= 100)
      throw new RoomFailure(
        "SESSION_LIMIT",
        "This guest session has reached its room entry limit.",
        429,
      );
    if (!roomId && this.rooms.size >= 500)
      throw new RoomFailure("BUSY", "Room capacity reached. Try later.", 503);
    let room: Room;
    if (roomId) room = this.room(roomId);
    else {
      let id = generateRoomId();
      while (this.rooms.has(id)) id = generateRoomId();
      room = {
        id,
        revision: 0,
        capacity: 20,
        createdAt: this.now(),
        expiresAt: this.now() + LIFETIME,
        participants: new Map(),
        emptySince: this.now(),
      };
      this.rooms.set(id, room);
    }
    if (room.participants.size >= room.capacity)
      throw new RoomFailure("ROOM_FULL", "This room already has 20 participants.", 409);
    room.participants.set(session.id, {
      id: randomUUID(),
      displayName,
      role: roomId ? "participant" : "host",
      connected: false,
      sessionId: session.id,
      socketId: null,
      disconnectedAt: this.now(),
    });
    session.roomId = room.id;
    session.requests.set(requestId, { fingerprint, roomId: room.id });
    this.changed(room);
    return this.membership(session, room.id);
  }
  attach(session: Session, roomId: string, socketId: string) {
    this.membership(session, roomId);
    const room = this.room(roomId);
    const member = room.participants.get(session.id)!;
    const previousSocket = member.socketId;
    member.socketId = socketId;
    member.connected = true;
    this.changed(room);
    return previousSocket;
  }
  detach(session: Session, roomId: string, socketId: string) {
    const room = this.rooms.get(roomId);
    const member = room?.participants.get(session.id);
    if (!room || !member || member.socketId !== socketId) return;
    member.socketId = null;
    member.connected = false;
    member.disconnectedAt = this.now();
    this.changed(room);
  }
  command(
    session: Session,
    roomId: string,
    socketId: string,
    kind: "leave" | "close",
    command: RoomCommand,
  ) {
    this.membership(session, roomId);
    const room = this.room(roomId),
      member = room.participants.get(session.id)!;
    if (member.socketId !== socketId)
      throw new RoomFailure("SESSION_REPLACED", "This room is active in another tab.", 409);
    if (kind === "close" && member.role !== "host")
      throw new RoomFailure("FORBIDDEN", "Only the Host can close this room.", 403);
    if (kind === "leave" && member.role === "host")
      throw new RoomFailure("HOST_MUST_CLOSE", "The Host must close the room to leave.", 409);
    if (command.expectedRevision !== room.revision)
      throw new RoomFailure(
        "STALE_REVISION",
        "Room changed. Review the latest state and retry.",
        409,
      );
    if (kind === "close") this.closeRoom(room, "The Host closed the room.");
    else {
      room.participants.delete(session.id);
      session.roomId = null;
      this.changed(room);
    }
  }
  private closeRoom(room: Room, reason: string) {
    this.rooms.delete(room.id);
    for (const member of room.participants.values()) {
      const session = this.sessions.get(member.sessionId);
      if (session?.roomId === room.id) session.roomId = null;
    }
    this.onClose(room.id, reason);
  }
  sweep() {
    const time = this.now();
    for (const room of this.rooms.values()) {
      const host = Array.from(room.participants.values()).find((member) => member.role === "host");
      if (
        room.expiresAt <= time ||
        !host ||
        (this.sessions.get(host.sessionId)?.expiresAt ?? 0) <= time ||
        (!host.connected && host.disconnectedAt + 10 * MINUTE <= time) ||
        (room.emptySince !== null && room.emptySince + 10 * MINUTE <= time)
      ) {
        this.closeRoom(room, "The room expired or its Host was away for 10 minutes.");
        continue;
      }
      for (const member of room.participants.values()) {
        if (
          member.role !== "host" &&
          ((!member.connected && member.disconnectedAt + 2 * MINUTE <= time) ||
            (this.sessions.get(member.sessionId)?.expiresAt ?? 0) <= time)
        ) {
          room.participants.delete(member.sessionId);
          if (member.socketId) this.onEvict(member.socketId);
          const session = this.sessions.get(member.sessionId);
          if (session) session.roomId = null;
          this.changed(room);
        }
      }
    }
    for (const [key, session] of this.sessions)
      if (session.expiresAt <= time) this.sessions.delete(key);
    for (const [key, bucket] of this.limits) if (bucket.until <= time) this.limits.delete(key);
  }
}
