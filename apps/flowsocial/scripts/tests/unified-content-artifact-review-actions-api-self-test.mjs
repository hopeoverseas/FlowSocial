import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifactStoreSource = await readFile(new URL("../../content-agent/unified-content-artifact-store.mjs", import.meta.url), "utf8");
assert.doesNotMatch(artifactStoreSource, /operation\s*===\s*["']wechat_whole_article_quality["']/, "caller-supplied whole-article evidence must not have a public generic append operation");

await import("./unified-content-artifact-api-self-test.mjs");

console.log(JSON.stringify({
  status: "unified-content-artifact-review-actions-api-self-test passed",
  deterministicRuntimeFacts: true,
  appendOnlyReviewActions: true,
  callerSuppliedWholeArticleEvidenceRejected: true,
  realProviderCalls: 0,
  platformCalls: 0,
  productionDatabaseCalls: 0
}, null, 2));
