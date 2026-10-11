import { createServer } from "node:http";
import { createApp } from "./app.js";
import type { ServerEnvironment } from "./config/environment.js";
import { createSocketServer } from "./realtime/create-socket-server.js";

export function createRuntime(config: ServerEnvironment) {
  const httpServer = createServer(createApp());
  const io = createSocketServer(httpServer, config.WEB_ORIGIN);
  let closing: Promise<void> | undefined;

  function close(): Promise<void> {
    closing ??= new Promise<void>((resolve) => {
      io.close(() => resolve());
      httpServer.closeIdleConnections();
    });
    return closing;
  }

  return { httpServer, io, close };
}
