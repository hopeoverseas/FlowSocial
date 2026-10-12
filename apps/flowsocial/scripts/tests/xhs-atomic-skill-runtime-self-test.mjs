import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { runXhsAtomicSkill } from "../../content-agent/xhs-atomic-skill-runtime.mjs";
import { contractExample, validateContract } from "../../llm/contracts.mjs";

const h = (token) => token.repeat(64).slice(0, 64);
const reference = (id, token) => ({ id, hash: h(token) });
const authorityBinding = {
  companyId: "company-fixture", accountId: "account-fixture",
  activeStrategySnapshotRef: reference("strategy-1", "a"), contentOpportunityRef: reference("opportunity-1", "b"),
  mechanismDecisionRef: reference("mechanism-1", "c"), contentProjectRef: reference("project-1", "d"),
  platformRunRef: reference("run-1", "e"), sharedContentMasterRef: reference("master-1", "f"),
  platformBriefRef: reference("brief-1", "1"), confirmedOutlineRef: reference("outline-1", "2"),
  writerContextRef: reference("writer-1", "3"), designDnaRef: reference("dna-1", "4")
};
const outline = [
  ["s1", "hook"], ["s2", "problem"], ["s3", "diagnosis"],
  ["s4", "method"], ["s5", "evidence"], ["s6", "action"]
].map(([sectionId, outlineRole]) => ({ sectionId, outlineRole }));
const systemBase = { authorityBinding, confirmedOutlineRef: authorityBinding.confirmedOutlineRef, confirmedOutlineSections: outline };

const postEnvelope = {
  status: "success",
  data: {
    schemaVersion: "1.0", contract: "XhsPostCopyCreativeOutput@1.0", contentPromise: "六页讲清一个可执行方法",
    engagementStrategy: { mode: "auto", primaryAction: "save", reason: "便于稍后照做", ctaPlacement: "ending", ctaText: "收藏后执行" },
    titleCandidates: [
      { title: "六步完成目标", hookType: "result", claimIds: [], risk: "low" },
      { title: "总卡住？检查六步", hookType: "problem", claimIds: [], risk: "low" },
      { title: "一份六步行动清单", hookType: "checklist", claimIds: [], risk: "low" }
    ], recommendedTitle: "六步完成目标", opening: "先看清问题。",
    bodySections: outline.map((item, index) => ({ sectionId: item.sectionId, outlineRole: item.outlineRole, role: ({ hook: "scene", problem: "problem", diagnosis: "conclusion", method: "method", evidence: "evidence", action: "summary" })[item.outlineRole], text: `正文段落${index + 1}`, claimIds: [], knowledgeAssetIds: [] })),
    ending: "现在开始第一步。", pinnedComment: "", hashtags: ["行动清单", "实用方法", "效率提升"], cta: "收藏后执行。", promotionUse: { mode: "none", itemIds: [], disclosure: "" }
  }, warnings: [], blocked_reasons: []
};
const postSystem = { ...systemBase, componentId: "xhs-post-copy-fixture", contentMasterRef: authorityBinding.sharedContentMasterRef, platformBriefRef: authorityBinding.platformBriefRef, writerContextRef: authorityBinding.writerContextRef, mechanismDecisionRef: authorityBinding.mechanismDecisionRef, authorizedClaimIds: [], authorizedKnowledgeAssetIds: [], promotionPolicy: { mode: "none", allowedItemIds: [], disclosure: "" } };

const requests = new Map();
async function invoke(capability, envelope, systemContext) {
  let calls = 0;
  let downstream = 0;
  const result = await runXhsAtomicSkill({ capability, input: { fixture: capability }, systemContext, generateText: async (request) => { calls += 1; requests.set(capability, request); return { data: structuredClone(envelope), mode: "offline_fixture" }; }, onComponent: () => { downstream += 1; } });
  assert.equal(calls, 1);
  assert.equal(downstream, 1);
  assert.equal(result.executionRecord.maxAttempts, 1);
  assert.equal(result.executionRecord.automaticRetries, 0);
  assert.equal(result.executionRecord.productionEligibleOutput, false);
  return result.component;
}

