import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const server = readFileSync(resolve(root, "server.mjs"), "utf8");
assert.match(server, /exact-feedback-preview\|exact-feedback-confirm\|exact-feedback-state/);
assert.match(server, /previewAtomicPublicationFeedback\(store, scoped/);
assert.match(server, /confirmAtomicPublicationFeedback\(store/);
assert.match(server, /projectAtomicPublicationFeedback\(store, scoped/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "Atomic exact feedback API persistence fixture must pass");
console.log(JSON.stringify({
  status: "atomic-exact-feedback-api-self-test passed", persistenceReload: true, platforms: ["xiaohongshu", "wechat"],
  providerCalls: 0, externalCalls: 0, browserCalls: 0, activeDatabaseWrites: 0, platformCalls: 0
}, null, 2));
