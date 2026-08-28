import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { repoRoot, snapshotDir } from "./_shared.mjs";

if (process.env.I_UNDERSTAND_PROD_SNAPSHOT !== "1") {
  console.error("Refusing to copy a production snapshot without I_UNDERSTAND_PROD_SNAPSHOT=1.");
  process.exit(1);
}

const remoteSnapshot = process.env.SENTIMENTA_REMOTE_SNAPSHOT;
if (!remoteSnapshot) {
  console.error("Set SENTIMENTA_REMOTE_SNAPSHOT, for example user@host:/opt/sentimenta/backups/file.sql.gz.");
  process.exit(1);
}

const outDir = snapshotDir();
fs.mkdirSync(outDir, { recursive: true });

const fileName = path.basename(remoteSnapshot.split(":").pop() || "sentimenta_snapshot.sql.gz");
const destination = path.join(outDir, fileName);

console.log(`Copying snapshot to ${path.relative(repoRoot, destination)}...`);
const result = spawnSync("scp", [remoteSnapshot, destination], { stdio: "inherit" });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Snapshot copied: ${destination}`);
