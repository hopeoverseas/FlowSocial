import assert from "node:assert/strict";
import { buildRevisionImpactPlan, buildSkillExecutionPlan } from "../../content-agent/skill-execution-plan.mjs";
import { buildSkillConformanceReport } from "../../content-agent/skill-conformance.mjs";

const sourceCases = [
  { id: "knowledge", plan: { mode: "knowledge_base", sources: [{ type: "knowledge_base", candidateIds: ["knowledge_1"] }] }, rawAnalysis: false },
  { id: "hotspot_knowledge", plan: { mode: "mixed", sources: [{ type: "hotspot", candidateIds: ["hotspot_1"] }, { type: "knowledge_base", candidateIds: ["knowledge_1"] }] }, rawAnalysis: false },
  { id: "user_material", plan: { mode: "user_material", sources: [{ type: "user_material", candidateIds: ["material_1"] }] }, rawAnalysis: false },
  { id: "approved_blueprint", plan: { mode: "mixed", sources: [{ type: "viral_blueprint", candidateIds: ["blueprint_1"] }, { type: "knowledge_base", candidateIds: ["knowledge_1"] }] }, rawAnalysis: false },
  { id: "raw_reference", plan: { mode: "mixed", sources: [{ type: "viral_reference", analysisCandidateIds: ["reference_1"] }, { type: "knowledge_base", candidateIds: ["knowledge_1"] }] }, rawAnalysis: true }
];
const rows = [];
for (const platform of ["xiaohongshu", "wechat"]) {
  for (const sourceCase of sourceCases) {
    const plan = buildSkillExecutionPlan({ platform, sourcePlan: sourceCase.plan });
    const enabled = plan.steps.filter((step) => step.enabled).map((step) => step.id);
    assert.equal(plan.steps.find((step) => step.id === "source_analysis").enabled, sourceCase.rawAnalysis);
    assert.equal(plan.referenceAnalysisTrace.decision, sourceCase.rawAnalysis ? "enabled" : "skipped");
    assert.equal(plan.policy.implicitHotspotSearch, false);
    assert.equal(plan.policy.viralLearningV1, false);
    assert.equal(plan.sourceTrace.decisions.length, 4);
    assert.ok(enabled.indexOf("content_master") < enabled.indexOf("outline"));
    assert.ok(enabled.indexOf("outline_confirmation") < enabled.indexOf("platform_writer"));
    assert.ok(enabled.indexOf("platform_writer") < enabled.indexOf("title"));
    if (platform === "xiaohongshu") assert.equal(plan.steps.find((step) => step.id === "visual_review").enabled, false);
    if (platform === "wechat") assert.ok(enabled.indexOf("wechat_content_review") < enabled.indexOf("title"));
    rows.push({ platform, sourceCase: sourceCase.id, enabledSkills: plan.steps.filter((step) => step.kind === "skill" && step.enabled).length });
  }
}
assert.equal(rows.length, 10);

const revisionCases = [
  ["copy", ["/article_markdown"], "wechat_content_review"],
  ["copy", ["/recommended_title"], "title"],
  ["page_text", ["/deck/pages/1/headline"], "schema_and_reference"],
  ["image_spec", ["/image_specs/0/prompt"], "render"],
  ["claim", [], "content_master"],
  ["purpose_or_promotion", [], "content_master"]
];
for (const [requestClass, changedPaths, expected] of revisionCases) {
  const platform = requestClass === "image_spec" || requestClass === "page_text" ? "xiaohongshu" : "wechat";
  const impact = buildRevisionImpactPlan({ platform, requestClass, changedPaths, sourceChanged: requestClass === "claim" });
  assert.equal(impact.rerunFrom, expected);
}

const conformance = buildSkillConformanceReport();
assert.equal(conformance.errors.length, 0);
assert.equal(conformance.warnings.length, 0);

console.log(JSON.stringify({ status: "content-skill-matrix-self-test passed", matrixCases: rows.length, revisionCases: revisionCases.length, conformanceWarnings: conformance.warnings.length, rows }, null, 2));

