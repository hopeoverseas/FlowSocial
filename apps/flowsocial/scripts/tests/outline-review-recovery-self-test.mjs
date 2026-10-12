import assert from "node:assert/strict";
import { normalizeOutline } from "../../content-agent/outline-engine.mjs";
import {
  beginOutline,
  confirmOutline,
  createContentWorkflow,
  saveEditedOutline,
  saveGeneratedOutline
} from "../../content-agent/workflow-engine.mjs";

const contentMaster = {
  confirmed_facts: [{ fact_id: "F1", fact: "已确认事实" }]
};
const fallback = {
  data: {
    outline_id: "outline_fallback",
    platform: "xiaohongshu",
    topic: "测试主题",
    content_promise: "测试承诺",
    opening_strategy: "测试开头"
  }
};
const normalized = normalizeOutline({
  outline_id: "outline_model",
  sections: [
    { section_id: "S1", heading: "开头", claim_ids: ["F1", "O_UNKNOWN"] },
    { section_id: "S2", heading: "分析", claim_ids: [] },
    { section_id: "S3", heading: "行动", claim_ids: ["O_UNKNOWN"] }
  ]
}, fallback, contentMaster);

assert.equal(normalized.validation.valid, true, "sanitized outline should remain confirmable");
assert.deepEqual(normalized.validation.invalidClaimIds, []);
assert.deepEqual(normalized.validation.removedClaimIds, ["O_UNKNOWN"]);
assert.deepEqual(normalized.outline.sections[0].claim_ids, ["F1"]);
assert.deepEqual(normalized.outline.sections[2].claim_ids, []);
assert.match(normalized.validation.warnings[0], /O_UNKNOWN/);

const store = {};
const workflow = createContentWorkflow(store, {
  accountId: "acc_xhs",
  recommendation: { id: "rec_review", topic: "测试主题" },
  generationPayload: {
    ideaTitle: "测试主题",
    platform: "xiaohongshu",
    contentPurposeId: "knowledge_howto",
    contentTaskBrief: { topic: "测试主题" },
    contentSourcePlan: { mode: "user_material" }
  }
});
beginOutline(workflow);
saveGeneratedOutline(workflow, {
  status: "needs_review",
  contentMaster,
  outline: normalized.outline,
  validation: { valid: false, invalidClaimIds: ["O_UNKNOWN"], errors: ["outline references unknown claims"] },
  skillTraces: []
});
assert.equal(workflow.state, "needs_review", "fixture must reproduce the historical deadlock state");

saveEditedOutline(workflow, workflow.outline);
assert.equal(workflow.state, "outline_ready", "saving the sanitized historical outline must recover it");
confirmOutline(workflow);
assert.equal(workflow.state, "outline_confirmed");

const fallbackWorkflow = createContentWorkflow(store, {
  accountId: "acc_wechat",
  recommendation: { id: "rec_fallback", topic: "公众号兜底大纲" },
  generationPayload: { ideaTitle: "公众号兜底大纲", platform: "wechat", contentPurposeId: "professional_opinion", contentTaskBrief: {}, contentSourcePlan: { mode: "knowledge_base" } }
});
beginOutline(fallbackWorkflow);
saveGeneratedOutline(fallbackWorkflow, {
  status: "needs_review",
  contentMaster,
  outline: normalized.outline,
  validation: { valid: true, invalidClaimIds: [], removedClaimIds: [], warnings: [], errors: [] },
  skillTraces: [{ errorCode: "MODEL_CONNECTION_ERROR", fallbackUsed: true }]
});
assert.equal(fallbackWorkflow.state, "needs_review", "a structurally valid provider fallback must remain reviewable instead of becoming blocked");

console.log(JSON.stringify({
  status: "outline-review-recovery-self-test passed",
  removedClaimIds: normalized.validation.removedClaimIds,
  recoveredState: workflow.state
}, null, 2));
