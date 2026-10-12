import { hashUnifiedContent } from "../../../content-agent/unified-content-contracts.mjs";

const ROOT_KEYS = ["status", "data", "warnings", "blocked_reasons"];
const DATA_KEYS = ["schemaVersion", "contract", "deck_id", "canvas", "reading_arc", "pages"];
const CANVAS_KEYS = ["width", "height", "ratio"];
const PAGE_KEYS = ["page", "outline_section_id", "outline_role", "role", "objective", "takeaway", "text_layers", "layout_hint", "fact_ids", "interpretation_ids", "knowledge_asset_ids"];
const LAYER_KEYS = ["type", "text", "max_lines", "priority"];
const ROLE_MAP = Object.freeze({ hook: "cover", problem: "problem", diagnosis: "conclusion", evidence: "evidence", method: "method", example: "case", action: "cta", boundary: "warning" });

function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function exact(value, keys) { return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function text(value) { return typeof value === "string" && Boolean(value.trim()); }
function strings(value) { return Array.isArray(value) && value.every(text) && new Set(value).size === value.length; }
function normalized(value) { return value.trim().replace(/\s+/g, " ").toLowerCase(); }
function hasInternalPresentationMarker(value) { return /^(?:HOOK|JUDGE|ACTION|METHOD\s*\d+\s*\/\s*\d+)\s*[·:：\-]/i.test(String(value || "").trim()); }
function validComponentHash(value, field) {
  if (!object(value) || !/^[a-f0-9]{64}$/.test(value[field] || "")) return false;
  const copy = structuredClone(value);
  delete copy[field];
  return hashUnifiedContent(copy) === value[field];
}

function fail(paths) {
  throw Object.assign(new Error("XHS carousel creative output is invalid"), {
    code: "XHS_CAROUSEL_PLAN_CREATIVE_OUTPUT_INVALID",
    details: { fieldPaths: [...new Set(paths)] },
  });
}

function notReady(status) {
  throw Object.assign(new Error("XHS carousel creative output is not assembly-ready"), {
    code: "XHS_CAROUSEL_PLAN_CREATIVE_OUTPUT_NOT_READY",
    status,
    assemblyEligible: false,
    details: { fieldPaths: ["$.status"] },
  });
}

function collectContentMasterAuthorities(contentMaster) {
  return {
    facts: new Set((contentMaster?.confirmed_facts || []).map((item) => item?.fact_id).filter(text)),
    interpretations: new Set((contentMaster?.supported_interpretations || []).map((item) => item?.interpretation_id).filter(text)),
    knowledge: new Set((contentMaster?.knowledge_contract?.allowed_assets || []).map((item) => item?.asset_id || item?.id).filter(text)),
  };
}

export function validateXhsCarouselPlanCreativeOutput(value, { confirmedOutline, contentMaster, postCopy, finalTitleBinding, platformBrief, designDnaRef, designDna } = {}) {
  const paths = [];
  if (!object(postCopy) || postCopy.contract !== "XhsPostCopy@1.0") paths.push("input.post_copy");
  if (!object(confirmedOutline) || !text(confirmedOutline.outline_id)) paths.push("input.confirmed_outline");
  if (!object(contentMaster)) paths.push("input.content_master");
  if (!object(platformBrief)) paths.push("input.platform_brief");
  if (!exact(designDnaRef, ["id", "hash"]) || !text(designDnaRef.id) || !/^[a-f0-9]{64}$/.test(designDnaRef.hash)) paths.push("input.design_dna_ref");
  if (!object(designDna)) paths.push("input.design_dna");
  const hasFinalTitleBinding = finalTitleBinding !== undefined;
  if (hasFinalTitleBinding) {
    if (!object(finalTitleBinding) || finalTitleBinding.contract !== "XhsFinalTitleBinding@1.0" || !validComponentHash(finalTitleBinding, "bindingHash")) paths.push("input.final_title_binding");
    if (finalTitleBinding?.postCopyRef?.id !== postCopy?.id || finalTitleBinding?.postCopyRef?.hash !== postCopy?.componentHash) paths.push("input.final_title_binding.postCopyRef");
    if (!text(finalTitleBinding?.title)) paths.push("input.final_title_binding.title");
  }
  if (!exact(value, ROOT_KEYS)) paths.push("$");
  if (!["success", "needs_review", "blocked"].includes(value?.status)) paths.push("$.status");
  if (!strings(value?.warnings)) paths.push("$.warnings");
  if (!strings(value?.blocked_reasons)) paths.push("$.blocked_reasons");
  if (paths.length) fail(paths);
  if (value.status !== "success") {
    const nonSuccessPaths = [];
    if (value.data !== null) nonSuccessPaths.push("$.data");
    if (value.blocked_reasons.length === 0) nonSuccessPaths.push("$.blocked_reasons");
    if (nonSuccessPaths.length) fail(nonSuccessPaths);
    notReady(value.status);
  }
  if (value.warnings.length !== 0) paths.push("$.warnings");
  if (value.blocked_reasons.length !== 0) paths.push("$.blocked_reasons");
  const data = value?.data;
  if (!exact(data, DATA_KEYS)) paths.push("$.data");
  if (data?.schemaVersion !== "1.0") paths.push("$.data.schemaVersion");
  if (data?.contract !== "XhsCarouselPlanCreativeOutput@1.0") paths.push("$.data.contract");
  if (!text(data?.deck_id)) paths.push("$.data.deck_id");
  if (!exact(data?.canvas, CANVAS_KEYS) || data.canvas.width !== 1080 || data.canvas.height !== 1440 || data.canvas.ratio !== "3:4") paths.push("$.data.canvas");
  if (!text(data?.reading_arc)) paths.push("$.data.reading_arc");
  const pages = data?.pages;
  if (!Array.isArray(pages) || pages.length < 6 || pages.length > 10) paths.push("$.data.pages");
  const sections = Array.isArray(confirmedOutline?.sections) ? confirmedOutline.sections : null;
  if (!sections || !Array.isArray(pages) || sections.length !== pages.length) paths.push("input.confirmed_outline.sections");
  const authorities = collectContentMasterAuthorities(contentMaster);
  const sectionIds = [];
  const takeaways = [];
  const pageTexts = [];
  if (Array.isArray(pages)) pages.forEach((page, index) => {
    const base = `$.data.pages[${index}]`;
    if (!exact(page, PAGE_KEYS)) paths.push(base);
    if (page?.page !== index + 1) paths.push(`${base}.page`);
    if (!text(page?.outline_section_id)) paths.push(`${base}.outline_section_id`); else sectionIds.push(page.outline_section_id);
    const section = sections?.[index];
    if (!section || page?.outline_section_id !== section.section_id) paths.push(`${base}.outline_section_id`);
    if (!section || page?.outline_role !== section.role) paths.push(`${base}.outline_role`);
    if (!Object.hasOwn(ROLE_MAP, page?.outline_role) || page?.role !== ROLE_MAP[page.outline_role]) paths.push(`${base}.role`);
    if (!text(page?.objective)) paths.push(`${base}.objective`);
    if (!text(page?.takeaway)) paths.push(`${base}.takeaway`); else takeaways.push(normalized(page.takeaway));
    if (!text(page?.layout_hint)) paths.push(`${base}.layout_hint`);
    if (!Array.isArray(page?.text_layers) || page.text_layers.length < 1 || page.text_layers.length > 4) paths.push(`${base}.text_layers`);
    if (Array.isArray(page?.text_layers)) {
      page.text_layers.forEach((layer, layerIndex) => {
        const layerBase = `${base}.text_layers[${layerIndex}]`;
        if (!exact(layer, LAYER_KEYS)) paths.push(layerBase);
        if (!["headline", "body", "label", "footer"].includes(layer?.type)) paths.push(`${layerBase}.type`);
        if (!text(layer?.text)) paths.push(`${layerBase}.text`);
        if (hasInternalPresentationMarker(layer?.text)) paths.push(`${layerBase}.text`);
        if (!Number.isInteger(layer?.max_lines) || layer.max_lines < 1) paths.push(`${layerBase}.max_lines`);
        if (!Number.isInteger(layer?.priority) || layer.priority < 1) paths.push(`${layerBase}.priority`);
      });
      pageTexts.push(normalized(page.text_layers.map((layer) => layer?.text || "").join(" ")));
    }
    for (const [key, allowed] of [["fact_ids", authorities.facts], ["interpretation_ids", authorities.interpretations], ["knowledge_asset_ids", authorities.knowledge]]) {
      if (!strings(page?.[key])) paths.push(`${base}.${key}`);
      else if (page[key].some((id) => !allowed.has(id))) paths.push(`${base}.${key}[]`);
    }
  });
  if (sectionIds.length !== new Set(sectionIds).size) paths.push("$.data.pages[].outline_section_id");
  if (takeaways.length !== new Set(takeaways).size) paths.push("$.data.pages[].takeaway");
  if (pageTexts.length !== new Set(pageTexts).size) paths.push("$.data.pages[].text_layers");
  const coverHeadline = pages?.[0]?.text_layers?.find((layer) => layer?.type === "headline")?.text;
  const canonicalTitle = hasFinalTitleBinding ? finalTitleBinding?.title : postCopy?.recommendedTitle;
  if (!text(canonicalTitle) || coverHeadline !== canonicalTitle) paths.push("$.data.pages[0].text_layers");
  if (paths.length) fail(paths);
  return value;
}

export { ROLE_MAP as XHS_CAROUSEL_OUTLINE_ROLE_MAP };
