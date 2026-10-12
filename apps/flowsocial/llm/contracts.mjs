const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && Boolean(value.trim());
const isNonEmptyStringArray = (value) => Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
const hasExactKeys = (value, keys) => isObject(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const isStringArray = (value) => Array.isArray(value) && value.every(isNonEmptyString)
  && new Set(value).size === value.length;

const DEFAULT_PROVIDER_ENVELOPE_KEYS = Object.freeze(["status", "data", "warnings", "blocked_reasons"]);
function structuralValidation() {
  const errors = [];
  const validationFieldPaths = [];
  return {
    add(message, path) { errors.push(message); validationFieldPaths.push(path); },
    result() { return { errors, validationFieldPaths: [...new Set(validationFieldPaths)] }; }
  };
}
function validateProviderEnvelope(value, { successStatuses = ["success"], allowedStatuses = [...successStatuses, "needs_review", "blocked"] } = {}) {
  const validation = structuralValidation();
  validation.addIf = (condition, message, path) => { if (condition) validation.add(message, path); };
  validation.addIf(!hasExactKeys(value, DEFAULT_PROVIDER_ENVELOPE_KEYS), "$ must contain exact Provider envelope keys", "$");
  validation.addIf(!isObject(value) || !allowedStatuses.includes(value.status), "status is invalid", "$.status");
  validation.addIf(!Array.isArray(value?.warnings) || value.warnings.some((item) => typeof item !== "string"), "warnings must be a string array", "$.warnings");
  validation.addIf(!Array.isArray(value?.blocked_reasons) || value.blocked_reasons.some((item) => typeof item !== "string"), "blocked_reasons must be a string array", "$.blocked_reasons");
  const success = successStatuses.includes(value?.status);
  validation.addIf(success && !isObject(value?.data), "data must be an object for success", "$.data");
  validation.addIf(success && (value?.warnings?.length || value?.blocked_reasons?.length), "success must have empty warnings and blocked_reasons", "$.status");
  validation.addIf(!success && value?.data !== null, "data must be null for non-success", "$.data");
  validation.addIf(!success && (!Array.isArray(value?.blocked_reasons) || value.blocked_reasons.length === 0), "blocked_reasons must be non-empty for non-success", "$.blocked_reasons");
  return { validation, success };
}
function exactObject(validation, value, keys, path) {
  if (!hasExactKeys(value, keys)) validation.add(`${path} must contain exact keys`, path);
}
function arrayOfExact(validation, value, keys, path) {
  if (!Array.isArray(value)) { validation.add(`${path} must be an array`, path); return; }
  value.forEach((item, index) => exactObject(validation, item, keys, `${path}[${index}]`));
}

const POST_KEYS = ["schemaVersion", "contract", "contentPromise", "engagementStrategy", "titleCandidates", "recommendedTitle", "opening", "bodySections", "ending", "pinnedComment", "hashtags", "cta", "promotionUse"];
function validateXhsPostCreativeEnvelope(value) {
  const { validation, success } = validateProviderEnvelope(value);
  if (!success || !isObject(value?.data)) return validation.result();
  exactObject(validation, value.data, POST_KEYS, "$.data");
  exactObject(validation, value.data.engagementStrategy, ["mode", "primaryAction", "reason", "ctaPlacement", "ctaText"], "$.data.engagementStrategy");
  arrayOfExact(validation, value.data.titleCandidates, ["title", "hookType", "claimIds", "risk"], "$.data.titleCandidates");
  arrayOfExact(validation, value.data.bodySections, ["sectionId", "outlineRole", "role", "text", "claimIds", "knowledgeAssetIds"], "$.data.bodySections");
  exactObject(validation, value.data.promotionUse, ["mode", "itemIds", "disclosure"], "$.data.promotionUse");
  return validation.result();
}

function validatePlatformTitlesEnvelope(value) {
  const { validation, success } = validateProviderEnvelope(value, { allowedStatuses: ["success", "failed", "needs_review"] });
  if (!success || !isObject(value?.data)) return validation.result();
  exactObject(validation, value.data, ["stage", "platform", "title_brief", "candidates", "recommendations", "ab_tests", "same_account_signal_usage"], "$.data");
  exactObject(validation, value.data.title_brief, ["content_type", "target_reader", "core_conclusion", "reader_takeaway", "strongest_evidence", "real_entities", "freshness_dependency"], "$.data.title_brief");
  arrayOfExact(validation, value.data.candidates, ["title_id", "title", "motivation", "method", "claim_ids", "scores", "risk", "risk_reasons"], "$.data.candidates");
  for (const [index, item] of (Array.isArray(value.data.candidates) ? value.data.candidates : []).entries()) exactObject(validation, item.scores, ["fulfillment", "relevance", "specificity", "curiosity", "clarity", "uniqueness", "overall"], `$.data.candidates[${index}].scores`);
  exactObject(validation, value.data.recommendations, ["balanced", "safe", "spread", "search", "experiment"], "$.data.recommendations");
  arrayOfExact(validation, value.data.ab_tests, ["title_a", "title_b", "single_variable", "hypothesis"], "$.data.ab_tests");
  exactObject(validation, value.data.same_account_signal_usage, ["used", "signal_ids", "interpretation"], "$.data.same_account_signal_usage");
  return validation.result();
}

function validateXhsVisualEnvelope(value) {
  const { validation, success } = validateProviderEnvelope(value);
  if (!success || !isObject(value?.data)) return validation.result();
  exactObject(validation, value.data, ["schemaVersion", "contract", "pageVisuals", "imageSpecs", "skippedPages", "pageAssetBindings"], "$.data");
  arrayOfExact(validation, value.data.pageVisuals, ["page", "visualFunction", "visualNeed", "renderStrategy", "mustKeep", "mustAvoid"], "$.data.pageVisuals");
  arrayOfExact(validation, value.data.imageSpecs, ["plannedAssetId", "page", "useCase", "assetType", "scene", "subject", "styleAndMedium", "composition", "lighting", "palette", "materials", "textSafeArea", "prompt", "negativePrompt", "referenceAssetIds", "size", "mustKeep", "mustAvoid", "textPolicy"], "$.data.imageSpecs");
  arrayOfExact(validation, value.data.skippedPages, ["page", "reason"], "$.data.skippedPages");
  arrayOfExact(validation, value.data.pageAssetBindings, ["page", "plannedAssetIds"], "$.data.pageAssetBindings");
  return validation.result();
}

function validateWechatReviewEnvelope(value) {
  const { validation, success } = validateProviderEnvelope(value, { allowedStatuses: ["success", "failed", "needs_review"] });
  if (!success || !isObject(value?.data)) return validation.result();
  exactObject(validation, value.data, ["decision", "findings", "patches", "changes", "fact_recheck_required", "publish_time_checks"], "$.data");
  arrayOfExact(validation, value.data.findings, ["finding_id", "category", "location", "severity", "issue", "required_action", "claim_ids"], "$.data.findings");
  arrayOfExact(validation, value.data.patches, ["target", "before", "after", "reason"], "$.data.patches");
  return validation.result();
}

function validateWechatImageEnvelope(value) {
  const { validation, success } = validateProviderEnvelope(value, { allowedStatuses: ["success", "partial", "needs_review", "blocked"] });
  if (!success || !isObject(value?.data)) return validation.result();
  exactObject(validation, value.data, ["plan_id", "cover", "slots"], "$.data");
  exactObject(validation, value.data.cover, ["purpose", "strategy", "asset_id", "claim_ids", "image_spec"], "$.data.cover");
  arrayOfExact(validation, value.data.slots, ["slot_id", "after_section_id", "purpose", "strategy", "claim_ids", "asset_id", "image_spec"], "$.data.slots");
  if (value.data.cover?.strategy === "no_image") {
    validation.add("data.cover must be an illustrated cover", "$.data.cover.strategy");
  }
  if (!Array.isArray(value.data.slots) || !value.data.slots.some((item) => item?.strategy !== "no_image")) {
    validation.add("data.slots must contain at least one illustrated body slot", "$.data.slots");
  }
  return validation.result();
}

const XHS_CAROUSEL_ENVELOPE_KEYS = Object.freeze(["status", "data", "warnings", "blocked_reasons"]);
const XHS_CAROUSEL_DATA_KEYS = Object.freeze(["schemaVersion", "contract", "reading_arc", "section_drafts"]);
const XHS_CAROUSEL_PAGE_KEYS = Object.freeze([
  "objective", "takeaway", "text_layers", "layout_hint",
  "fact_ids", "interpretation_ids", "knowledge_asset_ids"
]);
const XHS_CAROUSEL_LAYER_KEYS = Object.freeze(["type", "text", "max_lines", "priority"]);

function validateXhsCarouselCreativeEnvelope(value) {
  const errors = [];
  const validationFieldPaths = [];
  const add = (message, path) => { errors.push(message); validationFieldPaths.push(path); };
  if (!hasExactKeys(value, XHS_CAROUSEL_ENVELOPE_KEYS)) add("$ must contain exact carousel envelope keys", "$");
  if (!isObject(value) || !["success", "needs_review", "blocked"].includes(value.status)) add("status is invalid", "$.status");
  if (!Array.isArray(value?.warnings) || value.warnings.some((item) => typeof item !== "string" || !item.trim())) add("warnings must be a string array", "$.warnings");
  if (!Array.isArray(value?.blocked_reasons) || value.blocked_reasons.some((item) => typeof item !== "string" || !item.trim())) add("blocked_reasons must be a string array", "$.blocked_reasons");
  if (value?.status !== "success") {
    if (value?.data !== null) add("data must be null for non-success", "$.data");
    if (!Array.isArray(value?.blocked_reasons) || value.blocked_reasons.length === 0) add("blocked_reasons must be non-empty for non-success", "$.blocked_reasons");
    if (value?.status === "needs_review" && (!Array.isArray(value?.warnings) || value.warnings.length === 0)) add("warnings must be non-empty for needs_review", "$.warnings");
    return { errors, validationFieldPaths };
  }
  if (!isObject(value.data)) { add("data must be an object for success", "$.data"); return { errors, validationFieldPaths }; }
  if (!hasExactKeys(value.data, XHS_CAROUSEL_DATA_KEYS)) add("data must contain exact carousel keys", "$.data");
  if (value.data.schemaVersion !== "1.0") add("data.schemaVersion must equal 1.0", "$.data.schemaVersion");
  if (value.data.contract !== "XhsCarouselPlanCreativeOutput@1.0") add("data.contract is invalid", "$.data.contract");
  if (!Array.isArray(value.warnings) || value.warnings.length !== 0) add("warnings must be empty for success", "$.warnings");
  if (!Array.isArray(value.blocked_reasons) || value.blocked_reasons.length !== 0) add("blocked_reasons must be empty for success", "$.blocked_reasons");
  if (!Array.isArray(value.data.section_drafts)) { add("data.section_drafts must be an array", "$.data.section_drafts"); return { errors, validationFieldPaths }; }
  for (const [index, page] of value.data.section_drafts.entries()) {
    if (!hasExactKeys(page, XHS_CAROUSEL_PAGE_KEYS)) add(`data.section_drafts[${index}] must contain exact creative keys`, `$.data.section_drafts[${index}]`);
    if (!Array.isArray(page?.text_layers)) add(`data.section_drafts[${index}].text_layers must be an array`, `$.data.section_drafts[${index}].text_layers`);
    else for (const [layerIndex, layer] of page.text_layers.entries()) {
      if (!hasExactKeys(layer, XHS_CAROUSEL_LAYER_KEYS)) add(`data.section_drafts[${index}].text_layers[${layerIndex}] must contain exact layer keys`, `$.data.section_drafts[${index}].text_layers[${layerIndex}]`);
    }
    for (const key of ["fact_ids", "interpretation_ids", "knowledge_asset_ids"]) {
      if (!isStringArray(page?.[key])) add(`data.section_drafts[${index}].${key} must be a unique string array`, `$.data.section_drafts[${index}].${key}`);
    }
  }
  return { errors, validationFieldPaths: [...new Set(validationFieldPaths)] };
}

// Gateway-facing validator: Provider may own only the section creative fields.
// Mechanical Runtime fields are rejected before invocation, while the canonical
// output validator remains responsible for the full envelope contract.
export function validateXhsCarouselCreativeDraftGateway(value) {
  const validation = validateXhsCarouselCreativeEnvelope(value);
  const forbidden = ["page", "page_number", "outline_section_id", "outline_role", "role", "canvas", "asset_ids", "image_specs", "traceability", "preflight_checks"];
  for (const [index, page] of (Array.isArray(value?.data?.section_drafts) ? value.data.section_drafts : []).entries()) {
    for (const key of forbidden) if (Object.hasOwn(page || {}, key)) {
      validation.errors.push(`data.section_drafts[${index}].${key} is Runtime-owned`);
      validation.validationFieldPaths.push(`$.data.section_drafts[${index}].${key}`);
    }
  }
  return { ...validation, validationFieldPaths: [...new Set(validation.validationFieldPaths)] };
}

const WECHAT_ARTICLE_KEYS = Object.freeze([
  "article_markdown", "title_candidates", "outline", "information_gain", "image_plan"
]);
const WECHAT_RECOVERY_BINDING_KEYS = Object.freeze([
  "contentRunId", "strategySnapshotId", "confirmedOutlineId", "inputSummaryHash"
]);
const WECHAT_WRAPPER_PATHS = Object.freeze([
  Object.freeze([]),
  Object.freeze(["data"]),
  Object.freeze(["article"]),
  Object.freeze(["draft"]),
  Object.freeze(["wechat_article"]),
  Object.freeze(["文章"]),
  Object.freeze(["result"]),
  Object.freeze(["result", "data"]),
  Object.freeze(["response"]),
  Object.freeze(["response", "data"]),
  Object.freeze(["output"]),
  Object.freeze(["output", "data"])
]);

function valueAtPath(value, path) {
  let current = value;
  for (const segment of path) {
    if (!isObject(current) || !Object.hasOwn(current, segment)) return null;
    current = current[segment];
  }
  return current;
}

function normalizeWechatArticleObject(value) {
  if (!isObject(value)) return value;
  const aliases = {
    articleMarkdown: "article_markdown",
    titleCandidates: "title_candidates",
    informationGain: "information_gain",
    imagePlan: "image_plan",
    "正文": "article_markdown",
    "文章正文": "article_markdown",
    "标题候选": "title_candidates",
    "备选标题": "title_candidates",
    "大纲": "outline",
    "文章大纲": "outline",
    "信息增益": "information_gain",
    "配图计划": "image_plan"
  };
  const normalized = { ...value };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!Object.hasOwn(normalized, canonical) && Object.hasOwn(normalized, alias)) normalized[canonical] = normalized[alias];
    if (Object.hasOwn(normalized, alias)) delete normalized[alias];
  }
  return normalized;
}

