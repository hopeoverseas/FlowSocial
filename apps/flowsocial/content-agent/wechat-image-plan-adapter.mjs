import { createHash } from "node:crypto";

const HASH = /^[a-f0-9]{64}$/;
const STRATEGIES = new Set(["authorized_asset", "html_chart", "generated_raster", "no_image"]);
const PURPOSES = new Set(["explain", "prove", "compare", "pace", "mood"]);
const IMAGE_USE_CASES = new Set(["illustration-story", "photorealistic-natural", "stylized-concept", "product-context", "texture-background"]);
const IMAGE_ASSET_TYPES = new Set(["wechat-cover", "wechat-inline"]);
const IMAGE_SIZES = new Set(["1536x1024", "1024x1536", "1024x1024"]);

const clone = (value) => structuredClone(value);
const clean = (value) => String(value ?? "").trim();

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export const hashWechatArtifactValue = (value) => createHash("sha256").update(canonical(value)).digest("hex");

export function projectWechatImageRuntimeCapability(authorizedAssets = [], { generatedRasterAvailable = false } = {}) {
  const hasAuthorizedAssets = Array.isArray(authorizedAssets) && authorizedAssets.length > 0;
  const instruction = generatedRasterAvailable
    ? "只规划当前运行时能够物化的策略。封面和承担场景、隐喻、情绪或概念解释的正文插图优先使用 generated_raster，并根据对应正文语义编写完整无文字整图 Prompt；只有需要精确呈现步骤、比较、数据或清单时才使用 html_chart。不得把文章标题原样排成图片。"
    : "只规划当前运行时能够物化的策略；不得输出 generated_raster。html_chart 必须解释正文要点、流程、比较或清单，不得把文章标题原样排成图片。";
  return Object.freeze({
    allowed_strategies: Object.freeze([...(hasAuthorizedAssets ? ["authorized_asset"] : []), "html_chart", ...(generatedRasterAvailable ? ["generated_raster"] : []), "no_image"]),
    generated_raster_available: generatedRasterAvailable === true,
    illustrated_delivery_required: true,
    minimum_inline_images: 1,
    html_chart_mode: "content_derived_semantic_diagram",
    instruction
  });
}

function fail(code, details = null) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details });
}

function requireRef(value, scope) {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "hash,id" || !clean(value.id) || !HASH.test(value.hash || "")) fail("WECHAT_IMAGE_PLAN_REF_INVALID", scope);
  return clone(value);
}

function exactKeys(value, keys, code, details = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail(code, details);
}

function stringArray(value, code, details = null) {
  if (!Array.isArray(value) || value.some((item) => !clean(item))) fail(code, details);
  return [...value];
}

function optionalBindings(bindings) {
  if (bindings == null) return null;
  return {
    contentProjectRef: requireRef(bindings.contentProjectRef, "contentProjectRef"),
    ...(bindings.materializedContentProjectRef == null ? {} : { materializedContentProjectRef: requireRef(bindings.materializedContentProjectRef, "materializedContentProjectRef") }),
    platformRunRef: requireRef(bindings.platformRunRef, "platformRunRef"),
    candidateRef: requireRef(bindings.candidateRef, "candidateRef"),
    articleRef: requireRef(bindings.articleRef, "articleRef"),
    imagePlanOutputFactRef: requireRef(bindings.imagePlanOutputFactRef, "imagePlanOutputFactRef")
  };
}

function normalizedAssetId(declaration, strategy, scope) {
  const top = clean(declaration.asset_id);
  const nested = clean(declaration.image_spec?.asset_id);
  if (top && nested && top !== nested) fail("WECHAT_IMAGE_PLAN_ASSET_ID_CONFLICT", { scope, top, nested });
  let assetId = nested || top;
  if (["generated_raster", "html_chart"].includes(strategy) && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(assetId)) {
    // Provider-authored labels are not authority-bearing asset references. Keep
    // generated image plans usable by assigning a deterministic internal ID;
    // authorized_asset declarations still fail closed on invalid references.
    assetId = `wechat_${String(scope).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "image"}`.slice(0, 80);
  }
  if (strategy !== "no_image" && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(assetId)) fail("WECHAT_IMAGE_PLAN_ASSET_ID_INVALID", scope);
  return assetId || null;
}

