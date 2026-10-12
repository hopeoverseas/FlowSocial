import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  materializeContentMasterSemanticAuthority,
  materializeUnifiedSkillRuntimeOutput,
  projectUnifiedOrchestrationRecovery,
  validateContentMasterSemanticSpine,
  validateUnifiedSkillDomainOutput
} from "../../content-agent/unified-skill-output-contracts.mjs";

const clone = structuredClone;

function intentFixture() {
  const base = {
    id: "structure-intent:master-authority",
    structureType: "ordered_framework",
    requiredUnits: [
      { id: "problem", meaning: "Define the bounded problem.", boundary: "Do not invent causes." },
      { id: "method", meaning: "Explain the accountable method.", boundary: "Do not promise results." }
    ],
    optionalUnits: [
      { id: "iteration", meaning: "Close the feedback loop.", boundary: "Do not omit evaluation." }
    ],
    orderingPolicy: { mode: "strict", unitOrder: ["problem", "method", "iteration"] }
  };
  return { ...base, intentHash: hashUnifiedContent(base) };
}

function rawMaster() {
  return {
    content_master_id: "master:authority",
    confirmed_facts: [{ fact_id: "F1", fact: "Verified fact.", source_ids: ["source:1"] }],
    supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "source:1" }],
    semanticUnitIds: ["problem", "method", "iteration"]
  };
}

const intent = intentFixture();
const cleanRaw = rawMaster();
const cleanCanonical = materializeContentMasterSemanticAuthority(cleanRaw, intent);

const advisoryRaw = rawMaster();
advisoryRaw.structureIntent = { provider: "non-authoritative", intentHash: "0".repeat(64) };
advisoryRaw.semanticSpine = {
  id: "provider-spine", orderingPolicy: { mode: "flexible", unitOrder: ["invented"] },
  units: [{ id: "invented", meaning: "Provider echo", order: 99, boundary: "Provider echo", unitHash: "0".repeat(64) }],
  spineHash: "0".repeat(64)
};
advisoryRaw.contentMasterHash = "0".repeat(64);
const advisoryBefore = clone(advisoryRaw);
const advisoryEnvelopeHash = hashUnifiedContent({ status: "success", data: advisoryRaw, warnings: [], blocked_reasons: [] });
const advisoryCanonical = materializeContentMasterSemanticAuthority(advisoryRaw, intent);
assert.deepEqual(advisoryRaw, advisoryBefore, "raw authority echoes must remain byte-equivalent evidence");
assert.equal(
  hashUnifiedContent({ status: "success", data: advisoryRaw, warnings: [], blocked_reasons: [] }),
  advisoryEnvelopeHash,
  "raw authority echoes must remain hash-bound"
);
assert.deepEqual(advisoryCanonical, cleanCanonical, "authority echoes must neither block nor override trusted canonical construction");
assert.deepEqual(advisoryCanonical.structureIntent, intent);
assert.equal(advisoryCanonical.semanticSpine.units[0].meaning, intent.requiredUnits[0].meaning);
assert.notEqual(advisoryCanonical.contentMasterHash, advisoryRaw.contentMasterHash);
assert.equal(Object.hasOwn(advisoryCanonical, "semanticUnitIds"), false);
assert.equal(advisoryCanonical.confirmed_facts[0].fact, "Verified fact.", "validated business content must be preserved");

function assertSemanticFailure(label, operation, causeCode, fieldPaths) {
  assert.throws(operation, (error) => {
    assert.equal(error.code, "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID", `${label}: semantic error code`);
    assert.equal(error.causeCode, causeCode, `${label}: fixed safe cause code`);
    assert.deepEqual(error.details.fieldPaths, fieldPaths, `${label}: stable field path`);
    assert.match(error.causeCode, /^[A-Z][A-Z0-9_:-]{0,79}$/);
    return true;
  }, label);
}

function assertRawIdsFailure(label, ids, causeCode) {
  const candidate = rawMaster();
  if (ids === undefined) delete candidate.semanticUnitIds;
  else candidate.semanticUnitIds = ids;
  assertSemanticFailure(label, () => materializeContentMasterSemanticAuthority(candidate, intent), causeCode, ["data.semanticUnitIds"]);
}

