import { hashUnifiedContent } from "./unified-content-contracts.mjs";

export const XHS_CONTENT_COMPONENT_CONTRACTS = Object.freeze({
  postCopy: "XhsPostCopy@1.0",
  finalTitleBinding: "XhsFinalTitleBinding@1.0",
  carouselPlan: "XhsCarouselPlan@1.0",
  carouselPlanV2: "XhsCarouselPlan@2.0",
  visualAssetPlan: "XhsVisualAssetPlan@1.0",
  traceability: "XhsTraceability@1.0",
  traceabilityV2: "XhsTraceability@2.0",
  preflightReport: "XhsContentPreflightReport@1.0",
  preflightReportV2: "XhsContentPreflightReport@2.0",
  package: "XhsPostPackage@3.0",
  packageV4: "XhsPostPackage@4.0",
  legacyProjection: "XhsPostPackageV2ReadOnlyProjection@1.0"
});

const HASH = /^[a-f0-9]{64}$/;
const AUTHORITY_KEYS = [
  "companyId", "accountId", "activeStrategySnapshotRef", "contentOpportunityRef",
  "mechanismDecisionRef", "contentProjectRef", "platformRunRef", "sharedContentMasterRef",
  "platformBriefRef", "confirmedOutlineRef", "writerContextRef", "designDnaRef"
];
const REF_KEYS = ["id", "hash"];
const COMPONENT_REF_KEYS = ["postCopy", "carouselPlan", "visualAssetPlan"];
const PACKAGE_COMPONENT_REF_KEYS = [...COMPONENT_REF_KEYS, "traceability", "preflightReport"];
const V2_COMPONENT_REF_KEYS = ["postCopy", "finalTitleBinding", "carouselPlan", "visualAssetPlan"];
const PACKAGE_V4_COMPONENT_REF_KEYS = [...V2_COMPONENT_REF_KEYS, "traceability", "preflightReport"];
const OUTLINE_ROLE_BINDINGS = Object.freeze({
  hook: Object.freeze({ body: "scene", page: "cover" }),
  problem: Object.freeze({ body: "problem", page: "problem" }),
  diagnosis: Object.freeze({ body: "conclusion", page: "conclusion" }),
  evidence: Object.freeze({ body: "evidence", page: "evidence" }),
  method: Object.freeze({ body: "method", page: "method" }),
  example: Object.freeze({ body: "evidence", page: "case" }),
  action: Object.freeze({ body: "summary", page: "cta" }),
  boundary: Object.freeze({ body: "warning", page: "warning" })
});
const PREFLIGHT_CHECKS = Object.freeze([
  "authority_binding", "component_hash_integrity", "confirmed_outline_binding",
  "page_order_and_role", "cross_page_repetition", "copy_carousel_intent_alignment",
  "promotion_policy", "visual_reference_authorization", "traceability_integrity"
]);
const PREFLIGHT_V2_CHECKS = Object.freeze([
  "authority_binding", "component_hash_integrity", "final_title_binding", "confirmed_outline_binding",
  "page_order_and_role", "cross_page_repetition", "copy_carousel_intent_alignment",
  "promotion_policy", "visual_reference_authorization", "traceability_integrity"
]);

function componentError(contract, fieldPaths) {
  throw Object.assign(new Error("XHS component contract validation failed"), {
    code: "XHS_CONTENT_COMPONENT_INVALID",
    statusCode: 409,
    details: { contract, fieldPaths: [...new Set(fieldPaths)] }
  });
}

function requirePaths(contract, tests) {
  const failed = tests.filter(([, passed]) => !passed).map(([path]) => path);
  if (failed.length) componentError(contract, failed);
}

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exact(value, keys) {
  return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function text(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function string(value) {
  return typeof value === "string";
}

function strings(value) {
  return Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
}

function ref(value) {
  return exact(value, REF_KEYS) && text(value.id) && HASH.test(value.hash);
}

function refs(value) {
  return Array.isArray(value) && value.every(ref) && new Set(value.map((item) => `${item.id}:${item.hash}`)).size === value.length;
}

function authority(value) {
  return exact(value, AUTHORITY_KEYS)
    && text(value.companyId)
    && text(value.accountId)
    && AUTHORITY_KEYS.slice(2).every((key) => ref(value[key]));
}

function sameAuthority(left, right) {
  return authority(left) && authority(right) && hashUnifiedContent(left) === hashUnifiedContent(right);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

function withHash(value, field) {
  const copy = clone(value);
  delete copy[field];
  return { ...copy, [field]: hashUnifiedContent(copy) };
}

function validHash(value, field) {
  if (!object(value) || !HASH.test(value[field] || "")) return false;
  const copy = clone(value);
  delete copy[field];
  return hashUnifiedContent(copy) === value[field];
}

function componentRef(component, hashField = "componentHash") {
  return { id: component.id, hash: component[hashField] };
}

function validateCommon(value, contract, hashField, keys, schemaVersion = "1.0") {
  requirePaths(contract, [
    ["$", exact(value, keys)],
    ["$.schemaVersion", value?.schemaVersion === schemaVersion],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.authorityBinding", authority(value?.authorityBinding)],
    [`$.${hashField}`, validHash(value, hashField)]
  ]);
}

const POST_COPY_KEYS = [
  "schemaVersion", "contract", "id", "authorityBinding", "contentPromise", "engagementStrategy",
  "titleCandidates", "recommendedTitle", "opening", "bodySections", "ending", "pinnedComment",
  "hashtags", "cta", "promotionUse", "componentHash"
];
const POST_COPY_DRAFT_KEYS = POST_COPY_KEYS.filter((key) => key !== "componentHash");

export function validateXhsPostCopy(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.postCopy;
  validateCommon(value, contract, "componentHash", POST_COPY_KEYS);
  const engagement = value?.engagementStrategy;
  const titles = value?.titleCandidates;
  const bodies = value?.bodySections;
  const promotion = value?.promotionUse;
  requirePaths(contract, [
    ["$.contentPromise", text(value?.contentPromise)],
    ["$.engagementStrategy", exact(engagement, ["mode", "primaryAction", "reason", "ctaPlacement", "ctaText"])],
    ["$.engagementStrategy.mode", engagement?.mode === "auto"],
    ["$.engagementStrategy.primaryAction", ["save", "share", "comment", "follow", "consult", "try", "buy", "register", "none"].includes(engagement?.primaryAction)],
    ["$.engagementStrategy.reason", text(engagement?.reason)],
    ["$.engagementStrategy.ctaPlacement", ["body", "ending", "pinned_comment", "card", "none"].includes(engagement?.ctaPlacement)],
    ["$.engagementStrategy.ctaText", string(engagement?.ctaText)],
    ["$.titleCandidates", Array.isArray(titles) && titles.length >= 3 && titles.length <= 5],
    ["$.titleCandidates[]", Array.isArray(titles) && titles.every((item) => exact(item, ["title", "hookType", "claimIds", "risk"]))],
    ["$.titleCandidates[].title", Array.isArray(titles) && titles.every((item) => text(item?.title))],
    ["$.titleCandidates[].hookType", Array.isArray(titles) && titles.every((item) => ["result", "problem", "contrast", "checklist", "question"].includes(item?.hookType))],
    ["$.titleCandidates[].claimIds", Array.isArray(titles) && titles.every((item) => strings(item?.claimIds))],
    ["$.titleCandidates[].risk", Array.isArray(titles) && titles.every((item) => ["low", "medium", "high"].includes(item?.risk))],
    ["$.recommendedTitle", text(value?.recommendedTitle) && Array.isArray(titles) && titles.some((item) => item.title === value.recommendedTitle)],
    ["$.opening", text(value?.opening)],
    ["$.bodySections", Array.isArray(bodies) && bodies.length > 0],
    ["$.bodySections[]", Array.isArray(bodies) && bodies.every((item) => exact(item, ["sectionId", "outlineRole", "role", "text", "claimIds", "knowledgeAssetIds"]))],
    ["$.bodySections[].sectionId", Array.isArray(bodies) && bodies.every((item) => text(item?.sectionId)) && new Set(bodies.map((item) => item.sectionId)).size === bodies.length],
    ["$.bodySections[].outlineRole", Array.isArray(bodies) && bodies.every((item) => Object.hasOwn(OUTLINE_ROLE_BINDINGS, item?.outlineRole))],
    ["$.bodySections[].role", Array.isArray(bodies) && bodies.every((item) => Object.values(OUTLINE_ROLE_BINDINGS).some((binding) => binding.body === item?.role))],
    ["$.bodySections[].text", Array.isArray(bodies) && bodies.every((item) => text(item?.text))],
    ["$.bodySections[].claimIds", Array.isArray(bodies) && bodies.every((item) => strings(item?.claimIds))],
    ["$.bodySections[].knowledgeAssetIds", Array.isArray(bodies) && bodies.every((item) => strings(item?.knowledgeAssetIds))],
    ["$.ending", text(value?.ending)],
    ["$.pinnedComment", string(value?.pinnedComment)],
    ["$.hashtags", strings(value?.hashtags) && value.hashtags.length >= 3 && value.hashtags.length <= 8],
    ["$.cta", string(value?.cta)],
    ["$.promotionUse", exact(promotion, ["mode", "itemIds", "disclosure"])],
    ["$.promotionUse.mode", ["none", "soft", "focused"].includes(promotion?.mode)],
    ["$.promotionUse.itemIds", strings(promotion?.itemIds)],
    ["$.promotionUse.disclosure", string(promotion?.disclosure)]
  ]);
  return value;
}

export function createXhsPostCopy(input) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.postCopy;
  requirePaths(contract, [["$", exact(input, POST_COPY_DRAFT_KEYS)]]);
  const value = withHash(clone(input), "componentHash");
  validateXhsPostCopy(value);
  return deepFreeze(value);
}

const FINAL_TITLE_KEYS = [
  "schemaVersion", "contract", "id", "authorityBinding", "postCopyRef", "titleOutputRef",
  "recommendation", "titleId", "title", "claimIds", "bindingHash"
];

export function validateXhsFinalTitleBinding(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.finalTitleBinding;
  validateCommon(value, contract, "bindingHash", FINAL_TITLE_KEYS);
  requirePaths(contract, [
    ["$.postCopyRef", ref(value?.postCopyRef)],
    ["$.titleOutputRef", ref(value?.titleOutputRef)],
    ["$.recommendation", value?.recommendation === "balanced"],
    ["$.titleId", text(value?.titleId)],
    ["$.title", text(value?.title)],
    ["$.claimIds", strings(value?.claimIds)]
  ]);
  return value;
}

export function createXhsFinalTitleBinding({ id, postCopy, titleOutput, titleOutputRef, contentMaster }) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.finalTitleBinding;
  validateXhsPostCopy(postCopy);
  validateMasterAuthority(contentMaster, postCopy.authorityBinding, contract);
  const candidates = titleOutput?.candidates;
  const balancedId = titleOutput?.recommendations?.balanced;
  const candidateIds = Array.isArray(candidates) ? candidates.map((item) => item?.title_id) : [];
  const balancedMatches = Array.isArray(candidates) && text(balancedId) ? candidates.filter((item) => item?.title_id === balancedId) : [];
  const balanced = balancedMatches.length === 1 ? balancedMatches[0] : null;
  const master = masterSets(contentMaster);
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.titleOutput", object(titleOutput)],
    ["input.titleOutputRef", ref(titleOutputRef)],
    ["input.titleOutputRef.hash", ref(titleOutputRef) && titleOutputRef.hash === hashUnifiedContent(titleOutput)],
    ["input.titleOutput.candidates", Array.isArray(candidates) && candidates.length > 0 && candidates.every(object)],
    ["input.titleOutput.candidates[].title_id", candidateIds.length > 0 && candidateIds.every(text) && new Set(candidateIds).size === candidateIds.length],
    ["input.titleOutput.recommendations.balanced", text(balancedId) && balancedMatches.length === 1 && object(balanced)],
    ["input.titleOutput.candidates[].balanced", object(balanced) && text(balanced.title) && balanced.risk !== "high" && strings(balanced.claim_ids)],
    ["input.titleOutput.candidates[].claim_ids", object(balanced) && strings(balanced.claim_ids) && balanced.claim_ids.every((claimId) => master.factIds.has(claimId) || master.interpretationIds.has(claimId))]
  ]);
  const draft = {
    schemaVersion: "1.0",
    contract,
    id,
    authorityBinding: clone(postCopy.authorityBinding),
    postCopyRef: componentRef(postCopy),
    titleOutputRef: clone(titleOutputRef),
    recommendation: "balanced",
    titleId: balanced.title_id,
    title: balanced.title,
    claimIds: [...balanced.claim_ids],
    bindingHash: ""
  };
  const value = withHash(draft, "bindingHash");
  validateXhsFinalTitleBinding(value);
  return deepFreeze(value);
}

