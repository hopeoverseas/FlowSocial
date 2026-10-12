import { conservativeCoverageFromAnswer, evaluateCoverageLayers } from "./profile-coverage-registry.mjs";

export const diagnosticFieldOrder = [
  "business.primaryOffers", "business.businessModel", "audiences.primary", "business.conversionPath", "accountStrategy.primaryGoal",
  "accountStrategy.growthStage", "accountStrategy.platformRoles", "accountStrategy.contentResources", "accountStrategy.constraints"
];

// Minimum viable strategy fields. Growth stage and content resources are useful
// enrichment, but they must not turn V1 onboarding into an exhaustive interview.
export const draftRequiredFields = [
  "business.primaryOffers",
  "business.businessModel",
  "audiences.primary",
  "business.conversionPath",
  "accountStrategy.primaryGoal",
  "accountStrategy.platformRoles",
  "accountStrategy.constraints"
];
export const activationRequiredFields = [...draftRequiredFields];
export const processedStates = new Set(["confirmed", "accepted_suggestion", "explicit_none", "temporarily_unknown", "skipped", "not_available"]);
export const effectiveStates = new Set(["confirmed", "accepted_suggestion", "explicit_none"]);

const placeholderPattern = /^(未提及|未知|暂无|不清楚|待补充|none|null|unknown|n\/a)$/i;
export function meaningfulDiagnosticValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return Boolean(value.trim()) && !placeholderPattern.test(value.trim());
  if (Array.isArray(value)) return value.some(meaningfulDiagnosticValue);
  if (typeof value === "object") return value.none === true || Object.values(value).some(meaningfulDiagnosticValue);
  return true;
}

export function resolveDiagnosticState(claims = [], fieldStates = [], coverageStates = []) {
  const claimMap = new Map(claims.filter((claim) => !["rejected", "conflicting", "superseded"].includes(claim.status)).map((claim) => [claim.fieldPath, claim]));
  const stateMap = new Map(fieldStates.map((item) => [item.fieldPath, item]));
  const coverageMap = new Map(coverageStates.filter((item)=>item.targetType === "core_field").map((item)=>[item.targetId,item]));
  const fieldResults = diagnosticFieldOrder.map((fieldPath) => {
    const claim = claimMap.get(fieldPath) || null;
    const state = stateMap.get(fieldPath)?.state || (meaningfulDiagnosticValue(claim?.value) ? "confirmed" : "unasked");
    const hasValue = meaningfulDiagnosticValue(claim?.value);
    const coverage = coverageMap.get(fieldPath) || null;
    const coverageTerminal = ["skipped","not_applicable"].includes(coverage?.status);
    const stateTerminal = processedStates.has(state);
    const layers=coverage ? evaluateCoverageLayers(coverage) : null;
    const claimCoverage=hasValue ? conservativeCoverageFromAnswer("core_field",fieldPath,claim?.value,typeof claim?.value==="string"?claim.value:"") : null;
    const claimMinimum=fieldPath==="business.conversionPath" ? Boolean(claimCoverage?.minimumDraftReady) : hasValue;
    const processed = stateTerminal || hasValue || Boolean(layers?.answered);
    const explicitNone = state === "explicit_none" || claim?.value?.none === true;
    const minimumDraftReady=coverageTerminal || Boolean(layers?.minimumDraftReady) || claimMinimum || (explicitNone && !draftRequiredFields.includes(fieldPath));
    const qualityComplete=coverageTerminal || Boolean(layers?.qualityComplete);
    const effective = minimumDraftReady;
    return { fieldPath, state, claim, coverage, hasValue, processed, effective, minimumDraftReady, qualityComplete, minimumMissingGroups:layers?.minimumMissingGroups||[], qualityMissingSlots:layers?.qualityMissingSlots||[], requiredForDraft: draftRequiredFields.includes(fieldPath), requiredForActivation: activationRequiredFields.includes(fieldPath) };
  });
  const byPath = new Map(fieldResults.map((item) => [item.fieldPath, item]));
  const missingFields = draftRequiredFields.filter((field) => !byPath.get(field)?.effective);
  const activationMissingFields = activationRequiredFields.filter((field) => !byPath.get(field)?.effective);
  const minimumMissingFields = draftRequiredFields.filter((field) => !byPath.get(field)?.processed);
  const minimumAssumptionFields = draftRequiredFields.filter((field) => byPath.get(field)?.processed && !byPath.get(field)?.effective);
  const unresolvedFields = fieldResults.filter((item) => !item.effective && !["temporarily_unknown", "skipped", "not_available"].includes(item.state)).map((item) => item.fieldPath);
  const processedFields = fieldResults.filter((item) => item.processed).map((item) => item.fieldPath);
  const confirmedFields = fieldResults.filter((item) => item.effective).map((item) => item.fieldPath);
  const requiredSkippedFields = draftRequiredFields.filter((field) => ["temporarily_unknown", "skipped", "not_available"].includes(byPath.get(field)?.state));
  const allProcessed = processedFields.length === diagnosticFieldOrder.length;
  const allEffective = confirmedFields.length === diagnosticFieldOrder.length;
  const canGeneratePreliminaryDraft = minimumMissingFields.length === 0;
  const coreComplete = allProcessed && unresolvedFields.length === 0;
  const qualityGapFields=fieldResults.filter((item)=>!item.qualityComplete&&!(["temporarily_unknown","skipped","not_available"].includes(item.state))).map((item)=>item.fieldPath);
  const qualityComplete=qualityGapFields.length===0;
  return {
    fields: fieldResults,
    processedFields,
    confirmedFields,
    missingFields,
    minimumDraftFields: [...draftRequiredFields],
    minimumMissingFields,
    minimumAssumptionFields,
    activationMissingFields,
    unresolvedFields,
    requiredSkippedFields,
    processedCount: processedFields.length,
    confirmedCount: confirmedFields.length,
    totalCount: diagnosticFieldOrder.length,
    canGeneratePreliminaryDraft,
    canGenerateMinimumDraft: canGeneratePreliminaryDraft,
    canGenerateHighConfidenceDraft: qualityComplete,
    canGenerateDraft: canGeneratePreliminaryDraft,
    minimumDraftReady: canGeneratePreliminaryDraft,
    qualityComplete,
    qualityGapFields,
    coreComplete,
    shouldContinueQuestioning: !canGeneratePreliminaryDraft,
    canActivate: canGeneratePreliminaryDraft,
    allProcessed,
    allEffective
  };
}
