import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MemoryStateStore,
  RoomCoordinator,
  type StateStore,
} from "../../backend/src/modules/rooms/coordinator.js";

describe("shared room authority", () => {
  it("recovers sessions and rooms on a new instance and does not lose concurrent admissions", async () => {
    const store = new MemoryStateStore();
    const first = new RoomCoordinator(store, true),
      second = new RoomCoordinator(store, true);
    const host = await first.run((rooms) => {
      const { session, token } = rooms.bootstrap(undefined);
      return { token: token!, membership: rooms.enter(session, "Host", randomUUID()) };
    });
    const recovered = await second.run((rooms) =>
      rooms.membership(rooms.session(host.token), host.membership.room.id),
    );
    expect(recovered.participantId).toBe(host.membership.participantId);
    const guests = await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        (i % 2 ? first : second).run((rooms) => rooms.bootstrap(undefined).token!),
      ),
    );
    const results = await Promise.allSettled(
      guests.map((token, i) =>
        (i % 2 ? first : second).run((rooms) =>
          rooms.enter(rooms.session(token), "Guest", randomUUID(), host.membership.room.id),
        ),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(19);
    const state = await first.run((rooms) =>
      rooms.membership(rooms.session(host.token), host.membership.room.id),
    );
    expect(state.room.participants).toHaveLength(20);
    expect(state.room.participants.filter((member) => member.role === "host")).toHaveLength(1);
  });

  it("publishes only committed changes even after a conflict", async () => {
    const memory = new MemoryStateStore();
    let rejectOnce = true;
    let notifications = 0;
    const store: StateStore = {
      read: () => memory.read(),
      compareAndSet: (expected, next) => {
        if (rejectOnce) {
          rejectOnce = false;
          return Promise.resolve(false);
        }
        return memory.compareAndSet(expected, next);
      },
    };
    const coordinator = new RoomCoordinator(store, true);
    coordinator.onChange = () => notifications++;
    await coordinator.run((rooms) =>
      rooms.enter(rooms.bootstrap(undefined).session, "Host", randomUUID()),
    );
    expect(notifications).toBe(1);
  });

  it("expires crashed-instance presence and rejects stale-tab lease renewal", async () => {
    let now = 1_000_000;
    const store = new MemoryStateStore();
    const coordinator = new RoomCoordinator(store, true, () => now);
    const created = await coordinator.run((rooms) => {
      const { session, token } = rooms.bootstrap(undefined);
      const membership = rooms.enter(session, "Host", randomUUID());
      rooms.attach(session, membership.room.id, "old");
      return { token: token!, id: membership.room.id };
    });
    await coordinator.run((rooms) => rooms.attach(rooms.session(created.token), created.id, "new"));
    const stale = await coordinator.run((rooms) =>
      rooms.heartbeat([{ token: created.token, roomId: created.id, socketId: "old" }]),
    );
    expect(stale[0]?.membership).toBeNull();
    now += 90_001;
    const state = await coordinator.run((rooms) =>
      rooms.membership(rooms.session(created.token), created.id),
    );
    expect(state.room.participants[0]?.connected).toBe(false);
    now += 600_000;
    await expect(
      coordinator.run((rooms) => rooms.membership(rooms.session(created.token), created.id)),
    ).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
  });

  it("fails closed on storage errors and corrupt data without disclosing secrets", async () => {
    const store: StateStore = {
      read: async () => {
        throw Error("rediss://private:password@provider");
      },
      compareAndSet: async () => false,
    };
    await expect(
      new RoomCoordinator(store).run((rooms) => rooms.bootstrap(undefined)),
    ).rejects.toMatchObject({
      code: "STORE_UNAVAILABLE",
      message: "Room storage is unavailable. Please retry later.",
    });
    const invalid: StateStore = {
      read: async () => ({ version: "broken", value: "{}" }),
      compareAndSet: async () => false,
    };
    await expect(
      new RoomCoordinator(invalid).run((rooms) => rooms.bootstrap(undefined)),
    ).rejects.toMatchObject({ code: "STORE_UNAVAILABLE" });
  });

  it("enforces a five-room free demo cap across instances", async () => {
    const coordinator = new RoomCoordinator(new MemoryStateStore(), true);
    for (let i = 0; i < 5; i++)
      await coordinator.run((rooms) =>
        rooms.enter(rooms.bootstrap(undefined).session, "Host", randomUUID()),
      );
    await expect(
      coordinator.run((rooms) =>
        rooms.enter(rooms.bootstrap(undefined).session, "Host", randomUUID()),
      ),
    ).rejects.toMatchObject({ code: "BUSY" });
  });
});
