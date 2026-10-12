import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
const previous = process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1;
try {
  delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1;
  assert.equal(featureFlags().unifiedContentAtomicWechatHumanSelectionV1, false, "Atomic WeChat human selection must be default-off");
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1 = "1";
  assert.equal(featureFlags().unifiedContentAtomicWechatHumanSelectionV1, true);
} finally {
  if (previous === undefined) delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1;
  else process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1 = previous;
}

const server = source("server.mjs");
for (const route of ["preupload-artifact-review", "editorial-reviews", "human-selections", "human-review-state"]) assert.match(server, new RegExp(route));
assert.match(server, /UNIFIED_ATOMIC_WECHAT_HUMAN_REVIEW_STAGE_REQUIRED/, "generic Artifact Review bypass must remain closed");
assert.match(server, /UNIFIED_ATOMIC_WECHAT_DOWNSTREAM_STAGE_REQUIRED/, "generic downstream bypass must remain closed");

const artifactStore = source("content-agent/unified-content-artifact-store.mjs");
assert.match(artifactStore, /UnifiedAtomicWechatArtifactReviewFact@1\.0/);
assert.match(artifactStore, /UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_EXPLICIT_USER_REQUIRED/);
assert.match(artifactStore, /artifactAuthoritySetHash/);
assert.match(artifactStore, /materializedContentProjectRef/);

const reviewStore = source("content-agent/content-review-store.mjs");
assert.match(reviewStore, /UnifiedAtomicWechatEditorialReviewFact@1\.0/);
assert.match(reviewStore, /UnifiedAtomicWechatSelectionFact@1\.0/);
assert.match(reviewStore, /UnifiedAtomicWechatReviewProjection@1\.0/);
assert.match(reviewStore, /machineDerived:\s*true/);
assert.match(reviewStore, /UNIFIED_ATOMIC_WECHAT_SELECTION_EXPLICIT_USER_REQUIRED/);
for (const authority of ["uploadAuthority", "promotionAuthority", "deliveryAuthority", "publicationAuthority"]) {
  assert.match(reviewStore, new RegExp(`${authority}: false`));
}

const api = source("api-client.js");
for (const method of ["getUnifiedWechatHumanReviewState", "createUnifiedWechatPreuploadReview", "createUnifiedWechatEditorialReview", "createUnifiedWechatSelection"]) {
  assert.match(api, new RegExp(`${method}:`), `${method} must be exposed by the browser client`);
}

const app = readFrontendSourceSync();
for (const method of ["getUnifiedWechatHumanReviewState", "createUnifiedWechatPreuploadReview", "createUnifiedWechatEditorialReview", "createUnifiedWechatSelection"]) {
  assert.match(app, new RegExp(`FlowAPI\\.${method}\\(`), `${method} must be used by the WeChat workbench`);
}
for (const binding of ["commitRef", "materializedContentProjectRef", "articleRef", "artifactStateHash", "artifactAuthoritySetHash"]) {
  assert.match(app, new RegExp(`${binding}: state\\?\\.${binding}`), `UI requests must bind ${binding} from the current dedicated projection`);
}
assert.match(app, /actorType: "user"/);
assert.match(app, /local ready-for-upload/);
assert.match(app, /wechatPendingRequests/);
assert.match(app, /dedicatedWechat \? artifactState\.reviewable === true && reviewState\.artifactApproved === true : artifactState\.selectable === true/,
  "dedicated WeChat selection must not depend on the generic Artifact selectable projection");
for (const method of ["previewUnifiedWechatResourceUploadPlan", "confirmUnifiedWechatResourceUploadPlan", "executeUnifiedWechatResourceUpload", "getUnifiedWechatDeliveryState"]) {
  assert.match(app, new RegExp(`FlowAPI\\.${method}\\(`), `${method} must be wired only behind the dedicated upload feature gate`);
}
assert.match(app, /unifiedContentAtomicWechatPromotionUploadDeliveryV1/);
assert.match(app, /结果未知或待人工处理的上传尝试，禁止新建请求/);

const html = source("index.html");
assert.match(html, /确认并生成内容包/);
assert.match(html, /确认当前版本并生成内容包/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env }
});
if (fixture.status !== 0) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
assert.equal(fixture.status, 0, "Atomic WeChat approve -> editorial -> selected/not_selected/stale/restart fixture must pass");

console.log(JSON.stringify({
  status: "atomic-wechat-human-selection-self-test passed",
  sequence: ["explicit_user_artifact_review", "server_derived_editorial_review", "explicit_user_selection"],
  covered: ["default-off", "dedicated-routes", "exact-refs", "actorType=user", "replay-conflict", "correctly-rehashed-forgery", "upstream-stale", "restart", "generic-bypass-zero-write"],
  realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, wechatUploads: 0, platformWrites: 0,
  uploadAuthority: false, promotionAuthority: false, deliveryAuthority: false, publicationAuthority: false
}, null, 2));
