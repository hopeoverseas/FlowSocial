import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { planNextContent } from "../../content-agent/index.mjs";
import { normalizeViralBlueprint } from "../../content-agent/library-contracts.mjs";
import { runContentPipeline } from "../../content-engine.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = JSON.parse(await readFile(`${root}/tests/fixtures/content-agent/mock-strategy-cases.json`, "utf8"));
const baseCase = fixture.cases.find((item) => item.id === "cold_start_b2b_ai");
const trafficCase = fixture.cases.find((item) => item.id === "rapid_launch_fitness_coach");
const hotspot = { id: "hot_matrix_01", title: "企业开始关注AI项目的岗位验收", summary: "讨论从工具采购转向岗位任务验收", status: "recommended", relevanceScore: 95, sourceUrl: "https://example.com/hotspots/ai-acceptance", collectedAt: "2026-07-29T08:00:00.000Z", freshness: "24h" };
const knowledge = [{ id: "kb_matrix_01", title: "企业AI交付方法" }];
const blueprint = { ...normalizeViralBlueprint({ id: "blueprint_matrix_01", name: "误区纠偏加清单", bestFor: ["xiaohongshu", "wechat"], goals: ["trust"], structure: ["指出误区", "解释原因", "给出清单"], doNotCopy: ["原文句子", "原案例"] }), lifecycle: "approved", productionReady: true, approvedBy: "reviewer_matrix", approvedAt: "2026-07-28T08:00:00.000Z" };
const unreviewedBlueprint = { ...blueprint, id: "blueprint_candidate_01", lifecycle: "candidate", productionReady: false, approvedBy: null, approvedAt: null };
const userMaterials = [
  { id: "material_text_01", type: "text", name: "用户补充的一线观察", text: "客户真正担心的是项目上线后没人维护，而不是模型参数不够多。", usage: "usable" },
  { id: "material_image_01", type: "image", name: "现场白板.jpg", text: "", usage: "needs_review" }
];

const knowledgeOnly = planNextContent({ strategySnapshot: baseCase.strategySnapshot, currentFacts: [], platform: "wechat", knowledgeItems: knowledge, limit: 1 });
assert.deepEqual(knowledgeOnly.recommendations[0].sourcePlan.sources.map((item) => item.type), ["knowledge_base"]);

const hotspotKnowledge = planNextContent({ strategySnapshot: trafficCase.strategySnapshot, currentFacts: [], platform: "xiaohongshu", hotspots: [hotspot], knowledgeItems: knowledge, limit: 1 });
assert.ok(hotspotKnowledge.recommendations[0].sourcePlan.sources.some((item) => item.type === "hotspot"));
assert.ok(hotspotKnowledge.recommendations[0].sourcePlan.sources.some((item) => item.type === "knowledge_base"));
assert.equal(hotspotKnowledge.recommendations[0].generationPayload.contentSourceEvidence.hotspots.length, 1);
const hotspotDecision = hotspotKnowledge.recommendations[0].sourcePlan.sourceTrace.decisions.find((item) => item.type === "hotspot");
assert.equal(hotspotDecision.assets[0].sourceUrl, hotspot.sourceUrl);
assert.equal(hotspotDecision.assets[0].collectedAt, hotspot.collectedAt);
assert.equal(hotspotDecision.assets[0].freshness, hotspot.freshness);

const temporaryOnly = planNextContent({
  strategySnapshot: { ...baseCase.strategySnapshot, knowledgeScope: { folderIds: [] } },
  currentFacts: [], platform: "xiaohongshu", userMaterials,
  userRequest: { topic: "为什么AI项目上线后很快没人使用", contentRole: "trust", format: "opinion", userMaterials }
});
assert.deepEqual(temporaryOnly.recommendations[0].sourcePlan.sources.map((item) => item.type), ["user_material"]);
assert.equal(temporaryOnly.recommendations[0].generationPayload.temporaryMaterials.length, 2);
assert.deepEqual(temporaryOnly.recommendations[0].generationPayload.uploadedImageNames, ["现场白板.jpg"]);

const blueprintKnowledge = planNextContent({
  strategySnapshot: baseCase.strategySnapshot, currentFacts: [], platform: "wechat", knowledgeItems: knowledge, viralBlueprints: [blueprint],
  userRequest: { topic: "企业知识库最常见的三个建设误区", contentRole: "trust", format: "case" }
});
assert.ok(blueprintKnowledge.recommendations[0].sourcePlan.sources.some((item) => item.type === "knowledge_base"));
assert.ok(blueprintKnowledge.recommendations[0].sourcePlan.sources.some((item) => item.type === "viral_blueprint"));
assert.equal(blueprintKnowledge.recommendations[0].generationPayload.contentSourceEvidence.viralBlueprints.length, 1);

const rejectedBlueprint = planNextContent({
  strategySnapshot: baseCase.strategySnapshot, currentFacts: [], platform: "wechat", knowledgeItems: knowledge, viralBlueprints: [unreviewedBlueprint],
  userRequest: { topic: "企业知识库最常见的三个建设误区", contentRole: "trust", format: "case", preferredSourceMode: "viral_blueprint" }
});
assert.equal(rejectedBlueprint.recommendations[0].sourcePlan.sources.find((item) => item.type === "viral_blueprint")?.candidateIds.length, 0);
assert.equal(rejectedBlueprint.recommendations[0].sourcePlan.sourceTrace.decisions.find((item) => item.type === "viral_blueprint").reasonCode, "no_human_approved_blueprint_available");

