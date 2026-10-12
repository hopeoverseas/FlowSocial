import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const temporaryRoot = await mkdtemp(join(tmpdir(), "flowsocial-public-seed-"));
async function fixture(name, { runtimeSeed, legacySeed } = {}) {
  const root = join(temporaryRoot, name);
  const runtime = join(root, "runtime");
  await mkdir(join(root, "defaults"), { recursive: true });
  await mkdir(runtime);
  await copyFile(new URL("../../storage.mjs", import.meta.url), join(root, "storage.mjs"));
  await copyFile(new URL("../../defaults/store.json", import.meta.url), join(root, "defaults/store.json"));
  if (runtimeSeed) await writeFile(join(runtime, "store.json"), JSON.stringify(runtimeSeed));
  if (legacySeed) {
    await mkdir(join(root, "data"));
    await writeFile(join(root, "data/store.json"), JSON.stringify(legacySeed));
  }
  process.env.FLOWSOCIAL_DATA_DIR = runtime;
  const storage = await import(pathToFileURL(join(root, "storage.mjs")).href);
  return { root, runtime, storage };
}

try {
  const clean = await fixture("clean");
  try {
    const store = clean.storage.readStore();
    assert.deepEqual(store.accounts, [], "public bootstrap must contain no business accounts");
    assert.deepEqual(store.contentTasks, [], "public bootstrap must contain no historical content");
    assert.deepEqual(store.activityLogs, []);
    assert.equal(clean.storage.getStorageStatus().revision, 1);
    assert.equal(clean.storage.getStorageStatus().databasePath, join(clean.runtime, "flowsocial.db"));
  } finally { clean.storage.database.close(); }

  const customSeed = { accounts: [], contentTasks: [], marker: "synthetic-runtime-priority" };
  const legacySeed = { accounts: [], contentTasks: [], marker: "synthetic-legacy-priority" };
  const custom = await fixture("runtime-priority", { runtimeSeed: customSeed, legacySeed });
  try { assert.deepEqual(custom.storage.readStore(), customSeed); }
  finally { custom.storage.database.close(); }

  const legacy = await fixture("legacy-compatibility", { legacySeed });
  try { assert.deepEqual(legacy.storage.readStore(), legacySeed); }
  finally { legacy.storage.database.close(); }

  const preserved = await fixture("existing-state");
  const state = { accounts: [], contentTasks: [], marker: "synthetic-existing-state" };
  preserved.storage.writeStore(state);
  preserved.storage.database.close();
  await writeFile(join(preserved.runtime, "store.json"), JSON.stringify(customSeed));
  const reopened = await import(`${pathToFileURL(join(preserved.root, "storage.mjs")).href}?reopen`);
  try {
    assert.deepEqual(reopened.readStore(), state, "an existing SQLite state must not be reseeded");
    assert.equal(reopened.getStorageStatus().revision, 2);
  } finally { reopened.database.close(); }

  console.log("public-seed-bootstrap-self-test: ok (empty public seed; runtime and legacy priority; existing SQLite preserved)");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