const postCopy = await invoke("write-xhs-post-copy", postEnvelope, postSystem);
assert.equal(postCopy.contract, "XhsPostCopy@1.0");
assert(Object.isFrozen(postCopy));
const promiseBoundCopy = await invoke("write-xhs-post-copy", postEnvelope, {
  ...postSystem,
  componentId: "xhs-post-copy-promise-binding-fixture",
  confirmedContentPromise: "这是人工确认大纲中的精确内容承诺"
});
assert.equal(promiseBoundCopy.contentPromise, "这是人工确认大纲中的精确内容承诺");

const compositeReferenceEnvelope = structuredClone(postEnvelope);
compositeReferenceEnvelope.data.titleCandidates[0].claimIds = ["F001，I001"];
compositeReferenceEnvelope.data.titleCandidates[0].hookType = "guide";
const normalizedPostCopy = await invoke("write-xhs-post-copy", compositeReferenceEnvelope, {
  ...postSystem,
  componentId: "xhs-post-copy-normalized-fixture",
  authorizedClaimIds: ["F001", "I001"]
});
assert.deepEqual(normalizedPostCopy.titleCandidates[0].claimIds, ["F001", "I001"]);
assert.equal(normalizedPostCopy.titleCandidates[0].hookType, "checklist");

const opinionReferenceEnvelope = structuredClone(postEnvelope);
opinionReferenceEnvelope.data.bodySections[0].claimIds = ["O001"];
const opinionSafePostCopy = await invoke("write-xhs-post-copy", opinionReferenceEnvelope, {
  ...postSystem,
  componentId: "xhs-post-copy-opinion-fixture",
  authorizedNonClaimOpinionIds: ["O001"]
});
assert.deepEqual(opinionSafePostCopy.bodySections[0].claimIds, []);

const finalTitleOutput = {
  id: "title-output-fixture", platform: "xiaohongshu",
  candidates: [{ title_id: "T1", title: "系统最终标题", claim_ids: [], risk: "low" }],
  recommendations: { balanced: "T1" }
};
const finalTitleBindingBase = {
  schemaVersion: "1.0", contract: "XhsFinalTitleBinding@1.0", id: "final-title-fixture",
  authorityBinding: structuredClone(postCopy.authorityBinding), postCopyRef: { id: postCopy.id, hash: postCopy.componentHash },
  titleOutputRef: { id: finalTitleOutput.id, hash: hashUnifiedContent(finalTitleOutput) }, recommendation: "balanced",
  titleId: "T1", title: "系统最终标题", claimIds: []
};
const finalTitleBinding = { ...finalTitleBindingBase, bindingHash: hashUnifiedContent(finalTitleBindingBase) };