function normalizeDeclaration(input, { role, index }) {
  const declaration = input && typeof input === "object" ? clone(input) : {};
  const scope = role === "cover" ? "cover" : `slots[${index}]`;
  const strategy = clean(declaration.strategy || declaration.render_strategy);
  if (!STRATEGIES.has(strategy)) fail("WECHAT_IMAGE_PLAN_STRATEGY_INVALID", { scope, strategy });
  const slotId = role === "cover" ? "cover" : clean(declaration.slot_id);
  if (role !== "cover" && !slotId) fail("WECHAT_IMAGE_PLAN_SLOT_ID_REQUIRED", scope);
  const purpose = clean(declaration.purpose);
  if (role !== "cover" && !PURPOSES.has(purpose)) fail("WECHAT_IMAGE_PLAN_PURPOSE_INVALID", { scope, purpose });
  const assetId = normalizedAssetId(declaration, strategy, scope);
  const prompt = clean(declaration.image_spec?.prompt || declaration.prompt) || null;
  if (strategy === "generated_raster" && !prompt) fail("WECHAT_IMAGE_PLAN_GENERATED_PROMPT_REQUIRED", scope);
  const imageSpec = declaration.image_spec && typeof declaration.image_spec === "object" ? {
    ...clone(declaration.image_spec),
    asset_id: assetId,
    prompt
  } : strategy === "generated_raster" ? { asset_id: assetId, prompt } : null;
  return {
    slotId,
    role,
    afterSectionId: role === "cover" ? null : clean(declaration.after_section_id) || null,
    purpose: purpose || null,
    strategy,
    assetId,
    claimIds: Array.isArray(declaration.claim_ids) ? [...declaration.claim_ids] : [],
    caption: clean(declaration.caption),
    imageSpec,
    source: declaration
  };
}

/**
 * Canonical projection for the stable plan-wechat-images output. It accepts the
 * Skill status/data envelope or the stored data projection, but never invents
 * cover or inline slots and preserves explicit no_image declarations.
 */
export function adaptWechatImagePlanOutput(input, options = {}) {
  const envelope = input && typeof input === "object" && "data" in input ? input : null;
  if (envelope && !["success", "partial", "needs_review"].includes(envelope.status)) fail("WECHAT_IMAGE_PLAN_SKILL_STATUS_BLOCKED", envelope.status);
  const plan = envelope ? envelope.data : input;
  if (!plan || typeof plan !== "object") fail("WECHAT_IMAGE_PLAN_DATA_REQUIRED");
  const planId = clean(plan.plan_id);
  if (!planId) fail("WECHAT_IMAGE_PLAN_ID_REQUIRED");
  const cover = plan.cover == null ? null : normalizeDeclaration(plan.cover, { role: "cover", index: -1 });
  const slots = (Array.isArray(plan.slots) ? plan.slots : []).map((slot, index) => normalizeDeclaration(slot, { role: "inline", index }));
  const ids = new Set();
  for (const item of slots) {
    if (ids.has(item.slotId)) fail("WECHAT_IMAGE_PLAN_SLOT_ID_DUPLICATE", item.slotId);
    ids.add(item.slotId);
  }
  const base = {
    schemaVersion: "1.0",
    contract: "WechatCanonicalImagePlan@1.0",
    planId,
    skillStatus: envelope?.status || options.skillStatus || "stored_data_projection",
    bindings: optionalBindings(options.bindings),
    cover,
    slots,
    declarations: [cover, ...slots].filter(Boolean),
    resourceRequirements: [cover, ...slots].filter((item) => item && item.strategy !== "no_image").map((item) => ({ slotId: item.slotId, role: item.role, strategy: item.strategy, assetId: item.assetId })),
    warnings: clone(envelope?.warnings || options.warnings || []),
    blockedReasons: clone(envelope?.blocked_reasons || options.blockedReasons || [])
  };
  return { ...base, planHash: hashWechatArtifactValue(base) };
}

