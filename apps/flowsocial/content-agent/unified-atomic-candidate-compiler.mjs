import {
  createContentMechanismUsageBinding,
  createMechanismExplanation,
  hashUnifiedContent
} from "./unified-content-contracts.mjs";
import { createAtomicUnifiedContentCandidateV3 } from "./unified-execution-contracts.mjs";

const INPUT_KEYS = ["factGraphCompilation", "compilerContexts", "orchestrationSnapshot", "strategySnapshot", "existingConfirmationEvents", "boundAt"];
const TRACE_ID_FIELDS = ["usedFactIds", "usedInterpretationIds", "usedKnowledgeAssetIds", "usedReferenceAssetIds"];
const SOURCE_ID_KEYS = new Set([
  "id", "sourceId", "source_id", "assetId", "asset_id", "knowledgeAssetId", "knowledge_asset_id",
  "referenceAssetId", "reference_asset_id", "factId", "fact_id", "interpretationId", "interpretation_id"
]);
const SOURCE_ID_ARRAY_KEYS = new Set([
  "candidateIds", "candidate_ids", "sourceIds", "source_ids", "assetIds", "asset_ids", "knowledgeAssetIds",
  "knowledge_asset_ids", "referenceAssetIds", "reference_asset_ids", "factIds", "fact_ids", "interpretationIds", "interpretation_ids",
  "traceSourceIds", "trace_source_ids"
]);

function fail(code, fieldPaths = []) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details: { fieldPaths } });
}

function exact(value, keys) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()));
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function authorityRef(authorityBinding, role) {
  return authorityBinding?.refs?.find((item) => item.role === role)?.ref || null;
}

function collectSourceIdentifiers(value, results = new Set()) {
  if (!value || typeof value !== "object") return results;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceIdentifiers(item, results));
    return results;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SOURCE_ID_KEYS.has(key) && typeof child === "string" && child.trim()) results.add(child.trim());
    if (SOURCE_ID_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      child.filter((item) => typeof item === "string" && item.trim()).forEach((item) => results.add(item.trim()));
    }
    collectSourceIdentifiers(child, results);
  }
  return results;
}

function collectExactRefs(value, results = []) {
  if (!value || typeof value !== "object") return results;
  if (Array.isArray(value)) {
    value.forEach((item) => collectExactRefs(item, results));
    return results;
  }
  if (exact(value, ["id", "hash"]) && typeof value.id === "string" && /^[a-f0-9]{64}$/.test(value.hash || "")) {
    results.push(value);
    return results;
  }
  Object.values(value).forEach((item) => collectExactRefs(item, results));
  return results;
}

function receivedRefs(sourcePlan, plannedRefs) {
  const ids = collectSourceIdentifiers(sourcePlan);
  const exactKeys = new Set(collectExactRefs(sourcePlan).map((item) => `${item.id}:${item.hash}`));
  return plannedRefs.filter((item) => ids.has(item.id) || exactKeys.has(`${item.id}:${item.hash}`));
}

function traceSourceRefs(traceability, sourcePlan, received) {
  const receivedByKey = new Map(received.map((item) => [`${item.id}:${item.hash}`, item]));
  const ownership = new Map();
  const entries = Array.isArray(sourcePlan?.sources) ? sourcePlan.sources : [];
  const mappingEntries = [...entries, ...(Array.isArray(sourcePlan?.frozenSourceRefs) ? sourcePlan.frozenSourceRefs : [])];
  for (const entry of mappingEntries) {
    const identifiers = collectSourceIdentifiers(entry);
    const exactKeys = new Set(collectExactRefs(entry).map((item) => `${item.id}:${item.hash}`));
    const owners = received.filter((item) => identifiers.has(item.id) || exactKeys.has(`${item.id}:${item.hash}`));
    for (const identifier of identifiers) {
      const ownerKeys = ownership.get(identifier) || new Set();
      owners.forEach((item) => ownerKeys.add(`${item.id}:${item.hash}`));
      ownership.set(identifier, ownerKeys);
    }
  }
  const usedIds = new Set();
  for (const field of TRACE_ID_FIELDS) {
    const values = traceability?.[field];
    if (!Array.isArray(values) || values.some((item) => typeof item !== "string" || !item.trim())) fail("UNIFIED_ATOMIC_USAGE_TRACE_INVALID", [`traceability.${field}`]);
    values.forEach((item) => usedIds.add(item));
  }
  const usedKeys = new Set();
  for (const identifier of usedIds) {
    const ownerKeys = ownership.get(identifier) || new Set();
    if (ownerKeys.size > 1) fail("UNIFIED_ATOMIC_USAGE_TRACE_SOURCE_CONFLICT", ["sourcePlan.sources"]);
    if (ownerKeys.size === 1) usedKeys.add([...ownerKeys][0]);
  }
  // No ownership entry means no proof. Provider prose and title/body text are intentionally never inspected.
  return [...usedKeys].map((key) => receivedByKey.get(key)).filter(Boolean);
}

