import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  appendUnifiedWechatRevisionRequest,
  approveUnifiedWechatPromptCost,
  executeUnifiedWechatGeneratedImages,
  executeUnifiedWechatRevision,
  getUnifiedWechatProductionControlState,
  initializeUnifiedWechatProductionControl,
  previewUnifiedWechatPromptCost,
  projectUnifiedWechatCostPlan,
  projectUnifiedWechatPromptPlan
} from "../../content-agent/unified-wechat-production-control.mjs";
import { createWechatGeneratedRasterExecution } from "../../content-agent/wechat-generated-raster-runtime.mjs";

const hash = (character) => character.repeat(64);
const product = {
  id: "project:wechat-control",
  aggregateHash: hash("a"),
  productIdentityRef: { id: "project:wechat-control", hash: hash("f") },
  platforms: {
    wechat: {
      state: "materialized",
      articleRef: { id: "article:one", hash: hash("1") },
      imagePlanRef: { id: "image-plan:one", hash: hash("b") },
      canonicalImagePlan: {
        planHash: hash("c"),
        declarations: [
          { slotId: "W1", role: "inline", strategy: "generated_raster", imageSpec: { prompt: "A no-text four-step diagram", size: "1536x1024" } },
          { slotId: "W2", role: "inline", strategy: "no_image", imageSpec: null }
        ]
      }
    }
  }
};
const visualRef = { id: "revision:visual:one", hash: hash("d") };
const promptPlan = projectUnifiedWechatPromptPlan(product, visualRef);
assert.equal(promptPlan.prompts.length, 1);
assert.equal(promptPlan.prompts[0].slotId, "W1");
assert.equal(promptPlan.visualRevisionRef.hash, visualRef.hash);
assert.match(promptPlan.planHash, /^[a-f0-9]{64}$/);

const changedPromptPlan = projectUnifiedWechatPromptPlan(product, { id: "revision:visual:two", hash: hash("e") });
assert.notEqual(changedPromptPlan.planHash, promptPlan.planHash, "a visual revision must stale the previous prompt plan");
const costPlan = projectUnifiedWechatCostPlan(promptPlan, 1.5);
assert.equal(costPlan.maxCredits, 1.5);
assert.equal(costPlan.estimateStatus, "upper_bound_only");
assert.throws(() => projectUnifiedWechatCostPlan(promptPlan, 0), /UNIFIED_PRODUCTION_CONTROL_MAX_CREDITS_INVALID/);

