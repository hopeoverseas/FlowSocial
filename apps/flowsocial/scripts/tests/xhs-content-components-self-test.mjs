import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { validateUnifiedSkillDomainOutput } from "../../content-agent/unified-skill-output-contracts.mjs";
import {
  XHS_CONTENT_COMPONENT_CONTRACTS,
  assembleXhsPostPackageV3,
  compileXhsContentPreflight,
  compileXhsTraceability,
  createXhsCarouselPlan,
  createXhsPostCopy,
  createXhsV2ProjectionContext,
  createXhsVisualAssetPlan,
  projectXhsPostPackageV3ToV2ReadOnly,
  validateXhsCarouselPlan,
  validateXhsContentPreflightReport,
  validateXhsPostCopy,
  validateXhsPostPackageV3,
  validateXhsTraceability,
  validateXhsV2ReadOnlyProjection,
  validateXhsVisualAssetPlan
} from "../../content-agent/xhs-content-components.mjs";

const outlineRoles = ["hook", "problem", "diagnosis", "evidence", "example", "action"];
const bodyRoles = ["scene", "problem", "conclusion", "evidence", "evidence", "summary"];
const pageRoles = ["cover", "problem", "conclusion", "evidence", "case", "cta"];
const contentMaster = {
  content_master_id: "master_fixture",
  confirmed_facts: [{ fact_id: "F001", fact: "fixture fact", source_ids: ["SRC001"] }],
  supported_interpretations: [{ interpretation_id: "I001", interpretation: "fixture interpretation" }],
  author_opinions: [{ opinion_id: "O001", opinion: "fixture opinion" }],
  source_list: [{ source_id: "SRC001", title: "fixture" }],
  knowledge_contract: { allowed_assets: [{ asset_id: "K001" }] },
  promotion: { mode: "none", allowed_items: [], disclosure: "" }
};
const confirmedOutline = {
  outline_id: "outline_fixture",
  content_promise: "fixture promise",
  sections: outlineRoles.map((role, index) => ({ section_id: `S${index + 1}`, role }))
};
const projectionContext = createXhsV2ProjectionContext({
  schemaVersion: "1.0",
  contract: "XhsV2ProjectionContext@1.0",
  id: "writer_context_fixture",
  platform: "xiaohongshu",
  topicId: "topic_fixture",
  intentProfileId: "intent_fixture",
  contentPurposeId: "knowledge_howto",
  accountContext: { subject_type: "company", account_mode: "official", matrix_role: "discovery", trust_source: "institution" },
  creativeMechanism: "search_answer",
  journeyStage: "discover",
  matrixCoordination: { shared_campaign_topic_id: "", differentiation_angle: "standalone", prohibited_overlap: [] }
});
const assetRef = { id: "REF001", hash: "a".repeat(64) };
const authorityBinding = {
  companyId: "company_fixture",
  accountId: "account_fixture",
  activeStrategySnapshotRef: { id: "strategy_fixture", hash: "1".repeat(64) },
  contentOpportunityRef: { id: "opportunity_fixture", hash: "2".repeat(64) },
  mechanismDecisionRef: { id: "mechanism_fixture", hash: "3".repeat(64) },
  contentProjectRef: { id: "project_fixture", hash: "4".repeat(64) },
  platformRunRef: { id: "run_fixture", hash: "5".repeat(64) },
  sharedContentMasterRef: { id: contentMaster.content_master_id, hash: hashUnifiedContent(contentMaster) },
  platformBriefRef: { id: "brief_fixture", hash: "6".repeat(64) },
  confirmedOutlineRef: { id: confirmedOutline.outline_id, hash: hashUnifiedContent(confirmedOutline) },
  writerContextRef: { id: projectionContext.id, hash: projectionContext.contextHash },
  designDnaRef: { id: "dna_fixture", hash: "7".repeat(64) }
};

function postCopyDraft(overrides = {}) {
  return {
    schemaVersion: "1.0",
    contract: XHS_CONTENT_COMPONENT_CONTRACTS.postCopy,
    id: "post_copy_fixture",
    authorityBinding: structuredClone(authorityBinding),
    contentPromise: "fixture promise",
    engagementStrategy: { mode: "auto", primaryAction: "save", reason: "fixture", ctaPlacement: "ending", ctaText: "保存" },
    titleCandidates: ["fixture title", "fixture problem", "fixture checklist"].map((title, index) => ({ title, hookType: ["result", "problem", "checklist"][index], claimIds: ["F001"], risk: "low" })),
    recommendedTitle: "fixture title",
    opening: "fixture opening",
    bodySections: outlineRoles.map((outlineRole, index) => ({ sectionId: `S${index + 1}`, outlineRole, role: bodyRoles[index], text: `fixture body ${index + 1}`, claimIds: ["F001"], knowledgeAssetIds: index === 1 ? ["K001"] : [] })),
    ending: "fixture ending",
    pinnedComment: "",
    hashtags: ["fixture", "knowledge", "method"],
    cta: "保存",
    promotionUse: { mode: "none", itemIds: [], disclosure: "" },
    ...structuredClone(overrides)
  };
}

