import fs from "node:fs";
import { spawn } from "node:child_process";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

import { ensureLocalDatabaseUrl, realDataEnv } from "./_shared.mjs";

const env = realDataEnv();

if (env.I_UNDERSTAND_LOCAL_RESTORE !== "1") {
  console.error("Refusing restore without I_UNDERSTAND_LOCAL_RESTORE=1.");
  process.exit(1);
}

const snapshotFile = env.SNAPSHOT_FILE;
if (!snapshotFile || !fs.existsSync(snapshotFile)) {
  console.error("Set SNAPSHOT_FILE to an existing .sql or .sql.gz file.");
  process.exit(1);
}

const databaseUrl = env.LOCAL_DATABASE_URL || env.DATABASE_URL;
ensureLocalDatabaseUrl(databaseUrl, { allowRemote: env.ALLOW_REMOTE_DATABASE === "1" });

function runPsql(args, inputStream) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [databaseUrl, ...args], {
      stdio: inputStream ? ["pipe", "inherit", "inherit"] : "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql exited with code ${code}`));
    });

    if (inputStream) {
      pipeline(inputStream, child.stdin).catch(reject);
    }
  });
}

if (env.RESET_SCHEMA === "1") {
  console.log("Resetting local public schema...");
  await runPsql(["--set", "ON_ERROR_STOP=on", "-c", "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"]);
}

console.log(`Restoring ${snapshotFile} into local database...`);
const source = fs.createReadStream(snapshotFile);
const input = snapshotFile.endsWith(".gz") ? source.pipe(createGunzip()) : source;
await runPsql(["--set", "ON_ERROR_STOP=on"], input);

console.log("Restore finished.");
