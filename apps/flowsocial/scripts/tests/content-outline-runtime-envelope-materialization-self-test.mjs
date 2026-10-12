import assert from "node:assert/strict";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  createContentOutlineStrictSequenceContract,
  materializeContentMasterSemanticAuthority,
  materializeUnifiedSkillRuntimeOutput,
  validateUnifiedSkillDomainOutput
} from "../../content-agent/unified-skill-output-contracts.mjs";
import { adaptCanonicalSkillEnvelope, contractExample, validateContractSchema } from "../../llm/contracts.mjs";
import { parseStructuredContentResult } from "../../llm/provider-adapters.mjs";

const clone = structuredClone;

function masterFixture() {
  const ids = ["foundation", "method", "boundary"];
  const requiredUnits = ids.map((id) => ({ id, meaning: `Meaning ${id}`, boundary: `Boundary ${id}` }));
  const intentBase = {
    id: "intent:runtime-envelope",
    structureType: "ordered_framework",
    requiredUnits,
    optionalUnits: [],
    orderingPolicy: { mode: "strict", unitOrder: clone(ids) }
  };
  const structureIntent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
  return materializeContentMasterSemanticAuthority({
    content_master_id: "master:runtime-envelope",
    confirmed_facts: [],
    supported_interpretations: [],
    author_opinions: [],
    source_list: [],
    semanticUnitIds: clone(ids)
  }, structureIntent);
}

function section(slot, role) {
  return {
    section_id: `S${slot.order + 1}`,
    heading: `Heading ${slot.order + 1}`,
    role,
    objective: `Objective ${slot.order + 1}`,
    key_points: [],
    claim_ids: [],
    boundary: `Boundary ${slot.order + 1}`,
    sequencePlacement: { kind: "core", slotIds: [slot.slotId] }
  };
}

function assertEnvelopeFailure(label, candidate, expectedPaths) {
  assert.throws(
    () => validateUnifiedSkillDomainOutput({
      capability: "generate-content-outline",
      platform: "xiaohongshu",
      outputContract: "ContentOutline@1.0",
      runtimeOutput: candidate
    }),
    (error) => {
      assert.equal(error.code, "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID", label);
      assert.deepEqual(error.details.fieldPaths, expectedPaths, label);
      return true;
    }
  );
}

const master = masterFixture();
const strictSequenceContract = createContentOutlineStrictSequenceContract(master);
const bareOutline = {
  outline_id: "outline:runtime-envelope",
  schema_version: "1.0",
  platform: "xiaohongshu",
  topic: "Runtime envelope authority",
  content_promise: "Preserve raw evidence while materializing a canonical envelope.",
  content_function: "authority",
  content_purpose_id: "knowledge_howto",
  conversion_stage_id: "consideration",
  opening_strategy: "Start with the frozen foundation.",
  sections: [
    section(strictSequenceContract.slots[0], "method"),
    { ...section(strictSequenceContract.slots[0], "evidence"), section_id: "S2", heading: "Supplemental 1", objective: "Objective supplemental 1", key_points: ["Point supplemental 1"], sequencePlacement: { kind: "supplemental", anchorId: "supplemental-anchor:1" } },
    { ...section(strictSequenceContract.slots[1], "method"), section_id: "S3" },
    { ...section(strictSequenceContract.slots[1], "evidence"), section_id: "S4", heading: "Supplemental 2", objective: "Objective supplemental 2", key_points: ["Point supplemental 2"], sequencePlacement: { kind: "supplemental", anchorId: "supplemental-anchor:2" } },
    { ...section(strictSequenceContract.slots[2], "action"), section_id: "S5" },
    { ...section(strictSequenceContract.slots[2], "evidence"), section_id: "S6", heading: "Supplemental 3", objective: "Objective supplemental 3", key_points: ["Point supplemental 3"], sequencePlacement: { kind: "supplemental", anchorId: "supplemental-anchor:3" } }
  ],
  closing_strategy: "Request confirmation.",
  unresolved_questions: [],
  confirmation_required: true
};

const example = contractExample("ContentOutline@1.0");
assert.deepEqual(Object.keys(example), ["status", "data", "warnings", "blocked_reasons"]);
assert.equal(example.status, "ready");
assert.equal(example.data.schema_version, "1.0");
assert.ok(Array.isArray(example.data.sections));
assert.equal(example.data.confirmation_required, true);
assert.deepEqual(example.warnings, []);
assert.deepEqual(example.blocked_reasons, []);

const parserResult = parseStructuredContentResult(JSON.stringify(bareOutline));
assert.equal(parserResult.parseMode, "direct");
assert.deepEqual(parserResult.data, bareOutline, "Provider parser must preserve a bare root as raw output");

const duplicateMappingOutline = clone(bareOutline);
duplicateMappingOutline.sections.forEach((item) => { item.masterUnitIds = ["provider-explanation"]; });
const adaptedDuplicateMapping = adaptCanonicalSkillEnvelope("ContentOutline@1.0", duplicateMappingOutline);
assert.equal(validateContractSchema("ContentOutline@1.0", adaptedDuplicateMapping.value).valid, true);
assert.equal(adaptedDuplicateMapping.value.data.sections.every((item) => !Object.hasOwn(item, "masterUnitIds")), true);

