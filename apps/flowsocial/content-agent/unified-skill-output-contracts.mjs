import { createUnifiedWriterContext, hashUnifiedContent } from "./unified-content-contracts.mjs";
import { adaptAuthoritativeWechatImagePlanOutput, hashWechatArtifactValue } from "./wechat-image-plan-adapter.mjs";

const PLATFORM_OUTPUT_NAMES = Object.freeze({
  xiaohongshu: "xiaohongshu",
  wechat: "wechat_official_account"
});

const trustedMaterializedContentMasters = new WeakSet();

function markTrustedMaterializedContentMaster(value) {
  trustedMaterializedContentMasters.add(value);
  return value;
}

export const SAFE_UNIFIED_SKILL_VALIDATION_FIELD_PATHS = Object.freeze([
  "outputContract", "status", "data", "warnings", "blocked_reasons", "data.contract", "data.schemaVersion",
  "data.content_master_id", "data.confirmed_facts", "data.confirmed_facts[].fact_id",
  "data.supported_interpretations", "data.author_opinions", "data.source_list",
  "data.structureIntent", "data.structureIntent.structureType", "data.structureIntent.requiredUnits",
  "data.structureIntent.optionalUnits", "data.structureIntent.orderingPolicy", "data.structureIntent.intentHash",
  "data.semanticUnitIds", "data.semanticSpine", "data.semanticSpine.units", "data.semanticSpine.spineHash", "data.contentMasterHash",
  "data.outline_id", "data.schema_version", "data.platform", "data.topic", "data.content_promise",
  "data.content_function", "data.content_purpose_id", "data.conversion_stage_id", "data.opening_strategy",
  "data.sections", "data.sections[].section_id", "data.sections[].heading", "data.sections[].role",
  "data.sections[].objective", "data.sections[].key_points", "data.sections[].claim_ids",
  "data.sections[].boundary", "data.sections[].masterUnitIds", "data.sections[].masterUnitRefs", "data.sections[].adaptationType",
  "data.sections[].sequencePlacement", "data.sections[].sequencePlacement.kind", "data.sections[].sequencePlacement.slotIds",
  "data.sections[].sequencePlacement.anchorId",
  "data.contentMasterRef", "data.semanticSpineRef", "data.closing_strategy", "data.unresolved_questions", "data.confirmation_required",
  "data.topic_id", "data.intent_profile_id", "data.account_context", "data.account_context.subject_type",
  "data.account_context.account_mode", "data.account_context.matrix_role", "data.account_context.trust_source",
  "data.creative_mechanism", "data.journey_stage", "data.matrix_coordination",
  "data.matrix_coordination.shared_campaign_topic_id", "data.matrix_coordination.differentiation_angle",
  "data.matrix_coordination.prohibited_overlap", "data.engagement_strategy",
  "data.engagement_strategy.mode", "data.engagement_strategy.primary_action", "data.engagement_strategy.reason",
  "data.engagement_strategy.cta_placement", "data.engagement_strategy.cta_text", "data.post_copy",
  "data.post_copy.title_candidates", "data.post_copy.title_candidates[]", "data.post_copy.title_candidates[].claim_ids", "data.post_copy.recommended_title",
  "data.post_copy.opening", "data.post_copy.body_sections", "data.post_copy.body_sections[]",
  "data.post_copy.body_sections[].section_id", "data.post_copy.body_sections[].role",
  "data.post_copy.body_sections[].text", "data.post_copy.body_sections[].claim_ids", "data.post_copy.body_sections[].knowledge_asset_ids",
  "data.post_copy.ending", "data.post_copy.pinned_comment", "data.post_copy.hashtags", "data.post_copy.cta",
  "data.deck", "data.deck.deck_id", "data.deck.canvas", "data.deck.design_dna_version",
  "data.deck.reading_arc", "data.deck.pages", "data.deck.pages[]", "data.deck.pages[].page",
  "data.deck.pages[].role", "data.deck.pages[].objective", "data.deck.pages[].takeaway",
  "data.deck.pages[].layout_hint", "data.deck.pages[].visual_function", "data.deck.pages[].visual_need",
  "data.deck.pages[].render_strategy", "data.deck.pages[].must_avoid",
  "data.deck.pages[].text_layers", "data.deck.pages[].asset_ids", "data.deck.pages[].fact_ids",
  "data.deck.pages[].interpretation_ids", "data.image_specs", "data.image_specs[]",
  "data.image_specs[].page", "data.image_specs[].asset_id", "data.skipped_image_pages",
  "data.skipped_image_pages[]", "data.traceability", "data.traceability.used_fact_ids",
  "data.traceability.used_interpretation_ids", "data.traceability.used_knowledge_asset_ids",
  "data.traceability.page_claim_map", "data.traceability.page_claim_map[]", "data.preflight_checks",
  "data.preflight_checks[]", "data.promise_consistency", "data.reference_integrity", "data.image_spec_alignment",
  "data.image_spec_alignment.spec_count", "data.image_spec_alignment.spec_page_uniqueness",
  "data.image_spec_alignment.generated_page_coverage", "data.image_spec_alignment.page_asset_binding",
  "data.image_spec_alignment.single_asset_per_generated_page", "data.image_spec_alignment.design_dna_version",
  "data.preflight_checks.promise_consistency", "data.preflight_checks.claim_traceability",
  "data.preflight_checks.image_text_separation", "data.preflight_checks.page_non_repetition",
  "data.preflight_checks.intent_and_promotion_alignment", "data.preflight_checks.account_identity_alignment",
  "data.preflight_checks.matrix_differentiation",
  "data.stage", "data.title_brief", "data.title_brief.content_type", "data.title_brief.target_reader",
  "data.title_brief.core_conclusion", "data.title_brief.reader_takeaway", "data.title_brief.strongest_evidence",
  "data.title_brief.real_entities", "data.title_brief.freshness_dependency", "data.candidates", "data.candidates[]",
  "data.candidates[].title_id", "data.candidates[].title", "data.candidates[].motivation", "data.candidates[].method",
  "data.candidates[].claim_ids", "data.candidates[].scores", "data.candidates[].scores.fulfillment",
  "data.candidates[].scores.relevance", "data.candidates[].scores.specificity", "data.candidates[].scores.curiosity",
  "data.candidates[].scores.clarity", "data.candidates[].scores.uniqueness", "data.candidates[].scores.overall",
  "data.candidates[].risk", "data.candidates[].risk_reasons", "data.recommendations", "data.recommendations.balanced",
  "data.recommendations.safe", "data.recommendations.spread", "data.recommendations.search", "data.recommendations.experiment",
  "data.ab_tests", "data.ab_tests[].title_a", "data.ab_tests[].title_b", "data.ab_tests[].single_variable",
  "data.ab_tests[].hypothesis", "data.same_account_signal_usage", "data.same_account_signal_usage.used",
  "data.same_account_signal_usage.signal_ids", "data.same_account_signal_usage.interpretation",
  "input", "input.stage", "input.platform", "input.content_master", "input.completed_content",
  "input.preliminary_titles", "input.content_task_brief", "input.same_account_title_signals",
  "input.platform_brief", "input.strict_sequence_contract", "input.strict_sequence_contract.slots",
  "input.strict_sequence_contract.supplementalAnchors", "input.confirmed_outline", "input.mode", "input.article", "input.article_review",
  "input.writer_context", "input.writer_context.writerContextHash", "input.writer_context.authority_refs",
  "input.writer_context.authority_refs[]",
  "data.article_promise", "data.core_argument", "data.information_gain", "data.title_candidates",
  "data.title_candidates[]", "data.recommended_title", "data.abstract", "data.opening", "data.outline",
  "data.outline[]", "data.article_markdown", "data.pull_quotes", "data.pull_quotes[]", "data.key_takeaways",
  "data.share_summary", "data.share_reason", "data.discovery_plan", "data.relationship_handoff",
  "data.cta", "data.claim_map", "data.claim_map[]", "data.used_knowledge_asset_ids", "data.source_list",
  "data.publish_time_checks", "data.writer_reference_integrity", "data.article_structure_consistency",
  "data.preflight_checks[].check", "data.preflight_checks.title_body_alignment", "data.preflight_checks.title_body_alignment.result",
  "data.preflight_checks.argument_continuity", "data.preflight_checks.argument_continuity.result",
  "data.preflight_checks.claim_traceability.result", "data.preflight_checks.marketing_disclosure", "data.preflight_checks.marketing_disclosure.result",
  "data.preflight_checks.intent_and_promotion_alignment.result", "data.preflight_checks.account_identity_alignment.result",
  "data.preflight_checks.relationship_handoff_validity", "data.preflight_checks.relationship_handoff_validity.result",
  "data.preflight_checks.matrix_differentiation.result",
  "data.decision", "data.findings", "data.findings[]", "data.patches", "data.patches[]", "data.changes",
  "data.fact_recheck_required", "data.review_reference_integrity", "data.review_readiness"
  , "system.authority", "data.deck.pages.length", "data.deck.pages[].text_layers[]",
  "data.deck.pages[].knowledge_asset_ids", "data.image_specs[].reference_asset_ids",
  "data.page_visuals", "data.page_visuals[].must_keep", "data.page_visuals[].must_avoid",
  "data.page_asset_bindings", "data.page_asset_bindings[].planned_asset_ids",
  "input.authorityBinding", "input.postCopyRef", "input.finalTitleBindingRef",
  "input.pages[0].textLayers.headline", "system.authorityBinding", "system.postCopy",
  "system.finalTitleContext.binding", "data.pages[].text_layers",
  "data.section_drafts", "data.section_drafts.length", "data.section_drafts[]",
  "data.section_drafts[].section_id", "data.section_drafts[].outline_role",
  "data.section_drafts[].text", "data.section_drafts[].key_points",
  "data.section_drafts[].claim_ids", "data.section_drafts[].visual_direction"
]);
const SAFE_VALIDATION_FIELD_PATH_SET = new Set(SAFE_UNIFIED_SKILL_VALIDATION_FIELD_PATHS);

export const EXPLICITLY_REJECTED_XHS_ATOMIC_RUNTIME_FIELD_PATHS = Object.freeze(["capability"]);

const XHS_ATOMIC_OUTPUT_PATH_ALIASES = Object.freeze({
  bodySections: "post_copy.body_sections", "bodySections[].claimIds": "post_copy.body_sections[].claim_ids",
  "bodySections[].knowledgeAssetIds": "post_copy.body_sections[].knowledge_asset_ids",
  claimIds: "traceability.used_fact_ids", fact_ids: "traceability.used_fact_ids",
  interpretation_ids: "traceability.used_interpretation_ids", knowledge_asset_ids: "traceability.used_knowledge_asset_ids",
  knowledgeAssetIds: "traceability.used_knowledge_asset_ids",
  engagementStrategy: "engagement_strategy", imageSpecs: "image_specs",
  "imageSpecs[].referenceAssetIds": "image_specs[].reference_asset_ids",
  pageAssetBindings: "page_asset_bindings", "pageAssetBindings[].plannedAssetIds": "page_asset_bindings[].planned_asset_ids",
  pageVisuals: "page_visuals", "pageVisuals[].mustAvoid": "page_visuals[].must_avoid", "pageVisuals[].mustKeep": "page_visuals[].must_keep",
  promotionUse: "post_copy", "promotionUse.itemIds": "post_copy", skippedPages: "skipped_image_pages",
  titleCandidates: "post_copy.title_candidates", "titleCandidates[].claimIds": "post_copy.title_candidates[].claim_ids"
});

function normalizeSafeAtomicValidationFieldPath(path) {
  if (EXPLICITLY_REJECTED_XHS_ATOMIC_RUNTIME_FIELD_PATHS.includes(path)) return null;
  if (path === "$") return "data";
  if (typeof path === "string" && (path === "system" || path.startsWith("system."))) return "system.authority";
  if (typeof path !== "string" || !path.startsWith("$.")) return path;
  const normalizedJsonPath = path.slice(2).replace(/\[\d+\]/g, "[]");
  if (SAFE_VALIDATION_FIELD_PATH_SET.has(normalizedJsonPath)) return normalizedJsonPath;
  if (normalizedJsonPath === "data.pages" || normalizedJsonPath === "data.pages.length" || normalizedJsonPath === "data.pages[]" || normalizedJsonPath.startsWith("data.pages[].")) {
    const materializedPath = `data.deck.pages${normalizedJsonPath.slice("data.pages".length)}`;
    if (SAFE_VALIDATION_FIELD_PATH_SET.has(materializedPath)) return materializedPath;
  }
  if (normalizedJsonPath.startsWith("data.")) {
    const alias = XHS_ATOMIC_OUTPUT_PATH_ALIASES[normalizedJsonPath.slice(5)];
    if (alias && SAFE_VALIDATION_FIELD_PATH_SET.has(`data.${alias}`)) return `data.${alias}`;
  }
  return null;
}

export function sanitizeUnifiedSkillValidationFieldPaths(fieldPaths) {
  return Array.isArray(fieldPaths)
    ? [...new Set(fieldPaths
      .map(normalizeSafeAtomicValidationFieldPath)
      .filter((path) => SAFE_VALIDATION_FIELD_PATH_SET.has(path)))]
    : [];
}

const SAFE_RECOVERY_STAGES = new Set(["master", "outline", "writer", "review_render"]);
const SAFE_RECOVERY_PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const SAFE_RECOVERY_IDENTIFIER = /^[a-z0-9][a-z0-9_:-]{0,79}$/;
const SAFE_RECOVERY_CAPABILITY = /^[a-z0-9][a-z0-9_:-]{0,79}$/;
const SAFE_RECOVERY_CAUSE_CODE = /^[A-Z][A-Z0-9_:-]{0,79}$/;

export function sanitizeUnifiedOrchestrationCauseCode(value) {
  return typeof value === "string" && SAFE_RECOVERY_CAUSE_CODE.test(value)
    ? value
    : "DEPENDENCY_FAILED";
}

function safeRecoveryIdentifier(value, allowedValues = null) {
  if (typeof value !== "string" || !SAFE_RECOVERY_IDENTIFIER.test(value)) return null;
  return !allowedValues || allowedValues.has(value) ? value : null;
}

