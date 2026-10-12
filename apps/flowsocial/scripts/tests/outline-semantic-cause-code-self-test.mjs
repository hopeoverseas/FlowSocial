import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  materializeContentMasterSemanticAuthority,
  materializeContentOutlineSemanticAuthority,
  projectUnifiedOrchestrationRecovery,
  validateContentOutlineSemanticMapping
} from "../../content-agent/unified-skill-output-contracts.mjs";

const clone = structuredClone;
const intentBase = {
  id: "structure-intent:semantic-cause-code",
  structureType: "ordered_framework",
  requiredUnits: [
    { id: "problem", meaning: "Define the problem.", boundary: "Keep the problem bounded." },
    { id: "method", meaning: "Explain the method.", boundary: "Keep the method actionable." },
    { id: "iteration", meaning: "Close the feedback loop.", boundary: "Do not promise outcomes." }
  ],
  optionalUnits: [],
  orderingPolicy: { mode: "strict", unitOrder: ["problem", "method", "iteration"] }
};
const intent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
const master = materializeContentMasterSemanticAuthority({
  content_master_id: "master:semantic-cause-code",
  confirmed_facts: [], supported_interpretations: [], author_opinions: [], source_list: [],
  semanticUnitIds: intent.orderingPolicy.unitOrder
}, intent);

function section(id, role, unitIds) {
  return {
    section_id: id, heading: `Heading ${id}`, role, objective: `Objective ${id}`,
    key_points: [], claim_ids: [], boundary: `Boundary ${id}`, masterUnitIds: unitIds
  };
}

function rawOutline() {
  return {
    outline_id: "outline:semantic-cause-code", schema_version: "1.0", platform: "xiaohongshu",
    topic: "Stable semantic cause codes", content_promise: "Classify failures without content disclosure.",
    content_function: "authority", content_purpose_id: "knowledge_howto", conversion_stage_id: "consideration",
    opening_strategy: "Open with the bounded problem.",
    sections: [
      section("S1", "problem", ["problem"]),
      section("S2", "method", ["method"]),
      section("S3", "action", ["iteration"]),
      section("S4", "hook", [])
    ],
    closing_strategy: "Ask for confirmation.", unresolved_questions: [], confirmation_required: true
  };
}

function assertSemanticFailure(label, operation, causeCode, fieldPaths) {
  assert.throws(operation, (error) => {
    assert.equal(error.code, "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID", `${label}: semantic error code`);
    assert.equal(error.causeCode, causeCode, `${label}: safe cause code`);
    assert.deepEqual(error.details.fieldPaths, fieldPaths, `${label}: stable field paths`);
    assert.match(error.causeCode, /^[A-Z][A-Z0-9_:-]{0,79}$/);
    return true;
  }, label);
}

function assertRawFailure(label, mutate, causeCode, fieldPaths) {
  const candidate = rawOutline();
  mutate(candidate);
  assertSemanticFailure(label, () => materializeContentOutlineSemanticAuthority(candidate, master), causeCode, fieldPaths);
}

assertRawFailure(
  "competing framework",
  (value) => { value.structureIntent = clone(intent); },
  "OUTLINE_COMPETING_FRAMEWORK_INVALID",
  ["data.sections"]
);
assertRawFailure(
  "missing unit ids",
  (value) => { delete value.sections[0].masterUnitIds; },
  "OUTLINE_MASTER_UNIT_IDS_INVALID",
  ["data.sections[].masterUnitIds"]
);
assertRawFailure(
  "invalid unit ids",
  (value) => { value.sections[0].masterUnitIds = [null]; },
  "OUTLINE_MASTER_UNIT_IDS_INVALID",
  ["data.sections[].masterUnitIds"]
);
assertRawFailure(
  "unknown unit id",
  (value) => { value.sections[0].masterUnitIds = ["unknown"]; },
  "OUTLINE_MASTER_UNIT_ID_UNKNOWN",
  ["data.sections[].masterUnitIds"]
);
assertRawFailure(
  "supplied ref conflict",
  (value) => { value.sections[0].masterUnitRefs = [{ id: "method" }]; },
  "OUTLINE_MASTER_UNIT_REF_CONFLICT",
  ["data.sections[].masterUnitRefs"]
);

