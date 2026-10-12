import { createHash, randomUUID } from "node:crypto";
import { runContentSkill } from "./content-agent/skill-runner.mjs";
import { optimizeFinalTitles } from "./content-agent/title-atom.mjs";
import { runContentGates } from "./content-agent/gate-engine.mjs";
import { buildExecutionRecord, resolveSkillAdapter } from "./content-agent/skill-adapter-registry.mjs";
import { allowedPatchPrefixes, allowedXhsPageProjectionPrefixes, applyValidatedOperations, applyValidatedPatch, contentFingerprint, evaluateXhsPageFactClaims, projectXhsPageTargets } from "./content-agent/patch-engine.mjs";
import { featureFlags } from "./feature-flags.mjs";
import { validateWechatArticleBodyRecovery, validateWechatArticleMetadataRecovery } from "./llm/contracts.mjs";
import { adaptWechatImagePlanOutput } from "./content-agent/wechat-image-plan-adapter.mjs";
import { explicitWechatCopyOperations } from "./content-agent/explicit-copy-edits.mjs";

const uid = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`;
const list = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;

export const WECHAT_ARTICLE_MIN_CHARS = 1200;
export const WECHAT_ARTICLE_MIN_H2_SECTIONS = 3;
export const WECHAT_ARTICLE_RECOVERY_CHAR_SAFETY_MARGIN = 400;
export const WECHAT_ARTICLE_RECOVERY_TARGET_CHARS = WECHAT_ARTICLE_MIN_CHARS + WECHAT_ARTICLE_RECOVERY_CHAR_SAFETY_MARGIN;

function unwrapObject(raw, requiredKeys) {
  let current = raw;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    if (requiredKeys.some((key) => key in current)) return current;
    const next = ["data", "content", "package", "result", "content_package", "xhs_post_package", "wechat_article", "content_master"]
      .map((key) => current[key]).find((value) => value && typeof value === "object" && !Array.isArray(value));
    if (!next) break;
    current = next;
  }
  return raw;
}

const PLATFORM_RULES = {
  xiaohongshu: {
    name: "小红书",
    promise: "开头快速兑现标题承诺；正文可扫读、具体、有获得感；图文页承担不同信息任务；语言自然但不伪装亲历。",
    output: "XhsPostPackage@2.0"
  },
  wechat: {
    name: "微信公众号",
    promise: "用清晰的问题意识和连续论证提供信息增量；标题克制可信；正文适合长阅读；结论、边界和来源明确。",
    output: "WechatArticle@2.0"
  }
};

const PRIMARY_ACTION = {
  hotspot_industry_explainer: "share",
  knowledge_howto: "save",
  professional_opinion: "comment",
  product_service_promotion: "consult",
  case_result_showcase: "consult",
  brand_story: "follow",
  interactive_discussion: "comment",
  event_announcement: "register"
};

const ALLOWED_PRIMARY_ACTIONS = new Set(["save", "share", "comment", "follow", "consult", "try", "buy", "register", "none"]);

function skillFallbackUsed(result) {
  return result?.telemetry?.fallbackUsed === true || ["validated_fallback", "orchestrator_fallback", "demo_fallback"].includes(result?.mode);
}

function selectedPrimaryAction(intentProfile, proposed = null) {
  const requested = intentProfile?.engagement_policy?.selected_primary_action || intentProfile?.engagement_policy?.primary_action;
  if (requested && requested !== "model_selected" && ALLOWED_PRIMARY_ACTIONS.has(requested)) return requested;
  if (proposed && ALLOWED_PRIMARY_ACTIONS.has(proposed)) return proposed;
  return PRIMARY_ACTION[intentProfile?.purpose?.id] || "share";
}

function sourceEvidence(selection, citations) {
  const topicEvidence = list(selection?.evidence).map((item, index) => ({
    source_id: text(item.evidence_id || item.source_id, `T${index + 1}`),
    source_type: "hotspot_evidence",
    title: text(item.title || item.source_name || item.source, "热点证据"),
    excerpt: text(item.summary || item.snippet || item.signal || item.claim),
    url: item.url || null,
    published_at: item.published_at || item.publishedAt || null
  }));
  const knowledgeEvidence = list(citations).map((item) => ({
    source_id: item.citationId,
    source_type: "knowledge_base",
    title: item.fileName,
    excerpt: item.text || item.content || item.excerpt || "",
    file_id: item.fileId,
    chunk_id: item.chunkId
  }));
  return [...topicEvidence, ...knowledgeEvidence];
}

function factEvidence(factSnapshot) {
  return list(factSnapshot?.usableFacts).map((item, index) => ({
    source_id: text(item.id, `S${index + 1}`),
    source_type: "strategy_fact",
    title: text(item.key, "已确认动态事实"),
    excerpt: typeof item.value === "string" ? item.value : JSON.stringify(item.value),
    confidence: item.confidence,
    updated_at: item.updatedAt || null
  }));
}

function plannedSourceEvidence(payload) {
  const hotspots = list(payload?.contentSourceEvidence?.hotspots).map((item, index) => ({
    source_id: text(item.id, `H${index + 1}`),
    source_type: "planned_hotspot",
    title: text(item.title, "规划热点"),
    excerpt: text(item.summary),
    url: item.sourceUrl || null,
    published_at: item.publishedAt || null
  }));
  const userMaterials = list(payload?.temporaryMaterials)
    .filter((item) => item.usage === "usable" && !["private", "forbidden"].includes(item.visibility) && text(item.text))
    .map((item, index) => ({
      source_id: text(item.id, `U${index + 1}`),
      source_type: "user_temporary_material",
      title: text(item.name, "用户临时素材"),
      excerpt: text(item.text),
      content_hash: item.contentHash || null,
      visibility: item.visibility || "publishable"
    }));
  return [...hotspots, ...userMaterials];
}

function uniqueEvidence(items) {
  return [...new Map(items.filter((item) => item.source_id).map((item) => [item.source_id, item])).values()];
}

function masterFallback(input) {
  const sourceList = input.evidence;
  const facts = sourceList.filter((item) => item.excerpt).slice(0, 5).map((item, index) => ({ fact_id: `F${index + 1}`, fact: item.excerpt, source_ids: [item.source_id] }));
  return {
    status: facts.length ? "needs_review" : "blocked",
    data: {
      content_master_id: uid("master"),
      topic_id: input.intentProfile.topic_id,
      intent_profile_id: input.intentProfile.profile_id,
      platform: input.platform,
      content_purpose: input.intentProfile.purpose,
      target_audience: text(input.contentTaskBrief?.targetAudience, "关注该主题、希望获得可执行判断的目标读者"),
      central_question: text(input.contentTaskBrief?.audienceProblem, `围绕“${input.topicTitle}”，读者最需要弄清什么？`),
      central_thesis: text(input.contentTaskBrief?.coreClaim, input.topicTitle),
      reader_value: "理解事件、形成判断，并获得下一步行动建议",
      content_emphasis: [input.contentTaskBrief?.contentRole, input.contentTaskBrief?.angle, input.intentProfile.purpose.label].filter(Boolean),
      strategy_alignment: {
        content_function: input.contentTaskBrief?.contentFunction || input.intentProfile?.strategy_alignment?.content_function || null,
        platform_role: input.contentExecutionContext?.directionCard?.platformRole || null,
        conversion_stage: input.intentProfile?.strategy_alignment?.conversion_stage || input.contentExecutionContext?.directionCard?.conversionStage || null,
        evidence_requirement: input.intentProfile?.strategy_alignment?.evidence_requirement || input.contentExecutionContext?.directionCard?.evidenceRequirement || null,
        purpose_eligible: input.intentProfile?.strategy_alignment?.purpose_eligible ?? null,
        user_override_applied: input.intentProfile?.strategy_alignment?.user_override_applied === true
      },
      confirmed_facts: facts,
      supported_interpretations: [],
      author_opinions: [],
      unknowns: facts.length ? ["仍需在发布前核对时效性事实"] : ["缺少可引用的热点或知识库事实"],
      examples: [],
      knowledge_contract: input.knowledgeContract,
      promotion: input.intentProfile.promotion,
      engagement_policy: { ...input.intentProfile.engagement_policy, selected_primary_action: selectedPrimaryAction(input.intentProfile) },
      claims_to_avoid: ["未提供来源的数据、案例、客户评价和产品效果承诺", ...list(input.contentTaskBrief?.riskBoundaries)],
      publish_time_checks: ["核对热点日期、人物身份、数字与活动状态"],
      source_list: sourceList
    }
  };
}

function normalizeMaster(raw, input) {
  const fallback = masterFallback(input);
  const candidate = unwrapObject(raw, ["central_thesis", "confirmed_facts", "reader_value"]);
  const master = { ...fallback.data, ...(candidate || {}) };
  master.content_master_id = text(master.content_master_id, fallback.data.content_master_id);
  master.topic_id = input.intentProfile.topic_id;
  master.intent_profile_id = input.intentProfile.profile_id;
  master.platform = input.platform;
  master.content_purpose = input.intentProfile.purpose;
  master.knowledge_contract = input.knowledgeContract;
  master.promotion = input.intentProfile.promotion;
  master.source_list = input.evidence;
  master.confirmed_facts = list(master.confirmed_facts);
  master.supported_interpretations = list(master.supported_interpretations);
  master.author_opinions = list(master.author_opinions);
  master.unknowns = list(master.unknowns);
  master.examples = list(master.examples);
  master.claims_to_avoid = list(master.claims_to_avoid);
  master.publish_time_checks = list(master.publish_time_checks);
  const sourceIds = new Set(input.evidence.map((item) => item.source_id));
  master.confirmed_facts = master.confirmed_facts.filter((item) => text(item?.fact) && list(item.source_ids).length && list(item.source_ids).every((sourceId) => sourceIds.has(sourceId))).map((item, index) => ({ ...item, fact_id: text(item.fact_id, `F${index + 1}`) }));
  const protectedEvidence = input.evidence.filter((item) => ["strategy_fact", "user_temporary_material"].includes(item.source_type) && text(item.excerpt));
  for (const item of protectedEvidence) {
    if (master.confirmed_facts.some((fact) => list(fact.source_ids).includes(item.source_id))) continue;
    master.confirmed_facts.push({ fact_id: `F_${String(item.source_id).replace(/[^a-zA-Z0-9_-]/g, "_")}`, fact: item.excerpt, source_ids: [item.source_id] });
  }
  master.supported_interpretations = master.supported_interpretations.filter((item) => text(item?.text) && list(item.source_ids).every((sourceId) => sourceIds.has(sourceId))).map((item, index) => ({ ...item, interpretation_id: text(item.interpretation_id, `I${index + 1}`) }));
  master.engagement_policy = { ...fallback.data.engagement_policy, ...(master.engagement_policy || {}), selected_primary_action: selectedPrimaryAction(input.intentProfile, master.engagement_policy?.selected_primary_action) };
  const proposedStatus = raw?.status;
  const status = master.confirmed_facts.length && proposedStatus === "blocked" ? "needs_review" : proposedStatus || (master.confirmed_facts.length ? "ready" : "needs_review");
  return { status, data: master };
}

export function evaluateXhsGeneratedRasterSpecs(pkg) {
  const pages = list(pkg?.deck?.pages);
  const specs = list(pkg?.image_specs);
  const generatedPageIds = pages.filter((page) => page.render_strategy === "generated_raster").map((page) => page.page_id);
  const specPageIds = specs.map((spec) => spec.page_id).filter(Boolean);
  const uniqueGenerated = new Set(generatedPageIds);
  const uniqueSpecs = new Set(specPageIds);
  const missingPageIds = generatedPageIds.filter((pageId) => !uniqueSpecs.has(pageId));
  const unexpectedPageIds = specPageIds.filter((pageId) => !uniqueGenerated.has(pageId));
  const duplicatePageIds = specPageIds.filter((pageId, index) => specPageIds.indexOf(pageId) !== index);
  return {
    passed: missingPageIds.length === 0 && unexpectedPageIds.length === 0 && duplicatePageIds.length === 0 && specs.length === generatedPageIds.length,
    generatedRasterCount: generatedPageIds.length,
    imageSpecCount: specs.length,
    missingPageIds,
    unexpectedPageIds: [...new Set(unexpectedPageIds)],
    duplicatePageIds: [...new Set(duplicatePageIds)]
  };
}

export function normalizeXhsGeneratedRasterSpecs(pages, rawSpecs) {
  const specs = list(rawSpecs).map((spec) => ({ ...spec }));
  const generatedPageIds = list(pages).filter((page) => page.render_strategy === "generated_raster").map((page) => page.page_id);
  const claimedPageIds = new Set(specs.map((spec) => spec.page_id).filter(Boolean));
  const unclaimedPageIds = generatedPageIds.filter((pageId) => !claimedPageIds.has(pageId));
  const unassignedSpecs = specs.filter((spec) => !spec.page_id);
  if (unassignedSpecs.length === unclaimedPageIds.length) {
    unassignedSpecs.forEach((spec, index) => { spec.page_id = unclaimedPageIds[index]; });
  }
  return specs;
}

function qualityCheckXhs(pkg, master) {
  const checks = [];
  const titles = list(pkg.post_copy?.title_candidates);
  const pages = list(pkg.deck?.pages);
  const specs = list(pkg.image_specs);
  const rasterSpecGate = evaluateXhsGeneratedRasterSpecs(pkg);
  checks.push({ check: "title_candidates_3_to_5", result: titles.length >= 3 && titles.length <= 5 ? "pass" : "fail" });
  checks.push({ check: "deck_pages_6_to_10", result: pages.length >= 6 && pages.length <= 10 ? "pass" : "fail" });
  checks.push({ check: "one_image_spec_per_generated_page", result: rasterSpecGate.passed ? "pass" : "fail", detail: rasterSpecGate });
  checks.push({ check: "image_prompt_no_text_or_logo", result: specs.every((spec) => /no\s+(text|logo)|无文字|不要文字|禁止文字/i.test(`${spec.prompt || ""} ${list(spec.prohibitions).join(" ")}`)) ? "pass" : "fail" });
  const factIds = new Set(list(master.confirmed_facts).map((item) => item.fact_id));
  checks.push({ check: "fact_ids_traceable", result: pages.flatMap((page) => list(page.fact_ids)).every((id) => factIds.has(id)) ? "pass" : "fail" });
  const semanticFactGateEnabled = featureFlags().xhsDeterministicVisualQualityGate;
  const semanticFacts = semanticFactGateEnabled ? evaluateXhsPageFactClaims(pkg, master) : { status: "disabled", failures: [] };
  checks.push({ check: "page_claims_semantically_traceable", result: semanticFacts.status === "blocked" ? "fail" : "pass", detail: { enabled: semanticFactGateEnabled, status: semanticFacts.status, failures: semanticFacts.failures } });
  return checks;
}

function normalizeXhs(raw, input, master) {
  const candidate = unwrapObject(raw, ["post_copy", "deck", "image_specs"]);
  const copy = candidate?.post_copy || {};
  const pages = list(candidate?.deck?.pages).map((page, index) => ({
    page_id: text(page.page_id, `P${index + 1}`), page_number: index + 1,
    page_role: text(page.page_role, index === 0 ? "cover" : "content"),
    headline: text(page.headline, input.topicTitle), supporting_text: text(page.supporting_text),
    text_layers: list(page.text_layers), render_strategy: text(page.render_strategy, "html_css"),
    visual_direction: text(page.visual_direction), fact_ids: list(page.fact_ids), interpretation_ids: list(page.interpretation_ids)
  }));
  const pkg = {
    platform: "xiaohongshu", topic_id: master.topic_id, intent_profile_id: master.intent_profile_id,
    content_purpose_id: input.intentProfile.purpose.id,
    content_promise: text(candidate?.content_promise, master.reader_value),
    engagement_strategy: { primary_action: master.engagement_policy.selected_primary_action, reason: text(candidate?.engagement_strategy?.reason, "按内容目的自然选择一个主要互动方式") },
    post_copy: {
      title_candidates: list(copy.title_candidates), recommended_title: text(copy.recommended_title, input.topicTitle),
      opening: text(copy.opening), body_sections: list(copy.body_sections), ending: text(copy.ending),
      pinned_comment: text(copy.pinned_comment), hashtags: list(copy.hashtags).slice(0, 8), cta: text(copy.cta)
    },
    deck: { aspect_ratio: "3:4", canvas: { width: 1080, height: 1440 }, pages },
    image_specs: normalizeXhsGeneratedRasterSpecs(pages, candidate?.image_specs), skipped_image_pages: list(candidate?.skipped_image_pages),
    traceability: candidate?.traceability || {}, preflight_checks: []
  };
  pkg.preflight_checks = qualityCheckXhs(pkg, master);
  return { status: pkg.preflight_checks.every((item) => item.result === "pass") ? "ready" : "needs_review", data: pkg };
}

function qualityCheckWechat(pkg, master) {
  const checks = [];
  const titles = list(pkg.title_candidates);
  const markdown = text(pkg.article_markdown);
  checks.push({ check: "title_candidates_3_to_5", result: titles.length >= 3 && titles.length <= 5 ? "pass" : "fail" });
  checks.push({ check: "continuous_article_structure", result: markdown.length >= WECHAT_ARTICLE_MIN_CHARS && (markdown.match(/^##\s/gm) || []).length >= WECHAT_ARTICLE_MIN_H2_SECTIONS ? "pass" : "fail" });
  checks.push({ check: "article_has_information_gain", result: text(pkg.information_gain).length >= 12 ? "pass" : "fail" });
  const sourceIds = new Set(list(master.source_list).map((item) => item.source_id));
  checks.push({ check: "claim_map_traceable", result: list(pkg.claim_map).every((item) => list(item.source_ids).every((id) => sourceIds.has(id))) ? "pass" : "fail" });
  checks.push({ check: "image_plan_present", result: Boolean(pkg.image_plan?.cover) && list(pkg.image_plan?.slots).length >= 1 ? "pass" : "fail" });
  return checks;
}

function normalizeWechat(raw, input, master) {
  const candidate = unwrapObject(raw, ["article_markdown", "recommended_title", "image_plan"]);
  const pkg = {
    platform: "wechat", topic_id: master.topic_id, intent_profile_id: master.intent_profile_id,
    content_purpose_id: input.intentProfile.purpose.id,
    article_promise: text(candidate?.article_promise, master.reader_value), core_argument: text(candidate?.core_argument, master.central_thesis),
    information_gain: text(candidate?.information_gain), title_candidates: list(candidate?.title_candidates),
    recommended_title: text(candidate?.recommended_title, input.topicTitle), abstract: text(candidate?.abstract), opening: text(candidate?.opening),
    outline: list(candidate?.outline), article_markdown: text(candidate?.article_markdown), pull_quotes: list(candidate?.pull_quotes),
    key_takeaways: list(candidate?.key_takeaways), share_summary: text(candidate?.share_summary), share_reason: text(candidate?.share_reason),
    engagement_strategy: { primary_action: master.engagement_policy.selected_primary_action, reason: text(candidate?.engagement_strategy?.reason, "按内容目的自然选择一个主要互动方式") },
    cta: text(candidate?.cta), claim_map: list(candidate?.claim_map), used_knowledge_asset_ids: list(candidate?.used_knowledge_asset_ids),
    source_list: master.source_list, publish_time_checks: list(master.publish_time_checks), image_plan: candidate?.image_plan || { cover: null, slots: [] }, preflight_checks: []
  };
  pkg.preflight_checks = qualityCheckWechat(pkg, master);
  return { status: pkg.preflight_checks.every((item) => item.result === "pass") ? "ready" : "needs_review", data: pkg };
}

export function validateWechatArticleForProduction(raw) {
  const candidate = unwrapObject(raw, ["article_markdown", "recommended_title", "image_plan"]);
  const markdown = text(candidate?.article_markdown);
  const titles = list(candidate?.title_candidates).filter((item) => text(typeof item === "string" ? item : item?.title));
  const outline = list(candidate?.outline);
  const blockers = [];
  if (!markdown) blockers.push("wechat_article_markdown_empty");
  else {
    if (markdown.length < WECHAT_ARTICLE_MIN_CHARS) blockers.push("continuous_article_structure");
    if ((markdown.match(/^##\s/gm) || []).length < WECHAT_ARTICLE_MIN_H2_SECTIONS) blockers.push("continuous_article_structure");
  }
  if (titles.length < 3 || titles.length > 5) blockers.push("title_candidates_3_to_5");
  if (outline.length < 3) blockers.push("wechat_article_outline_incomplete");
  if (text(candidate?.information_gain).length < 12) blockers.push("article_has_information_gain");
  if (!candidate?.image_plan?.cover || list(candidate?.image_plan?.slots).length < 1) blockers.push("image_plan_present");
  return { valid: blockers.length === 0, blockers: [...new Set(blockers)], metrics: { articleCharacters: markdown.length, h2Sections: (markdown.match(/^##\s/gm) || []).length, titleCandidates: titles.length, outlineSections: outline.length, imageSlots: list(candidate?.image_plan?.slots).length } };
}

const WECHAT_QUALITY_FIELD_PATHS = Object.freeze({
  wechat_article_markdown_empty: "data.article_markdown",
  continuous_article_structure: "data.article_markdown",
  title_candidates_3_to_5: "data.title_candidates",
  wechat_article_outline_incomplete: "data.outline",
  article_has_information_gain: "data.information_gain",
  image_plan_present: "data.image_plan"
});

function writerFailureStage(telemetry, validation) {
  if (validation.valid) return null;
  if (["invalid_json", "empty_response"].includes(telemetry.errorCategory) || telemetry.contractDiagnostics?.stage === "provider_parse") return "provider_parse";
  if (telemetry.errorCategory === "contract_validation" || telemetry.contractDiagnostics?.stage === "contract_schema") return "contract_schema";
  if (telemetry.providerSucceeded === true) return "production_quality_gate";
  return "provider_failure";
}

function writerContractDiagnostics(telemetry, validation, failureStage) {
  if (failureStage === "production_quality_gate") {
    return {
      stage: failureStage,
      errorCode: "WECHAT_ARTICLE_QUALITY_GATE_FAILED",
      validationFieldPaths: [...new Set(validation.blockers.map((blocker) => WECHAT_QUALITY_FIELD_PATHS[blocker]).filter(Boolean))],
      topLevelShape: telemetry.contractDiagnostics?.topLevelShape || null,
      responseCharacterCount: telemetry.contractDiagnostics?.responseCharacterCount ?? null,
      parseMode: telemetry.contractDiagnostics?.parseMode || telemetry.structuredParseMode || null,
      wrapperPath: telemetry.contractDiagnostics?.wrapperPath || null
    };
  }
  return telemetry.contractDiagnostics ? structuredClone(telemetry.contractDiagnostics) : null;
}

function observableSkillTrace(result, { recoveryAttempt, validation, recoveredFromTraceId = null }) {
  const telemetry = result?.telemetry || {};
  const failureStage = writerFailureStage(telemetry, validation);
  const contractDiagnostics = writerContractDiagnostics(telemetry, validation, failureStage);
  return {
    ...(result?.skillTrace || {}),
    status: validation.valid ? "completed" : "failed",
    recoveryAttempt,
    recoveredFromTraceId,
    providerTraceId: telemetry.traceId || null,
    providerSucceeded: telemetry.providerSucceeded === true,
    providerCallAt: telemetry.at || null,
    httpStatus: telemetry.httpStatus || null,
    configuredModel: telemetry.configuredModel || null,
    requestedModel: telemetry.requestedModel || null,
    effectiveModel: telemetry.effectiveModel || telemetry.model || null,
    costStatus: telemetry.costStatus || "not_reported",
    errorCode: validation.valid ? null : failureStage === "production_quality_gate" ? "WECHAT_ARTICLE_QUALITY_GATE_FAILED" : telemetry.errorCode || "WECHAT_ARTICLE_CONTRACT_INVALID",
    errorCategory: validation.valid ? null : failureStage === "production_quality_gate" ? "production_quality_gate" : telemetry.errorCategory || "contract_validation",
    failureStage,
    contractDiagnostics,
    providerAttempts: Number(telemetry.attempts || 0),
    providerAttemptFailures: structuredClone(telemetry.attemptFailures || []),
    fallbackUsed: telemetry.fallbackUsed === true || result?.mode === "validated_fallback",
    productionEligibleOutput: validation.valid,
    validationBlockers: validation.blockers,
    validationMetrics: validation.metrics
  };
}

function providerAwareDownstreamResult(result) {
  const telemetry = result?.telemetry || {};
  const usedFallback = skillFallbackUsed(result);
  return {
    trace: { ...(result?.skillTrace || {}), status: usedFallback ? "needs_review" : "completed", providerTraceId: telemetry.traceId || null, errorCode: telemetry.errorCode || result?.skillTrace?.errorCode || null, errorCategory: telemetry.errorCategory || result?.skillTrace?.errorCategory || null, providerAttempts: Number(telemetry.attempts || 0), providerAttemptFailures: structuredClone(telemetry.attemptFailures || []), fallbackUsed: usedFallback },
    record: { ...(result?.executionRecord || {}), providerFallbackUsed: usedFallback, productionEligibleOutput: !usedFallback && result?.executionRecord?.productionEligibleOutput !== false, errorCode: telemetry.errorCode || result?.skillTrace?.errorCode || null, providerAttempts: Number(telemetry.attempts || 0) }
  };
}

function projectRecoveryIntent(intentProfile = {}) {
  return {
    profile_id: intentProfile.profile_id || null,
    platform: intentProfile.platform || "wechat",
    purpose: intentProfile.purpose || null,
    promotion: intentProfile.promotion || null,
    engagement_policy: intentProfile.engagement_policy || null
  };
}

function projectRecoveryMaster(master = {}) {
  return {
    topic_id: master.topic_id || null,
    central_question: master.central_question || null,
    central_thesis: master.central_thesis || null,
    reader_value: master.reader_value || null,
    content_emphasis: list(master.content_emphasis),
    confirmed_facts: list(master.confirmed_facts),
    supported_interpretations: list(master.supported_interpretations),
    author_opinions: list(master.author_opinions),
    unknowns: list(master.unknowns),
    examples: list(master.examples),
    claims_to_avoid: list(master.claims_to_avoid),
    source_list: list(master.source_list),
    publish_time_checks: list(master.publish_time_checks)
  };
}

export function buildWechatArticleRecoveryPrompt(writerPrompt, { attempt = 1, failedTraceId = null, previousBlockers = [] } = {}) {
  return {
    task: "write_wechat_article_v2_recovery",
    instruction: `只执行公众号正文合同恢复。根据冻结论点、事实、来源和已确认大纲，返回一个完整 JSON 对象；不要输出解释、Markdown 代码围栏或空白占位。article_markdown 字段去除首尾空白后的净正文目标不少于 ${WECHAT_ARTICLE_RECOVERY_TARGET_CHARS} 个字符（生产质量 Gate 仍为 ${WECHAT_ARTICLE_MIN_CHARS} 个字符，额外 ${WECHAT_ARTICLE_RECOVERY_CHAR_SAFETY_MARGIN} 个字符是防止模型轻微欠量的安全余量）并含至少 ${WECHAT_ARTICLE_MIN_H2_SECTIONS} 个 ## 小标题；同时返回 3–5 个标题、明确的信息增量、完整大纲及包含封面和至少一个正文槽位的 image_plan。不得新增输入中不存在的事实。`,
    output_contract: "WechatArticle@2.0",
    output_shape: writerPrompt.output_shape,
    hard_requirements: {
      ...writerPrompt.hard_requirements,
      article_markdown_min_chars: WECHAT_ARTICLE_RECOVERY_TARGET_CHARS,
      article_markdown_quality_gate_min_chars: WECHAT_ARTICLE_MIN_CHARS,
      h2_sections_min: WECHAT_ARTICLE_MIN_H2_SECTIONS
    },
    topicTitle: writerPrompt.topicTitle,
    platform: "wechat",
    intentProfile: projectRecoveryIntent(writerPrompt.intentProfile),
    master: projectRecoveryMaster(writerPrompt.master),
    confirmed_outline: writerPrompt.confirmed_outline,
    outline_lock_rule: writerPrompt.outline_lock_rule,
    recovery: {
      mode: "bounded_targeted_body_recovery",
      attempt,
      failedTraceId,
      previousBlockers: list(previousBlockers),
      response_format: "json_object"
    }
  };
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function hashWechatChainValue(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function buildPreparedSharedContentMaster(contentMaster, { status = "ready" } = {}) {
  const data = structuredClone(contentMaster);
  const id = text(data?.content_master_id || data?.id);
  if (!id) throw Object.assign(new Error("prepared shared ContentMaster id is required"), { code: "WECHAT_SHARED_MASTER_ID_REQUIRED", statusCode: 409 });
  return {
    status,
    data,
    sharedContentMasterRef: {
      schemaVersion: "1.0",
      contract: "SharedContentMasterRef@1.0",
      id,
      hash: hashWechatChainValue(data),
      authorityContract: "ContentMaster@2.0",
      authorityType: "shared_content_master"
    }
  };
}

function validatePreparedSharedContentMaster(prepared) {
  const data = prepared?.data;
  const ref = prepared?.sharedContentMasterRef;
  const id = text(data?.content_master_id || data?.id);
  const valid = Boolean(data && ref
    && ref.schemaVersion === "1.0"
    && ref.contract === "SharedContentMasterRef@1.0"
    && ref.authorityContract === "ContentMaster@2.0"
    && ref.authorityType === "shared_content_master"
    && ref.id === id
    && /^[a-f0-9]{64}$/.test(ref.hash || "")
    && ref.hash === hashWechatChainValue(data)
    && !ref.authorityPlatform
    && !ref.sourcePlatformOutputRef);
  return { valid, ref: valid ? structuredClone(ref) : null, blocker: "wechat_prepared_shared_master_authority_invalid" };
}

function strictWechatInvocationBlocker(result, stage) {
  const record = result?.executionRecord || {};
  const trace = result?.skillTrace || {};
  if (skillFallbackUsed(result) || record.fallbackUsed === true) return `${stage}_fallback_forbidden`;
  if (record.executionMode !== "real" || trace.executionMode === "mock_fixture") return `${stage}_real_invocation_required`;
  if (record.productionEligibleOutput !== true) return `${stage}_production_eligible_output_required`;
  if (Number(record.attempt || trace.attempt || 1) !== 1) return `${stage}_single_attempt_required`;
  if (Number(result?.telemetry?.attempts || 1) > 1) return `${stage}_automatic_retry_forbidden`;
  return null;
}

function verifiedWechatImageAssets(payload) {
  const assets = list(payload?.wechatAuthorizedImageAssets);
  const invalid = assets.filter((asset) => {
    const mediaType = text(asset?.mediaType || asset?.mimeType);
    return !text(asset?.assetId || asset?.id)
      || asset?.status !== "approved"
      || !text(asset?.license?.id)
      || asset?.license?.allowsPublication !== true
      || !text(asset?.source?.ref)
      || !/^[a-f0-9]{64}$/.test(String(asset?.source?.sha256 || ""))
      || !(asset?.kind === "image" || mediaType.startsWith("image/"));
  });
  return { valid: invalid.length === 0, assets: structuredClone(assets), invalidCount: invalid.length };
}

function wechatChainBundle({ payload, account, intentProfile, masterRef, article = null, imageAssets = [] }) {
  const context = payload?.contentExecutionContext || {};
  const direction = context.directionCard || {};
  return {
    schemaVersion: "1.0",
    contract: "WechatSkillReferenceBundle@1.0",
    sharedContentMasterRef: structuredClone(masterRef),
    contentExecutionContext: structuredClone(payload?.contentExecutionContext || null),
    contentIntentProfile: structuredClone(intentProfile),
    effectiveAccountStrategy: structuredClone(account?.effectiveStrategy || account?.strategy || null),
    accountContext: structuredClone(account?.accountContext || null),
    matrixRole: direction.matrixRole || account?.matrixRole || null,
    rollingPlanContentFunction: direction.contentFunction || payload?.contentTaskBrief?.contentFunction || null,
    creativeMechanism: direction.creativeMechanism || payload?.creativeMechanism || null,
    journeyStage: direction.journeyStage || direction.conversionStage || null,
    platformInfrastructure: structuredClone(account?.platformInfrastructure || null),
    articleHash: article ? hashWechatChainValue(article) : null,
    authorizedImageRegistryHash: hashWechatChainValue(imageAssets)
  };
}

function validateWechatChainBundle(bundle, { requireArticle = false } = {}) {
  const required = ["contentExecutionContext", "contentIntentProfile", "effectiveAccountStrategy", "accountContext", "matrixRole", "rollingPlanContentFunction", "creativeMechanism", "journeyStage", "platformInfrastructure"];
  if (!bundle?.sharedContentMasterRef?.hash || required.some((key) => bundle[key] == null || bundle[key] === "")) return false;
  if (requireArticle && !/^[a-f0-9]{64}$/.test(bundle.articleHash || "")) return false;
  return /^[a-f0-9]{64}$/.test(bundle.authorizedImageRegistryHash || "");
}

export function buildWechatTwoStageRecoveryBinding(writerPrompt, { contentRunId } = {}) {
  const strategySnapshotId = text(writerPrompt?.content_execution_context?.strategySnapshotId);
  const confirmedOutlineId = text(writerPrompt?.confirmed_outline?.id || writerPrompt?.confirmed_outline?.outline_id);
  const runId = text(contentRunId);
  if (!runId || !strategySnapshotId || !confirmedOutlineId) return null;
  const inputSummary = {
    contentRunId: runId,
    strategySnapshotId,
    confirmedOutlineId,
    topicTitle: writerPrompt.topicTitle,
    intentProfile: projectRecoveryIntent(writerPrompt.intentProfile),
    master: projectRecoveryMaster(writerPrompt.master),
    confirmedOutline: writerPrompt.confirmed_outline
  };
  return {
    contentRunId: runId,
    strategySnapshotId,
    confirmedOutlineId,
    inputSummaryHash: createHash("sha256").update(stableJson(inputSummary)).digest("hex")
  };
}

function sameBinding(left, right) {
  return Boolean(left && right) && ["contentRunId", "strategySnapshotId", "confirmedOutlineId", "inputSummaryHash"].every((key) => left[key] === right[key]);
}

function frozenWechatH2Headings(confirmedOutline) {
  const sections = list(confirmedOutline?.sections);
  const headings = sections.map((item) => text(item?.heading));
  const complete = sections.length >= WECHAT_ARTICLE_MIN_H2_SECTIONS
    && headings.length === sections.length
    && headings.every(Boolean)
    && new Set(headings).size === headings.length;
  return { complete, headings };
}

function extractWechatMarkdownH2Headings(articleMarkdown) {
  return text(articleMarkdown).match(/^##\s+(.+)$/gm)?.map((heading) => heading.replace(/^##\s+/, "").trim()) || [];
}

function redactWechatH2Headings(headings) {
  return list(headings).map((heading, index) => ({
    index,
    characters: heading.length,
    sha256: createHash("sha256").update(heading).digest("hex")
  }));
}

export function evaluateWechatFrozenH2Headings(articleMarkdown, confirmedOutline) {
  const expected = frozenWechatH2Headings(confirmedOutline);
  const actualHeadings = extractWechatMarkdownH2Headings(articleMarkdown);
  return {
    valid: expected.complete && stableJson(actualHeadings) === stableJson(expected.headings),
    blocker: expected.complete ? "wechat_body_h2_headings_mismatch" : "wechat_frozen_outline_headings_incomplete",
    expected: redactWechatH2Headings(expected.headings),
    actual: redactWechatH2Headings(actualHeadings),
    expectedCount: expected.headings.length,
    actualCount: actualHeadings.length
  };
}

export function adaptWechatTwoStageRecovery({ body, metadata, expectedBinding, confirmedOutline, allowedSourceIds = [] }) {
  const bodyValidation = validateWechatArticleBodyRecovery(body);
  const metadataValidation = validateWechatArticleMetadataRecovery(metadata);
  const errors = [...bodyValidation.errors.map((item) => `body.${item}`), ...metadataValidation.errors.map((item) => `metadata.${item}`)];
  if (!sameBinding(body?.binding, expectedBinding)) errors.push("body.binding does not match frozen recovery input");
  if (!sameBinding(metadata?.binding, expectedBinding)) errors.push("metadata.binding does not match frozen recovery input");
  if (!sameBinding(body?.binding, metadata?.binding)) errors.push("body.binding and metadata.binding do not match");
  if (body?.confirmed_outline_id !== expectedBinding?.confirmedOutlineId) errors.push("body.confirmed_outline_id does not match frozen outline");
  const expectedHeadings = frozenWechatH2Headings(confirmedOutline).headings;
  const actualHeadings = list(metadata?.outline).map((item) => text(item?.heading)).filter(Boolean);
  if (expectedHeadings.length && stableJson(actualHeadings) !== stableJson(expectedHeadings)) errors.push("metadata.outline does not match frozen outline");
  const bodyHeadings = extractWechatMarkdownH2Headings(body?.article_markdown);
  if (expectedHeadings.length && stableJson(bodyHeadings) !== stableJson(expectedHeadings)) errors.push("body headings do not match frozen outline");
  const allowedSources = new Set(list(allowedSourceIds));
  if (allowedSources.size && list(body?.used_source_ids).some((sourceId) => !allowedSources.has(sourceId))) errors.push("body.used_source_ids contains an unapproved source");
  const claimSourceIds = list(body?.claim_map).flatMap((claim) => list(claim?.source_ids));
  if (allowedSources.size && claimSourceIds.some((sourceId) => !allowedSources.has(sourceId))) errors.push("body.claim_map contains an unapproved source");
  if (errors.length) return { valid: false, errors, value: null };
  const { schemaVersion: _metadataVersion, binding: _metadataBinding, ...metadataFields } = metadata;
  return {
    valid: true,
    errors: [],
    value: {
      status: "success",
      data: {
        ...metadataFields,
        article_markdown: body.article_markdown,
        claim_map: structuredClone(body.claim_map),
        recovery_binding: structuredClone(expectedBinding)
      }
    }
  };
}

export function buildWechatBodyFirstRecoveryPrompts(writerPrompt, { contentRunId } = {}) {
  const binding = buildWechatTwoStageRecoveryBinding(writerPrompt, { contentRunId });
  if (!binding) return { valid: false, blocker: "wechat_two_stage_binding_incomplete", binding: null };
  const frozenHeadings = frozenWechatH2Headings(writerPrompt.confirmed_outline);
  if (!frozenHeadings.complete) return { valid: false, blocker: "wechat_frozen_outline_headings_incomplete", binding };
  const markdownH2Skeleton = frozenHeadings.headings.map((heading) => `## ${heading}\n`).join("\n");
  const shared = {
    binding,
    topicTitle: writerPrompt.topicTitle,
    intentProfile: projectRecoveryIntent(writerPrompt.intentProfile),
    master: projectRecoveryMaster(writerPrompt.master),
    confirmed_outline: writerPrompt.confirmed_outline,
    outline_lock_rule: writerPrompt.outline_lock_rule
  };
  return {
    valid: true,
    binding,
    bodyPrompt: {
      task: "write_wechat_article_body_recovery_v1",
      instruction: `只生成公众号原生正文。严格遵循冻结大纲、主张和来源，返回 WechatArticleBodyRecovery@1.0 JSON；article_markdown 净正文目标不少于 ${WECHAT_ARTICLE_RECOVERY_TARGET_CHARS} 字。必须逐项、逐字、按原顺序使用 required_h2_headings，H2 数量必须完全相等；直接复制 markdown_h2_skeleton 后在各 H2 下填写正文，不得少写、多写、重复、重排或改写 H2。不得输出标题、摘要、图片计划等元数据，不得补写输入外事实。binding 必须原样返回。`,
      output_contract: "WechatArticleBodyRecovery@1.0",
      output_shape: { schemaVersion: "1.0", binding, confirmed_outline_id: binding.confirmedOutlineId, article_markdown: markdownH2Skeleton, claim_map: [{ claim: "", source_ids: [""] }], used_source_ids: [""] },
      hard_requirements: { article_markdown_min_chars: WECHAT_ARTICLE_RECOVERY_TARGET_CHARS, article_markdown_quality_gate_min_chars: WECHAT_ARTICLE_MIN_CHARS, h2_sections_min: WECHAT_ARTICLE_MIN_H2_SECTIONS, required_h2_headings: frozenHeadings.headings, markdown_h2_skeleton: markdownH2Skeleton },
      required_h2_headings: frozenHeadings.headings,
      markdown_h2_skeleton: markdownH2Skeleton,
      ...shared
    },
    metadataPrompt: {
      task: "write_wechat_article_metadata_recovery_v1",
      instruction: "只生成公众号元数据，返回 WechatArticleMetadataRecovery@1.0 JSON。不得包含 article_markdown，不得改写正文；大纲标题必须逐项等于冻结大纲。binding 必须原样返回，不得新增输入外事实。",
      output_contract: "WechatArticleMetadataRecovery@1.0",
      output_shape: { schemaVersion: "1.0", binding, article_promise: "", core_argument: "", information_gain: "", title_candidates: ["", "", ""], recommended_title: "", abstract: "", opening: "", outline: list(writerPrompt.confirmed_outline?.sections).map((item) => ({ heading: item.heading })), pull_quotes: [], key_takeaways: [], share_summary: "", share_reason: "", engagement_strategy: { primary_action: "share", reason: "" }, cta: "", used_knowledge_asset_ids: [], image_plan: { cover: {}, slots: [{}] } },
      ...shared
    }
  };
}

export function createWechatRecoveryContentCallBudget(maxCalls = 2) {
  let consumed = 0;
  const stages = [];
  return {
    get consumed() { return consumed; },
    get remaining() { return Math.max(0, maxCalls - consumed); },
    get stages() { return [...stages]; },
    async run(stage, invoke) {
      if (consumed >= maxCalls) throw Object.assign(new Error("公众号恢复内容调用预算已用尽"), { code: "WECHAT_RECOVERY_WINDOW_CALL_LIMIT_EXCEEDED", statusCode: 409, stage, maxCalls, consumed });
      consumed += 1;
      stages.push(stage);
      return invoke();
    }
  };
}

async function runWechatBodyFirstRecovery({ writerPrompt, platform, generateText, planStep, contentRunId }) {
  const prompts = buildWechatBodyFirstRecoveryPrompts(writerPrompt, { contentRunId });
  if (!prompts.valid) return { result: { mode: "blocked", data: {} }, validation: { valid: false, blockers: [prompts.blocker], metrics: {} }, skillTraces: [], executionRecords: [], recovery: { stage: "platform_writer", policy: "wechat_body_first_recovery_v1", maxAttempts: 2, automaticRetry: false, providerCalls: 0, providerCallStages: [], attempts: [], status: "exhausted" } };
  const attempts = [];
  const skillTraces = [];
  const executionRecords = [];
  const callBudget = createWechatRecoveryContentCallBudget(2);
  let bodyResult;
  try {
    bodyResult = await callBudget.run("body", () => runContentSkill({ capability: "write-wechat-article", platform, input: prompts.bodyPrompt, generateText, fallback: {}, expectedContract: "WechatArticleBodyRecovery@1.0", task: "write_wechat_article_body_recovery_v1", planStep, maxAttempts: 1 }));
  } catch (error) {
    return { result: { mode: "blocked", data: {}, telemetry: { errorCode: error.code || "WECHAT_BODY_STAGE_FAILED", errorCategory: error.errorCategory || "skill_execution" } }, validation: { valid: false, blockers: ["wechat_body_stage_failed"], metrics: {} }, skillTraces: [], executionRecords: [], recovery: { stage: "platform_writer", policy: "wechat_body_first_recovery_v1", maxAttempts: 2, automaticRetry: false, providerCalls: callBudget.consumed, providerCallStages: callBudget.stages, attempts: [{ stage: "body", outcome: "failed" }], status: "exhausted" } };
  }
  const body = bodyResult.data;
  const bodySchema = validateWechatArticleBodyRecovery(body);
  const bodyBindingValid = sameBinding(body?.binding, prompts.binding) && body?.confirmed_outline_id === prompts.binding.confirmedOutlineId;
  const bodyH2Validation = evaluateWechatFrozenH2Headings(body?.article_markdown, writerPrompt.confirmed_outline);
  const bodyInvocationBlocker = strictWechatInvocationBlocker(bodyResult, "wechat_recovery_body");
  const bodyValidation = {
    valid: bodySchema.valid && bodyBindingValid && bodyH2Validation.valid && !bodyInvocationBlocker,
    blockers: [...bodySchema.errors, ...(bodyBindingValid ? [] : ["wechat_two_stage_binding_mismatch"]), ...(bodyH2Validation.valid ? [] : [bodyH2Validation.blocker]), ...(bodyInvocationBlocker ? [bodyInvocationBlocker] : [])],
    metrics: {
      articleCharacters: text(body?.article_markdown).length,
      h2Sections: bodyH2Validation.actualCount,
      h2HeadingComparison: {
        expectedCount: bodyH2Validation.expectedCount,
        actualCount: bodyH2Validation.actualCount,
        expected: bodyH2Validation.expected,
        actual: bodyH2Validation.actual
      }
    }
  };
  const bodyTrace = observableSkillTrace(bodyResult, { recoveryAttempt: 1, validation: bodyValidation });
  skillTraces.push(bodyTrace);
  executionRecords.push({ ...(bodyResult.executionRecord || {}), status: bodyValidation.valid ? "completed" : "failed", productionEligibleOutput: false, stage: "body", validationBlockers: bodyValidation.blockers });
  attempts.push({ stage: "body", outcome: bodyValidation.valid ? "completed" : "failed", validationBlockers: bodyValidation.blockers });
  if (!bodyValidation.valid) return { result: bodyResult, validation: bodyValidation, skillTraces, executionRecords, recovery: { stage: "platform_writer", policy: "wechat_body_first_recovery_v1", maxAttempts: 2, automaticRetry: false, providerCalls: callBudget.consumed, providerCallStages: callBudget.stages, attempts, status: "exhausted" } };
  let metadataResult;
  try {
    metadataResult = await callBudget.run("metadata", () => runContentSkill({ capability: "write-wechat-article", platform, input: prompts.metadataPrompt, generateText, fallback: {}, expectedContract: "WechatArticleMetadataRecovery@1.0", task: "write_wechat_article_metadata_recovery_v1", planStep, maxAttempts: 1 }));
  } catch (error) {
    attempts.push({ stage: "metadata", outcome: "failed", errorCode: error.code || "WECHAT_METADATA_STAGE_FAILED" });
    return { result: { mode: "blocked", data: {}, telemetry: { errorCode: error.code || "WECHAT_METADATA_STAGE_FAILED", errorCategory: error.errorCategory || "skill_execution" } }, validation: { valid: false, blockers: ["wechat_metadata_stage_failed"], metrics: {} }, skillTraces, executionRecords, recovery: { stage: "platform_writer", policy: "wechat_body_first_recovery_v1", maxAttempts: 2, automaticRetry: false, providerCalls: callBudget.consumed, providerCallStages: callBudget.stages, attempts, status: "exhausted" } };
  }
  const adapted = adaptWechatTwoStageRecovery({ body, metadata: metadataResult.data, expectedBinding: prompts.binding, confirmedOutline: writerPrompt.confirmed_outline, allowedSourceIds: list(writerPrompt.master?.source_list).map((item) => item.source_id) });
  const metadataInvocationBlocker = strictWechatInvocationBlocker(metadataResult, "wechat_recovery_metadata");
  const mergedValidation = adapted.valid ? validateWechatArticleForProduction(adapted.value) : { valid: false, blockers: adapted.errors, metrics: {} };
  if (metadataInvocationBlocker) {
    mergedValidation.valid = false;
    mergedValidation.blockers = [...new Set([...(mergedValidation.blockers || []), metadataInvocationBlocker])];
  }
  const metadataTrace = observableSkillTrace(metadataResult, { recoveryAttempt: 2, validation: mergedValidation, recoveredFromTraceId: bodyTrace.traceId || bodyTrace.providerTraceId });
  skillTraces.push(metadataTrace);
  executionRecords.push({ ...(metadataResult.executionRecord || {}), status: mergedValidation.valid ? "completed" : "failed", productionEligibleOutput: mergedValidation.valid, stage: "metadata", validationBlockers: mergedValidation.blockers });
  attempts.push({ stage: "metadata", outcome: mergedValidation.valid ? "completed" : "failed", validationBlockers: mergedValidation.blockers });
  return { result: { ...metadataResult, data: adapted.value || {} }, validation: mergedValidation, skillTraces, executionRecords, recovery: { stage: "platform_writer", policy: "wechat_body_first_recovery_v1", maxAttempts: 2, automaticRetry: false, providerCalls: callBudget.consumed, providerCallStages: callBudget.stages, attempts, status: mergedValidation.valid ? "recovered" : "exhausted" } };
}

function deterministicTwoStageTitleResult(contentPackage, contentMaster) {
  const candidates = list(contentPackage?.title_candidates).map((item) => text(typeof item === "string" ? item : item?.title)).filter(Boolean);
  const recommended = text(contentPackage?.recommended_title);
  const knownSources = new Set(list(contentMaster?.source_list).map((item) => item.source_id).filter(Boolean));
  const claimSources = list(contentPackage?.claim_map).flatMap((item) => list(item?.source_ids));
  const selected = Boolean(recommended) && candidates.includes(recommended);
  const traceable = claimSources.length > 0 && claimSources.every((sourceId) => knownSources.has(sourceId));
  const updated = structuredClone(contentPackage);
  updated.title_strategy = {
    stage: "writer_metadata",
    selectionMode: "deterministic_existing_metadata",
    selected_title: selected ? recommended : null,
    providerEnrichment: "skipped_budgeted_two_stage_recovery"
  };
  return {
    contentPackage: updated,
    checks: [
      { check: "two_stage_metadata_title_selected", result: selected ? "pass" : "fail" },
      { check: "two_stage_metadata_claim_sources_traceable", result: traceable ? "pass" : "fail" }
    ]
  };
}

async function runWechatWriterWithRecovery({ writerPrompt, platform, generateText, planStep, recoveryOnly = false, strictChain = false }) {
  const attempts = [];
  const skillTraces = [];
  const executionRecords = [];
  let recoveredFromTraceId = null;
  let result = null;
  let validation = null;
  const invocationCount = strictChain || recoveryOnly ? 1 : 2;
  for (let recoveryAttempt = 1; recoveryAttempt <= invocationCount; recoveryAttempt += 1) {
    const targetedRecovery = recoveryOnly || recoveryAttempt > 1;
    const input = targetedRecovery
      ? buildWechatArticleRecoveryPrompt(writerPrompt, { attempt: recoveryAttempt, failedTraceId: recoveredFromTraceId, previousBlockers: attempts.at(-1)?.validationBlockers || [] })
      : writerPrompt;
    result = await runContentSkill({ capability: "write-wechat-article", platform, input, generateText, fallback: {}, expectedContract: "WechatArticle@2.0", task: targetedRecovery ? "write_wechat_article_v2_recovery" : "write_wechat_article_v2", planStep, maxAttempts: 1 });
    validation = validateWechatArticleForProduction(result.data);
    if (strictChain) {
      const invocationBlocker = strictWechatInvocationBlocker(result, "wechat_writer");
      if (invocationBlocker) validation = { ...validation, valid: false, blockers: [...new Set([...validation.blockers, invocationBlocker])] };
    }
    const trace = observableSkillTrace(result, { recoveryAttempt, validation, recoveredFromTraceId });
    if (!recoveredFromTraceId) recoveredFromTraceId = trace.traceId || trace.providerTraceId || null;
    const record = { ...(result.executionRecord || {}), status: validation.valid ? "completed" : "failed", attempt: recoveryAttempt, recoveryAttempt, errorCode: trace.errorCode, errorCategory: trace.errorCategory, failureStage: trace.failureStage, contractDiagnostics: structuredClone(trace.contractDiagnostics), providerAttempts: trace.providerAttempts, productionEligibleOutput: validation.valid, validationBlockers: validation.blockers };
    skillTraces.push(trace);
    executionRecords.push(record);
    attempts.push({ attempt: recoveryAttempt, maxAttempts: invocationCount, traceId: trace.traceId || null, providerTraceId: trace.providerTraceId, providerMode: result.mode, providerAttempts: trace.providerAttempts, errorCode: trace.errorCode, errorCategory: trace.errorCategory, failureStage: trace.failureStage, contractDiagnostics: structuredClone(trace.contractDiagnostics), validationBlockers: validation.blockers, validationMetrics: validation.metrics, outcome: validation.valid ? "recovered" : "failed", completedAt: trace.completedAt || new Date().toISOString() });
    if (validation.valid) break;
  }
  return { result, validation, skillTraces, executionRecords, recovery: { stage: "platform_writer", policy: "bounded_targeted_body_recovery", maxAttempts: invocationCount, attempts, status: validation?.valid ? (recoveryOnly || attempts.length > 1 ? "recovered" : "not_needed") : "exhausted" } };
}

export async function prepareContentMaster({ payload, selection, intentProfile, citations = [], knowledgeAssets = [], contentTaskBrief = null, contentSourcePlan = null, factSnapshot = null }, deps) {
  const platform = payload.platform || selection?.platform || "xiaohongshu";
  if (!PLATFORM_RULES[platform]) throw new Error("当前内容流水线仅支持小红书和微信公众号");
  const topicTitle = text(selection?.platformTopic?.platform_topic || payload.ideaTitle || payload.customBrief, "待定义选题");
  const evidence = uniqueEvidence([...sourceEvidence(selection, citations), ...plannedSourceEvidence(payload), ...factEvidence(factSnapshot)]);
  const knowledgeContract = {
    enabled: knowledgeAssets.length > 0,
    snapshot_id: intentProfile.promotion.knowledge_snapshot_id || null,
    allowed_assets: knowledgeAssets.map((item) => ({ asset_id: item.id, asset_type: item.kind || "document", name: item.name || item.fileName || item.id })),
    forbidden_uses: ["不得补写资料中不存在的客户、效果、数字、价格、资质或承诺"]
  };
  const masterInput = { platform, topicTitle, evidence, intentProfile, knowledgeContract, contentTaskBrief, contentSourcePlan, factSnapshot, contentExecutionContext: payload.contentExecutionContext || null };
  const prompt = {
    task: "build_content_master_v2",
    instruction: "先遵守 content_task_brief 的受众、目标、核心观点和风险边界，再只根据 supplied_evidence 与 allowed_assets 建立事实合同。不要写平台正文。事实必须引用 source_id；缺少证据的内容只能进入 unknowns 或 author_opinions。只返回合同要求的 JSON。",
    output_contract: "ContentMaster@2.0",
    content_intent_profile: intentProfile,
    content_execution_context: payload.contentExecutionContext || null,
    content_task_brief: contentTaskBrief,
    content_source_plan: contentSourcePlan,
    fact_snapshot: factSnapshot,
    creative_blueprints: list(payload.contentSourceEvidence?.viralBlueprints),
    content_pattern_snapshot: payload.contentPatternSnapshot || null,
    skill_pattern_packs: list(payload.contentSkillPatternPacks),
    temporary_materials: list(payload.temporaryMaterials),
    supplied_evidence: evidence,
    knowledge_contract: knowledgeContract
  };
  const planStep = payload.skillExecutionPlan?.steps?.find((step) => step.id === "content_master") || null;
  const result = await runContentSkill({ capability: "build-content-master", platform, input: prompt, generateText: deps.generateText, fallback: masterFallback(masterInput), expectedContract: "ContentMaster@2.0", task: "build_content_master_v2", planStep });
  const envelope = normalizeMaster(result.data, masterInput);
  return { platform, topicTitle, status: skillFallbackUsed(result) ? "needs_review" : envelope.status, contentMaster: envelope.data, skillTrace: result.skillTrace };
}

export async function runContentPipeline({ payload, selection, intentProfile, citations = [], account = null, knowledgeAssets = [], contentTaskBrief = null, contentSourcePlan = null, factSnapshot = null, preparedContentMaster = null, preparationSkillTrace = null, confirmedOutline = null, skillExecutionPlan = null }, deps) {
  const platform = payload.platform || selection?.platform || "xiaohongshu";
  const strictWechatSkillChain = platform === "wechat" && payload.wechatStrictSkillChain === true;
  const preparedAuthority = preparedContentMaster ? validatePreparedSharedContentMaster(preparedContentMaster) : { valid: false, ref: null };
  const chainShell = (sharedContentMasterRef = null) => ({
    mode: payload.wechatBodyRecovery === true ? "explicit_recovery" : "normal",
    maxProviderCalls: payload.wechatBodyRecovery === true ? 4 : 3,
    automaticRetries: 0,
    sharedContentMasterRef,
    stages: []
  });
  if (strictWechatSkillChain && !preparedAuthority.valid) {
    return {
      status: "blocked", providerMode: null, contentMaster: preparedContentMaster?.data || null, contentPackage: null,
      qualityReview: { status: "needs_review", decision: "block", checks: [{ check: "wechat_shared_master_authority", result: "fail", detail: "wechat_prepared_shared_master_authority_invalid" }], blockers: ["wechat_prepared_shared_master_authority_invalid"], issues: [{ gate: "WechatSharedMasterAuthorityGate", severity: "fail" }], repairPlan: [{ gate: "WechatSharedMasterAuthorityGate", rerunFrom: "content_master" }] },
      skillTraces: [], executionRecords: [], editorialReview: null, writerRecovery: null,
      wechatSkillChain: chainShell(), pipeline: ["content_intent_profile", "shared_content_master_authority_blocked"]
    };
  }
  const imageRegistry = verifiedWechatImageAssets(payload);
  if (strictWechatSkillChain && !imageRegistry.valid) {
    return {
      status: "blocked", providerMode: null, contentMaster: preparedContentMaster?.data || null, contentPackage: null,
      qualityReview: { status: "needs_review", decision: "block", checks: [{ check: "wechat_authorized_image_registry", result: "fail", detail: { invalidCount: imageRegistry.invalidCount } }], blockers: ["wechat_authorized_image_registry_invalid"], issues: [{ gate: "WechatAuthorizedImageRegistryGate", severity: "fail" }], repairPlan: [{ gate: "WechatAuthorizedImageRegistryGate", rerunFrom: "image_asset_authorization" }] },
      skillTraces: [], executionRecords: [], editorialReview: null, writerRecovery: null,
      wechatSkillChain: chainShell(preparedAuthority.ref), pipeline: ["content_intent_profile", "authorized_image_registry_blocked"]
    };
  }
  if (!PLATFORM_RULES[platform]) throw new Error("当前内容流水线仅支持小红书和微信公众号");
  const planStep = (id) => skillExecutionPlan?.steps?.find((step) => step.id === id) || null;
  const topicTitle = text(selection?.platformTopic?.platform_topic || payload.ideaTitle || payload.customBrief, "待定义选题");
  const evidence = uniqueEvidence([...sourceEvidence(selection, citations), ...plannedSourceEvidence(payload), ...factEvidence(factSnapshot)]);
  const knowledgeContract = {
    enabled: knowledgeAssets.length > 0,
    snapshot_id: intentProfile.promotion.knowledge_snapshot_id || null,
    allowed_assets: knowledgeAssets.map((item) => ({ asset_id: item.id, asset_type: item.kind || "document", name: item.name || item.fileName || item.id })),
    forbidden_uses: ["不得补写资料中不存在的客户、效果、数字、价格、资质或承诺"]
  };
  const masterInput = { platform, topicTitle, evidence, intentProfile, knowledgeContract, contentTaskBrief, contentSourcePlan, factSnapshot, contentExecutionContext: payload.contentExecutionContext || null };
  const masterPrompt = {
    task: "build_content_master_v2",
    instruction: "你是内容总编。先遵守 content_task_brief 的受众、目标、核心观点与风险边界，再只根据 supplied_evidence 和 allowed_assets 建立事实合同，不写平台正文。事实必须逐条引用 source_id；fact_snapshot 中只有 usableFacts 可以公开引用，contextOnlyFacts 只能辅助理解，forbiddenFacts 严禁写入。缺证据的内容只能进入 unknowns 或 author_opinions。不得把热度、评论或推断写成事实。输出一个 JSON 对象，顶层仅含 status 和 data。",
    output_contract: "ContentMaster@2.0",
    output_shape: { status: "ready | needs_review | blocked", data: { target_audience: "", central_question: "", central_thesis: "", reader_value: "", content_emphasis: [], confirmed_facts: [{ fact_id: "F1", fact: "", source_ids: ["T1"] }], supported_interpretations: [{ interpretation_id: "I1", text: "", source_ids: ["T1"], confidence: "medium" }], author_opinions: [], unknowns: [], examples: [], claims_to_avoid: [], publish_time_checks: [] } },
    required_fields: ["target_audience", "central_question", "central_thesis", "reader_value", "content_emphasis", "confirmed_facts", "supported_interpretations", "author_opinions", "unknowns", "examples", "claims_to_avoid", "publish_time_checks"],
    topic: { title: topicTitle, platform_topic: selection?.platformTopic || null, source_topic: selection?.sourceSnapshot || null },
    content_intent_profile: intentProfile,
    content_execution_context: payload.contentExecutionContext || null,
    content_task_brief: contentTaskBrief,
    content_source_plan: contentSourcePlan,
    fact_snapshot: factSnapshot,
    creative_blueprints: list(payload.contentSourceEvidence?.viralBlueprints),
    content_pattern_snapshot: payload.contentPatternSnapshot || null,
    skill_pattern_packs: list(payload.contentSkillPatternPacks),
    temporary_materials: list(payload.temporaryMaterials),
    supplied_evidence: evidence,
    knowledge_contract: knowledgeContract
  };
  const masterResult = preparedContentMaster ? { skillTrace: preparationSkillTrace } : await runContentSkill({ capability: "build-content-master", platform, input: masterPrompt, generateText: deps.generateText, fallback: masterFallback(masterInput), expectedContract: "ContentMaster@2.0", task: "build_content_master_v2", planStep: planStep("content_master") });
  const masterEnvelope = preparedContentMaster
    ? { status: preparedContentMaster.status || "ready", data: structuredClone(preparedContentMaster.data || preparedContentMaster) }
    : normalizeMaster(masterResult.data, masterInput);
  const legacyMasterId = text(masterEnvelope.data?.content_master_id || masterEnvelope.data?.id);
  const sharedMasterRef = strictWechatSkillChain
    ? preparedAuthority.ref
    : legacyMasterId ? buildPreparedSharedContentMaster(masterEnvelope.data, { status: masterEnvelope.status }).sharedContentMasterRef : null;
  if (masterEnvelope.status === "blocked" || skillFallbackUsed(masterResult)) {
    const blocker = skillFallbackUsed(masterResult) ? "content_master_provider_fallback" : "content_master_evidence_blocked";
    return {
      status: "blocked",
      providerMode: masterResult?.mode || null,
      contentMaster: masterEnvelope.data,
      contentPackage: null,
      qualityReview: { status: "needs_review", decision: "block", checks: [{ check: "content_master_evidence_status", result: "fail", detail: blocker }], blockers: [blocker], issues: [{ gate: "ContentMasterGate", severity: "fail", detail: blocker }], repairPlan: [{ gate: "ContentMasterGate", rerunFrom: "content_master" }] },
      skillTraces: [masterResult?.skillTrace].filter(Boolean),
      executionRecords: [masterResult?.executionRecord].filter(Boolean),
      editorialReview: null,
      writerRecovery: null,
      pipeline: ["content_intent_profile", "build-content-master", "blocked_before_outline_and_writer"]
    };
  }
  const common = {
    topicTitle, platform, intentProfile, master: masterEnvelope.data,
    content_execution_context: payload.contentExecutionContext || null,
    content_task_brief: contentTaskBrief,
    content_source_plan: contentSourcePlan,
    confirmed_outline: confirmedOutline,
    outline_lock_rule: confirmedOutline ? "正文必须遵循已确认大纲；不得新增大纲之外的核心主张或删除大纲章节" : null,
    creative_blueprints: list(payload.contentSourceEvidence?.viralBlueprints),
    content_pattern_snapshot: payload.contentPatternSnapshot || null,
    skill_pattern_packs: list(payload.contentSkillPatternPacks),
    temporary_materials: list(payload.temporaryMaterials),
    platform_rules: PLATFORM_RULES[platform], account_style: account?.visualStyle || null,
    design_fallback: account?.visualStyle ? null : "缺少 DesignDNA：使用克制的中性编辑风格，并在 preflight 标记复核；禁止默认科技蓝、霓虹和无关3D元素。"
  };
  const initialWechatBundle = platform === "wechat"
    ? wechatChainBundle({ payload, account, intentProfile, masterRef: sharedMasterRef, imageAssets: imageRegistry.assets })
    : null;
  if (strictWechatSkillChain && !validateWechatChainBundle(initialWechatBundle)) {
    return {
      status: "blocked", providerMode: null, contentMaster: masterEnvelope.data, contentPackage: null,
      qualityReview: { status: "needs_review", decision: "block", checks: [{ check: "wechat_skill_reference_bundle", result: "fail" }], blockers: ["wechat_skill_reference_bundle_incomplete"], issues: [{ gate: "WechatSkillReferenceBundleGate", severity: "fail" }], repairPlan: [{ gate: "WechatSkillReferenceBundleGate", rerunFrom: "platform_brief" }] },
      skillTraces: [], executionRecords: [], editorialReview: null, writerRecovery: null,
      wechatSkillChain: { ...chainShell(sharedMasterRef), bundleHash: hashWechatChainValue(initialWechatBundle) },
      pipeline: ["content_intent_profile", "wechat_skill_reference_bundle_blocked"]
    };
  }
  const writerPrompt = platform === "xiaohongshu" ? {
    task: "write_xhs_content_v2",
    instruction: "基于 ContentMaster 写一套可发布的小红书图文包。标题、开头、封面与卡片必须兑现同一个内容承诺；正文负责阅读体验，卡片负责可视化信息，不要逐字重复。生成6-10页，每页只承担一个信息任务。只有需要位图的页面才使用 generated_raster 并生成一条 ImageSpec；图中所有文字由前端 HTML/CSS 叠加，生图提示词必须明确 no text, no logo, no watermark。不要伪装亲历、客户评价或测评。只返回 JSON。",
    output_contract: "XhsPostPackage@2.0",
    output_shape: { status: "ready | needs_review", data: { content_promise: "", engagement_strategy: { primary_action: "save | share | comment | follow | consult | try | buy | register | none", reason: "" }, post_copy: { title_candidates: ["", "", ""], recommended_title: "", opening: "", body_sections: [{ heading: "", content: "" }], ending: "", pinned_comment: "", hashtags: [""], cta: "" }, deck: { aspect_ratio: "3:4", canvas: { width: 1080, height: 1440 }, pages: [{ page_id: "P1", page_number: 1, page_role: "cover", headline: "", supporting_text: "", text_layers: [], render_strategy: "html_css | authorized_asset | generated_raster | no_visual_needed", visual_direction: "", fact_ids: [], interpretation_ids: [] }] }, image_specs: [{ page_id: "P3", purpose: "", prompt: "", negative_prompt: "", prohibitions: ["no text", "no logo", "no watermark"] }], skipped_image_pages: [], traceability: {} } },
    hard_requirements: { title_candidates: "3-5", hashtags: "3-8", deck_pages: "6-10", canvas: "1080x1440", primary_engagement_actions: 1, image_spec_prompt_order: ["purpose", "scene", "subject", "medium", "composition", "light", "palette_and_material", "text_safe_area", "brand_constraints", "prohibitions"] },
    ...common
  } : {
    task: "write_wechat_article_v2",
    instruction: "基于 ContentMaster 写一篇可发布的公众号文章。先在内部完成论证规划，输出只保留最终 JSON。文章要形成连续论证而不是把小红书卡片拉长；开头说明问题为何值得读，中段至少三节且每节推动论点，结尾给出边界和行动建议。生成封面与正文配图规划；数据图、流程图优先 html_chart，照片或插画才用 generated_raster，生图提示词禁止文字、logo和水印。不得编造案例、采访、数据或行业共识。",
    output_contract: "WechatArticle@2.0",
    output_shape: { status: "ready | needs_review", data: { article_promise: "", core_argument: "", information_gain: "", title_candidates: ["", "", ""], recommended_title: "", abstract: "", opening: "", outline: [{ heading: "", relation_to_argument: "", claims: [], boundary: "" }], article_markdown: "## 小标题\n完整文章", pull_quotes: [], key_takeaways: [], share_summary: "", share_reason: "", engagement_strategy: { primary_action: "share | comment | follow | consult | try | buy | register | none", reason: "" }, cta: "", claim_map: [{ claim: "", source_ids: ["T1"] }], used_knowledge_asset_ids: [], image_plan: { cover: { purpose: "", strategy: "generated_raster", prompt: "no text, no logo, no watermark" }, slots: [{ slot_purpose: "", strategy: "html_chart | generated_raster | authorized_asset | no_image", prompt: "" }] } } },
    hard_requirements: { title_candidates: "3-5", article_markdown_min_chars: WECHAT_ARTICLE_MIN_CHARS, h2_sections_min: WECHAT_ARTICLE_MIN_H2_SECTIONS, primary_engagement_actions: 1, image_plan: "cover plus at least one body slot" },
    ...common,
    reference_bundle: initialWechatBundle,
    shared_content_master_ref: sharedMasterRef
  };
  const useBodyFirstRecovery = platform === "wechat" && payload.wechatBodyRecovery === true && featureFlags().wechatBodyFirstRecoveryV1;
  const wechatWriter = platform === "wechat"
    ? useBodyFirstRecovery
      ? await runWechatBodyFirstRecovery({ writerPrompt, platform, generateText: deps.generateText, planStep: planStep("platform_writer"), contentRunId: payload.contentRunId || payload.contentWorkflowId })
      : await runWechatWriterWithRecovery({ writerPrompt, platform, generateText: deps.generateText, planStep: planStep("platform_writer"), recoveryOnly: payload.wechatBodyRecovery === true, strictChain: strictWechatSkillChain })
    : null;
  const writerResult = wechatWriter?.result || await runContentSkill({ capability: "write-xhs-content", platform, input: writerPrompt, generateText: deps.generateText, fallback: {}, expectedContract: "XhsPostPackage@2.0", task: "write_xhs_content_v2", planStep: planStep("platform_writer") });
  const packageEnvelope = platform === "xiaohongshu" ? normalizeXhs(writerResult.data, common, masterEnvelope.data) : normalizeWechat(writerResult.data, common, masterEnvelope.data);
  const skillTraces = [masterResult.skillTrace, ...(wechatWriter?.skillTraces || [writerResult.skillTrace])].filter(Boolean);
  const executionRecords = [masterResult.executionRecord, ...(wechatWriter?.executionRecords || [writerResult.executionRecord])].filter(Boolean);
  if (platform === "xiaohongshu" && skillFallbackUsed(writerResult)) {
    return {
      status: "blocked",
      providerMode: writerResult.mode,
      contentMaster: masterEnvelope.data,
      contentPackage: packageEnvelope.data,
      qualityReview: { status: "needs_review", decision: "block", checks: [{ check: "xhs_writer_provider_status", result: "fail", detail: writerResult.telemetry?.errorCode || "XHS_WRITER_PROVIDER_FALLBACK" }, ...packageEnvelope.data.preflight_checks], blockers: ["xhs_writer_provider_fallback"], issues: [{ gate: "XhsPostPackageProviderGate", severity: "fail", detail: writerResult.telemetry?.errorCode || null }], repairPlan: [{ gate: "XhsPostPackageProviderGate", rerunFrom: "platform_writer" }] },
      skillTraces,
      executionRecords,
      editorialReview: null,
      writerRecovery: null,
      pipeline: ["content_intent_profile", "build-content-master", "write-xhs-content", "blocked_before_title_and_render"]
    };
  }
  if (wechatWriter && !wechatWriter.validation.valid) {
    const checks = [
      { check: "wechat_writer_contract", result: "fail", detail: wechatWriter.validation },
      ...packageEnvelope.data.preflight_checks
    ];
    return {
      status: "blocked",
      providerMode: writerResult.mode,
      contentMaster: masterEnvelope.data,
      contentPackage: packageEnvelope.data,
      qualityReview: { status: "needs_review", decision: "block", checks, blockers: [...new Set(["wechat_writer_recovery_exhausted", ...wechatWriter.validation.blockers])], issues: [{ gate: "WechatArticleContractGate", severity: "fail", detail: wechatWriter.validation }], repairPlan: [{ gate: "WechatArticleContractGate", rerunFrom: "platform_writer" }] },
      skillTraces,
      executionRecords,
      editorialReview: null,
      writerRecovery: wechatWriter.recovery,
      pipeline: ["content_intent_profile", "build-content-master", "write-wechat-article", useBodyFirstRecovery ? "wechat_body_first_recovery_v1" : "bounded_targeted_body_recovery", "blocked_before_downstream"]
    };
  }
  let editorialReview = null;
  if (platform === "wechat") {
    const reviewBundle = wechatChainBundle({ payload, account, intentProfile, masterRef: sharedMasterRef, article: packageEnvelope.data, imageAssets: imageRegistry.assets });
    const reviewResult = await runContentSkill({
      capability: "review-wechat-article",
      platform,
      input: { mode: "report_only", review_stage: "content_review", wechat_article: packageEnvelope.data, content_intent_profile: intentProfile, content_master: masterEnvelope.data, shared_content_master_ref: sharedMasterRef, account_strategy: account || {}, current_version: 1, locked_ranges: ["confirmed_facts", "source_list"], publish_rules: PLATFORM_RULES.wechat, reference_bundle: reviewBundle },
      generateText: deps.generateText,
      fallback: { status: "needs_review", data: { decision: "block", findings: [{ code: "WECHAT_EDITORIAL_REVIEW_UNAVAILABLE", severity: "fail", field: "article_markdown" }], patches: [], changes: [], fact_recheck_required: true, publish_time_checks: [] } },
      expectedContract: "WechatArticleReview@1.0",
      task: "review_wechat_article_content",
      planStep: planStep("wechat_content_review"),
      maxAttempts: 1
    });
    const reviewTelemetry = providerAwareDownstreamResult(reviewResult);
    skillTraces.push(reviewTelemetry.trace);
    executionRecords.push(reviewTelemetry.record);
    editorialReview = reviewResult.data?.data || reviewResult.data || null;
    const strictReview = strictWechatSkillChain || useBodyFirstRecovery;
    const reviewInvocationBlocker = strictReview ? strictWechatInvocationBlocker(reviewResult, "wechat_review") : null;
    const reviewSchemaBlocker = !["pass", "revise", "block"].includes(editorialReview?.decision) ? "wechat_review_schema_invalid" : null;
    if (reviewInvocationBlocker || reviewSchemaBlocker || editorialReview?.decision === "block") {
      const reviewDetail = editorialReview.findings || [];
      const blocker = reviewInvocationBlocker || reviewSchemaBlocker || "wechat_editorial_review";
      return {
        status: "blocked",
        providerMode: writerResult.mode,
        contentMaster: masterEnvelope.data,
        contentPackage: packageEnvelope.data,
        qualityReview: { status: "needs_review", decision: "block", checks: [...packageEnvelope.data.preflight_checks, { check: "wechat_editorial_review", result: "fail", detail: reviewDetail }], blockers: [blocker], issues: [{ gate: "WechatEditorialReviewGate", severity: "fail", detail: reviewDetail }], repairPlan: [{ gate: "WechatEditorialReviewGate", rerunFrom: "wechat_content_review" }] },
        skillTraces,
        executionRecords,
        editorialReview,
        writerRecovery: wechatWriter?.recovery || null,
        wechatSkillChain: { ...chainShell(sharedMasterRef), bundleHash: hashWechatChainValue(reviewBundle), stages: executionRecords.map((record) => ({ stage: record.capability, status: record.status, invocationId: record.invocationId, bundleHash: record.bundleHash, inputHash: record.inputHash, outputHash: record.outputHash, maxAttempts: 1 })) },
        pipeline: ["content_intent_profile", "build-content-master", "write-wechat-article", "review-wechat-article", "blocked_before_image_plan"]
      };
    }
  }
  const titleResult = platform === "wechat" && (strictWechatSkillChain || useBodyFirstRecovery)
    ? deterministicTwoStageTitleResult(packageEnvelope.data, masterEnvelope.data)
    : await optimizeFinalTitles({
      platform,
      contentMaster: masterEnvelope.data,
      contentPackage: packageEnvelope.data,
      contentTaskBrief,
      sameAccountTitleSignals: payload.titlePerformanceSignals,
      accountTone: account?.tone || account?.voice || null,
      contentPatternSnapshot: payload.contentPatternSnapshot || null,
      skillPatternPacks: list(payload.contentSkillPatternPacks)
    }, { ...deps, planStep: planStep("title") });
  packageEnvelope.data = titleResult.contentPackage;
  if (titleResult.titleStrategy) packageEnvelope.data.title_strategy = titleResult.titleStrategy;
  if (titleResult.skillTrace) skillTraces.push(titleResult.skillTrace);
  if (titleResult.executionRecord) executionRecords.push(titleResult.executionRecord);
  if (platform === "wechat") {
    const planBundle = wechatChainBundle({ payload, account, intentProfile, masterRef: sharedMasterRef, article: packageEnvelope.data, imageAssets: imageRegistry.assets });
    const imagePlanResult = await runContentSkill({
      capability: "plan-wechat-images",
      platform,
      input: { wechat_article: packageEnvelope.data, content_master: masterEnvelope.data, shared_content_master_ref: sharedMasterRef, design_dna: account?.visualStyle || null, authorized_assets: imageRegistry.assets, image_count_range: { min: 1, max: 5 }, provider_capability: "generated_raster_without_text", reference_bundle: planBundle },
      generateText: deps.generateText,
      fallback: { status: "success", data: packageEnvelope.data.image_plan },
      expectedContract: "WechatImagePlan@1.0",
      task: "plan_wechat_images",
      planStep: planStep("image_plan"),
      maxAttempts: 1
    });
    const imagePlanTelemetry = providerAwareDownstreamResult(imagePlanResult);
    skillTraces.push(imagePlanTelemetry.trace);
    executionRecords.push(imagePlanTelemetry.record);
    const planned = imagePlanResult.data?.data || imagePlanResult.data || {};
    const strictPlan = strictWechatSkillChain || useBodyFirstRecovery;
    let canonicalPlan = null;
    let planSchemaBlocker = null;
    if (strictPlan) {
      try { canonicalPlan = adaptWechatImagePlanOutput(imagePlanResult.data); }
      catch { planSchemaBlocker = "wechat_image_plan_schema_invalid"; }
    }
    const planInvocationBlocker = strictPlan ? strictWechatInvocationBlocker(imagePlanResult, "wechat_image_plan") : null;
    const planStatusBlocker = strictPlan && imagePlanResult.data?.status !== "success" ? "wechat_image_plan_non_success" : null;
    if (planInvocationBlocker || planSchemaBlocker || planStatusBlocker) {
      const blocker = planStatusBlocker || planSchemaBlocker || planInvocationBlocker;
      return {
        status: "blocked", providerMode: writerResult.mode, contentMaster: masterEnvelope.data, contentPackage: packageEnvelope.data,
        qualityReview: { status: "needs_review", decision: "block", checks: [...packageEnvelope.data.preflight_checks, { check: "wechat_image_plan", result: "fail", detail: blocker }], blockers: [blocker], issues: [{ gate: "WechatImagePlanInvocationGate", severity: "fail", detail: blocker }], repairPlan: [{ gate: "WechatImagePlanInvocationGate", rerunFrom: "image_plan" }] },
        skillTraces, executionRecords, editorialReview, writerRecovery: wechatWriter?.recovery || null,
        wechatSkillChain: { ...chainShell(sharedMasterRef), bundleHash: hashWechatChainValue(planBundle), stages: executionRecords.map((record) => ({ stage: record.capability, status: record.status, invocationId: record.invocationId, bundleHash: record.bundleHash, inputHash: record.inputHash, outputHash: record.outputHash, maxAttempts: 1 })) },
        pipeline: ["content_intent_profile", "build-content-master", "write-wechat-article", "review-wechat-article", "plan-wechat-images", "blocked_before_content_gate"]
      };
    }
    if (planned.cover || planned.slots) {
      packageEnvelope.data.image_plan = {
        plan_id: canonicalPlan?.planId || planned.plan_id,
        cover: planned.cover ? { ...planned.cover, prompt: planned.cover.image_spec?.prompt || planned.cover.prompt || "" } : null,
        slots: list(planned.slots).map((slot) => ({ ...slot, slot_purpose: slot.slot_purpose || slot.purpose, prompt: slot.image_spec?.prompt || slot.prompt || "" }))
      };
    }
  }
  const editorialChecks = editorialReview ? [{ check: "wechat_editorial_review", result: editorialReview.decision === "block" ? "fail" : editorialReview.decision === "revise" ? "warning" : "pass", detail: editorialReview.findings || [] }] : [];
  const outlineChecks = confirmedOutline ? [{ check: "confirmed_outline_supplied_to_writer", result: "pass", detail: confirmedOutline.id || confirmedOutline.outline_id || null }] : [];
  const gateReview = runContentGates({ platform, contentMaster: masterEnvelope.data, confirmedOutline, contentPackage: packageEnvelope.data, requireConfirmedOutline: Boolean(payload.contentRunId || payload.contentWorkflowId) });
  const gateChecks = gateReview.checks.map((item) => ({ check: item.gate, result: item.result, detail: item.detail }));
  const allChecks = [{ check: "content_master_evidence_status", result: masterEnvelope.status === "blocked" ? "fail" : "pass" }, ...outlineChecks, ...packageEnvelope.data.preflight_checks, ...titleResult.checks, ...editorialChecks, ...gateChecks];
  packageEnvelope.data.preflight_checks = allChecks;
  const status = masterEnvelope.status === "blocked" || gateReview.decision === "block" ? "blocked" : allChecks.every((item) => item.result === "pass") ? "succeeded" : "needs_review";
  for (const trace of skillTraces) {
    if (!trace || executionRecords.some((record) => record?.traceId === (trace.traceId || trace.id))) continue;
    if (resolveSkillAdapter(trace.skillName, platform)) executionRecords.push(buildExecutionRecord({ capability: trace.skillName, platform, trace, outputVersion: trace.expectedContract }));
  }
  return {
    status,
    providerMode: writerResult.mode,
    contentMaster: masterEnvelope.data,
    contentPackage: packageEnvelope.data,
    qualityReview: { status: status === "succeeded" ? "passed" : "needs_review", decision: gateReview.decision, checks: allChecks, blockers: allChecks.filter((item) => item.result === "fail").map((item) => item.check), issues: gateReview.issues, repairPlan: gateReview.repairPlan },
    skillTraces,
    executionRecords,
    editorialReview,
    writerRecovery: wechatWriter?.recovery || null,
    skippedProviderStages: [],
    wechatSkillChain: platform === "wechat" ? {
      ...chainShell(sharedMasterRef),
      bundleHash: hashWechatChainValue(wechatChainBundle({ payload, account, intentProfile, masterRef: sharedMasterRef, article: packageEnvelope.data, imageAssets: imageRegistry.assets })),
      stages: executionRecords.filter((record) => ["write-wechat-article", "review-wechat-article", "plan-wechat-images"].includes(record.capability)).map((record) => ({ stage: record.capability, status: record.status, invocationId: record.invocationId, bundleHash: record.bundleHash, inputHash: record.inputHash, outputHash: record.outputHash, maxAttempts: 1 }))
    } : null,
    pipeline: platform === "xiaohongshu" ? ["content_intent_profile", "build-content-master", "write-xhs-content", "generate-platform-titles", "content_gate_engine", "deterministic_preflight"] : useBodyFirstRecovery ? ["content_intent_profile", "build-content-master", "wechat_body_first_recovery_v1", "review-wechat-article", "plan-wechat-images", "content_gate_engine", "deterministic_preflight"] : ["content_intent_profile", "build-content-master", "write-wechat-article", "review-wechat-article", "plan-wechat-images", "content_gate_engine", "deterministic_preflight"]
  };
}

export async function reviseContentPackage({ task, instruction, routing, account = null }, deps) {
  const platform = task.platform;
  if (!PLATFORM_RULES[platform]) throw new Error("当前内容修订仅支持小红书和微信公众号");
  const isXhsPageText = platform === "xiaohongshu" && routing.requestClass === "page_text";
  const pageProjection = isXhsPageText ? projectXhsPageTargets(task.currentContent, instruction) : [];
  const effectiveAllowedPrefixes = isXhsPageText ? allowedXhsPageProjectionPrefixes(pageProjection) : allowedPatchPrefixes(platform, routing.requestClass);
  const prompt = {
    task: platform === "xiaohongshu" ? "revise_xhs_content_package_v2" : "revise_wechat_article_v2",
    instruction: "把 user_instruction 转换成 ContentPackagePatch@1.0。只返回结构化 JSON Patch，不返回完整内容包。事实、选题、平台、内容目的或推广变化必须使用 rerun_upstream，不得在成稿中暗改。局部修改只生成最小 operations；不得新增 ContentMaster 未授权的事实。若用户说内容太少、太短或要求扩写，必须实际扩展正文相关字段并增加有效信息量，不能只改版本说明、元数据或原样返回。",
    user_instruction: instruction,
    change_routing: routing,
    content_task_id: task.id || null,
    base_version: task.version || 1,
    allowed_paths: effectiveAllowedPrefixes,
    locked_paths: ["/source_list", "/traceability", "/content_purpose_id", "/intent_profile_id", "/topic_id"],
    locked_contract: { content_master: task.contentMaster, intent_profile: task.contentIntentProfile },
    platform_rules: PLATFORM_RULES[platform],
    account_style: account?.visualStyle || null,
    current_package: task.currentContent,
    page_projection: pageProjection,
    page_patch_rules: isXhsPageText ? [
      "仅修改 page_projection 中 targeted=true 的页面。",
      "operations.path 必须使用该页 json_pointer 开头的数组索引路径；不得把 P5 等 page_id 当作数组索引。",
      "修改案例、效果、数字或绝对化结果时，fact_ids 必须指向语义支持该表述的 confirmed_facts；无支持时删除该表述。"
    ] : []
  };
  const fallbackPatch = { status: "needs_review", data: { content_task_id: task.id || "", base_version: task.version || 1, user_instruction: instruction, request_class: routing.requestClass, execution_mode: routing.executionMode, target_paths: [], locked_paths: prompt.locked_paths, operations: [], evidence_impact: routing.executionMode === "rerun_upstream" ? "requires_new_evidence" : "none", rerun_plan: [], quality_checks: [], version: { parent: task.version || 1, proposed: Number(task.version || 1) + 1, change_summary: instruction }, clarifying_question: "" }, warnings: [], blocked_reasons: [] };
  let result = await runContentSkill({ capability: "revise-content-package", platform, input: prompt, generateText: deps.generateText, fallback: fallbackPatch, expectedContract: "ContentPackagePatch@1.0", task: prompt.task, planStep: deps.planStep || null });
  const common = {
    platform,
    topicTitle: task.ideaTitle || task.contentMaster?.central_thesis || "当前选题",
    intentProfile: task.contentIntentProfile,
    master: task.contentMaster
  };
  const unwrapPatch = (raw) => raw?.data?.operations ? raw.data : raw?.operations ? raw : null;
  let proposal = unwrapPatch(result.data);
  let legacyEnvelope = null;
  if (!proposal) {
    legacyEnvelope = platform === "xiaohongshu" ? normalizeXhs(result.data, common, task.contentMaster) : normalizeWechat(result.data, common, task.contentMaster);
    const legacyPatch = applyValidatedPatch(task.currentContent, legacyEnvelope.data, { allowedPrefixes: effectiveAllowedPrefixes, lockedPrefixes: prompt.locked_paths });
    proposal = { ...fallbackPatch.data, status: legacyPatch.operations.length ? "success" : "needs_review", target_paths: legacyPatch.operations.map((item) => item.path), operations: legacyPatch.operations };
  }
  const requiresUpstreamConfirmation = routing.executionMode === "rerun_upstream" || proposal.execution_mode === "rerun_upstream" || ["requires_new_evidence", "recheck"].includes(proposal.evidence_impact) && ["claim", "topic", "purpose", "promotion", "platform"].includes(proposal.request_class);
  if (requiresUpstreamConfirmation) {
    return {
      providerMode: result.mode,
      skillTraces: [result.skillTrace].filter(Boolean),
      executionRecords: [result.executionRecord].filter(Boolean),
      contentPackage: structuredClone(task.currentContent),
      patch: { schemaVersion: "1.0", status: "awaiting_upstream_confirmation", content: structuredClone(task.currentContent), operations: [], blockedOperations: [], proposal },
      requiresUpstreamConfirmation: true,
      qualityReview: { status: "needs_review", checks: [], blockers: ["upstream_reconfirmation_required"] }
    };
  }
  let validatedPatch = applyValidatedOperations(task.currentContent, proposal.operations, {
    allowedPrefixes: effectiveAllowedPrefixes,
    lockedPrefixes: prompt.locked_paths
  });
  if (!validatedPatch.operations.length && !validatedPatch.failedTests?.length) {
    const retryPrompt = { ...prompt, task: `${prompt.task}_repair`, instruction: `${prompt.instruction} 上一次没有返回可应用的最小 operations；如指令明确，这次必须给出合法 JSON Patch。page_text 必须使用 page_projection 给出的 json_pointer，不得返回完整包或空 operations。`, previous_failed_output: proposal };
    result = await runContentSkill({ capability: "revise-content-package", platform, input: retryPrompt, generateText: deps.generateText, fallback: fallbackPatch, expectedContract: "ContentPackagePatch@1.0", task: retryPrompt.task, planStep: deps.planStep || null });
    proposal = unwrapPatch(result.data) || proposal;
    validatedPatch = applyValidatedOperations(task.currentContent, proposal.operations, { allowedPrefixes: effectiveAllowedPrefixes, lockedPrefixes: prompt.locked_paths });
  }
  if (platform === "wechat" && routing.requestClass === "copy") {
    const explicit = explicitWechatCopyOperations(validatedPatch.content, instruction);
    if (explicit.operations.length) {
      const supplemented = applyValidatedOperations(validatedPatch.content, explicit.operations, { allowedPrefixes: effectiveAllowedPrefixes, lockedPrefixes: prompt.locked_paths });
      validatedPatch = {
        ...validatedPatch,
        content: supplemented.content,
        operations: [...validatedPatch.operations, ...supplemented.operations],
        blockedOperations: [...(validatedPatch.blockedOperations || []), ...(supplemented.blockedOperations || [])],
        failedTests: [...(validatedPatch.failedTests || []), ...(supplemented.failedTests || [])]
      };
    }
  }
  const envelope = platform === "xiaohongshu" ? normalizeXhs(validatedPatch.content, common, task.contentMaster) : normalizeWechat(validatedPatch.content, common, task.contentMaster);
  validatedPatch.content = envelope.data;
  validatedPatch.proposal = proposal;
  const blockers = [...(envelope.data.preflight_checks || []).filter((item) => item.result === "fail").map((item) => item.check)];
  if (!validatedPatch.operations.length) blockers.push("requested_change_not_applied");
  if (isXhsPageText && validatedPatch.blockedOperations.length && !blockers.includes("requested_change_not_applied")) blockers.push("requested_change_not_applied");
  if (validatedPatch.failedTests?.length) blockers.push("patch_test_failed");
  return {
    providerMode: result.mode,
    skillTraces: [result.skillTrace].filter(Boolean),
    executionRecords: [result.executionRecord].filter(Boolean),
    contentPackage: envelope.data,
    patch: validatedPatch,
    versionProjection: {
      schemaVersion: "1.0",
      baseVersion: Number(task.version || 1),
      proposedVersion: Number(task.version || 1) + 1,
      parentContentFingerprint: contentFingerprint(task.currentContent),
      proposedContentFingerprint: contentFingerprint(envelope.data),
      immutable: true,
      affectedPageIds: pageProjection.map((page) => page.page_id),
      invalidatedNodes: routing.requestClass === "page_text" ? ["storyboard", "render", "visual_review", "delivery"] : []
    },
    requiresUpstreamConfirmation: false,
    qualityReview: { status: blockers.length ? "needs_review" : "passed", checks: envelope.data.preflight_checks, blockers }
  };
}
