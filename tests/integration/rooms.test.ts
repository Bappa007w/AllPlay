import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Membership,
  Result,
} from "@allplay/shared";
import { createRuntime } from "../../apps/server/src/server.js";
import { parseEnvironment } from "../../apps/server/src/config/environment.js";

describe("authenticated room HTTP and sockets", () => {
  let runtime: ReturnType<typeof createRuntime>, base: string;
  const origin = "http://localhost:3000";
  const sockets: Socket<ServerToClientEvents, ClientToServerEvents>[] = [];
  beforeEach(async () => {
    runtime = createRuntime(parseEnvironment({ NODE_ENV: "test", WEB_ORIGIN: origin }));
    runtime.httpServer.listen(0, "127.0.0.1");
    await once(runtime.httpServer, "listening");
    base = `http://127.0.0.1:${(runtime.httpServer.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await runtime.close();
  });
  async function guest() {
    const response = await fetch(`${base}/api/v1/session`, {
      method: "POST",
      headers: { Origin: origin },
    });
    const rawCookie = response.headers.get("set-cookie")!;
    expect(rawCookie).toContain("HttpOnly");
    expect(rawCookie).toContain("SameSite=Strict");
    const body = (await response.json()) as Result<{ csrfToken: string }>;
    if (!body.ok) throw Error(body.error.message);
    return {
      Cookie: rawCookie.split(";")[0]!,
      "X-CSRF-Token": body.data.csrfToken,
      Origin: origin,
      "Content-Type": "application/json",
    };
  }
  async function enter(headers: Awaited<ReturnType<typeof guest>>, id?: string) {
    const response = await fetch(`${base}/api/v1/rooms${id ? `/${id}/join` : ""}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ displayName: id ? "Guest" : "Host", requestId: randomUUID() }),
    });
    return (await response.json()) as Result<Membership>;
  }
  async function connect(
    headers: Awaited<ReturnType<typeof guest>>,
    roomId: string,
    transport: "polling" | "websocket" = "websocket",
  ) {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(base, {
      transports: [transport],
      extraHeaders: headers,
      auth: { roomId, csrfToken: headers["X-CSRF-Token"] },
      autoConnect: false,
      reconnection: false,
    });
    sockets.push(socket);
    const ready = new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });
    socket.connect();
    await ready;
    return socket;
  }
  it("protects origin, CSRF, body validation and membership privacy", async () => {
    const headers = await guest();
    const invalid = await fetch(`${base}/api/v1/rooms`, {
      method: "POST",
      headers: { ...headers, "X-CSRF-Token": "bad" },
      body: "{}",
    });
    expect(invalid.status).toBe(403);
    const forged = await fetch(`${base}/api/v1/rooms`, {
      method: "POST",
      headers,
      body: JSON.stringify({ displayName: "Host", requestId: randomUUID(), role: "host" }),
    });
    expect(forged.status).toBe(400);
    const created = await enter(headers);
    if (!created.ok) throw Error("create failed");
    const stranger = await guest();
    expect(
      (await fetch(`${base}/api/v1/rooms/${created.data.room.id}`, { headers: stranger })).status,
    ).toBe(403);
    await expect(connect(stranger, created.data.room.id)).rejects.toThrow("NOT_A_MEMBER");
    expect(JSON.stringify(created.data)).not.toContain(headers["X-CSRF-Token"]);
  });
  it.each(["polling", "websocket"] as const)(
    "creates, joins, reconnects and closes using %s",
    async (transport) => {
      const hostHeaders = await guest(),
        guestHeaders = await guest();
      const created = await enter(hostHeaders);
      if (!created.ok) throw Error("create failed");
      const id = created.data.room.id;
      const host = await connect(hostHeaders, id, transport);
      const joined = await enter(guestHeaders, id);
      if (!joined.ok) throw Error("join failed");
      const participant = await connect(guestHeaders, id, transport);
      let state = await host.timeout(2000).emitWithAck("room:state");
      if (!state.ok) throw Error("state failed");
      expect(state.data.room.participants).toHaveLength(2);
      const denied = await participant.timeout(2000).emitWithAck("room:close", {
        requestId: randomUUID(),
        expectedRevision: state.data.room.revision,
      });
      expect(denied.ok).toBe(false);
      const oldParticipant = joined.data.participantId;
      const replacement = await connect(guestHeaders, id, transport);
      const restored = await replacement.timeout(2000).emitWithAck("room:state");
      expect(restored.ok && restored.data.participantId).toBe(oldParticipant);
      state = await host.timeout(2000).emitWithAck("room:state");
      if (!state.ok) throw Error("state failed");
      const closure = new Promise<string>((resolve) => replacement.once("room:closed", resolve));
      const closed = await host.timeout(2000).emitWithAck("room:close", {
        requestId: randomUUID(),
        expectedRevision: state.data.room.revision,
      });
      expect(closed.ok).toBe(true);
      expect(await closure).toContain("Host closed");
      expect((await fetch(`${base}/api/v1/rooms/${id}`, { headers: hostHeaders })).status).toBe(
        404,
      );
    },
  );
  it("enforces capacity on concurrent HTTP requests", async () => {
    const created = await enter(await guest());
    if (!created.ok) throw Error("create failed");
    const people = await Promise.all(Array.from({ length: 24 }, guest));
    const results = await Promise.all(
      people.map((headers) => enter(headers, created.data.room.id)),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(19);
    expect(
      results.filter((result) => !result.ok && result.error.code === "ROOM_FULL"),
    ).toHaveLength(5);
  });
});
