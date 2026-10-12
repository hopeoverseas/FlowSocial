import assert from "node:assert/strict";
import {
  UNIFIED_CONTENT_CONTRACTS,
  createContentMechanismUsageBinding,
  createMechanismExplanation,
  createUnifiedWriterContext,
  hashUnifiedContent,
  validateContentMechanismDecisionV2,
  validateContentMechanismUsageBinding,
  validateMechanismExplanation,
  withUnifiedContentHash
} from "../../content-agent/unified-content-contracts.mjs";

const ref = (id, token) => ({ id, hash: token.repeat(64).slice(0, 64) });
const plannedSourceRefs = [ref("hotspot-1", "a"), ref("knowledge-1", "b"), ref("material-1", "c")];
const decision = withUnifiedContentHash({
  schemaVersion: "2.0", contract: UNIFIED_CONTENT_CONTRACTS.mechanismDecisionV2, id: "decision-1", companyId: "company-1",
  projectInputRef: ref("project-input-1", "1"), activeStrategySnapshotRef: ref("strategy-1", "2"),
  taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
  mechanisms: [
    { mechanism: "hotspot", role: "primary", evaluationStatus: "evaluated", candidates: [{ sourceRef: plannedSourceRefs[0], status: "selected", reason: "selected for discovery" }], reason: "primary discovery source", factPolicy: "external_event_not_business_fact" },
    { mechanism: "knowledge", role: "supporting", evaluationStatus: "evaluated", candidates: [{ sourceRef: plannedSourceRefs[1], status: "selected", reason: "selected for evidence" }], reason: "supporting evidence", factPolicy: null },
    { mechanism: "user_material", role: "supporting", evaluationStatus: "evaluated", candidates: [{ sourceRef: plannedSourceRefs[2], status: "selected", reason: "selected for context" }], reason: "supporting context", factPolicy: null },
    { mechanism: "blueprint", role: "not_selected", evaluationStatus: "not_evaluated", candidates: [], reason: "not evaluated", factPolicy: null },
    { mechanism: "strategy_only", role: "not_selected", evaluationStatus: "evaluated", candidates: [], reason: "richer sources selected", factPolicy: null }
  ],
  selectedSourceRefs: plannedSourceRefs, strategyHotspotPolicy: "optional",
  deviation: { status: "none", reason: null, confirmationEventRef: null },
  decidedAt: "2026-08-06T03:00:00.000Z", decisionHash: ""
}, "decisionHash");
validateContentMechanismDecisionV2(decision);

const sourcePlan = { schemaVersion: "0.1", mode: "mixed", frozenSourceRefs: plannedSourceRefs };
const decisionRef = { id: decision.id, hash: decision.decisionHash };
const sourcePlanRef = { id: "source-plan-1", hash: hashUnifiedContent(sourcePlan) };
const sharedContentMasterRef = ref("master-1", "3");
const platformRunRef = ref("platform-run-1", "4");
const strategyRequest = { contract: "StrategyCreativeMechanismRequest@1.0", id: "strategy-creative-1", mechanism: "checklist" };
const strategyRequestRef = { id: strategyRequest.id, hash: hashUnifiedContent(strategyRequest) };

function writerContext(creativeMechanism = "checklist") {
  return createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "xiaohongshu",
    account_id: "account-1", topic_id: "topic-1", intent_profile_id: "intent-1", content_purpose_id: "purpose-1",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "discovery", trust_source: "institution" },
    creative_mechanism: creativeMechanism, journey_stage: "discover", coordination_mode: "standalone",
    matrix_coordination: { shared_campaign_topic_id: "", differentiation_angle: "standalone", prohibited_overlap: [] },
    authority_refs: { decisionRef, sourcePlanRef }
  });
}

function writerEvidenceFor(context, receivedSourceRefs = plannedSourceRefs) {
  const contextRef = { id: `writer-context-${context.creative_mechanism}`, hash: context.writerContextHash };
  const evidence = {
    contract: "WriterMechanismEvidence@1.0", id: `writer-evidence-${context.creative_mechanism}`,
    decisionRef, sourcePlanRef, sharedContentMasterRef, platformRunRef, writerContextRef: contextRef,
    receivedSourceRefs: structuredClone(receivedSourceRefs), creativeMechanism: context.creative_mechanism
  };
  return { contextRef, evidence, evidenceRef: { id: evidence.id, hash: hashUnifiedContent(evidence) } };
}

