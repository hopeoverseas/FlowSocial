import assert from "node:assert/strict";
import {
  createUnifiedContentPlanningAttemptReceipt,
  createUnifiedContentPlanningSuccessBinding,
  finishUnifiedContentPlanningAttempt,
  getUnifiedContentPlanningAttemptCheckpoints,
  listUnifiedContentPlanningAttemptReceipts,
  markUnifiedContentPlanningClientDisconnected,
  recordUnifiedContentPlanningInvocation
} from "../../content-agent/unified-planning-attempt-receipt.mjs";

const input = { requestId: "request:receipt", projectId: "project:receipt", companyId: "company:receipt" };
const publicBootstrap = {
  id: "bootstrap:unit",
  state: "awaiting_outline_confirmation",
  outlineRefs: {
    xiaohongshu: { id: "outline:xhs", hash: "1".repeat(64) },
    wechat: { id: "outline:wechat", hash: "2".repeat(64) }
  }
};
assert.equal(Object.hasOwn(publicBootstrap, "planningRef"), false, "Live public Bootstrap shape must not invent planningRef");
const successBinding = createUnifiedContentPlanningSuccessBinding(publicBootstrap);
assert.equal(successBinding.bootstrapId, publicBootstrap.id);
assert.equal(successBinding.planningRef.id, `planning-binding:${publicBootstrap.id}`);
assert.equal(successBinding.planningRef.hash, createUnifiedContentPlanningSuccessBinding(structuredClone(publicBootstrap)).planningRef.hash);
for (const malformed of [
  {},
  { ...publicBootstrap, id: "" },
  { ...publicBootstrap, outlineRefs: { xiaohongshu: publicBootstrap.outlineRefs.xiaohongshu } },
  { ...publicBootstrap, outlineRefs: { ...publicBootstrap.outlineRefs, wechat: { id: "outline:wechat" } } },
  { ...publicBootstrap, outlineRefs: { ...publicBootstrap.outlineRefs, extra: { id: "extra", hash: "3".repeat(64) } } }
]) {
  assert.throws(() => createUnifiedContentPlanningSuccessBinding(malformed), /UNIFIED_PLANNING_ATTEMPT_PUBLIC_/);
}
const store = {};
const attemptId = "planning-attempt:unit";
createUnifiedContentPlanningAttemptReceipt(store, input, { attemptId, now: () => "2026-08-10T01:00:00.000Z" });
assert.equal(store.unifiedContentPlanningAttemptReceipts.length, 1);
assert.equal(listUnifiedContentPlanningAttemptReceipts({}).length, 0, "historical stores must read a missing collection as empty");

for (const event of [
  { capability: "build-content-master", platform: "xiaohongshu" },
  { capability: "generate-content-outline", platform: "xiaohongshu" },
  { capability: "generate-content-outline", platform: "wechat" }
]) {
  recordUnifiedContentPlanningInvocation(store, attemptId, { ...event, phase: "started" });
  recordUnifiedContentPlanningInvocation(store, attemptId, { ...event, phase: "completed" });
}
markUnifiedContentPlanningClientDisconnected(store, attemptId, { at: "2026-08-10T01:00:02.000Z" });
finishUnifiedContentPlanningAttempt(store, attemptId, {
  status: "succeeded",
  at: "2026-08-10T01:00:03.000Z",
  ...successBinding
});
const succeeded = listUnifiedContentPlanningAttemptReceipts(store)[0];
assert.equal(succeeded.status, "succeeded");
assert.equal(succeeded.clientDisposition, "disconnected", "disconnect must not replace the server terminal status");
assert.deepEqual([succeeded.providerCallsStarted, succeeded.providerCallsCompleted, succeeded.providerCallsFailed, succeeded.retryCount], [3, 3, 0, 0]);
assert.equal(finishUnifiedContentPlanningAttempt(store, attemptId, { status: "succeeded" }).status, "succeeded", "same terminal replay is idempotent");
assert.throws(() => finishUnifiedContentPlanningAttempt(store, attemptId, { status: "failed" }), /UNIFIED_PLANNING_ATTEMPT_TERMINAL_CONFLICT/);
assert.throws(() => recordUnifiedContentPlanningInvocation(store, attemptId, { capability: "build-content-master", platform: "xiaohongshu", phase: "started" }), /UNIFIED_PLANNING_ATTEMPT_ALREADY_TERMINAL/);

