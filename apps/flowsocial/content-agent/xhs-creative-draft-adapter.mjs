import { compileXhsCreativeDraft } from "./xhs-creative-draft-compiler.mjs";

const object = (v) => Boolean(v && typeof v === "object" && !Array.isArray(v));
const clone = (v) => structuredClone(v);
function fail(code, fieldPaths = []) { throw Object.assign(new Error("XHS generic content adapter rejected input"), { code, statusCode: 409, details: { fieldPaths } }); }

// Convert the legacy write-xhs-content package into the provider-owned draft
// envelope. No prose or identifiers are synthesized; section roles come only
// from the confirmed outline at the same deterministic index.
export function adaptXhsContentToCreativeDraft(input = {}) {
  if (!object(input) || input.capability !== "write-xhs-content") fail("XHS_CREATIVE_DRAFT_ADAPTER_CAPABILITY_INVALID", ["capability"]);
  const envelope = input.runtimeOutput || input.output || input.result;
  const data = envelope?.data;
  if (!object(envelope) || envelope.status !== "success" || !object(data)) fail("XHS_CREATIVE_DRAFT_ADAPTER_OUTPUT_INVALID", ["output"]);
  if (data.platform && data.platform !== "xiaohongshu") fail("XHS_CREATIVE_DRAFT_ADAPTER_PLATFORM_INVALID", ["output.data.platform"]);
  const copy = data.post_copy || data.postCopy;
  if (!object(copy)) fail("XHS_CREATIVE_DRAFT_ADAPTER_POST_COPY_REQUIRED", ["output.data.post_copy"]);
  const outline = input.confirmedOutline;
  if (!object(outline) || !Array.isArray(outline.sections)) fail("XHS_CREATIVE_DRAFT_ADAPTER_OUTLINE_REQUIRED", ["confirmedOutline"]);
  if (!Array.isArray(copy.body_sections) || copy.body_sections.length !== outline.sections.length) fail("XHS_CREATIVE_DRAFT_ADAPTER_SECTION_COVERAGE_INVALID", ["output.data.post_copy.body_sections"]);
  const bodySections = copy.body_sections.map((section, index) => {
    if (!object(section) || typeof section.text !== "string" || !section.text.trim()) fail("XHS_CREATIVE_DRAFT_ADAPTER_SECTION_INVALID", [`output.data.post_copy.body_sections[${index}]`]);
    const target = outline.sections[index];
    return { sectionId: target.sectionId || target.section_id, outlineRole: target.outlineRole || target.role, role: section.role, text: section.text, claimIds: clone(section.claim_ids || section.claimIds || []), knowledgeAssetIds: clone(section.knowledge_asset_ids || section.knowledgeAssetIds || []) };
  });
  return { capability: "write-xhs-post-copy", draft: { status: "success", warnings: [], blocked_reasons: [], data: {
    schemaVersion: "1.0", contract: "XhsPostCopyCreativeOutput@1.0", contentPromise: data.content_promise || data.contentPromise,
    engagementStrategy: clone(data.engagement_strategy || data.engagementStrategy), titleCandidates: clone(copy.title_candidates || copy.titleCandidates || []), recommendedTitle: copy.recommended_title || copy.recommendedTitle,
    opening: copy.opening, bodySections, ending: copy.ending, pinnedComment: copy.pinned_comment || copy.pinnedComment || "", hashtags: clone(copy.hashtags || []), cta: copy.cta || "", promotionUse: clone(data.promotion_use || data.promotionUse || { mode: "none", itemIds: [], disclosure: "" })
  } }, contentMaster: input.contentMaster, confirmedOutline: clone(outline), platformBrief: input.platformBrief, writerContext: input.writerContext, mechanismDecision: input.mechanismDecision, promotionPolicy: input.promotionPolicy };
}

export function compileXhsCreativeDraftFromGeneric(input = {}) { return compileXhsCreativeDraft(adaptXhsContentToCreativeDraft(input)); }