const CAROUSEL_KEYS = [
  "schemaVersion", "contract", "id", "authorityBinding", "postCopyRef", "deckId", "canvas",
  "designDnaVersion", "readingArc", "pages", "componentHash"
];
const CAROUSEL_DRAFT_KEYS = CAROUSEL_KEYS.filter((key) => key !== "componentHash");

export function validateXhsCarouselPlan(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlan;
  validateCommon(value, contract, "componentHash", CAROUSEL_KEYS);
  const pages = value?.pages;
  requirePaths(contract, [
    ["$.postCopyRef", ref(value?.postCopyRef)],
    ["$.deckId", text(value?.deckId)],
    ["$.canvas", exact(value?.canvas, ["width", "height", "ratio"]) && value.canvas.width === 1080 && value.canvas.height === 1440 && value.canvas.ratio === "3:4"],
    ["$.designDnaVersion", text(value?.designDnaVersion)],
    ["$.readingArc", text(value?.readingArc)],
    ["$.pages", Array.isArray(pages) && pages.length >= 6 && pages.length <= 10],
    ["$.pages[]", Array.isArray(pages) && pages.every((item) => exact(item, ["page", "outlineSectionId", "outlineRole", "role", "objective", "takeaway", "textLayers", "layoutHint", "factIds", "interpretationIds", "knowledgeAssetIds", "mustAvoid"]))],
    ["$.pages[].page", Array.isArray(pages) && pages.every((item, index) => item?.page === index + 1)],
    ["$.pages[].outlineSectionId", Array.isArray(pages) && pages.every((item) => text(item?.outlineSectionId)) && new Set(pages.map((item) => item.outlineSectionId)).size === pages.length],
    ["$.pages[].outlineRole", Array.isArray(pages) && pages.every((item) => Object.hasOwn(OUTLINE_ROLE_BINDINGS, item?.outlineRole))],
    ["$.pages[].role", Array.isArray(pages) && pages.every((item) => Object.values(OUTLINE_ROLE_BINDINGS).some((binding) => binding.page === item?.role))],
    ["$.pages[].objective", Array.isArray(pages) && pages.every((item) => text(item?.objective))],
    ["$.pages[].takeaway", Array.isArray(pages) && pages.every((item) => text(item?.takeaway))],
    ["$.pages[].textLayers", Array.isArray(pages) && pages.every((item) => Array.isArray(item?.textLayers) && item.textLayers.length > 0 && item.textLayers.every((layer) => exact(layer, ["type", "text", "maxLines", "priority"])))],
    ["$.pages[].textLayers[]", Array.isArray(pages) && pages.every((item) => item.textLayers.every((layer) => ["headline", "body", "label", "footer"].includes(layer.type) && text(layer.text) && Number.isInteger(layer.maxLines) && layer.maxLines > 0 && Number.isInteger(layer.priority) && layer.priority > 0))],
    ["$.pages[].layoutHint", Array.isArray(pages) && pages.every((item) => text(item?.layoutHint))],
    ["$.pages[].factIds", Array.isArray(pages) && pages.every((item) => strings(item?.factIds))],
    ["$.pages[].interpretationIds", Array.isArray(pages) && pages.every((item) => strings(item?.interpretationIds))],
    ["$.pages[].knowledgeAssetIds", Array.isArray(pages) && pages.every((item) => strings(item?.knowledgeAssetIds))],
    ["$.pages[].mustAvoid", Array.isArray(pages) && pages.every((item) => strings(item?.mustAvoid))]
  ]);
  return value;
}

export function createXhsCarouselPlan(input) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlan;
  requirePaths(contract, [["$", exact(input, CAROUSEL_DRAFT_KEYS)]]);
  const value = withHash(clone(input), "componentHash");
  validateXhsCarouselPlan(value);
  return deepFreeze(value);
}

const CAROUSEL_V2_KEYS = [
  "schemaVersion", "contract", "id", "authorityBinding", "postCopyRef", "finalTitleBindingRef",
  "deckId", "canvas", "designDnaVersion", "readingArc", "pages", "componentHash"
];
const CAROUSEL_V2_DRAFT_KEYS = CAROUSEL_V2_KEYS.filter((key) => key !== "componentHash");

