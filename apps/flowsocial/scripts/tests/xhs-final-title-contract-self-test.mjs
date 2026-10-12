import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  XHS_CONTENT_COMPONENT_CONTRACTS,
  assembleXhsPostPackageV3,
  assembleXhsPostPackageV4,
  compileXhsContentPreflight,
  compileXhsContentPreflightV2,
  compileXhsTraceability,
  compileXhsTraceabilityV2,
  createXhsCarouselPlan,
  createXhsCarouselPlanV2,
  createXhsFinalTitleBinding,
  createXhsPostCopy,
  createXhsVisualAssetPlan,
  validateXhsCarouselPlan,
  validateXhsCarouselPlanV2,
  validateXhsContentPreflightReportV2,
  validateXhsFinalTitleBinding,
  validateXhsPostPackageV3,
  validateXhsPostPackageV4,
  validateXhsTraceabilityV2
} from "../../content-agent/xhs-content-components.mjs";
import { assembleXhsAtomicSkillOutput, runXhsAtomicSkill } from "../../content-agent/xhs-atomic-skill-runtime.mjs";
import { validateXhsCarouselPlanCreativeOutput } from "../../skills/plan-xhs-carousel/scripts/validate-output.mjs";

const roles = ["hook", "problem", "diagnosis", "evidence", "example", "action"];
const bodyRoles = ["scene", "problem", "conclusion", "evidence", "evidence", "summary"];
const pageRoles = ["cover", "problem", "conclusion", "evidence", "case", "cta"];
const contentMaster = {
  content_master_id: "master-final-title",
  confirmed_facts: [{ fact_id: "F001", fact: "fixture fact", source_ids: ["SRC001"] }],
  supported_interpretations: [{ interpretation_id: "I001", interpretation: "fixture interpretation" }],
  author_opinions: [{ opinion_id: "O001", opinion: "fixture opinion" }],
  source_list: [{ source_id: "SRC001", title: "fixture" }],
  knowledge_contract: { allowed_assets: [{ asset_id: "K001" }] },
  promotion: { mode: "none", allowed_items: [], disclosure: "" }
};
const confirmedOutline = {
  outline_id: "outline-final-title",
  content_promise: "fixture promise",
  sections: roles.map((role, index) => ({ section_id: `S${index + 1}`, role }))
};
const ref = (id, token) => ({ id, hash: token.repeat(64).slice(0, 64) });
const authorityBinding = {
  companyId: "company-1", accountId: "account-1",
  activeStrategySnapshotRef: ref("strategy-1", "1"), contentOpportunityRef: ref("opportunity-1", "2"),
  mechanismDecisionRef: ref("mechanism-1", "3"), contentProjectRef: ref("project-1", "4"),
  platformRunRef: ref("run-1", "5"), sharedContentMasterRef: { id: contentMaster.content_master_id, hash: hashUnifiedContent(contentMaster) },
  platformBriefRef: ref("brief-1", "6"), confirmedOutlineRef: { id: confirmedOutline.outline_id, hash: hashUnifiedContent(confirmedOutline) },
  writerContextRef: ref("writer-1", "7"), designDnaRef: ref("dna-1", "8")
};
const assetRef = ref("asset-1", "a");

function postDraft() {
  return {
    schemaVersion: "1.0", contract: XHS_CONTENT_COMPONENT_CONTRACTS.postCopy, id: "post-1", authorityBinding: structuredClone(authorityBinding),
    contentPromise: confirmedOutline.content_promise,
    engagementStrategy: { mode: "auto", primaryAction: "save", reason: "fixture", ctaPlacement: "ending", ctaText: "save" },
    titleCandidates: [
      { title: "preliminary title", hookType: "result", claimIds: ["F001"], risk: "low" },
      { title: "preliminary problem", hookType: "problem", claimIds: ["F001"], risk: "low" },
      { title: "preliminary checklist", hookType: "checklist", claimIds: ["F001"], risk: "low" }
    ],
    recommendedTitle: "preliminary title", opening: "opening",
    bodySections: roles.map((outlineRole, index) => ({ sectionId: `S${index + 1}`, outlineRole, role: bodyRoles[index], text: `body ${index + 1}`, claimIds: ["F001"], knowledgeAssetIds: index === 1 ? ["K001"] : [] })),
    ending: "ending", pinnedComment: "", hashtags: ["one", "two", "three"], cta: "save",
    promotionUse: { mode: "none", itemIds: [], disclosure: "" }
  };
}

