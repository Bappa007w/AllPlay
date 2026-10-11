import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../../apps/server/src/config/environment.js";

describe("server environment", () => {
  it("uses local-only development defaults", () => {
    expect(parseEnvironment({})).toEqual({
      NODE_ENV: "development",
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: 3001,
      WEB_ORIGIN: "http://localhost:3000",
    });
  });

  it.each(["0", "65536", "abc", "1.5", ""])("rejects invalid port %s", (port) => {
    expect(() => parseEnvironment({ SERVER_PORT: port })).toThrow("SERVER_PORT");
  });

  it.each([
    "*",
    "file:///tmp",
    "https://example.com/",
    "https://example.com/path",
    "https://user:password@example.com",
    "https://example.com?token=secret",
  ])("rejects a non-origin value without reflecting it: %s", (origin) => {
    expect(() => parseEnvironment({ WEB_ORIGIN: origin })).toThrow(
      "Invalid server environment: WEB_ORIGIN",
    );
    try {
      parseEnvironment({ WEB_ORIGIN: origin });
    } catch (error) {
      expect(String(error)).not.toContain(origin);
    }
  });

  it("requires HTTPS for production browser origin", () => {
    expect(() => parseEnvironment({ NODE_ENV: "production" })).toThrow("must use HTTPS");
    expect(
      parseEnvironment({ NODE_ENV: "production", WEB_ORIGIN: "https://allplay.example" }).NODE_ENV,
    ).toBe("production");
  });

  it("parses explicit configuration and ignores unrelated secrets", () => {
    const config = parseEnvironment({
      SERVER_PORT: "4321",
      SERVER_HOST: "0.0.0.0",
      WEB_ORIGIN: "https://allplay.example",
      UNRELATED_SECRET: "not-for-logs",
    });
    expect(config.SERVER_PORT).toBe(4321);
    expect(config).not.toHaveProperty("UNRELATED_SECRET");
  });
});