export function validateXhsCarouselPlanV2(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlanV2;
  validateCommon(value, contract, "componentHash", CAROUSEL_V2_KEYS, "2.0");
  const legacyShape = clone(value);
  legacyShape.schemaVersion = "1.0";
  legacyShape.contract = XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlan;
  delete legacyShape.finalTitleBindingRef;
  legacyShape.componentHash = withHash(legacyShape, "componentHash").componentHash;
  validateXhsCarouselPlan(legacyShape);
  requirePaths(contract, [["$.finalTitleBindingRef", ref(value?.finalTitleBindingRef)]]);
  return value;
}

export function createXhsCarouselPlanV2(input, { postCopy, finalTitleBinding } = {}) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.carouselPlanV2;
  requirePaths(contract, [["$", exact(input, CAROUSEL_V2_DRAFT_KEYS)]]);
  validateXhsPostCopy(postCopy);
  validateXhsFinalTitleBinding(finalTitleBinding);
  const coverLayers = input?.pages?.[0]?.textLayers;
  const coverHeadline = Array.isArray(coverLayers) ? coverLayers.find((item) => item?.type === "headline")?.text : "";
  requirePaths(contract, [
    ["input.authorityBinding", sameAuthority(postCopy.authorityBinding, input?.authorityBinding) && sameAuthority(postCopy.authorityBinding, finalTitleBinding.authorityBinding)],
    ["input.postCopyRef", hashUnifiedContent(input?.postCopyRef) === hashUnifiedContent(componentRef(postCopy)) && hashUnifiedContent(finalTitleBinding.postCopyRef) === hashUnifiedContent(componentRef(postCopy))],
    ["input.finalTitleBindingRef", hashUnifiedContent(input?.finalTitleBindingRef) === hashUnifiedContent(componentRef(finalTitleBinding, "bindingHash"))],
    ["input.pages[0].textLayers.headline", text(coverHeadline) && coverHeadline === finalTitleBinding.title]
  ]);
  const value = withHash(clone(input), "componentHash");
  validateXhsCarouselPlanV2(value);
  return deepFreeze(value);
}

const VISUAL_KEYS = [
  "schemaVersion", "contract", "id", "authorityBinding", "carouselPlanRef", "designDnaVersion",
  "pageVisuals", "imageSpecs", "skippedPages", "authorizedReferenceAssets", "pageAssetBindings", "componentHash"
];
const VISUAL_DRAFT_KEYS = VISUAL_KEYS.filter((key) => key !== "componentHash");

export function validateXhsVisualAssetPlan(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.visualAssetPlan;
  validateCommon(value, contract, "componentHash", VISUAL_KEYS);
  const pageVisuals = value?.pageVisuals;
  const specs = value?.imageSpecs;
  const skipped = value?.skippedPages;
  const bindings = value?.pageAssetBindings;
  const authorized = value?.authorizedReferenceAssets;
  const authorizedIds = new Set(Array.isArray(authorized) ? authorized.map((item) => item?.id) : []);
  requirePaths(contract, [
    ["$.carouselPlanRef", ref(value?.carouselPlanRef)],
    ["$.designDnaVersion", text(value?.designDnaVersion)],
    ["$.pageVisuals", Array.isArray(pageVisuals) && pageVisuals.length >= 6 && pageVisuals.length <= 10],
    ["$.pageVisuals[]", Array.isArray(pageVisuals) && pageVisuals.every((item) => exact(item, ["page", "visualFunction", "visualNeed", "renderStrategy", "mustKeep", "mustAvoid"]))],
    ["$.pageVisuals[].page", Array.isArray(pageVisuals) && pageVisuals.every((item, index) => item?.page === index + 1)],
    ["$.pageVisuals[].visualFunction", Array.isArray(pageVisuals) && pageVisuals.every((item) => ["attention", "explain", "compare", "demonstrate", "pace", "none"].includes(item?.visualFunction))],
    ["$.pageVisuals[].visualNeed", Array.isArray(pageVisuals) && pageVisuals.every((item) => string(item?.visualNeed))],
    ["$.pageVisuals[].renderStrategy", Array.isArray(pageVisuals) && pageVisuals.every((item) => ["html_css", "authorized_asset", "generated_raster", "no_visual_needed"].includes(item?.renderStrategy))],
    ["$.pageVisuals[].mustKeep", Array.isArray(pageVisuals) && pageVisuals.every((item) => strings(item?.mustKeep))],
    ["$.pageVisuals[].mustAvoid", Array.isArray(pageVisuals) && pageVisuals.every((item) => strings(item?.mustAvoid))],
    ["$.imageSpecs", Array.isArray(specs)],
    ["$.imageSpecs[]", Array.isArray(specs) && specs.every((item) => exact(item, ["plannedAssetId", "page", "useCase", "assetType", "scene", "subject", "styleAndMedium", "composition", "lighting", "palette", "materials", "textSafeArea", "prompt", "negativePrompt", "referenceAssetIds", "designDnaVersion", "size", "mustKeep", "mustAvoid", "textPolicy"]))],
    ["$.imageSpecs[].fields", Array.isArray(specs) && specs.every((item) => text(item?.plannedAssetId) && Number.isInteger(item?.page) && ["illustration-story", "photorealistic-natural", "stylized-concept", "product-context", "texture-background"].includes(item?.useCase) && ["carousel-background", "subject-cutout", "scene-illustration"].includes(item?.assetType) && ["scene", "subject", "styleAndMedium", "composition", "lighting", "materials", "textSafeArea", "prompt", "negativePrompt", "designDnaVersion"].every((key) => text(item?.[key])) && strings(item?.palette) && strings(item?.referenceAssetIds) && strings(item?.mustKeep) && strings(item?.mustAvoid) && item?.size === "1024x1536" && item?.textPolicy === "no_text_in_image")],
    ["$.skippedPages", Array.isArray(skipped) && skipped.every((item) => exact(item, ["page", "reason"]) && Number.isInteger(item.page) && ["html_css", "authorized_asset", "no_visual_needed"].includes(item.reason))],
    ["$.authorizedReferenceAssets", refs(authorized)],
    ["$.pageAssetBindings", Array.isArray(bindings) && bindings.length === pageVisuals?.length && bindings.every((item) => exact(item, ["page", "plannedAssetIds"]) && Number.isInteger(item.page) && strings(item.plannedAssetIds))],
    ["$.referenceAuthorization", Array.isArray(specs) && specs.every((item) => item.referenceAssetIds.every((id) => authorizedIds.has(id)))],
    ["$.designDnaVersionBinding", Array.isArray(specs) && specs.every((item) => item.designDnaVersion === value?.designDnaVersion)]
  ]);
  if (!Array.isArray(pageVisuals) || !Array.isArray(specs) || !Array.isArray(skipped) || !Array.isArray(bindings)) return value;
  const generated = pageVisuals.filter((item) => item.renderStrategy === "generated_raster");
  const nonGenerated = pageVisuals.filter((item) => item.renderStrategy !== "generated_raster");
  const specPages = new Set(specs.map((item) => item.page));
  const specIds = new Set(specs.map((item) => item.plannedAssetId));
  const skippedPages = new Set(skipped.map((item) => item.page));
  requirePaths(contract, [
    ["$.imageSpecs.pageUniqueness", specPages.size === specs.length && specIds.size === specs.length],
    ["$.imageSpecs.generatedCoverage", specs.length === generated.length && generated.every((item) => specPages.has(item.page)) && specs.every((item) => pageVisuals[item.page - 1]?.renderStrategy === "generated_raster")],
    ["$.skippedPages.coverage", skipped.length === nonGenerated.length && skippedPages.size === skipped.length && nonGenerated.every((item) => skippedPages.has(item.page)) && skipped.every((item) => pageVisuals[item.page - 1]?.renderStrategy === item.reason)],
    ["$.pageAssetBindings.coverage", bindings.every((item, index) => item.page === index + 1)],
    ["$.pageAssetBindings.generated", bindings.every((item) => pageVisuals[item.page - 1]?.renderStrategy === "generated_raster" ? item.plannedAssetIds.length === 1 && specIds.has(item.plannedAssetIds[0]) && specs.find((spec) => spec.page === item.page)?.plannedAssetId === item.plannedAssetIds[0] : item.plannedAssetIds.length === 0)]
  ]);
  return value;
}

export function createXhsVisualAssetPlan(input) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.visualAssetPlan;
  requirePaths(contract, [["$", exact(input, VISUAL_DRAFT_KEYS)]]);
  const value = withHash(clone(input), "componentHash");
  validateXhsVisualAssetPlan(value);
  return deepFreeze(value);
}

function validateMasterAuthority(contentMaster, authorityBinding, contract) {
  requirePaths(contract, [
    ["input.contentMaster", object(contentMaster)],
    ["input.contentMaster.id", contentMaster?.content_master_id === authorityBinding?.sharedContentMasterRef?.id],
    ["input.contentMaster.hash", hashUnifiedContent(contentMaster) === authorityBinding?.sharedContentMasterRef?.hash]
  ]);
}

