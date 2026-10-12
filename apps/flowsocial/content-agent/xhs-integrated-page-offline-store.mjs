import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { validateRevisionNormalizationBinding } from "../image-providers/xhs-integrated-page/vertical-contracts.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const clone = (value) => structuredClone(value);
const STORE_FILE = "offline-visual-store.json";
const MARKER_FILE = ".flowsocial-xhs-integrated-page-offline";
const transactionQueues = new Map();

async function exclusive(key, operation) {
  const previous = transactionQueues.get(key) || Promise.resolve(); let release;
  const current = new Promise((resolveQueue) => { release = resolveQueue; }); transactionQueues.set(key, current);
  await previous;
  try { return await operation(); } finally { release(); if (transactionQueues.get(key) === current) transactionQueues.delete(key); }
}

function assertOfflineRoot(root) {
  const value = resolve(root); const temp = realpathSync(resolve(tmpdir())); let existing = value; while (!existsSync(existing)) { const parent = dirname(existing); if (parent === existing) break; existing = parent; } const realExisting = realpathSync(existing);
  if (value === temp || !value.startsWith(`${temp}${sep}`)) throw new Error("OFFLINE_STORE_ROOT_MUST_BE_ISOLATED_TEMP");
  if (realExisting !== temp && !realExisting.startsWith(`${temp}${sep}`)) throw new Error("OFFLINE_STORE_ROOT_REALPATH_ESCAPE");
  return value;
}
function safeResolve(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || resolve(relativePath) === relativePath) throw new Error("OFFLINE_STORE_RELATIVE_PATH_REQUIRED");
  const target = resolve(root, relativePath); if (!target.startsWith(`${root}${sep}`)) throw new Error("OFFLINE_STORE_PATH_ESCAPE");
  const rootInfo = lstatSync(root); if (rootInfo.isSymbolicLink()) throw new Error("OFFLINE_STORE_ROOT_SYMLINK_FORBIDDEN"); const rootReal = realpathSync(root); const tempReal = realpathSync(resolve(tmpdir())); if (!rootReal.startsWith(`${tempReal}${sep}`)) throw new Error("OFFLINE_STORE_ROOT_REALPATH_ESCAPE"); const parts = relative(root, target).split(/[\\/]+/); let cursor = root;
  for (const part of parts) { cursor = resolve(cursor, part); if (!existsSync(cursor)) break; const info = lstatSync(cursor); if (info.isSymbolicLink()) throw new Error("OFFLINE_STORE_SYMLINK_ESCAPE"); const real = realpathSync(cursor); if (real !== rootReal && !real.startsWith(`${rootReal}${sep}`)) throw new Error("OFFLINE_STORE_REALPATH_ESCAPE"); }
  return target;
}
async function exists(path) { try { return (await stat(path)).isFile(); } catch { return false; } }
async function atomicJson(path, value) { await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(temporary, path); }
async function scanFiles(root, current = root, output = []) { for (const item of await readdir(current, { withFileTypes: true })) { const path = resolve(current, item.name); const rel = relative(root, path).replaceAll("\\", "/"); if (item.isSymbolicLink()) { output.push({ relativePath: rel, symlink: true }); continue; } if (item.isDirectory()) await scanFiles(root, path, output); else output.push({ relativePath: rel, symlink: false }); } return output; }

