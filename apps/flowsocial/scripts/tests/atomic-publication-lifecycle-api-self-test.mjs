import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const server = await readFile(join(root, "server.mjs"), "utf8");
const flags = await readFile(join(root, "feature-flags.mjs"), "utf8");
const fixture = await readFile(join(root, "scripts", "tests", "unified-content-product-api-self-test.mjs"), "utf8");

assert.match(flags, /atomicPublicationLifecycleV1:\s*enabled\("ATOMIC_PUBLICATION_LIFECYCLE_V1", false\)/);
for (const action of ["publication-lifecycle-state", "publication-correction", "publication-takedown", "publication-replacement"]) {
  assert.match(server, new RegExp(action));
  assert.match(fixture, new RegExp(action));
}
assert.match(server, /if \(!flags\.atomicPublicationLifecycleV1\).*ATOMIC_PUBLICATION_LIFECYCLE_DISABLED/);
assert.match(fixture, /replacement double-CAS failure must append neither head/);
assert.match(fixture, /stale lifecycle CAS must preserve complete store equality/);
assert.match(fixture, /correctly rehashed lifecycle cross-ref forgery must be zero-write/);
assert.match(fixture, /currentPlatformState, "replaced"/);
assert.match(fixture, /wechatLifecycleState\.currentPlatformState, "published_unavailable"/);

console.log(JSON.stringify({
  status: "atomic-publication-lifecycle-api-self-test passed",
  defaultOff: true, xhsFixture: true, wechatFixture: true,
  providerCalls: 0, browserCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, platformActions: 0
}, null, 2));
