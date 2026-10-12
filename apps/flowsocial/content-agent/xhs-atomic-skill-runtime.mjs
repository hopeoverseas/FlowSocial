import { runContentSkill } from "./skill-runner.mjs";
import {
  createXhsPostCopy,
  createXhsCarouselPlan,
  createXhsCarouselPlanV2,
  validateXhsFinalTitleBinding,
  createXhsVisualAssetPlan
} from "./xhs-content-components.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";

const PLATFORM = "xiaohongshu";
const HASH = /^[a-f0-9]{64}$/;
const CAPABILITIES = Object.freeze({
  "write-xhs-post-copy": Object.freeze({ outputContract: "XhsPostCopyCreativeOutput@1.0", componentContract: "XhsPostCopy@1.0" }),
  "plan-xhs-carousel": Object.freeze({ outputContract: "XhsCarouselPlanCreativeOutput@1.0", componentContract: "XhsCarouselPlan@1.0" }),
  "plan-xhs-visual-assets": Object.freeze({ outputContract: "XhsVisualAssetPlanCreativeOutput@1.0", componentContract: "XhsVisualAssetPlan@1.0" })
});
const ROLE = Object.freeze({ hook: ["scene", "cover"], problem: ["problem", "problem"], diagnosis: ["conclusion", "conclusion"], evidence: ["evidence", "evidence"], method: ["method", "method"], example: ["evidence", "case"], action: ["summary", "cta"], boundary: ["warning", "warning"] });