function findPostCopyContext(contexts) {
  const matches = contexts.filter((item) => item?.capability === "write-xhs-post-copy");
  if (matches.length !== 1) fail("UNIFIED_ATOMIC_USAGE_POST_COPY_CONTEXT_REQUIRED", ["compilerContexts"]);
  return deepFreeze(clone(matches[0]));
}

function resolveStrategyRequest(strategySnapshot, writerContext) {
  const expectedRef = writerContext?.authority_refs?.accountStrategyRef;
  if (!expectedRef || strategySnapshot?.id !== expectedRef.id || hashUnifiedContent(strategySnapshot) !== expectedRef.hash) {
    fail("UNIFIED_ATOMIC_USAGE_STRATEGY_AUTHORITY_STALE", ["strategySnapshot"]);
  }
  // Historical active Strategy snapshots predate the top-level
  // `payload.creativeMechanism` field. The unified server already derives and
  // binds the platform WriterContext mechanism from the frozen mechanism
  // decision; use that value only as a read-only compatibility projection.
  const mechanism = strategySnapshot?.payload?.creativeMechanism || writerContext?.creative_mechanism;
  if (typeof mechanism !== "string" || !mechanism.trim()) fail("UNIFIED_ATOMIC_USAGE_STRATEGY_CREATIVE_MECHANISM_REQUIRED", ["strategySnapshot.payload.creativeMechanism"]);
  const request = deepFreeze({ contract: "StrategyCreativeMechanismRequest@1.0", id: `strategy_creative_request:${strategySnapshot.id}:xiaohongshu`, mechanism: mechanism.trim() });
  return { request, ref: { id: request.id, hash: hashUnifiedContent(request) } };
}

function resolveExistingConfirmation(strategySnapshot, existingEvents, writerContext) {
  const requestedMechanism = strategySnapshot?.payload?.creativeMechanism || writerContext?.creative_mechanism;
  if (requestedMechanism === writerContext.creative_mechanism) return { event: null, ref: null, reason: null };
  const eventRef = strategySnapshot?.payload?.creativeMechanismConfirmationEventRef;
  const reason = strategySnapshot?.payload?.creativeDeviationReason;
  const matches = Array.isArray(existingEvents)
    ? existingEvents.filter((item) => item?.id === eventRef?.id && hashUnifiedContent(item) === eventRef?.hash)
    : [];
  if (matches.length !== 1) fail("UNIFIED_ATOMIC_USAGE_CREATIVE_CONFIRMATION_REQUIRED", ["strategySnapshot.payload.creativeMechanismConfirmationEventRef"]);
  return { event: deepFreeze(clone(matches[0])), ref: clone(eventRef), reason };
}

