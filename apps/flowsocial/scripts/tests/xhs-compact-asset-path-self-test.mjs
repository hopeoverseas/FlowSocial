import assert from "node:assert/strict";
import { compactXhsAssetPaths, isCompactXhsAssetPath } from "../../content-agent/xhs-asset-paths.mjs";

const candidateRef = {
  id: "unified_content_candidate_v3:platform_run:unified_project_" + "very-long-identity-".repeat(12),
  hash: "a".repeat(64)
};
const first = compactXhsAssetPaths({ candidateRef, pageId: "P1", attempt: 1, operationKey: "request-one", rawExtension: "jpeg" });
const replay = compactXhsAssetPaths({ candidateRef, pageId: "P1", attempt: 1, operationKey: "request-one", rawExtension: "jpeg" });
const next = compactXhsAssetPaths({ candidateRef, pageId: "P1", attempt: 2, operationKey: "request-two", rawExtension: "png" });

assert.deepEqual(first, replay, "the same immutable attempt must resolve to the same compact paths");
assert.notEqual(first.raw, next.raw);
assert.ok(isCompactXhsAssetPath(first.raw));
assert.ok(isCompactXhsAssetPath(first.normalized));
assert.ok(first.raw.length < 140 && first.normalized.length < 140);
assert.ok(!first.raw.includes(candidateRef.id));
assert.equal(first.raw.endsWith("raw.jpeg"), true);
assert.equal(isCompactXhsAssetPath("xhs/normalized/legacy-candidate/P1/a1.png"), false, "legacy stored paths remain distinguishable and readable as-is");

console.log("xhs-compact-asset-path-self-test: ok");
