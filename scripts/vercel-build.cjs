// Vercel framework builders may start in either the repo or service directory.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const mode = process.argv[1];
const commands = {
  install: [["ci", "--include=dev"]],
  frontend: [
    ["run", "build:packages"],
    ["run", "build", "--workspace=@allplay/web"],
  ],
  backend: [
    ["run", "build:packages"],
    ["run", "build:vercel", "--workspace=@allplay/server"],
  ],
};
if (!Object.hasOwn(commands, mode)) throw new Error("Unknown Vercel build action");
for (const args of commands[mode]) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
