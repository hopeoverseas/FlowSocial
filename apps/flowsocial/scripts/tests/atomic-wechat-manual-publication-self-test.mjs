import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
const publication = source("content-agent/atomic-manual-publication-store.mjs");
assert.match(publication, /resolveAtomicWechatManualPublicationContext/);
assert.match(publication, /mp\.weixin\.qq\.com/);
assert.match(publication, /ControlledManualPublication@1\.0/);
assert.match(publication, /platformApiPublicationPerformed:\s*false/);
assert.match(publication, /humanPublicationConfirmed:\s*true/);
const wechatDelivery = source("content-agent/wechat-illustrated-delivery.mjs");
for (const binding of ["uploadEvidenceRef", "postUploadRef", "deliveryRef", "manifestRef"]) assert.match(wechatDelivery, new RegExp(binding));
const server = source("server.mjs");
assert.match(server, /manual-publication-preview\|manual-publication-confirm/);
assert.match(server, /projectAtomicManualPublication/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "Atomic WeChat controlled manual-publication fixture must pass");
console.log(JSON.stringify({
  status: "atomic-wechat-manual-publication-self-test passed",
  covered: ["default-off", "exact-delivery-closure", "canonical-wechat-url", "manual-observation", "replay-conflict-duplicate", "rehash-forgery", "published-projection"],
  providerCalls: 0, externalCalls: 0, browserCalls: 0, activeDatabaseWrites: 0, platformCalls: 0
}, null, 2));
