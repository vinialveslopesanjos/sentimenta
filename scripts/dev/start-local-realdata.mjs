import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { ensureLocalDatabaseUrl, realDataEnv, repoRoot } from "./_shared.mjs";

const envFile = path.join(repoRoot, ".env.realdata.local");
if (!fs.existsSync(envFile)) {
  console.error("Missing .env.realdata.local. Copy .env.realdata.local.example first.");
  process.exit(1);
}

const loaded = realDataEnv();
ensureLocalDatabaseUrl(loaded.DATABASE_URL, {
  allowRemote: loaded.ALLOW_REMOTE_DATABASE === "1",
});

const pythonCandidates = [
  path.join(repoRoot, ".venv", "Scripts", "python.exe"),
  path.join(repoRoot, ".venv", "bin", "python"),
  "python",
];

const python = pythonCandidates.find((candidate) => candidate === "python" || fs.existsSync(candidate));
const backendDir = path.join(repoRoot, "backend");
const port = loaded.API_PORT || "8000";

const childEnv = {
  ...process.env,
  ...loaded,
  READ_ONLY_MODE: "true",
  DEBUG: loaded.DEBUG || "true",
  SESSION_COOKIE_SECURE: loaded.SESSION_COOKIE_SECURE || "false",
  APP_URL: loaded.APP_URL || "http://127.0.0.1:3000",
  FRONTEND_URL: loaded.FRONTEND_URL || "http://127.0.0.1:3000",
  CACHE_REDIS_URL: loaded.CACHE_REDIS_URL || "",
  RATE_LIMIT_REDIS_URL: loaded.RATE_LIMIT_REDIS_URL || "",
};

console.log(`Starting local read-only API on http://127.0.0.1:${port}`);
console.log("Frontend still runs separately with: npm run dev:web");

const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", port],
  {
    cwd: backendDir,
    env: childEnv,
    stdio: "inherit",
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