function masterSets(contentMaster) {
  const factIds = new Set((contentMaster.confirmed_facts || []).map((item) => item?.fact_id).filter(text));
  const interpretationIds = new Set((contentMaster.supported_interpretations || []).map((item) => item?.interpretation_id).filter(text));
  const opinionIds = new Set((contentMaster.author_opinions || []).map((item) => item?.opinion_id).filter(text));
  const knowledgeRefs = (contentMaster.knowledge_contract?.allowed_assets || []).map((item) => ({ id: item?.asset_id || item?.id, hash: item?.hash })).filter((item) => text(item.id));
  return { factIds, interpretationIds, opinionIds, knowledgeIds: new Set(knowledgeRefs.map((item) => item.id)) };
}

const TRACE_KEYS = ["schemaVersion", "contract", "id", "authorityBinding", "componentRefs", "usedFactIds", "usedInterpretationIds", "usedKnowledgeAssetIds", "usedReferenceAssetIds", "pageClaimMap", "traceHash"];

export function validateXhsTraceability(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.traceability;
  validateCommon(value, contract, "traceHash", TRACE_KEYS);
  requirePaths(contract, [
    ["$.componentRefs", exact(value?.componentRefs, COMPONENT_REF_KEYS) && COMPONENT_REF_KEYS.every((key) => ref(value.componentRefs[key]))],
    ["$.usedFactIds", strings(value?.usedFactIds)],
    ["$.usedInterpretationIds", strings(value?.usedInterpretationIds)],
    ["$.usedKnowledgeAssetIds", strings(value?.usedKnowledgeAssetIds)],
    ["$.usedReferenceAssetIds", strings(value?.usedReferenceAssetIds)],
    ["$.pageClaimMap", Array.isArray(value?.pageClaimMap) && value.pageClaimMap.every((item) => exact(item, ["page", "claimIds"]) && Number.isInteger(item.page) && strings(item.claimIds))],
    ["$.pageClaimMap.pageOrder", Array.isArray(value?.pageClaimMap) && value.pageClaimMap.every((item, index) => item.page === index + 1)]
  ]);
  return value;
}

export function compileXhsTraceability({ postCopy, carouselPlan, visualAssetPlan, contentMaster, authorizedReferenceAssets = [] }) {
  validateXhsPostCopy(postCopy);
  validateXhsCarouselPlan(carouselPlan);
  validateXhsVisualAssetPlan(visualAssetPlan);
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.traceability;
  requirePaths(contract, [
    ["input.authorityBinding", sameAuthority(postCopy.authorityBinding, carouselPlan.authorityBinding) && sameAuthority(postCopy.authorityBinding, visualAssetPlan.authorityBinding)],
    ["input.carouselPlan.postCopyRef", hashUnifiedContent(carouselPlan.postCopyRef) === hashUnifiedContent(componentRef(postCopy))],
    ["input.visualAssetPlan.carouselPlanRef", hashUnifiedContent(visualAssetPlan.carouselPlanRef) === hashUnifiedContent(componentRef(carouselPlan))],
    ["input.authorizedReferenceAssets", refs(authorizedReferenceAssets)]
  ]);
  validateMasterAuthority(contentMaster, postCopy.authorityBinding, contract);
  const master = masterSets(contentMaster);
  const bodyBySection = new Map(postCopy.bodySections.map((item) => [item.sectionId, item]));
  const titleClaims = postCopy.titleCandidates.flatMap((item) => item.claimIds);
  const bodyClaims = postCopy.bodySections.flatMap((item) => item.claimIds);
  const pageClaimMap = carouselPlan.pages.map((page) => ({ page: page.page, claimIds: [...new Set([...page.factIds, ...page.interpretationIds])].sort() }));
  const allClaims = new Set([...titleClaims, ...bodyClaims, ...pageClaimMap.flatMap((item) => item.claimIds)]);
  const danglingClaims = [...allClaims].filter((id) => !master.factIds.has(id) && !master.interpretationIds.has(id));
  const opinionClaims = [...allClaims].filter((id) => master.opinionIds.has(id));
  const crossPageMismatch = carouselPlan.pages.some((page) => {
    const body = bodyBySection.get(page.outlineSectionId);
    return !body || [...page.factIds, ...page.interpretationIds].some((id) => !body.claimIds.includes(id));
  });
  const knowledgeIds = new Set([
    ...postCopy.bodySections.flatMap((item) => item.knowledgeAssetIds),
    ...carouselPlan.pages.flatMap((item) => item.knowledgeAssetIds)
  ]);
  const authorizedAssetMap = new Map(authorizedReferenceAssets.map((item) => [item.id, item.hash]));
  const planAuthorizedMap = new Map(visualAssetPlan.authorizedReferenceAssets.map((item) => [item.id, item.hash]));
  const referenceIds = new Set(visualAssetPlan.imageSpecs.flatMap((item) => item.referenceAssetIds));
  requirePaths(contract, [
    ["input.claims.authorized", danglingClaims.length === 0 && opinionClaims.length === 0],
    ["input.claims.crossPageConsistency", !crossPageMismatch],
    ["input.knowledgeAssets.authorized", [...knowledgeIds].every((id) => master.knowledgeIds.has(id))],
    ["input.referenceAssets.authorized", [...referenceIds].every((id) => authorizedAssetMap.has(id) && planAuthorizedMap.get(id) === authorizedAssetMap.get(id))],
    ["input.referenceAssets.noUnusedAuthority", visualAssetPlan.authorizedReferenceAssets.every((item) => referenceIds.has(item.id))]
  ]);
  const draft = {
    schemaVersion: "1.0",
    contract,
    id: `xhs-trace:${carouselPlan.id}`,
    authorityBinding: clone(postCopy.authorityBinding),
    componentRefs: {
      postCopy: componentRef(postCopy),
      carouselPlan: componentRef(carouselPlan),
      visualAssetPlan: componentRef(visualAssetPlan)
    },
    usedFactIds: [...allClaims].filter((id) => master.factIds.has(id)).sort(),
    usedInterpretationIds: [...allClaims].filter((id) => master.interpretationIds.has(id)).sort(),
    usedKnowledgeAssetIds: [...knowledgeIds].sort(),
    usedReferenceAssetIds: [...referenceIds].sort(),
    pageClaimMap,
    traceHash: ""
  };
  const value = withHash(draft, "traceHash");
  validateXhsTraceability(value);
  return deepFreeze(value);
}

const TRACE_V2_KEYS = ["schemaVersion", "contract", "id", "authorityBinding", "componentRefs", "titleClaimIds", "usedFactIds", "usedInterpretationIds", "usedKnowledgeAssetIds", "usedReferenceAssetIds", "pageClaimMap", "traceHash"];

export function validateXhsTraceabilityV2(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.traceabilityV2;
  validateCommon(value, contract, "traceHash", TRACE_V2_KEYS, "2.0");
  requirePaths(contract, [
    ["$.componentRefs", exact(value?.componentRefs, V2_COMPONENT_REF_KEYS) && V2_COMPONENT_REF_KEYS.every((key) => ref(value.componentRefs[key]))],
    ["$.titleClaimIds", strings(value?.titleClaimIds)],
    ["$.usedFactIds", strings(value?.usedFactIds)],
    ["$.usedInterpretationIds", strings(value?.usedInterpretationIds)],
    ["$.usedKnowledgeAssetIds", strings(value?.usedKnowledgeAssetIds)],
    ["$.usedReferenceAssetIds", strings(value?.usedReferenceAssetIds)],
    ["$.pageClaimMap", Array.isArray(value?.pageClaimMap) && value.pageClaimMap.every((item) => exact(item, ["page", "claimIds"]) && Number.isInteger(item.page) && strings(item.claimIds))],
    ["$.pageClaimMap.pageOrder", Array.isArray(value?.pageClaimMap) && value.pageClaimMap.every((item, index) => item.page === index + 1)]
  ]);
  return value;
}

