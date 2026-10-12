import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dataRoot = process.env.FLOWSOCIAL_DATA_DIR ? resolve(process.env.FLOWSOCIAL_DATA_DIR) : join(root, "data");
const databasePath = join(dataRoot, "flowsocial.db");
if (!existsSync(databasePath)) {
  console.error(`Phase 7 audit blocked: database not found at ${databasePath}`);
  process.exit(2);
}

const database = new DatabaseSync(databasePath, { readOnly: true });
const row = database.prepare("SELECT payload, revision FROM app_state WHERE id = 1").get();
database.close();
if (!row) {
  console.error("Phase 7 audit blocked: app_state row is missing");
  process.exit(2);
}

const store = JSON.parse(row.payload);
const collections = Object.fromEntries(["contentRuns", "contentWorkflows", "contentTasks", "contentPublications"].map((name) => [name, Array.isArray(store[name]) ? store[name].length : 0]));
const blockers = Object.entries(collections).filter(([, count]) => count > 0);
console.log(JSON.stringify({ kind: "Phase7ContentRunRemovalAudit", safeToRemoveCompatibility: blockers.length === 0, collections, storageRevision: row.revision }, null, 2));
if (blockers.length) {
  console.error("Phase 7 is blocked: export and reconcile legacy content records before removing compatibility routes.");
  process.exit(2);
}
