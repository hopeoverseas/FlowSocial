const featureKeyForEnv = (env) => String(env).toLowerCase().replace(/_([a-z0-9])/g, (_, value) => value.toUpperCase());
const definition = (env, state, tier, effect = "local") => Object.freeze({ env, featureKey: featureKeyForEnv(env), state, tier, effect });

export const LOCAL_PRODUCT_POLICY_VERSION = "5.0";

export const LOCAL_PRODUCT_CAPABILITIES = Object.freeze([
  definition("UNIFIED_CONTENT_PRODUCTION_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_PREREQUISITES_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_ARTIFACTS_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_ATOMIC_PRODUCT_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1", "1", "baseline"),
  definition("UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1", "1", "baseline"),
  definition("LOCAL_CONTENT_PROMOTION_V1", "1", "baseline"),
  definition("LOCAL_PACKAGE_DELIVERY_V1", "1", "baseline"),
  definition("WECHAT_ILLUSTRATED_DELIVERY_V1", "1", "baseline"),
  definition("XHS_INTEGRATED_PAGE_DESIGN_SKILL", "1", "baseline"),
  definition("XHS_INTEGRATED_PAGE_DIRECTION_REVIEW", "1", "baseline"),
  definition("XHS_INTEGRATED_PAGE_PROVIDER_COMPILER", "1", "baseline"),
  definition("XHS_VISUAL_ASSET_REGISTRY", "1", "baseline"),
  definition("XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN", "1", "baseline"),
  definition("UNIFIED_CONTENT_XHS_HUMAN_VISUAL_CONFIRMATION_V1", "1", "baseline"),
  definition("ATOMIC_MANUAL_PUBLICATION_V1", "1", "controlled", "local_publication_fact"),
  definition("ATOMIC_EXACT_FEEDBACK_V1", "1", "controlled", "local_feedback_fact"),
  definition("ATOMIC_PUBLICATION_LIFECYCLE_V1", "1", "controlled", "local_publication_fact"),
  definition("ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1", "1", "baseline", "local_feedback_ui"),
  definition("STRATEGY_FEEDBACK_V1", "1", "controlled", "human_confirmed_strategy_experiment"),

  definition("UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1", "1", "controlled", "paid_provider"),
  definition("UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1", "1", "controlled", "paid_provider"),
  definition("UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_APPROVAL_V1", "1", "controlled", "paid_provider"),
  definition("UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1", "1", "controlled", "paid_provider"),
  definition("UNIFIED_CONTENT_XHS_LIGHT_REVISION_V1", "1", "controlled", "paid_provider"),

  definition("PLATFORM_PUBLISHING_V1", "0", "external_effect", "platform_write"),
  definition("CONTENT_PROMOTION_V1", "0", "external_effect", "legacy_external_effect"),
  definition("UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1", "0", "external_effect", "wechat_upload"),
  definition("ATOMIC_WECHAT_DRAFT_CREATION_V1", "0", "external_effect", "wechat_draft"),

  definition("VIRAL_LEARNING_V1", "0", "experimental"),
  definition("MATRIX_COLLABORATION_V1", "0", "experimental"),
  definition("SKILL_AUTO_PROMOTION_V1", "0", "experimental"),
  definition("UNIFIED_CONTENT_XHS_VISUAL_REVIEW_APPROVAL_V1", "0", "experimental"),
  definition("UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1", "0", "experimental"),
  definition("XHS_DETERMINISTIC_VISUAL_QUALITY_GATE", "0", "experimental"),
  definition("XHS_INTEGRATED_PAGE_OFFLINE_PIPELINE", "0", "experimental"),
  definition("XHS_INTEGRATED_PAGE_OCR_GATE", "0", "experimental"),
  definition("XHS_INTEGRATED_PAGE_VERSIONING", "0", "experimental"),
  definition("XHS_INTEGRATED_PAGE_OFFLINE_REVIEW", "0", "experimental"),
  definition("XHS_INTEGRATED_PAGE_OFFLINE_DELIVERY", "0", "experimental"),
  definition("XHS_INTEGRATED_PAGE_DIRECT_DELIVERY", "0", "experimental"),
  definition("WECHAT_BODY_FIRST_RECOVERY_V1", "0", "experimental")
]);

export const LOCAL_PRODUCT_FLAG_DEFAULTS = Object.freeze(Object.fromEntries(
  LOCAL_PRODUCT_CAPABILITIES.map((item) => [item.env, item.state])
));

function enabled(value) {
  return !["0", "false", "off", "disabled", ""].includes(String(value ?? "").toLowerCase());
}

export function buildProductCapabilityPolicyReport(env = process.env, runtimeFlags = null) {
  const capabilities = LOCAL_PRODUCT_CAPABILITIES.map((item) => {
    const effectiveState = enabled(env[item.env]) ? "enabled" : "disabled";
    const expectedState = item.state === "1" ? "enabled" : "disabled";
    const runtimeState = runtimeFlags && Object.hasOwn(runtimeFlags, item.featureKey)
      ? (runtimeFlags[item.featureKey] === true ? "enabled" : "disabled")
      : null;
    return Object.freeze({
      env: item.env,
      featureKey: item.featureKey,
      tier: item.tier,
      effect: item.effect,
      expectedState,
      effectiveState,
      runtimeState,
      runtimeAligned: runtimeState === null || runtimeState === effectiveState,
      operatorOverride: effectiveState !== expectedState
    });
  });
  const deviations = capabilities.filter((item) => item.operatorOverride);
  const runtimeMismatches = capabilities.filter((item) => !item.runtimeAligned);
  const unsafeDeviations = deviations.filter((item) => item.tier === "external_effect" && item.effectiveState === "enabled");
  const missingBaseline = capabilities.filter((item) => item.tier === "baseline" && item.effectiveState !== "enabled");
  return Object.freeze({
    schemaVersion: "1.0",
    policyVersion: LOCAL_PRODUCT_POLICY_VERSION,
    mode: env.FLOWSOCIAL_PRODUCT_MODE || "custom",
    baselineReady: missingBaseline.length === 0,
    externalEffectsClosed: unsafeDeviations.length === 0,
    runtimeFlagsAligned: runtimeMismatches.length === 0,
    counts: Object.freeze({
      baseline: capabilities.filter((item) => item.tier === "baseline").length,
      controlled: capabilities.filter((item) => item.tier === "controlled").length,
      externalEffect: capabilities.filter((item) => item.tier === "external_effect").length,
      experimental: capabilities.filter((item) => item.tier === "experimental").length
    }),
    deviations: Object.freeze(deviations),
    unsafeDeviations: Object.freeze(unsafeDeviations),
    missingBaseline: Object.freeze(missingBaseline),
    runtimeMismatches: Object.freeze(runtimeMismatches),
    capabilities: Object.freeze(capabilities)
  });
}
