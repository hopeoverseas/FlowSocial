import assert from "node:assert/strict";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import {
  createUnifiedContentPlanningAttemptReceipt,
  createUnifiedContentPlanningSuccessBinding,
  finishUnifiedContentPlanningAttempt,
  recordUnifiedContentPlanningInvocation
} from "../../content-agent/unified-planning-attempt-receipt.mjs";

function evidenceCompiler() {
  return {
    resolveUniqueOutputFact: () => null,
    compileExecutionEvidence: () => ({ id: "evidence:fixture" }),
    commitCompletedInvocation: () => ({ id: "fact:fixture" })
  };
}

const store = {};
const persisted = [];
const attemptId = "planning-attempt:composition";
createUnifiedContentPlanningAttemptReceipt(store, {
  requestId: "request:composition", projectId: "project:composition", companyId: "company:composition"
}, { attemptId, now: () => "2026-08-10T02:00:00.000Z" });
const persist = async () => { persisted.push(structuredClone(store.unifiedContentPlanningAttemptReceipts[0])); };
await persist();

let runnerCalls = 0;
const execute = createUnifiedSkillActivityExecutor({
  generateText: async () => ({ mode: "offline_fixture" }),
  evidenceCompiler: evidenceCompiler(),
  attemptObserver: async (event) => {
    recordUnifiedContentPlanningInvocation(store, attemptId, event);
    await persist();
  },
  runner: async ({ capability, platform, generateText }) => {
    await generateText({ skill_runtime: { skill_name: capability } });
    assert.equal(persisted.at(-1).providerCallsStarted, runnerCalls + 1, "started receipt must persist before Provider runner entry");
    runnerCalls += 1;
    return { data: { capability, platform }, executionRecord: { attempt: 1 } };
  },
  runtimeOutputMaterializer: ({ runtimeOutput }) => runtimeOutput,
  domainInputValidator: () => {},
  domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
});

const plan = { schemaVersion: "1.0", steps: [] };
await execute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: { id: "content_master", capability: "build-content-master", outputContract: "ContentMaster@2.0" }, executionPlan: plan });
await execute({ capability: "generate-content-outline", platform: "xiaohongshu", input: {}, step: { id: "outline:xhs", capability: "generate-content-outline", outputContract: "ContentOutline@1.0" }, executionPlan: plan });
await execute({ capability: "generate-content-outline", platform: "wechat", input: {}, step: { id: "outline:wechat", capability: "generate-content-outline", outputContract: "ContentOutline@1.0" }, executionPlan: plan });
const publicBootstrap = {
  id: "bootstrap:composition",
  state: "awaiting_outline_confirmation",
  outlineRefs: {
    xiaohongshu: { id: "outline:xhs", hash: "a".repeat(64) },
    wechat: { id: "outline:wechat", hash: "b".repeat(64) }
  }
};
assert.equal(Object.hasOwn(publicBootstrap, "planningRef"), false);
finishUnifiedContentPlanningAttempt(store, attemptId, {
  status: "succeeded", ...createUnifiedContentPlanningSuccessBinding(publicBootstrap)
});
await persist();
assert.deepEqual([store.unifiedContentPlanningAttemptReceipts[0].providerCallsStarted, store.unifiedContentPlanningAttemptReceipts[0].providerCallsCompleted], [3, 3]);
assert.equal(persisted.at(-1).status, "succeeded", "terminal receipt must persist before HTTP projection");

const failureStore = {};
createUnifiedContentPlanningAttemptReceipt(failureStore, {
  requestId: "request:failure", projectId: "project:failure", companyId: "company:failure"
}, { attemptId: "planning-attempt:composition-failure" });
const failureSnapshots = [];
const failingExecute = createUnifiedSkillActivityExecutor({
  generateText: async () => { throw Object.assign(new Error("private Provider failure"), { code: "MODEL_TIMEOUT", details: { secret: "sk-private" } }); },
  evidenceCompiler: evidenceCompiler(),
  attemptObserver: async (event) => {
    recordUnifiedContentPlanningInvocation(failureStore, "planning-attempt:composition-failure", event);
    failureSnapshots.push(structuredClone(failureStore.unifiedContentPlanningAttemptReceipts[0]));
  },
  runner: async ({ generateText }) => generateText({ skill_runtime: { skill_name: "build-content-master" } }),
  domainInputValidator: () => {}
});
await assert.rejects(
  () => failingExecute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: { id: "content_master", capability: "build-content-master", outputContract: "ContentMaster@2.0" }, executionPlan: plan }),
  (error) => error.code === "MODEL_TIMEOUT"
);
finishUnifiedContentPlanningAttempt(failureStore, "planning-attempt:composition-failure", {
  status: "failed", failure: { causeCode: "MODEL_TIMEOUT", failureClass: "timeout", retryable: true, stage: "master", stepId: "content_master" }
});
failureSnapshots.push(structuredClone(failureStore.unifiedContentPlanningAttemptReceipts[0]));
assert.deepEqual([failureStore.unifiedContentPlanningAttemptReceipts[0].providerCallsStarted, failureStore.unifiedContentPlanningAttemptReceipts[0].providerCallsFailed], [1, 1]);
assert.equal(JSON.stringify(failureStore).includes("private Provider failure"), false);
assert.equal(JSON.stringify(failureStore).includes("sk-private"), false);

console.log(JSON.stringify({
  status: "planning-attempt-receipt-composition-self-test passed",
  offlinePlanningInvocations: runnerCalls,
  realProviderCalls: 0,
  retries: 0,
  networkCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
