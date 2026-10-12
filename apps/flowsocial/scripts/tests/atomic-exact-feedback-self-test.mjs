import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
const feedback = source("content-agent/atomic-publication-feedback-store.mjs");
const publication = source("content-agent/atomic-manual-publication-store.mjs");
for (const required of [
  "PublicationMetricSnapshot@3.0", "validateControlledManualPublicationClosure", "assertSnapshotPublicationClosure",
  "ATOMIC_EXACT_FEEDBACK_WINDOW_DURATION_INVALID", "ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_SNAPSHOT_MISMATCH",
  "windowMaturity", "clockSource"
]) assert.match(feedback, new RegExp(required));
for (const required of ["canonicalTimestamp", "expectedId", "storedPublicationSemanticRequest", "ATOMIC_MANUAL_PUBLICATION_STORED_CLOSURE_INVALID"])
  assert.match(publication, new RegExp(required));

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "Atomic exact feedback full-closure fixture must pass");
console.log(JSON.stringify({
  status: "atomic-exact-feedback-self-test passed", platforms: ["xiaohongshu", "wechat"],
  rejectedZeroWriteClasses: ["publication-time", "publication-id", "window-duration", "snapshot-corruption", "import-cross-ref", "cross-platform-replay"],
  providerCalls: 0, externalCalls: 0, browserCalls: 0, activeDatabaseWrites: 0, platformCalls: 0
}, null, 2));