export class OfflineIntegratedPageStore {
  constructor({ root, flags }) { this.root = assertOfflineRoot(root); this.flags = clone(flags || {}); this.storePath = resolve(this.root, STORE_FILE); this.markerPath = resolve(this.root, MARKER_FILE); }
  async initialize() {
    if (!(await exists(this.storePath)) && this.flags.xhsIntegratedPageVersioning !== true) throw new Error("XHS_INTEGRATED_PAGE_VERSIONING_FLAG_DISABLED");
    await mkdir(this.root, { recursive: true });
    assertOfflineRoot(this.root); const realRoot = realpathSync(this.root); const realTemp = realpathSync(resolve(tmpdir())); if (!realRoot.startsWith(`${realTemp}${sep}`)) throw new Error("OFFLINE_STORE_ROOT_REALPATH_ESCAPE");
    if (!(await exists(this.markerPath))) await writeFile(this.markerPath, "FS-V1-XHS-VISUAL-05F\n", "utf8");
    if (!(await exists(this.storePath))) await atomicJson(this.storePath, { schemaVersion: "1.0", kind: "XhsIntegratedPageOfflineStore", version: 0, objects: {}, events: [], assets: {}, counters: { networkCalls: 0, providerCalls: 0, costCredits: 0, activeDatabaseWrites: 0, approvedPromotions: 0 } });
    return this.readState();
  }
  async readState() { const state = JSON.parse(await readFile(safeResolve(this.root, STORE_FILE), "utf8")); if (state.kind !== "XhsIntegratedPageOfflineStore") throw new Error("OFFLINE_STORE_MARKER_INVALID"); return state; }
  assertWriteEnabled() { if (this.flags.xhsIntegratedPageVersioning !== true) throw new Error("XHS_INTEGRATED_PAGE_VERSIONING_FLAG_DISABLED"); }
  async transact(expectedVersion, mutate) {
    this.assertWriteEnabled(); return exclusive(this.storePath, async () => {
      const state = await this.readState(); if (state.version !== expectedVersion) throw Object.assign(new Error(`OFFLINE_STORE_VERSION_CONFLICT:${expectedVersion}:${state.version}`), { code: "OFFLINE_STORE_VERSION_CONFLICT", currentVersion: state.version });
      const next = clone(state); const result = await mutate(next); next.version += 1; await atomicJson(safeResolve(this.root, STORE_FILE), next); return { result, version: next.version };
    });
  }
  async putObject(type, object, { expectedVersion, hashField }) {
    return this.transact(expectedVersion, async (state) => {
      state.objects[type] ||= {}; const existing = state.objects[type][object.id];
      if (existing) { if (existing[hashField] === object[hashField] && stableHash(existing) === stableHash(object)) return clone(existing); throw new Error(`IMMUTABLE_OBJECT_CONFLICT:${type}:${object.id}`); }
      state.objects[type][object.id] = clone(object); return clone(object);
    });
  }
  async getObject(type, id) { const state = await this.readState(); return clone(state.objects[type]?.[id] || null); }
  async listObjects(type) { const state = await this.readState(); return Object.values(state.objects[type] || {}).map(clone); }
  async writeAsset(relativePath, bytes, expectedSha256) {
    this.assertWriteEnabled(); const target = safeResolve(this.root, relativePath); const actual = sha256(bytes); if (actual !== expectedSha256) throw new Error("OFFLINE_ASSET_HASH_MISMATCH"); await mkdir(dirname(target), { recursive: true });
    if (await exists(target)) { const existing = await readFile(target); if (sha256(existing) !== expectedSha256) throw new Error("IMMUTABLE_ASSET_CONFLICT"); return { relativePath, sha256: actual, bytes: bytes.length }; }
    await writeFile(target, bytes); const verified = await readFile(target); if (sha256(verified) !== expectedSha256) throw new Error("OFFLINE_ASSET_WRITE_VERIFICATION_FAILED"); return { relativePath, sha256: actual, bytes: bytes.length };
  }
  async registerAsset(relativePath, expectedSha256, { expectedVersion }) {
    return this.transact(expectedVersion, async (state) => { safeResolve(this.root, relativePath); const bytes = await readFile(safeResolve(this.root, relativePath)); if (sha256(bytes) !== expectedSha256) throw new Error("OFFLINE_ASSET_HASH_MISMATCH"); const existing = state.assets[relativePath]; if (existing && existing.sha256 !== expectedSha256) throw new Error("IMMUTABLE_ASSET_CONFLICT"); state.assets[relativePath] = { relativePath, sha256: expectedSha256, bytes: bytes.length }; return clone(state.assets[relativePath]); });
  }
  async appendEvent(event, { expectedVersion }) {
    this.assertWriteEnabled(); const state = await this.readState(); const existing = state.events.find((item) => item.idempotencyKey === event.idempotencyKey);
    if (existing) { if (stableHash(existing.payload) !== stableHash(event.payload) || existing.type !== event.type || existing.aggregateRef.id !== event.aggregateRef.id) throw new Error("IDEMPOTENCY_KEY_CONFLICT"); return { result: clone(existing), version: state.version, idempotent: true }; }
    return this.transact(expectedVersion, async (next) => { const latest = next.events.at(-1); if (event.sequence !== next.events.length + 1 || event.previousEventHash !== (latest?.eventHash || null)) throw new Error("EVENT_CHAIN_CONFLICT"); next.events.push(clone(event)); return clone(event); });
  }
  async listEvents() { const state = await this.readState(); return state.events.map(clone); }
  async verifyAsset(relativePath, expectedSha256) { const bytes = await readFile(safeResolve(this.root, relativePath)); if (sha256(bytes) !== expectedSha256) throw new Error("OFFLINE_ASSET_HASH_MISMATCH"); return { relativePath, sha256: expectedSha256, bytes: bytes.length }; }
  async auditIntegrity() {
    const state = await this.readState(); const blockers = []; const revisions = Object.values(state.objects.revisions || {}); const normalizations = Object.values(state.objects.normalizations || {}); const normalizationById = new Map(normalizations.map((item) => [item.id, item])); const referenced = new Set([...revisions.map((item) => item.asset.relativePath), ...normalizations.flatMap((item) => [item.inputAsset.relativePath, item.outputAsset?.relativePath].filter(Boolean))]);
    for (const item of Object.values(state.assets)) { try { await this.verifyAsset(item.relativePath, item.sha256); } catch { blockers.push({ code: "ASSET_HASH_MISMATCH", path: item.relativePath }); } if (!referenced.has(item.relativePath)) blockers.push({ code: "ORPHAN_ASSET", path: item.relativePath }); }
    for (const revision of revisions) { if (!state.assets[revision.asset.relativePath]) blockers.push({ code: "REVISION_ASSET_MISSING", path: revision.asset.relativePath }); try { validateRevisionNormalizationBinding(revision, normalizationById.get(revision.normalizationRef.id)); } catch { blockers.push({ code: "REVISION_NORMALIZATION_ASSET_MISMATCH", path: revision.asset.relativePath }); } }
    const ignored = new Set([STORE_FILE, MARKER_FILE]); for (const file of await scanFiles(this.root)) { const reviewHtml = file.relativePath.startsWith("review/") && file.relativePath.endsWith(".html"); if (file.symlink) blockers.push({ code: "SYMLINK_OR_JUNCTION_FORBIDDEN", path: file.relativePath }); else if (!ignored.has(file.relativePath) && !reviewHtml && !state.assets[file.relativePath]) blockers.push({ code: "UNREGISTERED_ASSET_FILE", path: file.relativePath }); }
    return { status: blockers.length ? "blocked" : "passed", blockers, counters: clone(state.counters), storeVersion: state.version };
  }
  resolveForRead(relativePath) { return safeResolve(this.root, relativePath); }
}

export { safeResolve as resolveOfflineStorePath, sha256 as offlineAssetSha256 };
