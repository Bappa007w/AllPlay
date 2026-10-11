import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const rawApiUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
let apiUrl: URL;
try {
  apiUrl = new URL(rawApiUrl);
  if (!["http:", "https:"].includes(apiUrl.protocol) || apiUrl.origin !== rawApiUrl) {
    throw new Error("Invalid origin");
  }
} catch {
  throw new Error("Invalid web environment: API_INTERNAL_URL must be an HTTP(S) origin");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Engine.IO uses /socket.io/; a redirect can break polling POSTs and WebSocket upgrades.
  skipTrailingSlashRedirect: true,
  transpilePackages: ["@allplay/shared"],
  turbopack: { root: fileURLToPath(new URL("../../", import.meta.url)) },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl.origin}/api/:path*` },
      { source: "/socket.io", destination: `${apiUrl.origin}/socket.io/` },
    ];
  },
};

export default nextConfig;
