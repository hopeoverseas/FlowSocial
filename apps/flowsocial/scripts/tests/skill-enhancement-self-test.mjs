import assert from "node:assert/strict";
import { analyzeViralWithSkill } from "../../content-agent/viral-skill-adapter.mjs";
import { createCaseDrivenEvaluationSuite, evaluateContentSkillOutput } from "../../content-agent/content-skill-evaluation.mjs";
import { proposeNaturalization } from "../../content-agent/naturalization-engine.mjs";
import { reviewRenderedXhsTask } from "../../content-agent/visual-review-engine.mjs";

let received;
const generateText = async (request, fallback) => { received = request; return { mode: "test_fallback", data: fallback }; };
const viral = await analyzeViralWithSkill({ payload: { platform: "xiaohongshu", title: "Test", rawText: "Body" }, legacyAnalysis: { id: "a1", referencePostId: "r1", blueprint: {} }, scope: { workspaceId: "w1" }, generateText });
assert.equal(received.skill_runtime.skill_name, "analyze-viral-content");
assert.equal(viral.analysis.kind, "ViralContentAnalysis");
assert.equal(viral.skillTrace.skillName, "analyze-viral-content");

const suite = createCaseDrivenEvaluationSuite([{ id: "a1", status: "approved", sourceReferenceIds: ["r1"], blueprintCandidate: { platform: "xiaohongshu", titleMechanisms: ["pain point"], structureRules: ["checklist"] }, doNotCopy: ["unique original sentence"] }]);
assert.equal(suite.cases.length, 3);
const evaluation = evaluateContentSkillOutput(suite.cases[0], { title: "Pain point checklist" });
assert.notEqual(evaluation.decision, "fail");

await assert.rejects(() => proposeNaturalization({ platform: "wechat" }, { mode: "rewrite_copy_only", text: "Text", editableRanges: [{ start: 0, end: 4 }] }, { generateText }), /authorization/i);
const audit = await proposeNaturalization({ platform: "wechat", contentMaster: {} }, { mode: "audit_only", text: "Text" }, { generateText });
assert.equal(audit.data.revised_text, null);

const pending = await reviewRenderedXhsTask({ platform: "xiaohongshu", delivery: null }, { root: process.cwd(), generateText });
assert.equal(pending.status, "pending_render");
console.log(JSON.stringify({ status: "passed", viralSkill: viral.skillTrace.skillName, evaluationCases: suite.cases.length, naturalizationApplied: audit.applied, visualReview: pending.status }));