export function compileXhsTraceabilityV2({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, contentMaster, authorizedReferenceAssets = [] }) {
  validateXhsPostCopy(postCopy);
  validateXhsFinalTitleBinding(finalTitleBinding);
  validateXhsCarouselPlanV2(carouselPlan);
  validateXhsVisualAssetPlan(visualAssetPlan);
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.traceabilityV2;
  requirePaths(contract, [
    ["input.authorityBinding", [finalTitleBinding, carouselPlan, visualAssetPlan].every((item) => sameAuthority(postCopy.authorityBinding, item.authorityBinding))],
    ["input.finalTitleBinding.postCopyRef", hashUnifiedContent(finalTitleBinding.postCopyRef) === hashUnifiedContent(componentRef(postCopy))],
    ["input.carouselPlan.postCopyRef", hashUnifiedContent(carouselPlan.postCopyRef) === hashUnifiedContent(componentRef(postCopy))],
    ["input.carouselPlan.finalTitleBindingRef", hashUnifiedContent(carouselPlan.finalTitleBindingRef) === hashUnifiedContent(componentRef(finalTitleBinding, "bindingHash"))],
    ["input.visualAssetPlan.carouselPlanRef", hashUnifiedContent(visualAssetPlan.carouselPlanRef) === hashUnifiedContent(componentRef(carouselPlan))],
    ["input.authorizedReferenceAssets", refs(authorizedReferenceAssets)]
  ]);
  validateMasterAuthority(contentMaster, postCopy.authorityBinding, contract);
  const master = masterSets(contentMaster);
  const bodyBySection = new Map(postCopy.bodySections.map((item) => [item.sectionId, item]));
  const bodyClaims = postCopy.bodySections.flatMap((item) => item.claimIds);
  const pageClaimMap = carouselPlan.pages.map((page) => ({ page: page.page, claimIds: [...new Set([...page.factIds, ...page.interpretationIds])].sort() }));
  const allClaims = new Set([...finalTitleBinding.claimIds, ...bodyClaims, ...pageClaimMap.flatMap((item) => item.claimIds)]);
  const danglingClaims = [...allClaims].filter((id) => !master.factIds.has(id) && !master.interpretationIds.has(id));
  const opinionClaims = [...allClaims].filter((id) => master.opinionIds.has(id));
  const crossPageMismatch = carouselPlan.pages.some((page) => {
    const body = bodyBySection.get(page.outlineSectionId);
    return !body || [...page.factIds, ...page.interpretationIds].some((id) => !body.claimIds.includes(id));
  });
  const knowledgeIds = new Set([...postCopy.bodySections.flatMap((item) => item.knowledgeAssetIds), ...carouselPlan.pages.flatMap((item) => item.knowledgeAssetIds)]);
  const authorizedAssetMap = new Map(authorizedReferenceAssets.map((item) => [item.id, item.hash]));
  const planAuthorizedMap = new Map(visualAssetPlan.authorizedReferenceAssets.map((item) => [item.id, item.hash]));
  const referenceIds = new Set(visualAssetPlan.imageSpecs.flatMap((item) => item.referenceAssetIds));
  requirePaths(contract, [
    ["input.titleClaims.authorized", finalTitleBinding.claimIds.every((id) => master.factIds.has(id) || master.interpretationIds.has(id))],
    ["input.claims.authorized", danglingClaims.length === 0 && opinionClaims.length === 0],
    ["input.claims.crossPageConsistency", !crossPageMismatch],
    ["input.knowledgeAssets.authorized", [...knowledgeIds].every((id) => master.knowledgeIds.has(id))],
    ["input.referenceAssets.authorized", [...referenceIds].every((id) => authorizedAssetMap.has(id) && planAuthorizedMap.get(id) === authorizedAssetMap.get(id))],
    ["input.referenceAssets.noUnusedAuthority", visualAssetPlan.authorizedReferenceAssets.every((item) => referenceIds.has(item.id))]
  ]);
  const draft = {
    schemaVersion: "2.0", contract, id: `xhs-trace-v2:${carouselPlan.id}`, authorityBinding: clone(postCopy.authorityBinding),
    componentRefs: { postCopy: componentRef(postCopy), finalTitleBinding: componentRef(finalTitleBinding, "bindingHash"), carouselPlan: componentRef(carouselPlan), visualAssetPlan: componentRef(visualAssetPlan) },
    titleClaimIds: [...finalTitleBinding.claimIds].sort(),
    usedFactIds: [...allClaims].filter((id) => master.factIds.has(id)).sort(),
    usedInterpretationIds: [...allClaims].filter((id) => master.interpretationIds.has(id)).sort(),
    usedKnowledgeAssetIds: [...knowledgeIds].sort(), usedReferenceAssetIds: [...referenceIds].sort(), pageClaimMap, traceHash: ""
  };
  const value = withHash(draft, "traceHash");
  validateXhsTraceabilityV2(value);
  return deepFreeze(value);
}

const PREFLIGHT_KEYS = ["schemaVersion", "contract", "id", "authorityBinding", "componentRefs", "traceabilityRef", "checks", "status", "reportHash"];

export function validateXhsContentPreflightReport(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.preflightReport;
  validateCommon(value, contract, "reportHash", PREFLIGHT_KEYS);
  const checks = value?.checks;
  requirePaths(contract, [
    ["$.componentRefs", exact(value?.componentRefs, COMPONENT_REF_KEYS) && COMPONENT_REF_KEYS.every((key) => ref(value.componentRefs[key]))],
    ["$.traceabilityRef", ref(value?.traceabilityRef)],
    ["$.checks", Array.isArray(checks) && checks.length === PREFLIGHT_CHECKS.length],
    ["$.checks[]", Array.isArray(checks) && checks.every((item) => exact(item, ["check", "result", "detail"]) && PREFLIGHT_CHECKS.includes(item.check) && ["pass", "fail"].includes(item.result) && string(item.detail))],
    ["$.checks.exactSet", Array.isArray(checks) && new Set(checks.map((item) => item.check)).size === PREFLIGHT_CHECKS.length],
    ["$.status", ["passed", "failed"].includes(value?.status) && (value.status === "passed") === (Array.isArray(checks) && checks.every((item) => item.result === "pass"))]
  ]);
  return value;
}

function normalizedPageText(page) {
  return page.textLayers.map((item) => item.text.trim().replace(/\s+/g, " ").toLowerCase()).join("|");
}

function promotionPasses(postCopy, contentMaster) {
  const policy = contentMaster?.promotion || {};
  const use = postCopy.promotionUse;
  const allowedIds = new Set((policy.allowed_items || []).map((item) => item?.id || item?.item_id || item).filter(text));
  const requestedMode = policy.mode || "none";
  const mode = requestedMode === "none" || allowedIds.size ? requestedMode : "none";
  const disclosure = policy.disclosure || "";
  if (mode === "none") return use.mode === "none" && use.itemIds.length === 0 && use.disclosure === disclosure;
  if (!["soft", "focused"].includes(mode) || use.itemIds.length === 0) return false;
  return use.mode === mode
    && use.itemIds.every((id) => allowedIds.has(id))
    && use.disclosure === disclosure;
}

