import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { database } from "../../storage.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const backupDir = join(root, "data", "backups");
const name = process.argv[2] || `flowsocial-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
await mkdir(backupDir, { recursive: true });
const target = join(backupDir, name).replace(/\\/g, "/").replace(/'/g, "''");
database.exec(`VACUUM INTO '${target}'`);
console.log(join(backupDir, name));

