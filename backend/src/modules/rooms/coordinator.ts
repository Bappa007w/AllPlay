import { randomUUID } from "node:crypto";
import type { RoomState } from "@allplay/shared";
import { RoomFailure, RoomService } from "./room-service.js";

export type StoredState = { version: string; value: string };
export interface StateStore {
  read(): Promise<StoredState | null>;
  compareAndSet(expected: string | null, next: StoredState): Promise<boolean>;
}
export class MemoryStateStore implements StateStore {
  private state: StoredState | null = null;
  async read() {
    return this.state;
  }
  async compareAndSet(expected: string | null, next: StoredState) {
    if ((this.state?.version ?? null) !== expected) return false;
    this.state = next;
    return true;
  }
}
type Event =
  | { kind: "state"; state: RoomState }
  | { kind: "close"; roomId: string; reason: string }
  | { kind: "evict"; socketId: string };
export class RoomCoordinator {
  onChange: (state: RoomState) => void = () => {};
  onClose: (roomId: string, reason: string) => void = () => {};
  onEvict: (socketId: string) => void = () => {};
  constructor(
    private store: StateStore = new MemoryStateStore(),
    private cloud = false,
    private now = Date.now,
  ) {}

  async run<T>(action: (rooms: RoomService) => T): Promise<T> {
    for (let attempt = 0; attempt < 12; attempt++) {
      let previous: StoredState | null;
      try {
        previous = await this.store.read();
      } catch {
        throw unavailable();
      }
      const rooms = new RoomService(
        this.now,
        this.cloud ? { rooms: 5, sessions: 100 } : undefined,
        this.cloud,
      );
      try {
        if (previous) rooms.restore(previous.value);
      } catch {
        throw unavailable();
      }
      const events: Event[] = [];
      rooms.onChange = (state) => events.push({ kind: "state", state });
      rooms.onClose = (roomId, reason) => events.push({ kind: "close", roomId, reason });
      rooms.onEvict = (socketId) => events.push({ kind: "evict", socketId });
      let data: T | undefined;
      let failure: RoomFailure | undefined;
      try {
        rooms.sweep();
        data = action(rooms);
      } catch (error) {
        if (error instanceof RoomFailure) failure = error;
        else throw error;
      }
      const value = rooms.serialize();
      if (this.cloud && Buffer.byteLength(value) > 512 * 1024)
        throw new RoomFailure(
          "CAPACITY_REACHED",
          "The free demo is at capacity. Please try later.",
          503,
        );
      if (value !== previous?.value) {
        let committed: boolean;
        try {
          committed = await this.store.compareAndSet(previous?.version ?? null, {
            version: randomUUID(),
            value,
          });
        } catch {
          throw unavailable();
        }
        if (!committed) {
          await new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 20));
          continue;
        }
      }
      // Side effects happen only after the successful compare-and-set, never on retries.
      for (const event of events) {
        if (event.kind === "state") this.onChange(event.state);
        else if (event.kind === "close") this.onClose(event.roomId, event.reason);
        else this.onEvict(event.socketId);
      }
      if (failure) throw failure;
      return data as T;
    }
    throw new RoomFailure("BUSY", "The room is busy. Please retry.", 503);
  }
}
function unavailable() {
  return new RoomFailure(
    "STORE_UNAVAILABLE",
    "Room storage is unavailable. Please retry later.",
    503,
  );
}