const rawBytes = JSON.stringify(bareOutline);
const rawHash = hashUnifiedContent(bareOutline);
const canonicalEnvelope = materializeUnifiedSkillRuntimeOutput({
  capability: "generate-content-outline",
  runtimeOutput: bareOutline,
  sourceSkillInput: { strict_sequence_contract: strictSequenceContract },
  sourceContentMaster: master
});
assert.equal(JSON.stringify(bareOutline), rawBytes, "materialization must not mutate raw Provider evidence");
assert.equal(hashUnifiedContent(bareOutline), rawHash, "materialization must not change the raw output hash");
assert.equal(canonicalEnvelope.status, "ready");
assert.deepEqual(canonicalEnvelope.warnings, []);
assert.deepEqual(canonicalEnvelope.blocked_reasons, []);
assert.deepEqual(canonicalEnvelope.data.sections.filter((item) => item.masterUnitRefs.length).map((item) => item.masterUnitRefs[0].id), ["foundation", "method", "boundary"]);
assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "generate-content-outline",
  platform: "xiaohongshu",
  outputContract: "ContentOutline@1.0",
  runtimeOutput: canonicalEnvelope,
  sourceSkillInput: { strict_sequence_contract: strictSequenceContract },
  sourceContentMaster: master
}));

const completeEnvelope = { status: "ready", data: clone(bareOutline), warnings: ["existing warning"], blocked_reasons: [] };
assert.deepEqual(
  materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: completeEnvelope }),
  completeEnvelope,
  "complete envelopes must not be wrapped or have metadata replaced"
);
for (const status of ["needs_review", "blocked"]) {
  const statusEnvelope = { status, data: clone(bareOutline), warnings: ["existing warning"], blocked_reasons: ["existing reason"] };
  assert.deepEqual(
    materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: statusEnvelope }),
    statusEnvelope,
    `${status} metadata must not be invented or repaired`
  );
}

const empty = {};
assert.deepEqual(materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: empty }), empty);
assertEnvelopeFailure("empty root", empty, ["status", "data", "warnings", "blocked_reasons"]);

const partial = { status: "ready", ...clone(bareOutline) };
assert.deepEqual(materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: partial }), partial);
assertEnvelopeFailure("partial envelope", partial, ["data", "warnings", "blocked_reasons"]);

const malformed = { status: "ready", data: clone(bareOutline), warnings: "not-an-array", blocked_reasons: [] };
assert.deepEqual(materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: malformed }), malformed);
assertEnvelopeFailure("malformed envelope", malformed, ["warnings"]);

const foreignWrapper = { result: clone(bareOutline) };
assert.deepEqual(materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: foreignWrapper }), foreignWrapper);
assertEnvelopeFailure("foreign wrapper", foreignWrapper, ["status", "data", "warnings", "blocked_reasons"]);

const ambiguous = { ...clone(bareOutline), response: null };
assert.deepEqual(materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: ambiguous }), ambiguous);
assertEnvelopeFailure("ambiguous root", ambiguous, ["status", "data", "warnings", "blocked_reasons"]);

const malformedMarkers = { ...clone(bareOutline), sections: "not-an-array" };
assert.deepEqual(materializeUnifiedSkillRuntimeOutput({ capability: "generate-content-outline", runtimeOutput: malformedMarkers }), malformedMarkers);
assertEnvelopeFailure("malformed markers", malformedMarkers, ["status", "data", "warnings", "blocked_reasons"]);

assert.deepEqual(
  materializeUnifiedSkillRuntimeOutput({ capability: "generate-platform-titles", runtimeOutput: bareOutline }),
  bareOutline,
  "non-outline capabilities must never normalize a bare outline root"
);

let committed = null;
const evidenceCompiler = {
  resolveUniqueOutputFact() {
    return { verifiedDomainOutput: { contentMaster: clone(master) } };
  },
  compileExecutionEvidence(result) {
    return { outputHash: hashUnifiedContent(result.data) };
  },
  commitCompletedInvocation(value) {
    committed = clone(value);
  }
};
const executor = createUnifiedSkillActivityExecutor({
  generateText: null,
  evidenceCompiler,
  runner: async () => ({ data: clone(bareOutline) })
});
const verifiedOutline = await executor({
  capability: "generate-content-outline",
  platform: "xiaohongshu",
  input: { strict_sequence_contract: clone(strictSequenceContract) },
  step: { id: "outline-step", kind: "skill", capability: "generate-content-outline", outputContract: "ContentOutline@1.0" },
  executionPlan: { id: "plan:runtime-envelope" }
});
assert.deepEqual(committed.runtimeOutput, bareOutline, "Execution Fact must retain the raw bare Provider root");
assert.equal(committed.evidence.outputHash, rawHash, "Execution Evidence must hash the raw bare Provider root");
assert.deepEqual(committed.verifiedDomainOutput, verifiedOutline);
assert.deepEqual(verifiedOutline.sections.filter((item) => item.masterUnitRefs.length).map((item) => item.masterUnitRefs[0].id), ["foundation", "method", "boundary"]);
assert.equal(JSON.stringify(bareOutline), rawBytes, "production execution must leave raw Provider bytes unchanged");

console.log(JSON.stringify({
  status: "content-outline-runtime-envelope-materialization-self-test passed",
  normalizedCapabilities: ["generate-content-outline"],
  preservedCases: ["complete", "needs_review", "blocked"],
  rejectedCases: ["empty", "partial", "malformed", "foreign-wrapper", "ambiguous", "malformed-markers", "non-outline"],
  realProviderCalls: 0,
  retries: 0,
  networkCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
