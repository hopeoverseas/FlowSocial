import { runContentSkill } from "./skill-runner.mjs";
import {
  materializeUnifiedSkillRuntimeOutput,
  validateUnifiedSkillDomainInput,
  validateUnifiedSkillDomainOutput
} from "./unified-skill-output-contracts.mjs";
import { compileXhsCreativeDraft } from "./xhs-creative-draft-compiler.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { assembleXhsAtomicSkillOutput, runXhsAtomicSkill } from "./xhs-atomic-skill-runtime.mjs";
import {
  createExecutionAuthorityBinding,
  createSkillActivityInvocation,
  DEFAULT_ATOMIC_ATTEMPT_POLICY
} from "./unified-execution-contracts.mjs";

const CONTENT_MASTER_CONSUMERS = Object.freeze([
  "generate-content-outline",
  "write-xhs-content",
  "write-wechat-article",
  "review-wechat-article",
  "generate-platform-titles",
  "plan-wechat-images"
]);
const XHS_ATOMIC_CAPABILITIES = Object.freeze([
  "write-xhs-post-copy",
  "plan-xhs-carousel",
  "plan-xhs-visual-assets"
]);

function fail(code, message, statusCode = 409, details = null) {
  throw Object.assign(new Error(message || code), { code, statusCode, details });
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function createLiveInvocationIdentity({ ordinal, capability, platform, step }) {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || typeof capability !== "string" || !capability
    || typeof platform !== "string" || !platform || typeof step?.id !== "string" || !step.id) {
    fail("UNIFIED_CONTENT_LIVE_INVOCATION_IDENTITY_INVALID", "Live Skill invocation identity must exactly bind ordinal, capability, platform, and stepId");
  }
  return deepFreeze({ ordinal, capability, platform, stepId: step.id });
}

function controlledLiveGenerateText(generateText, liveIdentity) {
  return async (request, fallback = null) => {
    if (fallback != null) {
      fail("UNIFIED_CONTENT_LIVE_FALLBACK_FORBIDDEN", "Formal Atomic Live Skill invocations cannot supply a business fallback");
    }
    if (request?.skill_runtime?.skill_name !== liveIdentity.capability) {
      fail("UNIFIED_CONTENT_LIVE_INVOCATION_IDENTITY_MISMATCH", "Live Skill request capability does not match the authorized invocation identity");
    }
    return generateText(request, { liveInvocation: clone(liveIdentity) });
  };
}

function runSafePostProviderPhase(code, operation) {
  try {
    return operation();
  } catch (error) {
    if (typeof error?.code === "string" && error.code) {
      if (!Array.isArray(error.fieldPaths) && Array.isArray(error.details?.fieldPaths)) {
        error.fieldPaths = [...error.details.fieldPaths];
      }
      throw error;
    }
    throw Object.assign(new Error(code), {
      code,
      statusCode: 500,
      details: error?.details || (Array.isArray(error?.fieldPaths) ? { fieldPaths: error.fieldPaths } : null),
      fieldPaths: error?.fieldPaths || error?.details?.fieldPaths || [],
      causeCode: error?.causeCode || error?.code || null
    });
  }
}

function integratedPageCompatibilityEnvelope(input) {
  const pages = Array.isArray(input?.carousel_plan?.pages) ? input.carousel_plan.pages : [];
  return {
    status: "success",
    data: {
      schemaVersion: "1.0",
      contract: "XhsVisualAssetPlanCreativeOutput@1.0",
      pageVisuals: pages.map((page, index) => ({
        page: Number.isInteger(page?.page) ? page.page : index + 1,
        visualFunction: index === 0 ? "attention" : "explain",
        visualNeed: "整页设计由 design-xhs-integrated-pages 统一编译",
        renderStrategy: "html_css",
        mustKeep: ["冻结文字", "已确认 Design DNA"],
        mustAvoid: ["独立无文字配图 Prompt", "第二套视觉方向"]
      })),
      imageSpecs: [],
      skippedPages: pages.map((page, index) => ({
        page: Number.isInteger(page?.page) ? page.page : index + 1,
        reason: "html_css"
      })),
      pageAssetBindings: pages.map((page, index) => ({
        page: Number.isInteger(page?.page) ? page.page : index + 1,
        plannedAssetIds: []
      }))
    },
    warnings: [],
    blocked_reasons: []
  };
}