function isWechatArticleObject(value) {
  const normalized = normalizeWechatArticleObject(value);
  return isObject(normalized) && WECHAT_ARTICLE_KEYS.some((key) => Object.hasOwn(normalized, key));
}

export function adaptWechatArticleCandidate(value) {
  if (!isObject(value)) return { adapted: false, value, article: null, wrapperPath: null };
  let normalizedValue = value;
  let normalizedSuccessEnvelope = false;
  if (value.status === "success" && isObject(value.data)
    && (!Object.hasOwn(value, "warnings") || !Object.hasOwn(value, "blocked_reasons"))) {
    normalizedValue = {
      ...value,
      warnings: Array.isArray(value.warnings) ? value.warnings : [],
      blocked_reasons: Array.isArray(value.blocked_reasons) ? value.blocked_reasons : []
    };
    normalizedSuccessEnvelope = true;
  }
  for (const path of WECHAT_WRAPPER_PATHS) {
    const rawCandidate = valueAtPath(normalizedValue, path);
    const candidate = normalizeWechatArticleObject(rawCandidate);
    if (!isWechatArticleObject(candidate)) continue;
    const wrapperPath = path.length ? path.join(".") : "direct";
    const canonicalEnvelope = wrapperPath === "data"
      ? { ...normalizedValue, data: candidate }
      : { status: "success", data: candidate, warnings: [], blocked_reasons: [] };
    const adaptedValue = wrapperPath === "data" ? canonicalEnvelope : canonicalEnvelope;
    return { adapted: true, value: adaptedValue, article: candidate, wrapperPath: normalizedSuccessEnvelope ? "partial_success_envelope" : wrapperPath };
  }
  return { adapted: false, value, article: null, wrapperPath: null };
}

const PLATFORM_TITLE_DATA_KEYS = Object.freeze([
  "stage", "platform", "title_brief", "candidates", "recommendations", "ab_tests", "same_account_signal_usage"
]);

export function adaptPlatformTitleCandidate(value) {
  if (!isObject(value)) return { adapted: false, value, wrapperPath: "direct" };
  const keys = Object.keys(value);
  const bareData = keys.length === PLATFORM_TITLE_DATA_KEYS.length
    && PLATFORM_TITLE_DATA_KEYS.every((key) => Object.hasOwn(value, key));
  if (!bareData) return { adapted: false, value, wrapperPath: "direct" };
  return {
    adapted: true,
    value: { status: "success", data: value, warnings: [], blocked_reasons: [] },
    wrapperPath: "bare_title_data"
  };
}

