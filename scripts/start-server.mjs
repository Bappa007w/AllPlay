// Keep npm start production-only without shell-specific environment assignment.
process.env.NODE_ENV = "production";
await import("../apps/server/dist/index.js");
