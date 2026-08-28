import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function realDataEnv() {
  return {
    ...loadEnvFile(path.join(repoRoot, ".env.realdata.local")),
    ...process.env,
  };
}

export function ensureLocalDatabaseUrl(databaseUrl, { allowRemote = false } = {}) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const parsed = new URL(databaseUrl);
  const hostname = parsed.hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!allowRemote && !localHosts.has(hostname)) {
    throw new Error(
      `Refusing non-local DATABASE_URL host "${hostname}". ` +
        "Use a local restored snapshot, or set ALLOW_REMOTE_DATABASE=1 only for a true read-only replica.",
    );
  }

  return parsed;
}

export function snapshotDir() {
  return process.env.SNAPSHOT_DIR || path.join(repoRoot, ".local", "snapshots");
}