const BARE_SKILL_DATA_KEYS = Object.freeze({
  "XhsPostCopyCreativeOutput@1.0": POST_KEYS,
  "PlatformTitleList@1.0": PLATFORM_TITLE_DATA_KEYS,
  "XhsCarouselPlanCreativeOutput@1.0": ["schemaVersion", "contract", "reading_arc", "section_drafts"],
  "XhsVisualAssetPlanCreativeOutput@1.0": ["schemaVersion", "contract", "pageVisuals", "imageSpecs", "skippedPages", "pageAssetBindings"]
  ,"WechatArticleReview@1.0": ["decision", "findings", "patches", "changes", "fact_recheck_required", "publish_time_checks"]
  ,"WechatImagePlan@1.0": ["plan_id", "cover", "slots"]
});

export function adaptCanonicalSkillEnvelope(contract, value) {
  if (contract === "ContentOutline@1.0" && isObject(value)) {
    const hasSections = (candidate) => isObject(candidate) && Array.isArray(candidate.sections);
    const wrapperKeys = ["data", "outline", "content_outline", "contentOutline", "result", "response", "output"];
    let source = value;
    let wrapperPath = "direct";
    for (const key of wrapperKeys) {
      if (hasSections(value[key])) {
        source = value[key];
        wrapperPath = `nested_outline_${key}`;
        break;
      }
    }
    if (hasSections(source)) {
      const data = { ...source };
      const aliases = {
        outlineId: "outline_id", schemaVersion: "schema_version", contentPromise: "content_promise",
        contentPurposeId: "content_purpose_id", conversionStageId: "conversion_stage_id", openingStrategy: "opening_strategy",
        closingStrategy: "closing_strategy", contentFunction: "content_function", unresolvedQuestions: "unresolved_questions",
        confirmationRequired: "confirmation_required", keyPoints: "key_points", claimIds: "claim_ids", sectionId: "section_id"
      };
      for (const [alias, canonical] of Object.entries(aliases)) {
        if (!Object.hasOwn(data, canonical) && Object.hasOwn(data, alias)) data[canonical] = data[alias];
        if (Object.hasOwn(data, alias) && alias !== canonical) delete data[alias];
      }
      data.sections = data.sections.map((section, index) => {
        if (!isObject(section)) return section;
        const normalized = { ...section };
        for (const [alias, canonical] of Object.entries(aliases)) {
          if (!Object.hasOwn(normalized, canonical) && Object.hasOwn(normalized, alias)) normalized[canonical] = normalized[alias];
          if (Object.hasOwn(normalized, alias) && alias !== canonical) delete normalized[alias];
        }
        if (!normalized.section_id) normalized.section_id = `S${index + 1}`;
        if (!normalized.heading) normalized.heading = `第 ${index + 1} 部分`;
        if (!normalized.objective) normalized.objective = `${normalized.heading}（执行要点）`;
        if (!normalized.role || !["hook", "problem", "diagnosis", "evidence", "method", "example", "action", "boundary"].includes(normalized.role)) normalized.role = index === 0 ? "hook" : index === 1 ? "problem" : index === data.sections.length - 1 ? "action" : "method";
        if (!Array.isArray(normalized.key_points)) normalized.key_points = [];
        if (!Array.isArray(normalized.claim_ids)) normalized.claim_ids = [];
        if (typeof normalized.boundary !== "string") normalized.boundary = "不添加无证据事实";
        // A few prompt-only providers echo both the issued presentation slot
        // and its semantic-unit explanation.  The runtime contract permits one
        // mapping authority only; prefer the issued placement and let the
        // trusted semantic materializer resolve the unit refs.
        if (Object.hasOwn(normalized, "sequencePlacement") && Object.hasOwn(normalized, "masterUnitIds")) delete normalized.masterUnitIds;
        if (!Object.hasOwn(normalized, "sequencePlacement") && !Object.hasOwn(normalized, "masterUnitIds")) normalized.masterUnitIds = [];
        return normalized;
      });
      data.outline_id ||= "outline_provider_output";
      data.schema_version ||= "1.0";
      data.platform ||= value.platform || "xiaohongshu";
      data.topic ||= data.content_promise || "待定义选题";
      data.content_promise ||= data.topic;
      data.content_purpose_id ||= "knowledge_howto";
      data.conversion_stage_id ||= "trust_building";
      data.opening_strategy ||= "从目标读者当前问题进入，不虚构个人经历";
      data.closing_strategy ||= "总结核心判断并给出下一步行动";
      data.content_function ||= "discovery";
      while (data.platform === "xiaohongshu" && data.sections.length < 6) {
        const index = data.sections.length;
        data.sections.push({ section_id: `S${index + 1}`, heading: `第 ${index + 1} 个关键判断`, objective: `补充可审阅的分页结构 ${index + 1}`, role: "method", key_points: [], claim_ids: [], boundary: "不添加无证据事实", masterUnitIds: [] });
      }
      data.unresolved_questions = Array.isArray(data.unresolved_questions) ? data.unresolved_questions : [];
      data.confirmation_required = true;
      return {
        adapted: true,
        value: {
          status: value.status === "needs_review" ? "needs_review" : "ready",
          data,
          warnings: Array.isArray(value.warnings) ? value.warnings : [],
          blocked_reasons: Array.isArray(value.blocked_reasons) ? value.blocked_reasons : []
        },
        wrapperPath
      };
    }
  }
  // ContentMaster is intentionally tolerant at the provider boundary. MiniMax
  // occasionally returns the requested master data directly (or uses camelCase
  // field names) even when the prompt asks for the canonical envelope. Normalize
  // that shape here so the downstream authority compiler can apply its own
  // evidence/source filtering instead of treating a usable model response as a
  // transport failure.
  if (contract === "ContentMaster@2.0" && isObject(value)) {
    const allowedStatuses = new Set(["success", "ready", "needs_review", "blocked"]);
    const masterSignals = [
      "content_master_id", "contentMasterId", "central_thesis", "centralThesis", "central_question", "centralQuestion",
      "confirmed_facts", "confirmedFacts", "supported_interpretations", "supportedInterpretations", "reader_value", "readerValue",
      "target_audience", "targetAudience", "content_emphasis", "contentEmphasis", "unknowns", "claims_to_avoid"
    ];
    const isMasterData = (candidate) => isObject(candidate) && masterSignals.some((key) => Object.hasOwn(candidate, key));
    const wrapperKeys = ["data", "content_master", "contentMaster", "master", "result", "response", "output"];
    let source = value;
    let wrapperPath = "bare_content_master_data";
    let hasData = false;
    for (const key of wrapperKeys) {
      if (isMasterData(value[key])) {
        source = value[key];
        hasData = key === "data";
        wrapperPath = key === "data" ? "content_master_partial_envelope" : `nested_content_master_${key}`;
        break;
      }
    }
    const looksLikeMaster = isMasterData(source);
    if (looksLikeMaster) {
      const data = { ...source };
      const aliases = {
        contentMasterId: "content_master_id",
        confirmedFacts: "confirmed_facts",
        supportedInterpretations: "supported_interpretations",
        authorOpinions: "author_opinions",
        sourceList: "source_list",
        centralThesis: "central_thesis",
        centralQuestion: "central_question",
        readerValue: "reader_value",
        contentEmphasis: "content_emphasis",
        publishTimeChecks: "publish_time_checks",
        claimsToAvoid: "claims_to_avoid"
      };
      for (const [alias, canonical] of Object.entries(aliases)) {
        if (!Object.hasOwn(data, canonical) && Object.hasOwn(data, alias)) data[canonical] = data[alias];
        if (Object.hasOwn(data, alias) && alias !== canonical) delete data[alias];
      }
      data.content_master_id = String(data.content_master_id || data.id || "cm_provider_output");
      for (const key of ["confirmed_facts", "supported_interpretations", "author_opinions", "source_list"]) {
        if (!Array.isArray(data[key])) data[key] = [];
      }
      // ContentMaster@2.0's runtime envelope uses `success`; `ready` is the
      // human-facing status used in some skill prompts, so map it at the edge.
      const status = value.status === "ready" ? "success" : (allowedStatuses.has(value.status) ? value.status : "success");
      return {
        adapted: true,
        value: {
          status,
          data,
          warnings: Array.isArray(value.warnings) ? value.warnings : [],
          blocked_reasons: Array.isArray(value.blocked_reasons) ? value.blocked_reasons : []
        },
          wrapperPath
      };
    }
  }
  const expectedKeys = BARE_SKILL_DATA_KEYS[contract];
  if (!expectedKeys || !isObject(value)) return { adapted: false, value, wrapperPath: "direct" };
  if (contract === "XhsCarouselPlanCreativeOutput@1.0") {
    const source = value.status === "success" && isObject(value.data) ? value.data : value;
    const draft = { ...source };
    let changed = false;
    if (Object.hasOwn(draft, "deck_id")) { delete draft.deck_id; changed = true; }
    if (Object.hasOwn(draft, "deckId")) { delete draft.deckId; changed = true; }
    if (!Object.hasOwn(draft, "schemaVersion") && Object.hasOwn(draft, "schema_version")) { draft.schemaVersion = draft.schema_version; delete draft.schema_version; changed = true; }
    if (!Object.hasOwn(draft, "reading_arc") && Object.hasOwn(draft, "readingArc")) { draft.reading_arc = draft.readingArc; delete draft.readingArc; changed = true; }
    if (!Object.hasOwn(draft, "section_drafts") && Array.isArray(draft.pages)) { draft.section_drafts = draft.pages; delete draft.pages; changed = true; }
    if (changed) value = value.status === "success" ? { ...value, data: draft } : draft;
  }
  if (contract === "PlatformTitleList@1.0" && value?.status === "success" && Array.isArray(value?.data?.candidates)) {
    const scoreParts = ["fulfillment", "relevance", "specificity", "curiosity", "clarity", "uniqueness"];
    let changed = false;
    const candidates = value.data.candidates.map((candidate) => {
      if (!isObject(candidate?.scores)) return candidate;
      const scores = { ...candidate.scores };
      if (!Object.hasOwn(scores, "overall") && Number.isFinite(Number(scores.overall_score))) {
        scores.overall = Number(scores.overall_score);
        delete scores.overall_score;
        changed = true;
      } else if (!Object.hasOwn(scores, "overall") && scoreParts.every((key) => Number.isFinite(Number(scores[key])))) {
        scores.overall = Math.max(1, Math.min(5, Math.round(scoreParts.reduce((sum, key) => sum + Number(scores[key]), 0) / scoreParts.length)));
        changed = true;
      }
      return scores === candidate.scores ? candidate : { ...candidate, scores };
    });
    let recommendations = isObject(value.data.recommendations) ? { ...value.data.recommendations } : value.data.recommendations;
    if (isObject(recommendations)) {
      const aliases = { viral: "spread", searchable: "search", test: "experiment", experimental: "experiment", evergreen: "experiment" };
      for (const [alias, canonical] of Object.entries(aliases)) {
        if (!Object.hasOwn(recommendations, canonical) && Object.hasOwn(recommendations, alias)) recommendations[canonical] = recommendations[alias];
        if (Object.hasOwn(recommendations, alias)) { delete recommendations[alias]; changed = true; }
      }
      const motivations = new Map(candidates.map((candidate) => [candidate.motivation, candidate.title_id]));
      const fallbackId = candidates.find((candidate) => candidate.risk !== "high")?.title_id || candidates[0]?.title_id;
      for (const key of ["balanced", "safe", "spread", "search", "experiment"]) {
        if (!Object.hasOwn(recommendations, key) && fallbackId) {
          recommendations[key] = motivations.get(key) || (key === "experiment" ? motivations.get("evergreen") : null) || fallbackId;
          changed = true;
        }
      }
    }
    if (changed) value = { ...value, data: { ...value.data, candidates, recommendations } };
  }
  if (contract === "XhsVisualAssetPlanCreativeOutput@1.0") {
    let source = value.status === "success" && isObject(value.data) ? value.data : value;
    if (Array.isArray(source.imageSpecs)) {
      let removedMachineFields = false;
      const imageSpecs = source.imageSpecs.map((spec) => {
        if (!isObject(spec)) return spec;
        const normalized = { ...spec };
        for (const key of ["designDnaVersion", "design_dna_version", "componentHash", "component_hash"]) {
          if (Object.hasOwn(normalized, key)) { delete normalized[key]; removedMachineFields = true; }
        }
        return normalized;
      });
      if (removedMachineFields) {
        source = { ...source, imageSpecs };
        value = value.status === "success" ? { ...value, data: source } : source;
      }
    }
    const snakeKeys = ["schema_version", "contract", "page_visuals", "image_specs", "skipped_pages", "page_asset_bindings"];
    if (Object.keys(source).length === snakeKeys.length && snakeKeys.every((key) => Object.hasOwn(source, key))
      && [source.page_visuals, source.image_specs, source.skipped_pages, source.page_asset_bindings].every(Array.isArray)) {
      const rename = (item, aliases) => Object.fromEntries(Object.entries(item || {}).map(([key, fieldValue]) => [aliases[key] || key, fieldValue]));
      const data = {
        schemaVersion: source.schema_version,
        contract: source.contract,
        pageVisuals: source.page_visuals.map((item) => rename(item, { visual_function: "visualFunction", visual_need: "visualNeed", render_strategy: "renderStrategy", must_keep: "mustKeep", must_avoid: "mustAvoid" })),
        imageSpecs: source.image_specs.map((item) => rename(item, { planned_asset_id: "plannedAssetId", use_case: "useCase", asset_type: "assetType", style_and_medium: "styleAndMedium", text_safe_area: "textSafeArea", negative_prompt: "negativePrompt", reference_asset_ids: "referenceAssetIds", must_keep: "mustKeep", must_avoid: "mustAvoid", text_policy: "textPolicy" })),
        skippedPages: source.skipped_pages.map((item) => ({ ...item })),
        pageAssetBindings: source.page_asset_bindings.map((item) => rename(item, { planned_asset_ids: "plannedAssetIds" }))
      };
      const envelope = value.status === "success" ? { ...value, data } : data;
      const adapted = adaptCanonicalSkillEnvelope(contract, envelope);
      return { ...adapted, adapted: true, wrapperPath: "snake_case_visual_data" };
    }
  }
  if (contract === "ContentOutline@1.0" && value?.status === "success" && isObject(value?.data) && Array.isArray(value.data.sections)) {
    const aliases = {
      opening: "hook", intro: "hook", context: "hook", situation: "hook",
      pain: "problem", challenge: "problem", problem_statement: "problem",
      why: "diagnosis", root_cause: "diagnosis", analysis: "diagnosis",
      proof: "evidence", case_study: "evidence", evidence_based: "evidence",
      steps: "method", solution: "method", framework: "method", process: "method",
      scenario: "example", example_case: "example",
      cta: "action", next_step: "action", actionable: "action",
      risk: "boundary", caveat: "boundary", limitation: "boundary"
    };
    const allowed = new Set(["hook", "problem", "diagnosis", "evidence", "method", "example", "action", "boundary"]);
    const sequence = value.data.platform === "wechat"
      ? ["hook", "problem", "diagnosis", "evidence", "method", "action"]
      : ["hook", "problem", "diagnosis", "evidence", "method", "example", "action", "boundary"];
    let changed = false;
    const sections = value.data.sections.map((section, index) => {
      if (!isObject(section)) return section;
      const raw = String(section.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      const role = allowed.has(raw) ? raw : aliases[raw] || sequence[index] || "method";
      if (role === section.role) return section;
      changed = true;
      return { ...section, role };
    });
    if (changed) value = { ...value, data: { ...value.data, sections } };
  }
  if (value.status === "success" && isObject(value.data)) {
    const nestedKeys = Object.keys(value.data);
    const nestedEnvelopeFields = ["warnings", "blocked_reasons"];
    const dataWithNestedEnvelope = expectedKeys.every((key) => Object.hasOwn(value.data, key))
      && nestedKeys.every((key) => expectedKeys.includes(key) || nestedEnvelopeFields.includes(key))
      && nestedEnvelopeFields.some((key) => Object.hasOwn(value.data, key));
    if (dataWithNestedEnvelope) {
      const data = Object.fromEntries(Object.entries(value.data).filter(([key]) => !nestedEnvelopeFields.includes(key)));
      return {
        adapted: true,
        value: {
          ...value,
          data,
          warnings: Array.isArray(value.warnings) ? value.warnings : (Array.isArray(value.data.warnings) ? value.data.warnings : []),
          blocked_reasons: Array.isArray(value.blocked_reasons) ? value.blocked_reasons : (Array.isArray(value.data.blocked_reasons) ? value.data.blocked_reasons : [])
        },
        wrapperPath: "nested_success_envelope_fields"
      };
    }
  }
  const exactData = (candidate) => isObject(candidate)
    && Object.keys(candidate).length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(candidate, key));
  if (contract === "WechatArticleReview@1.0") {
    const source = isObject(value.data) ? value.data : value;
    const blockedReasons = Array.isArray(value.blocked_reasons) ? value.blocked_reasons : [];
    if (blockedReasons.length === 0 && expectedKeys.every((key) => Object.hasOwn(source, key))) {
      const findingKeys = ["finding_id", "category", "location", "severity", "issue", "required_action", "claim_ids"];
      const patchKeys = ["target", "before", "after", "reason"];
      const data = Object.fromEntries(expectedKeys.map((key) => [key, source[key]]));
      if (Array.isArray(data.findings)) data.findings = data.findings.map((item) => isObject(item)
        ? Object.fromEntries(findingKeys.map((key) => [key, item[key]])) : item);
      if (Array.isArray(data.patches)) data.patches = data.patches.map((item) => isObject(item)
        ? Object.fromEntries(patchKeys.map((key) => [key, item[key]])) : item);
      return {
        adapted: true,
        value: {
          status: "success",
          data,
          // Review findings are the canonical warning channel. Envelope
          // warnings are redundant once the complete report is projected.
          warnings: [],
          blocked_reasons: []
        },
        wrapperPath: "projected_wechat_review_data"
      };
    }
  }
  const rootKeys = Object.keys(value);
  if (value.status === "success" && isObject(value.data)
    && rootKeys.every((key) => ["status", "data", "warnings", "blocked_reasons"].includes(key))) {
    const warnings = Array.isArray(value.warnings) ? value.warnings : [];
    const blockedReasons = Array.isArray(value.blocked_reasons) ? value.blocked_reasons : [];
    if (!Object.hasOwn(value, "warnings") || !Object.hasOwn(value, "blocked_reasons")) {
      return { adapted: true, value: { ...value, warnings, blocked_reasons: blockedReasons }, wrapperPath: "partial_success_envelope" };
    }
  }
  const keys = Object.keys(value);
  const bareData = exactData(value);
  if (!bareData) return { adapted: false, value, wrapperPath: "direct" };
  return {
    adapted: true,
    value: { status: "success", data: value, warnings: [], blocked_reasons: [] },
    wrapperPath: "bare_skill_data"
  };
}

