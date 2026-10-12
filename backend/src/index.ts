import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { parseEnvironment } from "./config/environment.js";
import { createRuntime } from "./server.js";

loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

try {
  const config = parseEnvironment(process.env);
  const runtime = createRuntime(config);
  runtime.httpServer.on("error", (error: NodeJS.ErrnoException) => {
    console.error(JSON.stringify({ level: "error", event: "server_error", code: error.code }));
    process.exitCode = 1;
    void runtime.close();
  });
  runtime.httpServer.listen(config.SERVER_PORT, config.SERVER_HOST, () => {
    console.info(
      JSON.stringify({
        level: "info",
        event: "server_listening",
        host: config.SERVER_HOST,
        port: config.SERVER_PORT,
      }),
    );
    process.send?.("ready");
  });

  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => {
      console.error(JSON.stringify({ level: "error", event: "shutdown_timeout" }));
      process.exit(1);
    }, 5_000);
    timeout.unref();
    await runtime.close();
    clearTimeout(timeout);
    console.info(JSON.stringify({ level: "info", event: "server_stopped" }));
    process.disconnect?.();
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  // IPC permits repeatable graceful shutdown verification on Windows as well as Unix.
  process.on("message", (message: unknown) => {
    if (message === "shutdown") void shutdown();
  });
} catch (error) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "startup_failed",
      message: error instanceof Error ? error.message : "Unknown startup error",
    }),
  );
  process.exitCode = 1;
}
