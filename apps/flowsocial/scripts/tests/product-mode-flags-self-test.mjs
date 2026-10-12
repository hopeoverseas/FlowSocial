import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyLocalProductMode } from "../maintenance/product-mode-flags.mjs";
import { buildProductCapabilityPolicyReport } from "../../product-capability-policy.mjs";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
assert.equal(packageJson.scripts.start, "node scripts/maintenance/start-product.mjs", "npm start must expose the product UI by default");

const env = {};
applyLocalProductMode(env);

for (const name of [
  "UNIFIED_CONTENT_PRODUCTION_V1",
  "UNIFIED_CONTENT_PREREQUISITES_V1",
  "UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1",
  "UNIFIED_CONTENT_ARTIFACTS_V1",
  "UNIFIED_CONTENT_ATOMIC_PRODUCT_V1",
  "UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1",
  "UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1",
  "UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1",
  "XHS_INTEGRATED_PAGE_DESIGN_SKILL",
  "XHS_INTEGRATED_PAGE_DIRECTION_REVIEW",
  "XHS_INTEGRATED_PAGE_PROVIDER_COMPILER",
  "XHS_VISUAL_ASSET_REGISTRY",
  "XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN",
  "UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1",
  "UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1",
  "UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_APPROVAL_V1",
  "UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1",
  "UNIFIED_CONTENT_XHS_LIGHT_REVISION_V1",
  "UNIFIED_CONTENT_XHS_HUMAN_VISUAL_CONFIRMATION_V1",
  "ATOMIC_MANUAL_PUBLICATION_V1",
  "ATOMIC_EXACT_FEEDBACK_V1",
  "ATOMIC_PUBLICATION_LIFECYCLE_V1",
  "ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1",
  "STRATEGY_FEEDBACK_V1",
  "LOCAL_CONTENT_PROMOTION_V1",
  "LOCAL_PACKAGE_DELIVERY_V1"
]) assert.equal(env[name], "1", `${name} should be enabled in local product mode`);

for (const name of [
  "UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1",
  "ATOMIC_WECHAT_DRAFT_CREATION_V1",
  "CONTENT_PROMOTION_V1",
  "UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1",
  "UNIFIED_CONTENT_XHS_VISUAL_REVIEW_APPROVAL_V1"
]) assert.equal(env[name], "0", `${name} should remain closed in local product mode`);

assert.equal(env.FLOWSOCIAL_PRODUCT_MODE, "local-package");
const report = buildProductCapabilityPolicyReport(env);
assert.equal(report.baselineReady, true);
assert.equal(report.externalEffectsClosed, true);
assert.deepEqual(report.deviations, []);

const explicit = { PLATFORM_PUBLISHING_V1: "1" };
applyLocalProductMode(explicit);
assert.equal(explicit.PLATFORM_PUBLISHING_V1, "1", "explicit operator override should be preserved");
assert.deepEqual(buildProductCapabilityPolicyReport(explicit).unsafeDeviations.map((item) => item.env), ["PLATFORM_PUBLISHING_V1"]);

console.log("product-mode-flags-self-test: ok");
