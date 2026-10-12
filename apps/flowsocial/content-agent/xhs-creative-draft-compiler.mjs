import { assembleXhsAtomicSkillOutput } from "./xhs-atomic-skill-runtime.mjs";

const FORBIDDEN_DRAFT_KEYS = new Set(["id", "hash", "authorityBinding", "authority_refs", "authorityRefs", "componentRefs", "component_refs", "componentHash", "component_hash", "canvas", "page", "page_number", "pageNumber", "outlineSectionId", "outline_section_id", "outlineRole", "outline_role", "role"]);
const CAROUSEL_DRAFT_KEYS = Object.freeze(["objective", "takeaway", "text_layers", "layout_hint", "fact_ids", "interpretation_ids", "knowledge_asset_ids"]);
const ROLE = Object.freeze({ hook: "scene", problem: "problem", diagnosis: "conclusion", evidence: "evidence", method: "method", example: "evidence", action: "summary", boundary: "warning" });

function fail(code, fieldPaths = []) {
  throw Object.assign(new Error("XHS Creative Draft compiler rejected input"), { code, statusCode: 409, details: { fieldPaths } });
}
function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function text(value) { return typeof value === "string" && Boolean(value.trim()); }
function clone(value) { return structuredClone(value); }
function exactKeys(value, keys) { return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }

function assertDraft(draft) {
  if (!exactKeys(draft, ["status", "data", "warnings", "blocked_reasons"]) || draft.status !== "success" || !object(draft.data)) fail("XHS_CREATIVE_DRAFT_ENVELOPE_INVALID", ["$"]);
  const forbidden = Object.keys(draft.data).filter((key) => FORBIDDEN_DRAFT_KEYS.has(key));
  if (forbidden.length) fail("XHS_CREATIVE_DRAFT_MACHINE_FIELDS_FORBIDDEN", forbidden.map((key) => `data.${key}`));
  if (!text(draft.data.contentPromise) || !Array.isArray(draft.data.bodySections) || !Array.isArray(draft.data.titleCandidates)) fail("XHS_CREATIVE_DRAFT_SHAPE_INVALID", ["data"]);
  return clone(draft.data);
}

function assertCarouselDraft(draft) {
  if (!exactKeys(draft, ["status", "data", "warnings", "blocked_reasons"]) || draft.status !== "success" || !object(draft.data)) fail("XHS_CREATIVE_DRAFT_ENVELOPE_INVALID", ["$"]);
  const data = draft.data;
  const forbidden = [];
  const check = (value, path) => {
    if (!object(value)) return;
    Object.keys(value).forEach((key) => { if (FORBIDDEN_DRAFT_KEYS.has(key)) forbidden.push(`${path}.${key}`); });
  };
  Object.keys(data).forEach((key) => { if (FORBIDDEN_DRAFT_KEYS.has(key)) forbidden.push(`data.${key}`); });
  const drafts = Array.isArray(data.section_drafts) ? data.section_drafts : null;
  if (forbidden.length) fail("XHS_CREATIVE_DRAFT_MACHINE_FIELDS_FORBIDDEN", forbidden);
  if (!drafts) fail("XHS_CREATIVE_DRAFT_SECTION_DRAFTS_REQUIRED", ["data.section_drafts"]);
  drafts.forEach((item, index) => {
    check(item, `data.section_drafts[${index}]`);
  });
  if (forbidden.length) fail("XHS_CREATIVE_DRAFT_MACHINE_FIELDS_FORBIDDEN", forbidden);
  drafts.forEach((item, index) => {
    if (!exactKeys(item, CAROUSEL_DRAFT_KEYS)) fail("XHS_CREATIVE_DRAFT_SECTION_SHAPE_INVALID", [`data.section_drafts[${index}]`]);
    if (!text(item.objective) || !text(item.takeaway) || !Array.isArray(item.text_layers) || !item.text_layers.length || !text(item.layout_hint)
      || !Array.isArray(item.fact_ids) || !Array.isArray(item.interpretation_ids) || !Array.isArray(item.knowledge_asset_ids)) {
      fail("XHS_CREATIVE_DRAFT_SECTION_SHAPE_INVALID", [`data.section_drafts[${index}]`]);
    }
  });
  return { ...clone(data), pages: clone(drafts) };
}

export function validateXhsCarouselCreativeDraft(draft) {
  return assertCarouselDraft(draft);
}