function titleOutput(title, titleId = "TITLE-FINAL") {
  return {
    stage: "final_after_body", platform: "xiaohongshu",
    title_brief: { content_type: "guide", target_reader: "reader", core_conclusion: "conclusion", reader_takeaway: "takeaway", strongest_evidence: ["F001"], real_entities: [], freshness_dependency: "none" },
    candidates: [
      { title_id: titleId, title, motivation: "safe", method: "claim-led", claim_ids: ["F001"], scores: { fulfillment: 9, relevance: 9, specificity: 8, curiosity: 7, clarity: 9, uniqueness: 7, overall: 8 }, risk: "low", risk_reasons: [] },
      { title_id: "TITLE-ALT", title: "alternate title", motivation: "search", method: "keyword-led", claim_ids: ["F001"], scores: { fulfillment: 8, relevance: 9, specificity: 8, curiosity: 7, clarity: 8, uniqueness: 7, overall: 8 }, risk: "low", risk_reasons: [] }
    ],
    recommendations: { balanced: titleId, safe: titleId, spread: "TITLE-ALT", search: "TITLE-ALT", experiment: "TITLE-ALT" },
    ab_tests: [], same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" }
  };
}

function carouselDraft(postCopy, finalTitleBinding, headline = finalTitleBinding.title) {
  return {
    schemaVersion: "2.0", contract: XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlanV2, id: `carousel-${finalTitleBinding.titleId}`,
    authorityBinding: structuredClone(authorityBinding), postCopyRef: { id: postCopy.id, hash: postCopy.componentHash },
    finalTitleBindingRef: { id: finalTitleBinding.id, hash: finalTitleBinding.bindingHash }, deckId: `deck-${finalTitleBinding.titleId}`,
    canvas: { width: 1080, height: 1440, ratio: "3:4" }, designDnaVersion: "dna-v1", readingArc: "promise-action",
    pages: roles.map((outlineRole, index) => ({
      page: index + 1, outlineSectionId: `S${index + 1}`, outlineRole, role: pageRoles[index], objective: `objective ${index + 1}`,
      takeaway: `takeaway ${index + 1}`, textLayers: [{ type: "headline", text: index === 0 ? headline : `page ${index + 1}`, maxLines: 3, priority: 1 }],
      layoutHint: `layout ${index + 1}`, factIds: ["F001"], interpretationIds: [], knowledgeAssetIds: index === 1 ? ["K001"] : [], mustAvoid: []
    }))
  };
}

function legacyCarouselDraft(postCopy) {
  const draft = carouselDraft(postCopy, { title: postCopy.recommendedTitle, titleId: "legacy", id: "unused", bindingHash: "b".repeat(64) });
  draft.schemaVersion = "1.0";
  draft.contract = XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlan;
  draft.id = "carousel-legacy";
  delete draft.finalTitleBindingRef;
  return draft;
}

function visualDraft(carouselPlan) {
  return {
    schemaVersion: "1.0", contract: XHS_CONTENT_COMPONENT_CONTRACTS.visualAssetPlan, id: `visual-${carouselPlan.id}`,
    authorityBinding: structuredClone(authorityBinding), carouselPlanRef: { id: carouselPlan.id, hash: carouselPlan.componentHash }, designDnaVersion: "dna-v1",
    pageVisuals: carouselPlan.pages.map((page) => ({ page: page.page, visualFunction: page.page === 3 ? "demonstrate" : "explain", visualNeed: `visual ${page.page}`, renderStrategy: page.page === 3 ? "generated_raster" : "html_css", mustKeep: [], mustAvoid: [] })),
    imageSpecs: [{ plannedAssetId: "PLAN1", page: 3, useCase: "stylized-concept", assetType: "scene-illustration", scene: "scene", subject: "subject", styleAndMedium: "style", composition: "composition", lighting: "lighting", palette: ["neutral"], materials: "paper", textSafeArea: "center", prompt: "no text", negativePrompt: "text", referenceAssetIds: [assetRef.id], designDnaVersion: "dna-v1", size: "1024x1536", mustKeep: [], mustAvoid: [], textPolicy: "no_text_in_image" }],
    skippedPages: carouselPlan.pages.filter((page) => page.page !== 3).map((page) => ({ page: page.page, reason: "html_css" })),
    authorizedReferenceAssets: [structuredClone(assetRef)], pageAssetBindings: carouselPlan.pages.map((page) => ({ page: page.page, plannedAssetIds: page.page === 3 ? ["PLAN1"] : [] }))
  };
}