export function compileUnifiedAtomicCandidateUsage(input) {
  if (!exact(input, INPUT_KEYS)) fail("UNIFIED_ATOMIC_CANDIDATE_COMPILER_INPUT_INVALID", ["$"]);
  const frozen = deepFreeze(clone(input));
  const { factGraphCompilation, orchestrationSnapshot, strategySnapshot, existingConfirmationEvents, boundAt } = frozen;
  const postContext = findPostCopyContext(frozen.compilerContexts || []);
  const decision = postContext.input?.mechanism_decision;
  const decisionRef = postContext.input?.mechanism_decision_ref;
  const sourcePlan = postContext.input?.source_plan;
  const sourcePlanRef = postContext.input?.source_plan_ref;
  const writerContext = postContext.input?.writer_context;
  const authority = factGraphCompilation?.assembly?.fact?.authorityBinding;
  const traceability = factGraphCompilation?.deterministicFacts?.traceability?.component;
  if (!decision || !sourcePlan || !writerContext || !authority || !traceability) fail("UNIFIED_ATOMIC_CANDIDATE_COMPILER_AUTHORITY_REQUIRED", ["factGraphCompilation", "compilerContexts"]);
  if (!sameRef(decisionRef, authorityRef(authority, "mechanismDecisionRef"))) fail("UNIFIED_ATOMIC_USAGE_DECISION_AUTHORITY_MISMATCH", ["decisionRef"]);
  if (sourcePlanRef?.hash !== hashUnifiedContent(sourcePlan)) fail("UNIFIED_ATOMIC_USAGE_SOURCE_PLAN_STALE", ["sourcePlanRef"]);
  const assemblyWriterContextRef = authorityRef(authority, "writerContextRef");
  const writerContextRef = { id: assemblyWriterContextRef?.id, hash: writerContext.writerContextHash };
  if (!sameRef(assemblyWriterContextRef, writerContextRef)) fail("UNIFIED_ATOMIC_USAGE_WRITER_CONTEXT_STALE", ["writerContextRef"]);
  const platformRunRef = authorityRef(authority, "platformRunRef");
  const sharedContentMasterRef = authorityRef(authority, "sharedContentMasterRef");
  const xhsRun = orchestrationSnapshot?.platformRuns?.find((item) => item.platform === "xiaohongshu");
  if (!sameRef(platformRunRef, xhsRun?.platformRunRef)) fail("UNIFIED_ATOMIC_USAGE_PLATFORM_RUN_STALE", ["platformRunRef"]);

  const planned = decision.selectedSourceRefs || [];
  const received = receivedRefs(sourcePlan, planned);
  const writerEvidence = deepFreeze({
    contract: "WriterMechanismEvidence@1.0", id: `writer_mechanism_evidence:${platformRunRef.id}`,
    decisionRef: clone(decisionRef), sourcePlanRef: clone(sourcePlanRef), sharedContentMasterRef: clone(sharedContentMasterRef),
    platformRunRef: clone(platformRunRef), writerContextRef: clone(writerContextRef), receivedSourceRefs: clone(received),
    creativeMechanism: writerContext.creative_mechanism
  });
  const writerEvidenceRef = { id: writerEvidence.id, hash: hashUnifiedContent(writerEvidence) };
  const used = traceSourceRefs(traceability, sourcePlan, received);
  const traceEvidenceValue = deepFreeze({
    contract: "MechanismTraceEvidence@1.0", id: `mechanism_trace_evidence:${traceability.id}`,
    writerEvidenceRef: clone(writerEvidenceRef), usedSourceRefs: clone(used), unusedSourceRefs: []
  });
  const traceEvidence = [{ evidence: traceEvidenceValue, ref: { id: traceEvidenceValue.id, hash: hashUnifiedContent(traceEvidenceValue) } }];
  const strategy = resolveStrategyRequest(strategySnapshot, writerContext);
  const confirmation = resolveExistingConfirmation(strategySnapshot, existingConfirmationEvents, writerContext);
  const usageBinding = createContentMechanismUsageBinding({
    id: `mechanism_usage_binding:${platformRunRef.id}`, accountId: authority.accountId,
    decision, decisionRef, sourcePlan, sourcePlanRef, sharedContentMasterRef, platformRunRef,
    writerEvidence, writerEvidenceRef, traceEvidence,
    strategyCreativeMechanismRequest: strategy.request, strategyRequestRef: strategy.ref,
    writerContext, writerContextRef,
    creativeDeviationReason: confirmation.reason, confirmationEvent: confirmation.event, confirmationEventRef: confirmation.ref,
    boundAt
  });
  const mechanismExplanation = createMechanismExplanation(usageBinding);
  const candidate = createAtomicUnifiedContentCandidateV3({
    id: `unified_content_candidate_v3:${platformRunRef.id}`, platformRunRef,
    assemblyFact: factGraphCompilation.assembly.fact, usageBinding, mechanismExplanation
  });
  return deepFreeze({ usageBinding, mechanismExplanation, candidate });
}