function taskForCapability(capability) {
  return {
    "build-content-master": "build_content_master_v2",
    "generate-content-outline": "generate_confirmable_content_outline",
    "write-xhs-content": "write_xhs_content_v2",
    "write-xhs-post-copy": "write_xhs_post_copy",
    "plan-xhs-carousel": "plan_xhs_carousel",
    "plan-xhs-visual-assets": "plan_xhs_visual_assets",
    "generate-platform-titles": "generate_platform_titles",
    "write-wechat-article": "write_wechat_narrative_creative_draft",
    "review-wechat-article": "review_wechat_article",
    "plan-wechat-images": "plan_wechat_images"
  }[capability] || undefined;
}

function assertXhsWriterDesignDnaBinding(output, skillInput) {
  const snapshotId = skillInput?.design_dna_ref?.id;
  if (typeof snapshotId !== "string" || !snapshotId) fail("UNIFIED_XHS_DESIGN_DNA_AUTHORITY_REQUIRED");
  const fieldPaths = [];
  if (output?.deck?.design_dna_version !== snapshotId) fieldPaths.push("data.deck.design_dna_version");
  if (Array.isArray(output?.image_specs) && output.image_specs.some((item) => item?.design_dna_version !== snapshotId)) fieldPaths.push("data.image_specs[]");
  if (fieldPaths.length) fail("UNIFIED_XHS_WRITER_DESIGN_DNA_BINDING_MISMATCH", "Writer output is not bound to the confirmed Design DNA snapshot", 409, { fieldPaths });
}

function atomicAuthorityBinding(authority) {
  if (!authority || typeof authority !== "object") fail("UNIFIED_XHS_ATOMIC_AUTHORITY_REQUIRED");
  const refs = Object.entries(authority)
    .filter(([role, value]) => role.endsWith("Ref") && value?.id && value?.hash)
    .map(([role, ref]) => ({ role, ref: clone(ref) }));
  return createExecutionAuthorityBinding({
    family: "atomic_v2",
    companyId: authority.companyId,
    accountId: authority.accountId,
    refs
  });
}

function xhsOutlineCardinalityBinding(input) {
  const sections = input?.confirmed_outline?.sections;
  if (!Array.isArray(sections) || sections.length < 1) {
    fail("UNIFIED_XHS_OUTLINE_CARDINALITY_REQUIRED", "Confirmed XHS outline sections are required before carousel Provider invocation");
  }
  const sectionOrder = sections.map((section, index) => {
    const sectionId = section?.sectionId || section?.section_id || section?.id;
    const outlineRole = section?.outlineRole || section?.outline_role || section?.role;
    if (typeof sectionId !== "string" || !sectionId.trim() || typeof outlineRole !== "string" || !outlineRole.trim()) {
      fail("UNIFIED_XHS_OUTLINE_CARDINALITY_INVALID", `Confirmed XHS outline section ${index + 1} must have an id and role`);
    }
    return { sectionId, outlineRole };
  });
  const binding = { sectionCount: sectionOrder.length, sectionOrder };
  const supplied = input.outline_cardinality;
  if (supplied != null && hashUnifiedContent(supplied) !== hashUnifiedContent(binding)) {
    fail("UNIFIED_XHS_OUTLINE_CARDINALITY_DRIFT", "Carousel outline cardinality binding does not match the confirmed outline");
  }
  return binding;
}

function createAtomicActivityBundle({ capability, invocation, rawProviderEnvelope, executionEvidence, verifiedComponent }) {
  const rawProviderEnvelopeRef = deepFreeze({
    id: `raw_provider_envelope:${invocation.id}`,
    hash: hashUnifiedContent(rawProviderEnvelope)
  });
  const draft = {
    schemaVersion: "1.0",
    contract: "UnifiedAtomicActivityBundle@1.0",
    id: `atomic_activity_bundle:${invocation.id}`,
    capability,
    invocation: clone(invocation),
    rawProviderEnvelopeRef: clone(rawProviderEnvelopeRef),
    executionEvidence: clone(executionEvidence),
    verifiedComponent: clone(verifiedComponent)
  };
  return deepFreeze({ ...draft, bundleHash: hashUnifiedContent(draft) });
}