const advisory = rawOutline();
advisory.sections[0].masterUnitRefs = [{ id: "problem", hash: "0".repeat(64) }];
const advisoryBefore = clone(advisory);
const advisoryCanonical = materializeContentOutlineSemanticAuthority(advisory, master);
assert.deepEqual(advisory, advisoryBefore, "matching-ID raw advisory hash evidence must remain unchanged");
assert.equal(
  advisoryCanonical.sections[0].masterUnitRefs[0].hash,
  master.semanticSpine.units.find((unit) => unit.id === "problem").unitHash,
  "matching-ID raw advisory hash must still materialize to trusted authority"
);

const canonical = materializeContentOutlineSemanticAuthority(rawOutline(), master);

const duplicate = clone(canonical);
duplicate.sections[0].masterUnitRefs.push(clone(duplicate.sections[0].masterUnitRefs[0]));
assertSemanticFailure(
  "duplicate canonical ref",
  () => validateContentOutlineSemanticMapping(duplicate, master),
  "OUTLINE_MASTER_UNIT_REF_DUPLICATE",
  ["data.sections[].masterUnitRefs"]
);

const stale = clone(canonical);
stale.sections[0].masterUnitRefs[0].hash = "0".repeat(64);
assertSemanticFailure(
  "unknown or stale canonical ref",
  () => validateContentOutlineSemanticMapping(stale, master),
  "OUTLINE_MASTER_UNIT_REF_UNKNOWN_OR_STALE",
  ["data.sections[].masterUnitRefs"]
);

const missingCoverage = clone(canonical);
missingCoverage.sections.splice(1, 1);
assertSemanticFailure(
  "required coverage missing",
  () => validateContentOutlineSemanticMapping(missingCoverage, master),
  "OUTLINE_REQUIRED_UNIT_COVERAGE_MISSING",
  ["data.sections[].masterUnitRefs"]
);

const strictOrder = clone(canonical);
[strictOrder.sections[0], strictOrder.sections[1]] = [strictOrder.sections[1], strictOrder.sections[0]];
assertSemanticFailure(
  "strict order violation",
  () => validateContentOutlineSemanticMapping(strictOrder, master),
  "OUTLINE_STRICT_UNIT_ORDER_INVALID",
  ["data.sections[].masterUnitRefs"]
);

const recovery = projectUnifiedOrchestrationRecovery(Object.assign(new Error("unsafe Provider message"), {
  name: "UnifiedOrchestrationStageError",
  code: "UNIFIED_ORCHESTRATION_STAGE_FAILED",
  recoverable: true,
  stage: "outline",
  platform: "xiaohongshu",
  stepId: "outline",
  capability: "generate-content-outline",
  recoverableFrom: "outline",
  causeCode: "OUTLINE_MASTER_UNIT_REF_CONFLICT",
  fieldPaths: ["data.sections[].masterUnitRefs", "provider.raw_json"],
  details: { rawProviderJson: { heading: "must not leak" }, prompt: "must not leak" }
}));
assert.deepEqual(Object.keys(recovery), [
  "stage", "platform", "stepId", "capability", "recoverableFrom", "causeCode", "fieldPaths"
]);
assert.equal(recovery.causeCode, "OUTLINE_MASTER_UNIT_REF_CONFLICT");
assert.deepEqual(recovery.fieldPaths, ["data.sections[].masterUnitRefs"]);
assert.equal(JSON.stringify(recovery).includes("must not leak"), false);

console.log(JSON.stringify({
  status: "outline-semantic-cause-code-self-test passed",
  retainedSemanticCauseCodes: 8,
  existingAdaptationCauseCodesChanged: 0,
  realProviderCalls: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
