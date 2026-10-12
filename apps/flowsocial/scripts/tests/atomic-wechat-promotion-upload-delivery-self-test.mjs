import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
const previous = process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1;
try {
  delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1;
  assert.equal(featureFlags().unifiedContentAtomicWechatPromotionUploadDeliveryV1, false);
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1 = "1";
  assert.equal(featureFlags().unifiedContentAtomicWechatPromotionUploadDeliveryV1, true);
} finally {
  if (previous === undefined) delete process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1;
  else process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1 = previous;
}

const server = source("server.mjs");
for (const route of ["promotion-preview", "promotion-confirm", "resource-upload-plan-preview", "resource-upload-plan-confirm", "resource-upload-executions", "final-delivery", "delivery-state", "draft-preview", "draft-executions", "draft-state"]) assert.match(server, new RegExp(route));
assert.match(server, /createWechatUploadAssetReader/);
assert.match(server, /createWechatResourceUploadTransport/);
assert.match(server, /createWechatDraftTransport/);
const implementation = source("content-agent/wechat-illustrated-delivery.mjs");
for (const contract of ["AtomicWechatImmutableContentVersion@1.0", "AtomicWechatPromotionRecord@1.0", "AtomicWechatApprovedResourceUploadPlan@1.0", "AtomicWechatResourceUploadExecution@1.0", "AtomicWechatResourceUploadEvidence@1.0", "WechatPostUploadArtifactFact@1.0", "AtomicWechatFinalDeliveryRecord@1.0"]) assert.match(implementation, new RegExp(contract.replace(/[.@]/g, "\\$&")));
assert.match(implementation, /wechat_resources_uploaded_content_not_published/);
assert.match(implementation, /draftCreated: false/);
assert.match(implementation, /published: false/);
assert.match(implementation, /localPackageReady: Boolean\(promotion\)/);
assert.match(implementation, /promotedVersionRef: promotion \? clone\(promotion\.promotedVersionRef\) : null/);
assert.match(implementation, /contentProjectId: plan\.contentProjectRef\.id/);
assert.match(implementation, /accountId: plan\.accountId/);
const product = source("content-agent/unified-atomic-multiplatform-product.mjs");
assert.match(product, /currentWechatCommits/);
assert.match(product, /UNIFIED_ATOMIC_WECHAT_SUPERSESSION_FACT_INVALID/);
assert.match(product, /UNIFIED_ATOMIC_WECHAT_SUPERSESSION_BRANCH_INVALID/);

const api = source("api-client.js");
for (const method of ["previewUnifiedWechatResourceUploadPlan", "confirmUnifiedWechatResourceUploadPlan", "executeUnifiedWechatResourceUpload", "getUnifiedWechatDeliveryState", "previewUnifiedWechatDraftCreation", "executeUnifiedWechatDraftCreation", "getUnifiedWechatDraftState"]) assert.match(api, new RegExp(`${method}:`));
const app = readFrontendSourceSync();
assert.match(app, /unifiedContentAtomicWechatPromotionUploadDeliveryV1/);
assert.match(app, /writesPerformed !== false/);
assert.match(app, /providerCalls !== 0/);
assert.match(app, /不会自动重试任何外部调用/);
assert.match(app, /executeUnifiedWechatDraftCreation/);
const html = source("index.html");
assert.match(html, /公众号资源上传与对账/);
assert.match(html, /不会创建草稿，也不会发布文章/);
assert.match(html, /创建公众号草稿/);
assert.match(html, /不授权发布/);

const fixture = spawnSync(process.execPath, [resolve(root, "scripts/tests/unified-content-product-api-self-test.mjs")], { cwd: root, encoding: "utf8", env: { ...process.env } });
if (fixture.status !== 0) { process.stderr.write(fixture.stdout || ""); process.stderr.write(fixture.stderr || ""); }
assert.equal(fixture.status, 0, "Atomic WeChat promotion/upload/delivery API fixture must pass");
const draft = spawnSync(process.execPath, [resolve(root, "scripts/tests/wechat-draft-creation-self-test.mjs")], { cwd: root, encoding: "utf8", env: { ...process.env } });
if (draft.status !== 0) { process.stderr.write(draft.stdout || ""); process.stderr.write(draft.stderr || ""); }
assert.equal(draft.status, 0, "Atomic WeChat draft creation contract fixture must pass");
console.log(JSON.stringify({ status: "atomic-wechat-promotion-upload-delivery-self-test passed", covered: ["default-off", "promotion-preview-confirm", "explicit-upload-plan-approval", "partial-attempt-only", "postprocess-failure-attempt-evidence", "success-replay-zero-call", "changed-semantics-zero-call", "exact-plan-execution-evidence-postupload-closure", "correctly-rehashed-execution-evidence-postupload-forgeries", "postupload-no-local-src", "delivery-ready-not-published"], realProviderCalls: 0, draftCreations: 0, platformPublications: 0 }, null, 2));
