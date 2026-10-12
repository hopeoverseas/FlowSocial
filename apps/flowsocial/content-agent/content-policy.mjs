export const CONTENT_FUNCTIONS = Object.freeze(["discovery", "authority", "proof", "solution", "action"]);

export const PURPOSE_IDS = Object.freeze([
  "hotspot_industry_explainer",
  "knowledge_howto",
  "professional_opinion",
  "product_service_promotion",
  "case_result_showcase",
  "brand_story",
  "interactive_discussion",
  "event_announcement"
]);

export const PURPOSE_POLICY = Object.freeze({
  hotspot_industry_explainer: { functions: ["discovery", "authority"], sourceModes: ["hotspot", "mixed"], evidence: "current_external_evidence", defaultAction: "share" },
  knowledge_howto: { functions: ["authority", "solution"], sourceModes: ["knowledge", "mixed", "user_material"], evidence: "method_or_experience_evidence", defaultAction: "save" },
  professional_opinion: { functions: ["authority", "discovery"], sourceModes: ["knowledge", "hotspot", "mixed", "user_material"], evidence: "argument_support", defaultAction: "comment" },
  product_service_promotion: { functions: ["solution", "action"], sourceModes: ["knowledge", "mixed", "user_material"], evidence: "authorized_offer_evidence", defaultAction: "consult" },
  case_result_showcase: { functions: ["proof", "action"], sourceModes: ["knowledge", "mixed", "user_material"], evidence: "authorized_case_evidence", defaultAction: "consult" },
  brand_story: { functions: ["proof", "authority"], sourceModes: ["knowledge", "user_material", "mixed"], evidence: "authorized_brand_evidence", defaultAction: "follow" },
  interactive_discussion: { functions: ["discovery", "authority"], sourceModes: ["hotspot", "mixed", "user_material"], evidence: "bounded_context", defaultAction: "comment" },
  event_announcement: { functions: ["action", "discovery"], sourceModes: ["knowledge", "user_material", "mixed"], evidence: "verified_event_details", defaultAction: "register" }
});

export const FUNCTION_TO_LEGACY_ROLE = Object.freeze({
  discovery: "traffic",
  authority: "trust",
  proof: "trust",
  solution: "product",
  action: "conversion"
});

export function contentFunctionForRole(role, format = "") {
  if (role === "traffic") return "discovery";
  if (role === "product") return "solution";
  if (role === "conversion") return "action";
  return format === "case" ? "proof" : "authority";
}

export function legacyRoleForFunction(contentFunction) {
  return FUNCTION_TO_LEGACY_ROLE[contentFunction] || "trust";
}

export function purposeForFunction(contentFunction, { hasHotspot = false, format = "" } = {}) {
  if (contentFunction === "discovery") return hasHotspot ? "hotspot_industry_explainer" : "interactive_discussion";
  if (contentFunction === "proof") return "case_result_showcase";
  if (contentFunction === "solution") return format === "howto" || format === "checklist" ? "knowledge_howto" : "product_service_promotion";
  if (contentFunction === "action") return "product_service_promotion";
  return format === "howto" || format === "checklist" ? "knowledge_howto" : "professional_opinion";
}

export function resolvePurposePolicy(purposeId) {
  return PURPOSE_POLICY[purposeId] || PURPOSE_POLICY.professional_opinion;
}

export function selectConversionStage(conversionLadder, contentFunction, requestedStageId = null) {
  const stages = Array.isArray(conversionLadder?.stages) ? conversionLadder.stages.filter(Boolean) : [];
  if (!stages.length) return null;
  if (requestedStageId) {
    const requested = stages.find((stage) => stage.id === requestedStageId || stage.label === requestedStageId || stage.action === requestedStageId);
    if (requested) return requested;
  }
  const indexByFunction = { discovery: 0, authority: 1, proof: 1, solution: 2, action: stages.length - 1 };
  return stages[Math.min(Math.max(indexByFunction[contentFunction] ?? 1, 0), stages.length - 1)] || null;
}

export function normalizeFunctionPolicy(profile) {
  const policy = profile?.contentFunctionPolicy?.functions || {};
  const portfolio = profile?.contentFunctionPortfolio || {};
  return Object.fromEntries(CONTENT_FUNCTIONS.map((key) => {
    const target = Number(policy[key]?.target ?? portfolio[key] ?? 0);
    return [key, {
      min: Number(policy[key]?.min ?? Math.max(0, target - 10)),
      target,
      max: Number(policy[key]?.max ?? Math.min(100, target + 10)),
      rationale: policy[key]?.rationale || "按活动策略目标和近期内容历史滚动调整"
    }];
  }));
}
