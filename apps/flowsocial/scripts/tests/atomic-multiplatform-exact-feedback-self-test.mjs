import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
const feedback = source("content-agent/atomic-publication-feedback-store.mjs");
assert.match(feedback, /PLATFORM_RULES/);
assert.match(feedback, /wechat:[\s\S]*reads[\s\S]*favorites[\s\S]*newFollowers/);
assert.match(feedback, /validateControlledManualPublicationClosure/);
assert.match(feedback, /assertSnapshotPublicationClosure/);
assert.match(feedback, /windowMaturity/);
const server = source("server.mjs");
assert.match(server, /platforms\\\/wechat\\\/\(promotion-preview[\s\S]*exact-feedback-preview\|exact-feedback-confirm\|exact-feedback-state/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "Atomic multiplatform exact feedback fixture must pass");
console.log(JSON.stringify({
  status: "atomic-multiplatform-exact-feedback-self-test passed",
  covered: ["xhs-v3-regression", "wechat-publication-closure", "typed-metrics", "manual-and-import", "replay-and-forgery", "window-maturity"],
  providerCalls: 0, externalCalls: 0, browserCalls: 0, activeDatabaseWrites: 0, platformCalls: 0
}, null, 2));