function trace(writerEvidenceRef, id, usedSourceRefs = [], unusedSourceRefs = []) {
  const evidence = { contract: "MechanismTraceEvidence@1.0", id, writerEvidenceRef, usedSourceRefs: structuredClone(usedSourceRefs), unusedSourceRefs: structuredClone(unusedSourceRefs) };
  return { evidence, ref: { id, hash: hashUnifiedContent(evidence) } };
}

function build(overrides = {}) {
  const context = overrides.writerContext || writerContext();
  const writer = overrides.writer || writerEvidenceFor(context, overrides.receivedSourceRefs);
  return createContentMechanismUsageBinding({
    id: overrides.id || "usage-binding-1", accountId: "account-1", decision, decisionRef: overrides.decisionRef || decisionRef,
    sourcePlan, sourcePlanRef: overrides.sourcePlanRef || sourcePlanRef, sharedContentMasterRef, platformRunRef,
    writerEvidence: overrides.writerEvidence || writer.evidence, writerEvidenceRef: overrides.writerEvidenceRef || writer.evidenceRef,
    traceEvidence: overrides.traceEvidence === undefined ? [trace(writer.evidenceRef, "trace-1", [plannedSourceRefs[0]], [plannedSourceRefs[1]])] : overrides.traceEvidence,
    strategyCreativeMechanismRequest: strategyRequest, strategyRequestRef, writerContext: context, writerContextRef: writer.contextRef,
    creativeDeviationReason: overrides.creativeDeviationReason ?? null,
    confirmationEvent: overrides.confirmationEvent ?? null, confirmationEventRef: overrides.confirmationEventRef ?? null,
    boundAt: overrides.boundAt || "2026-08-06T03:10:00.000Z"
  });
}

const binding = build();
validateContentMechanismUsageBinding(binding);
assert.deepEqual(binding.plannedSourceRefs, plannedSourceRefs);
assert.deepEqual(binding.writerReceivedSourceRefs, plannedSourceRefs);
assert.deepEqual(binding.provenUsedSourceRefs, [plannedSourceRefs[0]]);
assert.deepEqual(binding.sourceUsage.map((item) => item.status), ["used", "unused", "unknown_not_proven"]);
assert.match(binding.sourceUsage[0].reason, /deterministic_trace/);
assert.equal(binding.sourceUsage[1].evidenceRefs.length, 1);
assert.equal(binding.sourceUsage[2].evidenceRefs.length, 0);
assert.ok(Object.isFrozen(binding) && Object.isFrozen(binding.sourceUsage) && Object.isFrozen(binding.sourceUsage[0].sourceRef));
const stable = build();
assert.equal(stable.bindingHash, binding.bindingHash, "same evidence and timestamp must produce a stable binding hash");

const allUnknown = build({ id: "usage-binding-unknown", traceEvidence: [] });
assert.deepEqual(allUnknown.provenUsedSourceRefs, []);
assert.ok(allUnknown.sourceUsage.every((item) => item.status === "unknown_not_proven"));

const notReceivedWriter = writerEvidenceFor(writerContext(), [plannedSourceRefs[0]]);
const notReceived = build({ id: "usage-binding-not-received", writer: notReceivedWriter, traceEvidence: [] });
assert.deepEqual(notReceived.sourceUsage.map((item) => item.status), ["unknown_not_proven", "unused", "unused"]);
assert.ok(notReceived.sourceUsage.slice(1).every((item) => item.evidenceRefs[0].hash === notReceivedWriter.evidenceRef.hash));
const nonReceivedUnknown = structuredClone(notReceived);
nonReceivedUnknown.sourceUsage[1] = { sourceRef: nonReceivedUnknown.sourceUsage[1].sourceRef, status: "unknown_not_proven", reason: "not proven", evidenceRefs: [] };
delete nonReceivedUnknown.bindingHash;
nonReceivedUnknown.bindingHash = hashUnifiedContent(nonReceivedUnknown);
assert.throws(() => validateContentMechanismUsageBinding(nonReceivedUnknown), (error) => error.code === "ContentMechanismUsageBinding:UNKNOWN_EVIDENCE_FORBIDDEN");