export function projectUnifiedOrchestrationRecovery(error) {
  if (error?.name !== "UnifiedOrchestrationStageError" || error?.recoverable !== true) return null;
  const stage = safeRecoveryIdentifier(error.stage, SAFE_RECOVERY_STAGES);
  if (!stage) return null;
  return {
    stage,
    platform: error.platform == null ? null : safeRecoveryIdentifier(error.platform, SAFE_RECOVERY_PLATFORMS),
    stepId: safeRecoveryIdentifier(error.stepId),
    capability: typeof error.capability === "string" && SAFE_RECOVERY_CAPABILITY.test(error.capability) ? error.capability : null,
    recoverableFrom: safeRecoveryIdentifier(error.recoverableFrom) || stage,
    causeCode: sanitizeUnifiedOrchestrationCauseCode(error.causeCode),
    fieldPaths: sanitizeUnifiedSkillValidationFieldPaths(error.fieldPaths)
  };
}

export function projectUnifiedStagedBootstrapError(error, fallbackCode) {
  const recovery = projectUnifiedOrchestrationRecovery(error);
  if (recovery) {
    return {
      error: "Unified content planning stage failed",
      code: "UNIFIED_ORCHESTRATION_STAGE_FAILED",
      recovery
    };
  }
  return {
    error: error?.message,
    code: error?.code || fallbackCode,
    details: error?.details || null
  };
}

function fail(capability, fieldPaths, message = "Skill output does not satisfy its declared domain contract") {
  throw Object.assign(new Error(message), {
    code: "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID",
    statusCode: 409,
    details: { capability, fieldPaths: [...new Set(fieldPaths)] }
  });
}

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value) {
  return typeof value === "string" && Boolean(value.trim());
}

const CONTENT_OUTLINE_ENVELOPE_OR_WRAPPER_KEYS = [
  "status",
  "data",
  "warnings",
  "blocked_reasons",
  "result",
  "response",
  "output"
];

function isBareContentOutlineRuntimeOutput(value) {
  return object(value)
    && CONTENT_OUTLINE_ENVELOPE_OR_WRAPPER_KEYS.every((key) => !Object.hasOwn(value, key))
    && text(value.outline_id)
    && text(value.schema_version)
    && text(value.platform)
    && Array.isArray(value.sections)
    && typeof value.confirmation_required === "boolean";
}

function string(value) {
  return typeof value === "string";
}

function ref(id, hash) {
  return { id, hash };
}

function requireFields(capability, tests) {
  const missing = tests.filter(([, passed]) => !passed).map(([path]) => path);
  if (missing.length) fail(capability, missing);
}

const HASH = /^[a-f0-9]{64}$/;
const ADAPTATION_TYPES = new Set(["direct", "split", "merge", "supplemental"]);
const STRICT_SEQUENCE_CONTRACT = "OutlineStrictSequenceSlots@1.0";

function sameValue(left, right) {
  return hashUnifiedContent(left) === hashUnifiedContent(right);
}

function semanticFail(fieldPaths, message, causeCode = null) {
  throw Object.assign(new Error(message), {
    code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID",
    statusCode: 409,
    ...(causeCode ? { causeCode } : {}),
    details: { fieldPaths: [...new Set(fieldPaths)] }
  });
}

function hashWithout(value, field) {
  const base = structuredClone(value);
  delete base[field];
  return hashUnifiedContent(base);
}

function contentMasterSemanticHash(value) {
  const base = structuredClone(value);
  delete base.contentMasterHash;
  delete base.platform;
  if (base.contract === "ContentMaster@3.0" && base.id === base.content_master_id) {
    delete base.schemaVersion;
    delete base.contract;
    delete base.id;
  }
  return hashUnifiedContent(base);
}

function validateStructureUnit(unit, required, expectedOrder) {
  if (!exactKeys(unit, ["id", "meaning", "boundary"]) || !text(unit.id) || !text(unit.meaning) || !text(unit.boundary)) {
    semanticFail(
      [required ? "data.structureIntent.requiredUnits" : "data.structureIntent.optionalUnits"],
      "Structure units require stable id, meaning, and boundary",
      required ? "CONTENT_MASTER_REQUIRED_UNIT_INVALID" : "CONTENT_MASTER_OPTIONAL_UNIT_INVALID"
    );
  }
  return { ...structuredClone(unit), required, order: expectedOrder };
}

export function validateContentStructureIntent(value) {
  if (!object(value) || !text(value.id) || !text(value.structureType)
    || !Array.isArray(value.requiredUnits) || value.requiredUnits.length === 0
    || !Array.isArray(value.optionalUnits) || !exactKeys(value.orderingPolicy, ["mode", "unitOrder"])
    || !["strict", "flexible"].includes(value.orderingPolicy.mode) || !Array.isArray(value.orderingPolicy.unitOrder)
    || !HASH.test(value.intentHash || "")) {
    semanticFail(["data.structureIntent"], "Structure intent contract is incomplete", "CONTENT_MASTER_STRUCTURE_INTENT_INVALID");
  }
  const declared = [...value.requiredUnits, ...value.optionalUnits];
  const ids = declared.map((item) => item?.id);
  if (ids.some((id) => !text(id)) || new Set(ids).size !== ids.length
    || value.orderingPolicy.unitOrder.length !== ids.length
    || new Set(value.orderingPolicy.unitOrder).size !== ids.length
    || value.orderingPolicy.unitOrder.some((id) => !ids.includes(id))) {
    semanticFail(["data.structureIntent.orderingPolicy"], "Ordering policy must name every declared unit exactly once", "CONTENT_MASTER_ORDERING_POLICY_INVALID");
  }
  value.requiredUnits.forEach((unit) => validateStructureUnit(unit, true, value.orderingPolicy.unitOrder.indexOf(unit.id)));
  value.optionalUnits.forEach((unit) => validateStructureUnit(unit, false, value.orderingPolicy.unitOrder.indexOf(unit.id)));
  if (hashWithout(value, "intentHash") !== value.intentHash) {
    semanticFail(["data.structureIntent.intentHash"], "Structure intent hash is stale", "CONTENT_MASTER_INTENT_HASH_STALE");
  }
  return structuredClone(value);
}

function canonicalIntentUnits(intent) {
  const byId = new Map([
    ...intent.requiredUnits.map((unit) => [unit.id, validateStructureUnit(unit, true, intent.orderingPolicy.unitOrder.indexOf(unit.id))]),
    ...intent.optionalUnits.map((unit) => [unit.id, validateStructureUnit(unit, false, intent.orderingPolicy.unitOrder.indexOf(unit.id))])
  ]);
  return intent.orderingPolicy.unitOrder.map((id) => byId.get(id));
}

function buildCanonicalSemanticSpine(intent, contentMasterId) {
  const units = canonicalIntentUnits(intent).map((unit) => {
    const base = { id: unit.id, meaning: unit.meaning, required: unit.required, order: unit.order, boundary: unit.boundary };
    return { ...base, unitHash: hashUnifiedContent(base) };
  });
  const base = {
    id: `semantic-spine:${contentMasterId}`,
    structureIntentRef: { id: intent.id, hash: intent.intentHash },
    structureType: intent.structureType,
    orderingPolicy: structuredClone(intent.orderingPolicy),
    units
  };
  return { ...base, spineHash: hashUnifiedContent(base) };
}

function assertMaterializableTopLevelAuthorityRef(candidate, fieldPath) {
  if (candidate === undefined) return;
  const validShape = exactKeys(candidate, ["id"]) || exactKeys(candidate, ["id", "hash"]);
  if (!validShape) {
    semanticFail([fieldPath], "Provider authority ref conflicts with trusted materialization");
  }
}

function assertMaterializableUnitRef(candidate, expected, fieldPath) {
  const validShape = exactKeys(candidate, ["id"]) || exactKeys(candidate, ["id", "hash"]);
  if (!validShape || candidate.id !== expected.id) {
    semanticFail([fieldPath], "Provider unit ref conflicts with trusted materialization", "OUTLINE_MASTER_UNIT_REF_CONFLICT");
  }
}

export function createContentOutlineStrictSequenceContract(sourceContentMaster) {
  if (!sourceContentMaster?.semanticSpine) return null;
  const master = validateContentMasterSemanticSpine(sourceContentMaster);
  if (master.semanticSpine.orderingPolicy.mode !== "strict") return null;
  const slots = master.semanticSpine.units.map((unit, order) => ({
    slotId: `core-slot:${order + 1}`,
    order,
    masterUnitRef: { id: unit.id, hash: unit.unitHash }
  }));
  const supplementalAnchors = Array.from({ length: slots.length + 1 }, (_, position) => ({
    anchorId: `supplemental-anchor:${position}`,
    position,
    afterSlotId: position === 0 ? null : slots[position - 1].slotId,
    beforeSlotId: position === slots.length ? null : slots[position].slotId
  }));
  const base = {
    schemaVersion: "1.0",
    contract: STRICT_SEQUENCE_CONTRACT,
    semanticSpineRef: { id: master.semanticSpine.id, hash: master.semanticSpine.spineHash },
    slots,
    supplementalAnchors
  };
  return { ...base, contractHash: hashUnifiedContent(base) };
}

function validateStrictSequenceContract(candidate, master) {
  const expected = createContentOutlineStrictSequenceContract(master);
  if (!expected || !sameValue(candidate, expected)) {
    semanticFail(["input.strict_sequence_contract"], "Strict outline sequence contract differs from trusted runtime authority", "OUTLINE_SEQUENCE_CONTRACT_INVALID");
  }
  return expected;
}

function validateStrictSectionPlacements(sections, sequenceContract) {
  const slots = new Map(sequenceContract.slots.map((slot) => [slot.slotId, slot]));
  const anchors = new Map(sequenceContract.supplementalAnchors.map((anchor) => [anchor.anchorId, anchor]));
  let priorSequencePosition = -1;
  let priorCoreEndOrder = -1;
  return sections.map((section) => {
    const placement = section?.sequencePlacement;
    if (!object(placement) || !text(placement.kind)) {
      semanticFail(["data.sections[].sequencePlacement"], "Strict outline sections require an issued sequence placement", "OUTLINE_SEQUENCE_PLACEMENT_MISSING");
    }
    let sequencePosition;
    let expectedUnitIds;
    if (placement.kind === "core") {
      if (!exactKeys(placement, ["kind", "slotIds"]) || !Array.isArray(placement.slotIds) || placement.slotIds.length === 0
        || placement.slotIds.some((slotId) => !text(slotId))) {
        semanticFail(["data.sections[].sequencePlacement"], "Core sequence placement must declare issued slot ids", "OUTLINE_SEQUENCE_PLACEMENT_INVALID");
      }
      if (new Set(placement.slotIds).size !== placement.slotIds.length) {
        semanticFail(["data.sections[].sequencePlacement.slotIds"], "Core sequence placement repeats a slot", "OUTLINE_SEQUENCE_SLOT_DUPLICATE");
      }
      const resolvedSlots = placement.slotIds.map((slotId) => {
        const slot = slots.get(slotId);
        if (slot) return slot;
        const ordinal = /^core-slot:(\d+)$/.exec(slotId)?.[1];
        semanticFail(
          ["data.sections[].sequencePlacement.slotIds"],
          "Core sequence placement references a slot outside trusted authority",
          ordinal ? "OUTLINE_SEQUENCE_SLOT_OUT_OF_RANGE" : "OUTLINE_SEQUENCE_SLOT_UNKNOWN"
        );
      });
      if (resolvedSlots.some((slot, index) => index > 0 && slot.order !== resolvedSlots[index - 1].order + 1)) {
        semanticFail(["data.sections[].sequencePlacement.slotIds"], "Merge groups must consume one contiguous issued slot range", "OUTLINE_SEQUENCE_GROUP_NON_CONTIGUOUS");
      }
      expectedUnitIds = resolvedSlots.map((slot) => slot.masterUnitRef.id);
      if (Object.hasOwn(section, "masterUnitIds") && !sameValue(section.masterUnitIds, expectedUnitIds)) {
        semanticFail(["data.sections[].sequencePlacement", "data.sections[].masterUnitIds"], "Sequence placement conflicts with declared master unit ids", "OUTLINE_SEQUENCE_UNIT_MAPPING_CONFLICT");
      }
      sequencePosition = resolvedSlots[0].order * 2 + 1;
      const coreEndOrder = resolvedSlots[resolvedSlots.length - 1].order;
      if (resolvedSlots[0].order < priorCoreEndOrder) {
        semanticFail(["data.sections[].sequencePlacement"], "Core sequence fills overlap a previously consumed merge range", "OUTLINE_SEQUENCE_PLACEMENT_ORDER_INVALID");
      }
      priorCoreEndOrder = Math.max(priorCoreEndOrder, coreEndOrder);
    } else if (placement.kind === "supplemental") {
      if (!exactKeys(placement, ["kind", "anchorId"]) || !text(placement.anchorId)) {
        semanticFail(["data.sections[].sequencePlacement"], "Supplemental sequence placement must declare one issued anchor", "OUTLINE_SEQUENCE_PLACEMENT_INVALID");
      }
      const anchor = anchors.get(placement.anchorId);
      if (!anchor) {
        semanticFail(["data.sections[].sequencePlacement.anchorId"], "Supplemental sequence placement references an unknown anchor", "OUTLINE_SEQUENCE_ANCHOR_UNKNOWN");
      }
      if (Object.hasOwn(section, "masterUnitIds") && !sameValue(section.masterUnitIds, [])) {
        semanticFail(["data.sections[].sequencePlacement", "data.sections[].masterUnitIds"], "Supplemental anchors cannot consume master units", "OUTLINE_SEQUENCE_UNIT_MAPPING_CONFLICT");
      }
      expectedUnitIds = [];
      sequencePosition = anchor.position * 2;
      if (anchor.position <= priorCoreEndOrder) {
        semanticFail(["data.sections[].sequencePlacement"], "Supplemental anchor cannot split a consumed core merge range", "OUTLINE_SEQUENCE_PLACEMENT_ORDER_INVALID");
      }
    } else {
      semanticFail(["data.sections[].sequencePlacement.kind"], "Sequence placement kind is not issued by trusted runtime", "OUTLINE_SEQUENCE_PLACEMENT_INVALID");
    }
    if (sequencePosition < priorSequencePosition) {
      semanticFail(["data.sections[].sequencePlacement"], "Provider section fills are not in issued sequence order", "OUTLINE_SEQUENCE_PLACEMENT_ORDER_INVALID");
    }
    priorSequencePosition = sequencePosition;
    return expectedUnitIds;
  });
}