export function compileXhsCarouselCreativeDraft({ draft, confirmedOutline } = {}) {
  const data = assertCarouselDraft(draft);
  const sections = confirmedOutline?.sections;
  if (!Array.isArray(sections) || sections.length < 1) fail("XHS_CREATIVE_DRAFT_AUTHORITY_INPUT_REQUIRED", ["confirmedOutline.sections"]);
  if (data.pages.length !== sections.length) fail("XHS_CREATIVE_DRAFT_SECTION_COVERAGE_INVALID", ["data.section_drafts"]);
  return { status: "success", data, warnings: [], blocked_reasons: [], rawDraft: clone(draft) };
}

function compilePost({ draft, contentMaster, confirmedOutline, platformBrief, writerContext, mechanismDecision, promotionPolicy }) {
  const data = assertDraft(draft);
  if (!object(contentMaster) || !object(confirmedOutline) || !object(platformBrief) || !object(writerContext) || !object(mechanismDecision) || !object(promotionPolicy)) fail("XHS_CREATIVE_DRAFT_AUTHORITY_INPUT_REQUIRED", ["input"]);
  const sections = confirmedOutline.sections || [];
  if (data.bodySections.length !== sections.length) fail("XHS_CREATIVE_DRAFT_SECTION_COVERAGE_INVALID", ["data.bodySections"]);
  const authorizedFacts = new Set((contentMaster.confirmed_facts || []).map((item) => item.fact_id));
  const authorizedInterpretations = new Set((contentMaster.supported_interpretations || []).map((item) => item.interpretation_id || item.id));
  const authorizedKnowledge = new Set(writerContext.authorizedKnowledgeAssetIds || writerContext.authorized_knowledge_asset_ids || []);
  const bodySections = data.bodySections.map((item, index) => {
    const section = sections[index];
    if (!text(item.text) || item.sectionId !== section.sectionId || item.outlineRole !== section.outlineRole || item.role !== ROLE[item.outlineRole]) fail("XHS_CREATIVE_DRAFT_SECTION_MAPPING_INVALID", [`data.bodySections[${index}]`]);
    if (!item.claimIds.every((id) => authorizedFacts.has(id) || authorizedInterpretations.has(id)) || !item.knowledgeAssetIds.every((id) => authorizedKnowledge.has(id))) fail("XHS_CREATIVE_DRAFT_AUTHORIZED_IDS_INVALID", [`data.bodySections[${index}]`]);
    return item;
  });
  if (!data.titleCandidates.some((item) => item.title === data.recommendedTitle)) fail("XHS_CREATIVE_DRAFT_TITLE_BINDING_INVALID", ["data.recommendedTitle"]);
  const envelope = { status: "success", data: { ...data, bodySections }, warnings: [], blocked_reasons: [] };
  const systemContext = {
    componentId: `xhs-draft:${confirmedOutline.outline_id || confirmedOutline.id}`,
    authorityBinding: clone(writerContext.authority_refs || {}), confirmedOutlineRef: { id: confirmedOutline.outline_id || confirmedOutline.id, hash: "0".repeat(64) },
    confirmedOutlineSections: sections.map((item) => ({ sectionId: item.sectionId, outlineRole: item.outlineRole })),
    contentMasterRef: writerContext.authority_refs?.sharedContentMasterRef, platformBriefRef: writerContext.authority_refs?.platformBriefRef,
    writerContextRef: writerContext.authority_refs?.writerContextRef, mechanismDecisionRef: writerContext.authority_refs?.mechanismDecisionRef,
    authorizedFactIds: [...authorizedFacts], authorizedInterpretationIds: [...authorizedInterpretations], authorizedKnowledgeAssetIds: [...authorizedKnowledge]
  };
  return assembleXhsAtomicSkillOutput({ capability: "write-xhs-post-copy", envelope, systemContext });
}

export function compileXhsCreativeDraft(input) {
  if (!object(input) || !["write-xhs-post-copy", "plan-xhs-carousel"].includes(input.capability)) fail("XHS_CREATIVE_DRAFT_CAPABILITY_INVALID", ["capability"]);
  if (input.capability === "plan-xhs-carousel") {
    if (!object(input.draft?.data) || !Array.isArray(input.draft.data.section_drafts)) fail("XHS_CREATIVE_DRAFT_CAPABILITY_INVALID", ["capability"]);
    return compileXhsCarouselCreativeDraft(input);
  }
  return compilePost(input);
}

export function listXhsCreativeDraftForbiddenKeys() { return [...FORBIDDEN_DRAFT_KEYS]; }
