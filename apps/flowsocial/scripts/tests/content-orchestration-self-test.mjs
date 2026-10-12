import assert from "node:assert/strict";
import { runContentGates } from "../../content-agent/gate-engine.mjs";
import { buildContentHistoryIndex } from "../../content-agent/history-index.mjs";
import { applyValidatedPatch } from "../../content-agent/patch-engine.mjs";
import { recordPublication, recordPublicationMetrics } from "../../content-agent/publishing-feedback.mjs";
import { listSkillAdapters, resolveSkillAdapter } from "../../content-agent/skill-adapter-registry.mjs";
import { beginOutline, createContentRun } from "../../content-agent/workflow-engine.mjs";

const store = { contentTasks: [] };
const modes = ["content_agent_recommended", "idea", "custom"];
const runs = modes.map((sourceType) => createContentRun(store, {
  accountId: "account_1",
  recommendation: { id: `direction_${sourceType}`, topic: `${sourceType} direction` },
  generationPayload: {
    sourceType,
    ideaTitle: `${sourceType} direction`,
    platform: "xiaohongshu",
    contentPurposeId: "knowledge_howto",
    contentTaskBrief: { topic: `${sourceType} direction` }
  }
}));
assert.deepEqual(runs.map((item) => item.entryMode), modes);
assert.ok(runs.every((item) => item.kind === "ContentRun"));
assert.equal(store.contentRuns, store.contentWorkflows);
assert.ok(runs.every((item) => item.sourceTrace.decisions.length === 4));
assert.ok(runs.every((item) => item.featureFlags.viralLearningV1 === false));

const approvedBlueprint = {
  id: "blueprint_reviewed_1", familyId: "family_1", version: 1, lifecycle: "approved", productionReady: true,
  approvedBy: "reviewer_1", approvedAt: "2026-07-29T08:00:00.000Z", platform: "xiaohongshu",
  structureRules: ["问题", "判断", "行动"], prohibitedUses: ["原文措辞", "原图"]
};
const blueprintRun = createContentRun(store, {
  accountId: "account_1",
  recommendation: { id: "direction_blueprint", topic: "审核蓝图方向" },
  generationPayload: {
    sourceType: "content_agent_recommended", ideaTitle: "审核蓝图方向", platform: "xiaohongshu", contentTaskBrief: { topic: "审核蓝图方向" },
    contentSourcePlan: { mode: "viral_blueprint", sources: [{ type: "viral_blueprint", required: false, candidateIds: [approvedBlueprint.id], assets: [approvedBlueprint] }] }
  }
});
assert.equal(blueprintRun.generationPayload.contentPatternSnapshot.kind, "ContentPatternSnapshot");
assert.equal(blueprintRun.generationPayload.contentPatternSnapshot.policy.structureOnly, true);
assert.equal(blueprintRun.generationPayload.contentPatternSnapshot.policy.businessFactsAllowed, false);
assert.deepEqual(blueprintRun.generationPayload.contentPatternSnapshot.blueprintVersions[0].prohibitedUses, ["原文措辞", "原图"]);

const candidateRun = createContentRun(store, {
  accountId: "account_1",
  recommendation: { id: "direction_candidate", topic: "未审核候选方向" },
  generationPayload: {
    sourceType: "content_agent_recommended", ideaTitle: "未审核候选方向", platform: "xiaohongshu", contentTaskBrief: { topic: "未审核候选方向" },
    contentSourcePlan: { mode: "viral_blueprint", sources: [{ type: "viral_blueprint", required: false, candidateIds: ["blueprint_candidate_1"], assets: [{ ...approvedBlueprint, id: "blueprint_candidate_1", lifecycle: "candidate", productionReady: false, approvedBy: null, approvedAt: null }] }] }
  }
});
assert.equal(candidateRun.generationPayload.contentPatternSnapshot, null);
assert.throws(() => beginOutline(candidateRun), (error) => error.code === "CONTENT_PATTERN_SNAPSHOT_REQUIRED");

const rawReferenceRun = createContentRun(store, {
  accountId: "account_1",
  recommendation: { id: "direction_reference", topic: "参考帖方向" },
  generationPayload: {
    sourceType: "content_agent_recommended", ideaTitle: "参考帖方向", platform: "xiaohongshu", contentTaskBrief: { topic: "参考帖方向" },
    contentSourcePlan: { mode: "mixed", sources: [{ type: "reference_post", required: false, candidateIds: [], analysisCandidateIds: ["reference_1"] }, { type: "knowledge_base", required: true, candidateIds: ["knowledge_1"] }] }
  }
});
assert.equal(rawReferenceRun.skillExecutionPlan.referenceAnalysisTrace.result.status, "pending");
assert.equal(rawReferenceRun.ledger.nodes.find((node) => node.id === "source_resolution").status, "needs_review");
assert.throws(() => beginOutline(rawReferenceRun), (error) => error.code === "CONTENT_PATTERN_REVIEW_REQUIRED");

