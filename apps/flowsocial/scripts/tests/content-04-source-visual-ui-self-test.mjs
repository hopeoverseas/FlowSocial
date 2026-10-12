import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateXhsGeneratedRasterSpecs, normalizeXhsGeneratedRasterSpecs, prepareContentMaster } from "../../content-engine.mjs";
import { runContentGates } from "../../content-agent/gate-engine.mjs";
import { createContentRun } from "../../content-agent/workflow-engine.mjs";

const materials = [1, 2, 3].map((index) => ({
  id: `material_${index}`,
  type: "text",
  name: `临时素材 ${index}`,
  text: `已由用户确认可公开的事实 ${index}`,
  usage: "usable",
  visibility: "publishable"
}));
materials[2] = { id: "material_3", type: "text", name: "临时素材 3", content: "已由用户确认可公开的事实 3", visibility: "public" };
const store = {};
const run = createContentRun(store, {
  accountId: "social_xhs_1",
  recommendation: { id: "direction_1", topic: "临时素材回归" },
  generationPayload: {
    workspaceId: "workspace_1",
    companyId: "company_1",
    socialAccountId: "social_xhs_1",
    selectionSource: "user_confirmed",
    strategySnapshotId: "strategy_1",
    accountStrategySnapshotId: "account_strategy_1",
    factSnapshot: { id: "facts_1", usableFacts: [] },
    ideaTitle: "临时素材回归",
    platform: "xiaohongshu",
    contentTaskBrief: { topic: "临时素材回归", factSnapshotId: "facts_1" },
    contentSourcePlan: { mode: "user_material", sources: [{ type: "user_material", required: true, candidateIds: materials.map((item) => item.id) }] },
    temporaryMaterials: materials
  }
});
assert.equal(run.socialAccountId, "social_xhs_1");
assert.equal(run.selectionSource, "user_confirmed");
assert.equal(run.accountContextSnapshot.accountStrategySnapshotId, "account_strategy_1");
assert.equal(run.sourceEvidenceSnapshot.userMaterials.length, 3);
assert.ok(run.sourceEvidenceSnapshot.userMaterials.every((item) => item.contentHash.length === 64 && item.sourceType === "user_temporary_material"));
materials[0].text = "调用后被修改";
assert.equal(run.sourceEvidenceSnapshot.userMaterials[0].text, "已由用户确认可公开的事实 1");

const intentProfile = {
  profile_id: "intent_1",
  topic_id: "topic_1",
  purpose: { id: "knowledge_howto", label: "干货" },
  promotion: { mode: "none", knowledge_snapshot_id: null },
  engagement_policy: {}
};
const prepared = await prepareContentMaster({
  payload: run.generationPayload,
  selection: null,
  intentProfile,
  contentTaskBrief: run.generationPayload.contentTaskBrief,
  contentSourcePlan: run.generationPayload.contentSourcePlan,
  factSnapshot: { usableFacts: [] }
}, { generateText: async () => ({ status: "ready", data: { central_thesis: "临时素材回归", confirmed_facts: [] } }) });
const temporarySources = prepared.contentMaster.source_list.filter((item) => item.source_type === "user_temporary_material");
assert.equal(temporarySources.length, 3);
assert.equal(prepared.contentMaster.confirmed_facts.filter((fact) => fact.source_ids.some((id) => id.startsWith("material_"))).length, 3);

const pages = Array.from({ length: 8 }, (_, index) => ({ page_id: `P${index + 1}`, render_strategy: [2, 6].includes(index) ? "generated_raster" : "html_css" }));
const hybrid = { deck: { pages }, image_specs: [{ page_id: "P3" }, { page_id: "P7" }] };
assert.deepEqual(evaluateXhsGeneratedRasterSpecs(hybrid), { passed: true, generatedRasterCount: 2, imageSpecCount: 2, missingPageIds: [], unexpectedPageIds: [], duplicatePageIds: [] });
assert.equal(evaluateXhsGeneratedRasterSpecs({ ...hybrid, image_specs: [{ page_id: "P3" }] }).passed, false);
assert.deepEqual(normalizeXhsGeneratedRasterSpecs(pages, [{ prompt: "no text, no logo" }, { page_id: "P7", prompt: "no text, no logo" }]).map((item) => item.page_id), ["P3", "P7"]);

const gates = runContentGates({ platform: "xiaohongshu", contentMaster: prepared.contentMaster, contentPackage: { post_copy: { recommended_title: "临时素材回归" }, deck: { pages: Array.from({ length: 6 }, (_, index) => ({ page_id: `P${index + 1}`, headline: "临时素材回归", fact_ids: [] })) } } });
assert.equal(gates.checks.find((item) => item.gate === "SourceReadinessGate").result, "pass");
assert.equal(gates.checks.find((item) => item.gate === "SourceReadinessGate").detail.temporaryMaterialFacts, 3);
const strategyGate = runContentGates({ platform: "xiaohongshu", contentMaster: { confirmed_facts: [{ fact_id: "F_strategy", fact: "已授权策略事实", source_ids: ["strategy_fact_1"] }], source_list: [{ source_id: "strategy_fact_1", source_type: "strategy_fact" }] }, contentPackage: { post_copy: { recommended_title: "策略事实" }, deck: { pages: Array.from({ length: 6 }, (_, index) => ({ page_id: `S${index + 1}`, headline: "策略事实", fact_ids: [] })) } } });
assert.equal(strategyGate.checks.find((item) => item.gate === "SourceReadinessGate").detail.strategyFacts, 1);

const appSource = await readFrontendSource();
const serverSource = await readFile(new URL("../../server.mjs", import.meta.url), "utf8");
assert.match(appSource, /\["content_ready", "needs_review", "blocked"\]/);
assert.match(appSource, /post_copy\?\.hashtags|post_copy\.hashtags/);
assert.match(appSource, /deck\?\.pages|pkg\.deck\?\.pages/);
assert.match(appSource, /v2PlanAccountChoice/);
assert.match(appSource, /single_account_default/);
assert.match(appSource, /strategyView\.hidden = view !== "agent"/);
assert.match(appSource, /v2ConfirmSourceSelection/);
assert.match(appSource, /data-v2-source-file/);
assert.match(appSource, /先选择资料/);
assert.match(appSource, /if \(v2Workspace\.run && v2MissingRequiredSources\(v2Workspace\.run\)\.length\)/);
assert.match(serverSource, /CONTENT_ACCOUNT_SELECTION_REQUIRED/);
assert.match(serverSource, /companyId 不能代替 socialAccountId/);
assert.match(serverSource, /CONTENT_SOURCE_SELECTION_REQUIRED/);
assert.match(serverSource, /source_selection_confirmed/);
assert.match(serverSource, /knowledgeSnapshotId: `knowledge_selection_/);
assert.match(serverSource, /user_selected_and_frozen/);
assert.match(serverSource, /blocked_before_visual_storyboard/);

console.log("content-04 source, visual gate, blocked UI and account selection self-test passed");
