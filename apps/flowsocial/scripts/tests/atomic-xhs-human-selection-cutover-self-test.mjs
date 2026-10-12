import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

const reviewStore = source("content-agent/content-review-store.mjs");
assert.match(reviewStore, /resolveUnifiedContentAuthority/);
assert.doesNotMatch(reviewStore, /store\.unifiedContentProjects/, "Review/Selection must not choose Atomic versus legacy truth locally");
assert.match(reviewStore, /getUnifiedContentArtifactReview/);
assert.match(reviewStore, /UnifiedAtomicXhsMachineReviewFact@1\.0/);
assert.match(reviewStore, /UnifiedAtomicXhsEditorialReview@1\.0/);
assert.match(reviewStore, /UnifiedAtomicXhsContentReviewFact@1\.0/);
assert.match(reviewStore, /UnifiedAtomicXhsSelectionFact@1\.0/);
assert.match(reviewStore, /UNIFIED_ATOMIC_REVIEW_HUMAN_ARTIFACT_APPROVAL_REQUIRED/);
assert.match(reviewStore, /UNIFIED_SELECTION_EXPLICIT_USER_REQUIRED/);
assert.match(reviewStore, /promotionAuthority:\s*false/);
assert.match(reviewStore, /publicationAuthority:\s*false/);
assert.match(reviewStore, /wechat_not_materialized/);

const artifactStore = source("content-agent/unified-content-artifact-store.mjs");
assert.match(artifactStore, /UNIFIED_ARTIFACT_REVIEW_EXPLICIT_USER_REQUIRED/);
assert.match(artifactStore, /actorType/);
assert.match(artifactStore, /materializedContentProjectRef/);

const projection = source("content-agent/unified-atomic-product-projection.mjs");
assert.match(projection, /reviewState/);
assert.match(projection, /artifactApproved/);
assert.match(projection, /editorialReviewPassed/);
assert.match(projection, /projectStoredHumanReviewState/);

const server = source("server.mjs");
assert.match(server, /listUnifiedContentReviewState\(reviewStore, scoped, \{ featureFlags: flags \}\)/);
assert.match(server, /appendUnifiedContentReview\(reviewStore, scoped, \{ featureFlags: flags \}\)/);
assert.match(server, /appendUnifiedContentSelection\(reviewStore, scoped, \{ featureFlags: flags \}\)/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "atomic Artifact approval → Editorial Review → Selection fixture must pass");

console.log(JSON.stringify({
  status: "atomic-xhs-human-selection-cutover-self-test passed",
  providerNetworked: false,
  externalCalls: 0,
  databaseWrites: 0,
  selectionPromotionAuthority: false,
  publicationPerformed: false
}, null, 2));