function carouselDraft(postCopy, overrides = {}) {
  return {
    schemaVersion: "1.0",
    contract: XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlan,
    id: "carousel_fixture",
    authorityBinding: structuredClone(authorityBinding),
    postCopyRef: { id: postCopy.id, hash: postCopy.componentHash },
    deckId: "deck_fixture",
    canvas: { width: 1080, height: 1440, ratio: "3:4" },
    designDnaVersion: "dna_fixture_v1",
    readingArc: "promise-evidence-action",
    pages: outlineRoles.map((outlineRole, index) => ({
      page: index + 1,
      outlineSectionId: `S${index + 1}`,
      outlineRole,
      role: pageRoles[index],
      objective: `objective ${index + 1}`,
      takeaway: `takeaway ${index + 1}`,
      textLayers: [{ type: "headline", text: index === 0 ? "fixture title" : `page ${index + 1}`, maxLines: 3, priority: 1 }],
      layoutHint: `layout ${index + 1}`,
      factIds: ["F001"],
      interpretationIds: [],
      knowledgeAssetIds: index === 1 ? ["K001"] : [],
      mustAvoid: []
    })),
    ...structuredClone(overrides)
  };
}

function visualDraft(carouselPlan, overrides = {}) {
  return {
    schemaVersion: "1.0",
    contract: XHS_CONTENT_COMPONENT_CONTRACTS.visualAssetPlan,
    id: "visual_fixture",
    authorityBinding: structuredClone(authorityBinding),
    carouselPlanRef: { id: carouselPlan.id, hash: carouselPlan.componentHash },
    designDnaVersion: "dna_fixture_v1",
    pageVisuals: carouselPlan.pages.map((page) => ({ page: page.page, visualFunction: page.page === 3 ? "demonstrate" : "explain", visualNeed: `visual ${page.page}`, renderStrategy: page.page === 3 ? "generated_raster" : "html_css", mustKeep: [], mustAvoid: [] })),
    imageSpecs: [{
      plannedAssetId: "PLAN001", page: 3, useCase: "stylized-concept", assetType: "scene-illustration",
      scene: "scene", subject: "subject", styleAndMedium: "style", composition: "composition", lighting: "lighting",
      palette: ["neutral"], materials: "paper", textSafeArea: "center", prompt: "no text image",
      negativePrompt: "text watermark", referenceAssetIds: [assetRef.id], designDnaVersion: "dna_fixture_v1",
      size: "1024x1536", mustKeep: [], mustAvoid: [], textPolicy: "no_text_in_image"
    }],
    skippedPages: carouselPlan.pages.filter((page) => page.page !== 3).map((page) => ({ page: page.page, reason: "html_css" })),
    authorizedReferenceAssets: [structuredClone(assetRef)],
    pageAssetBindings: carouselPlan.pages.map((page) => ({ page: page.page, plannedAssetIds: page.page === 3 ? ["PLAN001"] : [] })),
    ...structuredClone(overrides)
  };
}

function buildValid() {
  const postCopy = createXhsPostCopy(postCopyDraft());
  const carouselPlan = createXhsCarouselPlan(carouselDraft(postCopy));
  const visualAssetPlan = createXhsVisualAssetPlan(visualDraft(carouselPlan));
  const traceability = compileXhsTraceability({ postCopy, carouselPlan, visualAssetPlan, contentMaster, authorizedReferenceAssets: [assetRef] });
  const preflightReport = compileXhsContentPreflight({ postCopy, carouselPlan, visualAssetPlan, traceability, contentMaster, confirmedOutline, authorizedReferenceAssets: [assetRef] });
  const packageV3 = assembleXhsPostPackageV3({ id: "package_fixture", postCopy, carouselPlan, visualAssetPlan, traceability, preflightReport });
  return { postCopy, carouselPlan, visualAssetPlan, traceability, preflightReport, packageV3 };
}

const inputsBefore = { contentMaster: structuredClone(contentMaster), confirmedOutline: structuredClone(confirmedOutline), authorityBinding: structuredClone(authorityBinding), assetRef: structuredClone(assetRef) };
const valid = buildValid();
assert.equal(valid.preflightReport.status, "passed");
assert.ok(Object.values(valid).every(Object.isFrozen));
assert.deepEqual({ contentMaster, confirmedOutline, authorityBinding, assetRef }, inputsBefore, "component pipeline must not mutate inputs");
assert.equal(createXhsPostCopy(postCopyDraft()).componentHash, valid.postCopy.componentHash, "component hash must be stable");