export function materializeContentMasterSemanticAuthority(value, frozenIntent) {
  const intent = validateContentStructureIntent(frozenIntent);
  if (!object(value) || !text(value.content_master_id)) {
    semanticFail(["data.content_master_id"], "ContentMaster id is required before semantic materialization", "CONTENT_MASTER_ID_INVALID");
  }
  const expectedUnitIds = intent.orderingPolicy.unitOrder;
  if (value.semanticUnitIds == null) {
    if (trustedMaterializedContentMasters.has(value)) {
      return markTrustedMaterializedContentMaster(validateContentMasterSemanticSpine(value, intent));
    }
    semanticFail(["data.semanticUnitIds"], "Provider semantic unit ids are required with frozen structure authority", "CONTENT_MASTER_SEMANTIC_UNIT_IDS_REQUIRED");
  }
  if (!Array.isArray(value.semanticUnitIds) || value.semanticUnitIds.some((id) => !text(id))) {
    semanticFail(["data.semanticUnitIds"], "Provider semantic unit ids must be an ordered string array", "CONTENT_MASTER_SEMANTIC_UNIT_IDS_INVALID");
  }
  if (new Set(value.semanticUnitIds).size !== value.semanticUnitIds.length) {
    semanticFail(["data.semanticUnitIds"], "Provider semantic unit ids cannot repeat", "CONTENT_MASTER_SEMANTIC_UNIT_IDS_DUPLICATE");
  }
  if (value.semanticUnitIds.some((id) => !expectedUnitIds.includes(id))) {
    semanticFail(["data.semanticUnitIds"], "Provider semantic unit ids contain an unknown id", "CONTENT_MASTER_SEMANTIC_UNIT_ID_UNKNOWN");
  }
  if (expectedUnitIds.some((id) => !value.semanticUnitIds.includes(id))) {
    semanticFail(["data.semanticUnitIds"], "Provider semantic unit ids omit frozen authority", "CONTENT_MASTER_SEMANTIC_UNIT_ID_MISSING");
  }
  if (!sameValue(value.semanticUnitIds, expectedUnitIds)) {
    semanticFail(["data.semanticUnitIds"], "Provider semantic unit ids changed frozen order", "CONTENT_MASTER_SEMANTIC_UNIT_ORDER_INVALID");
  }
  const spine = buildCanonicalSemanticSpine(intent, value.content_master_id);
  const canonicalBase = structuredClone(value);
  delete canonicalBase.semanticUnitIds;
  delete canonicalBase.structureIntent;
  delete canonicalBase.semanticSpine;
  delete canonicalBase.contentMasterHash;
  const withAuthority = { ...canonicalBase, structureIntent: structuredClone(intent), semanticSpine: spine };
  const canonical = { ...withAuthority, contentMasterHash: contentMasterSemanticHash(withAuthority) };
  return markTrustedMaterializedContentMaster(validateContentMasterSemanticSpine(canonical, intent));
}

export function materializeContentOutlineSemanticAuthority(value, sourceContentMaster, strictSequenceContract = null) {
  const master = validateContentMasterSemanticSpine(sourceContentMaster);
  if (!object(value) || !Array.isArray(value.sections)) semanticFail(["data.sections"], "Outline sections are required before semantic materialization");
  if (Object.hasOwn(value, "structureIntent") || Object.hasOwn(value, "semanticSpine")
    || Object.hasOwn(value, "requiredUnits") || Object.hasOwn(value, "orderingPolicy")) {
    semanticFail(["data.sections"], "Outline cannot introduce a competing semantic framework", "OUTLINE_COMPETING_FRAMEWORK_INVALID");
  }
  const masterId = master.content_master_id || master.id;
  const contentMasterRef = { id: masterId, hash: master.contentMasterHash };
  const semanticSpineRef = { id: master.semanticSpine.id, hash: master.semanticSpine.spineHash };
  assertMaterializableTopLevelAuthorityRef(value.contentMasterRef, "data.contentMasterRef");
  assertMaterializableTopLevelAuthorityRef(value.semanticSpineRef, "data.semanticSpineRef");
  const units = new Map(master.semanticSpine.units.map((unit) => [unit.id, unit]));
  let strictUnitIds = null;
  if (strictSequenceContract != null) {
    const sequenceContract = validateStrictSequenceContract(strictSequenceContract, master);
    strictUnitIds = validateStrictSectionPlacements(value.sections, sequenceContract);
  }
  const canonical = structuredClone(value);
  canonical.contentMasterRef = contentMasterRef;
  canonical.semanticSpineRef = semanticSpineRef;
  const resolvedSections = value.sections.map((section, sectionIndex) => {
    const suppliedRefs = section.masterUnitRefs;
    const ids = strictUnitIds?.[sectionIndex]
      ?? section.masterUnitIds
      ?? (Array.isArray(suppliedRefs) ? suppliedRefs.map((item) => item?.id) : null);
    if (!Array.isArray(ids) || ids.some((id) => !text(id))) {
      semanticFail(["data.sections[].masterUnitIds"], "Provider outline sections must declare ordered master unit ids", "OUTLINE_MASTER_UNIT_IDS_INVALID");
    }
    const resolved = ids.map((id) => {
      const unit = units.get(id);
      if (!unit) semanticFail(["data.sections[].masterUnitIds"], "Provider outline contains an unknown master unit id", "OUTLINE_MASTER_UNIT_ID_UNKNOWN");
      return { id, hash: unit.unitHash };
    });
    if (suppliedRefs != null) {
      if (!Array.isArray(suppliedRefs) || suppliedRefs.length !== resolved.length) {
        semanticFail(["data.sections[].masterUnitRefs"], "Provider master unit refs conflict with trusted resolution", "OUTLINE_MASTER_UNIT_REF_CONFLICT");
      }
      suppliedRefs.forEach((candidate, index) => {
        assertMaterializableUnitRef(candidate, resolved[index], "data.sections[].masterUnitRefs");
      });
    }
    const result = structuredClone(section);
    delete result.masterUnitIds;
    result.masterUnitRefs = resolved;
    return result;
  });
  const sectionOccurrences = new Map();
  resolvedSections.forEach((section) => {
    new Set(section.masterUnitRefs.map((unitRef) => unitRef.id)).forEach((id) => {
      sectionOccurrences.set(id, (sectionOccurrences.get(id) || 0) + 1);
    });
  });
  canonical.sections = resolvedSections.map((section) => {
    const result = structuredClone(section);
    if (section.masterUnitRefs.length === 0) result.adaptationType = "supplemental";
    else if (section.masterUnitRefs.length >= 2) result.adaptationType = "merge";
    else result.adaptationType = sectionOccurrences.get(section.masterUnitRefs[0].id) > 1 ? "split" : "direct";
    return result;
  });
  validateContentOutlineSemanticMapping(canonical, master);
  return canonical;
}

export function materializeUnifiedSkillRuntimeOutput({ capability, runtimeOutput, sourceSkillInput = null, sourceContentMaster = null }) {
  const trustedMasterReplay = capability === "build-content-master"
    && trustedMaterializedContentMasters.has(runtimeOutput?.data);
  const canonical = capability === "generate-content-outline" && isBareContentOutlineRuntimeOutput(runtimeOutput)
    ? { status: "ready", data: structuredClone(runtimeOutput), warnings: [], blocked_reasons: [] }
    : structuredClone(runtimeOutput);
  // Some configured text providers return `ready` for a completed writer result.
  // `write-wechat-article` is a synchronous materialization step, so normalize
  // that provider alias to the canonical success status before contract gates.
  if (capability === "write-wechat-article" && canonical?.status === "ready") canonical.status = "success";
  if (!object(canonical?.data)) return canonical;
  if (capability === "build-content-master" && sourceSkillInput?.structureIntent) {
    canonical.data = trustedMasterReplay
      ? markTrustedMaterializedContentMaster(validateContentMasterSemanticSpine(canonical.data, sourceSkillInput.structureIntent))
      : materializeContentMasterSemanticAuthority(canonical.data, sourceSkillInput.structureIntent);
  } else if (capability === "generate-content-outline" && sourceContentMaster?.semanticSpine) {
    canonical.data = materializeContentOutlineSemanticAuthority(canonical.data, sourceContentMaster, sourceSkillInput?.strict_sequence_contract || null);
  }
  return canonical;
}

/** Project Provider-owned section drafts into the historical compiled carousel shape. */
export function projectXhsCarouselCreativeDraftToCompiled({ draft, confirmedOutline, canvas = { width: 1080, height: 1440, ratio: "3:4" } }) {
  if (!object(draft?.data) || draft.data.contract !== "XhsCarouselPlanCreativeOutput@1.0") {
    throw Object.assign(new Error("XHS creative draft contract is required"), { code: "XHS_CREATIVE_DRAFT_CONTRACT_INVALID" });
  }
  const pages = draft.data.pages;
  const sections = confirmedOutline?.sections;
  if (!Array.isArray(pages) || !Array.isArray(sections) || pages.length !== sections.length) {
    throw Object.assign(new Error("Creative pages must match confirmed outline cardinality"), { code: "XHS_CREATIVE_DRAFT_CARDINALITY_MISMATCH" });
  }
  const roleMap = { hook: "cover", problem: "problem", diagnosis: "conclusion", evidence: "evidence", method: "method", example: "case", action: "cta", boundary: "warning" };
  return {
    schemaVersion: "1.0", contract: "XhsCarouselPlan@2.0", deck_id: draft.data.deck_id,
    reading_arc: draft.data.reading_arc, canvas: structuredClone(canvas),
    pages: pages.map((page, index) => ({
      page: index + 1, outline_section_id: sections[index].sectionId || sections[index].section_id,
      outline_role: sections[index].outlineRole || sections[index].role,
      role: roleMap[sections[index].outlineRole || sections[index].role] || "method",
      objective: page.objective, takeaway: page.takeaway, text_layers: structuredClone(page.text_layers),
      layout_hint: page.layout_hint, fact_ids: structuredClone(page.fact_ids),
      interpretation_ids: structuredClone(page.interpretation_ids), knowledge_asset_ids: structuredClone(page.knowledge_asset_ids)
    }))
  };
}

export function validateContentMasterSemanticSpine(value, expectedIntent = null) {
  const intent = validateContentStructureIntent(value?.structureIntent);
  if (expectedIntent && !sameValue(intent, validateContentStructureIntent(expectedIntent))) {
    semanticFail(["data.structureIntent"], "ContentMaster structure intent differs from frozen user or strategy authority", "CONTENT_MASTER_STRUCTURE_INTENT_AUTHORITY_MISMATCH");
  }
  const spine = value?.semanticSpine;
  const expectedUnits = canonicalIntentUnits(intent);
  if (!object(spine) || !text(spine.id)
    || !exactKeys(spine.structureIntentRef, ["id", "hash"])
    || spine.structureIntentRef.id !== intent.id || spine.structureIntentRef.hash !== intent.intentHash
    || spine.structureType !== intent.structureType || !sameValue(spine.orderingPolicy, intent.orderingPolicy)
    || !Array.isArray(spine.units) || spine.units.length !== expectedUnits.length || !HASH.test(spine.spineHash || "")) {
    semanticFail(["data.semanticSpine"], "Semantic spine does not close over the frozen structure intent", "CONTENT_MASTER_SEMANTIC_SPINE_CLOSURE_INVALID");
  }
  spine.units.forEach((unit, index) => {
    const expected = expectedUnits[index];
    const unitBase = { id: expected.id, meaning: expected.meaning, required: expected.required, order: expected.order, boundary: expected.boundary };
    if (!exactKeys(unit, [...Object.keys(unitBase), "unitHash"]) || !sameValue({ ...unitBase, unitHash: hashUnifiedContent(unitBase) }, unit)) {
      semanticFail(["data.semanticSpine.units"], "Semantic spine unit changed id, meaning, required status, order, or boundary", "CONTENT_MASTER_SEMANTIC_SPINE_UNIT_INVALID");
    }
  });
  if (hashWithout(spine, "spineHash") !== spine.spineHash) {
    semanticFail(["data.semanticSpine.spineHash"], "Semantic spine hash is stale", "CONTENT_MASTER_SEMANTIC_SPINE_HASH_STALE");
  }
  if (!HASH.test(value?.contentMasterHash || "") || contentMasterSemanticHash(value) !== value.contentMasterHash) {
    semanticFail(["data.contentMasterHash"], "ContentMaster hash is stale", "CONTENT_MASTER_HASH_STALE");
  }
  return structuredClone(value);
}

