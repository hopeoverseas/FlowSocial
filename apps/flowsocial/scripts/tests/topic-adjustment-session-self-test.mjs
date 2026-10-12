import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adoptTopicAdjustmentCandidate, continueTopicAdjustmentSession, startTopicAdjustmentSession } from "../../content-agent/topic-adjustment-session.mjs";
import { cycleConfirmationHash } from "../../content-agent/cycle-workbench.mjs";

const slot = {
  slotId: "slot_topic_1", zone: "committed", state: "committed", topic: "企业如何建设智能知识库",
  socialAccountId: "account_xhs", accountName: "企业号", platform: "xiaohongshu", scheduledFor: "2026-09-02",
  targetWindow: { start: "2026-09-02", end: "2026-09-02" }, strategySnapshotId: "strategy_1", strategyVersion: 1,
  growthPlaybookId: "xhs-company-vertical-cold-start", playbookVersion: "1", learningLane: "explore", contentFunction: "authority",
  contentPillar: "企业数字化", contentRunId: null
};
const plan = {
  cycleId: "cycle_topic_1", companyId: "company_1", status: "active", workbenchStatus: "active", confirmation: { planHash: "old" },
  strategySnapshotId: "strategy_1", strategyVersion: 1, cycleStart: "2026-09-01", cycleEnd: "2026-09-07", userDecisions: [],
  slots: [slot, { ...slot, slotId: "slot_topic_2", topic: "销售团队如何跟进高意向客户", scheduledFor: "2026-09-04" }],
  nextCycleContentPortfolios: [{ id: "portfolio_1" }], slotEvents: []
};
plan.confirmationPreviewHash = cycleConfirmationHash(plan);
const store = { publishingCyclePlans: [plan], contentTasks: [{ ideaTitle: "制造业客户知识沉淀方法" }], unifiedContentOpportunities: [] };

const beforeStart = JSON.stringify(plan);
const session = startTopicAdjustmentSession(store, { cycleId: plan.cycleId, slotId: slot.slotId });
assert.equal(JSON.stringify(plan), beforeStart, "opening a topic dialogue must not mutate the plan");
assert.deepEqual(session.context.immutableFields, ["scheduledFor", "targetWindow", "socialAccountId", "platform", "strategySnapshotId", "learningLane"]);

let calls = 0;
const beforeMessage = JSON.stringify(plan);
const result = await continueTopicAdjustmentSession(store, session.sessionId, { message: "更聚焦外贸企业的销售跟进场景" }, {
  invokeModel: async () => {
    calls += 1;
    return { mode: "live", telemetry: { traceId: "trace_topic_1", attempts: 1, retryCount: 0 }, data: {
      assistantMessage: "给出三个只改变选题方向的候选。",
      candidates: [
        { topic: "销售团队如何跟进高意向客户", angle: "重复候选", difference: "与本批相同", reason: "测试去重" },
        { topic: "外贸企业拿到询盘后，销售跟进最容易断在哪一步", angle: "销售跟进断点", difference: "从知识库转到具体业务场景", reason: "问题更具体" },
        { topic: "外贸询盘7天跟进路径：从首次回复到需求确认", angle: "时间路径", difference: "改为流程型选题", reason: "行动更清晰" }
      ]
    } };
  }
});
assert.equal(calls, 1, "one user message must authorize exactly one model invocation");
assert.equal(result.turn.model.retryCount, 0);
assert.equal(result.candidates.length, 3, "each response must expose three reviewable candidates");
assert.equal(JSON.stringify(plan), beforeMessage, "chat and candidate generation must not mutate the plan");
assert.equal(result.candidates[0].duplication.decision, "block");
assert.ok(result.candidates.slice(1).some((item) => item.duplication.decision !== "block"));