const validatorCases = [
  ["post copy", validateXhsPostCopy, valid.postCopy],
  ["carousel", validateXhsCarouselPlan, valid.carouselPlan],
  ["visual", validateXhsVisualAssetPlan, valid.visualAssetPlan],
  ["trace", validateXhsTraceability, valid.traceability],
  ["preflight", validateXhsContentPreflightReport, valid.preflightReport],
  ["package", validateXhsPostPackageV3, valid.packageV3]
];
for (const [name, validator, source] of validatorCases) {
  for (const shape of ["missing", "extra", "null", "primitive"]) {
    let invalid;
    if (shape === "null") invalid = null;
    else if (shape === "primitive") invalid = 7;
    else {
      invalid = structuredClone(source);
      if (shape === "missing") delete invalid.schemaVersion;
      else invalid.unexpected = "PRIVATE_VALUE";
    }
    assert.throws(
      () => validator(invalid),
      (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("$") && !JSON.stringify(error.details).includes("PRIVATE_VALUE"),
      `${name} ${shape} must fail at a safe exact-key path`
    );
  }
  const tampered = structuredClone(source);
  const hashField = ["trace", "preflight", "package"].includes(name) ? ({ trace: "traceHash", preflight: "reportHash", package: "packageHash" })[name] : "componentHash";
  tampered[hashField] = "f".repeat(64);
  assert.throws(() => validator(tampered), (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes(`$.${hashField}`), `${name} hash tampering must fail`);
}

const mismatchedAuthority = structuredClone(authorityBinding);
mismatchedAuthority.accountId = "other_account";
const mismatchedCarousel = createXhsCarouselPlan(carouselDraft(valid.postCopy, { authorityBinding: mismatchedAuthority }));
assert.throws(
  () => compileXhsTraceability({ postCopy: valid.postCopy, carouselPlan: mismatchedCarousel, visualAssetPlan: valid.visualAssetPlan, contentMaster, authorizedReferenceAssets: [assetRef] }),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.authorityBinding")
);

assert.throws(
  () => compileXhsTraceability({ postCopy: valid.postCopy, carouselPlan: valid.carouselPlan, visualAssetPlan: valid.visualAssetPlan, contentMaster, authorizedReferenceAssets: [{ id: assetRef.id, hash: "b".repeat(64) }] }),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.referenceAssets.authorized"),
  "unauthorized visual reference must fail"
);

const danglingCopyDraft = postCopyDraft();
danglingCopyDraft.bodySections[0].claimIds = ["UNKNOWN_PRIVATE_CLAIM"];
const danglingCopy = createXhsPostCopy(danglingCopyDraft);
const danglingCarousel = createXhsCarouselPlan(carouselDraft(danglingCopy));
const danglingVisual = createXhsVisualAssetPlan(visualDraft(danglingCarousel));
assert.throws(
  () => compileXhsTraceability({ postCopy: danglingCopy, carouselPlan: danglingCarousel, visualAssetPlan: danglingVisual, contentMaster, authorizedReferenceAssets: [assetRef] }),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.claims.authorized") && !JSON.stringify(error.details).includes("UNKNOWN_PRIVATE_CLAIM"),
  "dangling claims must fail without echoing content"
);

const crossPageDraft = carouselDraft(valid.postCopy);
crossPageDraft.pages[0].factIds = [];
crossPageDraft.pages[0].interpretationIds = ["I001"];
const crossPageCarousel = createXhsCarouselPlan(crossPageDraft);
const crossPageVisual = createXhsVisualAssetPlan(visualDraft(crossPageCarousel));
assert.throws(
  () => compileXhsTraceability({ postCopy: valid.postCopy, carouselPlan: crossPageCarousel, visualAssetPlan: crossPageVisual, contentMaster, authorizedReferenceAssets: [assetRef] }),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.claims.crossPageConsistency"),
  "an authorized claim used on a page outside its matching body section must fail"
);

const repeatedCarouselDraft = carouselDraft(valid.postCopy);
repeatedCarouselDraft.pages[2].takeaway = repeatedCarouselDraft.pages[1].takeaway;
const repeatedCarousel = createXhsCarouselPlan(repeatedCarouselDraft);
const repeatedVisual = createXhsVisualAssetPlan(visualDraft(repeatedCarousel));
const repeatedTrace = compileXhsTraceability({ postCopy: valid.postCopy, carouselPlan: repeatedCarousel, visualAssetPlan: repeatedVisual, contentMaster, authorizedReferenceAssets: [assetRef] });
const failedPreflight = compileXhsContentPreflight({ postCopy: valid.postCopy, carouselPlan: repeatedCarousel, visualAssetPlan: repeatedVisual, traceability: repeatedTrace, contentMaster, confirmedOutline, authorizedReferenceAssets: [assetRef] });
assert.equal(failedPreflight.status, "failed");
assert.equal(failedPreflight.checks.find((item) => item.check === "cross_page_repetition").result, "fail");
assert.throws(
  () => assembleXhsPostPackageV3({ id: "failed_package", postCopy: valid.postCopy, carouselPlan: repeatedCarousel, visualAssetPlan: repeatedVisual, traceability: repeatedTrace, preflightReport: failedPreflight }),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("input.preflightReport.status")
);

const focusedMaster = structuredClone(contentMaster);
focusedMaster.promotion = { mode: "focused", allowed_items: [{ id: "PROMO001" }], disclosure: "fixture disclosure" };
const focusedAuthority = structuredClone(authorityBinding);
focusedAuthority.sharedContentMasterRef = { id: focusedMaster.content_master_id, hash: hashUnifiedContent(focusedMaster) };
function buildFocusedPreflight(promotionUse) {
  const postCopy = createXhsPostCopy(postCopyDraft({ authorityBinding: focusedAuthority, promotionUse }));
  const carouselPlan = createXhsCarouselPlan(carouselDraft(postCopy, { authorityBinding: focusedAuthority }));
  const visualAssetPlan = createXhsVisualAssetPlan(visualDraft(carouselPlan, { authorityBinding: focusedAuthority }));
  const traceability = compileXhsTraceability({ postCopy, carouselPlan, visualAssetPlan, contentMaster: focusedMaster, authorizedReferenceAssets: [assetRef] });
  return compileXhsContentPreflight({ postCopy, carouselPlan, visualAssetPlan, traceability, contentMaster: focusedMaster, confirmedOutline, authorizedReferenceAssets: [assetRef] });
}
const focusedPreflight = buildFocusedPreflight({ mode: "focused", itemIds: ["PROMO001"], disclosure: "fixture disclosure" });
assert.equal(focusedPreflight.status, "passed", "authorized focused promotion with the exact disclosure must pass");
for (const [name, promotionUse] of [
  ["unauthorized item", { mode: "focused", itemIds: ["PROMO999"], disclosure: "fixture disclosure" }],
  ["policy mode mismatch", { mode: "soft", itemIds: ["PROMO001"], disclosure: "fixture disclosure" }],
  ["disclosure mismatch", { mode: "focused", itemIds: ["PROMO001"], disclosure: "wrong disclosure" }],
  ["empty focused item", { mode: "focused", itemIds: [], disclosure: "fixture disclosure" }]
]) {
  const report = buildFocusedPreflight(promotionUse);
  assert.equal(report.status, "failed", `${name} must fail deterministic preflight`);
  assert.equal(report.checks.find((item) => item.check === "promotion_policy").result, "fail");
}
assert.throws(
  () => createXhsPostCopy(postCopyDraft({ promotionUse: { mode: "direct", itemIds: ["PROMO001"], disclosure: "fixture disclosure" } })),
  (error) => error.code === "XHS_CONTENT_COMPONENT_INVALID" && error.details.fieldPaths.includes("$.promotionUse.mode"),
  "the split contract must not invent a direct promotion mode"
);

const projection = projectXhsPostPackageV3ToV2ReadOnly({ ...valid, packageV3: valid.packageV3, legacyProjectionContext: projectionContext });
validateXhsV2ReadOnlyProjection(projection);
assert.ok(Object.isFrozen(projection) && Object.isFrozen(projection.projectedPackage));
assert.deepEqual(projection.provenance, { kind: "derived_from_xhs_post_package_v3", readOnly: true, promotionEligible: false, nativeV2ProviderOutput: false });
assert.equal(projection.projectedContract, "XhsPostPackage@2.0");
assert.equal(projection.projectedPackage.traceability.page_claim_map.length, 6);
assert.equal(projection.projectedPackage.image_specs[0].asset_id, "PLAN001");
assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "write-xhs-content",
  platform: "xiaohongshu",
  outputContract: projection.projectedContract,
  runtimeOutput: { status: "success", data: projection.projectedPackage, warnings: [], blocked_reasons: [] },
  sourceContentMaster: contentMaster
}), "the explicitly marked projection must remain readable by the current v2 validator without changing native v2 output");

export const XHS_COMPONENT_SELF_TEST_CLAIMS = Object.freeze({
  providerCalls: 0,
  externalCalls: 0,
  databaseWrites: 0,
  orchestratorChanges: 0,
  legacyV2Mutation: false
});

console.log("xhs-content-components-self-test: ok");