export function validateContentOutlineSemanticMapping(value, sourceContentMaster) {
  const master = validateContentMasterSemanticSpine(sourceContentMaster);
  const masterId = master.content_master_id || master.id;
  if (!exactKeys(value?.contentMasterRef, ["id", "hash"]) || value.contentMasterRef.id !== masterId || value.contentMasterRef.hash !== master.contentMasterHash
    || !exactKeys(value?.semanticSpineRef, ["id", "hash"]) || value.semanticSpineRef.id !== master.semanticSpine.id || value.semanticSpineRef.hash !== master.semanticSpine.spineHash) {
    semanticFail(["data.contentMasterRef", "data.semanticSpineRef"], "Outline is stale against its ContentMaster semantic spine");
  }
  if (Object.hasOwn(value, "structureIntent") || Object.hasOwn(value, "semanticSpine") || Object.hasOwn(value, "requiredUnits") || Object.hasOwn(value, "orderingPolicy")) {
    semanticFail(["data.sections"], "Outline cannot introduce a competing semantic framework", "OUTLINE_COMPETING_FRAMEWORK_INVALID");
  }
  const units = new Map(master.semanticSpine.units.map((unit) => [unit.id, unit]));
  const occurrences = new Map(master.semanticSpine.units.map((unit) => [unit.id, []]));
  const flattened = [];
  value.sections.forEach((section, sectionIndex) => {
    if (!Array.isArray(section.masterUnitRefs) || !ADAPTATION_TYPES.has(section.adaptationType)
      || Object.hasOwn(section, "semanticSpine") || Object.hasOwn(section, "structureIntent")) {
      semanticFail(
        ["data.sections[].masterUnitRefs", "data.sections[].adaptationType"],
        "Every outline section must declare one deterministic adaptation mapping",
        "OUTLINE_ADAPTATION_MAPPING_INVALID"
      );
    }
    const refs = section.masterUnitRefs;
    if (new Set(refs.map((item) => item?.id)).size !== refs.length) {
      semanticFail(["data.sections[].masterUnitRefs"], "A section cannot repeat a master unit ref", "OUTLINE_MASTER_UNIT_REF_DUPLICATE");
    }
    if (section.adaptationType === "supplemental") {
      if (refs.length !== 0) {
        semanticFail(
          ["data.sections[].adaptationType"],
          "Supplemental sections cannot claim core coverage",
          "OUTLINE_ADAPTATION_SUPPLEMENTAL_INVALID"
        );
      }
      return;
    }
    if ((section.adaptationType === "merge" && refs.length < 2)
      || (["direct", "split"].includes(section.adaptationType) && refs.length !== 1)) {
      semanticFail(
        ["data.sections[].adaptationType"],
        "Adaptation type does not match its number of master unit refs",
        "OUTLINE_ADAPTATION_CARDINALITY_INVALID"
      );
    }
    refs.forEach((unitRef) => {
      const unit = units.get(unitRef?.id);
      if (!exactKeys(unitRef, ["id", "hash"]) || !unit || unitRef.hash !== unit.unitHash) {
        semanticFail(["data.sections[].masterUnitRefs"], "Outline contains an unknown or stale master unit ref", "OUTLINE_MASTER_UNIT_REF_UNKNOWN_OR_STALE");
      }
      occurrences.get(unit.id).push({ sectionIndex, adaptationType: section.adaptationType, sectionRefCount: refs.length });
      flattened.push(unit.order);
    });
  });
  for (const unit of master.semanticSpine.units) {
    const mapped = occurrences.get(unit.id);
    if (unit.required && mapped.length === 0) {
      semanticFail(["data.sections[].masterUnitRefs"], "Required master unit coverage must be 100 percent", "OUTLINE_REQUIRED_UNIT_COVERAGE_MISSING");
    }
    if (mapped.length > 1 && mapped.some((item) => item.sectionRefCount === 1 && item.adaptationType !== "split")) {
      semanticFail(
        ["data.sections[].adaptationType"],
        "Repeated single-ref master unit coverage must use split adaptation consistently",
        "OUTLINE_ADAPTATION_REPEATED_SINGLE_REF_INVALID"
      );
    }
    if (mapped.length === 1 && mapped[0].adaptationType === "split") {
      semanticFail(
        ["data.sections[].adaptationType"],
        "Split adaptation requires more than one section for the unit",
        "OUTLINE_ADAPTATION_LONE_SPLIT_INVALID"
      );
    }
  }
  if (master.semanticSpine.orderingPolicy.mode === "strict" && flattened.some((order, index) => index > 0 && order < flattened[index - 1])) {
    semanticFail(["data.sections[].masterUnitRefs"], "Strict master unit order was changed by the platform outline", "OUTLINE_STRICT_UNIT_ORDER_INVALID");
  }
  return structuredClone(value);
}

function validateMaster(capability, value, sourceSkillInput = null) {
  requireFields(capability, [
    ["data.content_master_id", text(value?.content_master_id)],
    ["data.confirmed_facts", Array.isArray(value?.confirmed_facts)],
    ["data.confirmed_facts[].fact_id", value?.confirmed_facts?.every((item) => text(item?.fact_id) && text(item?.fact) && Array.isArray(item?.source_ids) && item.source_ids.length > 0)],
    ["data.supported_interpretations", Array.isArray(value?.supported_interpretations)],
    ["data.author_opinions", Array.isArray(value?.author_opinions)],
    ["data.source_list", Array.isArray(value?.source_list)]
  ]);
  if (sourceSkillInput?.structureIntent || value?.structureIntent || value?.semanticSpine || value?.contentMasterHash) {
    validateContentMasterSemanticSpine(value, sourceSkillInput?.structureIntent || null);
  }
}

function validateOutline(capability, value, platform, sourceContentMaster = null) {
  const roles = new Set(["hook", "problem", "diagnosis", "evidence", "method", "example", "action", "boundary"]);
  const contentFunctions = new Set(["discovery", "authority", "proof", "solution", "action"]);
  requireFields(capability, [
    ["data.outline_id", text(value?.outline_id)],
    ["data.schema_version", value?.schema_version === "1.0"],
    ["data.platform", value?.platform === platform],
    ["data.topic", text(value?.topic)],
    ["data.content_promise", text(value?.content_promise)],
    ["data.content_function", contentFunctions.has(value?.content_function)],
    ["data.content_purpose_id", text(value?.content_purpose_id)],
    ["data.conversion_stage_id", text(value?.conversion_stage_id)],
    ["data.opening_strategy", text(value?.opening_strategy)],
    ["data.sections", Array.isArray(value?.sections) && value.sections.length >= 3],
    ["data.sections[].section_id", value?.sections?.every((item) => text(item?.section_id))],
    ["data.sections[].heading", value?.sections?.every((item) => text(item?.heading))],
    ["data.sections[].role", value?.sections?.every((item) => roles.has(item?.role))],
    ["data.sections[].objective", value?.sections?.every((item) => text(item?.objective))],
    ["data.sections[].key_points", value?.sections?.every((item) => Array.isArray(item?.key_points))],
    ["data.sections[].claim_ids", value?.sections?.every((item) => Array.isArray(item?.claim_ids))],
    ["data.sections[].boundary", value?.sections?.every((item) => string(item?.boundary))],
    ["data.closing_strategy", text(value?.closing_strategy)],
    ["data.unresolved_questions", Array.isArray(value?.unresolved_questions)],
    ["data.confirmation_required", value?.confirmation_required === true]
  ]);
  if (platform === "xiaohongshu") {
    const sections = value?.sections || [];
    const uniqueText = (values) => values.every(text) && new Set(values.map((item) => item.trim())).size === values.length;
    requireFields(capability, [
      ["data.sections.length", sections.length >= 6 && sections.length <= 10],
      ["data.sections[].section_id", uniqueText(sections.map((item) => item?.section_id))],
      ["data.sections[].objective", uniqueText(sections.map((item) => item?.objective))],
      ["data.sections[].presentation_content", new Set(sections.map((item) => JSON.stringify({ heading: item?.heading, key_points: item?.key_points, boundary: item?.boundary }))).size === sections.length]
    ]);
  }
  if (sourceContentMaster?.semanticSpine || value?.contentMasterRef || value?.semanticSpineRef
    || value?.sections?.some((section) => Object.hasOwn(section, "masterUnitRefs") || Object.hasOwn(section, "adaptationType"))) {
    validateContentOutlineSemanticMapping(value, sourceContentMaster);
  }
}

function outlineStatusGate(capability, status) {
  if (status === "ready") return;
  throw Object.assign(new Error("Content outline is not ready for candidate generation"), {
    code: "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY",
    statusCode: 409,
    details: { capability, fieldPaths: ["status"] }
  });
}

function mapCanonicalOutline(value) {
  return {
    ...structuredClone(value),
    id: value.outline_id,
    sections: value.sections.map((item) => ({ ...structuredClone(item), id: item.section_id }))
  };
}

function everyString(values) {
  return Array.isArray(values) && values.every(text);
}

function everyObjectWithExactKeys(values, keys) {
  return Array.isArray(values) && values.every((item) => exactKeys(item, keys));
}

function validateExactRootKeys(capability, value, keys, path) {
  if (!object(value)) fail(capability, [path]);
  const missingPaths = keys.filter((key) => !Object.hasOwn(value, key)).map((key) => `${path}.${key}`);
  const hasExtraKeys = Object.keys(value).some((key) => !keys.includes(key));
  if (missingPaths.length || hasExtraKeys) fail(capability, hasExtraKeys ? [path, ...missingPaths] : missingPaths);
}

function validateWriterContextInput(capability, sourceSkillInput, expectedPlatform) {
  const context = sourceSkillInput?.writer_context;
  const authorityKeys = ["activeStrategySnapshotRef", "contentOpportunityRef", "mechanismDecisionRef", "accountRef", "accountStrategyRef", "sharedContentMasterRef", "platformBriefRef", "confirmedOutlineRef"];
  const base = object(context) ? structuredClone(context) : null;
  if (base) delete base.writerContextHash;
  let canonical = null;
  try { canonical = createUnifiedWriterContext(base); } catch {}
  requireFields(capability, [
    ["input.writer_context", Boolean(canonical) && canonical.platform === expectedPlatform],
    ["input.writer_context.writerContextHash", Boolean(canonical) && context?.writerContextHash === canonical.writerContextHash],
    ["input.writer_context.authority_refs", exactKeys(context?.authority_refs, authorityKeys)],
    ["input.writer_context.authority_refs[]", authorityKeys.every((key) => text(context?.authority_refs?.[key]?.id) && /^[a-f0-9]{64}$/.test(context?.authority_refs?.[key]?.hash))]
  ]);
  return context;
}

function validateWriterContextBinding(capability, value, context) {
  requireFields(capability, [
    ["data.platform", value?.platform === context.platform],
    ["data.topic_id", value?.topic_id === context.topic_id],
    ["data.intent_profile_id", value?.intent_profile_id === context.intent_profile_id],
    ["data.content_purpose_id", value?.content_purpose_id === context.content_purpose_id],
    ["data.account_context.subject_type", value?.account_context?.subject_type === context.account_context.subject_type],
    ["data.account_context.account_mode", value?.account_context?.account_mode === context.account_context.account_mode],
    ["data.account_context.matrix_role", value?.account_context?.matrix_role === context.account_context.matrix_role],
    ["data.account_context.trust_source", value?.account_context?.trust_source === context.account_context.trust_source],
    ["data.creative_mechanism", value?.creative_mechanism === context.creative_mechanism],
    ["data.journey_stage", value?.journey_stage === context.journey_stage],
    ["data.matrix_coordination.shared_campaign_topic_id", value?.matrix_coordination?.shared_campaign_topic_id === context.matrix_coordination.shared_campaign_topic_id],
    ["data.matrix_coordination.differentiation_angle", value?.matrix_coordination?.differentiation_angle === context.matrix_coordination.differentiation_angle],
    ["data.matrix_coordination.prohibited_overlap", hashUnifiedContent(value?.matrix_coordination?.prohibited_overlap) === hashUnifiedContent(context.matrix_coordination.prohibited_overlap)],
    ["data.preflight_checks.matrix_differentiation", context.coordination_mode !== "coordinated" || value?.preflight_checks?.some((item) => item?.check === "matrix_differentiation" && item.result === "pass")]
  ]);
}

function validateXhsInput(capability, sourceSkillInput, sourceContentMaster) {
  const keys = ["platform", "content_master", "platform_brief", "confirmed_outline", "writer_context", "design_dna", "design_dna_ref"];
  requireFields(capability, [
    ["input", exactKeys(sourceSkillInput, keys)],
    ["input.platform", sourceSkillInput?.platform === PLATFORM_OUTPUT_NAMES.xiaohongshu],
    ["input.content_master", object(sourceContentMaster) && object(sourceSkillInput?.content_master) && hashUnifiedContent(sourceSkillInput.content_master) === hashUnifiedContent(sourceContentMaster)],
    ["input.platform_brief", object(sourceSkillInput?.platform_brief) && sourceSkillInput.platform_brief.platform === "xiaohongshu"],
    ["input.confirmed_outline", object(sourceSkillInput?.confirmed_outline) && sourceSkillInput.confirmed_outline.platform === "xiaohongshu"]
  ]);
  return validateWriterContextInput(capability, sourceSkillInput, PLATFORM_OUTPUT_NAMES.xiaohongshu);
}

