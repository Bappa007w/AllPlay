import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { participantCommandSchema, type ParticipantAction } from "@allplay/shared";
import { RoomService } from "../../backend/src/modules/rooms/room-service.js";
import { MemoryStateStore, RoomCoordinator } from "../../backend/src/modules/rooms/coordinator.js";

function setup() {
  const service = new RoomService();
  const host = service.bootstrap(undefined).session;
  const id = service.enter(host, "Host", randomUUID()).room.id;
  service.attach(host, id, "host");
  const guests = Array.from({ length: 4 }, (_, i) => {
    const session = service.bootstrap(undefined).session;
    const member = service.enter(session, `Guest ${i}`, randomUUID(), id);
    service.attach(session, id, `guest-${i}`);
    return { session, participantId: member.participantId };
  });
  const command = (participantId: string) => ({
    participantId,
    requestId: randomUUID(),
    expectedRevision: service.membership(host, id).room.revision,
  });
  const manage = (action: ParticipantAction, index: number) =>
    service.manageParticipant(host, id, "host", action, command(guests[index]!.participantId));
  return { service, host, id, guests, command, manage };
}
describe("room role authority", () => {
  it("caps Officers at three, frees demoted slots and restores persisted roles", () => {
    const { service, host, id, manage } = setup();
    for (let i = 0; i < 3; i++) manage("officer:promote", i);
    expect(() => manage("officer:promote", 3)).toThrow("at most three");
    manage("officer:demote", 0);
    manage("officer:promote", 3);
    const restored = new RoomService();
    restored.restore(service.serialize());
    expect(
      restored.membership(host, id).room.participants.filter((p) => p.role === "officer"),
    ).toHaveLength(3);
  });
  it("rejects participant and Officer management, host targeting and stale/replaced commands", () => {
    const { service, host, id, guests, command, manage } = setup();
    for (const role of ["participant", "officer"]) {
      if (role === "officer") manage("officer:promote", 0);
      for (const action of ["officer:promote", "officer:demote", "participant:remove"] as const)
        expect(() =>
          service.manageParticipant(
            guests[0]!.session,
            id,
            "guest-0",
            action,
            command(guests[1]!.participantId),
          ),
        ).toThrow("Only the Host");
      expect(() =>
        service.command(
          guests[0]!.session,
          id,
          "guest-0",
          "close",
          command(guests[0]!.participantId),
        ),
      ).toThrow("Only the Host");
    }
    expect(() =>
      service.manageParticipant(
        host,
        id,
        "host",
        "participant:remove",
        command(service.membership(host, id).participantId),
      ),
    ).toThrow("Host cannot");
    const stale = command(guests[1]!.participantId);
    manage("officer:demote", 0);
    expect(() => service.manageParticipant(host, id, "host", "officer:promote", stale)).toThrow(
      "Room changed",
    );
    expect(() =>
      service.manageParticipant(
        host,
        id,
        "old",
        "officer:promote",
        command(guests[1]!.participantId),
      ),
    ).toThrow("another tab");
    expect(() =>
      service.manageParticipant(host, id, "host", "officer:promote", command(randomUUID())),
    ).toThrow("no longer");
    expect(participantCommandSchema.safeParse({ ...stale, role: "host" }).success).toBe(false);
  });
  it("removes membership, revokes reconnect, emits targeted removal and allows a fresh participant join", () => {
    const { service, id, guests, manage } = setup();
    const removed = vi.fn();
    service.onRemove = removed;
    manage("officer:promote", 0);
    manage("participant:remove", 0);
    expect(removed).toHaveBeenCalledWith("guest-0");
    expect(() => service.attach(guests[0]!.session, id, "retry")).toThrow("Enter your name");
    const fresh = service.enter(guests[0]!.session, "Returning", randomUUID(), id);
    expect(fresh.participantId).not.toBe(guests[0]!.participantId);
    expect(fresh.room.participants.find((p) => p.id === fresh.participantId)?.role).toBe(
      "participant",
    );
  });
  it("serializes simultaneous promotions across coordinators without exceeding three", async () => {
    const store = new MemoryStateStore();
    const first = new RoomCoordinator(store),
      second = new RoomCoordinator(store);
    const { token, id, targets } = await first.run((rooms) => {
      const { session, token } = rooms.bootstrap(undefined);
      const id = rooms.enter(session, "Host", randomUUID()).room.id;
      rooms.attach(session, id, "host");
      const targets = Array.from(
        { length: 4 },
        () =>
          rooms.enter(rooms.bootstrap(undefined).session, "Guest", randomUUID(), id).participantId,
      );
      return { token: token!, id, targets };
    });
    const results = await Promise.allSettled(
      targets.map((participantId, i) =>
        (i % 2 ? first : second).run((rooms) => {
          const host = rooms.session(token);
          return rooms.manageParticipant(host, id, "host", "officer:promote", {
            participantId,
            requestId: randomUUID(),
            expectedRevision: rooms.membership(host, id).room.revision,
          });
        }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    const state = await first.run((rooms) => rooms.membership(rooms.session(token), id));
    expect(state.room.participants.filter((p) => p.role === "officer")).toHaveLength(3);
  });
});
