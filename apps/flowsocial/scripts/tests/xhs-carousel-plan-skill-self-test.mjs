import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createXhsCarouselPlan, validateXhsCarouselPlan } from "../../content-agent/xhs-content-components.mjs";
import { validateXhsCarouselPlanCreativeOutput } from "../../skills/plan-xhs-carousel/scripts/validate-output.mjs";

const hash = (character) => character.repeat(64);
const ref = (id, character) => ({ id, hash: hash(character) });
const outlineRoles = ["hook", "problem", "diagnosis", "method", "evidence", "action"];
const pageRoles = ["cover", "problem", "conclusion", "method", "evidence", "cta"];
const confirmedOutline = {
  outline_id: "outline-1",
  sections: outlineRoles.map((role, index) => ({ section_id: `S${index + 1}`, role })),
};
const contentMaster = {
  confirmed_facts: [{ fact_id: "F1" }, { fact_id: "F2" }],
  supported_interpretations: [{ interpretation_id: "I1" }],
  author_opinions: [{ opinion_id: "O1" }],
  knowledge_contract: { allowed_assets: [{ asset_id: "K1" }] },
};
const postCopy = { contract: "XhsPostCopy@1.0", recommendedTitle: "六步建立可追溯内容链路" };

function creativeFixture() {
  return {
    status: "success",
    data: {
      schemaVersion: "1.0",
      contract: "XhsCarouselPlanCreativeOutput@1.0",
      deck_id: "DECK001",
      canvas: { width: 1080, height: 1440, ratio: "3:4" },
      reading_arc: "承诺到问题，再到方法、证据与行动",
      pages: outlineRoles.map((outlineRole, index) => ({
        page: index + 1,
        outline_section_id: `S${index + 1}`,
        outline_role: outlineRole,
        role: pageRoles[index],
        objective: `推进叙事任务 ${index + 1}`,
        takeaway: `本页唯一结论 ${index + 1}`,
        text_layers: [{ type: "headline", text: index === 0 ? postCopy.recommendedTitle : `页面文本 ${index + 1}`, max_lines: 3, priority: 1 }],
        layout_hint: `信息层级提示 ${index + 1}`,
        fact_ids: index === 1 ? ["F1"] : [],
        interpretation_ids: index === 2 ? ["I1"] : [],
        knowledge_asset_ids: index === 4 ? ["K1"] : [],
      })),
    },
    warnings: [],
    blocked_reasons: [],
  };
}

const context = {
  confirmedOutline,
  contentMaster,
  postCopy,
  platformBrief: { contract: "UnifiedPlatformBrief@1.0" },
  designDnaRef: ref("dna-1", "4"),
  designDna: { id: "dna-1", status: "confirmed" },
};
const valid = creativeFixture();
assert.equal(validateXhsCarouselPlanCreativeOutput(valid, context), valid);

const authorityBinding = {
  companyId: "company-1",
  accountId: "acc-xhs",
  activeStrategySnapshotRef: ref("strategy-1", "a"),
  contentOpportunityRef: ref("opportunity-1", "b"),
  mechanismDecisionRef: ref("mechanism-1", "c"),
  contentProjectRef: ref("project-1", "d"),
  platformRunRef: ref("run-1", "e"),
  sharedContentMasterRef: ref("master-1", "f"),
  platformBriefRef: ref("brief-1", "1"),
  confirmedOutlineRef: ref("outline-1", "2"),
  writerContextRef: ref("writer-1", "3"),
  designDnaRef: ref("dna-1", "4"),
};
const component = createXhsCarouselPlan({
  schemaVersion: "1.0",
  contract: "XhsCarouselPlan@1.0",
  id: "carousel-plan-1",
  authorityBinding,
  postCopyRef: ref("post-copy-1", "5"),
  deckId: valid.data.deck_id,
  canvas: structuredClone(valid.data.canvas),
  designDnaVersion: authorityBinding.designDnaRef.id,
  readingArc: valid.data.reading_arc,
  pages: valid.data.pages.map((page) => ({
    page: page.page,
    outlineSectionId: page.outline_section_id,
    outlineRole: page.outline_role,
    role: page.role,
    objective: page.objective,
    takeaway: page.takeaway,
    textLayers: page.text_layers.map((layer) => ({ type: layer.type, text: layer.text, maxLines: layer.max_lines, priority: layer.priority })),
    layoutHint: page.layout_hint,
    factIds: [...page.fact_ids],
    interpretationIds: [...page.interpretation_ids],
    knowledgeAssetIds: [...page.knowledge_asset_ids],
    mustAvoid: [],
  })),
});
assert.equal(validateXhsCarouselPlan(component), component);
assert.equal(component.pages.length, 6);
assert.deepEqual(component.pages.map((page) => page.page), [1, 2, 3, 4, 5, 6]);