export function createUnifiedSkillActivityExecutor({
  generateText,
  liveExecution = false,
  evidenceCompiler,
  attemptObserver = null,
  runner = runContentSkill,
  runtimeOutputMaterializer = materializeUnifiedSkillRuntimeOutput,
  domainInputValidator = validateUnifiedSkillDomainInput,
  domainOutputValidator = validateUnifiedSkillDomainOutput
}) {
  if (!evidenceCompiler) fail("UNIFIED_SKILL_EVIDENCE_COMPILER_REQUIRED", null, 500);
  let liveInvocationOrdinal = 0;

  return async function executeUnifiedSkillActivity({ capability, platform, input: skillInput, step, executionPlan }) {
    const observe = async (phase, checkpoint = null) => {
      if (typeof attemptObserver === "function") await attemptObserver({ phase, capability, platform, stepId: step?.id || null, checkpoint });
    };
    const masterFact = CONTENT_MASTER_CONSUMERS.includes(capability)
      ? evidenceCompiler.resolveUniqueOutputFact({ capability: "build-content-master" })
      : null;
    const articleFact = capability === "review-wechat-article"
      ? evidenceCompiler.resolveUniqueOutputFact({ capability: "write-wechat-article", platform: "wechat" })
      : null;
    const sourceContentMaster = skillInput?.content_master?.contract === "ContentMaster@3.0"
      ? clone(skillInput.content_master)
      : clone(masterFact?.verifiedDomainOutput?.contentMaster || masterFact?.runtimeOutput?.data || null);
    // Review the exact article carried by the authorized step input. The
    // ordinary product flow supplies its verified writer output, while the
    // Atomic WeChat flow supplies the compiler-bound article checkpoint.
    // Rebuilding either value here would create a second, divergent version.
    const sourceArticle = capability === "review-wechat-article"
      ? clone(skillInput?.article || articleFact?.verifiedDomainOutput || articleFact?.runtimeOutput?.data)
      : null;

    domainInputValidator({ capability, sourceSkillInput: skillInput, sourceContentMaster, sourceArticle });
    const liveIdentity = liveExecution === true
      ? createLiveInvocationIdentity({ ordinal: liveInvocationOrdinal + 1, capability, platform, step })
      : null;
    let invocationStarted = false;
    const observedGenerateText = async (...args) => {
      await observe("started");
      invocationStarted = true;
      return generateText(...args);
    };
    const activityGenerateText = liveIdentity
      ? controlledLiveGenerateText(observedGenerateText, liveIdentity)
      : observedGenerateText;
    let activityCompleted = false;
    const boundedOutlineConnectionRecovery = liveExecution === true && capability === "generate-content-outline";
    try {
      const result = await runner({
        capability,
        platform,
        input: clone(skillInput),
        generateText: activityGenerateText,
        fallback: null,
        expectedContract: step.outputContract,
        planStep: clone(step),
        executionPlan: clone(executionPlan),
        task: taskForCapability(capability),
        planAuthorization: "strict",
        maxAttempts: boundedOutlineConnectionRecovery ? 2 : liveExecution === true ? 1 : null,
        retryErrorCodes: boundedOutlineConnectionRecovery ? ["MODEL_CONNECT_TIMEOUT"] : null
      });
      if (liveIdentity) {
        const attempts = Number(result?.executionRecord?.attempt || 0);
        if (attempts !== 1 && !(boundedOutlineConnectionRecovery && attempts === 2)) fail("UNIFIED_CONTENT_LIVE_ZERO_RETRY_REQUIRED", `${capability} exceeded the authorized Live attempt boundary`);
        liveInvocationOrdinal = liveIdentity.ordinal;
      }

      const canonicalRuntimeOutput = runSafePostProviderPhase("UNIFIED_SKILL_SEMANTIC_MATERIALIZATION_INTERNAL_ERROR", () => runtimeOutputMaterializer({
        capability,
        runtimeOutput: result?.data,
        sourceSkillInput: skillInput,
        sourceContentMaster
      }));
      const evidence = evidenceCompiler.compileExecutionEvidence(result, { platform, step, executionPlan });
      const domainOutput = runSafePostProviderPhase("UNIFIED_SKILL_DOMAIN_VALIDATION_INTERNAL_ERROR", () => domainOutputValidator({
        capability,
        platform,
        outputContract: step.outputContract,
        runtimeOutput: canonicalRuntimeOutput,
        sourceContentMaster,
        sourceTitleInput: capability === "generate-platform-titles" ? skillInput : null,
        sourceSkillInput: skillInput,
        sourceArticle,
        task: capability === "write-wechat-article" ? "write_wechat_narrative_creative_draft" : null,
        runtimeOutputMaterializer
      }));
      if (capability === "write-xhs-content") {
        runSafePostProviderPhase("UNIFIED_XHS_DESIGN_DNA_BINDING_INTERNAL_ERROR", () => assertXhsWriterDesignDnaBinding(domainOutput, skillInput));
      }
      const outputFact = evidenceCompiler.commitCompletedInvocation({
        evidence,
        platform,
        step,
        executionPlan,
        runtimeOutput: result.data,
        verifiedDomainOutput: domainOutput
      });
      activityCompleted = true;
      await observe("completed", { invocation: evidence, outputFact });
      return domainOutput;
    } catch (error) {
      if (invocationStarted && !activityCompleted) await observe("failed");
      throw error;
    }
  };
}