function authorityReferenceSets(options) {
  const article = options.article;
  const master = options.contentMaster?.contentMaster || options.contentMaster;
  if (!article || !master) fail("WECHAT_IMAGE_PLAN_AUTHORITY_CONTEXT_REQUIRED");
  const sectionClaims = new Map((article.outline || []).map((item) => [clean(item.section_id), new Set(item.claim_ids || [])]));
  const articleClaims = new Map((article.claim_map || []).map((item) => [clean(item.claim_id), new Set(item.section_ids || [])]));
  const masterClaims = new Map((master.confirmed_facts || []).map((item) => [clean(item.fact_id), item]));
  const sourceIds = new Set((master.source_list || []).map((item) => clean(item.source_id)));
  const articleSourceIds = new Set((article.source_list || []).map((item) => clean(item.source_id)));
  const assets = new Map((options.authorizedAssets || []).map((item) => [clean(item.asset_id || item.id), item]));
  if (!sectionClaims.size) fail("WECHAT_IMAGE_PLAN_ARTICLE_OUTLINE_REQUIRED");
  return { sectionClaims, articleClaims, masterClaims, sourceIds, articleSourceIds, assets,
    articleSectionIds: [...sectionClaims.keys()] };
}

function resolveArticleSectionAnchor(value, refs, scope) {
  const supplied = clean(value);
  if (refs.sectionClaims.has(supplied)) return supplied;
  // Models sometimes translate an exact article id such as W2 into the
  // schema-shaped alias `section_2`. Resolve only that explicit ordinal alias;
  // never infer an anchor from the image slot position or an arbitrary label.
  const ordinal = supplied.match(/^(?:section[-_]?|s|w)(\d+)$/i)?.[1];
  const resolved = ordinal ? refs.articleSectionIds[Number(ordinal) - 1] : null;
  if (!resolved) fail("WECHAT_IMAGE_PLAN_SECTION_REF_INVALID", { scope, afterSectionId: supplied });
  return resolved;
}

function strictImageSpec(spec, { role, assetId, scope }) {
  exactKeys(spec, ["asset_id", "use_case", "asset_type", "prompt", "reference_asset_ids", "design_dna_version", "size", "must_avoid", "text_policy"], "WECHAT_IMAGE_PLAN_IMAGE_SPEC_FIELDS_INVALID", scope);
  if (clean(spec.asset_id) !== assetId) fail("WECHAT_IMAGE_PLAN_IMAGE_SPEC_ASSET_MISMATCH", scope);
  if (!IMAGE_USE_CASES.has(spec.use_case)) fail("WECHAT_IMAGE_PLAN_IMAGE_SPEC_USE_CASE_INVALID", scope);
  if (!IMAGE_ASSET_TYPES.has(spec.asset_type) || spec.asset_type !== (role === "cover" ? "wechat-cover" : "wechat-inline")) fail("WECHAT_IMAGE_PLAN_IMAGE_SPEC_ASSET_TYPE_INVALID", scope);
  if (!clean(spec.prompt) || !clean(spec.design_dna_version) || !IMAGE_SIZES.has(spec.size)) fail("WECHAT_IMAGE_PLAN_IMAGE_SPEC_INCOMPLETE", scope);
  stringArray(spec.reference_asset_ids, "WECHAT_IMAGE_PLAN_IMAGE_SPEC_REFERENCE_ASSETS_INVALID", scope);
  const avoid = stringArray(spec.must_avoid, "WECHAT_IMAGE_PLAN_IMAGE_SPEC_MUST_AVOID_INVALID", scope).map((item) => item.toLowerCase());
  if (spec.text_policy !== "no_text_in_image" || !["文字", "水印", "logo"].every((term) => avoid.includes(term))) fail("WECHAT_IMAGE_PLAN_NO_TEXT_POLICY_REQUIRED", scope);
  return clone(spec);
}