let productReads = 0;
const dependencies = { getProduct: () => { productReads += 1; return structuredClone(product); } };
const store = {};
const initialized = initializeUnifiedWechatProductionControl(store, { projectId: product.id, occurredAt: "2026-08-17T01:00:00.000Z" }, dependencies);
assert.equal(initialized.created, true);
assert.equal(initialized.state.initialized, true);
assert.equal(store.unifiedProductionRevisions.length, 3);
const preview = previewUnifiedWechatPromptCost(store, { projectId: product.id, maxCredits: 1.5 }, dependencies);
assert.equal(preview.providerCalls, 0);
assert.equal(preview.platformCalls, 0);
const beforeInvalidApproval = structuredClone(store);
assert.throws(() => approveUnifiedWechatPromptCost(store, {
  projectId: product.id, maxCredits: 1.5,
  promptPlanRef: { id: preview.promptPlan.id, hash: preview.promptPlan.planHash },
  costPlanRef: { id: preview.costPlan.id, hash: preview.costPlan.planHash },
  decision: "invalid", decidedBy: "user:reviewer", decidedAt: "2026-08-17T01:01:00.000Z", idempotencyKey: "approval:one"
}, dependencies), /UNIFIED_PROMPT_COST_APPROVAL_INVALID/);
assert.deepEqual(store, beforeInvalidApproval, "a rejected approval must leave every collection unchanged");
const approved = approveUnifiedWechatPromptCost(store, {
  projectId: product.id, maxCredits: 1.5,
  promptPlanRef: { id: preview.promptPlan.id, hash: preview.promptPlan.planHash },
  costPlanRef: { id: preview.costPlan.id, hash: preview.costPlan.planHash },
  decision: "approved", decidedBy: "user:reviewer", decidedAt: "2026-08-17T01:01:00.000Z", idempotencyKey: "approval:one"
}, dependencies);
assert.equal(approved.state.preuploadAllowed, false, "approval alone must not bypass actual image generation");
assert.equal(approved.state.imageGeneration.ready, false);
const generatedAssets = new Map();
const generatedExecution = createWechatGeneratedRasterExecution({
  providerTransport: {
    submit: async () => ({ taskId: "wechat-control-task-1" }),
    readResult: async () => ({ status: "succeeded", bytes: Buffer.from("wechat-control-image"), cost: 1, costStatus: "provider_reported" })
  },
  assetWriter: async ({ relativePath, bytes }) => {
    generatedAssets.set(relativePath, Buffer.from(bytes));
    return { relativePath, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
  },
  persistStore: async () => {}, maxPolls: 1, pollIntervalMs: 0
});
const generated = await executeUnifiedWechatGeneratedImages(store, {
  projectId: product.id, maxCalls: 1, attempt: 1, confirmProviderExecution: true,
  executedBy: "user:reviewer", executedAt: "2026-08-17T01:01:30.000Z", idempotencyKey: "wechat-images:control:attempt-1"
}, { ...dependencies, executeGeneratedImages: generatedExecution, persistStore: async () => {} });
assert.equal(generated.generation.ready, true);
assert.equal(generated.state.preuploadAllowed, true, "successful exact image generation opens local preupload");
const localOnlyProduct = structuredClone(product);
localOnlyProduct.id = "project:wechat-local-images";
localOnlyProduct.productIdentityRef = { id: localOnlyProduct.id, hash: hash("2") };
localOnlyProduct.platforms.wechat.canonicalImagePlan = {
  planHash: hash("3"),
  declarations: [{ slotId: "cover", role: "cover", strategy: "html_chart", imageSpec: null }]
};
const localOnlyStore = {};
const localOnlyDependencies = { getProduct: () => structuredClone(localOnlyProduct) };
const localOnlyState = initializeUnifiedWechatProductionControl(localOnlyStore, {
  projectId: localOnlyProduct.id, occurredAt: "2026-08-17T01:01:30.000Z"
}, localOnlyDependencies).state;
assert.equal(localOnlyState.promptPlan.prompts.length, 0);
assert.equal(localOnlyState.promptCostApprovalRequired, false, "deterministic local illustrations must not invent a paid-provider approval gate");
assert.equal(localOnlyState.preuploadAllowed, true, "local cover and inline cards can proceed without Provider cost approval");
const revised = appendUnifiedWechatRevisionRequest(store, {
  projectId: product.id, layer: "visual", instruction: "Replace the W1 illustration while preserving the article.", actorId: "user:reviewer",
  occurredAt: "2026-08-17T01:02:00.000Z", idempotencyKey: "revision:visual:one"
}, dependencies);
assert.equal(revised.request.status, "awaiting_execution");
const afterRevision = getUnifiedWechatProductionControlState(store, { projectId: product.id }, dependencies);
assert.equal(afterRevision.promptCostApproval, null, "a visual revision must stale the former approval");
assert.equal(afterRevision.preuploadAllowed, false, "pending execution must close the local preupload gate");
assert.equal(afterRevision.pendingRevisionRequests.length, 1);
assert.ok(productReads > 0);

const executionProduct = structuredClone(product);
executionProduct.commitRefs = { wechat: { id: "commit:wechat", hash: hash("7") } };
executionProduct.platformMaterializedProjectRefs = { wechat: { id: "materialized:wechat", hash: hash("8") } };
executionProduct.platforms.wechat.platformRunRef = { id: "run:wechat", hash: hash("9") };
executionProduct.platforms.wechat.article = { id: "article:one", authorityHash: hash("a"), article: { recommended_title: "Original", article_markdown: "Original body" }, componentHash: hash("1") };
executionProduct.platforms.wechat.canonicalImagePlan = {
  id: "image-plan:one", authorityHash: hash("a"), articleRef: executionProduct.platforms.wechat.articleRef,
  canonicalPlan: { ...product.platforms.wechat.canonicalImagePlan, bindings: null, cover: null, slots: structuredClone(product.platforms.wechat.canonicalImagePlan.declarations) }, componentHash: hash("b")
};
const executionStore = { unifiedAtomicContentCommits: [{ id: "commit:wechat", commitHash: hash("7"), skillFacts: { imagePlan: { outputFact: { id: "output:image-plan", factHash: hash("6") } } } }] };
const executionDependencies = { getProduct: () => structuredClone(executionProduct), validateArticle: (article) => article };
initializeUnifiedWechatProductionControl(executionStore, { projectId: product.id, occurredAt: "2026-08-17T02:00:00.000Z" }, executionDependencies);
const visualRequest = appendUnifiedWechatRevisionRequest(executionStore, {
  projectId: product.id, layer: "visual", instruction: "Use a calmer visual prompt.", actorId: "user:reviewer",
  occurredAt: "2026-08-17T02:01:00.000Z", idempotencyKey: "revision:visual:execute"
}, executionDependencies);
const execution = executeUnifiedWechatRevision(executionStore, {
  projectId: product.id, requestRef: { id: visualRequest.request.id, hash: visualRequest.request.factHash },
  promptChanges: [{ slotId: "W1", prompt: "A calm no-text four-step diagram" }], executedBy: "user:reviewer",
  executedAt: "2026-08-17T02:02:00.000Z", idempotencyKey: "execution:visual:one"
}, executionDependencies);
assert.equal(execution.created, true);
assert.equal(execution.execution.providerCalls, 0);
assert.equal(execution.execution.platformCalls, 0);
assert.notDeepEqual(execution.execution.articleRef, executionProduct.platforms.wechat.articleRef, "even a visual revision needs an exact new selectable version ref");
assert.match(execution.execution.canonicalImagePlan.canonicalPlan.planId, /:revision:/, "a revised candidate needs a distinct immutable image-plan identity");
assert.equal(execution.state.pendingRevisionRequests.length, 0);
assert.equal(execution.state.promptPlan.prompts[0].prompt, "A calm no-text four-step diagram");
assert.equal(execution.state.preuploadAllowed, false, "the revised visual plan still needs a new exact prompt/cost approval");
const replayedExecution = executeUnifiedWechatRevision(executionStore, {
  projectId: product.id, requestRef: { id: visualRequest.request.id, hash: visualRequest.request.factHash },
  promptChanges: [{ slotId: "W1", prompt: "A calm no-text four-step diagram" }], executedBy: "user:reviewer",
  executedAt: "2026-08-17T02:02:00.000Z", idempotencyKey: "execution:visual:one"
}, executionDependencies);
assert.equal(replayedExecution.created, false, "an exact retry must return the immutable execution instead of appending a version");
const revisedPreview = previewUnifiedWechatPromptCost(executionStore, { projectId: product.id, maxCredits: 2 }, executionDependencies);
const revisedApproval = approveUnifiedWechatPromptCost(executionStore, {
  projectId: product.id, maxCredits: 2,
  promptPlanRef: { id: revisedPreview.promptPlan.id, hash: revisedPreview.promptPlan.planHash },
  costPlanRef: { id: revisedPreview.costPlan.id, hash: revisedPreview.costPlan.planHash },
  decision: "approved", decidedBy: "user:reviewer", decidedAt: "2026-08-17T02:02:30.000Z", idempotencyKey: "approval:visual:revised"
}, executionDependencies);
assert.equal(revisedApproval.state.preuploadAllowed, false, "a revised visual plan still needs its exact generated assets");
const copyRequest = appendUnifiedWechatRevisionRequest(executionStore, {
  projectId: product.id, layer: "copy", instruction: "Change the exact recommended title.", actorId: "user:reviewer",
  occurredAt: "2026-08-17T02:03:00.000Z", idempotencyKey: "revision:copy:one"
}, executionDependencies);
const copiedArticle = { ...execution.state.currentVersion.article.article, recommended_title: "Revised exact title" };
const copyExecution = executeUnifiedWechatRevision(executionStore, {
  projectId: product.id, requestRef: { id: copyRequest.request.id, hash: copyRequest.request.factHash }, article: copiedArticle,
  executedBy: "user:reviewer", executedAt: "2026-08-17T02:04:00.000Z", idempotencyKey: "execution:copy:one"
}, executionDependencies);
assert.equal(copyExecution.state.currentVersion.article.article.recommended_title, "Revised exact title");
assert.notEqual(copyExecution.execution.canonicalImagePlan.canonicalPlan.planId, execution.execution.canonicalImagePlan.canonicalPlan.planId, "each article revision must receive a candidate-bound image-plan identity");
assert.equal(copyExecution.state.promptPlan.prompts[0].prompt, "A calm no-text four-step diagram", "copy-only execution must preserve the visual prompt version");
assert.deepEqual(copyExecution.state.promptCostApproval, revisedApproval.state.promptCostApproval, "copy-only execution must preserve the exact visual approval");
assert.equal(copyExecution.state.preuploadAllowed, false, "the new article candidate must not silently inherit an old candidate's generated asset evidence");
const upstreamRequest = appendUnifiedWechatRevisionRequest(executionStore, {
  projectId: product.id, layer: "upstream", instruction: "Change the factual premise.", actorId: "user:reviewer",
  occurredAt: "2026-08-17T02:05:00.000Z", idempotencyKey: "revision:upstream:one"
}, executionDependencies);
assert.throws(() => executeUnifiedWechatRevision(executionStore, {
  projectId: product.id, requestRef: { id: upstreamRequest.request.id, hash: upstreamRequest.request.factHash }, executedBy: "user:reviewer",
  executedAt: "2026-08-17T02:06:00.000Z", idempotencyKey: "execution:upstream:one"
}, executionDependencies), /UNIFIED_PRODUCTION_REVISION_UPSTREAM_RUN_REQUIRED/);

const [server, productionRoutes, api, app, html] = await Promise.all([
  readFile(new URL("../../server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../http/unified-wechat-production-routes.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../api-client.js", import.meta.url), "utf8"),
  readFrontendSource(),
  readFile(new URL("../../index.html", import.meta.url), "utf8")
]);
for (const action of ["state", "initialize", "revisions", "revision-executions", "image-executions", "prompt-cost-preview", "prompt-cost-approval"]) assert.ok(productionRoutes.includes(action));
assert.match(productionRoutes, /UNIFIED_PRODUCTION_CONTROL_PREUPLOAD_BLOCKED/);
assert.match(server, /handleUnifiedWechatProductionRoute/);
for (const method of ["getUnifiedWechatProductionControlState", "initializeUnifiedWechatProductionControl", "createUnifiedWechatRevisionRequest", "executeUnifiedWechatRevision", "executeUnifiedWechatGeneratedImages"]) assert.match(api, new RegExp(`${method}:`));
for (const id of ["unifiedProductionControl", "unifiedWechatSaveRevision", "unifiedProductionRevisionLayer", "unifiedProductionRevisionSubmit", "unifiedProductionRevisionPayload", "unifiedProductionRevisionExecute", "unifiedWechatGenerateImages", "unifiedWechatImageCallBudget"]) assert.match(html, new RegExp(`id="${id}"`));
for (const removedId of ["unifiedProductionPromptPreview", "unifiedProductionPromptConfirm", "unifiedProductionPromptApprove", "unifiedProductionMaxCredits"]) assert.doesNotMatch(html, new RegExp(`id="${removedId}"`));
assert.match(app, /productionControl\?\.preuploadAllowed !== true/);
assert.match(app, /封面与正文插图/);
assert.match(app, /saveUnifiedWechatCopyRevision/);
assert.match(app, /失败不会自动重复付费调用/);
assert.match(app, /等待对应执行器产出新版本/);
assert.doesNotMatch(app.slice(app.indexOf("function renderUnifiedProductionControl"), app.indexOf("\/\/ UNIFIED_ARTIFACT_FEATURE_GATE_START")), /executeUnifiedWechatResourceUpload/);

console.log(JSON.stringify({ status: "unified-wechat-production-control-self-test passed", promptCount: promptPlan.prompts.length, providerCalls: 1, platformCalls: 0 }));