export function createUnifiedAtomicSkillActivityExecutionPort({
  generateText,
  liveExecution = false,
  evidenceCompiler,
  runner = runXhsAtomicSkill,
  componentAssembler = assembleXhsAtomicSkillOutput
}) {
  if (!evidenceCompiler) fail("UNIFIED_SKILL_EVIDENCE_COMPILER_REQUIRED", null, 500);
  let liveInvocationOrdinal = 0;

  return async function executeUnifiedAtomicSkillActivity({ capability, input, systemContext, step, executionPlan }) {
    if (typeof generateText !== "function") {
      fail("UNIFIED_XHS_ATOMIC_GENERATE_TEXT_REQUIRED", "generateText is required for XHS atomic execution");
    }
    if (!XHS_ATOMIC_CAPABILITIES.includes(capability)) fail("UNIFIED_XHS_ATOMIC_CAPABILITY_UNSUPPORTED", `Unsupported atomic capability ${capability}`);
    if (step?.kind !== "skill" || step.capability !== capability) {
      fail("UNIFIED_XHS_ATOMIC_PLAN_STEP_MISMATCH", `Atomic plan step does not authorize ${capability}`);
    }
    const frozenStep = deepFreeze(clone(step));
    const frozenPlan = deepFreeze(clone(executionPlan));
    const inputWithCardinality = capability === "plan-xhs-carousel"
      ? { ...clone(input), outline_cardinality: xhsOutlineCardinalityBinding(input) }
      : clone(input);
    const frozenInput = deepFreeze(inputWithCardinality);
    const frozenSystemContext = deepFreeze(clone(systemContext));
    const planHash = hashUnifiedContent(frozenPlan);
    const formalInput = deepFreeze({ input: clone(frozenInput), systemContext: clone(frozenSystemContext) });
    const formalInputHash = hashUnifiedContent(formalInput);
    const invocation = createSkillActivityInvocation({
      id: `atomic_invocation:${frozenStep.id}:${formalInputHash.slice(0, 16)}`,
      skill: { name: capability, version: frozenStep.outputContract },
      inputRef: { id: `atomic_input:${frozenStep.id}`, hash: formalInputHash },
      authorityBinding: atomicAuthorityBinding(frozenSystemContext.authorityBinding),
      planHash,
      // Provider output is still contract-gated, but transient model
      // non-success/format drift gets a bounded retry within this invocation.
      attemptPolicy: { ...DEFAULT_ATOMIC_ATTEMPT_POLICY, maxAttempts: 3, automaticRetries: 2, maxProviderCalls: 3 }
    });
    const deterministicCompatibilityHandoff = capability === "plan-xhs-visual-assets";
    const liveIdentity = liveExecution === true && !deterministicCompatibilityHandoff
      ? createLiveInvocationIdentity({ ordinal: liveInvocationOrdinal + 1, capability, platform: "xiaohongshu", step: frozenStep })
      : null;
    const activityGenerateText = deterministicCompatibilityHandoff
      ? async () => ({ mode: "deterministic_adapter", data: integratedPageCompatibilityEnvelope(frozenInput) })
      : liveIdentity
        ? controlledLiveGenerateText(generateText, liveIdentity)
        : generateText;
    const result = await runner({
      capability,
      input: frozenInput,
      generateText: activityGenerateText,
      systemContext: frozenSystemContext,
      task: taskForCapability(capability),
      planStep: frozenStep,
      executionPlan: frozenPlan,
      planAuthorization: "strict",
      maxAttempts: liveExecution === true && !deterministicCompatibilityHandoff ? 3 : 1
    });
    if (!Number.isInteger(result?.executionRecord?.attempt) || result.executionRecord.attempt < 1 || result.executionRecord.attempt > invocation.attemptPolicy.maxAttempts) {
      fail("UNIFIED_XHS_ATOMIC_ZERO_RETRY_REQUIRED", `${capability} exceeded the atomic single-attempt boundary`);
    }
    if (liveIdentity) liveInvocationOrdinal = liveIdentity.ordinal;

    const rawProviderEnvelope = clone(result?.data);
    // The atomic post-copy assembler above is the sole authority for the new
    // XhsPostCopy contract. The legacy creative-draft compiler reconstructs a
    // narrower Writer Context and can reject an already verified component.
    if (capability === "plan-xhs-carousel"
      && ["pages", "sections", "section_drafts"].some((key) => Array.isArray(rawProviderEnvelope?.data?.[key]))) {
      try { compileXhsCreativeDraft({ capability, draft: rawProviderEnvelope, contentMaster: frozenInput.content_master, confirmedOutline: { ...frozenInput.confirmed_outline, sections: (frozenInput.confirmed_outline?.sections || []).map((section) => ({ ...section, sectionId: section.sectionId || section.section_id, outlineRole: section.outlineRole || section.role })) }, platformBrief: frozenInput.platform_brief, writerContext: frozenInput.writer_context || frozenSystemContext, mechanismDecision: frozenInput.mechanism_decision, promotionPolicy: frozenInput.promotion_policy }); }
      catch (error) { if (error?.code !== "XHS_ATOMIC_SKILL_AUTHORITY_INVALID") throw error; }
    }
    const verifiedComponent = componentAssembler({ capability, envelope: rawProviderEnvelope, systemContext: frozenSystemContext });
    if (hashUnifiedContent(verifiedComponent) !== hashUnifiedContent(result?.component)) {
      fail("UNIFIED_XHS_ATOMIC_VERIFIED_COMPONENT_MISMATCH", "Atomic Runtime component does not match formal validation output");
    }
    const executionEvidence = evidenceCompiler.compileExecutionEvidence(result, {
      platform: "xiaohongshu",
      step: frozenStep,
      executionPlan: frozenPlan
    });
    if (executionEvidence.outputHash !== hashUnifiedContent(rawProviderEnvelope)) {
      fail("UNIFIED_XHS_ATOMIC_OUTPUT_HASH_MISMATCH", "Atomic execution evidence is not bound to the raw Provider envelope");
    }
    const bundle = createAtomicActivityBundle({ capability, invocation, rawProviderEnvelope, executionEvidence, verifiedComponent });
    evidenceCompiler.commitAtomicActivityBundle({
      bundle,
      compilerContext: deepFreeze({ capability, input: clone(frozenInput), systemContext: clone(frozenSystemContext), step: clone(frozenStep), executionPlan: clone(frozenPlan) })
    });
    return bundle;
  };
}
