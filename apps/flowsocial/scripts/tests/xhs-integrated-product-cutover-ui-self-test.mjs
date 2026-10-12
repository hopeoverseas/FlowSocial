import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFrontendSourceSync();
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

assert.match(html, /id="unifiedArtifactReviewNav"[^>]*>.*内容生产/);
assert.match(html, /小红书图文和公众号文章分别进入各自工作区/);
assert.match(html, /整页图文生成与修改/);
assert.match(html, /id="unifiedXhsStartDesign"[^>]*>生成逐页提示词与视觉方案/);
assert.match(html, /id="unifiedXhsCreateLightPlan"[^>]*>生成修改方案/);
assert.match(html, /id="unifiedXhsExecuteLightPlan"[^>]*>生成该页新版本/);
assert.match(html, /id="unifiedXhsConfirmVisualSet"[^>]*>人工确认整套图片并生成版本标签/);
assert.doesNotMatch(html, /id="unifiedXhsExecuteVisualReview"/);

assert.match(app, /function openUnifiedXhsProductionEntry/);
assert.match(app, /FlowAPI\.adoptContentOpportunity\(opportunity\.id/);
assert.doesNotMatch(app, /FlowAPI\.startContentOpportunity\(/);
assert.match(app, /xhsIntegratedPageDesignEnabled = gate\.xhsIntegratedPageDesignEnabled/);
assert.doesNotMatch(app, /历史链路 · 只读兼容|renderV2RunWorkspace|loadDeepLinkedContentWorkflow/);
assert.match(app, /\(viewAliases\[requestedView\] \|\| requestedView\) === "artifact-review"/);
assert.match(app, /function createUnifiedXhsLightPlan/);
assert.match(app, /function executeUnifiedXhsLightPlan/);
assert.match(app, /function scheduleUnifiedXhsLightContinuation/);
assert.match(app, /continueUnifiedXhsLightRevision/);
assert.match(app, /刷新页面会自动继续，不会再次创建或扣费/);
assert.match(app, /function confirmUnifiedXhsVisualSet/);
assert.match(app, /editMode === "image_edit" \? "当前整图编辑" : "整页重新生成"/);

console.log("xhs-integrated-product-cutover-ui-self-test: ok");