const contentMaster = {
  reader_value: "帮助团队建立稳定内容系统",
  confirmed_facts: [{ fact_id: "F1", fact: "团队已有四周发布记录", source_ids: ["U1"] }],
  source_list: [{ source_id: "U1" }]
};
const outline = {
  outline_id: "outline_1",
  content_promise: "帮助团队建立稳定内容系统",
  sections: [
    { section_id: "S1", heading: "先说结论", objective: "稳定发布需要系统", key_points: ["稳定发布"] },
    { section_id: "S2", heading: "问题在哪里", objective: "分析内容断更", key_points: ["内容断更"] },
    { section_id: "S3", heading: "如何行动", objective: "建立内容系统", key_points: ["内容系统"] }
  ]
};
const contentPackage = {
  post_copy: {
    recommended_title: "稳定发布内容，靠的是系统",
    opening: "内容断更不是灵感问题。",
    body_sections: [
      { heading: "先说结论", content: "稳定发布需要系统。" },
      { heading: "问题在哪里", content: "内容断更来自流程缺失。" },
      { heading: "如何行动", content: "从今天开始建立内容系统。" }
    ],
    ending: "保存并开始行动。"
  },
  deck: {
    pages: Array.from({ length: 6 }, (_, index) => ({
      page_id: `P${index + 1}`,
      headline: ["先说结论", "问题在哪里", "如何行动"][index % 3],
      supporting_text: ["稳定发布", "内容断更", "内容系统"][index % 3],
      fact_ids: index === 0 ? ["F1"] : []
    }))
  }
};
const gateReview = runContentGates({ platform: "xiaohongshu", contentMaster, confirmedOutline: outline, contentPackage, requireConfirmedOutline: true });
assert.notEqual(gateReview.decision, "block");
assert.equal(runContentGates({ platform: "xiaohongshu", contentMaster: { confirmed_facts: [] }, confirmedOutline: null, contentPackage, requireConfirmedOutline: true }).decision, "block");

const before = { post_copy: { recommended_title: "旧标题", opening: "原开头" }, source_list: [{ source_id: "U1" }], image_specs: [] };
const proposed = { post_copy: { recommended_title: "新标题", opening: "新开头" }, source_list: [], image_specs: [{ page_id: "P1" }] };
const patch = applyValidatedPatch(before, proposed, { allowedPrefixes: ["/post_copy"], lockedPrefixes: ["/source_list"] });
assert.equal(patch.content.post_copy.recommended_title, "新标题");
assert.deepEqual(patch.content.source_list, before.source_list);
assert.deepEqual(patch.content.image_specs, []);
assert.ok(patch.blockedOperations.length >= 2);

const task = {
  id: "content_1",
  contentRunId: runs[0].id,
  accountId: "account_1",
  platform: "xiaohongshu",
  ideaTitle: "稳定内容系统",
  contentIdentity: { topic: "稳定内容系统", contentPillar: "内容运营", contentRole: "trust", audienceProblem: "内容断更", coreClaim: "稳定发布依赖系统" },
  currentContent: contentPackage,
  status: "succeeded",
  createdAt: new Date().toISOString()
};
store.contentTasks.push(task);
const publishedAt = "2026-08-01T00:00:00.000Z";
const publication = recordPublication(store, task, { status: "published", url: "https://example.com/post", publishedAt });
const metrics = recordPublicationMetrics(publication, { views: 1000, saves: 40, comments: 10, follows: 8, measurementWindow: "7d", cutoffAt: "2026-08-08T00:00:00.000Z" });
assert.equal(metrics.views, 1000);
assert.ok(metrics.engagementRate > 0);
const history = buildContentHistoryIndex(store, { accountId: "account_1" });
assert.equal(history.items.length, 1);
assert.equal(history.items[0].publication.id, publication.id);

assert.ok(listSkillAdapters().length >= 8);
assert.equal(resolveSkillAdapter("review-xhs-visuals", "wechat"), null);

console.log(JSON.stringify({
  status: "content-orchestration-self-test passed",
  unifiedEntryModes: modes,
  gateDecision: gateReview.decision,
  appliedPatchOperations: patch.operations.length,
  blockedPatchOperations: patch.blockedOperations.length,
  historyItems: history.items.length,
  publicationMetrics: metrics,
  registeredAdapters: listSkillAdapters().length
}, null, 2));