function fail(capability, paths, code = "XHS_ATOMIC_SKILL_OUTPUT_INVALID") {
  const canonicalPath = (path) => typeof path === "string" && /^\$\.(pages|engagementStrategy|titleCandidates|bodySections|promotionUse)(\.|\[|$)/.test(path)
    ? `$.data.${path.slice(2)}`
      .replaceAll(".textLayers", ".text_layers")
      .replaceAll(".factIds", ".fact_ids")
      .replaceAll(".interpretationIds", ".interpretation_ids")
      .replaceAll(".knowledgeAssetIds", ".knowledge_asset_ids")
    : path;
  throw Object.assign(new Error("XHS atomic Skill output rejected"), { code, statusCode: 409, details: { capability, fieldPaths: [...new Set(paths.map(canonicalPath))], runtimeBoundary: true } });
}
function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function exact(value, keys) { return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function text(value) { return typeof value === "string" && Boolean(value.trim()); }
function strings(value) { return Array.isArray(value) && value.every(text) && new Set(value).size === value.length; }
function ref(value) { return exact(value, ["id", "hash"]) && text(value.id) && HASH.test(value.hash); }
function sameRef(left, right) { return ref(left) && ref(right) && left.id === right.id && left.hash === right.hash; }
function sameAuthority(left, right) { return object(left) && object(right) && hashUnifiedContent(left) === hashUnifiedContent(right); }
function requireChecks(capability, checks, code) { const paths = checks.filter(([, pass]) => !pass).map(([path]) => path); if (paths.length) fail(capability, paths, code); }
function clone(value) { return structuredClone(value); }
function createComponent(capability, factory) {
  try { return factory(); }
  catch (error) {
    if (error?.code === "XHS_ATOMIC_SKILL_OUTPUT_INVALID" && error?.details?.runtimeBoundary === true) throw error;
    if (["XHS_ATOMIC_SKILL_OUTPUT_INVALID", "XHS_CONTENT_COMPONENT_INVALID"].includes(error?.code)) {
      const fieldPaths = error?.details?.fieldPaths;
      if (Array.isArray(fieldPaths) && fieldPaths.length) fail(capability, fieldPaths);
      throw error;
    }
    const creativePath = (path) => {
      if (path === "input.authorityBinding") return "system.authorityBinding";
      if (path === "input.postCopyRef") return "system.postCopy";
      if (path === "input.finalTitleBindingRef") return "system.finalTitleContext.binding";
      if (path === "input.pages[0].textLayers.headline") return "$.data.pages[0].text_layers";
      if ((path.startsWith("$.pages[") || path.startsWith("$.data.pages[")) && !path.includes("textLayers")) return "$.data.pages[]";
      if (path === "$") return "$.data";
      if (!path.startsWith("$.")) return "$.data";
      return `$.data${path.slice(1)}`
        .replaceAll(".deckId", ".deck_id")
        .replaceAll(".readingArc", ".reading_arc")
        .replaceAll(".outlineSectionId", ".outline_section_id")
        .replaceAll(".outlineRole", ".outline_role")
        .replaceAll(".textLayers", ".text_layers")
        .replaceAll(".maxLines", ".max_lines")
        .replaceAll(".layoutHint", ".layout_hint")
        .replaceAll(".factIds", ".fact_ids")
        .replaceAll(".interpretationIds", ".interpretation_ids")
        .replaceAll(".knowledgeAssetIds", ".knowledge_asset_ids");
    };
    const paths = error?.details?.fieldPaths?.map(creativePath) || ["$.data"];
    fail(capability, paths);
  }
}

function validateEnvelope(capability, envelope) {
  requireChecks(capability, [
    ["$", exact(envelope, ["status", "data", "warnings", "blocked_reasons"])],
    ["$.status", ["success", "needs_review", "blocked"].includes(envelope?.status)],
    ["$.warnings", strings(envelope?.warnings)],
    ["$.blocked_reasons", strings(envelope?.blocked_reasons)]
  ]);
  if (envelope.status !== "success") {
    requireChecks(capability, [["$.data", envelope.data === null], ["$.blocked_reasons", envelope.blocked_reasons.length > 0], ["$.warnings", envelope.status !== "needs_review" || envelope.warnings.length > 0]]);
    const error = Object.assign(new Error("XHS atomic Skill output rejected"), {
      code: "XHS_ATOMIC_SKILL_NON_SUCCESS",
      statusCode: 409,
      details: {
        capability,
        fieldPaths: ["$.status"],
        status: envelope.status,
        warnings: envelope.warnings,
        blockedReasons: envelope.blocked_reasons
      }
    });
    if (process.env.NODE_ENV !== "test") console.warn(`[FlowSocial] 小红书原子输出状态 ${envelope.status}：${[...envelope.warnings, ...envelope.blocked_reasons].join("；") || "未提供原因"}`);
    throw error;
  }
  requireChecks(capability, [["$.data", object(envelope.data)], ["$.warnings", envelope.warnings.length === 0], ["$.blocked_reasons", envelope.blocked_reasons.length === 0]]);
}

function validateSystem(capability, system) {
  requireChecks(capability, [
    ["system", object(system)], ["system.componentId", text(system?.componentId)],
    ["system.authorityBinding", object(system?.authorityBinding)],
    ["system.confirmedOutlineRef", sameRef(system?.confirmedOutlineRef, system?.authorityBinding?.confirmedOutlineRef)],
    ["system.confirmedOutlineSections", Array.isArray(system?.confirmedOutlineSections) && system.confirmedOutlineSections.length > 0 && system.confirmedOutlineSections.every((item) => exact(item, ["sectionId", "outlineRole"]) && text(item.sectionId) && Object.hasOwn(ROLE, item.outlineRole))]
  ], "XHS_ATOMIC_SKILL_AUTHORITY_INVALID");
}

function validateInvocationContext(capability, system) {
  validateSystem(capability, system);
  if (capability === "write-xhs-post-copy") requireChecks(capability, [
    ["system.authorityBinding.sharedContentMasterRef", sameRef(system.contentMasterRef, system.authorityBinding.sharedContentMasterRef)],
    ["system.authorityBinding.platformBriefRef", sameRef(system.platformBriefRef, system.authorityBinding.platformBriefRef)],
    ["system.authorityBinding.writerContextRef", sameRef(system.writerContextRef, system.authorityBinding.writerContextRef)],
    ["system.authorityBinding.mechanismDecisionRef", sameRef(system.mechanismDecisionRef, system.authorityBinding.mechanismDecisionRef)],
    ["system.promotionPolicy", object(system.promotionPolicy) && Array.isArray(system.promotionPolicy.allowedItemIds)],
    ["system.authorizedClaimIds", Array.isArray(system.authorizedClaimIds)],
    ["system.authorizedNonClaimOpinionIds", system.authorizedNonClaimOpinionIds == null || Array.isArray(system.authorizedNonClaimOpinionIds)],
    ["system.authorizedKnowledgeAssetIds", Array.isArray(system.authorizedKnowledgeAssetIds)]
  ], "XHS_ATOMIC_SKILL_AUTHORITY_INVALID");
  if (capability === "plan-xhs-carousel") requireChecks(capability, [
    ["system.postCopy", system.postCopy?.contract === "XhsPostCopy@1.0" && sameAuthority(system.postCopy.authorityBinding, system.authorityBinding)],
    ["system.authorityBinding.designDnaRef", sameRef(system.designDnaRef, system.authorityBinding.designDnaRef)],
    ["system.designDnaVersion", text(system.designDnaVersion)],
    ["system.authorizedFactIds", Array.isArray(system.authorizedFactIds)],
    ["system.authorizedInterpretationIds", Array.isArray(system.authorizedInterpretationIds)],
    ["system.authorizedKnowledgeAssetIds", Array.isArray(system.authorizedKnowledgeAssetIds)],
    ["system.pageMustAvoid", system.pageMustAvoid == null || (Array.isArray(system.pageMustAvoid) && system.pageMustAvoid.every(strings))]
  ], "XHS_ATOMIC_SKILL_AUTHORITY_INVALID");
  if (capability === "plan-xhs-carousel" && Object.hasOwn(system, "finalTitleContext")) {
    const context = system.finalTitleContext;
    let bindingValid = true;
    try { validateXhsFinalTitleBinding(context?.binding); } catch { bindingValid = false; }
    requireChecks(capability, [
      ["system.finalTitleContext", exact(context, ["binding"])],
      ["system.finalTitleContext.binding", bindingValid],
      ["system.finalTitleContext.binding.authorityBinding", bindingValid && sameAuthority(context.binding.authorityBinding, system.authorityBinding)],
      ["system.finalTitleContext.binding.postCopyRef", bindingValid && sameRef(context.binding.postCopyRef, { id: system.postCopy?.id, hash: system.postCopy?.componentHash })],
      ["system.finalTitleContext.binding.claimIds", bindingValid && context.binding.claimIds.every((id) => system.authorizedFactIds.includes(id) || system.authorizedInterpretationIds.includes(id))]
    ], "XHS_ATOMIC_SKILL_AUTHORITY_INVALID");
  }
  if (capability === "plan-xhs-visual-assets") requireChecks(capability, [
    ["system.carouselPlan", ["XhsCarouselPlan@1.0", "XhsCarouselPlan@2.0"].includes(system.carouselPlan?.contract) && sameAuthority(system.carouselPlan.authorityBinding, system.authorityBinding)],
    ["system.authorityBinding.designDnaRef", sameRef(system.designDnaRef, system.authorityBinding.designDnaRef)],
    ["system.designDnaVersion", system.designDnaVersion === system.carouselPlan?.designDnaVersion],
    ["system.pageTextTruth", Array.isArray(system.pageTextTruth) && system.pageTextTruth.length === system.carouselPlan?.pages?.length && system.pageTextTruth.every((item, index) => object(item) && object(system.carouselPlan.pages[index]) && item.page === system.carouselPlan.pages[index].page && Array.isArray(item.textLayers) && Array.isArray(system.carouselPlan.pages[index].textLayers) && hashUnifiedContent(item.textLayers) === hashUnifiedContent(system.carouselPlan.pages[index].textLayers))],
    ["system.authorizedReferenceAssets", Array.isArray(system.authorizedReferenceAssets) && system.authorizedReferenceAssets.every((item) => object(item) && text(item.id) && HASH.test(item.hash || ""))]
  ], "XHS_ATOMIC_SKILL_AUTHORITY_INVALID");
}

function validatePost(capability, data, system) {
  const keys = ["schemaVersion", "contract", "contentPromise", "engagementStrategy", "titleCandidates", "recommendedTitle", "opening", "bodySections", "ending", "pinnedComment", "hashtags", "cta", "promotionUse"];
  const governedPromotionUse = {
    mode: system.promotionPolicy.mode,
    itemIds: system.promotionPolicy.mode === "none" ? [] : [...(data?.promotionUse?.itemIds || [])],
    disclosure: system.promotionPolicy.disclosure
  };
  requireChecks(capability, [
    ["$.data", exact(data, keys)], ["$.data.schemaVersion", data?.schemaVersion === "1.0"], ["$.data.contract", data?.contract === CAPABILITIES[capability].outputContract],
    ["$.data.engagementStrategy", exact(data?.engagementStrategy, ["mode", "primaryAction", "reason", "ctaPlacement", "ctaText"])],
    ["$.data.engagementStrategy.ctaText", typeof data?.engagementStrategy?.ctaText === "string"],
    ["$.data.titleCandidates", Array.isArray(data?.titleCandidates) && data.titleCandidates.every((item) => exact(item, ["title", "hookType", "claimIds", "risk"]))],
    ["$.data.bodySections", Array.isArray(data?.bodySections) && data.bodySections.length === system.confirmedOutlineSections.length && data.bodySections.every((item, index) => exact(item, ["sectionId", "outlineRole", "role", "text", "claimIds", "knowledgeAssetIds"]) && item.sectionId === system.confirmedOutlineSections[index].sectionId && item.outlineRole === system.confirmedOutlineSections[index].outlineRole && item.role === ROLE[item.outlineRole]?.[0])],
    ["$.data.promotionUse", exact(data?.promotionUse, ["mode", "itemIds", "disclosure"])]
  ]);
  requireChecks(capability, [
    ["$.data.titleCandidates[].claimIds", data.titleCandidates.every((item) => strings(item.claimIds))],
    ["$.data.bodySections[].claimIds", data.bodySections.every((item) => strings(item.claimIds))],
    ["$.data.bodySections[].knowledgeAssetIds", data.bodySections.every((item) => strings(item.knowledgeAssetIds))],
    ["$.data.promotionUse.itemIds", strings(data?.promotionUse?.itemIds)]
  ]);
  requireChecks(capability, [
    ["$.data.claimIds", [...(data?.titleCandidates || []), ...(data?.bodySections || [])].flatMap((item) => item.claimIds || []).every((id) => system.authorizedClaimIds?.includes(id))],
    ["$.data.knowledgeAssetIds", (data?.bodySections || []).flatMap((item) => item.knowledgeAssetIds || []).every((id) => system.authorizedKnowledgeAssetIds?.includes(id))],
    ["$.data.promotionUse", governedPromotionUse.mode === system.promotionPolicy.mode && governedPromotionUse.itemIds.every((id) => system.promotionPolicy.allowedItemIds.includes(id)) && governedPromotionUse.disclosure === system.promotionPolicy.disclosure]
  ]);
  return createComponent(capability, () => createXhsPostCopy({ schemaVersion: "1.0", contract: CAPABILITIES[capability].componentContract, id: system.componentId, authorityBinding: clone(system.authorityBinding), contentPromise: text(system.confirmedContentPromise) ? system.confirmedContentPromise : data.contentPromise, engagementStrategy: clone(data.engagementStrategy), titleCandidates: clone(data.titleCandidates), recommendedTitle: data.recommendedTitle, opening: data.opening, bodySections: clone(data.bodySections), ending: data.ending, pinnedComment: data.pinnedComment, hashtags: clone(data.hashtags), cta: data.cta, promotionUse: clone(governedPromotionUse) }));
}

function normalizeAuthorizedReferenceList(values, authorizedIds, removableNonClaimIds = []) {
  if (!Array.isArray(values) || !Array.isArray(authorizedIds)) return values;
  const allowed = new Set(authorizedIds);
  const normalized = [];
  for (const value of values) {
    if (typeof value !== "string") {
      normalized.push(value);
      continue;
    }
    const trimmed = value.trim();
    if (removableNonClaimIds.includes(trimmed)) continue;
    if (allowed.has(trimmed)) {
      normalized.push(trimmed);
      continue;
    }
    const parts = trimmed.split(/[,，、;；/|\s]+/).filter(Boolean);
    if (parts.length > 1 && parts.every((part) => allowed.has(part))) normalized.push(...parts);
    else normalized.push(value);
  }
  return [...new Set(normalized)];
}

function normalizePostReferenceSyntax(envelope, system) {
  if (!object(envelope?.data)) return envelope;
  const normalized = clone(envelope);
  const hookTypeAliases = new Map([
    ["guide", "checklist"], ["steps", "checklist"], ["step", "checklist"], ["method", "checklist"], ["list", "checklist"],
    ["pain", "problem"], ["pain_point", "problem"], ["painpoint", "problem"],
    ["benefit", "result"], ["outcome", "result"], ["solution", "result"],
    ["comparison", "contrast"], ["compare", "contrast"], ["versus", "contrast"],
    ["how_to", "question"], ["howto", "question"]
  ]);
  for (const item of normalized.data.titleCandidates || []) {
    const hookTypeKey = typeof item.hookType === "string" ? item.hookType.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_") : null;
    if (hookTypeAliases.has(hookTypeKey)) item.hookType = hookTypeAliases.get(hookTypeKey);
    item.claimIds = normalizeAuthorizedReferenceList(item.claimIds, system.authorizedClaimIds, system.authorizedNonClaimOpinionIds);
  }
  for (const item of normalized.data.bodySections || []) {
    item.claimIds = normalizeAuthorizedReferenceList(item.claimIds, system.authorizedClaimIds, system.authorizedNonClaimOpinionIds);
    item.knowledgeAssetIds = normalizeAuthorizedReferenceList(item.knowledgeAssetIds, system.authorizedKnowledgeAssetIds);
  }
  return normalized;
}

// Provider history contains two carousel envelopes: the current flat creative
// draft and the older `deck` wrapper.  Normalize only those allowlisted creative
// aliases here; page identity/order/roles remain Runtime-owned below.
function normalizeCarouselDraft(data) {
  if (!object(data)) return data;
  const legacyCreativeDraft = object(data.creativeDraft) || object(data.creative_draft) || object(data.carousel) || object(data.deck);
  // Creative Draft history has appeared both as a flat payload and wrapped
  // under `creativeDraft`/`creative_draft`; older plan payloads additionally
  // wrap the page array in `deck`.  Unwrap only these known containers.  The
  // original Provider envelope remains untouched for evidence hashing.
  const draft = object(data.creativeDraft) ? data.creativeDraft
    : object(data.creative_draft) ? data.creative_draft
      : object(data.carousel) ? data.carousel : data;
  const allowedDraftKeys = new Set(["schemaVersion", "contract", "deck_id", "deckId", "reading_arc", "readingArc", "pages", "sections", "section_drafts", "creativeDraft", "creative_draft", "carousel", "deck"]);
  const unknownDraftKeys = Object.keys(draft).filter((key) => !allowedDraftKeys.has(key));
  if (unknownDraftKeys.length && !legacyCreativeDraft) fail("plan-xhs-carousel", ["$.data"]);
  const deck = object(draft.deck) ? draft.deck : null;
  const pages = Array.isArray(draft.section_drafts) ? draft.section_drafts
    : legacyCreativeDraft && Array.isArray(draft.pages) ? draft.pages
      : legacyCreativeDraft && Array.isArray(draft.sections) ? draft.sections
        : legacyCreativeDraft && Array.isArray(draft.section_drafts) ? draft.section_drafts : legacyCreativeDraft ? deck?.pages : null;
  if (!Array.isArray(pages)) return data;
  const machineKeys = new Set(["id", "hash", "authorityBinding", "authority_refs", "authorityRefs", "componentRefs", "component_refs", "componentHash", "component_hash", "canvas", "page", "page_number", "pageNumber", "outlineSectionId", "outline_section_id", "outlineRole", "outline_role", "role"]);
  const machinePaths = [];
  pages.forEach((page, index) => Object.keys(page || {}).forEach((key) => { if (machineKeys.has(key)) machinePaths.push(`$.data.pages[${index}].${key}`); }));
  Object.keys(draft).forEach((key) => { if (machineKeys.has(key)) machinePaths.push(`$.data.${key}`); });
  if (machinePaths.length && !legacyCreativeDraft) fail("plan-xhs-carousel", ["$.data.section_drafts[]"]);
  const pick = (value, aliases) => !object(value) ? undefined : aliases.find((key) => Object.hasOwn(value, key)) !== undefined
    ? value[aliases.find((key) => Object.hasOwn(value, key))]
    : undefined;
  const normalizeReaderFacingLayerText = (value) => {
    const raw = String(value || "").trim();
    const method = raw.match(/^METHOD\s*(\d+)\s*\/\s*(\d+)\s*[·:：\-]\s*(.+)$/i);
    if (method) return `第${method[1]}步 · ${method[3].trim()}`;
    const marker = raw.match(/^(?:HOOK|JUDGE|ACTION)\s*[·:：\-]\s*(.+)$/i);
    return marker ? marker[1].trim() : raw;
  };
  const layerValue = (page) => {
    const layers = pick(page, ["text_layers", "textLayers"]);
    if (Array.isArray(layers) && layers.length > 0) {
      // MiniMax occasionally emits the equivalent camelCase layer keys or
      // omits the presentation defaults. Normalize those syntax-only aliases
      // before the immutable text-truth checks; page text itself is never
      // invented or rewritten here.
      return layers.map((layer) => ({
        type: layer?.type || layer?.kind || "body",
        text: normalizeReaderFacingLayerText(layer?.text ?? layer?.content ?? ""),
        max_lines: layer?.max_lines ?? layer?.maxLines ?? 4,
        priority: layer?.priority ?? 2
      }));
    }
    const headline = pick(page, ["headline", "title"]);
    return text(headline) ? [{ type: "headline", text: headline, max_lines: 2, priority: 1 }] : layers;
  };
  const normalized = {
    schemaVersion: draft.schemaVersion ?? data.schemaVersion,
    contract: draft.contract ?? data.contract,
    deck_id: draft.deck_id ?? draft.deckId ?? deck?.deck_id ?? deck?.deckId ?? deck?.id,
    reading_arc: draft.reading_arc ?? draft.readingArc ?? deck?.reading_arc ?? deck?.readingArc,
    pages: pages.map((page) => ({
      objective: pick(page, ["objective", "page_objective", "content_objective", "goal"]),
      takeaway: pick(page, ["takeaway", "key_takeaway", "supporting_text", "supportingText"]),
      text_layers: layerValue(page),
      layout_hint: pick(page, ["layout_hint", "layoutHint", "visual_direction", "visualDirection"]),
      fact_ids: pick(page, ["fact_ids", "factIds"]) ?? [],
      interpretation_ids: pick(page, ["interpretation_ids", "interpretationIds"]) ?? [],
      knowledge_asset_ids: pick(page, ["knowledge_asset_ids", "knowledgeAssetIds"]) ?? []
    }))
  };
  const takeawayCounts = new Map();
  for (const page of normalized.pages) {
    const key = String(page.takeaway || "").trim();
    takeawayCounts.set(key, (takeawayCounts.get(key) || 0) + 1);
  }
  normalized.pages = normalized.pages.map((page, index) => {
    const takeaway = String(page.takeaway || "").trim();
    if ((takeawayCounts.get(takeaway) || 0) < 2) return page;
    const objective = String(page.objective || "").trim();
    return { ...page, takeaway: `${takeaway}${objective ? `｜${objective}` : `｜第${index + 1}页`}` };
  });
  return normalized;
}

function validateCarousel(capability, data, system) {
  // Section-only Creative Drafts are the authoritative Provider contract.
  // Check their cardinality before the legacy compatibility normalizer so a
  // short draft cannot be misreported as a historical deck.pages failure.
  if (Array.isArray(data?.section_drafts)
    && data.section_drafts.length !== system.confirmedOutlineSections.length) {
    fail(capability, ["$.data.section_drafts.length"]);
  }
  data = normalizeCarouselDraft(data);
  if (Array.isArray(data?.pages)) {
    data = {
      ...clone(data),
      pages: data.pages.map((page, index) => {
        const sectionId = system.confirmedOutlineSections[index]?.sectionId;
        const bodyClaimIds = new Set(system.postCopy?.bodySections?.find((item) => item.sectionId === sectionId)?.claimIds || []);
        return {
          ...page,
          fact_ids: normalizeAuthorizedReferenceList(page.fact_ids, system.authorizedFactIds, system.authorizedNonClaimOpinionIds).filter((id) => !system.authorizedFactIds.includes(id) || bodyClaimIds.has(id)),
          interpretation_ids: normalizeAuthorizedReferenceList(page.interpretation_ids, system.authorizedInterpretationIds, system.authorizedNonClaimOpinionIds).filter((id) => !system.authorizedInterpretationIds.includes(id) || bodyClaimIds.has(id)),
          knowledge_asset_ids: normalizeAuthorizedReferenceList(page.knowledge_asset_ids, system.authorizedKnowledgeAssetIds)
        };
      })
    };
  }
  const finalTitleBinding = system.finalTitleContext?.binding || null;
  const expectedCoverTitle = finalTitleBinding?.title || system.postCopy?.recommendedTitle;
  requireChecks(capability, [
    ["$.data", exact(data, ["schemaVersion", "contract", "deck_id", "reading_arc", "pages"])], ["$.data.schemaVersion", data?.schemaVersion === "1.0"], ["$.data.contract", data?.contract === CAPABILITIES[capability].outputContract],
    ["system.postCopy", system.postCopy?.contract === "XhsPostCopy@1.0" && sameAuthority(system.postCopy.authorityBinding, system.authorityBinding)],
    ["system.authorityBinding.designDnaRef", sameRef(system.designDnaRef, system.authorityBinding.designDnaRef)], ["system.designDnaVersion", text(system.designDnaVersion)],
    ["$.data.pages", Array.isArray(data?.pages)],
    ["$.data.pages.length", Array.isArray(data?.pages) && data.pages.length === system.confirmedOutlineSections.length],
    ["$.data.pages[]", Array.isArray(data?.pages) && data.pages.every((page) => exact(page, ["objective", "takeaway", "text_layers", "layout_hint", "fact_ids", "interpretation_ids", "knowledge_asset_ids"]))]
  ]);
  requireChecks(capability, [
    ["$.data.pages[].text_layers", data.pages.every((page) => Array.isArray(page.text_layers) && page.text_layers.every((layer) => exact(layer, ["type", "text", "max_lines", "priority"])))],
    ["$.data.pages[].fact_ids", data.pages.every((page) => strings(page.fact_ids))],
    ["$.data.pages[].interpretation_ids", data.pages.every((page) => strings(page.interpretation_ids))],
    ["$.data.pages[].knowledge_asset_ids", data.pages.every((page) => strings(page.knowledge_asset_ids))],
    ["$.data.pages[].takeaway", new Set(data.pages.map((page) => page.takeaway?.trim())).size === data.pages.length],
    ["$.data.pages[].text_layers[]", data.pages.every((page) => Array.isArray(page.text_layers))
      && new Set(data.pages.map((page) => JSON.stringify(page.text_layers.map((layer) => ({ type: layer.type, text: layer.text?.trim() }))))).size === data.pages.length]
  ]);
  requireChecks(capability, [
    ["$.data.pages[0].text_layers", data?.pages?.[0]?.text_layers?.some((layer) => layer.type === "headline" && layer.text === expectedCoverTitle)],
    ["$.data.fact_ids", (data?.pages || []).flatMap((item) => item.fact_ids || []).every((id) => system.authorizedFactIds?.includes(id))],
    ["$.data.interpretation_ids", (data?.pages || []).flatMap((item) => item.interpretation_ids || []).every((id) => system.authorizedInterpretationIds?.includes(id))],
    ["$.data.knowledge_asset_ids", (data?.pages || []).flatMap((item) => item.knowledge_asset_ids || []).every((id) => system.authorizedKnowledgeAssetIds?.includes(id))]
  ]);
  const compiledPages = data.pages.map((page, index) => ({
    page: index + 1, outlineSectionId: system.confirmedOutlineSections[index].sectionId, outlineRole: system.confirmedOutlineSections[index].outlineRole,
    role: ROLE[system.confirmedOutlineSections[index].outlineRole][1], objective: page.objective, takeaway: page.takeaway,
    textLayers: page.text_layers.map((layer) => ({ type: layer.type, text: layer.text, maxLines: layer.max_lines, priority: layer.priority })),
    layoutHint: page.layout_hint, factIds: clone(page.fact_ids), interpretationIds: clone(page.interpretation_ids), knowledgeAssetIds: clone(page.knowledge_asset_ids), mustAvoid: clone(system.pageMustAvoid?.[index] || [])
  }));
  if (text(expectedCoverTitle) && compiledPages[0]?.textLayers?.some((layer) => layer.type === "headline")) {
    compiledPages[0].textLayers = compiledPages[0].textLayers.map((layer) => layer.type === "headline" ? { ...layer, text: expectedCoverTitle } : layer);
  }
  const componentFields = { id: system.componentId, authorityBinding: clone(system.authorityBinding), postCopyRef: { id: system.postCopy.id, hash: system.postCopy.componentHash }, deckId: system.componentId, canvas: { width: 1080, height: 1440, ratio: "3:4" }, designDnaVersion: system.designDnaVersion, readingArc: data.reading_arc, pages: compiledPages };
  if (!finalTitleBinding) return createComponent(capability, () => createXhsCarouselPlan({ schemaVersion: "1.0", contract: CAPABILITIES[capability].componentContract, ...componentFields }));
  return createComponent(capability, () => createXhsCarouselPlanV2({ schemaVersion: "2.0", contract: "XhsCarouselPlan@2.0", finalTitleBindingRef: { id: finalTitleBinding.id, hash: finalTitleBinding.bindingHash }, ...componentFields }, { postCopy: system.postCopy, finalTitleBinding }));
}

function validateVisual(capability, data, system) {
  const authorized = new Map((system.authorizedReferenceAssets || []).map((item) => [item.id, item.hash]));
  if (object(data) && Array.isArray(data.imageSpecs)) {
    data = {
      ...clone(data),
      imageSpecs: data.imageSpecs.map((spec) => ({
        ...spec,
        referenceAssetIds: Array.isArray(spec?.referenceAssetIds)
          ? (authorized.size === 0 ? [] : normalizeAuthorizedReferenceList(spec.referenceAssetIds, [...authorized.keys()]))
          : spec?.referenceAssetIds
      }))
    };
  }
  requireChecks(capability, [
    ["$.data", exact(data, ["schemaVersion", "contract", "pageVisuals", "imageSpecs", "skippedPages", "pageAssetBindings"])], ["$.data.schemaVersion", data?.schemaVersion === "1.0"], ["$.data.contract", data?.contract === CAPABILITIES[capability].outputContract],
    ["system.carouselPlan", ["XhsCarouselPlan@1.0", "XhsCarouselPlan@2.0"].includes(system.carouselPlan?.contract) && sameAuthority(system.carouselPlan.authorityBinding, system.authorityBinding)],
    ["system.authorityBinding.designDnaRef", sameRef(system.designDnaRef, system.authorityBinding.designDnaRef)], ["system.designDnaVersion", system.designDnaVersion === system.carouselPlan?.designDnaVersion],
    ["system.pageTextTruth", Array.isArray(system.pageTextTruth) && system.pageTextTruth.length === system.carouselPlan?.pages?.length && system.pageTextTruth.every((item, index) => item.page === system.carouselPlan.pages[index].page && hashUnifiedContent(item.textLayers) === hashUnifiedContent(system.carouselPlan.pages[index].textLayers))],
    ["system.authorizedReferenceAssets", [...authorized.entries()].every(([id, hash]) => text(id) && HASH.test(hash))],
    ["$.data.pageVisuals", Array.isArray(data?.pageVisuals) && data.pageVisuals.length === system.carouselPlan?.pages?.length && data.pageVisuals.every((item, index) => exact(item, ["page", "visualFunction", "visualNeed", "renderStrategy", "mustKeep", "mustAvoid"]) && item.page === index + 1)],
    ["$.data.imageSpecs", Array.isArray(data?.imageSpecs) && data.imageSpecs.every((item) => exact(item, ["plannedAssetId", "page", "useCase", "assetType", "scene", "subject", "styleAndMedium", "composition", "lighting", "palette", "materials", "textSafeArea", "prompt", "negativePrompt", "referenceAssetIds", "size", "mustKeep", "mustAvoid", "textPolicy"]))],
    ["$.data.skippedPages", Array.isArray(data?.skippedPages) && data.skippedPages.every((item) => exact(item, ["page", "reason"]))],
    ["$.data.pageAssetBindings", Array.isArray(data?.pageAssetBindings) && data.pageAssetBindings.every((item) => exact(item, ["page", "plannedAssetIds"]))]
  ]);
  requireChecks(capability, [
    ["$.data.imageSpecs[].referenceAssetIds", data.imageSpecs.every((item) => strings(item.referenceAssetIds) && item.referenceAssetIds.every((id) => authorized.has(id)))],
    ["$.data.pageVisuals[].mustKeep", data.pageVisuals.every((item) => strings(item.mustKeep))],
    ["$.data.pageVisuals[].mustAvoid", data.pageVisuals.every((item) => strings(item.mustAvoid))],
    ["$.data.pageAssetBindings[].plannedAssetIds", data.pageAssetBindings.every((item) => strings(item.plannedAssetIds))]
  ]);
  return createComponent(capability, () => createXhsVisualAssetPlan({ schemaVersion: "1.0", contract: CAPABILITIES[capability].componentContract, id: system.componentId, authorityBinding: clone(system.authorityBinding), carouselPlanRef: { id: system.carouselPlan.id, hash: system.carouselPlan.componentHash }, designDnaVersion: system.designDnaVersion, pageVisuals: clone(data.pageVisuals), imageSpecs: data.imageSpecs.map((item) => ({ ...clone(item), designDnaVersion: system.designDnaVersion })), skippedPages: clone(data.skippedPages), authorizedReferenceAssets: [...authorized].map(([id, hash]) => ({ id, hash })), pageAssetBindings: clone(data.pageAssetBindings) }));
}

export function listXhsAtomicSkillCapabilities() { return structuredClone(CAPABILITIES); }

export function assembleXhsAtomicSkillOutput({ capability, envelope, systemContext }) {
  if (!Object.hasOwn(CAPABILITIES, capability)) fail(capability, ["capability"], "XHS_ATOMIC_SKILL_UNSUPPORTED");
  validateEnvelope(capability, envelope);
  validateInvocationContext(capability, systemContext);
  if (capability === "write-xhs-post-copy") return validatePost(capability, envelope.data, systemContext);
  if (capability === "plan-xhs-carousel") return validateCarousel(capability, envelope.data, systemContext);
  return validateVisual(capability, envelope.data, systemContext);
}

export async function runXhsAtomicSkill({
  capability,
  input,
  generateText,
  systemContext,
  task = null,
  onComponent = null,
  planStep = null,
  executionPlan = null,
  planAuthorization = "compatibility",
  maxAttempts = 1
}) {
  if (!Object.hasOwn(CAPABILITIES, capability)) fail(capability, ["capability"], "XHS_ATOMIC_SKILL_UNSUPPORTED");
  validateInvocationContext(capability, systemContext);
  let component = null;
  let validationError = null;
  let result;
  try {
    const canonicalGenerateText = capability === "write-xhs-post-copy"
      ? async (...args) => {
        const generated = await generateText(...args);
        return generated?.data == null ? generated : { ...generated, data: normalizePostReferenceSyntax(generated.data, systemContext) };
      }
      : generateText;
    result = await runContentSkill({ capability, platform: PLATFORM, input, generateText: canonicalGenerateText, fallback: null, task, expectedContract: CAPABILITIES[capability]?.outputContract, planStep, executionPlan, planAuthorization, maxAttempts, validateOutput(envelope) {
      try {
        component = assembleXhsAtomicSkillOutput({ capability, envelope, systemContext });
        return true;
      }
      catch (error) { validationError = error; throw error; }
    } });
  } catch (error) {
    if (validationError) {
      if (process.env.NODE_ENV !== "test") {
        const safePaths = (validationError?.details?.fieldPaths || []).filter((path) => typeof path === "string" && /^[A-Za-z0-9_$.[\]:-]{1,160}$/.test(path));
        if (safePaths.length) console.warn(`[FlowSocial] 小红书原子输出校验失败：${safePaths.join(",")}`);
      }
      throw validationError;
    }
    throw error;
  }
  if (typeof onComponent === "function") await onComponent(component, result);
  return { ...result, component };
}