function validateXhsWriter(capability, value, sourceContentMaster = null, sourceSkillInput = null) {
  const writerContext = sourceSkillInput ? validateXhsInput(capability, sourceSkillInput, sourceContentMaster) : null;
  const subjectTypes = new Set(["company", "founder", "employee", "personal"]);
  const accountModes = new Set(["official", "expert", "founder_ip", "employee_ip", "personal_ip"]);
  const trustSources = new Set(["institution", "expertise", "experience", "personality", "mixed"]);
  const mechanisms = new Set(["search_answer", "checklist", "case_reconstruction", "contrast", "experiment", "opinion", "trend_bridge", "story"]);
  const journeyStages = new Set(["discover", "understand", "trust", "consider", "convert", "retain"]);
  const actions = new Set(["save", "share", "comment", "follow", "consult", "try", "buy", "register", "none"]);
  const placements = new Set(["body", "ending", "pinned_comment", "card", "none"]);
  const hookTypes = new Set(["result", "problem", "contrast", "checklist", "question"]);
  const risks = new Set(["low", "medium", "high"]);
  const sectionRoles = new Set(["scene", "problem", "conclusion", "method", "evidence", "warning", "summary"]);
  const pageRoles = new Set(["cover", "problem", "conclusion", "method", "evidence", "case", "warning", "summary", "cta"]);
  const layerTypes = new Set(["headline", "body", "label", "footer"]);
  const visualFunctions = new Set(["attention", "explain", "compare", "demonstrate", "pace", "none"]);
  const renderStrategies = new Set(["html_css", "authorized_asset", "generated_raster", "no_visual_needed"]);
  const imageUseCases = new Set(["illustration-story", "photorealistic-natural", "stylized-concept", "product-context", "texture-background"]);
  const assetTypes = new Set(["carousel-background", "subject-cutout", "scene-illustration"]);
  const skipReasons = new Set(["html_css", "authorized_asset", "no_visual_needed"]);
  const account = value?.account_context;
  const matrix = value?.matrix_coordination;
  const engagement = value?.engagement_strategy;
  const copy = value?.post_copy;
  const deck = value?.deck;
  const pages = deck?.pages;
  const specs = value?.image_specs;
  const skipped = value?.skipped_image_pages;
  const trace = value?.traceability;
  const checks = value?.preflight_checks;
  const writerKeys = ["platform", "topic_id", "intent_profile_id", "content_purpose_id", "account_context", "creative_mechanism", "journey_stage", "matrix_coordination", "content_promise", "engagement_strategy", "post_copy", "deck", "image_specs", "skipped_image_pages", "traceability", "preflight_checks"];
  const titleKeys = ["title", "hook_type", "claim_ids", "risk"];
  const bodySectionKeys = ["section_id", "role", "text", "claim_ids"];
  const pageKeys = ["page", "role", "objective", "takeaway", "text_layers", "layout_hint", "visual_function", "visual_need", "render_strategy", "asset_ids", "fact_ids", "interpretation_ids", "must_avoid"];
  const textLayerKeys = ["type", "text", "max_lines", "priority"];
  const imageSpecKeys = ["asset_id", "page", "use_case", "asset_type", "scene", "subject", "style_and_medium", "composition", "lighting", "palette", "materials", "text_safe_area", "prompt", "negative_prompt", "reference_asset_ids", "design_dna_version", "size", "must_keep", "must_avoid", "text_policy"];
  const skippedPageKeys = ["page", "reason"];
  const pageClaimKeys = ["page", "claim_ids"];
  const preflightKeys = ["check", "result", "detail"];
  const requiredChecks = ["promise_consistency", "claim_traceability", "image_text_separation", "page_non_repetition", "intent_and_promotion_alignment", "account_identity_alignment", "matrix_differentiation"];
  const requiredCheckSet = new Set(requiredChecks);

  // Treat Provider JSON as untrusted. Complete the structural pass before any
  // semantic predicate dereferences a nested value, so validation is total for
  // every JSON shape and reports only stable contract paths.
  validateExactRootKeys(capability, value, writerKeys, "data");
  requireFields(capability, [
    ["data.account_context", object(account)],
    ["data.matrix_coordination", object(matrix)],
    ["data.engagement_strategy", object(engagement)],
    ["data.post_copy", object(copy)],
    ["data.deck", object(deck)],
    ["data.traceability", object(trace)]
  ]);
  requireFields(capability, [
    ["data.post_copy.title_candidates", Array.isArray(copy.title_candidates)],
    ["data.post_copy.body_sections", Array.isArray(copy.body_sections)],
    ["data.deck.pages", Array.isArray(pages)],
    ["data.image_specs", Array.isArray(specs)],
    ["data.skipped_image_pages", Array.isArray(skipped)],
    ["data.traceability.page_claim_map", Array.isArray(trace.page_claim_map)],
    ["data.preflight_checks", Array.isArray(checks)]
  ]);
  requireFields(capability, [
    ["data.post_copy.title_candidates[]", everyObjectWithExactKeys(copy.title_candidates, titleKeys)],
    ["data.post_copy.body_sections[]", everyObjectWithExactKeys(copy.body_sections, bodySectionKeys)],
    ["data.deck.pages[]", everyObjectWithExactKeys(pages, pageKeys)],
    ["data.image_specs[]", everyObjectWithExactKeys(specs, imageSpecKeys)],
    ["data.skipped_image_pages[]", everyObjectWithExactKeys(skipped, skippedPageKeys)],
    ["data.traceability.page_claim_map[]", everyObjectWithExactKeys(trace.page_claim_map, pageClaimKeys)],
    ["data.preflight_checks[]", everyObjectWithExactKeys(checks, preflightKeys)]
  ]);
  requireFields(capability, [[
    "data.deck.pages[].text_layers",
    pages.every((item) => Array.isArray(item.text_layers) && everyObjectWithExactKeys(item.text_layers, textLayerKeys))
  ]]);
  const checkNames = checks.map((item) => item.check);
  requireFields(capability, [[
    "data.preflight_checks[].check",
    new Set(checkNames).size === checkNames.length && checkNames.every((name) => requiredCheckSet.has(name))
  ]]);

  requireFields(capability, [
    ["data", exactKeys(value, writerKeys)],
    ["data.platform", value?.platform === PLATFORM_OUTPUT_NAMES.xiaohongshu],
    ["data.topic_id", text(value?.topic_id)],
    ["data.intent_profile_id", text(value?.intent_profile_id)],
    ["data.content_purpose_id", text(value?.content_purpose_id)],
    ["data.account_context", exactKeys(account, ["subject_type", "account_mode", "matrix_role", "trust_source"])],
    ["data.account_context.subject_type", subjectTypes.has(account?.subject_type)],
    ["data.account_context.account_mode", accountModes.has(account?.account_mode)],
    ["data.account_context.matrix_role", text(account?.matrix_role)],
    ["data.account_context.trust_source", trustSources.has(account?.trust_source)],
    ["data.creative_mechanism", mechanisms.has(value?.creative_mechanism)],
    ["data.journey_stage", journeyStages.has(value?.journey_stage)],
    ["data.matrix_coordination", exactKeys(matrix, ["shared_campaign_topic_id", "differentiation_angle", "prohibited_overlap"])],
    ["data.matrix_coordination.shared_campaign_topic_id", string(matrix?.shared_campaign_topic_id)],
    ["data.matrix_coordination.differentiation_angle", text(matrix?.differentiation_angle)],
    ["data.matrix_coordination.prohibited_overlap", everyString(matrix?.prohibited_overlap)],
    ["data.content_promise", text(value?.content_promise)],
    ["data.engagement_strategy", exactKeys(engagement, ["mode", "primary_action", "reason", "cta_placement", "cta_text"])],
    ["data.engagement_strategy.mode", engagement?.mode === "auto"],
    ["data.engagement_strategy.primary_action", actions.has(engagement?.primary_action)],
    ["data.engagement_strategy.reason", text(engagement?.reason)],
    ["data.engagement_strategy.cta_placement", placements.has(engagement?.cta_placement)],
    ["data.engagement_strategy.cta_text", string(engagement?.cta_text)],
    ["data.post_copy", exactKeys(copy, ["title_candidates", "recommended_title", "opening", "body_sections", "ending", "pinned_comment", "hashtags", "cta"])],
    ["data.post_copy.title_candidates", Array.isArray(copy?.title_candidates) && copy.title_candidates.length >= 3 && copy.title_candidates.length <= 5],
    ["data.post_copy.title_candidates[]", copy.title_candidates.every((item) => text(item.title) && hookTypes.has(item.hook_type) && everyString(item.claim_ids) && risks.has(item.risk))],
    ["data.post_copy.recommended_title", text(copy?.recommended_title) && copy.title_candidates.some((item) => item.title === copy.recommended_title)],
    ["data.post_copy.opening", text(copy?.opening)],
    ["data.post_copy.body_sections", Array.isArray(copy?.body_sections) && copy.body_sections.length > 0],
    ["data.post_copy.body_sections[]", everyObjectWithExactKeys(copy.body_sections, bodySectionKeys)],
    ["data.post_copy.body_sections[].section_id", copy.body_sections.every((item) => text(item.section_id))],
    ["data.post_copy.body_sections[].role", copy.body_sections.every((item) => sectionRoles.has(item.role))],
    ["data.post_copy.body_sections[].text", copy.body_sections.every((item) => text(item.text))],
    ["data.post_copy.body_sections[].claim_ids", copy.body_sections.every((item) => everyString(item.claim_ids))],
    ["data.post_copy.ending", text(copy?.ending)],
    ["data.post_copy.pinned_comment", string(copy?.pinned_comment)],
    ["data.post_copy.hashtags", Array.isArray(copy?.hashtags) && copy.hashtags.length >= 3 && copy.hashtags.length <= 8 && copy.hashtags.every(text)],
    ["data.post_copy.cta", string(copy?.cta)],
    ["data.deck", exactKeys(deck, ["deck_id", "canvas", "design_dna_version", "reading_arc", "pages"])],
    ["data.deck.deck_id", text(deck?.deck_id)],
    ["data.deck.canvas", exactKeys(deck?.canvas, ["width", "height", "ratio"]) && deck.canvas.width === 1080 && deck.canvas.height === 1440 && deck.canvas.ratio === "3:4"],
    ["data.deck.design_dna_version", text(deck?.design_dna_version)],
    ["data.deck.reading_arc", text(deck?.reading_arc)],
    ["data.deck.pages", Array.isArray(pages) && pages.length >= 6 && pages.length <= 10],
    ["data.deck.pages[]", everyObjectWithExactKeys(pages, pageKeys)],
    ["data.deck.pages[].page", pages.every((item, index) => item.page === index + 1)],
    ["data.deck.pages[].role", pages.every((item) => pageRoles.has(item.role))],
    ["data.deck.pages[].objective", pages.every((item) => text(item.objective))],
    ["data.deck.pages[].takeaway", pages.every((item) => text(item.takeaway))],
    ["data.deck.pages[].layout_hint", pages.every((item) => text(item.layout_hint))],
    ["data.deck.pages[].visual_function", pages.every((item) => visualFunctions.has(item.visual_function))],
    ["data.deck.pages[].visual_need", pages.every((item) => string(item.visual_need))],
    ["data.deck.pages[].render_strategy", pages.every((item) => renderStrategies.has(item.render_strategy))],
    ["data.deck.pages[].must_avoid", pages.every((item) => everyString(item.must_avoid))],
    ["data.deck.pages[].text_layers", pages.every((item) => item.text_layers.length > 0 && item.text_layers.every((layer) => layerTypes.has(layer.type) && text(layer.text) && Number.isInteger(layer.max_lines) && layer.max_lines > 0 && Number.isInteger(layer.priority) && layer.priority > 0))],
    ["data.deck.pages[].asset_ids", pages.every((item) => everyString(item.asset_ids))],
    ["data.deck.pages[].fact_ids", pages.every((item) => everyString(item.fact_ids))],
    ["data.deck.pages[].interpretation_ids", pages.every((item) => everyString(item.interpretation_ids))],
    ["data.image_specs", Array.isArray(specs)],
    ["data.image_specs[]", specs.every((item) => imageUseCases.has(item.use_case) && assetTypes.has(item.asset_type) && ["scene", "subject", "style_and_medium", "composition", "lighting", "materials", "text_safe_area", "prompt", "negative_prompt", "design_dna_version"].every((key) => text(item[key])) && everyString(item.palette) && everyString(item.reference_asset_ids) && item.size === "1024x1536" && everyString(item.must_keep) && everyString(item.must_avoid) && item.text_policy === "no_text_in_image")],
    ["data.image_specs[].page", specs.every((item) => Number.isInteger(item.page))],
    ["data.image_specs[].asset_id", specs.every((item) => text(item.asset_id))],
    ["data.skipped_image_pages", Array.isArray(skipped)],
    ["data.skipped_image_pages[]", skipped.every((item) => Number.isInteger(item.page) && skipReasons.has(item.reason))],
    ["data.traceability", exactKeys(trace, ["used_fact_ids", "used_interpretation_ids", "used_knowledge_asset_ids", "page_claim_map"])],
    ["data.traceability.used_fact_ids", everyString(trace?.used_fact_ids)],
    ["data.traceability.used_interpretation_ids", everyString(trace?.used_interpretation_ids)],
    ["data.traceability.used_knowledge_asset_ids", everyString(trace?.used_knowledge_asset_ids)],
    ["data.traceability.page_claim_map", Array.isArray(trace?.page_claim_map)],
    ["data.traceability.page_claim_map[]", trace.page_claim_map.every((item) => Number.isInteger(item.page) && everyString(item.claim_ids))],
    ["data.preflight_checks", Array.isArray(checks)],
    ["data.preflight_checks[]", checks.every((item) => text(item.check) && ["pass", "fail", "not_applicable"].includes(item.result) && string(item.detail))]
  ]);
  if (writerContext) validateWriterContextBinding(capability, value, writerContext);

  const generated = pages.filter((item) => item.render_strategy === "generated_raster");
  const nonGenerated = pages.filter((item) => item.render_strategy !== "generated_raster");
  const generatedPages = new Set(generated.map((item) => item.page));
  const skippedPages = new Set(skipped.map((item) => item.page));
  const specPages = new Set(specs.map((item) => item.page));
  const specAssets = new Set(specs.map((item) => item.asset_id));
  const pageClaims = trace.page_claim_map;
  requireFields(capability, [
    ["data.image_spec_alignment.spec_count", specs.length === generated.length],
    ["data.image_spec_alignment.spec_page_uniqueness", specPages.size === specs.length],
    ["data.image_spec_alignment.generated_page_coverage", generated.every((page) => specPages.has(page.page)) && specs.every((spec) => generatedPages.has(spec.page))],
    ["data.image_spec_alignment.page_asset_binding", specs.every((spec) => pages[spec.page - 1]?.asset_ids.includes(spec.asset_id)) && generated.every((page) => specAssets.has(page.asset_ids[0]))],
    ["data.image_spec_alignment.single_asset_per_generated_page", generated.every((page) => page.asset_ids.length === 1)],
    ["data.image_spec_alignment.design_dna_version", specs.every((spec) => spec.design_dna_version === deck.design_dna_version)],
    ["data.skipped_image_pages", skipped.length === nonGenerated.length && skippedPages.size === skipped.length && nonGenerated.every((page) => skippedPages.has(page.page)) && skipped.every((item) => pages[item.page - 1]?.render_strategy === item.reason)],
    ["data.traceability.page_claim_map", pageClaims.length === pages.length && new Set(pageClaims.map((item) => item.page)).size === pages.length && pages.every((page) => pageClaims.some((item) => item.page === page.page))],
    ["data.promise_consistency", pages[0]?.role === "cover" && pages[0]?.text_layers?.some((layer) => layer.type === "headline") && checks.some((item) => item.check === "promise_consistency" && item.result === "pass")],
    ...requiredChecks.map((name) => [
      `data.preflight_checks.${name}`,
      checks.some((item) => item.check === name && (name === "matrix_differentiation" ? ["pass", "not_applicable"].includes(item.result) : item.result === "pass"))
    ])
  ]);

  const referencedFactIds = new Set(pages.flatMap((item) => item.fact_ids));
  const referencedInterpretationIds = new Set(pages.flatMap((item) => item.interpretation_ids));
  const referencedClaimIds = new Set([
    ...copy.title_candidates.flatMap((item) => item.claim_ids),
    ...copy.body_sections.flatMap((item) => item.claim_ids),
    ...pageClaims.flatMap((item) => item.claim_ids)
  ]);
  const tracedClaimIds = new Set([...trace.used_fact_ids, ...trace.used_interpretation_ids]);
  const pageNumbers = new Set(pages.map((item) => item.page));
  const outputReferenceIntegrity = [...referencedFactIds].every((id) => trace.used_fact_ids.includes(id))
    && [...referencedInterpretationIds].every((id) => trace.used_interpretation_ids.includes(id))
    && [...referencedClaimIds].every((id) => tracedClaimIds.has(id))
    && pageClaims.every((item) => pageNumbers.has(item.page));
  let masterReferenceIntegrity = true;
  if (object(sourceContentMaster)) {
    const factIds = new Set((sourceContentMaster.confirmed_facts || []).map((item) => item.fact_id));
    const interpretationIds = new Set((sourceContentMaster.supported_interpretations || []).map((item) => item.interpretation_id));
    const traceableClaimIds = new Set([...factIds, ...interpretationIds]);
    const opinionIds = new Set((sourceContentMaster.author_opinions || []).map((item) => item.opinion_id));
    const knowledgeIds = new Set((sourceContentMaster.knowledge_contract?.allowed_assets || []).map((item) => item.asset_id || item.id));
    const actualFactIds = new Set([...referencedFactIds, ...[...referencedClaimIds].filter((id) => factIds.has(id))]);
    const actualInterpretationIds = new Set([...referencedInterpretationIds, ...[...referencedClaimIds].filter((id) => interpretationIds.has(id))]);
    masterReferenceIntegrity = [...referencedFactIds].every((id) => factIds.has(id))
      && [...referencedInterpretationIds].every((id) => interpretationIds.has(id))
      && [...referencedClaimIds].every((id) => traceableClaimIds.has(id) && !opinionIds.has(id))
      && trace.used_fact_ids.length === actualFactIds.size
      && trace.used_fact_ids.every((id) => actualFactIds.has(id))
      && trace.used_interpretation_ids.length === actualInterpretationIds.size
      && trace.used_interpretation_ids.every((id) => actualInterpretationIds.has(id))
      && trace.used_knowledge_asset_ids.every((id) => knowledgeIds.has(id));
  }
  requireFields(capability, [["data.reference_integrity", outputReferenceIntegrity && masterReferenceIntegrity]]);
}

