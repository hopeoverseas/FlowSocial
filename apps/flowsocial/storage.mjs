import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataRoot = process.env.FLOWSOCIAL_DATA_DIR ? resolve(process.env.FLOWSOCIAL_DATA_DIR) : join(root, "data");
mkdirSync(dataRoot, { recursive: true });
const databasePath = join(dataRoot, "flowsocial.db");
const seedPath = [join(dataRoot, "store.json"), join(root, "data", "store.json"), join(root, "defaults", "store.json")]
  .find((candidate) => existsSync(candidate)) || join(root, "defaults", "store.json");
const seedBackupPath = join(dataRoot, "flowsocial-seed-backup.json");
export const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const selectState = database.prepare("SELECT payload, revision, updated_at FROM app_state WHERE id = 1");
const insertState = database.prepare("INSERT INTO app_state (id, payload, revision, updated_at) VALUES (1, ?, 1, ?)");
const updateState = database.prepare("UPDATE app_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = 1");
const insertError = database.prepare("INSERT INTO api_errors (request_id, method, path, message, created_at) VALUES (?, ?, ?, ?, ?)");
const recentErrors = database.prepare("SELECT request_id AS requestId, method, path, message, created_at AS createdAt FROM api_errors ORDER BY id DESC LIMIT ?");

function initializeState() {
  if (selectState.get()) return;
  if (!existsSync(seedPath)) throw new Error(`Missing initial data file: ${seedPath}`);
  const payload = readFileSync(seedPath, "utf8");
  JSON.parse(payload);
  if (!existsSync(seedBackupPath)) copyFileSync(seedPath, seedBackupPath);
  insertState.run(payload, new Date().toISOString());
}

initializeState();

export function readStore() {
  const row = selectState.get();
  if (!row) throw new Error("Application state is not initialized");
  return JSON.parse(row.payload);
}

export function writeStore(store) {
  const payload = JSON.stringify(store);
  JSON.parse(payload);
  updateState.run(payload, new Date().toISOString());
}

export function recordApiError({ requestId, method, path, message }) {
  insertError.run(requestId, method, path, message, new Date().toISOString());
}

export function getRecentApiErrors(limit = 20) {
  return recentErrors.all(Math.min(Math.max(Number(limit) || 20, 1), 100));
}

export function getStorageStatus() {
  const row = selectState.get();
  return {
    engine: "sqlite",
    databasePath,
    revision: row?.revision || 0,
    updatedAt: row?.updated_at || null
  };
}