const rawReference = planNextContent({
  strategySnapshot: baseCase.strategySnapshot, currentFacts: [], platform: "wechat", knowledgeItems: knowledge,
  userMaterials: [{ id: "reference_matrix_01", type: "reference_post", title: "参考文章", url: "https://example.com/reference" }],
  userRequest: { topic: "企业内容诊断", contentRole: "trust", format: "case" }
});
const rawSource = rawReference.recommendations[0].sourcePlan.sources.find((item) => item.type === "reference_post");
assert.deepEqual(rawSource.candidateIds, [], "原始参考帖不能进入正文来源 ID");
assert.deepEqual(rawSource.analysisCandidateIds, ["reference_matrix_01"]);
assert.equal(rawReference.recommendations[0].generationPayload.contentSourceEvidence.userMaterials.length, 0, "原始参考帖不能伪装成用户事实素材");

const allSources = planNextContent({
  strategySnapshot: baseCase.strategySnapshot, currentFacts: [], platform: "xiaohongshu", hotspots: [hotspot], knowledgeItems: knowledge, viralBlueprints: [blueprint], userMaterials,
  userRequest: { topic: "AI项目从工具采购转向岗位验收", contentRole: "traffic", format: "opinion", preferredSourceMode: "mixed", userMaterials }
});
const allTypes = new Set(allSources.recommendations[0].sourcePlan.sources.map((item) => item.type));
for (const type of ["hotspot", "knowledge_base", "viral_blueprint", "user_material"]) assert.ok(allTypes.has(type), `missing ${type}`);

const captured = [];
const selected = allSources.recommendations[0];
selected.generationPayload.contentPatternSnapshot = { id: "pattern_snapshot_matrix", policy: { structureOnly: true }, blueprintVersions: [{ id: "pattern_matrix_v1", version: 1, structureRules: ["问题", "方法", "行动"] }] };
selected.generationPayload.contentSkillPatternPacks = [{ id: "skill_pack_matrix", targetSkill: "write-xhs-content", version: 1, rules: { structureRules: ["问题", "方法", "行动"] } }];
const pipeline = await runContentPipeline({
  payload: selected.generationPayload,
  selection: null,
  intentProfile: {
    profile_id: "intent_source_matrix", topic_id: null, platform: "xiaohongshu",
    purpose: { id: selected.generationPayload.contentPurposeId, label: "来源矩阵", description: "验证多来源" },
    promotion: { mode: "none", knowledge_enabled: true, knowledge_asset_ids: ["kb_matrix_01"], knowledge_snapshot_id: "snapshot_matrix", insertion_rule: "value_first_natural_context" },
    engagement_policy: { mode: "auto", optimize_for: ["save"] }, source: { type: "content_agent" }
  },
  citations: [{ citationId: "K1", fileId: "kb_matrix_01", fileName: "企业AI交付方法", chunkId: "chunk_01", text: "岗位验收应定义输入、任务、输出和人工复核边界。" }],
  knowledgeAssets: knowledge,
  contentTaskBrief: selected.contentTaskBrief,
  contentSourcePlan: selected.sourcePlan,
  factSnapshot: selected.generationPayload.factSnapshot
}, {
  generateText: async (request, fallback) => {
    captured.push(request);
    return { mode: "source_matrix", data: fallback || {} };
  }
});
const masterRequest = captured.find((request) => request.task === "build_content_master_v2");
const evidenceTypes = new Set(masterRequest.input.supplied_evidence.map((item) => item.source_type));
for (const type of ["planned_hotspot", "knowledge_base", "user_temporary_material"]) assert.ok(evidenceTypes.has(type), `master missing ${type}`);
assert.equal(masterRequest.input.creative_blueprints.length, 1);
assert.ok(masterRequest.input.creative_blueprints[0].doNotCopy.includes("原文句子"));
const writerRequest = captured.find((request) => request.task === "write_xhs_content_v2");
assert.ok(writerRequest.input.temporary_materials.some((item) => item.type === "image"));
assert.equal(writerRequest.input.content_pattern_snapshot.id, "pattern_snapshot_matrix");
assert.equal(writerRequest.input.skill_pattern_packs[0].id, "skill_pack_matrix");
assert.equal(captured.find((request) => request.task === "generate_final_platform_titles").input.skill_pattern_packs[0].id, "skill_pack_matrix");
assert.notEqual(pipeline.status, "blocked");

console.log(JSON.stringify({
  status: "content-agent-source-matrix-self-test passed",
  modes: {
    knowledgeOnly: knowledgeOnly.recommendations[0].sourcePlan.mode,
    hotspotKnowledge: hotspotKnowledge.recommendations[0].sourcePlan.mode,
    temporaryOnly: temporaryOnly.recommendations[0].sourcePlan.mode,
    blueprintKnowledge: blueprintKnowledge.recommendations[0].sourcePlan.mode,
    allSources: allSources.recommendations[0].sourcePlan.mode
  },
  masterEvidenceTypes: [...evidenceTypes],
  blueprintPassedToWriter: true,
  temporaryImagePassedToWriter: true
}, null, 2));