function buildTitleBound(title, suffix) {
  const output = titleOutput(title, `TITLE-${suffix}`);
  const titleOutputRef = { id: `title-output-${suffix}`, hash: hashUnifiedContent(output) };
  const finalTitleBinding = createXhsFinalTitleBinding({ id: `binding-${suffix}`, postCopy, titleOutput: output, titleOutputRef, contentMaster });
  const carouselPlan = createXhsCarouselPlanV2(carouselDraft(postCopy, finalTitleBinding), { postCopy, finalTitleBinding });
  const visualAssetPlan = createXhsVisualAssetPlan(visualDraft(carouselPlan));
  const traceability = compileXhsTraceabilityV2({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, contentMaster, authorizedReferenceAssets: [assetRef] });
  const preflightReport = compileXhsContentPreflightV2({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, contentMaster, confirmedOutline, authorizedReferenceAssets: [assetRef] });
  const packageV4 = assembleXhsPostPackageV4({ id: `package-${suffix}`, postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport });
  return { output, titleOutputRef, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport, packageV4 };
}

const postCopy = createXhsPostCopy(postDraft());
const basePostHash = postCopy.componentHash;
const valid = buildTitleBound("final balanced title", "A");
assert.notEqual(valid.finalTitleBinding.title, postCopy.recommendedTitle);
assert.equal(postCopy.componentHash, basePostHash, "final title must not mutate the base PostCopy hash");
assert.equal(valid.carouselPlan.pages[0].textLayers[0].text, valid.finalTitleBinding.title);
assert.deepEqual(valid.traceability.titleClaimIds, ["F001"]);
assert.equal(valid.preflightReport.status, "passed");
assert.equal(valid.preflightReport.checks.find((item) => item.check === "final_title_binding").result, "pass");
assert.ok([valid.finalTitleBinding, valid.carouselPlan, valid.traceability, valid.preflightReport, valid.packageV4].every(Object.isFrozen));

const second = buildTitleBound("second final title", "B");
assert.equal(postCopy.componentHash, basePostHash);
assert.notEqual(second.finalTitleBinding.bindingHash, valid.finalTitleBinding.bindingHash);
assert.notEqual(second.packageV4.packageHash, valid.packageV4.packageHash, "v4 identity must change with title binding");