function rejects(mutator, expectedPath) {
  const value = creativeFixture();
  mutator(value);
  assert.throws(
    () => validateXhsCarouselPlanCreativeOutput(value, context),
    (error) => error.code === "XHS_CAROUSEL_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes(expectedPath),
  );
}

function rejectsValue(value, expectedPath) {
  assert.throws(
    () => validateXhsCarouselPlanCreativeOutput(value, context),
    (error) => error.code === "XHS_CAROUSEL_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes(expectedPath),
  );
}

rejectsValue(null, "$");
rejectsValue(42, "$");
rejects((value) => { value.extra = true; }, "$");
rejects((value) => { delete value.data.schemaVersion; }, "$.data.schemaVersion");
rejects((value) => { value.data.schemaVersion = null; }, "$.data.schemaVersion");
rejects((value) => { value.data.schemaVersion = 1; }, "$.data.schemaVersion");
rejects((value) => { value.data.schemaVersion = "2.0"; }, "$.data.schemaVersion");
rejects((value) => { delete value.data.contract; }, "$.data.contract");
rejects((value) => { value.data.contract = null; }, "$.data.contract");
rejects((value) => { value.data.contract = 1; }, "$.data.contract");
rejects((value) => { value.data.contract = "Wrong@1.0"; }, "$.data.contract");
rejects((value) => { delete value.data.reading_arc; }, "$.data");
rejects((value) => { value.data.extra = true; }, "$.data");
rejects((value) => { value.data.pages = null; }, "$.data.pages");
rejects((value) => { value.data.pages = value.data.pages.slice(0, 5); }, "$.data.pages");
rejects((value) => { value.data.pages[0] = "bad"; }, "$.data.pages[0]");
rejects((value) => { value.data.pages[1].page = 1; }, "$.data.pages[1].page");
rejects((value) => { value.data.pages[1].outline_section_id = "S1"; }, "$.data.pages[1].outline_section_id");
rejects((value) => { value.data.pages[1].role = "cover"; }, "$.data.pages[1].role");
rejects((value) => { value.data.pages[1].takeaway = value.data.pages[0].takeaway; }, "$.data.pages[].takeaway");
rejects((value) => { value.data.pages[1].text_layers = structuredClone(value.data.pages[0].text_layers); }, "$.data.pages[].text_layers");
rejects((value) => { value.data.pages[2].fact_ids = ["UNKNOWN"]; }, "$.data.pages[2].fact_ids[]");
rejects((value) => { value.data.pages[2].fact_ids = ["O1"]; }, "$.data.pages[2].fact_ids[]");
rejects((value) => { value.data.pages[0].visual_need = "forbidden"; }, "$.data.pages[0]");
assert.throws(
  () => validateXhsCarouselPlanCreativeOutput(creativeFixture(), { ...context, designDnaRef: null }),
  (error) => error.code === "XHS_CAROUSEL_PLAN_CREATIVE_OUTPUT_INVALID" && error.details.fieldPaths.includes("input.design_dna_ref"),
);

for (const status of ["needs_review", "blocked"]) {
  const nonSuccess = { status, data: null, warnings: [], blocked_reasons: [`${status} reason`] };
  const frozen = structuredClone(nonSuccess);
  assert.throws(
    () => validateXhsCarouselPlanCreativeOutput(nonSuccess, context),
    (error) => error.code === "XHS_CAROUSEL_PLAN_CREATIVE_OUTPUT_NOT_READY"
      && error.status === status
      && error.assemblyEligible === false
      && error.details.fieldPaths.includes("$.status"),
  );
  assert.deepEqual(nonSuccess, frozen);
}
rejectsValue({ status: "partial", data: null, warnings: [], blocked_reasons: ["reason"] }, "$.status");
rejectsValue({ status: "blocked", data: creativeFixture().data, warnings: [], blocked_reasons: ["reason"] }, "$.data");
rejectsValue({ status: "needs_review", data: null, warnings: [], blocked_reasons: [] }, "$.blocked_reasons");

const skill = readFileSync(resolve("apps/flowsocial/skills/plan-xhs-carousel/SKILL.md"), "utf8");
const contract = readFileSync(resolve("apps/flowsocial/skills/plan-xhs-carousel/references/contract.md"), "utf8");
for (const marker of ["XhsCarouselPlanCreativeOutput@1.0", "XhsPostCopy@1.0", "ContentMaster", "confirmed Design DNA", "Do not output visual need", "Do not call another Skill"]) assert.ok(skill.includes(marker), marker);
for (const marker of ["ENVELOPE_KEYS_EXACT", "SUCCESS_DATA_KEYS_EXACT", "schemaVersion", "XhsCarouselPlanCreativeOutput@1.0", "PAGE_KEYS_EXACT", "TEXT_LAYER_KEYS_EXACT", "needs_review", "blocked", "visual_need", "traceability", "preflight_checks", "componentHash"]) assert.ok(contract.includes(marker), marker);

console.log("xhs carousel plan skill self-test passed");