assert.throws(() => build({ decisionRef: { ...decisionRef, hash: "0".repeat(64) } }), (error) => error.code === "ContentMechanismUsageBinding:DECISION_REF_MISMATCH");
assert.throws(() => build({ sourcePlanRef: { ...sourcePlanRef, hash: "0".repeat(64) } }), (error) => error.code === "ContentMechanismUsageBinding:SOURCE_PLAN_REF_MISMATCH");
const defaultWriter = writerEvidenceFor(writerContext());
assert.throws(
  () => build({ writer: defaultWriter, traceEvidence: [trace(defaultWriter.evidenceRef, "trace-unplanned", [ref("unplanned", "9")], [])] }),
  (error) => error.code === "ContentMechanismUsageBinding:TRACE_SOURCE_NOT_PLANNED"
);
const partialWriter = writerEvidenceFor(writerContext(), [plannedSourceRefs[1], plannedSourceRefs[2]]);
assert.throws(
  () => build({ writer: partialWriter, traceEvidence: [trace(partialWriter.evidenceRef, "trace-not-received", [plannedSourceRefs[0]], [])] }),
  (error) => error.code === "ContentMechanismUsageBinding:PROVEN_USED_NOT_RECEIVED"
);
const conflictingWriter = writerEvidenceFor(writerContext());
assert.throws(
  () => build({ writer: conflictingWriter, traceEvidence: [trace(conflictingWriter.evidenceRef, "trace-conflict", [plannedSourceRefs[0]], [plannedSourceRefs[0]])] }),
  (error) => error.code === "ContentMechanismUsageBinding:TRACE_STATUS_CONFLICT"
);
const providerSelfReport = { contract: "ProviderSelfReportedUsage@1.0", id: "provider-claim", writerEvidenceRef: defaultWriter.evidenceRef, usedSourceRefs: plannedSourceRefs, unusedSourceRefs: [] };
assert.throws(
  () => build({ writer: defaultWriter, traceEvidence: [{ evidence: providerSelfReport, ref: { id: providerSelfReport.id, hash: hashUnifiedContent(providerSelfReport) } }] }),
  (error) => error.code === "ContentMechanismUsageBinding.traceEvidence[].evidence:REF_HASH_MISMATCH",
  "Provider self-report must not substitute for deterministic trace evidence"
);

const unusedWithoutEvidence = structuredClone(binding);
unusedWithoutEvidence.sourceUsage[1].evidenceRefs = [];
delete unusedWithoutEvidence.bindingHash;
unusedWithoutEvidence.bindingHash = hashUnifiedContent(unusedWithoutEvidence);
assert.throws(() => validateContentMechanismUsageBinding(unusedWithoutEvidence), (error) => error.code === "ContentMechanismUsageBinding:UNUSED_EVIDENCE_REQUIRED");
const unknownMasqueradingUnused = structuredClone(allUnknown);
unknownMasqueradingUnused.sourceUsage[0].status = "unused";
unknownMasqueradingUnused.sourceUsage[0].reason = "guessed from body text";
delete unknownMasqueradingUnused.bindingHash;
unknownMasqueradingUnused.bindingHash = hashUnifiedContent(unknownMasqueradingUnused);
assert.throws(() => validateContentMechanismUsageBinding(unknownMasqueradingUnused), (error) => error.code === "ContentMechanismUsageBinding:UNUSED_EVIDENCE_REQUIRED");

