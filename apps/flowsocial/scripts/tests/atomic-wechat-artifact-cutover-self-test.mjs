import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";

const previous = process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1;
try {
  delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1;
  assert.equal(featureFlags().unifiedContentAtomicWechatArtifactV1, false, "Atomic WeChat Artifact must be default-off");
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1 = "1";
  assert.equal(featureFlags().unifiedContentAtomicWechatArtifactV1, true);
} finally {
  if (previous === undefined) delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1;
  else process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1 = previous;
}

const integrationTest = fileURLToPath(new URL("./unified-content-product-api-self-test.mjs", import.meta.url));
const result = spawnSync(process.execPath, [integrationTest], { encoding: "utf8", env: { ...process.env } });
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /unified-content-product-api-self-test passed/);

console.log(JSON.stringify({
  status: "atomic-wechat-artifact-cutover-self-test passed",
  authority: "validated atomic_wechat_v1 resolver and immutable Commit Skill Output Facts",
  semantics: "pre_upload_template_not_wechat_final",
  covered: ["default-off", "no-naked-plan", "resource-failure-retry", "six-gates", "whole-article", "persisted-bytes", "replay-conflict", "generic-write-bypasses-fail-closed", "restart", "artifact-aware-projection", "xhs-legacy-regression"],
  realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, wechatUploads: 0, platformWrites: 0
}, null, 2));
