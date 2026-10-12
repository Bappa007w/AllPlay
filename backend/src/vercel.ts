import { parseEnvironment } from "./config/environment.js";
import { createRuntime } from "./server.js";

// Vercel owns the HTTP listener. Do not import the CLI entrypoint or call listen().
const config = parseEnvironment({ ...process.env, NODE_ENV: "production", VERCEL: "1" });
const runtime = createRuntime(config);
export default runtime.httpServer;