const deviatedContext = writerContext("trend_bridge");
const deviatedWriter = writerEvidenceFor(deviatedContext);
const confirmationEvent = { contract: "ContentMechanismConfirmationEvent@1.0", id: "creative-confirmation-1", status: "confirmed", confirmedByType: "user", confirmedAt: "2026-08-06T03:11:00.000Z" };
const confirmationEventRef = { id: confirmationEvent.id, hash: hashUnifiedContent(confirmationEvent) };
const deviated = build({
  id: "usage-binding-deviated", writerContext: deviatedContext, writer: deviatedWriter,
  traceEvidence: [trace(deviatedWriter.evidenceRef, "trace-deviated", [plannedSourceRefs[0]], [])],
  creativeDeviationReason: "confirmed platform adaptation", confirmationEvent, confirmationEventRef
});
assert.deepEqual(deviated.creativeMechanism, {
  strategyRequested: "checklist", strategyRequestRef, writerContextValue: "trend_bridge", writerContextRef: deviatedWriter.contextRef,
  alignment: "deviated", reason: "confirmed platform adaptation", confirmationEventRef
});
assert.throws(
  () => build({ writerContext: deviatedContext, writer: deviatedWriter, traceEvidence: [], creativeDeviationReason: "confirmed", confirmationEvent, confirmationEventRef: { ...confirmationEventRef, hash: "0".repeat(64) } }),
  (error) => error.code === "ContentMechanismUsageBinding.confirmationEvent:REF_HASH_MISMATCH"
);
assert.throws(
  () => build({ writerContext: deviatedContext, writer: deviatedWriter, traceEvidence: [], creativeDeviationReason: null }),
  (error) => error.code === "ContentMechanismUsageBinding.creativeDeviationReason:TEXT"
);

for (const shape of ["missing", "extra", "null", "primitive"]) {
  let value;
  if (shape === "null") value = null;
  else if (shape === "primitive") value = 7;
  else { value = structuredClone(binding); if (shape === "missing") delete value.sourcePlanRef; else value.privateValue = "do-not-echo"; }
  assert.throws(
    () => validateContentMechanismUsageBinding(value),
    (error) => error instanceof TypeError === false && error.code.startsWith("ContentMechanismUsageBinding:") && !String(error.message).includes("do-not-echo")
  );
}

const explanation = createMechanismExplanation(binding);
validateMechanismExplanation(explanation);
assert.deepEqual(explanation.provenance, { kind: "derived_from_content_mechanism_usage_binding", readOnly: true, promotionEligible: false, nativeUsageBinding: false });
assert.equal(explanation.actualUse.evidenceBoundary, "deterministic_refs_only_no_natural_language_inference");
assert.deepEqual(explanation.planning.plannedSourceRefs, binding.plannedSourceRefs);
assert.deepEqual(explanation.actualUse.provenUsedSourceRefs, binding.provenUsedSourceRefs);
assert.ok(Object.isFrozen(explanation) && Object.isFrozen(explanation.actualUse) && Object.isFrozen(explanation.actualUse.sourceUsage));
assert.equal(createMechanismExplanation(binding).explanationHash, explanation.explanationHash);
assert.throws(() => validateContentMechanismUsageBinding(explanation), "explanation must not masquerade as native usage binding");
const explanationSetForgery = structuredClone(explanation);
explanationSetForgery.actualUse.provenUsedSourceRefs = [];
delete explanationSetForgery.explanationHash;
explanationSetForgery.explanationHash = hashUnifiedContent(explanationSetForgery);
assert.throws(() => validateMechanismExplanation(explanationSetForgery), (error) => error.code === "MechanismExplanation:USED_SET_MISMATCH");
const promotableForgery = structuredClone(explanation);
promotableForgery.provenance.promotionEligible = true;
delete promotableForgery.explanationHash;
promotableForgery.explanationHash = hashUnifiedContent(promotableForgery);
assert.throws(() => validateMechanismExplanation(promotableForgery), (error) => error.code === "MechanismExplanation:PROVENANCE");
const explanationAlignmentForgery = structuredClone(explanation);
explanationAlignmentForgery.creativeMechanism.alignment = "deviated";
explanationAlignmentForgery.creativeMechanism.reason = "forged";
explanationAlignmentForgery.creativeMechanism.confirmationEventRef = confirmationEventRef;
delete explanationAlignmentForgery.explanationHash;
explanationAlignmentForgery.explanationHash = hashUnifiedContent(explanationAlignmentForgery);
assert.throws(() => validateMechanismExplanation(explanationAlignmentForgery), (error) => error.code === "MechanismExplanation:CREATIVE_ALIGNMENT_INCONSISTENT");

console.log("content-mechanism-usage-binding-self-test: ok");
