import assert from "node:assert/strict";
import {
  beginContentGeneration,
  beginOutline,
  completeContentGeneration,
  confirmOutline,
  createContentWorkflow,
  saveEditedOutline,
  saveGeneratedOutline
} from "../../content-agent/workflow-engine.mjs";

const store = {};
const workflow = createContentWorkflow(store, {
  accountId: "account_1",
  recommendation: { id: "rec_1", topic: "企业内容为什么总是断更", contentPillar: "内容系统", contentRole: "trust" },
  generationPayload: {
    ideaTitle: "企业内容为什么总是断更",
    platform: "xiaohongshu",
    contentPurposeId: "knowledge_howto",
    contentTaskBrief: { topic: "企业内容为什么总是断更" },
    contentSourcePlan: { mode: "knowledge_base" }
  }
});

assert.equal(workflow.state, "direction_selected");
assert.throws(() => beginContentGeneration(workflow), /not allowed/);

beginOutline(workflow);
assert.equal(workflow.state, "outline_drafting");
saveGeneratedOutline(workflow, {
  status: "outline_ready",
  contentMaster: { confirmed_facts: [{ fact_id: "F1", fact: "已有内容发布记录" }] },
  outline: {
    outline_id: "outline_1",
    topic: workflow.directionCard.topic,
    content_promise: "帮助团队建立稳定内容系统",
    opening_strategy: "从断更场景进入",
    sections: [
      { section_id: "S1", heading: "问题", role: "problem", objective: "说明断更表现", key_points: [], claim_ids: ["F1"] },
      { section_id: "S2", heading: "原因", role: "diagnosis", objective: "拆解依赖灵感", key_points: [], claim_ids: [] },
      { section_id: "S3", heading: "方法", role: "method", objective: "建立系统", key_points: [], claim_ids: [] }
    ],
    closing_strategy: "给出下一步",
    confirmation_required: true
  },
  validation: { valid: true, invalidClaimIds: [], errors: [] },
  skillTraces: []
});
assert.equal(workflow.state, "outline_ready");

confirmOutline(workflow);
assert.equal(workflow.state, "outline_confirmed");
const confirmedRevision = workflow.confirmedOutlineRevision;

saveEditedOutline(workflow, { ...workflow.outline, content_promise: "修改后的内容承诺" });
assert.equal(workflow.state, "outline_ready", "editing must invalidate confirmation");
assert.equal(workflow.outlineConfirmedAt, null);
assert.ok(workflow.outlineRevision > confirmedRevision);

confirmOutline(workflow);
beginContentGeneration(workflow);
assert.equal(workflow.state, "generating");
completeContentGeneration(workflow, { id: "content_1", status: "succeeded" });
assert.equal(workflow.state, "content_ready");
assert.equal(workflow.contentTaskId, "content_1");
assert.throws(() => saveEditedOutline(workflow, workflow.outline), /not allowed/);

console.log(JSON.stringify({
  status: "content-workflow-state-self-test passed",
  transitions: workflow.events.map((item) => item.type),
  confirmationInvalidatedAfterEdit: true,
  generationGuarded: true,
  finalState: workflow.state
}, null, 2));