export function compileXhsContentPreflight({ postCopy, carouselPlan, visualAssetPlan, traceability, contentMaster, confirmedOutline, authorizedReferenceAssets = [] }) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.preflightReport;
  let validationsPass = true;
  try {
    validateXhsPostCopy(postCopy);
    validateXhsCarouselPlan(carouselPlan);
    validateXhsVisualAssetPlan(visualAssetPlan);
    validateXhsTraceability(traceability);
  } catch {
    validationsPass = false;
  }
  requirePaths(contract, [["input.components", validationsPass], ["input.confirmedOutline", object(confirmedOutline)], ["input.authorizedReferenceAssets", refs(authorizedReferenceAssets)]]);
  validateMasterAuthority(contentMaster, postCopy.authorityBinding, contract);
  const sameBinding = [carouselPlan, visualAssetPlan, traceability].every((item) => sameAuthority(postCopy.authorityBinding, item.authorityBinding));
  const componentHashes = carouselPlan.postCopyRef.hash === postCopy.componentHash
    && visualAssetPlan.carouselPlanRef.hash === carouselPlan.componentHash
    && traceability.componentRefs.postCopy.hash === postCopy.componentHash
    && traceability.componentRefs.carouselPlan.hash === carouselPlan.componentHash
    && traceability.componentRefs.visualAssetPlan.hash === visualAssetPlan.componentHash;
  const outlineHash = hashUnifiedContent(confirmedOutline);
  const outlineSections = Array.isArray(confirmedOutline.sections) ? confirmedOutline.sections : [];
  const outlineBinding = confirmedOutline.outline_id === postCopy.authorityBinding.confirmedOutlineRef.id
    && outlineHash === postCopy.authorityBinding.confirmedOutlineRef.hash
    && confirmedOutline.content_promise === postCopy.contentPromise
    && outlineSections.length === postCopy.bodySections.length
    && outlineSections.length === carouselPlan.pages.length
    && outlineSections.every((section, index) => {
      const binding = OUTLINE_ROLE_BINDINGS[section.role];
      const body = postCopy.bodySections[index];
      const page = carouselPlan.pages[index];
      return binding && body?.sectionId === section.section_id && body?.outlineRole === section.role && body?.role === binding.body
        && page?.outlineSectionId === section.section_id && page?.outlineRole === section.role && page?.role === binding.page;
    });
  const pageOrder = carouselPlan.pages.every((page, index) => page.page === index + 1)
    && visualAssetPlan.pageVisuals.every((page, index) => page.page === index + 1)
    && visualAssetPlan.pageAssetBindings.every((binding, index) => binding.page === index + 1)
    && traceability.pageClaimMap.every((entry, index) => entry.page === index + 1);
  const pageTexts = carouselPlan.pages.map(normalizedPageText);
  const takeaways = carouselPlan.pages.map((page) => page.takeaway.trim().replace(/\s+/g, " ").toLowerCase());
  const nonRepeated = new Set(pageTexts).size === pageTexts.length && new Set(takeaways).size === takeaways.length;
  const coverHeadline = carouselPlan.pages[0]?.textLayers.find((item) => item.type === "headline")?.text;
  const intentAligned = coverHeadline === postCopy.recommendedTitle && carouselPlan.postCopyRef.hash === postCopy.componentHash;
  const authorizedMap = new Map(authorizedReferenceAssets.map((item) => [item.id, item.hash]));
  const visualsAuthorized = visualAssetPlan.authorizedReferenceAssets.every((item) => authorizedMap.get(item.id) === item.hash)
    && visualAssetPlan.imageSpecs.flatMap((item) => item.referenceAssetIds).every((id) => authorizedMap.has(id));
  let tracePasses = false;
  try {
    const compiled = compileXhsTraceability({ postCopy, carouselPlan, visualAssetPlan, contentMaster, authorizedReferenceAssets });
    tracePasses = compiled.traceHash === traceability.traceHash;
  } catch {}
  const facts = [
    ["authority_binding", sameBinding, "all components use one immutable authority binding"],
    ["component_hash_integrity", componentHashes, "component refs bind validated component hashes"],
    ["confirmed_outline_binding", outlineBinding, "copy and carousel bind the confirmed outline"],
    ["page_order_and_role", pageOrder, "page order and role coverage are deterministic"],
    ["cross_page_repetition", nonRepeated, "page text and takeaways are not duplicated"],
    ["copy_carousel_intent_alignment", intentAligned, "cover promise matches the recommended copy title"],
    ["promotion_policy", promotionPasses(postCopy, contentMaster), "promotion use follows ContentMaster policy"],
    ["visual_reference_authorization", visualsAuthorized, "visual references match the authorized asset set"],
    ["traceability_integrity", tracePasses, "traceability equals deterministic compilation"]
  ];
  const checks = facts.map(([check, passed, detail]) => ({ check, result: passed ? "pass" : "fail", detail }));
  const draft = {
    schemaVersion: "1.0",
    contract,
    id: `xhs-preflight:${carouselPlan.id}`,
    authorityBinding: clone(postCopy.authorityBinding),
    componentRefs: {
      postCopy: componentRef(postCopy),
      carouselPlan: componentRef(carouselPlan),
      visualAssetPlan: componentRef(visualAssetPlan)
    },
    traceabilityRef: componentRef(traceability, "traceHash"),
    checks,
    status: checks.every((item) => item.result === "pass") ? "passed" : "failed",
    reportHash: ""
  };
  const value = withHash(draft, "reportHash");
  validateXhsContentPreflightReport(value);
  return deepFreeze(value);
}

const PREFLIGHT_V2_KEYS = ["schemaVersion", "contract", "id", "authorityBinding", "componentRefs", "traceabilityRef", "checks", "status", "reportHash"];

export function validateXhsContentPreflightReportV2(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.preflightReportV2;
  validateCommon(value, contract, "reportHash", PREFLIGHT_V2_KEYS, "2.0");
  const checks = value?.checks;
  requirePaths(contract, [
    ["$.componentRefs", exact(value?.componentRefs, V2_COMPONENT_REF_KEYS) && V2_COMPONENT_REF_KEYS.every((key) => ref(value.componentRefs[key]))],
    ["$.traceabilityRef", ref(value?.traceabilityRef)],
    ["$.checks", Array.isArray(checks) && checks.length === PREFLIGHT_V2_CHECKS.length],
    ["$.checks[]", Array.isArray(checks) && checks.every((item) => exact(item, ["check", "result", "detail"]) && PREFLIGHT_V2_CHECKS.includes(item.check) && ["pass", "fail"].includes(item.result) && string(item.detail))],
    ["$.checks.exactSet", Array.isArray(checks) && new Set(checks.map((item) => item.check)).size === PREFLIGHT_V2_CHECKS.length],
    ["$.status", ["passed", "failed"].includes(value?.status) && (value.status === "passed") === (Array.isArray(checks) && checks.every((item) => item.result === "pass"))]
  ]);
  return value;
}

export function compileXhsContentPreflightV2({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, contentMaster, confirmedOutline, authorizedReferenceAssets = [] }) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.preflightReportV2;
  let validationsPass = true;
  try {
    validateXhsPostCopy(postCopy);
    validateXhsFinalTitleBinding(finalTitleBinding);
    validateXhsCarouselPlanV2(carouselPlan);
    validateXhsVisualAssetPlan(visualAssetPlan);
    validateXhsTraceabilityV2(traceability);
  } catch {
    validationsPass = false;
  }
  requirePaths(contract, [["input.components", validationsPass], ["input.confirmedOutline", object(confirmedOutline)], ["input.authorizedReferenceAssets", refs(authorizedReferenceAssets)]]);
  validateMasterAuthority(contentMaster, postCopy.authorityBinding, contract);
  const allComponents = [finalTitleBinding, carouselPlan, visualAssetPlan, traceability];
  const sameBinding = allComponents.every((item) => sameAuthority(postCopy.authorityBinding, item.authorityBinding));
  const expectedTitleRef = componentRef(finalTitleBinding, "bindingHash");
  const componentHashes = finalTitleBinding.postCopyRef.hash === postCopy.componentHash
    && carouselPlan.postCopyRef.hash === postCopy.componentHash
    && hashUnifiedContent(carouselPlan.finalTitleBindingRef) === hashUnifiedContent(expectedTitleRef)
    && visualAssetPlan.carouselPlanRef.hash === carouselPlan.componentHash
    && traceability.componentRefs.postCopy.hash === postCopy.componentHash
    && traceability.componentRefs.finalTitleBinding.hash === finalTitleBinding.bindingHash
    && traceability.componentRefs.carouselPlan.hash === carouselPlan.componentHash
    && traceability.componentRefs.visualAssetPlan.hash === visualAssetPlan.componentHash;
  const outlineHash = hashUnifiedContent(confirmedOutline);
  const outlineSections = Array.isArray(confirmedOutline.sections) ? confirmedOutline.sections : [];
  const outlineBinding = confirmedOutline.outline_id === postCopy.authorityBinding.confirmedOutlineRef.id
    && outlineHash === postCopy.authorityBinding.confirmedOutlineRef.hash
    && confirmedOutline.content_promise === postCopy.contentPromise
    && outlineSections.length === postCopy.bodySections.length && outlineSections.length === carouselPlan.pages.length
    && outlineSections.every((section, index) => {
      const binding = OUTLINE_ROLE_BINDINGS[section.role];
      const body = postCopy.bodySections[index];
      const page = carouselPlan.pages[index];
      return binding && body?.sectionId === section.section_id && body?.outlineRole === section.role && body?.role === binding.body
        && page?.outlineSectionId === section.section_id && page?.outlineRole === section.role && page?.role === binding.page;
    });
  const pageOrder = carouselPlan.pages.every((page, index) => page.page === index + 1)
    && visualAssetPlan.pageVisuals.every((page, index) => page.page === index + 1)
    && visualAssetPlan.pageAssetBindings.every((binding, index) => binding.page === index + 1)
    && traceability.pageClaimMap.every((entry, index) => entry.page === index + 1);
  const pageTexts = carouselPlan.pages.map(normalizedPageText);
  const takeaways = carouselPlan.pages.map((page) => page.takeaway.trim().replace(/\s+/g, " ").toLowerCase());
  const nonRepeated = new Set(pageTexts).size === pageTexts.length && new Set(takeaways).size === takeaways.length;
  const coverHeadline = carouselPlan.pages[0]?.textLayers.find((item) => item.type === "headline")?.text;
  const titleBound = finalTitleBinding.postCopyRef.hash === postCopy.componentHash
    && coverHeadline === finalTitleBinding.title
    && hashUnifiedContent(carouselPlan.finalTitleBindingRef) === hashUnifiedContent(expectedTitleRef);
  const intentAligned = titleBound && carouselPlan.postCopyRef.hash === postCopy.componentHash;
  const authorizedMap = new Map(authorizedReferenceAssets.map((item) => [item.id, item.hash]));
  const visualsAuthorized = visualAssetPlan.authorizedReferenceAssets.every((item) => authorizedMap.get(item.id) === item.hash)
    && visualAssetPlan.imageSpecs.flatMap((item) => item.referenceAssetIds).every((id) => authorizedMap.has(id));
  let tracePasses = false;
  try {
    const compiled = compileXhsTraceabilityV2({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, contentMaster, authorizedReferenceAssets });
    tracePasses = compiled.traceHash === traceability.traceHash;
  } catch {}
  const facts = [
    ["authority_binding", sameBinding, "all components use one immutable authority binding"],
    ["component_hash_integrity", componentHashes, "component refs bind validated component hashes"],
    ["final_title_binding", titleBound, "cover and title claims bind the immutable balanced title selection"],
    ["confirmed_outline_binding", outlineBinding, "copy and carousel bind the confirmed outline"],
    ["page_order_and_role", pageOrder, "page order and role coverage are deterministic"],
    ["cross_page_repetition", nonRepeated, "page text and takeaways are not duplicated"],
    ["copy_carousel_intent_alignment", intentAligned, "cover promise follows the final title binding without mutating post copy"],
    ["promotion_policy", promotionPasses(postCopy, contentMaster), "promotion use follows ContentMaster policy"],
    ["visual_reference_authorization", visualsAuthorized, "visual references match the authorized asset set"],
    ["traceability_integrity", tracePasses, "traceability equals deterministic v2 compilation"]
  ];
  const checks = facts.map(([check, passed, detail]) => ({ check, result: passed ? "pass" : "fail", detail }));
  const draft = {
    schemaVersion: "2.0", contract, id: `xhs-preflight-v2:${carouselPlan.id}`, authorityBinding: clone(postCopy.authorityBinding),
    componentRefs: { postCopy: componentRef(postCopy), finalTitleBinding: expectedTitleRef, carouselPlan: componentRef(carouselPlan), visualAssetPlan: componentRef(visualAssetPlan) },
    traceabilityRef: componentRef(traceability, "traceHash"), checks,
    status: checks.every((item) => item.result === "pass") ? "passed" : "failed", reportHash: ""
  };
  const value = withHash(draft, "reportHash");
  validateXhsContentPreflightReportV2(value);
  return deepFreeze(value);
}