assertRawIdsFailure("missing declaration", undefined, "CONTENT_MASTER_SEMANTIC_UNIT_IDS_REQUIRED");
assertRawIdsFailure("malformed declaration", "problem", "CONTENT_MASTER_SEMANTIC_UNIT_IDS_INVALID");
assertRawIdsFailure("invalid declaration item", ["problem", null, "iteration"], "CONTENT_MASTER_SEMANTIC_UNIT_IDS_INVALID");
assertRawIdsFailure("duplicate declaration", ["problem", "problem", "iteration"], "CONTENT_MASTER_SEMANTIC_UNIT_IDS_DUPLICATE");
assertRawIdsFailure("unknown declaration", ["problem", "invented", "iteration"], "CONTENT_MASTER_SEMANTIC_UNIT_ID_UNKNOWN");
assertRawIdsFailure("missing frozen id", ["problem", "method"], "CONTENT_MASTER_SEMANTIC_UNIT_ID_MISSING");
assertRawIdsFailure("reordered declaration", ["method", "problem", "iteration"], "CONTENT_MASTER_SEMANTIC_UNIT_ORDER_INVALID");

const invalidIdRaw = rawMaster();
invalidIdRaw.content_master_id = "";
assertSemanticFailure("invalid master id", () => materializeContentMasterSemanticAuthority(invalidIdRaw, intent), "CONTENT_MASTER_ID_INVALID", ["data.content_master_id"]);

function assertIntentFailure(label, mutate, causeCode, fieldPaths) {
  const candidate = intentFixture();
  mutate(candidate);
  assertSemanticFailure(label, () => materializeContentMasterSemanticAuthority(rawMaster(), candidate), causeCode, fieldPaths);
}

assertIntentFailure("incomplete intent", (value) => { delete value.structureType; }, "CONTENT_MASTER_STRUCTURE_INTENT_INVALID", ["data.structureIntent"]);
assertIntentFailure("invalid ordering", (value) => { value.orderingPolicy.unitOrder = ["problem", "problem", "iteration"]; }, "CONTENT_MASTER_ORDERING_POLICY_INVALID", ["data.structureIntent.orderingPolicy"]);
assertIntentFailure("invalid required unit", (value) => { value.requiredUnits[0].meaning = ""; }, "CONTENT_MASTER_REQUIRED_UNIT_INVALID", ["data.structureIntent.requiredUnits"]);
assertIntentFailure("invalid optional unit", (value) => { value.optionalUnits[0].boundary = ""; }, "CONTENT_MASTER_OPTIONAL_UNIT_INVALID", ["data.structureIntent.optionalUnits"]);
assertIntentFailure("stale intent hash", (value) => { value.intentHash = "0".repeat(64); }, "CONTENT_MASTER_INTENT_HASH_STALE", ["data.structureIntent.intentHash"]);

const otherIntentBase = {
  ...clone(intent),
  id: "structure-intent:other"
};
delete otherIntentBase.intentHash;
const otherIntent = { ...otherIntentBase, intentHash: hashUnifiedContent(otherIntentBase) };
const intentMismatch = clone(cleanCanonical);
intentMismatch.structureIntent = otherIntent;
assertSemanticFailure(
  "canonical intent authority mismatch",
  () => validateContentMasterSemanticSpine(intentMismatch, intent),
  "CONTENT_MASTER_STRUCTURE_INTENT_AUTHORITY_MISMATCH",
  ["data.structureIntent"]
);

const closureInvalid = clone(cleanCanonical);
delete closureInvalid.semanticSpine.structureIntentRef;
assertSemanticFailure(
  "canonical spine closure",
  () => validateContentMasterSemanticSpine(closureInvalid, intent),
  "CONTENT_MASTER_SEMANTIC_SPINE_CLOSURE_INVALID",
  ["data.semanticSpine"]
);

const unitInvalid = clone(cleanCanonical);
unitInvalid.semanticSpine.units[0].meaning = "tampered";
assertSemanticFailure(
  "canonical unit authority",
  () => validateContentMasterSemanticSpine(unitInvalid, intent),
  "CONTENT_MASTER_SEMANTIC_SPINE_UNIT_INVALID",
  ["data.semanticSpine.units"]
);

const spineHashStale = clone(cleanCanonical);
spineHashStale.semanticSpine.spineHash = "0".repeat(64);
assertSemanticFailure(
  "canonical spine hash",
  () => validateContentMasterSemanticSpine(spineHashStale, intent),
  "CONTENT_MASTER_SEMANTIC_SPINE_HASH_STALE",
  ["data.semanticSpine.spineHash"]
);