function strictDeclaration(input, context) {
  const { role, index, refs } = context;
  const scope = role === "cover" ? "cover" : `slots[${index}]`;
  exactKeys(input, role === "cover"
    ? ["purpose", "strategy", "asset_id", "claim_ids", "image_spec"]
    : ["slot_id", "after_section_id", "purpose", "strategy", "claim_ids", "asset_id", "image_spec"], "WECHAT_IMAGE_PLAN_DECLARATION_FIELDS_INVALID", scope);
  const strategy = clean(input.strategy);
  if (!STRATEGIES.has(strategy) || !PURPOSES.has(input.purpose)) fail("WECHAT_IMAGE_PLAN_DECLARATION_INVALID", scope);
  const slotId = role === "cover" ? "cover" : clean(input.slot_id);
  if (role !== "cover" && !slotId) fail("WECHAT_IMAGE_PLAN_SLOT_ID_REQUIRED", scope);
  const afterSectionId = role === "cover" ? null : resolveArticleSectionAnchor(input.after_section_id, refs, scope);
  const suppliedClaimIds = stringArray(input.claim_ids, "WECHAT_IMAGE_PLAN_CLAIM_REFS_INVALID", scope);
  if (new Set(suppliedClaimIds).size !== suppliedClaimIds.length) fail("WECHAT_IMAGE_PLAN_CLAIM_REFS_DUPLICATE", scope);
  // Generated editorial images and original article-derived charts are not
  // evidence. If the model invents or cross-binds a claim id, drop that
  // advisory binding instead of turning the whole article into a dead end.
  // Authorized assets remain strict because they can assert external facts.
  const claimIds = ["generated_raster", "html_chart"].includes(strategy)
    ? suppliedClaimIds.filter((claimId) => {
      const masterClaim = refs.masterClaims.get(claimId);
      if (!masterClaim || !refs.articleClaims.has(claimId)) return false;
      if (role !== "cover" && (!refs.sectionClaims.get(afterSectionId).has(claimId) || !refs.articleClaims.get(claimId).has(afterSectionId))) return false;
      return Array.isArray(masterClaim.source_ids) && masterClaim.source_ids.length > 0
        && masterClaim.source_ids.every((id) => refs.sourceIds.has(id) && refs.articleSourceIds.has(id));
    })
    : suppliedClaimIds;
  for (const claimId of claimIds) {
    const masterClaim = refs.masterClaims.get(claimId);
    if (!masterClaim || !refs.articleClaims.has(claimId)) fail("WECHAT_IMAGE_PLAN_CLAIM_REF_UNKNOWN", { scope, claimId });
    if (role !== "cover" && (!refs.sectionClaims.get(afterSectionId).has(claimId) || !refs.articleClaims.get(claimId).has(afterSectionId))) fail("WECHAT_IMAGE_PLAN_CLAIM_REF_CROSS_SECTION", { scope, claimId });
    if (!Array.isArray(masterClaim.source_ids) || !masterClaim.source_ids.length
      || masterClaim.source_ids.some((id) => !refs.sourceIds.has(id) || !refs.articleSourceIds.has(id))) fail("WECHAT_IMAGE_PLAN_SOURCE_REF_INVALID", { scope, claimId });
  }
  const assetId = normalizedAssetId(input, strategy, scope);
  let imageSpec = null;
  if (strategy === "no_image") {
    if (assetId !== null || input.image_spec !== null || claimIds.length) fail("WECHAT_IMAGE_PLAN_NO_IMAGE_FIELDS_INVALID", scope);
  } else if (strategy === "generated_raster") {
    if (!assetId) fail("WECHAT_IMAGE_PLAN_ASSET_ID_INVALID", scope);
    imageSpec = strictImageSpec({ ...clone(input.image_spec), asset_id: assetId }, { role, assetId, scope });
  } else if (strategy === "html_chart") {
    // html_chart is an original deterministic artifact compiled from the
    // already-authorized article. It is not an external registry asset and
    // therefore must not be forced through the authorized_asset license path.
    if (!assetId || input.image_spec !== null) fail("WECHAT_IMAGE_PLAN_RESOURCE_DECLARATION_INVALID", scope);
  } else {
    if (!assetId || input.image_spec !== null) fail("WECHAT_IMAGE_PLAN_RESOURCE_DECLARATION_INVALID", scope);
    const asset = refs.assets.get(assetId);
    if (!asset || clean(asset.strategy || asset.type) !== strategy || asset.status !== "approved" || asset.allowsPublication !== true
      || !clean(asset.source_id) || !refs.sourceIds.has(clean(asset.source_id)) || !HASH.test(asset.source_sha256 || "")) fail("WECHAT_IMAGE_PLAN_ASSET_REF_INVALID", { scope, assetId });
  }
  const source = clone(input);
  if (role !== "cover") source.after_section_id = afterSectionId;
  return { slotId, role, afterSectionId, purpose: input.purpose, strategy, assetId, claimIds, caption: "", imageSpec, source };
}