const PACKAGE_KEYS = ["schemaVersion", "contract", "id", "authorityBinding", "componentRefs", "assembly", "packageHash"];

export function validateXhsPostPackageV3(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.package;
  validateCommon(value, contract, "packageHash", PACKAGE_KEYS, "3.0");
  requirePaths(contract, [
    ["$.componentRefs", exact(value?.componentRefs, PACKAGE_COMPONENT_REF_KEYS) && PACKAGE_COMPONENT_REF_KEYS.every((key) => ref(value.componentRefs[key]))],
    ["$.assembly", exact(value?.assembly, ["mode", "status", "providerAuthored", "mutable"])],
    ["$.assembly.mode", value?.assembly?.mode === "deterministic_component_assembly"],
    ["$.assembly.status", value?.assembly?.status === "assembled"],
    ["$.assembly.providerAuthored", value?.assembly?.providerAuthored === false],
    ["$.assembly.mutable", value?.assembly?.mutable === false]
  ]);
  return value;
}

export function assembleXhsPostPackageV3({ id, postCopy, carouselPlan, visualAssetPlan, traceability, preflightReport }) {
  validateXhsPostCopy(postCopy);
  validateXhsCarouselPlan(carouselPlan);
  validateXhsVisualAssetPlan(visualAssetPlan);
  validateXhsTraceability(traceability);
  validateXhsContentPreflightReport(preflightReport);
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.package;
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.authorityBinding", [carouselPlan, visualAssetPlan, traceability, preflightReport].every((item) => sameAuthority(postCopy.authorityBinding, item.authorityBinding))],
    ["input.preflightReport.status", preflightReport.status === "passed"],
    ["input.componentRefs", preflightReport.componentRefs.postCopy.hash === postCopy.componentHash && preflightReport.componentRefs.carouselPlan.hash === carouselPlan.componentHash && preflightReport.componentRefs.visualAssetPlan.hash === visualAssetPlan.componentHash && preflightReport.traceabilityRef.hash === traceability.traceHash]
  ]);
  const draft = {
    schemaVersion: "3.0",
    contract,
    id,
    authorityBinding: clone(postCopy.authorityBinding),
    componentRefs: {
      postCopy: componentRef(postCopy),
      carouselPlan: componentRef(carouselPlan),
      visualAssetPlan: componentRef(visualAssetPlan),
      traceability: componentRef(traceability, "traceHash"),
      preflightReport: componentRef(preflightReport, "reportHash")
    },
    assembly: { mode: "deterministic_component_assembly", status: "assembled", providerAuthored: false, mutable: false },
    packageHash: ""
  };
  const value = withHash(draft, "packageHash");
  validateXhsPostPackageV3(value);
  return deepFreeze(value);
}

export function validateXhsPostPackageV4(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.packageV4;
  validateCommon(value, contract, "packageHash", PACKAGE_KEYS, "4.0");
  requirePaths(contract, [
    ["$.componentRefs", exact(value?.componentRefs, PACKAGE_V4_COMPONENT_REF_KEYS) && PACKAGE_V4_COMPONENT_REF_KEYS.every((key) => ref(value.componentRefs[key]))],
    ["$.assembly", exact(value?.assembly, ["mode", "status", "providerAuthored", "mutable"])],
    ["$.assembly.mode", value?.assembly?.mode === "deterministic_component_assembly"],
    ["$.assembly.status", value?.assembly?.status === "assembled"],
    ["$.assembly.providerAuthored", value?.assembly?.providerAuthored === false],
    ["$.assembly.mutable", value?.assembly?.mutable === false]
  ]);
  return value;
}

export function assembleXhsPostPackageV4({ id, postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport }) {
  validateXhsPostCopy(postCopy);
  validateXhsFinalTitleBinding(finalTitleBinding);
  validateXhsCarouselPlanV2(carouselPlan);
  validateXhsVisualAssetPlan(visualAssetPlan);
  validateXhsTraceabilityV2(traceability);
  validateXhsContentPreflightReportV2(preflightReport);
  const failedPreflightChecks = Array.isArray(preflightReport?.checks)
    ? preflightReport.checks.filter((item) => item?.result !== "pass").map((item) => item?.check).filter(Boolean)
    : [];
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.packageV4;
  const expectedRefs = {
    postCopy: componentRef(postCopy), finalTitleBinding: componentRef(finalTitleBinding, "bindingHash"),
    carouselPlan: componentRef(carouselPlan), visualAssetPlan: componentRef(visualAssetPlan)
  };
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.authorityBinding", [finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport].every((item) => sameAuthority(postCopy.authorityBinding, item.authorityBinding))],
    ["input.preflightReport.status", preflightReport.status === "passed"],
    ...failedPreflightChecks.map((check) => [`input.preflightReport.checks.${check}`, false]),
    ["input.finalTitleBinding.postCopyRef", hashUnifiedContent(finalTitleBinding.postCopyRef) === hashUnifiedContent(expectedRefs.postCopy)],
    ["input.componentRefs", V2_COMPONENT_REF_KEYS.every((key) => hashUnifiedContent(preflightReport.componentRefs[key]) === hashUnifiedContent(expectedRefs[key]))
      && preflightReport.traceabilityRef.hash === traceability.traceHash]
  ]);
  const draft = {
    schemaVersion: "4.0", contract, id, authorityBinding: clone(postCopy.authorityBinding),
    componentRefs: { ...expectedRefs, traceability: componentRef(traceability, "traceHash"), preflightReport: componentRef(preflightReport, "reportHash") },
    assembly: { mode: "deterministic_component_assembly", status: "assembled", providerAuthored: false, mutable: false }, packageHash: ""
  };
  const value = withHash(draft, "packageHash");
  validateXhsPostPackageV4(value);
  return deepFreeze(value);
}

const PROJECTION_KEYS = ["schemaVersion", "contract", "id", "authorityBinding", "sourcePackageRef", "provenance", "projectedContract", "projectedPackage", "projectionHash"];

