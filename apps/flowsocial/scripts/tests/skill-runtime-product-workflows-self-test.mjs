import assert from "node:assert/strict";
import { getSkillRuntimeStatus } from "../../skill-runtime.mjs";

const status = getSkillRuntimeStatus();
assert.equal(status.workflowProjectionVersion, "2.0");
assert.deepEqual(status.workflows, status.legacyWorkflows, "legacy workflows must remain backward compatible");
assert.ok(status.legacyWorkflows.xhs_pipeline.includes("write-xhs-content"));
assert.ok(status.unifiedAtomicWorkflows.xhs_atomic_product_pipeline.includes("write-xhs-post-copy"));
assert.ok(status.unifiedAtomicWorkflows.xhs_atomic_product_pipeline.includes("design-xhs-integrated-pages"));
assert.ok(!status.unifiedAtomicWorkflows.xhs_atomic_product_pipeline.includes("XhsHtmlRenderer"));
assert.ok(status.unifiedAtomicWorkflows.wechat_atomic_product_pipeline.includes("plan-wechat-images"));
assert.ok(status.unifiedAtomicWorkflows.wechat_atomic_product_pipeline.includes("LocalPackageDelivery"));

console.log("skill-runtime-product-workflows-self-test: ok");
