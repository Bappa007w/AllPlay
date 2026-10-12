import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Redis } from "ioredis";
import { io, type Socket } from "socket.io-client";
import { expect, it } from "vitest";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Membership,
  Result,
} from "@allplay/shared";
import { createRuntime } from "../../backend/src/server.js";
import { parseEnvironment } from "../../backend/src/config/environment.js";

// Opt-in real-provider test. Never use production state; only this exact random key is deleted.
it.skipIf(!process.env.ALLPLAY_TEST_REDIS_URL)(
  "shares real Redis state and Socket.IO broadcasts between instances",
  async () => {
    const url = process.env.ALLPLAY_TEST_REDIS_URL!;
    const prefix = `allplay:test:${randomUUID()}`;
    const origin = "http://localhost:3000";
    const config = parseEnvironment({
      NODE_ENV: "test",
      WEB_ORIGIN: origin,
      ROOM_STORE: "redis",
      REDIS_URL: url,
      REDIS_KEY_PREFIX: prefix,
    });
    const first = createRuntime(config),
      second = createRuntime(config);
    const sockets: Socket<ServerToClientEvents, ClientToServerEvents>[] = [];
    const address = (runtime: ReturnType<typeof createRuntime>) =>
      `http://127.0.0.1:${(runtime.httpServer.address() as AddressInfo).port}`;
    async function bootstrap(base: string) {
      const response = await fetch(`${base}/api/v1/session`, {
        method: "POST",
        headers: { Origin: origin },
      });
      const result = (await response.json()) as Result<{ csrfToken: string }>;
      if (!result.ok) throw Error(result.error.code);
      return {
        Cookie: response.headers.get("set-cookie")!.split(";")[0]!,
        Origin: origin,
        "X-CSRF-Token": result.data.csrfToken,
        "Content-Type": "application/json",
      };
    }
    async function enter(
      base: string,
      headers: Awaited<ReturnType<typeof bootstrap>>,
      roomId?: string,
    ) {
      const response = await fetch(`${base}/api/v1/rooms${roomId ? `/${roomId}/join` : ""}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ displayName: roomId ? "Guest" : "Host", requestId: randomUUID() }),
      });
      const result = (await response.json()) as Result<Membership>;
      if (!result.ok) throw Error(result.error.code);
      return result.data;
    }
    async function connect(
      base: string,
      headers: Awaited<ReturnType<typeof bootstrap>>,
      roomId: string,
    ) {
      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(base, {
        transports: ["websocket"],
        extraHeaders: headers,
        auth: { roomId, csrfToken: headers["X-CSRF-Token"] },
        autoConnect: false,
        reconnection: false,
      });
      sockets.push(socket);
      const connected = new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", reject);
      });
      socket.connect();
      await connected;
      return socket;
    }
    try {
      await Promise.all([first.ready, second.ready]);
      first.httpServer.listen(0, "127.0.0.1");
      second.httpServer.listen(0, "127.0.0.1");
      await Promise.all([
        once(first.httpServer, "listening"),
        once(second.httpServer, "listening"),
      ]);
      const hostHeaders = await bootstrap(address(first));
      const created = await enter(address(first), hostHeaders);
      const recovered = await fetch(`${address(second)}/api/v1/rooms/${created.room.id}`, {
        headers: hostHeaders,
      });
      expect(((await recovered.json()) as { data: Membership }).data.participantId).toBe(
        created.participantId,
      );
      const host = await connect(address(first), hostHeaders, created.room.id);
      const guestHeaders = await bootstrap(address(second));
      const update = new Promise<void>((resolve) =>
        host.on("room:state", (state) => {
          if (state.participants.length === 2) resolve();
        }),
      );
      await enter(address(second), guestHeaders, created.room.id);
      const guest = await connect(address(second), guestHeaders, created.room.id);
      await update;
      const state = await host.timeout(5000).emitWithAck("room:state");
      if (!state.ok) throw Error(state.error.code);
      const closed = new Promise<string>((resolve) => guest.once("room:closed", resolve));
      expect(
        (
          await host.timeout(5000).emitWithAck("room:close", {
            requestId: randomUUID(),
            expectedRevision: state.data.room.revision,
          })
        ).ok,
      ).toBe(true);
      expect(await closed).toContain("Host closed");
    } finally {
      for (const socket of sockets) socket.disconnect();
      await Promise.all([first.close(), second.close()]);
      const cleanup = new Redis(url, {
        connectTimeout: 5000,
        commandTimeout: 5000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      cleanup.on("error", () => {});
      try {
        await cleanup.del(`${prefix}:state:v1`);
      } finally {
        cleanup.disconnect();
      }
    }
  },
  30_000,
);
