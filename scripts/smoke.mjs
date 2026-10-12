import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { healthResponseSchema } from "@allplay/shared";
import { io as connect } from "socket.io-client";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];
assert(["dev", "production"].includes(mode), "Use dev or production");
const webOrigin = "http://127.0.0.1:3000";
const apiOrigin = "http://127.0.0.1:3001";
const allowedOrigin = mode === "production" ? "https://allplay.example" : webOrigin;
const children = [];

async function assertPortAvailable(port) {
  const probe = createServer();
  probe.listen(port, "127.0.0.1");
  await once(probe, "listening");
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
}

function launch(name, args, cwd, ipc = false) {
  const child = spawn(process.execPath, args, {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: mode === "production" ? "production" : "development",
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: "3001",
      WEB_ORIGIN: allowedOrigin,
      API_INTERNAL_URL: apiOrigin,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ipc ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output = (output + data).slice(-12000);
  });
  child.stderr.on("data", (data) => {
    output = (output + data).slice(-12000);
  });
  child.on("error", (error) => {
    output += error.message;
  });
  children.push({ name, child, output: () => output });
  return child;
}

async function waitFor(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const { name, child, output } of children) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`${name} exited before readiness:\n${output()}`);
      }
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return response;
      await response.body?.cancel();
    } catch {
      /* Startup may not have opened its listener yet. */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Readiness timeout: ${url}`);
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    await once(killer, "exit");
  } else {
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    try {
      await once(child, "exit");
    } finally {
      clearTimeout(timer);
    }
  }
}

try {
  await assertPortAvailable(3000);
  await assertPortAvailable(3001);
  const serverArgs =
    mode === "production"
      ? ["../../scripts/start-server.mjs"]
      : ["--import", "tsx", "src/index.ts"];
  const server = launch("server", serverArgs, `${root}/apps/server`, true);
  launch(
    "web",
    [
      require.resolve("next/dist/bin/next"),
      mode === "dev" ? "dev" : "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    `${root}/apps/web`,
  );

  const directHealth = await waitFor(`${apiOrigin}/api/v1/health`);
  healthResponseSchema.parse(await directHealth.json());
  console.info("PASS backend liveness");
  const page = await waitFor(webOrigin);
  const html = await page.text();
  assert(html.includes("One Beat. Every Device."));
  assert(html.includes("Room sessions are ready"));
  assert(html.includes("not available yet"));
  const cssPath = html.match(/href="([^" ]+\.css(?:\?[^" ]*)?)"/)?.[1];
  assert(cssPath, "Page must include compiled CSS");
  const css = await fetch(new URL(cssPath.replaceAll("&amp;", "&"), webOrigin));
  assert(css.ok, "Compiled stylesheet must load");
  assert((await css.text()).includes("--color-midnight"), "Tailwind theme must be compiled");
  console.info("PASS web shell and compiled stylesheet");
  const proxiedHealth = await waitFor(`${webOrigin}/api/v1/health`);
  healthResponseSchema.parse(await proxiedHealth.json());
  console.info("PASS same-origin API rewrite");
  {
    const socket = await fetch(`${webOrigin}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: allowedOrigin },
    });
    assert.equal(socket.status, 200);
    assert((await socket.text()).startsWith("0{"));
    console.info("PASS same-origin Socket.IO transport rewrite");
  }
  for (const transport of ["polling", "websocket"]) {
    const socket = connect(webOrigin, {
      transports: [transport],
      extraHeaders: { Origin: allowedOrigin },
      reconnection: false,
      autoConnect: false,
      timeout: 5000,
    });
    try {
      const rejected = new Promise((resolve) => socket.once("connect_error", resolve));
      socket.connect();
      const error = await rejected;
      assert.equal(error.message, "AUTH_REQUIRED");
      console.info(`PASS ${transport} proxy reaches fail-closed application boundary`);
    } finally {
      socket.disconnect();
    }
  }
  const exited = once(server, "exit");
  server.send("shutdown");
  const timeout = setTimeout(() => server.kill(), 8000);
  try {
    const [code] = await exited;
    assert.equal(code, 0, "Backend must exit gracefully");
  } finally {
    clearTimeout(timeout);
  }
  console.info("PASS backend graceful process shutdown");
  console.info(`PASS ${mode} smoke checks`);
} catch (error) {
  console.error(error);
  for (const { name, output } of children) console.error(`${name}:\n${output()}`);
  process.exitCode = 1;
} finally {
  for (const { child } of children.toReversed()) await stop(child);
}