function masterReferenceSets(sourceContentMaster) {
  const facts = Array.isArray(sourceContentMaster?.confirmed_facts) ? sourceContentMaster.confirmed_facts : [];
  const interpretations = Array.isArray(sourceContentMaster?.supported_interpretations) ? sourceContentMaster.supported_interpretations : [];
  const opinions = Array.isArray(sourceContentMaster?.author_opinions) ? sourceContentMaster.author_opinions : [];
  const factIds = new Set(facts.map((item) => item?.fact_id).filter(text));
  const claimIds = new Set([
    ...factIds,
    ...interpretations.map((item) => item?.interpretation_id).filter(text),
    ...opinions.map((item) => item?.opinion_id).filter(text)
  ]);
  const sourceIds = new Set((sourceContentMaster?.source_list || []).map((item) => item?.source_id).filter(text));
  const knowledgeIds = new Set((sourceContentMaster?.knowledge_contract?.allowed_assets || []).map((item) => item?.asset_id || item?.id).filter(text));
  return { facts, factIds, claimIds, sourceIds, knowledgeIds };
}

function validateWechatInput(capability, sourceSkillInput, sourceContentMaster, sourceArticle = null) {
  const writerKeys = ["platform", "content_master", "platform_brief", "confirmed_outline", "writer_context"];
  const reviewKeys = [...writerKeys, "mode", "article"];
  const keys = capability === "write-wechat-article" ? writerKeys : reviewKeys;
  requireFields(capability, [
    ["input", exactKeys(sourceSkillInput, keys)],
    ["input.platform", sourceSkillInput?.platform === PLATFORM_OUTPUT_NAMES.wechat],
    ["input.content_master", object(sourceContentMaster) && object(sourceSkillInput?.content_master) && hashUnifiedContent(sourceSkillInput.content_master) === hashUnifiedContent(sourceContentMaster)],
    ["input.platform_brief", object(sourceSkillInput?.platform_brief) && sourceSkillInput.platform_brief.platform === "wechat"],
    ["input.confirmed_outline", object(sourceSkillInput?.confirmed_outline) && sourceSkillInput.confirmed_outline.platform === "wechat"]
  ]);
  validateWriterContextInput(capability, sourceSkillInput, PLATFORM_OUTPUT_NAMES.wechat);
  if (capability === "review-wechat-article") {
    requireFields(capability, [
      ["input.mode", sourceSkillInput?.mode === "report_only"],
      ["input.article", object(sourceArticle) && object(sourceSkillInput?.article) && hashUnifiedContent(sourceSkillInput.article) === hashUnifiedContent(sourceArticle)]
    ]);
  }
}