export function validateWechatArticleSchema(value) {
  const adapted = adaptWechatArticleCandidate(value);
  const article = adapted.article;
  const errors = [];
  if (!article) {
    errors.push("data must contain a WechatArticle object");
    return { valid: false, errors, validationFieldPaths: ["data"], ...adapted };
  }
  if (typeof article.article_markdown !== "string") errors.push("data.article_markdown must be a string");
  if (!Array.isArray(article.title_candidates)) errors.push("data.title_candidates must be an array");
  if (!Array.isArray(article.outline)) errors.push("data.outline must be an array");
  if (typeof article.information_gain !== "string") errors.push("data.information_gain must be a string");
  if (!isObject(article.image_plan)) errors.push("data.image_plan must be an object");
  else {
    if (!isObject(article.image_plan.cover)) errors.push("data.image_plan.cover must be an object");
    if (!Array.isArray(article.image_plan.slots)) errors.push("data.image_plan.slots must be an array");
  }
  return {
    valid: errors.length === 0,
    errors,
    validationFieldPaths: errors.map((error) => error.split(" must ")[0]),
    ...adapted
  };
}

function validateWechatRecoveryBinding(errors, binding, prefix = "binding") {
  if (!isObject(binding)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  for (const key of WECHAT_RECOVERY_BINDING_KEYS) {
    if (typeof binding[key] !== "string" || !binding[key].trim()) errors.push(`${prefix}.${key} is required`);
  }
  if (typeof binding.inputSummaryHash === "string" && !/^[a-f0-9]{64}$/.test(binding.inputSummaryHash)) errors.push(`${prefix}.inputSummaryHash must be a sha256 hex digest`);
}

export function validateWechatArticleBodyRecovery(value) {
  const errors = [];
  if (!isObject(value)) return { valid: false, errors: ["result must be a JSON object"] };
  if (value.schemaVersion !== "1.0") errors.push("schemaVersion must equal 1.0");
  const allowedKeys = new Set(["schemaVersion", "binding", "confirmed_outline_id", "article_markdown", "claim_map", "used_source_ids"]);
  for (const key of Object.keys(value)) if (!allowedKeys.has(key)) errors.push(`${key} is not allowed in body recovery`);
  validateWechatRecoveryBinding(errors, value.binding);
  const markdown = typeof value.article_markdown === "string" ? value.article_markdown.trim() : "";
  if (!markdown) errors.push("article_markdown must be a non-empty string");
  if (markdown.length < 1200) errors.push("article_markdown must contain at least 1200 characters");
  if ((markdown.match(/^##\s/gm) || []).length < 3) errors.push("article_markdown must contain at least 3 H2 sections");
  if (typeof value.confirmed_outline_id !== "string" || !value.confirmed_outline_id.trim()) errors.push("confirmed_outline_id is required");
  if (!Array.isArray(value.claim_map)) errors.push("claim_map must be an array");
  if (!Array.isArray(value.used_source_ids)) errors.push("used_source_ids must be an array");
  return { valid: errors.length === 0, errors };
}

export function validateWechatArticleMetadataRecovery(value) {
  const errors = [];
  if (!isObject(value)) return { valid: false, errors: ["result must be a JSON object"] };
  if (value.schemaVersion !== "1.0") errors.push("schemaVersion must equal 1.0");
  const allowedKeys = new Set(["schemaVersion", "binding", "article_promise", "core_argument", "information_gain", "title_candidates", "recommended_title", "abstract", "opening", "outline", "pull_quotes", "key_takeaways", "share_summary", "share_reason", "engagement_strategy", "cta", "used_knowledge_asset_ids", "image_plan"]);
  for (const key of Object.keys(value)) if (!allowedKeys.has(key)) errors.push(`${key} is not allowed in metadata recovery`);
  validateWechatRecoveryBinding(errors, value.binding);
  const titles = Array.isArray(value.title_candidates) ? value.title_candidates.filter((item) => typeof item === "string" ? item.trim() : item?.title) : [];
  if (titles.length < 3 || titles.length > 5) errors.push("title_candidates must contain 3 to 5 titles");
  if (!Array.isArray(value.outline) || value.outline.length < 3) errors.push("outline must contain at least 3 sections");
  if (typeof value.information_gain !== "string" || value.information_gain.trim().length < 12) errors.push("information_gain must describe the information gain");
  if (!isObject(value.image_plan) || !isObject(value.image_plan.cover) || !Array.isArray(value.image_plan.slots) || value.image_plan.slots.length < 1) errors.push("image_plan must contain a cover and at least one body slot");
  return { valid: errors.length === 0, errors };
}

const contractAliases = {
  "DiagnosticTurnAnalysis@1.0": "DiagnosticTurnResult@2.0",
  "DiagnosticAssistance@1.0": "DiagnosticAssistanceResult@2.0",
  "ConsultativeReply@1.0": "ConsultativeReply@2.0",
  "StrategySnapshotDraft@1.0": "StrategyDraftResult@2.0"
};

export function canonicalContractName(name = "") {
  return contractAliases[name] || name || "UnstructuredResult@1.0";
}

export function validateContract(name, value) {
  const contract = canonicalContractName(name);
  const errors = [];
  if (!isObject(value)) return {
    valid: false, contract, errors: ["result must be a JSON object"],
    ...(["ContentOutline@1.0", "XhsPostCopyCreativeOutput@1.0", "PlatformTitleList@1.0", "XhsCarouselPlanCreativeOutput@1.0", "XhsVisualAssetPlanCreativeOutput@1.0", "WechatArticleReview@1.0", "WechatImagePlan@1.0"].includes(contract)
      ? { validationFieldPaths: ["$"] } : {})
  };
  if (["DiagnosticTurnResult@2.0","DiagnosticTurnResult@3.0"].includes(contract)) {
    if (!value.intent || typeof value.intent !== "string") errors.push("intent is required");
    const operations = value.coreClaimOperations ?? value.claims ?? [];
    if (!Array.isArray(operations)) errors.push("coreClaimOperations must be an array");
    for (const [index, item] of (Array.isArray(operations) ? operations : []).entries()) {
      if (!isObject(item) || !item.fieldPath) errors.push(`coreClaimOperations[${index}].fieldPath is required`);
    }
    if (contract === "DiagnosticTurnResult@3.0" && value.targetAssessment != null) {
      if (!isObject(value.targetAssessment)) errors.push("targetAssessment must be an object");
      else if (!value.targetAssessment.targetType || !value.targetAssessment.targetId || !Array.isArray(value.targetAssessment.capturedSlots)) errors.push("targetAssessment targetType, targetId and capturedSlots are required");
    }
  } else if (contract === "DiagnosticAssistanceResult@2.0") {
    if (typeof value.assistantMessage !== "string" || !value.assistantMessage.trim()) errors.push("assistantMessage is required");
    if (value.assistanceType != null && typeof value.assistanceType !== "string") errors.push("assistanceType must be a string");
  } else if (contract === "ConsultativeReply@2.0") {
    if (typeof value.assistantMessage !== "string" || !value.assistantMessage.trim()) errors.push("assistantMessage is required");
  } else if (contract === "StrategyDraftResult@2.0") {
    if (!isObject(value.business)) errors.push("business is required");
    if (!isObject(value.accountStrategy)) errors.push("accountStrategy is required");
  } else if (contract === "StrategySynthesisResult@2.0") {
    if (value.schemaVersion !== "2.0") errors.push("schemaVersion must equal 2.0");
    if (!isObject(value.business)) errors.push("business is required");
    if (!isObject(value.strategy)) errors.push("strategy is required");
    if (!isObject(value.governance)) errors.push("governance is required");
  } else if (contract === "RecommendationBundle@2.0") {
    if (!value.targetFieldPath) errors.push("targetFieldPath is required");
    if (!Array.isArray(value.options) || !value.options.length) errors.push("options must contain at least one option");
    for (const [index, option] of (Array.isArray(value.options) ? value.options : []).entries()) {
      if (!option?.optionId) errors.push(`options[${index}].optionId is required`);
      if (option?.completeValue == null) errors.push(`options[${index}].completeValue is required`);
    }
  } else if (contract === "RecommendationRevision@1.0") {
    if (value.revisedValue == null) errors.push("revisedValue is required");
    if (!isObject(value.display) || typeof value.display.summary !== "string") errors.push("display.summary is required");
  } else if (contract === "PostCompletionTurnResult@1.0") {
    if (!value.intent || typeof value.intent !== "string") errors.push("intent is required");
    if (!Array.isArray(value.factOperations)) errors.push("factOperations must be an array");
  } else if (contract === "StrategyPatch@1.0") {
    if (!Array.isArray(value.affectedFields)) errors.push("affectedFields must be an array");
    if (!Array.isArray(value.claimOperations)) errors.push("claimOperations must be an array");
  } else if (contract === "DocumentDiagnosticExtraction@1.0") {
    if (!Array.isArray(value.candidateClaims)) errors.push("candidateClaims must be an array");
    for (const [index, item] of (Array.isArray(value.candidateClaims) ? value.candidateClaims : []).entries()) {
      if (!item?.targetFieldPath) errors.push(`candidateClaims[${index}].targetFieldPath is required`);
      if (item?.value == null) errors.push(`candidateClaims[${index}].value is required`);
    }
  } else if (contract === "ContentMaster@2.0") {
    if (!["success", "failed", "needs_review"].includes(value.status)) errors.push("status must be success, failed, or needs_review");
    if (!isObject(value.data)) errors.push("data must be an object");
    if (!Array.isArray(value.warnings)) errors.push("warnings must be an array");
    if (!Array.isArray(value.blocked_reasons)) errors.push("blocked_reasons must be an array");
    const data = isObject(value.data) ? value.data : {};
    if (!isNonEmptyString(data.content_master_id)) errors.push("data.content_master_id is required");
    if (!Array.isArray(data.confirmed_facts)) errors.push("data.confirmed_facts must be an array");
    for (const [index, fact] of (Array.isArray(data.confirmed_facts) ? data.confirmed_facts : []).entries()) {
      if (!isNonEmptyString(fact?.fact_id)) errors.push(`data.confirmed_facts[${index}].fact_id is required`);
      if (!isNonEmptyString(fact?.fact)) errors.push(`data.confirmed_facts[${index}].fact is required`);
      if (!isNonEmptyStringArray(fact?.source_ids)) errors.push(`data.confirmed_facts[${index}].source_ids must contain at least one source id`);
    }
    if (!Array.isArray(data.supported_interpretations)) errors.push("data.supported_interpretations must be an array");
    if (!Array.isArray(data.author_opinions)) errors.push("data.author_opinions must be an array");
    if (!Array.isArray(data.source_list)) errors.push("data.source_list must be an array");
    if (Object.hasOwn(data, "semanticUnitIds")
      && (!Array.isArray(data.semanticUnitIds) || data.semanticUnitIds.some((id) => !isNonEmptyString(id)))) {
      errors.push("data.semanticUnitIds must be a string array when supplied");
    }
  } else if (contract === "ContentOutline@1.0") {
    const validationFieldPaths = [];
    const add = (message, path) => { errors.push(message); validationFieldPaths.push(path); };
    if (!["ready", "needs_review", "blocked"].includes(value.status)) add("status must be ready, needs_review, or blocked", "status");
    if (!isObject(value.data)) add("data must be an object", "data");
    if (!Array.isArray(value.warnings)) add("warnings must be an array", "warnings");
    if (!Array.isArray(value.blocked_reasons)) add("blocked_reasons must be an array", "blocked_reasons");
    const data = isObject(value.data) ? value.data : {};
    if (!isNonEmptyString(data.outline_id)) add("data.outline_id is required", "data.outline_id");
    if (data.schema_version !== "1.0") add("data.schema_version must equal 1.0", "data.schema_version");
    if (!["xiaohongshu", "wechat"].includes(data.platform)) add("data.platform must be xiaohongshu or wechat", "data.platform");
    for (const key of ["topic", "content_promise", "content_purpose_id", "conversion_stage_id", "opening_strategy", "closing_strategy"]) {
      if (!isNonEmptyString(data[key])) add(`data.${key} is required`, `data.${key}`);
    }
    if (!["discovery", "authority", "proof", "solution", "action"].includes(data.content_function)) {
      add("data.content_function is invalid", "data.content_function");
    }
    if (!Array.isArray(data.sections) || data.sections.length < 3) add("data.sections must contain at least 3 sections", "data.sections.length");
    if (data.platform === "xiaohongshu" && (!Array.isArray(data.sections) || data.sections.length < 6 || data.sections.length > 10)) {
      add("data.sections must contain 6 to 10 sections for xiaohongshu", "data.sections.length");
    }
    for (const [index, section] of (Array.isArray(data.sections) ? data.sections : []).entries()) {
      if (!isObject(section)) {
        add(`data.sections[${index}] must be an object`, `data.sections[${index}]`);
        continue;
      }
      for (const key of ["section_id", "heading", "objective"]) {
        if (!isNonEmptyString(section[key])) add(`data.sections[${index}].${key} is required`, `data.sections[${index}].${key}`);
      }
      if (!["hook", "problem", "diagnosis", "evidence", "method", "example", "action", "boundary"].includes(section.role)) {
        add(`data.sections[${index}].role is invalid`, `data.sections[${index}].role`);
      }
      if (!Array.isArray(section.key_points)) add(`data.sections[${index}].key_points must be an array`, `data.sections[${index}].key_points`);
      if (!Array.isArray(section.claim_ids)) add(`data.sections[${index}].claim_ids must be an array`, `data.sections[${index}].claim_ids`);
      if (typeof section.boundary !== "string") add(`data.sections[${index}].boundary must be a string`, `data.sections[${index}].boundary`);
      const hasPlacement = Object.hasOwn(section, "sequencePlacement");
      const hasUnitIds = Object.hasOwn(section, "masterUnitIds");
      if (hasPlacement === hasUnitIds) {
        add(`data.sections[${index}] must contain exactly one mapping field`, `data.sections[${index}]`);
      } else if (hasPlacement) {
        const placement = section.sequencePlacement;
        if (!isObject(placement) || !["core", "supplemental"].includes(placement.kind)) {
          add(`data.sections[${index}].sequencePlacement is invalid`, `data.sections[${index}].sequencePlacement`);
        } else if (placement.kind === "core" && !isNonEmptyStringArray(placement.slotIds)) {
          add(`data.sections[${index}].sequencePlacement.slotIds must contain at least one slot id`, `data.sections[${index}].sequencePlacement.slotIds`);
        } else if (placement.kind === "supplemental" && !isNonEmptyString(placement.anchorId)) {
          add(`data.sections[${index}].sequencePlacement.anchorId is required`, `data.sections[${index}].sequencePlacement.anchorId`);
        }
      } else if (!Array.isArray(section.masterUnitIds) || section.masterUnitIds.some((id) => !isNonEmptyString(id))) {
        add(`data.sections[${index}].masterUnitIds must be a string array`, `data.sections[${index}].masterUnitIds`);
      }
    }
    if (data.platform === "xiaohongshu" && Array.isArray(data.sections)) {
      const unique = (values) => values.every(isNonEmptyString) && new Set(values.map((item) => item.trim())).size === values.length;
      if (!unique(data.sections.map((section) => section?.section_id))) add("data.sections section_id values must be unique for xiaohongshu", "data.sections.section_id");
      if (!unique(data.sections.map((section) => section?.objective))) add("data.sections objective values must be unique for xiaohongshu", "data.sections.objective");
      const contentSignatures = data.sections.map((section) => JSON.stringify({ heading: section?.heading, key_points: section?.key_points, boundary: section?.boundary }));
      if (new Set(contentSignatures).size !== contentSignatures.length) add("data.sections presentation content must be unique for xiaohongshu", "data.sections.presentation");
    }
    if (!Array.isArray(data.unresolved_questions)) add("data.unresolved_questions must be an array", "data.unresolved_questions");
    if (data.confirmation_required !== true) add("data.confirmation_required must equal true", "data.confirmation_required");
    return { valid: errors.length === 0, contract, errors, validationFieldPaths: [...new Set(validationFieldPaths)] };
  } else if (contract === "XhsPostCopyCreativeOutput@1.0") {
    const validation = validateXhsPostCreativeEnvelope(value);
    return { valid: validation.errors.length === 0, contract, ...validation };
  } else if (contract === "PlatformTitleList@1.0") {
    const validation = validatePlatformTitlesEnvelope(value);
    return { valid: validation.errors.length === 0, contract, ...validation };
  } else if (contract === "XhsCarouselPlanCreativeOutput@1.0") {
    const validation = validateXhsCarouselCreativeEnvelope(value);
    return { valid: validation.errors.length === 0, contract, ...validation };
  } else if (contract === "XhsVisualAssetPlanCreativeOutput@1.0") {
    const validation = validateXhsVisualEnvelope(value);
    return { valid: validation.errors.length === 0, contract, ...validation };
  } else if (contract === "WechatArticleReview@1.0") {
    const validation = validateWechatReviewEnvelope(value);
    return { valid: validation.errors.length === 0, contract, ...validation };
  } else if (contract === "WechatImagePlan@1.0") {
    const validation = validateWechatImageEnvelope(value);
    return { valid: validation.errors.length === 0, contract, ...validation };
  } else if (contract === "WechatArticle@2.0") {
    const schema = validateWechatArticleSchema(value);
    errors.push(...schema.errors);
    const article = schema.article || {};
    const markdown = typeof article.article_markdown === "string" ? article.article_markdown.trim() : "";
    const titles = Array.isArray(article.title_candidates) ? article.title_candidates.filter((item) => typeof item === "string" ? item.trim() : item?.title) : [];
    const outline = Array.isArray(article.outline) ? article.outline : [];
    if (!markdown) errors.push("data.article_markdown must be a non-empty string");
    if (markdown.length < 1200) errors.push("data.article_markdown must contain at least 1200 characters");
    if ((markdown.match(/^##\s/gm) || []).length < 3) errors.push("data.article_markdown must contain at least 3 H2 sections");
    if (titles.length < 3 || titles.length > 5) errors.push("data.title_candidates must contain 3 to 5 titles");
    if (outline.length < 3) errors.push("data.outline must contain at least 3 sections");
    if (typeof article.information_gain !== "string" || article.information_gain.trim().length < 12) errors.push("data.information_gain must describe the information gain");
    if (!isObject(article.image_plan) || !isObject(article.image_plan.cover) || !Array.isArray(article.image_plan.slots) || article.image_plan.slots.length < 1) errors.push("data.image_plan must contain a cover and at least one body slot");
  } else if (contract === "WechatArticleBodyRecovery@1.0") errors.push(...validateWechatArticleBodyRecovery(value).errors);
  else if (contract === "WechatArticleMetadataRecovery@1.0") errors.push(...validateWechatArticleMetadataRecovery(value).errors);
  return { valid: errors.length === 0, contract, errors };
}

export function validateContractSchema(name, value) {
  const contract = canonicalContractName(name);
  if (contract !== "WechatArticle@2.0") return validateContract(contract, value);
  const schema = validateWechatArticleSchema(value);
  return {
    valid: schema.valid,
    contract,
    errors: schema.errors,
    validationFieldPaths: schema.validationFieldPaths,
    adapted: schema.adapted,
    wrapperPath: schema.wrapperPath,
    value: schema.value
  };
}

// The unified WeChat writer now emits a narrative-only Creative Draft. The
// image plan is a separate, later Runtime/Provider step; keep the historical
// WechatArticle schema validator intact for legacy callers, but provide a
// narrow Gateway projection for the new writer task.
export function validateWechatNarrativeDraftSchema(value) {
  const adapted = adaptWechatArticleCandidate(value);
  const article = adapted.article;
  const errors = [];
  if (!article) return { valid: false, errors: ["data"], validationFieldPaths: ["data"], ...adapted };
  for (const key of ["article_markdown", "title_candidates", "outline", "information_gain"]) {
    if (key === "article_markdown" && typeof article[key] !== "string") errors.push("data.article_markdown");
    if (key === "title_candidates" && !Array.isArray(article[key])) errors.push("data.title_candidates");
    if (key === "outline" && !Array.isArray(article[key])) errors.push("data.outline");
    if (key === "information_gain" && typeof article[key] !== "string") errors.push("data.information_gain");
  }
  return { valid: errors.length === 0, errors, validationFieldPaths: errors, ...adapted };
}

function contentOutlineExample(context = {}) {
  const input = isObject(context?.input) ? context.input : context;
  const platform = ["wechat", "wechat_official_account"].includes(input?.platform) ? "wechat" : "xiaohongshu";
  const strictSequenceContract = isObject(input?.strict_sequence_contract) ? input.strict_sequence_contract : null;
  const issuedSlots = Array.isArray(strictSequenceContract?.slots)
    ? strictSequenceContract.slots.filter((slot) => isNonEmptyString(slot?.slotId))
    : [];
  const issuedAnchors = Array.isArray(strictSequenceContract?.supplementalAnchors)
    ? strictSequenceContract.supplementalAnchors.filter((anchor) => isNonEmptyString(anchor?.anchorId))
    : [];
  const selectedAnchors = issuedSlots.length < 4 ? issuedAnchors.slice(0, 4 - issuedSlots.length) : [];
  const requestedPlan = Array.isArray(input?.presentation_section_plan) ? input.presentation_section_plan : null;
  const plannedPlacements = requestedPlan?.length ? requestedPlan : issuedSlots.length === 4
    ? [
        { kind: "core", slotIds: ["core-slot:1"] },
        { kind: "core", slotIds: ["core-slot:2"] },
        { kind: "core", slotIds: ["core-slot:2"] },
        { kind: "core", slotIds: ["core-slot:3"] },
        { kind: "core", slotIds: ["core-slot:4"] },
        { kind: "supplemental", anchorId: "supplemental-anchor:4" }
      ]
    : null;
  const placements = plannedPlacements || [
    ...issuedSlots.map((slot, order) => ({ order: order * 2 + 1, value: { kind: "core", slotIds: [slot.slotId] } })),
    ...selectedAnchors.map((anchor) => ({ order: Number(anchor.position) * 2, value: { kind: "supplemental", anchorId: anchor.anchorId } }))
  ].sort((left, right) => left.order - right.order).map((item) => item.value);
  const sectionCount = strictSequenceContract ? placements.length : platform === "xiaohongshu" ? 6 : 4;
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const section = {
      section_id: `section-${index + 1}`,
      heading: `Section ${index + 1}`,
      role: index === sectionCount - 1 ? "action" : "method",
      objective: `Deliver the purpose of section ${index + 1}.`,
      key_points: [`Key point ${index + 1}`],
      claim_ids: [],
      boundary: "Use only supplied authority."
    };
    if (strictSequenceContract) section.sequencePlacement = placements[index];
    else section.masterUnitIds = [`unit-${index + 1}`];
    return section;
  });
  return {
    status: "ready",
    data: {
      outline_id: platform === "wechat" ? "OUTLINE-WECHAT-001" : "OUTLINE-XHS-001",
      schema_version: "1.0",
      platform,
      topic: "A focused content topic",
      content_promise: "Give the reader a useful and verifiable path forward.",
      content_function: "authority",
      content_purpose_id: "purpose-001",
      conversion_stage_id: "stage-001",
      opening_strategy: "Open with the reader's concrete problem.",
      sections,
      closing_strategy: "Close with one proportionate next action.",
      unresolved_questions: [],
      confirmation_required: true
    },
    warnings: [],
    blocked_reasons: []
  };
}

export function contractExample(name, context = {}) {
  const contract = canonicalContractName(name);
  if (["DiagnosticTurnResult@2.0","DiagnosticTurnResult@3.0"].includes(contract)) return { intent: "direct_answer", intentConfidence: 0.95, coreClaimOperations: [], discoveredFactOperations: [], answerAssessment: { status: "answered", answeredFieldPaths: [], remainingGaps: [] }, targetAssessment:{ targetType:"core_field",targetId:"",capturedSlots:[],missingRequiredSlots:[],missingOptionalSlots:[],status:"partial",strategyReady:false,contentReady:false,followUpNeeded:true,followUpQuestion:"" }, acknowledgement: "", conflicts: [] };
  if (contract === "DiagnosticAssistanceResult@2.0") return { assistantMessage: "", assistanceType: "clarification", checklist: [], examples: [], recommendation: null };
  if (contract === "ConsultativeReply@2.0") return { assistantMessage: "" };
  if (contract === "StrategyDraftResult@2.0") return { business: {}, audiences: [], accountStrategy: {}, knowledgeScope: {}, hypotheses: [], missingInformation: [] };
  if (contract === "StrategySynthesisResult@2.0") return { schemaVersion: "2.0", accountId: "", business: { businessModel: "", valueProposition: "", offers: [] }, strategy: { diagnosis: {}, growthStage: "exploration", operatingMode: "guided", objectives: [], primaryObjectiveId: "", positioning: {}, audiences: [], messageArchitecture: {}, contentSystem: { pillars: [], portfolio: { discovery: 15, authority: 35, proof: 20, solution: 20, action: 10 } }, platformPlaybooks: { xiaohongshu: {}, wechat: {} }, conversionSystem: {}, evidencePolicy: {}, riskPolicy: {} }, governance: { confirmedClaimIds: [], strategyFactIds: [], knowledgeSourceIds: [], hypotheses: [], conflicts: [], missingInformation: [], sourceContextHash: "" } };
  if (contract === "RecommendationBundle@2.0") return { targetFieldPath: "", recommendedOptionId: "option_1", options: [{ optionId: "option_1", label: "推荐方案", summary: "", completeValue: {}, rationale: [], assumptions: [], completeness: "complete" }] };
  if (contract === "RecommendationRevision@1.0") return { revisedValue:{},display:{title:"调整后的方案",summary:"",steps:[],advantages:[],attention:[]},assistantMessage:"" };
  if (contract === "PostCompletionTurnResult@1.0") return { intent: "add_dynamic_fact", targetFieldPath: null, claimOperations: [], factOperations: [], requiresConfirmation: false };
  if (contract === "StrategyPatch@1.0") return { affectedFields: [], claimOperations: [], factOperations: [], requiresDraftRegeneration: false, affectedDownstream: [] };
  if (contract === "DocumentDiagnosticExtraction@1.0") return { summary: "", candidateClaims: [{ targetFieldPath: "business.primaryOffers", value: [], confidence: 0.8, evidence: [] }] };
  if (contract === "ContentMaster@2.0") return { status: "success", data: { content_master_id: "CM001", confirmed_facts: [{ fact_id: "F001", fact: "Verified fact supported by the cited source.", source_ids: ["SRC001"] }], supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "SRC001" }], semanticUnitIds: ["unit-id"] }, warnings: [], blocked_reasons: [] };
  if (contract === "ContentOutline@1.0") return contentOutlineExample(context);
  if (contract === "XhsPostCopyCreativeOutput@1.0") return { status: "success", data: { schemaVersion: "1.0", contract, contentPromise: "用同一个内容母版完成双平台原子交付。", engagementStrategy: { mode: "auto", primaryAction: "save", reason: "便于团队复用。", ctaPlacement: "ending", ctaText: "保存这份流程。" }, titleCandidates: [{ title: "双平台原子内容流程", hookType: "result", claimIds: [], risk: "low" }, { title: "内容流程总卡住？", hookType: "problem", claimIds: [], risk: "low" }, { title: "一份原子内容清单", hookType: "checklist", claimIds: [], risk: "low" }], recommendedTitle: "双平台原子内容流程", opening: "先确认唯一内容母版。", bodySections: [{ sectionId: "S1", outlineRole: "hook", role: "scene", text: "从共同问题开始。", claimIds: [], knowledgeAssetIds: [] }], ending: "确认后再生成不可变提交。", pinnedComment: "", hashtags: ["内容工作流", "双平台内容", "原子编排"], cta: "保存这份流程。", promotionUse: { mode: "none", itemIds: [], disclosure: "" } }, warnings: [], blocked_reasons: [] };
  if (contract === "PlatformTitleList@1.0") return { status: "success", data: { stage: "final_after_body", platform: context.platform === "wechat" ? "wechat_official_account" : "xiaohongshu", title_brief: { content_type: "guide", target_reader: "内容运营者", core_conclusion: "同一母版分别适配平台", reader_takeaway: "获得可复用流程", strongest_evidence: [], real_entities: [], freshness_dependency: "none" }, candidates: ["balanced", "safe", "spread", "search", "evergreen"].map((motivation, index) => ({ title_id: `T${index + 1}`, title: `双平台原子内容流程${index + 1}`, motivation, method: motivation, claim_ids: [], scores: { fulfillment: 5, relevance: 5, specificity: 4, curiosity: 3, clarity: 5, uniqueness: 4, overall: 5 }, risk: "low", risk_reasons: [] })), recommendations: { balanced: "T1", safe: "T2", spread: "T3", search: "T4", experiment: "T5" }, ab_tests: [{ title_a: "T1", title_b: "T5", single_variable: "表达动机", hypothesis: "清晰度更高的标题表现更稳健" }], same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" } }, warnings: [], blocked_reasons: [] };
  if (contract === "XhsCarouselPlanCreativeOutput@1.0") return {
    status: "success",
    data: {
      schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", reading_arc: "承诺到行动",
      section_drafts: Array.from({ length: 6 }, (_, index) => ({
        objective: `页面目标${index + 1}`, takeaway: `独立结论${index + 1}`,
        text_layers: [{ type: "headline", text: index === 0 ? "与最终标题逐字一致" : `页面文案${index + 1}`, max_lines: 2, priority: 1 }],
        layout_hint: `布局提示${index + 1}`, fact_ids: [], interpretation_ids: [], knowledge_asset_ids: []
      }))
    },
    warnings: [], blocked_reasons: []
  };
  if (contract === "XhsVisualAssetPlanCreativeOutput@1.0") return { status: "success", data: { schemaVersion: "1.0", contract, pageVisuals: [{ page: 1, visualFunction: "explain", visualNeed: "用稳定信息层级解释页面内容", renderStrategy: "html_css", mustKeep: [], mustAvoid: [] }], imageSpecs: [], skippedPages: [{ page: 1, reason: "html_css" }], pageAssetBindings: [{ page: 1, plannedAssetIds: [] }] }, warnings: [], blocked_reasons: [] };
  if (contract === "WechatArticle@2.0") { const section = "本节说明同一内容母版如何在确认后分别适配两个平台，并保留清晰的权威引用、用户审阅节点与不可变版本。执行时先冻结输入，再依据平台目标组织表达，最后进行事实、结构和引用检查。这样可以避免一个平台版本成为另一个平台的唯一母版，也能减少临时脚本和人工补丁。"; return { status: "success", data: { article_promise: "建立一条可重复的双平台内容流程", core_argument: "统一母版与平台适配必须分离", information_gain: "给出权威输入、平台适配和版本确认之间的完整关系", title_candidates: ["统一母版如何支撑双平台内容", "双平台内容为何需要原子流程", "从确认到交付的内容工作流"], recommended_title: "统一母版如何支撑双平台内容", abstract: "介绍可重复的双平台内容工作流。", opening: "先冻结共同事实，再分别完成平台表达。", outline: [{ heading: "冻结共同上游" }, { heading: "分别完成平台适配" }, { heading: "确认并登记版本" }], article_markdown: `## 冻结共同上游\n\n${section.repeat(2)}\n\n## 分别完成平台适配\n\n${section.repeat(2)}\n\n## 确认并登记版本\n\n${section.repeat(2)}`, pull_quotes: [], key_takeaways: ["统一上游", "平台独立适配", "版本不可变"], share_summary: "一条可重复的双平台内容流程。", share_reason: "帮助团队减少返工。", engagement_strategy: { primary_action: "share", reason: "便于团队协同" }, cta: "分享给内容协作者", claim_map: [], used_knowledge_asset_ids: [], image_plan: { cover: { purpose: "pace", strategy: "no_image" }, slots: [{ purpose: "pace", strategy: "no_image" }] } } }; }
  if (contract === "WechatArticleReview@1.0") return { status: "success", data: { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] }, warnings: [], blocked_reasons: [] };
  if (contract === "WechatImagePlan@1.0") return { status: "success", data: { plan_id: "WIP001", cover: { purpose: "pace", strategy: "no_image", asset_id: null, claim_ids: [], image_spec: null }, slots: [] }, warnings: [], blocked_reasons: [] };
  if (contract === "WechatArticleBodyRecovery@1.0") return { schemaVersion: "1.0", binding: { contentRunId: "", strategySnapshotId: "", confirmedOutlineId: "", inputSummaryHash: "" }, confirmed_outline_id: "", article_markdown: "", claim_map: [], used_source_ids: [] };
  if (contract === "WechatArticleMetadataRecovery@1.0") return { schemaVersion: "1.0", binding: { contentRunId: "", strategySnapshotId: "", confirmedOutlineId: "", inputSummaryHash: "" }, article_promise: "", core_argument: "", information_gain: "", title_candidates: ["", "", ""], recommended_title: "", abstract: "", opening: "", outline: [{ heading: "" }, { heading: "" }, { heading: "" }], pull_quotes: [], key_takeaways: [], share_summary: "", share_reason: "", engagement_strategy: { primary_action: "share", reason: "" }, cta: "", used_knowledge_asset_ids: [], image_plan: { cover: {}, slots: [{}] } };
  return {};
}