const masterHashStale = clone(cleanCanonical);
masterHashStale.contentMasterHash = "0".repeat(64);
assertSemanticFailure(
  "canonical master hash",
  () => validateContentMasterSemanticSpine(masterHashStale, intent),
  "CONTENT_MASTER_HASH_STALE",
  ["data.contentMasterHash"]
);

assert.deepEqual(materializeContentMasterSemanticAuthority(cleanCanonical, intent), cleanCanonical, "exact canonical replay remains compatible");
assertSemanticFailure(
  "serialized canonical is not trusted runtime replay",
  () => materializeContentMasterSemanticAuthority(clone(cleanCanonical), intent),
  "CONTENT_MASTER_SEMANTIC_UNIT_IDS_REQUIRED",
  ["data.semanticUnitIds"]
);
const firstRuntimeMaterialization = materializeUnifiedSkillRuntimeOutput({
  capability: "build-content-master",
  runtimeOutput: { status: "success", data: rawMaster(), warnings: [], blocked_reasons: [] },
  sourceSkillInput: { structureIntent: intent }
});
const secondRuntimeMaterialization = materializeUnifiedSkillRuntimeOutput({
  capability: "build-content-master",
  runtimeOutput: firstRuntimeMaterialization,
  sourceSkillInput: { structureIntent: intent }
});
assert.deepEqual(secondRuntimeMaterialization, firstRuntimeMaterialization, "runtime-produced envelope remains idempotent across production double materialization");
assertSemanticFailure(
  "serialized runtime envelope is not trusted replay",
  () => materializeUnifiedSkillRuntimeOutput({
    capability: "build-content-master",
    runtimeOutput: clone(firstRuntimeMaterialization),
    sourceSkillInput: { structureIntent: intent }
  }),
  "CONTENT_MASTER_SEMANTIC_UNIT_IDS_REQUIRED",
  ["data.semanticUnitIds"]
);

const invalidBusiness = rawMaster();
invalidBusiness.confirmed_facts[0].source_ids = [];
assert.throws(
  () => validateUnifiedSkillDomainOutput({
    capability: "build-content-master", platform: "xiaohongshu", outputContract: "ContentMaster@2.0",
    runtimeOutput: { status: "success", data: invalidBusiness, warnings: [], blocked_reasons: [] },
    sourceSkillInput: { structureIntent: intent }
  }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details.fieldPaths.includes("data.confirmed_facts[].fact_id"),
  "business fact/source validation must remain fail closed"
);

const legacyRaw = rawMaster();
delete legacyRaw.semanticUnitIds;
assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "build-content-master", platform: "xiaohongshu", outputContract: "ContentMaster@2.0",
  runtimeOutput: { status: "success", data: legacyRaw, warnings: [], blocked_reasons: [] }, sourceSkillInput: {}
}), "historical no-structure-intent output remains compatible");

const recovery = projectUnifiedOrchestrationRecovery(Object.assign(new Error("unsafe Provider message"), {
  name: "UnifiedOrchestrationStageError", code: "UNIFIED_ORCHESTRATION_STAGE_FAILED", recoverable: true,
  stage: "master", platform: null, stepId: "content_master", capability: "build-content-master",
  recoverableFrom: "content_master", causeCode: "CONTENT_MASTER_SEMANTIC_UNIT_ID_UNKNOWN",
  fieldPaths: ["data.semanticUnitIds", "provider.raw_json"], details: { rawProviderJson: "must not leak" }
}));
assert.equal(recovery.causeCode, "CONTENT_MASTER_SEMANTIC_UNIT_ID_UNKNOWN");
assert.deepEqual(recovery.fieldPaths, ["data.semanticUnitIds"]);
assert.equal(JSON.stringify(recovery).includes("must not leak"), false);

console.log(JSON.stringify({
  status: "content-master-semantic-authority-cause-code-self-test passed",
  retainedMasterSemanticCauseCodes: 17,
  rawAuthorityEchoesAdvisory: true,
  realProviderCalls: 0, retries: 0, externalApiCalls: 0, activeDatabaseWrites: 0,
  browserCalls: 0, platformWrites: 0, publicationWrites: 0, feedbackWrites: 0
}, null, 2));