function validateWechatWriter(capability, value, sourceContentMaster, sourceSkillInput) {
  validateWechatInput(capability, sourceSkillInput, sourceContentMaster);
  const writerContext = sourceSkillInput.writer_context;
  const account = value?.account_context;
  const matrix = value?.matrix_coordination;
  const opening = value?.opening;
  const discovery = value?.discovery_plan;
  const relationship = value?.relationship_handoff;
  const engagement = value?.engagement_strategy;
  const titles = value?.title_candidates;
  const outline = value?.outline;
  const pullQuotes = value?.pull_quotes;
  const claimMap = value?.claim_map;
  const sources = value?.source_list;
  const publishChecks = value?.publish_time_checks;
  const checks = value?.preflight_checks;
  const refs = masterReferenceSets(sourceContentMaster);
  const titleApproaches = new Set(["event", "question", "conclusion", "contrast", "method"]);
  const risks = new Set(["low", "medium", "high"]);
  const relations = new Set(["start", "explain", "support", "contrast", "limit", "conclude"]);
  const writerKeys = ["platform", "topic_id", "intent_profile_id", "content_purpose_id", "account_context", "creative_mechanism", "journey_stage", "matrix_coordination", "article_promise", "core_argument", "information_gain", "title_candidates", "recommended_title", "abstract", "opening", "outline", "article_markdown", "pull_quotes", "key_takeaways", "share_summary", "share_reason", "discovery_plan", "relationship_handoff", "engagement_strategy", "cta", "claim_map", "used_knowledge_asset_ids", "source_list", "publish_time_checks", "preflight_checks"];
  requireFields(capability, [
    ["data", exactKeys(value, writerKeys)],
    ["data.platform", value?.platform === PLATFORM_OUTPUT_NAMES.wechat],
    ["data.topic_id", text(value?.topic_id)],
    ["data.intent_profile_id", text(value?.intent_profile_id)],
    ["data.content_purpose_id", text(value?.content_purpose_id)],
    ["data.account_context", exactKeys(account, ["subject_type", "account_mode", "matrix_role", "trust_source"])],
    ["data.account_context.subject_type", ["company", "founder", "expert", "personal"].includes(account?.subject_type)],
    ["data.account_context.account_mode", ["official", "expert", "founder_ip", "personal_ip"].includes(account?.account_mode)],
    ["data.account_context.matrix_role", text(account?.matrix_role)],
    ["data.account_context.trust_source", ["institution", "expertise", "experience", "personality", "mixed"].includes(account?.trust_source)],
    ["data.creative_mechanism", ["search_answer", "framework", "case_reconstruction", "industry_analysis", "opinion", "trend_bridge", "story"].includes(value?.creative_mechanism)],
    ["data.journey_stage", ["discover", "understand", "trust", "consider", "convert", "retain"].includes(value?.journey_stage)],
    ["data.matrix_coordination", exactKeys(matrix, ["shared_campaign_topic_id", "differentiation_angle", "prohibited_overlap"])],
    ["data.matrix_coordination.shared_campaign_topic_id", string(matrix?.shared_campaign_topic_id)],
    ["data.matrix_coordination.differentiation_angle", text(matrix?.differentiation_angle)],
    ["data.matrix_coordination.prohibited_overlap", everyString(matrix?.prohibited_overlap)],
    ["data.article_promise", text(value?.article_promise)],
    ["data.core_argument", text(value?.core_argument)],
    ["data.information_gain", text(value?.information_gain)],
    ["data.title_candidates", Array.isArray(titles) && titles.length >= 3 && titles.length <= 5],
    ["data.title_candidates[]", titles?.every((item) => exactKeys(item, ["title", "approach", "claim_ids", "risk"]) && text(item.title) && titleApproaches.has(item.approach) && everyString(item.claim_ids) && item.claim_ids.every((id) => refs.claimIds.has(id)) && risks.has(item.risk))],
    ["data.recommended_title", text(value?.recommended_title) && titles?.some((item) => item.title === value.recommended_title)],
    ["data.abstract", text(value?.abstract)],
    ["data.opening", exactKeys(opening, ["type", "text", "claim_ids"]) && ["event", "scene", "question", "conclusion"].includes(opening?.type) && text(opening?.text) && everyString(opening?.claim_ids) && opening.claim_ids.every((id) => refs.claimIds.has(id))],
    ["data.outline", Array.isArray(outline) && outline.length >= 3],
    ["data.outline[]", outline?.every((item) => exactKeys(item, ["section_id", "heading", "purpose", "relation_to_previous", "claim_ids", "boundary_to_cover"]) && text(item.section_id) && text(item.heading) && text(item.purpose) && relations.has(item.relation_to_previous) && everyString(item.claim_ids) && item.claim_ids.every((id) => refs.claimIds.has(id)) && string(item.boundary_to_cover)) && new Set(outline?.map((item) => item.section_id)).size === outline?.length],
    ["data.article_markdown", text(value?.article_markdown)],
    ["data.pull_quotes", Array.isArray(pullQuotes)],
    ["data.pull_quotes[]", pullQuotes?.every((item) => exactKeys(item, ["text", "claim_ids"]) && text(item.text) && everyString(item.claim_ids) && item.claim_ids.every((id) => refs.claimIds.has(id)))],
    ["data.key_takeaways", everyString(value?.key_takeaways) && value.key_takeaways.length > 0],
    ["data.share_summary", text(value?.share_summary)],
    ["data.share_reason", text(value?.share_reason)],
    ["data.discovery_plan", exactKeys(discovery, ["subscription_value", "search_keywords", "recommendation_hook", "social_sharing_context"]) && text(discovery?.subscription_value) && everyString(discovery?.search_keywords) && text(discovery?.recommendation_hook) && text(discovery?.social_sharing_context)],
    ["data.relationship_handoff", exactKeys(relationship, ["column", "related_content_ids", "menu_path", "keyword_reply", "follow_reason", "primary_next_step"]) && string(relationship?.column) && everyString(relationship?.related_content_ids) && string(relationship?.menu_path) && string(relationship?.keyword_reply) && text(relationship?.follow_reason) && text(relationship?.primary_next_step)],
    ["data.engagement_strategy", exactKeys(engagement, ["mode", "primary_action", "reason", "cta_placement", "cta_text"]) && engagement?.mode === "auto" && ["share", "comment", "follow", "consult", "try", "buy", "register", "none"].includes(engagement?.primary_action) && text(engagement?.reason) && ["ending", "article_section", "none"].includes(engagement?.cta_placement) && string(engagement?.cta_text)],
    ["data.cta", string(value?.cta)],
    ["data.claim_map", Array.isArray(claimMap)],
    ["data.claim_map[]", claimMap?.every((item) => exactKeys(item, ["claim_id", "section_ids"]) && text(item.claim_id) && refs.claimIds.has(item.claim_id) && everyString(item.section_ids) && item.section_ids.length > 0 && item.section_ids.every((id) => outline?.some((section) => section.section_id === id)))],
    ["data.used_knowledge_asset_ids", everyString(value?.used_knowledge_asset_ids) && value.used_knowledge_asset_ids.every((id) => refs.knowledgeIds.has(id))],
    ["data.source_list", Array.isArray(sources) && sources.every((item) => {
      const authority = sourceContentMaster?.source_list?.find((source) => source?.source_id === item?.source_id);
      return object(authority) && exactKeys(item, Object.keys(authority)) && hashUnifiedContent(item) === hashUnifiedContent(authority);
    })],
    ["data.publish_time_checks", Array.isArray(publishChecks) && publishChecks.every((item) => exactKeys(item, ["fact_id", "reason", "check_before"]) && refs.factIds.has(item.fact_id) && text(item.reason) && item.check_before === "publish")],
    ["data.preflight_checks", Array.isArray(checks)],
    ["data.preflight_checks[]", checks?.every((item) => exactKeys(item, ["check", "result", "detail"]) && text(item.check) && ["pass", "fail", "not_applicable"].includes(item.result) && string(item.detail))]
  ]);
  validateWriterContextBinding(capability, value, writerContext);
  const contentClaimIds = new Set([
    ...titles.flatMap((item) => item.claim_ids), ...opening.claim_ids, ...outline.flatMap((item) => item.claim_ids),
    ...pullQuotes.flatMap((item) => item.claim_ids)
  ]);
  const allClaimIds = new Set([...contentClaimIds, ...claimMap.map((item) => item.claim_id)]);
  const mappedClaimIds = new Set(claimMap.map((item) => item.claim_id));
  const requiredChecks = ["title_body_alignment", "argument_continuity", "claim_traceability", "marketing_disclosure", "intent_and_promotion_alignment", "account_identity_alignment", "relationship_handoff_validity", "matrix_differentiation"];
  const usedFactIds = new Set([...allClaimIds].filter((id) => refs.factIds.has(id)));
  const requiredSourceIds = new Set(refs.facts.filter((item) => usedFactIds.has(item.fact_id)).flatMap((item) => item.source_ids || []));
  const checkNames = checks.map((item) => item.check);
  requireFields(capability, [
    ["data.writer_reference_integrity", [...allClaimIds].every((id) => refs.claimIds.has(id)) && [...contentClaimIds].every((id) => mappedClaimIds.has(id)) && [...requiredSourceIds].every((id) => sources.some((item) => item.source_id === id))],
    ["data.article_structure_consistency", outline[0]?.relation_to_previous === "start" && outline.slice(1).every((item) => item.relation_to_previous !== "start") && outline.every((item) => value.article_markdown.includes(`## ${item.heading}`)) && (value.article_markdown.match(/^##\s+/gm) || []).length >= 3],
    ["data.preflight_checks[].check", new Set(checkNames).size === checkNames.length],
    ...requiredChecks.flatMap((name) => {
      const matches = checks.filter((item) => item.check === name);
      const validResults = ["marketing_disclosure", "relationship_handoff_validity", "matrix_differentiation"].includes(name) ? ["pass", "not_applicable"] : ["pass"];
      return [
        [`data.preflight_checks.${name}`, matches.length === 1],
        [`data.preflight_checks.${name}.result`, matches.length === 1 && validResults.includes(matches[0].result)]
      ];
    })
  ]);
}


function exactKeys(value, keys) {
  return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function titleScore(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function validateTitles(capability, value, platform, sourceContentMaster, sourceTitleInput) {
  const brief = value?.title_brief;
  const candidates = value?.candidates;
  const candidateIds = Array.isArray(candidates) ? candidates.map((item) => item?.title_id) : [];
  const candidateIdSet = new Set(candidateIds);
  const candidateTitles = Array.isArray(candidates) ? candidates.map((item) => item?.title) : [];
  const motivations = new Set(["balanced", "safe", "spread", "search", "evergreen", "experiment"]);
  const risks = new Set(["low", "medium", "high"]);
  const scoreKeys = ["fulfillment", "relevance", "specificity", "curiosity", "clarity", "uniqueness", "overall"];
  const recommendationKeys = ["balanced", "safe", "spread", "search", "experiment"];
  const recommendations = value?.recommendations;
  const abTests = value?.ab_tests;
  const signalUsage = value?.same_account_signal_usage;
  const candidateKeys = ["title_id", "title", "motivation", "method", "claim_ids", "scores", "risk", "risk_reasons"];
  const titleInputKeys = ["stage", "platform", "content_master", "completed_content", "preliminary_titles", "content_task_brief", "same_account_title_signals", "editorial_autonomy"];
  const masterClaimIds = new Set([
    ...(sourceContentMaster?.confirmed_facts || []).map((item) => item?.fact_id),
    ...(sourceContentMaster?.supported_interpretations || []).map((item) => item?.interpretation_id),
    ...(sourceContentMaster?.author_opinions || []).map((item) => item?.opinion_id)
  ].filter(text));
  const authorizedSignalIds = new Set((sourceTitleInput?.same_account_title_signals || []).map((item) => item?.signal_id || item?.id).filter(text));
  requireFields(capability, [
    ["input", exactKeys(sourceTitleInput, titleInputKeys)],
    ["input.stage", sourceTitleInput?.stage === "final_after_body"],
    ["input.platform", sourceTitleInput?.platform === PLATFORM_OUTPUT_NAMES[platform]],
    ["input.content_master", object(sourceContentMaster) && object(sourceTitleInput?.content_master) && hashUnifiedContent(sourceTitleInput.content_master) === hashUnifiedContent(sourceContentMaster)],
    ["input.completed_content", object(sourceTitleInput?.completed_content)],
    ["input.preliminary_titles", Array.isArray(sourceTitleInput?.preliminary_titles) && sourceTitleInput.preliminary_titles.length > 0 && sourceTitleInput.preliminary_titles.every((item) => object(item) && text(item.title))],
    ["input.content_task_brief", object(sourceTitleInput?.content_task_brief)],
    ["input.same_account_title_signals", Array.isArray(sourceTitleInput?.same_account_title_signals)],
    ["input.editorial_autonomy", exactKeys(sourceTitleInput?.editorial_autonomy, ["choose_low_risk_titles", "empty_claim_ids_when_no_exact_authorized_id", "do_not_invent_claim_ids"])],
    ["data", exactKeys(value, ["stage", "platform", "title_brief", "candidates", "recommendations", "ab_tests", "same_account_signal_usage"])],
    ["data.stage", value?.stage === "final_after_body"],
    ["data.platform", value?.platform === PLATFORM_OUTPUT_NAMES[platform]],
    ["data.title_brief", exactKeys(brief, ["content_type", "target_reader", "core_conclusion", "reader_takeaway", "strongest_evidence", "real_entities", "freshness_dependency"])],
    ["data.title_brief.content_type", text(brief?.content_type)],
    ["data.title_brief.target_reader", text(brief?.target_reader)],
    ["data.title_brief.core_conclusion", text(brief?.core_conclusion)],
    ["data.title_brief.reader_takeaway", text(brief?.reader_takeaway)],
    ["data.title_brief.strongest_evidence", everyString(brief?.strongest_evidence)],
    ["data.title_brief.real_entities", everyString(brief?.real_entities)],
    ["data.title_brief.freshness_dependency", ["none", "low", "medium", "high"].includes(brief?.freshness_dependency)],
    ["data.candidates", Array.isArray(candidates) && candidates.length >= 5 && candidates.length <= 8],
    ["data.candidates[]", candidates?.every((item) => exactKeys(item, candidateKeys))],
    ["data.candidates[].title_id", candidates?.every((item) => text(item?.title_id)) && candidateIdSet.size === candidateIds.length],
    ["data.candidates[].title", candidates?.every((item) => text(item?.title)) && new Set(candidateTitles).size === candidateTitles.length],
    ["data.candidates[].motivation", candidates?.every((item) => motivations.has(item?.motivation)) && new Set(candidates?.map((item) => item.motivation)).size >= 3],
    ["data.candidates[].method", candidates?.every((item) => text(item?.method))],
    ["data.candidates[].claim_ids", candidates?.every((item) => everyString(item?.claim_ids) && item.claim_ids.every((id) => masterClaimIds.has(id)))],
    ["data.candidates[].scores", candidates?.every((item) => exactKeys(item?.scores, scoreKeys))],
    ...scoreKeys.map((key) => [`data.candidates[].scores.${key}`, candidates?.every((item) => titleScore(item?.scores?.[key]))]),
    ["data.candidates[].risk", candidates?.every((item) => risks.has(item?.risk))],
    ["data.candidates[].risk_reasons", candidates?.every((item) => everyString(item?.risk_reasons))],
    ["data.recommendations", exactKeys(recommendations, recommendationKeys)],
    ...recommendationKeys.map((key) => [`data.recommendations.${key}`, text(recommendations?.[key]) && candidateIdSet.has(recommendations[key])]),
    ["data.recommendations.balanced", candidates?.find((item) => item.title_id === recommendations?.balanced)?.risk !== "high"],
    ["data.ab_tests", Array.isArray(abTests)],
    ["data.ab_tests[].title_a", abTests?.every((item) => exactKeys(item, ["title_a", "title_b", "single_variable", "hypothesis"]) && text(item.title_a) && candidateIdSet.has(item.title_a))],
    ["data.ab_tests[].title_b", abTests?.every((item) => text(item.title_b) && candidateIdSet.has(item.title_b) && item.title_b !== item.title_a)],
    ["data.ab_tests[].single_variable", abTests?.every((item) => text(item.single_variable))],
    ["data.ab_tests[].hypothesis", abTests?.every((item) => text(item.hypothesis))],
    ["data.same_account_signal_usage", exactKeys(signalUsage, ["used", "signal_ids", "interpretation"])],
    ["data.same_account_signal_usage.used", typeof signalUsage?.used === "boolean"],
    ["data.same_account_signal_usage.signal_ids", everyString(signalUsage?.signal_ids) && new Set(signalUsage.signal_ids).size === signalUsage.signal_ids.length && signalUsage.signal_ids.every((id) => authorizedSignalIds.has(id)) && (signalUsage.used ? signalUsage.signal_ids.length > 0 : signalUsage.signal_ids.length === 0)],
    ["data.same_account_signal_usage.interpretation", signalUsage?.used ? text(signalUsage?.interpretation) : string(signalUsage?.interpretation)]
  ]);
}

function successStatusGate(capability, status, label) {
  if (status === "success") return;
  throw Object.assign(new Error(`${label} output is not ready for candidate generation`), {
    code: "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY",
    statusCode: 409,
    details: { capability, fieldPaths: ["status"] }
  });
}

function validateWechatReview(capability, value, sourceContentMaster, sourceSkillInput, sourceArticle) {
  validateWechatInput(capability, sourceSkillInput, sourceContentMaster, sourceArticle);
  const refs = masterReferenceSets(sourceContentMaster);
  const findings = value?.findings;
  const patches = value?.patches;
  requireFields(capability, [
    ["data", exactKeys(value, ["decision", "findings", "patches", "changes", "fact_recheck_required", "publish_time_checks"])],
    ["data.decision", ["pass", "revise", "block"].includes(value?.decision)],
    ["data.findings", Array.isArray(findings)],
    ["data.findings[]", findings?.every((item) => exactKeys(item, ["finding_id", "category", "location", "severity", "issue", "required_action", "claim_ids"]) && text(item.finding_id) && ["fact", "source", "argument", "structure", "voice", "readability", "marketing", "platform_risk"].includes(item.category) && text(item.location) && ["suggestion", "warning", "blocker"].includes(item.severity) && text(item.issue) && text(item.required_action) && everyString(item.claim_ids) && item.claim_ids.every((id) => refs.claimIds.has(id)))],
    ["data.patches", Array.isArray(patches)],
    ["data.patches[]", patches?.every((item) => exactKeys(item, ["target", "before", "after", "reason"]) && text(item.target) && string(item.before) && string(item.after) && text(item.reason))],
    ["data.changes", Array.isArray(value?.changes)],
    ["data.fact_recheck_required", typeof value?.fact_recheck_required === "boolean"],
    ["data.publish_time_checks", Array.isArray(value?.publish_time_checks)],
    ["data.review_reference_integrity", findings?.every((item) => item.claim_ids.every((id) => refs.claimIds.has(id)))],
    ["data.review_readiness", sourceSkillInput?.mode !== "report_only" || (patches?.length === 0 && value?.changes?.length === 0)],
    ["data.decision", findings?.some((item) => item.severity === "blocker") ? value?.decision === "block" : true]
  ]);
}

function validateWechatImagePlan(capability, runtimeOutput, sourceContentMaster, sourceSkillInput) {
  // Editorial suggestions are retained for the human editing pass, but they do
  // not constitute a content-safety stop. Only an explicit block, a factual
  // recheck, or a blocker finding prevents image planning.
  if (sourceSkillInput?.article_review?.decision === "block"
    || sourceSkillInput?.article_review?.fact_recheck_required !== false
    || sourceSkillInput?.article_review?.findings?.some((item) => item?.severity === "blocker")) {
    fail(capability, ["input.article_review"], "WeChat image planning is blocked by a safety or factual review finding");
  }
  return adaptAuthoritativeWechatImagePlanOutput(runtimeOutput, {
    article: sourceSkillInput?.article,
    contentMaster: sourceContentMaster,
    authorizedAssets: sourceSkillInput?.authorized_assets || [],
    imageRuntime: sourceSkillInput?.image_runtime || null
  });
}

export function validateUnifiedSkillDomainInput({ capability, sourceSkillInput, sourceContentMaster, sourceArticle = null }) {
  if (capability === "generate-content-outline" && sourceSkillInput?.strict_sequence_contract != null) {
    validateStrictSequenceContract(sourceSkillInput.strict_sequence_contract, sourceContentMaster);
  }
  if (capability === "write-xhs-content") validateXhsInput(capability, sourceSkillInput, sourceContentMaster);
  if (["write-wechat-article", "review-wechat-article"].includes(capability)) {
    validateWechatInput(capability, sourceSkillInput, sourceContentMaster, sourceArticle);
  }
  return structuredClone(sourceSkillInput);
}

export function validateUnifiedSkillDomainOutput({
  capability, platform, outputContract, runtimeOutput, sourceContentMaster = null, sourceTitleInput = null,
  sourceSkillInput = null, sourceArticle = null, runtimeOutputMaterializer = materializeUnifiedSkillRuntimeOutput, task = null
}) {
  runtimeOutput = runtimeOutputMaterializer({ capability, runtimeOutput, sourceSkillInput, sourceContentMaster });
  const expectedContracts = {
    "build-content-master": "ContentMaster@2.0",
    "generate-content-outline": "ContentOutline@1.0",
    "write-xhs-content": "XhsPostPackage@2.0",
    "write-wechat-article": "WechatArticle@2.0",
    "generate-platform-titles": "PlatformTitleList@1.0",
    "review-wechat-article": "WechatArticleReview@1.0",
    "plan-wechat-images": "WechatImagePlan@1.0"
  };
  const allowedStatuses = capability === "generate-content-outline"
    ? ["ready", "needs_review", "blocked"]
    : capability === "write-xhs-content"
      ? ["success", "partial", "failed", "needs_review"]
      : ["write-wechat-article", "review-wechat-article"].includes(capability)
        ? ["success", "failed", "needs_review"]
      : capability === "generate-platform-titles"
        ? ["success", "failed", "needs_review"]
      : capability === "plan-wechat-images"
      ? ["success", "partial", "needs_review"]
      : ["success", "needs_review"];
  requireFields(capability, [
    ["outputContract", text(outputContract) && expectedContracts[capability] === outputContract],
    ["status", object(runtimeOutput) && allowedStatuses.includes(runtimeOutput.status)],
    ["data", object(runtimeOutput?.data)],
    ["warnings", Array.isArray(runtimeOutput?.warnings)],
    ["blocked_reasons", Array.isArray(runtimeOutput?.blocked_reasons)]
  ]);
  if (capability === "generate-content-outline") outlineStatusGate(capability, runtimeOutput.status);
  if (capability === "write-xhs-content" && runtimeOutput.status !== "success") {
    throw Object.assign(new Error("Xiaohongshu writer output is not ready for candidate generation"), {
      code: "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY",
      statusCode: 409,
      details: { capability, fieldPaths: ["status"] }
    });
  }
  if (capability === "write-wechat-article") successStatusGate(capability, runtimeOutput.status, "WeChat writer");
  if (capability === "review-wechat-article") successStatusGate(capability, runtimeOutput.status, "WeChat article review");
  if (capability === "plan-wechat-images") successStatusGate(capability, runtimeOutput.status, "WeChat image plan");
  if (capability === "generate-platform-titles") successStatusGate(capability, runtimeOutput.status, "Platform title");
  const value = runtimeOutput.data;
  if (capability === "build-content-master") validateMaster(capability, value, sourceSkillInput);
  else if (capability === "generate-content-outline") validateOutline(capability, value, platform, sourceContentMaster);
  else if (capability === "write-xhs-content") validateXhsWriter(capability, value, sourceContentMaster, sourceSkillInput);
  else if (capability === "write-wechat-article") {
    if (task === "write_wechat_narrative_creative_draft") {
      validateWechatInput(capability, sourceSkillInput, sourceContentMaster);
      requireFields(capability, [["data.article_markdown", text(value?.article_markdown)], ["data.title_candidates", Array.isArray(value?.title_candidates) && value.title_candidates.length >= 3], ["data.outline", Array.isArray(value?.outline) && value.outline.length >= 3], ["data.information_gain", text(value?.information_gain)]]);
    } else validateWechatWriter(capability, value, sourceContentMaster, sourceSkillInput);
  }
  else if (capability === "generate-platform-titles") validateTitles(capability, value, platform, sourceContentMaster, sourceTitleInput);
  else if (capability === "review-wechat-article") validateWechatReview(capability, value, sourceContentMaster, sourceSkillInput, sourceArticle);
  else if (capability === "plan-wechat-images") {
    return validateWechatImagePlan(capability, runtimeOutput, sourceContentMaster, sourceSkillInput);
  }
  else fail(capability, ["capability"], "Unified production has no deterministic validator for this Skill capability");
  if (capability === "review-wechat-article" && (value.decision === "block" || value.findings.some((item) => item.severity === "blocker") || value.fact_recheck_required !== false)) {
    throw Object.assign(new Error("WeChat article review did not pass candidate readiness"), {
      code: "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY",
      statusCode: 409,
      details: { capability, fieldPaths: ["data.review_readiness"] }
    });
  }
  if (capability === "generate-content-outline") {
    return mapCanonicalOutline(value);
  }
  if (capability !== "build-content-master") return structuredClone(value);
  return {
    schemaVersion: "1.0",
    contract: "SharedContentMaster@1.0",
    id: value.content_master_id,
    sourceOutputContract: outputContract,
    sourceOutputHash: hashUnifiedContent(runtimeOutput),
    contentMaster: structuredClone(value),
    confirmed_facts: structuredClone(value.confirmed_facts),
    supported_interpretations: structuredClone(value.supported_interpretations),
    author_opinions: structuredClone(value.author_opinions),
    source_list: structuredClone(value.source_list)
  };
}

export function createUnifiedSkillOutputFact({ evidence, platform, step, executionPlan, runtimeOutput, verifiedDomainOutput = null }) {
  const actualOutputHash = hashUnifiedContent(runtimeOutput);
  if (evidence.outputHash !== actualOutputHash) {
    throw Object.assign(new Error("Runtime output hash does not match the persisted Skill output"), {
      code: "UNIFIED_SKILL_OUTPUT_HASH_MISMATCH",
      statusCode: 409,
      details: { capability: step.capability }
    });
  }
  const factPlatform = step.id === "content_master" ? "shared" : platform;
  const base = {
    schemaVersion: "1.0",
    contract: "UnifiedSkillOutputFact@1.0",
    id: `skill_output_fact:${evidence.id}`,
    invocationRef: ref(evidence.id, evidence.invocationHash),
    executionRecordRef: ref(evidence.executionRecord.invocationId, evidence.executionRecordHash),
    platform: factPlatform,
    stepId: step.id,
    capability: step.capability,
    inputContract: step.inputContract,
    outputContract: step.outputContract,
    planRef: ref(`execution_plan:${evidence.executionPlanHash.slice(0, 16)}`, evidence.executionPlanHash),
    bundleHash: evidence.bundleHash,
    inputHash: evidence.inputHash,
    outputHash: evidence.outputHash,
    runtimeOutput: structuredClone(runtimeOutput),
    verifiedDomainOutput: ["build-content-master", "generate-content-outline", "plan-wechat-images"].includes(step.capability)
      ? structuredClone(verifiedDomainOutput)
      : null,
    executionMode: evidence.executionMode,
    status: evidence.status,
    productionEligibleOutput: evidence.executionRecord?.productionEligibleOutput === true
  };
  return { ...base, factHash: hashUnifiedContent(base) };
}

function factFor(facts, platform, capability) {
  const matches = facts.filter((item) => item.platform === platform && item.capability === capability);
  if (matches.length !== 1) fail(capability, ["outputFacts"], `Expected exactly one verified ${capability} output fact for ${platform}`);
  return matches[0];
}

function factOutputRef(fact) {
  return ref(fact.id, fact.outputHash);
}

function verifiedFactRef(fact) {
  const factBase = structuredClone(fact);
  delete factBase.factHash;
  if (hashUnifiedContent(factBase) !== fact.factHash || hashUnifiedContent(fact.runtimeOutput) !== fact.outputHash) {
    fail(fact.capability, ["outputFacts"], "Verified Skill output fact hash mismatch");
  }
  return ref(fact.id, fact.factHash);
}

function reviewItem(item, index) {
  return {
    id: String(item?.section_id || item?.page || item?.id || `item_${index + 1}`),
    order: index + 1,
    purpose: String(item?.role || item?.purpose || "content")
  };
}

export function deriveUnifiedPlatformCandidate({ contentProjectId, platform, platformRunRef, outputFacts }) {
  const writerCapability = platform === "xiaohongshu" ? "write-xhs-content" : "write-wechat-article";
  const writerFact = factFor(outputFacts, platform, writerCapability);
  const titleFact = factFor(outputFacts, platform, "generate-platform-titles");
  if (writerFact.runtimeOutput?.status !== "success") fail(writerCapability, ["status"], "Writer output fact is not candidate-ready");
  if (titleFact.runtimeOutput?.status !== "success") fail("generate-platform-titles", ["status"], "Title output fact is not candidate-ready");
  const writer = writerFact.runtimeOutput.data;
  const titles = titleFact.runtimeOutput.data;
  const balancedTitleId = titles.recommendations?.balanced;
  const balancedMatches = titles.candidates?.filter((item) => item.title_id === balancedTitleId) || [];
  if (balancedMatches.length !== 1 || balancedMatches[0].risk === "high") fail("generate-platform-titles", ["data.recommendations.balanced"], "Balanced title recommendation is inconsistent");
  const balancedTitle = balancedMatches[0];
  const finalTitleBinding = {
    recommendation: "balanced",
    titleId: balancedTitle.title_id,
    title: balancedTitle.title,
    titleCandidateHash: hashUnifiedContent(balancedTitle),
    recommendations: structuredClone(titles.recommendations),
    titleOutputFactRef: verifiedFactRef(titleFact),
    titleOutputRef: factOutputRef(titleFact),
    titleOutputHash: titleFact.outputHash,
    completedContentFactRef: verifiedFactRef(writerFact),
    completedContentRef: factOutputRef(writerFact),
    completedContentHash: writerFact.outputHash
  };
  const baseCandidate = {
    schemaVersion: "1.0",
    contract: "UnifiedPlatformCandidate@1.0",
    platform,
    platformRunRef: structuredClone(platformRunRef),
    sourceOutputFactRefs: [writerFact, titleFact].map((item) => ref(item.id, item.factHash)),
    writerOutputRef: factOutputRef(writerFact),
    titleOutputRef: factOutputRef(titleFact),
    finalTitleBinding
  };
  const candidateIdentityHash = hashUnifiedContent({
    contentProjectId,
    platform,
    writerOutputHash: writerFact.outputHash,
    titleOutputHash: titleFact.outputHash
  });
  const candidateRef = ref(
    `candidate:${contentProjectId}:${platform}:${candidateIdentityHash.slice(0, 24)}`,
    hashUnifiedContent(baseCandidate)
  );
  if (platform === "xiaohongshu") {
    const pageSpecs = writer.deck.pages.map((item) => structuredClone(item));
    return {
      candidateRef,
      candidate: {
        ...baseCandidate,
        candidateRef,
        titleCandidates: structuredClone(titles.candidates),
        finalTitle: balancedTitle.title,
        postCopy: { ...structuredClone(writer.post_copy), recommended_title: balancedTitle.title },
        deckPageSpecs: pageSpecs,
        renderedPageRevisionRefs: [],
        artifactState: "visual_artifacts_required",
        blockers: ["visual_artifacts_required"]
      },
      candidateSet: {
        platform,
        candidateRef,
        titleRef: factOutputRef(titleFact),
        bodyVersionRef: factOutputRef(writerFact),
        pageRevisionRefs: [],
        items: pageSpecs.map((item, index) => reviewItem(item, index)),
        artifactState: "visual_artifacts_required",
        blockers: ["visual_artifacts_required"]
      }
    };
  }
  const reviewFact = factFor(outputFacts, platform, "review-wechat-article");
  const imagePlanFact = factFor(outputFacts, platform, "plan-wechat-images");
  const masterFact = factFor(outputFacts, "shared", "build-content-master");
  const reviewFactRef = verifiedFactRef(reviewFact);
  const imagePlanFactRef = verifiedFactRef(imagePlanFact);
  const masterFactRef = verifiedFactRef(masterFact);
  if (reviewFact.runtimeOutput?.status !== "success"
    || reviewFact.runtimeOutput?.data?.decision === "block"
    || reviewFact.runtimeOutput?.data?.fact_recheck_required !== false
    || reviewFact.runtimeOutput?.data?.findings?.some((item) => item?.severity === "blocker")) {
    fail("review-wechat-article", ["data.review_readiness"], "WeChat review output fact is not candidate-ready");
  }
  if (imagePlanFact.runtimeOutput?.status !== "success" || imagePlanFact.runtimeOutput?.blocked_reasons?.length) fail("plan-wechat-images", ["status", "blocked_reasons"], "WeChat image plan output fact is not candidate-ready");
  if (imagePlanFact.status !== "completed" || imagePlanFact.executionMode !== "real" || imagePlanFact.productionEligibleOutput !== true) {
    fail("plan-wechat-images", ["outputFacts"], "WeChat image plan output fact is not production-eligible");
  }
  const canonicalImagePlan = imagePlanFact.verifiedDomainOutput;
  const canonicalImagePlanBase = structuredClone(canonicalImagePlan || {});
  delete canonicalImagePlanBase.planHash;
  if (canonicalImagePlan?.contract !== "WechatCanonicalImagePlan@1.0" || canonicalImagePlan.authority !== true
    || canonicalImagePlan.planHash !== hashWechatArtifactValue(canonicalImagePlanBase)) fail("plan-wechat-images", ["outputFacts"], "Verified canonical WeChat image plan is missing or invalid");
  const imagePlan = imagePlanFact.runtimeOutput.data;
  const resourceRequired = imagePlan.cover.strategy !== "no_image" || imagePlan.slots.some((item) => item.strategy !== "no_image");
  const sourceRefs = [finalTitleBinding.completedContentFactRef, finalTitleBinding.titleOutputFactRef, reviewFactRef, imagePlanFactRef, masterFactRef];
  const wechatCandidateIdentityHash = hashUnifiedContent({
    contentProjectId, platform, writerOutputHash: writerFact.outputHash, titleOutputHash: titleFact.outputHash,
    reviewOutputHash: reviewFact.outputHash, imagePlanOutputHash: imagePlanFact.outputHash, masterOutputHash: masterFact.outputHash,
    imagePlanExecutionRecordRef: imagePlanFact.executionRecordRef
  });
  const wechatBaseCandidate = { ...baseCandidate, sourceOutputFactRefs: sourceRefs };
  const wechatCandidateRef = ref(
    `candidate:${contentProjectId}:${platform}:${wechatCandidateIdentityHash.slice(0, 24)}`,
    hashUnifiedContent(wechatBaseCandidate)
  );
  const imagePlanAuthority = {
    schemaVersion: "1.0", contract: "WechatImagePlanAuthority@1.0",
    candidateRef: wechatCandidateRef,
    imagePlanOutputFactRef: imagePlanFactRef,
    imagePlanOutputRef: factOutputRef(imagePlanFact),
    executionRecordRef: structuredClone(imagePlanFact.executionRecordRef),
    articleOutputFactRef: verifiedFactRef(writerFact),
    reviewOutputFactRef: reviewFactRef,
    contentMasterOutputFactRef: masterFactRef,
    canonicalPlanHash: canonicalImagePlan.planHash,
    productionEligible: true
  };
  return {
    candidateRef: wechatCandidateRef,
    candidate: {
      ...wechatBaseCandidate,
      sourceOutputFactRefs: sourceRefs,
      candidateRef: wechatCandidateRef,
      titleCandidates: structuredClone(titles.candidates),
      finalTitle: balancedTitle.title,
      article: { ...structuredClone(writer), recommended_title: balancedTitle.title },
      articleReview: structuredClone(reviewFact.runtimeOutput.data),
      imagePlan: structuredClone(imagePlan),
      imagePlanAuthority,
      resourceArtifactRefs: [],
      artifactState: resourceRequired ? "pre_upload_resource_required" : "pre_upload_only",
      deliverySemantics: "pre_upload_only",
      postUploadArtifactRef: null,
      blockers: resourceRequired ? ["image_resources_required", "post_upload_artifact_not_available"] : ["post_upload_artifact_not_available"]
    },
    candidateSet: {
      platform,
      candidateRef: wechatCandidateRef,
      titleRef: factOutputRef(titleFact),
      bodyVersionRef: factOutputRef(writerFact),
      articleRef: factOutputRef(writerFact),
      imagePlanRef: factOutputRef(imagePlanFact),
      imagePlanAuthority: structuredClone(imagePlanAuthority),
      pageRevisionRefs: [],
      items: writer.outline.map((item, index) => reviewItem(item, index)),
      artifactState: resourceRequired ? "pre_upload_resource_required" : "pre_upload_only",
      deliverySemantics: "pre_upload_only",
      postUploadArtifactRef: null,
      blockers: resourceRequired ? ["image_resources_required", "post_upload_artifact_not_available"] : ["post_upload_artifact_not_available"]
    }
  };
}
