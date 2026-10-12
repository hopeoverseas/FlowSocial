import assert from "node:assert/strict";
import sharp from "sharp";
import { createXhsLightRevisionFixture } from "./helpers/xhs-light-revision-fixture.mjs";
import { solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { approveUnifiedContentXhsLightRevision, classifyXhsLightEditMode, confirmUnifiedContentXhsHumanVisualSet, continueUnifiedContentXhsLightRevision, createUnifiedContentXhsLightRevisionPlan, executeUnifiedContentXhsLightRevision, getUnifiedContentXhsLightRevisionState, resolveUnifiedContentXhsLightRevisionCheckpoint, submitUnifiedContentXhsLightRevision } from "../../content-agent/unified-content-xhs-light-revision.mjs";
import { getUnifiedContentArtifactState } from "../../content-agent/unified-content-artifact-store.mjs";

const flags = { unifiedContentProductionV1: true, unifiedContentArtifactsV1: true, unifiedContentXhsAtomicGraphV1: true, unifiedContentAtomicProductV1: true, unifiedContentXhsLightRevisionV1: true, unifiedContentXhsHumanVisualConfirmationV1: true };
const store = createXhsLightRevisionFixture();
store.unifiedContentXhsLightRevisionPlans = [];
store.unifiedContentXhsLightRevisionApprovals = [];
store.unifiedContentXhsLightRevisionExecutions = [];
store.unifiedContentXhsLightRevisionCompletions = [];
store.unifiedContentXhsLightRevisionCheckpoints = [];
store.unifiedContentXhsLightRevisionReconciliationResolutions = [];
store.unifiedContentXhsHumanVisualConfirmationFacts = [];
store.unifiedContentXhsVisualVersionTags = [];
const providerPlan = (store.unifiedContentXhsProviderPlanFacts || []).filter((plan) => {
  const revisions = (store.unifiedContentXhsPageRevisionFacts || []).filter((revision) => revision.planRef?.id === plan.plan?.id && revision.planRef?.hash === plan.plan?.planHash);
  return new Set(revisions.map((item) => item.pageId)).size === plan.plan?.pages?.length;
}).at(-1);
assert(providerPlan, "fixture requires one complete XHS provider plan");

const scope = { workspaceId: providerPlan.workspaceId, companyId: providerPlan.companyId, accountId: providerPlan.accountId, projectId: providerPlan.contentProjectRef.id, candidateId: providerPlan.candidateRef.id };
const providerPlanFactRef = { id: providerPlan.id, hash: providerPlan.factHash };
const initial = getUnifiedContentXhsLightRevisionState(store, { ...scope, providerPlanFactRef }, { featureFlags: flags });
assert.equal(initial.pageHeads.length, providerPlan.plan.pages.length);
assert.equal(classifyXhsLightEditMode("把背景改成更克制的深蓝色"), "image_edit");
assert.equal(classifyXhsLightEditMode("把标题改成新的主张"), "regenerate");
assert.equal(classifyXhsLightEditMode("保持所有文字、字号、位置和版式不变，只把标题下方残留的浅酒红横线改成深墨绿色"), "image_edit", "preservation clauses and spatial title references must not trigger text regeneration");
assert.equal(classifyXhsLightEditMode("保持文字不变，调整整体版式和标题位置"), "regenerate", "an explicit layout change must still regenerate the full page");

const first = initial.pageHeads[0];
const textPlan = createUnifiedContentXhsLightRevisionPlan(store, { ...scope, providerPlanFactRef, targetPageId: first.pageId, baseRevisionRef: first.revisionRef, instruction: "把标题改成新的主张", createdBy: "self-test", idempotencyKey: "light-plan-text" }, { featureFlags: flags, assistant: { editMode: "image_edit", compiledPrompt: "重新生成整页，并按要求修改标题" }, now: "2026-08-19T00:00:00.000Z" });
assert.equal(textPlan.plan.editMode, "regenerate", "AI must not downgrade a text change to image edit");
assert.match(textPlan.plan.compiledPrompt, /唯一允许出现的逐字文字清单/);
assert.match(textPlan.plan.compiledPrompt, /禁止增加、改写、扩写、演示或推测任何指标、数字、标签、案例和说明/);
assert.doesNotMatch(textPlan.plan.compiledPrompt, /唯一允许出现的逐字文字清单：\n\n画面中的全部可见文字/, "locked truth list must never be empty");
const textApproval = approveUnifiedContentXhsLightRevision(store, { ...scope, planFactRef: { id: textPlan.plan.id, hash: textPlan.plan.factHash }, maxCredits: 8, approvedBy: "self-test", idempotencyKey: "light-approval-text" }, { featureFlags: flags, now: "2026-08-19T00:00:01.000Z" });

const jpegResult = await sharp({ create: { width: 1080, height: 1440, channels: 3, background: { r: 40, g: 80, b: 120 } } }).jpeg().toBuffer();
let providerCalls = 0; const requests = []; const writes = [];
const transport = async (request) => { providerCalls += 1; requests.push(request); return { status: "succeeded", taskId: `task-${providerCalls}`, bytes: providerCalls === 2 ? jpegResult : solidRgbaPng(1080, 1440, [40, 80, 120, 255]), cost: 2, costStatus: "measured" }; };
const textExecution = await executeUnifiedContentXhsLightRevision(store, { ...scope, planFactRef: { id: textPlan.plan.id, hash: textPlan.plan.factHash }, approvalFactRef: { id: textApproval.approval.id, hash: textApproval.approval.factHash }, idempotencyKey: "light-execution-text" }, { featureFlags: flags, transport, assetWriter: async (asset) => { writes.push(asset); return { relativePath: asset.relativePath }; }, now: () => "2026-08-19T00:00:02.000Z" });
assert.equal(textExecution.revision.revision, first.revision + 1);
assert.equal(requests[0].body.model, "gpt-image-2-text-to-image");
assert.equal(requests[0].body.input.image_urls, undefined);
assert.equal(writes.length, 2, "raw provider bytes and normalized PNG must both be retained");

const afterText = getUnifiedContentXhsLightRevisionState(store, { ...scope, providerPlanFactRef }, { featureFlags: flags });
assert.equal(afterText.approvals.some((item) => item.id === textApproval.approval.id), true, "state must expose approvals so the frontend can resume an approved plan after refresh");
const second = afterText.pageHeads[1];
const visualPlan = createUnifiedContentXhsLightRevisionPlan(store, { ...scope, providerPlanFactRef, targetPageId: second.pageId, baseRevisionRef: second.revisionRef, instruction: "保持全部文字和版式不变，把背景改成更克制的深蓝色", createdBy: "self-test", idempotencyKey: "light-plan-visual" }, { featureFlags: flags, now: "2026-08-19T00:00:03.000Z" });
assert.equal(visualPlan.plan.editMode, "image_edit");
assert.match(visualPlan.plan.compiledPrompt, /输入图片若含清单之外的文字，不得继承/);
const visualApproval = approveUnifiedContentXhsLightRevision(store, { ...scope, planFactRef: { id: visualPlan.plan.id, hash: visualPlan.plan.factHash }, maxCredits: 8, approvedBy: "self-test", idempotencyKey: "light-approval-visual" }, { featureFlags: flags, now: "2026-08-19T00:00:04.000Z" });
let uploads = 0;
const visualExecution = await executeUnifiedContentXhsLightRevision(store, { ...scope, planFactRef: { id: visualPlan.plan.id, hash: visualPlan.plan.factHash }, approvalFactRef: { id: visualApproval.approval.id, hash: visualApproval.approval.factHash }, idempotencyKey: "light-execution-visual" }, { featureFlags: flags, transport, assetReader: async () => ({ bytes: solidRgbaPng(1080, 1440) }), referenceUploader: async () => { uploads += 1; return { url: "https://temporary.example/base.png" }; }, assetWriter: async (asset) => ({ relativePath: asset.relativePath }), now: () => "2026-08-19T00:00:05.000Z" });
assert.equal(uploads, 1);
assert.equal(requests[1].body.model, "seedream/4.5-edit");
assert.deepEqual(requests[1].body.input.image_urls, ["https://temporary.example/base.png"]);
assert.equal(providerCalls, 2);
assert.equal(visualExecution.revision.rawAsset.mediaType, "image/jpeg");
assert.match(visualExecution.revision.normalizedAsset.relativePath, /\.png$/);

const beforeTwoPhase = getUnifiedContentXhsLightRevisionState(store, { ...scope, providerPlanFactRef }, { featureFlags: flags });
const twoPhaseBase = beforeTwoPhase.pageHeads[2];
const twoPhasePlan = createUnifiedContentXhsLightRevisionPlan(store, { ...scope, providerPlanFactRef, targetPageId: twoPhaseBase.pageId, baseRevisionRef: twoPhaseBase.revisionRef, instruction: "保持文字不变，只调整背景颜色", createdBy: "self-test", idempotencyKey: "light-plan-two-phase" }, { featureFlags: flags, now: "2026-08-19T00:00:05.100Z" });
const twoPhaseApproval = approveUnifiedContentXhsLightRevision(store, { ...scope, planFactRef: { id: twoPhasePlan.plan.id, hash: twoPhasePlan.plan.factHash }, maxCredits: 8, approvedBy: "self-test", idempotencyKey: "light-approval-two-phase" }, { featureFlags: flags, now: "2026-08-19T00:00:05.200Z" });
let twoPhaseSubmits = 0; let twoPhaseReads = 0;
const twoPhaseTransport = Object.assign(async () => { throw new Error("ONE_SHOT_TRANSPORT_FORBIDDEN"); }, {
  submit: async () => { twoPhaseSubmits += 1; return { status: "provider_task_created", taskId: "two-phase-task", creditsBefore: 100 }; },
  readResult: async () => { twoPhaseReads += 1; return twoPhaseReads === 1 ? { status: "processing", providerState: "generating", taskId: "two-phase-task" } : { status: "succeeded", taskId: "two-phase-task", bytes: jpegResult, cost: 2, costStatus: "provider_reported" }; }
});
const submitted = await submitUnifiedContentXhsLightRevision(store, { ...scope, planFactRef: { id: twoPhasePlan.plan.id, hash: twoPhasePlan.plan.factHash }, approvalFactRef: { id: twoPhaseApproval.approval.id, hash: twoPhaseApproval.approval.factHash }, idempotencyKey: "light-execution-two-phase" }, { featureFlags: flags, transport: twoPhaseTransport, assetReader: async () => ({ bytes: solidRgbaPng(1080, 1440) }), referenceUploader: async () => ({ url: "https://temporary.example/base.png" }), now: () => "2026-08-19T00:00:05.300Z" });
assert.equal(submitted.status, "processing");
assert.equal(submitted.execution.status, "provider_task_created");
assert.equal(submitted.execution.providerTaskId, "two-phase-task");
assert.equal(getUnifiedContentXhsLightRevisionState(store, { ...scope, providerPlanFactRef }, { featureFlags: flags }).pendingExecution.id, submitted.execution.id);
const submitReplay = await submitUnifiedContentXhsLightRevision(store, { ...scope, planFactRef: { id: twoPhasePlan.plan.id, hash: twoPhasePlan.plan.factHash }, approvalFactRef: { id: twoPhaseApproval.approval.id, hash: twoPhaseApproval.approval.factHash }, idempotencyKey: "light-execution-two-phase" }, { featureFlags: flags, transport: twoPhaseTransport, now: () => "2026-08-19T00:00:05.350Z" });
assert.equal(submitReplay.created, false);
assert.equal(twoPhaseSubmits, 1, "submission replay must never create a second provider task");
const continuationInput = { ...scope, executionFactRef: { id: submitted.execution.id, hash: submitted.execution.factHash }, executionId: submitted.execution.id };
const stillProcessing = await continueUnifiedContentXhsLightRevision(store, continuationInput, { featureFlags: flags, transport: twoPhaseTransport, assetWriter: async () => ({}), now: () => "2026-08-19T00:00:05.400Z" });
assert.equal(stillProcessing.status, "processing");
const completed = await continueUnifiedContentXhsLightRevision(store, continuationInput, { featureFlags: flags, transport: twoPhaseTransport, assetWriter: async () => ({}), now: () => "2026-08-19T00:00:05.500Z" });
assert.equal(completed.status, "succeeded");
assert.equal(completed.revision.revision, twoPhaseBase.revision + 1);
assert.equal(completed.completion.providerCalls, 0, "continuation only reads an existing provider task");
assert.equal(getUnifiedContentXhsLightRevisionState(store, { ...scope, providerPlanFactRef }, { featureFlags: flags }).pendingExecution, null);
const completedReplay = await continueUnifiedContentXhsLightRevision(store, continuationInput, { featureFlags: flags, transport: twoPhaseTransport, assetWriter: async () => ({}), now: () => "2026-08-19T00:00:05.600Z" });
assert.equal(completedReplay.created, false);
assert.equal(twoPhaseReads, 2, "completed continuation replay must not query provider again");

const current = getUnifiedContentXhsLightRevisionState(store, { ...scope, providerPlanFactRef }, { featureFlags: flags });
const confirmation = confirmUnifiedContentXhsHumanVisualSet(store, { ...scope, providerPlanFactRef, pageRevisionRefs: current.pageHeads.map((item) => item.revisionRef), confirmedBy: "self-test", versionLabel: "XHS-轻结构终稿", idempotencyKey: "light-confirmation" }, { featureFlags: flags, now: "2026-08-19T00:00:06.000Z" });
assert.equal(confirmation.versionTag.label, "XHS-轻结构终稿");
assert.equal(confirmation.confirmation.revisionSetHash, current.revisionSetHash);
assert.equal(confirmation.versionTag.immutable, true);
assert.equal(store.unifiedContentXhsPageRevisionFacts.some((item) => item.id === first.revisionRef.id && item.revisionHash === first.revisionRef.hash), true, "predecessor revision must remain immutable");
const artifactState = getUnifiedContentArtifactState(store, { ...scope, platform: "xiaohongshu" }, { featureFlags: flags });
assert.equal(artifactState.reviewStages?.skillVisualReview?.status, "human_confirmed");
assert.equal(artifactState.humanReviewOpen, true);

const checkpointStore = structuredClone(store);
const checkpointState = getUnifiedContentXhsLightRevisionState(checkpointStore, { ...scope, providerPlanFactRef }, { featureFlags: flags });
const third = checkpointState.pageHeads[2];
const checkpointPlan = createUnifiedContentXhsLightRevisionPlan(checkpointStore, { ...scope, providerPlanFactRef, targetPageId: third.pageId, baseRevisionRef: third.revisionRef, instruction: "只调整背景颜色", createdBy: "self-test", idempotencyKey: "light-plan-checkpoint" }, { featureFlags: flags, now: "2026-08-19T00:00:07.000Z" });
const checkpointApproval = approveUnifiedContentXhsLightRevision(checkpointStore, { ...scope, planFactRef: { id: checkpointPlan.plan.id, hash: checkpointPlan.plan.factHash }, maxCredits: 8, approvedBy: "self-test", idempotencyKey: "light-approval-checkpoint" }, { featureFlags: flags, now: "2026-08-19T00:00:08.000Z" });
const checkpointResult = await executeUnifiedContentXhsLightRevision(checkpointStore, { ...scope, planFactRef: { id: checkpointPlan.plan.id, hash: checkpointPlan.plan.factHash }, approvalFactRef: { id: checkpointApproval.approval.id, hash: checkpointApproval.approval.factHash }, idempotencyKey: "light-execution-checkpoint" }, { featureFlags: flags, transport: async () => ({ status: "succeeded", taskId: "paid-task-invalid-raster", bytes: Buffer.from("not-an-image"), cost: 2, costStatus: "measured" }), assetReader: async () => ({ bytes: solidRgbaPng(1080, 1440) }), referenceUploader: async () => ({ url: "https://temporary.example/base.png" }), assetWriter: async () => ({}), now: () => "2026-08-19T00:00:09.000Z" });
assert.equal(checkpointResult.status, "reconciliation_required");
assert.equal(checkpointResult.checkpoint.providerTaskId, "paid-task-invalid-raster");
assert.equal(checkpointResult.checkpoint.reason, "post_provider_artifact_processing_failed");
assert.equal(checkpointStore.unifiedContentXhsLightRevisionExecutions.at(-1).automaticRetries, 0);
assert.throws(() => createUnifiedContentXhsLightRevisionPlan(checkpointStore, { ...scope, providerPlanFactRef, targetPageId: third.pageId, baseRevisionRef: third.revisionRef, instruction: "再次调整背景颜色", createdBy: "self-test", idempotencyKey: "light-plan-forbidden-retry" }, { featureFlags: flags, now: "2026-08-19T00:00:09.500Z" }), /UNIFIED_XHS_LIGHT_RECONCILIATION_REQUIRED/);
const resolution = resolveUnifiedContentXhsLightRevisionCheckpoint(checkpointStore, { ...scope, checkpointFactRef: { id: checkpointResult.checkpoint.id, hash: checkpointResult.checkpoint.factHash }, decision: "abandoned", reason: "operator abandoned an unrecoverable provider result", resolvedBy: "self-test", idempotencyKey: "light-checkpoint-resolution" }, { featureFlags: flags, now: "2026-08-19T00:00:10.000Z" });
assert.equal(resolution.resolution.publicationPerformed, false);
assert.equal(checkpointStore.unifiedContentXhsLightRevisionCheckpoints.length > 0, true, "checkpoint history must remain append-only");
const afterResolution = getUnifiedContentXhsLightRevisionState(checkpointStore, { ...scope, providerPlanFactRef }, { featureFlags: flags });
assert.equal(afterResolution.unresolvedCheckpoints.length, 0);
assert.equal(afterResolution.resolutions.length, 1);
const replacementPlan = createUnifiedContentXhsLightRevisionPlan(checkpointStore, { ...scope, providerPlanFactRef, targetPageId: third.pageId, baseRevisionRef: third.revisionRef, instruction: "再次调整背景颜色", createdBy: "self-test", idempotencyKey: "light-plan-after-abandonment" }, { featureFlags: flags, now: "2026-08-19T00:00:11.000Z" });
assert.equal(replacementPlan.created, true);

console.log(JSON.stringify({ status: "passed", providerCalls, twoPhaseSubmits, twoPhaseReads, automaticRetries: 0, newRevisions: 3, jpegConverted: true, paidEffectCheckpointed: true, checkpointAbandonment: true, versionLabel: confirmation.versionTag.label }, null, 2));