for (const [name, validator, source, hashField] of [
  ["binding", validateXhsFinalTitleBinding, valid.finalTitleBinding, "bindingHash"],
  ["carousel v2", validateXhsCarouselPlanV2, valid.carouselPlan, "componentHash"],
  ["trace v2", validateXhsTraceabilityV2, valid.traceability, "traceHash"],
  ["preflight v2", validateXhsContentPreflightReportV2, valid.preflightReport, "reportHash"],
  ["package v4", validateXhsPostPackageV4, valid.packageV4, "packageHash"]
]) {
  for (const shape of ["missing", "extra", "null", "primitive"]) {
    let value;
    if (shape === "null") value = null;
    else if (shape === "primitive") value = 7;
    else { value = structuredClone(source); if (shape === "missing") delete value.schemaVersion; else value.privateSecret = "do-not-echo"; }
    assert.throws(() => validator(value), (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("$") && !JSON.stringify(error.details).includes("do-not-echo"), `${name} ${shape}`);
  }
  const tampered = structuredClone(source);
  tampered[hashField] = "f".repeat(64);
  assert.throws(() => validator(tampered), (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes(`$.${hashField}`));
}

const staleTitleRef = { ...valid.titleOutputRef, hash: "0".repeat(64) };
assert.throws(
  () => createXhsFinalTitleBinding({ id: "stale-binding", postCopy, titleOutput: valid.output, titleOutputRef: staleTitleRef, contentMaster }),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.titleOutputRef.hash")
);
const unauthorizedOutput = titleOutput("unauthorized title", "TITLE-BAD");
unauthorizedOutput.candidates[0].claim_ids = ["PRIVATE-CLAIM"];
assert.throws(
  () => createXhsFinalTitleBinding({ id: "bad-binding", postCopy, titleOutput: unauthorizedOutput, titleOutputRef: { id: "bad-output", hash: hashUnifiedContent(unauthorizedOutput) }, contentMaster }),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.titleOutput.candidates[].claim_ids") && !JSON.stringify(error.details).includes("PRIVATE-CLAIM")
);
const malformedTitleOutput = titleOutput("malformed title", "TITLE-MALFORMED");
malformedTitleOutput.candidates[0].claim_ids = null;
assert.throws(
  () => createXhsFinalTitleBinding({ id: "malformed-binding", postCopy, titleOutput: malformedTitleOutput, titleOutputRef: { id: "malformed-output", hash: hashUnifiedContent(malformedTitleOutput) }, contentMaster }),
  (error) => error instanceof TypeError === false && error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.titleOutput.candidates[].balanced")
);
const duplicateBalancedOutput = titleOutput("duplicate balanced title", "TITLE-DUPLICATE");
duplicateBalancedOutput.candidates[1].title_id = "TITLE-DUPLICATE";
assert.throws(
  () => createXhsFinalTitleBinding({ id: "duplicate-binding", postCopy, titleOutput: duplicateBalancedOutput, titleOutputRef: { id: "duplicate-output", hash: hashUnifiedContent(duplicateBalancedOutput) }, contentMaster }),
  (error) => error instanceof TypeError === false
    && error.code === "XHS_CONTENT_COMPONENT_INVALID"
    && error.details.fieldPaths.includes("input.titleOutput.candidates[].title_id")
    && error.details.fieldPaths.includes("input.titleOutput.recommendations.balanced")
    && !JSON.stringify(error.details).includes("duplicate balanced title")
);
for (const [name, mutate, expectedPath] of [
  ["null candidates", (output) => { output.candidates = null; }, "input.titleOutput.candidates"],
  ["primitive candidates", (output) => { output.candidates = "invalid"; }, "input.titleOutput.candidates"],
  ["null recommendations", (output) => { output.recommendations = null; }, "input.titleOutput.recommendations.balanced"],
  ["primitive recommendations", (output) => { output.recommendations = 7; }, "input.titleOutput.recommendations.balanced"]
]) {
  const malformed = titleOutput("safe malformed output", `TITLE-${name}`);
  mutate(malformed);
  assert.throws(
    () => createXhsFinalTitleBinding({ id: `malformed-${name}`, postCopy, titleOutput: malformed, titleOutputRef: { id: `output-${name}`, hash: hashUnifiedContent(malformed) }, contentMaster }),
    (error) => error instanceof TypeError === false && error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes(expectedPath),
    `${name} must fail through the total validator`
  );
}
const staleCarouselDraft = carouselDraft(postCopy, valid.finalTitleBinding);
staleCarouselDraft.finalTitleBindingRef.hash = "0".repeat(64);
assert.throws(() => createXhsCarouselPlanV2(staleCarouselDraft, { postCopy, finalTitleBinding: valid.finalTitleBinding }), (error) => error.details.fieldPaths.includes("input.finalTitleBindingRef"));
assert.throws(() => createXhsCarouselPlanV2(carouselDraft(postCopy, valid.finalTitleBinding, postCopy.recommendedTitle), { postCopy, finalTitleBinding: valid.finalTitleBinding }), (error) => error.details.fieldPaths.includes("input.pages[0].textLayers.headline"));

const legacyCarousel = createXhsCarouselPlan(legacyCarouselDraft(postCopy));
validateXhsCarouselPlan(legacyCarousel);
const legacyVisual = createXhsVisualAssetPlan(visualDraft(legacyCarousel));
const legacyTrace = compileXhsTraceability({ postCopy, carouselPlan: legacyCarousel, visualAssetPlan: legacyVisual, contentMaster, authorizedReferenceAssets: [assetRef] });
const legacyPreflight = compileXhsContentPreflight({ postCopy, carouselPlan: legacyCarousel, visualAssetPlan: legacyVisual, traceability: legacyTrace, contentMaster, confirmedOutline, authorizedReferenceAssets: [assetRef] });
const packageV3 = assembleXhsPostPackageV3({ id: "package-v3", postCopy, carouselPlan: legacyCarousel, visualAssetPlan: legacyVisual, traceability: legacyTrace, preflightReport: legacyPreflight });
validateXhsPostPackageV3(packageV3);

const outlineContext = confirmedOutline.sections.map((section) => ({ sectionId: section.section_id, outlineRole: section.role }));
const creativeEnvelope = {
  status: "success", warnings: [], blocked_reasons: [],
  data: {
    schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", deck_id: "runtime-deck", canvas: { width: 1080, height: 1440, ratio: "3:4" }, reading_arc: "promise-action",
    pages: valid.carouselPlan.pages.map((page) => ({ page: page.page, outline_section_id: page.outlineSectionId, outline_role: page.outlineRole, role: page.role, objective: page.objective, takeaway: page.takeaway, text_layers: page.textLayers.map((layer) => ({ type: layer.type, text: layer.text, max_lines: layer.maxLines, priority: layer.priority })), layout_hint: page.layoutHint, fact_ids: [...page.factIds], interpretation_ids: [...page.interpretationIds], knowledge_asset_ids: [...page.knowledgeAssetIds] }))
  }
};
const runtimeSystem = {
  componentId: "runtime-carousel-v2", authorityBinding: structuredClone(authorityBinding), confirmedOutlineRef: authorityBinding.confirmedOutlineRef,
  confirmedOutlineSections: outlineContext, postCopy, designDnaRef: authorityBinding.designDnaRef, designDnaVersion: "dna-v1",
  authorizedFactIds: ["F001"], authorizedInterpretationIds: ["I001"], authorizedKnowledgeAssetIds: ["K001"], pageMustAvoid: roles.map(() => []),
  finalTitleContext: { binding: valid.finalTitleBinding }
};
const runtimeV2 = assembleXhsAtomicSkillOutput({ capability: "plan-xhs-carousel", envelope: creativeEnvelope, systemContext: runtimeSystem });
assert.equal(runtimeV2.contract, "XhsCarouselPlan@2.0");
assert.equal(runtimeV2.finalTitleBindingRef.hash, valid.finalTitleBinding.bindingHash);

const skillContext = {
  confirmedOutline, contentMaster, postCopy, finalTitleBinding: valid.finalTitleBinding, platformBrief: {},
  designDnaRef: authorityBinding.designDnaRef, designDna: {}
};
const validatorEnvelope = structuredClone(creativeEnvelope);
assert.equal(validateXhsCarouselPlanCreativeOutput(validatorEnvelope, skillContext), validatorEnvelope);
const preliminaryCover = structuredClone(validatorEnvelope);
preliminaryCover.data.pages[0].text_layers[0].text = postCopy.recommendedTitle;
assert.throws(() => validateXhsCarouselPlanCreativeOutput(preliminaryCover, skillContext), (error) => error.details.fieldPaths.includes("$.data.pages[0].text_layers"));

for (const [name, finalTitleContext, expectedPath] of [
  ["missing binding", {}, "system.finalTitleContext"],
  ["stale binding", { binding: { ...structuredClone(valid.finalTitleBinding), bindingHash: "0".repeat(64) } }, "system.finalTitleContext.binding"],
  ["unauthorized claim", { binding: (() => { const binding = structuredClone(valid.finalTitleBinding); binding.claimIds = ["PRIVATE-CLAIM"]; delete binding.bindingHash; binding.bindingHash = hashUnifiedContent(binding); return binding; })() }, "system.finalTitleContext.binding.claimIds"]
]) {
  let providerCalls = 0;
  await assert.rejects(
    () => runXhsAtomicSkill({ capability: "plan-xhs-carousel", input: { fixture: name }, systemContext: { ...runtimeSystem, finalTitleContext }, generateText: async () => { providerCalls += 1; return { data: structuredClone(creativeEnvelope) }; } }),
    (error) => error.code === "XHS_ATOMIC_SKILL_AUTHORITY_INVALID" && error.details.fieldPaths.includes(expectedPath)
  );
  assert.equal(providerCalls, 0, `${name} must fail before Provider invocation`);
}

console.log("xhs-final-title-contract-self-test: ok");