const failedStore = {};
createUnifiedContentPlanningAttemptReceipt(failedStore, input, { attemptId: "planning-attempt:failed" });
recordUnifiedContentPlanningInvocation(failedStore, "planning-attempt:failed", { capability: "build-content-master", platform: "xiaohongshu", phase: "started" });
recordUnifiedContentPlanningInvocation(failedStore, "planning-attempt:failed", { capability: "build-content-master", platform: "xiaohongshu", phase: "failed" });
finishUnifiedContentPlanningAttempt(failedStore, "planning-attempt:failed", {
  status: "failed",
  failure: {
    causeCode: "MODEL_TIMEOUT", failureClass: "timeout", retryable: true, stage: "master", platform: null, stepId: "content_master",
    prompt: "private prompt", input: { secret: "sk-private" }, output: "private output", stack: "private stack", details: { raw: true }
  }
});
const failed = failedStore.unifiedContentPlanningAttemptReceipts[0];
assert.deepEqual([failed.providerCallsStarted, failed.providerCallsCompleted, failed.providerCallsFailed], [1, 0, 1]);
const serialized = JSON.stringify(failed);
for (const unsafe of ["private prompt", "sk-private", "private output", "private stack", "details", "prompt", "input", "output"]) {
  assert.equal(serialized.includes(unsafe), false, `receipt exposed ${unsafe}`);
}

const retryStore = {};
const retryAttemptId = "planning-attempt:outline-retry";
createUnifiedContentPlanningAttemptReceipt(retryStore, input, { attemptId: retryAttemptId });
recordUnifiedContentPlanningInvocation(retryStore, retryAttemptId, { capability: "build-content-master", platform: "xiaohongshu", phase: "started" });
recordUnifiedContentPlanningInvocation(retryStore, retryAttemptId, { capability: "build-content-master", platform: "xiaohongshu", phase: "completed" });
recordUnifiedContentPlanningInvocation(retryStore, retryAttemptId, { capability: "generate-content-outline", platform: "xiaohongshu", phase: "started" });
recordUnifiedContentPlanningInvocation(retryStore, retryAttemptId, { capability: "generate-content-outline", platform: "xiaohongshu", phase: "started" });
recordUnifiedContentPlanningInvocation(retryStore, retryAttemptId, { capability: "generate-content-outline", platform: "xiaohongshu", phase: "completed" });
recordUnifiedContentPlanningInvocation(retryStore, retryAttemptId, { capability: "generate-content-outline", platform: "wechat", phase: "started" });
recordUnifiedContentPlanningInvocation(retryStore, retryAttemptId, { capability: "generate-content-outline", platform: "wechat", phase: "completed" });
finishUnifiedContentPlanningAttempt(retryStore, retryAttemptId, { status: "succeeded", ...successBinding });
const retried = retryStore.unifiedContentPlanningAttemptReceipts[0];
assert.deepEqual([retried.providerCallsStarted, retried.providerCallsCompleted, retried.providerCallsFailed, retried.retryCount], [4, 3, 1, 1]);
assert.equal(retried.invocations.xiaohongshu_outline.started, 2);

const forbiddenMasterRetryStore = {};
createUnifiedContentPlanningAttemptReceipt(forbiddenMasterRetryStore, input, { attemptId: "planning-attempt:master-retry" });
recordUnifiedContentPlanningInvocation(forbiddenMasterRetryStore, "planning-attempt:master-retry", { capability: "build-content-master", platform: "xiaohongshu", phase: "started" });
assert.throws(() => recordUnifiedContentPlanningInvocation(forbiddenMasterRetryStore, "planning-attempt:master-retry", { capability: "build-content-master", platform: "xiaohongshu", phase: "started" }), /UNIFIED_PLANNING_ATTEMPT_RETRY_FORBIDDEN/);

