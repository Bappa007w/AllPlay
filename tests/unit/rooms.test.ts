import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { displayNameSchema, roomIdSchema } from "@allplay/shared";
import { generateRoomId, RoomService } from "../../backend/src/modules/rooms/room-service.js";

describe("room lifecycle", () => {
  function setup() {
    let now = 1_000_000;
    const service = new RoomService(() => now);
    const host = service.bootstrap(undefined).session;
    const initial = service.enter(host, "Host", randomUUID());
    const id = initial.room.id;
    service.attach(host, id, "host-socket");
    return {
      service,
      host,
      id,
      advance: (ms: number) => {
        now += ms;
        service.sweep();
      },
    };
  }
  it("generates unique human-readable codes and validates display names", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateRoomId));
    expect(codes.size).toBe(1000);
    for (const code of codes) expect(roomIdSchema.safeParse(code).success).toBe(true);
    expect(displayNameSchema.parse("  রোশনি  ")).toBe("রোশনি");
    expect(displayNameSchema.safeParse("a\u0000b").success).toBe(false);
  });
  it("deduplicates entry retries and rejects reused IDs with altered payloads", () => {
    const service = new RoomService();
    const { session, token } = service.bootstrap(undefined);
    const request = randomUUID();
    const initial = service.enter(session, "Host", request);
    expect(service.enter(session, "Host", request)).toEqual(initial);
    expect(() => service.enter(session, "Other", request)).toThrow("new request ID");
    expect(service.bootstrap(token!).session.id).toBe(session.id);
    expect(JSON.stringify(initial)).not.toContain(session.id);
    expect(JSON.stringify(initial)).not.toContain(session.csrfToken);
    expect(() => service.authorize(token!, "wrong")).toThrow("Refresh");
  });
  it("preserves exactly one host and enforces capacity with sequential atomic admission", () => {
    const { service, host, id } = setup();
    for (let i = 0; i < 19; i++)
      service.enter(service.bootstrap(undefined).session, `Guest ${i}`, randomUUID(), id);
    expect(() =>
      service.enter(service.bootstrap(undefined).session, "Extra", randomUUID(), id),
    ).toThrow("20 participants");
    expect(
      service.membership(host, id).room.participants.filter((member) => member.role === "host"),
    ).toHaveLength(1);
  });
  it("reserves participant seats for two minutes and host ownership for ten", () => {
    const { service, host, id, advance } = setup();
    const guest = service.bootstrap(undefined).session;
    service.enter(guest, "Guest", randomUUID(), id);
    const before = service.membership(guest, id).participantId;
    service.attach(guest, id, "guest-1");
    service.detach(guest, id, "guest-1");
    advance(119_000);
    service.attach(guest, id, "guest-2");
    expect(service.membership(guest, id).participantId).toBe(before);
    service.detach(guest, id, "guest-2");
    advance(120_000);
    expect(() => service.membership(guest, id)).toThrow("Enter your name");
    service.detach(host, id, "host-socket");
    advance(599_000);
    expect(service.membership(host, id).room.participants[0]?.role).toBe("host");
    advance(1000);
    expect(() => service.membership(host, id)).toThrow("unavailable");
  });
  it("does not let old tab disconnect overwrite new connection presence", () => {
    const { service, host, id } = setup();
    expect(service.attach(host, id, "replacement")).toBe("host-socket");
    service.detach(host, id, "host-socket");
    expect(service.membership(host, id).room.participants[0]?.connected).toBe(true);
    expect(() =>
      service.command(host, id, "host-socket", "close", {
        requestId: randomUUID(),
        expectedRevision: 0,
      }),
    ).toThrow("another tab");
  });
  it("rejects participant close, host leave and stale revisions", () => {
    const { service, host, id } = setup();
    const guest = service.bootstrap(undefined).session;
    service.enter(guest, "Guest", randomUUID(), id);
    service.attach(guest, id, "guest");
    const command = {
      requestId: randomUUID(),
      expectedRevision: service.membership(host, id).room.revision,
    };
    expect(() => service.command(guest, id, "guest", "close", command)).toThrow("Only the Host");
    expect(() => service.command(host, id, "host-socket", "leave", command)).toThrow("must close");
    expect(() =>
      service.command(host, id, "host-socket", "close", { ...command, expectedRevision: 0 }),
    ).toThrow("Room changed");
    service.command(guest, id, "guest", "leave", command);
    expect(service.membership(host, id).room.participants).toHaveLength(1);
    service.command(host, id, "host-socket", "close", {
      ...command,
      expectedRevision: service.membership(host, id).room.revision,
    });
    expect(() => service.membership(host, id)).toThrow("unavailable");
  });
  it("expires rooms and cookies and fails closed after restart", () => {
    const { service, host, id, advance } = setup();
    const { token } = service.bootstrap(undefined);
    expect(() => new RoomService().session(token!)).toThrow("expired");
    advance(24 * 60 * 60_000);
    expect(() => service.membership(host, id)).toThrow("unavailable");
    expect(() => service.session(token!)).toThrow("expired");
  });
  it("bounds rate limiting windows", () => {
    const { service, advance } = setup();
    service.limit("test", 1);
    expect(() => service.limit("test", 1)).toThrow("Too many");
    advance(60_000);
    expect(() => service.limit("test", 1)).not.toThrow();
  });
});
