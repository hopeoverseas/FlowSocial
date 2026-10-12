import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

const resolver = source("content-agent/unified-content-authority-resolver.mjs");
const { validateUnifiedContentAuthorityResolution } = await import(pathToFileURL(resolve(root, "content-agent/unified-content-authority-resolver.mjs")));
assert.match(resolver, /UnifiedContentAuthorityResolution@1\.0/);
assert.match(resolver, /export function validateUnifiedContentAuthorityResolution/);
assert.match(resolver, /authorityKind:\s*"atomic_v2"/);
assert.match(resolver, /authorityKind:\s*"legacy_snapshot_v1"/);
assert.match(resolver, /executionProjectRef:/);
assert.match(resolver, /materializedProjectRef:/);
assert.match(resolver, /validateUnifiedAtomicContentCommitV2/);
assert.match(resolver, /deepFreeze/);

const malformedResolutionCases = [
  ["missing", {}, "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_FIELDS_INVALID"],
  ["extra", { unexpected: true }, "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_FIELDS_INVALID"],
  ["tampered contract", {
    schemaVersion: "1.0", contract: "Wrong@1.0", authorityKind: "atomic_v2", workspaceId: "w", companyId: "c", accountId: "a", projectId: "p", platform: "xiaohongshu",
    productAuthorityHash: "0".repeat(64), executionProjectRef: { id: "p", hash: "0".repeat(64) }, materializedProjectRef: { id: "m", hash: "0".repeat(64) },
    platformRunRef: { id: "r", hash: "0".repeat(64) }, candidateRef: { id: "k", hash: "0".repeat(64) }, payload: {}
  }, "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_CONTRACT_INVALID"]
];
for (const [name, value, code] of malformedResolutionCases) {
  assert.throws(() => validateUnifiedContentAuthorityResolution(value), (error) => error.code === code, name);
}

for (const file of [
  "content-agent/unified-content-xhs-design-stage.mjs",
  "content-agent/unified-content-xhs-provider-plan-store.mjs",
  "content-agent/unified-content-xhs-provider-execution.mjs",
  "content-agent/unified-content-xhs-visual-review.mjs",
  "content-agent/unified-content-artifact-store.mjs"
]) {
  const body = source(file);
  assert.match(body, /resolveUnifiedContentAuthority/, `${file} must use the shared resolver`);
}

const design = source("content-agent/unified-content-xhs-design-stage.mjs");
assert.match(design, /context\.payload\.assemblyOutput/);
assert.match(design, /context\.payload\.candidate/);
assert.doesNotMatch(design.slice(design.indexOf("if (context.authorityKind === \"atomic_v2\")"), design.indexOf("if (!HASH.test(input.productSnapshotHash")), /deriveUnifiedPlatformCandidate/);
assert.match(design, /pageRevisionRefs:\s*\[\]/);

const execution = source("content-agent/unified-content-xhs-provider-execution.mjs");
assert.match(execution, /bindRuntimeToMaterializedProject/);
assert.match(execution, /materializedContentProjectRef/);

const visualReview = source("content-agent/unified-content-xhs-visual-review.mjs");
assert.match(visualReview, /humanReviewAuthority:\s*false/);
assert.match(visualReview, /selectionAuthority:\s*false/);
assert.match(visualReview, /materializedContentProjectRef/);

const productTest = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env }
});
if (productTest.status !== 0) {
  process.stderr.write(productTest.stdout || "");
  process.stderr.write(productTest.stderr || "");
}
assert.equal(productTest.status, 0, "atomic authority product fixture must pass");

console.log(JSON.stringify({
  status: "atomic-xhs-artifact-authority-cutover-self-test passed",
  providerNetworked: false,
  realProviderCalls: 0,
  selectionAuthority: false,
  publicationPerformed: false
}, null, 2));