export function validateXhsV2ReadOnlyProjection(value) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.legacyProjection;
  validateCommon(value, contract, "projectionHash", PROJECTION_KEYS);
  requirePaths(contract, [
    ["$.sourcePackageRef", ref(value?.sourcePackageRef)],
    ["$.provenance", exact(value?.provenance, ["kind", "readOnly", "promotionEligible", "nativeV2ProviderOutput"])],
    ["$.provenance.kind", value?.provenance?.kind === "derived_from_xhs_post_package_v3"],
    ["$.provenance.readOnly", value?.provenance?.readOnly === true],
    ["$.provenance.promotionEligible", value?.provenance?.promotionEligible === false],
    ["$.provenance.nativeV2ProviderOutput", value?.provenance?.nativeV2ProviderOutput === false],
    ["$.projectedContract", value?.projectedContract === "XhsPostPackage@2.0"],
    ["$.projectedPackage", object(value?.projectedPackage)]
  ]);
  return value;
}

function validateLegacyProjectionContext(value, authorityBinding, contract) {
  const keys = ["schemaVersion", "contract", "id", "platform", "topicId", "intentProfileId", "contentPurposeId", "accountContext", "creativeMechanism", "journeyStage", "matrixCoordination", "contextHash"];
  requirePaths(contract, [
    ["input.legacyProjectionContext", exact(value, keys)],
    ["input.legacyProjectionContext.schemaVersion", value?.schemaVersion === "1.0"],
    ["input.legacyProjectionContext.contract", value?.contract === "XhsV2ProjectionContext@1.0"],
    ["input.legacyProjectionContext.id", value?.id === authorityBinding?.writerContextRef?.id],
    ["input.legacyProjectionContext.platform", value?.platform === "xiaohongshu"],
    ["input.legacyProjectionContext.fields", [value?.topicId, value?.intentProfileId, value?.contentPurposeId, value?.creativeMechanism, value?.journeyStage].every(text) && object(value?.accountContext) && object(value?.matrixCoordination)],
    ["input.legacyProjectionContext.contextHash", validHash(value, "contextHash") && value?.contextHash === authorityBinding?.writerContextRef?.hash]
  ]);
}

export function projectXhsPostPackageV3ToV2ReadOnly({ packageV3, postCopy, carouselPlan, visualAssetPlan, traceability, preflightReport, legacyProjectionContext }) {
  validateXhsPostPackageV3(packageV3);
  validateXhsPostCopy(postCopy);
  validateXhsCarouselPlan(carouselPlan);
  validateXhsVisualAssetPlan(visualAssetPlan);
  validateXhsTraceability(traceability);
  validateXhsContentPreflightReport(preflightReport);
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.legacyProjection;
  validateLegacyProjectionContext(legacyProjectionContext, packageV3.authorityBinding, contract);
  requirePaths(contract, [
    ["input.componentRefs", packageV3.componentRefs.postCopy.hash === postCopy.componentHash && packageV3.componentRefs.carouselPlan.hash === carouselPlan.componentHash && packageV3.componentRefs.visualAssetPlan.hash === visualAssetPlan.componentHash && packageV3.componentRefs.traceability.hash === traceability.traceHash && packageV3.componentRefs.preflightReport.hash === preflightReport.reportHash],
    ["input.preflightReport.status", preflightReport.status === "passed"]
  ]);
  const visuals = new Map(visualAssetPlan.pageVisuals.map((item) => [item.page, item]));
  const bindings = new Map(visualAssetPlan.pageAssetBindings.map((item) => [item.page, item.plannedAssetIds]));
  const resultByCheck = new Map(preflightReport.checks.map((item) => [item.check, item.result]));
  const projectedPackage = {
    platform: "xiaohongshu",
    topic_id: legacyProjectionContext.topicId,
    intent_profile_id: legacyProjectionContext.intentProfileId,
    content_purpose_id: legacyProjectionContext.contentPurposeId,
    account_context: clone(legacyProjectionContext.accountContext),
    creative_mechanism: legacyProjectionContext.creativeMechanism,
    journey_stage: legacyProjectionContext.journeyStage,
    matrix_coordination: clone(legacyProjectionContext.matrixCoordination),
    content_promise: postCopy.contentPromise,
    engagement_strategy: {
      mode: postCopy.engagementStrategy.mode,
      primary_action: postCopy.engagementStrategy.primaryAction,
      reason: postCopy.engagementStrategy.reason,
      cta_placement: postCopy.engagementStrategy.ctaPlacement,
      cta_text: postCopy.engagementStrategy.ctaText
    },
    post_copy: {
      title_candidates: postCopy.titleCandidates.map((item) => ({ title: item.title, hook_type: item.hookType, claim_ids: [...item.claimIds], risk: item.risk })),
      recommended_title: postCopy.recommendedTitle,
      opening: postCopy.opening,
      body_sections: postCopy.bodySections.map((item) => ({ section_id: item.sectionId, role: item.role, text: item.text, claim_ids: [...item.claimIds] })),
      ending: postCopy.ending,
      pinned_comment: postCopy.pinnedComment,
      hashtags: [...postCopy.hashtags],
      cta: postCopy.cta
    },
    deck: {
      deck_id: carouselPlan.deckId,
      canvas: clone(carouselPlan.canvas),
      design_dna_version: carouselPlan.designDnaVersion,
      reading_arc: carouselPlan.readingArc,
      pages: carouselPlan.pages.map((page) => ({
        page: page.page,
        role: page.role,
        objective: page.objective,
        takeaway: page.takeaway,
        text_layers: page.textLayers.map((item) => ({ type: item.type, text: item.text, max_lines: item.maxLines, priority: item.priority })),
        layout_hint: page.layoutHint,
        visual_function: visuals.get(page.page).visualFunction,
        visual_need: visuals.get(page.page).visualNeed,
        render_strategy: visuals.get(page.page).renderStrategy,
        asset_ids: [...bindings.get(page.page)],
        fact_ids: [...page.factIds],
        interpretation_ids: [...page.interpretationIds],
        must_avoid: [...new Set([...page.mustAvoid, ...visuals.get(page.page).mustAvoid])]
      }))
    },
    image_specs: visualAssetPlan.imageSpecs.map((item) => ({
      asset_id: item.plannedAssetId, page: item.page, use_case: item.useCase, asset_type: item.assetType,
      scene: item.scene, subject: item.subject, style_and_medium: item.styleAndMedium, composition: item.composition,
      lighting: item.lighting, palette: [...item.palette], materials: item.materials, text_safe_area: item.textSafeArea,
      prompt: item.prompt, negative_prompt: item.negativePrompt, reference_asset_ids: [...item.referenceAssetIds],
      design_dna_version: item.designDnaVersion, size: item.size, must_keep: [...item.mustKeep], must_avoid: [...item.mustAvoid], text_policy: item.textPolicy
    })),
    skipped_image_pages: visualAssetPlan.skippedPages.map((item) => ({ page: item.page, reason: item.reason })),
    traceability: {
      used_fact_ids: [...traceability.usedFactIds],
      used_interpretation_ids: [...traceability.usedInterpretationIds],
      used_knowledge_asset_ids: [...traceability.usedKnowledgeAssetIds],
      page_claim_map: traceability.pageClaimMap.map((item) => ({ page: item.page, claim_ids: [...item.claimIds] }))
    },
    preflight_checks: [
      ["promise_consistency", "copy_carousel_intent_alignment"],
      ["claim_traceability", "traceability_integrity"],
      ["image_text_separation", "visual_reference_authorization"],
      ["page_non_repetition", "cross_page_repetition"],
      ["intent_and_promotion_alignment", "promotion_policy"],
      ["account_identity_alignment", "authority_binding"],
      ["matrix_differentiation", "authority_binding"]
    ].map(([check, source]) => ({ check, result: resultByCheck.get(source) === "pass" ? (check === "matrix_differentiation" ? "not_applicable" : "pass") : "fail", detail: "derived from deterministic XhsContentPreflightReport@1.0" }))
  };
  const draft = {
    schemaVersion: "1.0",
    contract,
    id: `xhs-v2-readonly:${packageV3.id}`,
    authorityBinding: clone(packageV3.authorityBinding),
    sourcePackageRef: componentRef(packageV3, "packageHash"),
    provenance: { kind: "derived_from_xhs_post_package_v3", readOnly: true, promotionEligible: false, nativeV2ProviderOutput: false },
    projectedContract: "XhsPostPackage@2.0",
    projectedPackage,
    projectionHash: ""
  };
  const value = withHash(draft, "projectionHash");
  validateXhsV2ReadOnlyProjection(value);
  return deepFreeze(value);
}

export function createXhsV2ProjectionContext(input) {
  const contract = XHS_CONTENT_COMPONENT_CONTRACTS.legacyProjection;
  const keys = ["schemaVersion", "contract", "id", "platform", "topicId", "intentProfileId", "contentPurposeId", "accountContext", "creativeMechanism", "journeyStage", "matrixCoordination"];
  requirePaths(contract, [["input.legacyProjectionContext", exact(input, keys)]]);
  return deepFreeze(withHash(clone(input), "contextHash"));
}