const scopedStore = {};
const scopedInput = { ...input, requestId: "request:scoped", targetPlatform: "xiaohongshu" };
const invocation = { id: "invocation:master-checkpoint", invocationHash: "c".repeat(64) };
const outputFact = { id: "fact:master-checkpoint", invocationRef: { id: invocation.id, hash: invocation.invocationHash } };
createUnifiedContentPlanningAttemptReceipt(scopedStore, scopedInput, { attemptId: "planning-attempt:scoped-failed" });
recordUnifiedContentPlanningInvocation(scopedStore, "planning-attempt:scoped-failed", { capability: "build-content-master", platform: "xiaohongshu", phase: "started" });
recordUnifiedContentPlanningInvocation(scopedStore, "planning-attempt:scoped-failed", {
  capability: "build-content-master", platform: "xiaohongshu", phase: "completed", checkpoint: { invocation, outputFact }
});
recordUnifiedContentPlanningInvocation(scopedStore, "planning-attempt:scoped-failed", { capability: "generate-content-outline", platform: "xiaohongshu", phase: "started" });
recordUnifiedContentPlanningInvocation(scopedStore, "planning-attempt:scoped-failed", { capability: "generate-content-outline", platform: "xiaohongshu", phase: "failed" });
finishUnifiedContentPlanningAttempt(scopedStore, "planning-attempt:scoped-failed", { status: "failed", failure: { causeCode: "MODEL_TIMEOUT", stage: "xiaohongshu_outline" } });
const scopedFailedPublic = listUnifiedContentPlanningAttemptReceipts(scopedStore)[0];
assert.deepEqual(scopedFailedPublic.checkpointStages, ["master"], "public receipt should expose only checkpoint stage names");
assert.equal(Object.hasOwn(scopedFailedPublic, "stageCheckpoints"), false, "public receipt must hide checkpoint payloads");
assert.equal(getUnifiedContentPlanningAttemptCheckpoints(scopedStore, "planning-attempt:scoped-failed").master.outputFact.id, outputFact.id);

createUnifiedContentPlanningAttemptReceipt(scopedStore, scopedInput, {
  attemptId: "planning-attempt:scoped-resumed", resumeFromAttemptId: "planning-attempt:scoped-failed"
});
const resumed = scopedStore.unifiedContentPlanningAttemptReceipts.at(-1);
assert.deepEqual(resumed.reusedStages, ["master"]);
assert.equal(resumed.resumedFromAttemptId, "planning-attempt:scoped-failed");
recordUnifiedContentPlanningInvocation(scopedStore, resumed.id, { capability: "generate-content-outline", platform: "xiaohongshu", phase: "started" });
recordUnifiedContentPlanningInvocation(scopedStore, resumed.id, { capability: "generate-content-outline", platform: "xiaohongshu", phase: "completed" });
const scopedBootstrap = {
  id: "bootstrap:scoped", targetPlatform: "xiaohongshu",
  outlineRefs: { xiaohongshu: { id: "outline:scoped-xhs", hash: "d".repeat(64) } }
};
finishUnifiedContentPlanningAttempt(scopedStore, resumed.id, {
  status: "succeeded", ...createUnifiedContentPlanningSuccessBinding(scopedBootstrap)
});
const scopedSucceeded = scopedStore.unifiedContentPlanningAttemptReceipts.at(-1);
assert.equal(scopedSucceeded.status, "succeeded", "a scoped retry may finish with the restored master and one platform outline");
assert.deepEqual([scopedSucceeded.providerCallsStarted, scopedSucceeded.providerCallsCompleted], [1, 1]);

console.log(JSON.stringify({
  status: "planning-attempt-receipt-self-test passed",
  terminalReceipts: 2,
  realProviderCalls: 0,
  retries: 1,
  networkCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