const selected = result.candidates.find((item) => item.duplication.decision === "allow");
assert.ok(selected);
const beforeRejectedAdoption = JSON.stringify(plan);
assert.throws(() => adoptTopicAdjustmentCandidate(store, session.sessionId, selected.candidateId, {
  candidateHash: selected.candidateHash, expectedPlanHash: cycleConfirmationHash(plan), userConfirmed: false
}), (error) => error.code === "TOPIC_ADJUSTMENT_EXACT_SELECTION_REQUIRED");
assert.equal(JSON.stringify(plan), beforeRejectedAdoption, "failed confirmation must perform zero plan writes");

const immutableBefore = Object.fromEntries(session.context.immutableFields.map((key) => [key, structuredClone(slot[key])]));
const adopted = adoptTopicAdjustmentCandidate(store, session.sessionId, selected.candidateId, {
  candidateHash: selected.candidateHash, expectedPlanHash: cycleConfirmationHash(plan), userConfirmed: true, actor: "tester"
});
assert.equal(adopted.slot.topic, selected.topic);
assert.equal(adopted.plan.status, "draft");
assert.equal(adopted.plan.workbenchStatus, "awaiting_confirmation");
assert.equal(adopted.plan.confirmation, null);
for (const [key, value] of Object.entries(immutableBefore)) assert.deepEqual(adopted.slot[key], value, `${key} must remain immutable`);
assert.equal(adopted.plan.slotEvents.at(-1).type, "topic_adjustment_candidate_adopted");
assert.equal(adopted.session.status, "adopted");

const discussionSession = startTopicAdjustmentSession(store, { cycleId: plan.cycleId, slotId: "slot_topic_2" });
const planBeforeDiscussion = JSON.stringify(plan);
const discussion = await continueTopicAdjustmentSession(store, discussionSession.sessionId, { message: "我想先探讨一下，为什么要聚焦销售跟进？" }, {
  invokeModel: async () => ({ mode: "live", telemetry: { attempts: 1, retryCount: 0 }, data: {
    conversationMode: "discussion", assistantMessage: "可以先比较销售跟进与首次回复两个场景的业务价值。", candidates: []
  } })
});
assert.equal(discussion.turn.conversationMode, "discussion");
assert.deepEqual(discussion.candidates, [], "exploratory discussion must not produce topic candidates");
assert.equal(JSON.stringify(plan), planBeforeDiscussion, "discussion must not mutate the plan");
const unavailable = await continueTopicAdjustmentSession(store, discussionSession.sessionId, { message: "我只是补充背景，不要把这句话当题目" }, {
  invokeModel: async (_request, fallback) => ({ mode: "validated_fallback", telemetry: { attempts: 1, retryCount: 0 }, data: fallback })
});
assert.equal(unavailable.turn.conversationMode, "provider_unavailable");
assert.deepEqual(unavailable.candidates, [], "provider fallback must never fabricate a candidate from user text");
assert.ok(unavailable.turn.assistantMessage.includes("没有把你的表达当成题目"));
assert.equal(JSON.stringify(plan), planBeforeDiscussion, "provider failure must not mutate the plan");

const app = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../../ui/topic-adjustment-workbench.js", import.meta.url), "utf8");
const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const adjustStart = app.indexOf("async function adjustV2CycleSlot");
const adjustEnd = app.indexOf("async function startV2Run", adjustStart);
const adjustFunction = app.slice(adjustStart, adjustEnd);
assert.ok(adjustFunction.includes("FlowTopicAdjustmentWorkbench.open"));
assert.ok(!adjustFunction.includes("window.prompt"));
for (const marker of ["采用这个选题", "仅调整选题方向", "expectedPlanHash", "userConfirmed: true"]) assert.ok(`${ui}${markup}`.includes(marker), `missing UI gate: ${marker}`);
for (const marker of ["不会把你说的每句话直接当成题目", "生成 3 个候选", "先和 AI 探讨"]) assert.ok(`${ui}${markup}`.includes(marker), `missing discussion-first UI: ${marker}`);
assert.match(markup, /<dialog id="topicAdjustmentDialog"[\s\S]*?<form method="dialog">/);
assert.doesNotMatch(markup, /<dialog id="topicAdjustmentDialog"[\s\S]*?<form[^>]+onsubmit="return false"/);

console.log("topic-adjustment-session-self-test: ok");