const pageRole = { hook: "cover", problem: "problem", diagnosis: "conclusion", method: "method", evidence: "evidence", action: "cta" };
const carouselEnvelope = { status: "success", data: { schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", deck_id: "deck-fixture", reading_arc: "承诺到行动", pages: outline.map((_, index) => ({ objective: `页面目标${index + 1}`, takeaway: `独立结论${index + 1}`, text_layers: [{ type: "headline", text: index === 0 ? postCopy.recommendedTitle : `页面文案${index + 1}`, max_lines: 2, priority: 1 }], layout_hint: `布局${index + 1}`, fact_ids: [], interpretation_ids: [], knowledge_asset_ids: [] })) }, warnings: [], blocked_reasons: [] };
carouselEnvelope.data.pages[0].text_layers[0].text = finalTitleBinding.title;
const carouselSystem = { ...systemBase, componentId: "xhs-carousel-fixture", postCopy, finalTitleContext: { binding: finalTitleBinding }, designDnaRef: authorityBinding.designDnaRef, designDnaVersion: "dna-v1", authorizedFactIds: [], authorizedInterpretationIds: [], authorizedKnowledgeAssetIds: [], pageMustAvoid: outline.map(() => []) };
const carouselPlan = await invoke("plan-xhs-carousel", carouselEnvelope, carouselSystem);
assert.equal(carouselPlan.contract, "XhsCarouselPlan@2.0");
assert.deepEqual(carouselPlan.canvas, { width: 1080, height: 1440, ratio: "3:4" });
assert.deepEqual(carouselPlan.pages.map(({ page, outlineSectionId, outlineRole, role }) => ({ page, outlineSectionId, outlineRole, role })),
  outline.map((item, index) => ({ page: index + 1, outlineSectionId: item.sectionId, outlineRole: item.outlineRole, role: pageRole[item.outlineRole] })));

const repeatedTakeawayEnvelope = structuredClone(carouselEnvelope);
repeatedTakeawayEnvelope.data.section_drafts = repeatedTakeawayEnvelope.data.pages;
delete repeatedTakeawayEnvelope.data.pages;
repeatedTakeawayEnvelope.data.section_drafts.forEach((page) => { page.takeaway = "同一个核心结论"; });
repeatedTakeawayEnvelope.data.section_drafts[0].fact_ids = ["O001"];
repeatedTakeawayEnvelope.data.section_drafts[1].fact_ids = ["F001"];
const differentiatedCarousel = await invoke("plan-xhs-carousel", repeatedTakeawayEnvelope, { ...carouselSystem, componentId: "xhs-carousel-differentiated-fixture", authorizedFactIds: ["F001"], authorizedNonClaimOpinionIds: ["O001"] });
assert.equal(new Set(differentiatedCarousel.pages.map((page) => page.takeaway)).size, differentiatedCarousel.pages.length);
assert.deepEqual(differentiatedCarousel.pages[0].factIds, []);
assert.deepEqual(differentiatedCarousel.pages[1].factIds, []);

const gatewayExample = contractExample("XhsCarouselPlanCreativeOutput@1.0");
assert.equal(validateContract("XhsCarouselPlanCreativeOutput@1.0", gatewayExample).valid, true);
for (const nonSuccess of [
  { status: "blocked", data: null, warnings: [], blocked_reasons: ["missing authority"] },
  { status: "needs_review", data: null, warnings: ["review required"], blocked_reasons: ["ambiguous narrative"] }
]) assert.equal(validateContract("XhsCarouselPlanCreativeOutput@1.0", nonSuccess).valid, true);

const visualEnvelope = { status: "success", data: { schemaVersion: "1.0", contract: "XhsVisualAssetPlanCreativeOutput@1.0", pageVisuals: outline.map((_, index) => ({ page: index + 1, visualFunction: "explain", visualNeed: `排版层级${index + 1}`, renderStrategy: "html_css", mustKeep: [], mustAvoid: [] })), imageSpecs: [], skippedPages: outline.map((_, index) => ({ page: index + 1, reason: "html_css" })), pageAssetBindings: outline.map((_, index) => ({ page: index + 1, plannedAssetIds: [] })) }, warnings: [], blocked_reasons: [] };
const visualSystem = { ...systemBase, componentId: "xhs-visual-fixture", carouselPlan, designDnaRef: authorityBinding.designDnaRef, designDnaVersion: "dna-v1", pageTextTruth: carouselPlan.pages.map((page) => ({ page: page.page, textLayers: structuredClone(page.textLayers) })), authorizedReferenceAssets: [] };
const visualPlan = await invoke("plan-xhs-visual-assets", visualEnvelope, visualSystem);
assert.equal(visualPlan.contract, "XhsVisualAssetPlan@1.0");
assert.equal(visualPlan.imageSpecs.length, 0);

const visualWithUnboundReference = structuredClone(visualEnvelope);
visualWithUnboundReference.data.pageVisuals[0].renderStrategy = "generated_raster";
visualWithUnboundReference.data.skippedPages = visualWithUnboundReference.data.skippedPages.filter((item) => item.page !== 1);
visualWithUnboundReference.data.imageSpecs = [{ plannedAssetId: "xhs-page-1-plan", page: 1, useCase: "stylized-concept", assetType: "scene-illustration", scene: "经营者面对客户管理流程", subject: "抽象业务流程", styleAndMedium: "品牌插画", composition: "主体居中并保留文字安全区", lighting: "柔和自然光", palette: ["品牌主色"], materials: "纸张质感", textSafeArea: "上方留白", prompt: "business workflow editorial illustration without text", negativePrompt: "text letters numbers watermark logo interface screenshot illegible symbols", referenceAssetIds: ["unbound-style-ref"], size: "1024x1536", mustKeep: [], mustAvoid: [], textPolicy: "no_text_in_image" }];
visualWithUnboundReference.data.pageAssetBindings[0].plannedAssetIds = ["xhs-page-1-plan"];
const visualWithoutUnboundReference = await invoke("plan-xhs-visual-assets", visualWithUnboundReference, { ...visualSystem, componentId: "xhs-visual-unbound-fixture" });
assert.deepEqual(visualWithoutUnboundReference.imageSpecs[0].referenceAssetIds, []);

for (const [capability, request] of requests) {
  assert.equal(request.skill_runtime.skill_name, capability);
  assert.equal(request.expected_contract, ({ "write-xhs-post-copy": "XhsPostCopyCreativeOutput@1.0", "plan-xhs-carousel": "XhsCarouselPlanCreativeOutput@1.0", "plan-xhs-visual-assets": "XhsVisualAssetPlanCreativeOutput@1.0" })[capability]);
  assert.match(request.skill_instructions, new RegExp(capability.replaceAll("-", "[ -]"), "i"));
  assert(request.skill_contract.length > 100);
  assert.deepEqual(request.skill_reference_bundle.map((item) => item.path), ["SKILL.md", "references/contract.md"]);
}

const failures = [
  ["write-xhs-post-copy", { ...postEnvelope, status: "blocked", data: null, blocked_reasons: ["authority conflict"] }, postSystem, "XHS_ATOMIC_SKILL_NON_SUCCESS"],
  ["plan-xhs-carousel", { ...carouselEnvelope, extra: true }, carouselSystem, "XHS_ATOMIC_SKILL_OUTPUT_INVALID"],
  ["plan-xhs-visual-assets", visualEnvelope, { ...visualSystem, designDnaRef: reference("dna-stale", "9") }, "XHS_ATOMIC_SKILL_AUTHORITY_INVALID"]
];
for (const [index, [capability, envelope, systemContext, code]] of failures.entries()) {
  let calls = 0;
  let downstream = 0;
  await assert.rejects(() => runXhsAtomicSkill({ capability, input: { fixture: "failure" }, systemContext, generateText: async () => { calls += 1; return { data: structuredClone(envelope), mode: "offline_fixture" }; }, onComponent: () => { downstream += 1; } }), (error) => {
    assert.equal(error.code, code);
    assert(Array.isArray(error.details.fieldPaths));
    return true;
  });
  assert.equal(calls, index === 2 ? 0 : 1);
  assert.equal(downstream, 0);
}

const postNullItems = structuredClone(postEnvelope);
postNullItems.data.promotionUse.itemIds = null;
const carouselNullLayers = structuredClone(carouselEnvelope);
carouselNullLayers.data.pages[0].text_layers = null;
const visualNullReferences = structuredClone(visualEnvelope);
visualNullReferences.data.imageSpecs = [{ plannedAssetId: "bad-plan", page: 1, useCase: "stylized-concept", assetType: "scene-illustration", scene: "scene", subject: "subject", styleAndMedium: "style", composition: "composition", lighting: "lighting", palette: [], materials: "materials", textSafeArea: "safe", prompt: "prompt", negativePrompt: "text letters numbers watermark logo interface screenshot illegible symbols", referenceAssetIds: null, size: "1024x1536", mustKeep: [], mustAvoid: [], textPolicy: "no_text_in_image" }];
const missingEnvelopeKey = structuredClone(postEnvelope);
delete missingEnvelopeKey.warnings;
const extraDataKey = structuredClone(postEnvelope);
extraDataKey.data.unexpected = true;
const primitiveData = { status: "success", data: "wrong-shape", warnings: [], blocked_reasons: [] };
const wrongPagesType = structuredClone(carouselEnvelope);
wrongPagesType.data.pages = "wrong-shape";
const nestedWrongType = structuredClone(postEnvelope);
nestedWrongType.data.engagementStrategy.ctaText = null;

const carouselCases = [];
const carouselCase = (path, mutate) => { const value = structuredClone(carouselEnvelope); mutate(value); carouselCases.push([value, path]); };
carouselCase("$.data", (value) => { value.data.extra = true; });
carouselCase("$.data.pages[]", (value) => { delete value.data.pages[0].layout_hint; });
carouselCase("$.data.pages.length", (value) => { value.data.pages.pop(); });
carouselCase("$.data.pages[]", (value) => { value.data.pages[1].page = 2; });
carouselCase("$.data.pages[0].text_layers", (value) => { value.data.pages[0].text_layers[0].text = postCopy.recommendedTitle; });
carouselCase("$.data.pages[].text_layers[]", (value) => { value.data.pages[1].text_layers[0].type = "unknown"; });
carouselCase("$.data.pages[].text_layers[]", (value) => { value.data.pages[1].text_layers[0].priority = 0; });
carouselCase("$.data.pages[].takeaway", (value) => { value.data.pages[1].takeaway = value.data.pages[0].takeaway; });
carouselCase("$.data.pages[].text_layers[]", (value) => { value.data.pages[1].text_layers = structuredClone(value.data.pages[0].text_layers); });
carouselCase("$.data.fact_ids", (value) => { value.data.pages[1].fact_ids = ["UNAUTHORIZED"]; });

const malformedOutputs = [
  ["write-xhs-post-copy", postNullItems, postSystem, "$.data.promotionUse.itemIds"],
  ["plan-xhs-carousel", carouselNullLayers, carouselSystem, "$.data.pages[].text_layers"],
  ["plan-xhs-visual-assets", visualNullReferences, visualSystem, "$.data.imageSpecs[].referenceAssetIds"],
  ["write-xhs-post-copy", missingEnvelopeKey, postSystem, "$"],
  ["write-xhs-post-copy", extraDataKey, postSystem, "$.data"],
  ["write-xhs-post-copy", primitiveData, postSystem, "$.data"],
  ["plan-xhs-carousel", wrongPagesType, carouselSystem, "$.data.pages"],
  ["write-xhs-post-copy", nestedWrongType, postSystem, "$.data.engagementStrategy.ctaText"]
];
for (const [capability, envelope, systemContext, expectedPath] of malformedOutputs) {
  let calls = 0;
  let downstream = 0;
  await assert.rejects(() => runXhsAtomicSkill({ capability, input: { fixture: "malformed-output" }, systemContext, generateText: async () => { calls += 1; return { data: structuredClone(envelope), mode: "offline_fixture" }; }, onComponent: () => { downstream += 1; } }), (error) => {
    assert.equal(error instanceof TypeError, false, `must not leak TypeError for ${expectedPath}`);
    assert.equal(error.code, "XHS_ATOMIC_SKILL_OUTPUT_INVALID");
    assert(error.details.fieldPaths.includes(expectedPath), `missing safe field path ${expectedPath}: ${JSON.stringify(error.details.fieldPaths)}`);
    return true;
  }, `expected malformed output rejection for ${expectedPath}`);
  assert.equal(calls, 1);
  assert.equal(downstream, 0);
}

for (const [envelope, expectedPath] of carouselCases) {
  let calls = 0;
  let rejection = null;
  try { await runXhsAtomicSkill({ capability: "plan-xhs-carousel", input: { fixture: "conformance" }, systemContext: carouselSystem, generateText: async () => { calls += 1; return { data: envelope, mode: "offline_fixture" }; } }); }
  catch (error) { rejection = error; }
  assert(rejection, `expected rejection for ${expectedPath}`);
  assert.equal(rejection.code, "XHS_ATOMIC_SKILL_OUTPUT_INVALID");
  assert(rejection.details.fieldPaths.includes(expectedPath), `${expectedPath}: ${JSON.stringify(rejection.details)}`);
  assert.equal(calls, 1);
}

const gatewayPagesKey = Array.isArray(gatewayExample.data.pages) ? "pages" : "section_drafts";
const gatewayExtra = structuredClone(gatewayExample); gatewayExtra.data[gatewayPagesKey][0].extra = true;
const gatewayExtraValidation = validateContract("XhsCarouselPlanCreativeOutput@1.0", gatewayExtra);
assert.equal(gatewayExtraValidation.valid, false);
assert.deepEqual(gatewayExtraValidation.validationFieldPaths, [`$.data.${gatewayPagesKey}[0]`]);
const gatewayMissing = structuredClone(gatewayExample); delete gatewayMissing.data[gatewayPagesKey][0].text_layers;
const gatewayMissingValidation = validateContract("XhsCarouselPlanCreativeOutput@1.0", gatewayMissing);
assert.equal(gatewayMissingValidation.valid, false);
assert(gatewayMissingValidation.validationFieldPaths.includes(`$.data.${gatewayPagesKey}[0]`));

assert.equal(hashUnifiedContent(postEnvelope), hashUnifiedContent(structuredClone(postEnvelope)), "adapter must not mutate Provider output");
console.log("xhs atomic Skill runtime self-test passed");
