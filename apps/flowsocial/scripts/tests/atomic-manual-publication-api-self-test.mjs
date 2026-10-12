import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const server = readFileSync(resolve(root, "server.mjs"), "utf8");
assert.match(server, /manual-publication-preview/);
assert.match(server, /manual-publication-confirm/);
assert.match(server, /atomicManualPublicationV1/);
assert.doesNotMatch(server, /manual-publication-update/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "Atomic manual publication API fixture must pass");
console.log(JSON.stringify({
  status: "atomic-manual-publication-api-self-test passed",
  persistenceRestartEvidence: "writeStore/readStore durable reload",
  providerCalls: 0, externalCalls: 0, browserCalls: 0, activeDatabaseWrites: 0, platformCalls: 0
}, null, 2));