/** Strict authority path for new production facts. Stored/raw plans must use the read-only adapter below. */
export function adaptAuthoritativeWechatImagePlanOutput(input, options = {}) {
  exactKeys(input, ["status", "data", "warnings", "blocked_reasons"], "WECHAT_IMAGE_PLAN_ENVELOPE_FIELDS_INVALID");
  if (input.status !== "success") fail("WECHAT_IMAGE_PLAN_SKILL_STATUS_BLOCKED", input.status);
  stringArray(input.warnings, "WECHAT_IMAGE_PLAN_WARNINGS_INVALID");
  const blockers = stringArray(input.blocked_reasons, "WECHAT_IMAGE_PLAN_BLOCKERS_INVALID");
  if (blockers.length) fail("WECHAT_IMAGE_PLAN_BLOCKERS_PRESENT");
  exactKeys(input.data, ["plan_id", "cover", "slots"], "WECHAT_IMAGE_PLAN_DATA_FIELDS_INVALID");
  const refs = authorityReferenceSets(options);
  const planId = clean(input.data.plan_id);
  if (!planId) fail("WECHAT_IMAGE_PLAN_ID_REQUIRED");
  const cover = strictDeclaration(input.data.cover, { role: "cover", index: -1, refs });
  if (!Array.isArray(input.data.slots)) fail("WECHAT_IMAGE_PLAN_SLOTS_REQUIRED");
  const slots = input.data.slots.map((item, index) => strictDeclaration(item, { role: "inline", index, refs }));
  if (new Set(slots.map((item) => item.slotId)).size !== slots.length) fail("WECHAT_IMAGE_PLAN_SLOT_ID_DUPLICATE");
  if (options.imageRuntime?.illustrated_delivery_required === true) {
    if (cover.strategy === "no_image") fail("WECHAT_IMAGE_PLAN_COVER_REQUIRED");
    const minimumInlineImages = Number.isInteger(options.imageRuntime.minimum_inline_images)
      ? options.imageRuntime.minimum_inline_images
      : 1;
    if (slots.filter((item) => item.strategy !== "no_image").length < minimumInlineImages) {
      fail("WECHAT_IMAGE_PLAN_INLINE_IMAGE_REQUIRED", { minimumInlineImages });
    }
  }
  const bindings = optionalBindings(options.bindings);
  if (options.requireBindings === true && !bindings) fail("WECHAT_IMAGE_PLAN_BINDINGS_REQUIRED");
  const declarations = [cover, ...slots];
  const base = {
    schemaVersion: "1.0", contract: "WechatCanonicalImagePlan@1.0", authority: true,
    planId, skillStatus: "success", bindings, cover, slots, declarations,
    resourceRequirements: declarations.filter((item) => item.strategy !== "no_image").map((item) => ({ slotId: item.slotId, role: item.role, strategy: item.strategy, assetId: item.assetId })),
    warnings: clone(input.warnings), blockedReasons: []
  };
  return { ...base, planHash: hashWechatArtifactValue(base) };
}

/** Read-only compatibility view. It has no authority to create new facts. */
export function adaptLegacyWechatImagePlanReadOnly(input) {
  const before = hashWechatArtifactValue(input);
  let canonicalPlan = null;
  let error = null;
  try { canonicalPlan = adaptWechatImagePlanOutput(input, { skillStatus: "legacy_projection" }); }
  catch (caught) { error = { code: caught.code || "WECHAT_LEGACY_PLAN_INVALID", message: caught.message }; }
  if (hashWechatArtifactValue(input) !== before) fail("WECHAT_LEGACY_PLAN_MUTATED");
  const base = {
    schemaVersion: "1.0",
    contract: "LegacyWechatImagePlanProjection@1.0",
    legacyInputHash: before,
    authority: false,
    canonicalPlan,
    error,
    blockers: ["legacy_image_plan_output_fact_unproven", "legacy_artifact_bindings_unproven"]
  };
  return Object.freeze({ ...base, projectionHash: hashWechatArtifactValue(base) });
}
