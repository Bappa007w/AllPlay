import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { healthResponseSchema } from "@allplay/shared";
import { io as connect } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEnvironment } from "../../apps/server/src/config/environment.js";
import { createRuntime } from "../../apps/server/src/server.js";

describe("HTTP and Socket.IO foundation", () => {
  let runtime: ReturnType<typeof createRuntime>;
  let baseUrl: string;
  const webOrigin = "http://localhost:3000";

  beforeEach(async () => {
    runtime = createRuntime(parseEnvironment({ NODE_ENV: "test", WEB_ORIGIN: webOrigin }));
    runtime.httpServer.listen(0, "127.0.0.1");
    await once(runtime.httpServer, "listening");
    baseUrl = `http://127.0.0.1:${(runtime.httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await runtime.close();
  });

  it("serves typed liveness without advertising unimplemented dependencies", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json()).service).toBe("allplay-server");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.has("x-powered-by")).toBe(false);
  });

  it("does not expose room creation before its approved phase", async () => {
    const response = await fetch(`${baseUrl}/api/v1/rooms`, { method: "POST" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  it("allows the configured origin's transport handshake", async () => {
    const response = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: webOrigin },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(webOrigin);
    expect(await response.text()).toMatch(/^0\{/);
  });

  it.each(["https://untrusted.example", "null", ""])(
    "rejects a transport handshake with unapproved origin %s",
    async (origin) => {
      const response = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
        headers: origin ? { Origin: origin } : {},
      });
      expect(response.status).toBe(403);
    },
  );

  it("fails closed for application connections until guest sessions exist", async () => {
    const socket = connect(baseUrl, {
      transports: ["websocket"],
      extraHeaders: { Origin: webOrigin },
      reconnection: false,
      autoConnect: false,
      timeout: 2000,
    });
    try {
      const rejected = new Promise<Error>((resolve) => socket.once("connect_error", resolve));
      socket.connect();
      const error = await rejected;
      expect(error.message).toBe("ROOM_SESSIONS_NOT_AVAILABLE");
      expect(socket.connected).toBe(false);
    } finally {
      socket.disconnect();
    }
  });

  it("shuts down cleanly and permits repeated shutdown requests", async () => {
    await Promise.all([runtime.close(), runtime.close()]);
    expect(runtime.httpServer.listening).toBe(false);
  });
});
