import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  materializeContentMasterSemanticAuthority,
  materializeContentOutlineSemanticAuthority,
  validateContentOutlineSemanticMapping,
  validateUnifiedSkillDomainOutput
} from "../../content-agent/unified-skill-output-contracts.mjs";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";

const clone = structuredClone;
const intentBase = {
  id: "structure-intent:adaptation-fixture",
  structureType: "ordered_framework",
  requiredUnits: [
    { id: "problem", meaning: "Define the problem.", boundary: "Keep causes bounded." },
    { id: "method", meaning: "Explain the method.", boundary: "Keep steps actionable." },
    { id: "iteration", meaning: "Close the feedback loop.", boundary: "Do not promise outcomes." }
  ],
  optionalUnits: [],
  orderingPolicy: { mode: "strict", unitOrder: ["problem", "method", "iteration"] }
};
const intent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
const master = materializeContentMasterSemanticAuthority({
  content_master_id: "master:adaptation-fixture",
  confirmed_facts: [], supported_interpretations: [], author_opinions: [], source_list: [],
  semanticUnitIds: intent.orderingPolicy.unitOrder
}, intent);

function section(id, role, unitIds, adaptationType) {
  const value = {
    section_id: id,
    heading: `Heading ${id}`,
    role,
    objective: `Objective ${id}`,
    key_points: [],
    claim_ids: [],
    boundary: `Boundary ${id}`,
    masterUnitIds: unitIds
  };
  if (adaptationType !== undefined) value.adaptationType = adaptationType;
  return value;
}

function rawOutline() {
  return {
    outline_id: "outline:adaptation-fixture",
    schema_version: "1.0",
    platform: "xiaohongshu",
    topic: "Deterministic adaptation classification",
    content_promise: "Derive redundant labels without changing meaning.",
    content_function: "authority",
    content_purpose_id: "knowledge_howto",
    conversion_stage_id: "consideration",
    opening_strategy: "Open with the bounded problem.",
    sections: [
      section("S1", "problem", ["problem"], "merge"),
      section("S2", "evidence", ["problem"]),
      section("S3", "method", ["method", "iteration"], "direct"),
      section("S4", "hook", [], "split")
    ],
    closing_strategy: "Ask for confirmation.",
    unresolved_questions: [],
    confirmation_required: true
  };
}

const raw = rawOutline();
const rawBefore = clone(raw);
const canonical = materializeContentOutlineSemanticAuthority(raw, master);
assert.deepEqual(raw, rawBefore, "materialization must not mutate raw Provider output");
assert.deepEqual(canonical.sections.map((item) => item.adaptationType), ["split", "split", "merge", "supplemental"]);
assert.deepEqual(
  canonical.sections.map(({ section_id, heading, role, objective, boundary }) => ({ section_id, heading, role, objective, boundary })),
  raw.sections.map(({ section_id, heading, role, objective, boundary }) => ({ section_id, heading, role, objective, boundary })),
  "classification must not repair section content or role"
);
assert.deepEqual(materializeContentOutlineSemanticAuthority(canonical, master), canonical, "canonical classification must be idempotent");

function assertStablePath(label, mutate, fieldPath, causeCode = null) {
  const candidate = rawOutline();
  mutate(candidate);
  assert.throws(
    () => materializeContentOutlineSemanticAuthority(candidate, master),
    (error) => {
      assert.equal(error.code, "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID");
      assert.deepEqual(error.details.fieldPaths, [fieldPath]);
      if (causeCode) assert.equal(error.causeCode, causeCode);
      return true;
    },
    label
  );
}

const globallyValidRoles = ["hook", "problem", "diagnosis", "evidence", "method", "example", "action", "boundary"];
for (const role of globallyValidRoles) {
  const roleRaw = rawOutline();
  roleRaw.sections[3].role = role;
  const roleRawBefore = clone(roleRaw);
  const roleCanonical = materializeContentOutlineSemanticAuthority(roleRaw, master);
  assert.deepEqual(roleRaw, roleRawBefore, `supplemental ${role} raw evidence must remain unchanged`);
  assert.equal(roleCanonical.sections[3].role, role, `runtime must not rewrite supplemental ${role}`);
  assert.equal(roleCanonical.sections[3].adaptationType, "supplemental");
  assert.deepEqual(roleCanonical.sections[3].masterUnitRefs, []);
  assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
    capability: "generate-content-outline",
    platform: "xiaohongshu",
    outputContract: "ContentOutline@1.0",
    runtimeOutput: { status: "ready", data: roleCanonical, warnings: [], blocked_reasons: [] },
    sourceContentMaster: master
  }), `globally valid ${role} presentation role must remain valid for a zero-ref supplemental section`);
}

for (const role of ["risk", "cta", "invented"]) {
  const roleRaw = rawOutline();
  roleRaw.sections[3].role = role;
  const roleCanonical = materializeContentOutlineSemanticAuthority(roleRaw, master);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({
      capability: "generate-content-outline",
      platform: "xiaohongshu",
      outputContract: "ContentOutline@1.0",
      runtimeOutput: { status: "ready", data: roleCanonical, warnings: [], blocked_reasons: [] },
      sourceContentMaster: master
    }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
      && error.details.fieldPaths.includes("data.sections[].role"),
    `${role} must remain fail closed at the global role schema`
  );
}
assertStablePath("required coverage", (value) => { value.sections[2].masterUnitIds = ["method"]; }, "data.sections[].masterUnitRefs");
assertStablePath("unknown unit", (value) => { value.sections[2].masterUnitIds = ["method", "unknown"]; }, "data.sections[].masterUnitIds");
const advisoryHashRaw = rawOutline();
advisoryHashRaw.sections[0].masterUnitRefs = [{ id: "problem", hash: "0".repeat(64) }];
const advisoryHashCanonical = materializeContentOutlineSemanticAuthority(advisoryHashRaw, master);
assert.equal(advisoryHashRaw.sections[0].masterUnitRefs[0].hash, "0".repeat(64), "raw advisory evidence must remain unchanged");
assert.equal(
  advisoryHashCanonical.sections[0].masterUnitRefs[0].hash,
  master.semanticSpine.units.find((unit) => unit.id === "problem").unitHash,
  "matching-id advisory hash must materialize to the trusted canonical unit hash"
);
assertStablePath("strict order", (value) => {
  value.sections = [value.sections[2], value.sections[0], value.sections[1], value.sections[3]];
}, "data.sections[].masterUnitRefs");
assertStablePath("competing framework", (value) => { value.structureIntent = clone(intent); }, "data.sections");
const mixedRaw = rawOutline();
mixedRaw.sections[2].masterUnitIds = ["problem", "method", "iteration"];
const mixedCanonical = materializeContentOutlineSemanticAuthority(mixedRaw, master);
assert.deepEqual(
  mixedCanonical.sections.map((item) => item.adaptationType),
  ["split", "split", "merge", "supplemental"],
  "a multi-ref merge may coexist with repeated single-ref split sections"
);

function assertCanonicalAdaptationFailure(label, candidate, causeCode, fieldPaths = ["data.sections[].adaptationType"]) {
  assert.throws(
    () => validateContentOutlineSemanticMapping(candidate, master),
    (error) => {
      assert.equal(error.code, "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID");
      assert.equal(error.causeCode, causeCode);
      assert.deepEqual(error.details.fieldPaths, fieldPaths);
      return true;
    },
    label
  );
}

const supplementalWithCoreRef = clone(canonical);
supplementalWithCoreRef.sections[3].masterUnitRefs = [clone(canonical.sections[2].masterUnitRefs[0])];
assertCanonicalAdaptationFailure(
  "corrupted supplemental claims a core ref",
  supplementalWithCoreRef,
  "OUTLINE_ADAPTATION_SUPPLEMENTAL_INVALID"
);

const directPlusSplit = clone(canonical);
directPlusSplit.sections[0].adaptationType = "direct";
assertCanonicalAdaptationFailure(
  "corrupted repeated single-ref direct plus split",
  directPlusSplit,
  "OUTLINE_ADAPTATION_REPEATED_SINGLE_REF_INVALID"
);

const wrongCardinality = clone(canonical);
wrongCardinality.sections[2].adaptationType = "direct";
assertCanonicalAdaptationFailure(
  "corrupted canonical cardinality",
  wrongCardinality,
  "OUTLINE_ADAPTATION_CARDINALITY_INVALID"
);

const singleRaw = rawOutline();
singleRaw.sections = [
  section("U1", "problem", ["problem"]),
  section("U2", "method", ["method"]),
  section("U3", "action", ["iteration"]),
  section("U4", "hook", [])
];
const singleCanonical = materializeContentOutlineSemanticAuthority(singleRaw, master);
singleCanonical.sections[0].adaptationType = "split";
assertCanonicalAdaptationFailure(
  "corrupted lone split",
  singleCanonical,
  "OUTLINE_ADAPTATION_LONE_SPLIT_INVALID"
);

const invalidMapping = clone(canonical);
invalidMapping.sections[0].adaptationType = "invented";
assertCanonicalAdaptationFailure(
  "invalid canonical adaptation mapping",
  invalidMapping,
  "OUTLINE_ADAPTATION_MAPPING_INVALID",
  ["data.sections[].masterUnitRefs", "data.sections[].adaptationType"]
);

const rawEnvelope = { status: "ready", data: raw, warnings: [], blocked_reasons: [] };
const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
let activeProviderEnvelope = null;
const execute = createUnifiedSkillActivityExecutor({
  evidenceCompiler,
  generateText: async () => ({ mode: "offline_test", data: clone(activeProviderEnvelope) })
});
const masterStep = {
  id: "content_master", kind: "skill", capability: "build-content-master", enabled: true, required: true,
  dependsOn: [], inputContract: "FrozenIntent", outputContract: "ContentMaster@2.0"
};
const outlineStep = {
  id: "outline", kind: "skill", capability: "generate-content-outline", enabled: true, required: true,
  dependsOn: ["content_master"], inputContract: "MasterAndPlatform", outputContract: "ContentOutline@1.0"
};
const executionPlan = {
  schemaVersion: "1.0", kind: "UnifiedSharedSkillExecutionPlan",
  authorization: { mode: "strict", compatibilityAdapterRequired: true },
  steps: [masterStep, outlineStep], createdAt: "2026-08-09T00:00:00.000Z"
};
activeProviderEnvelope = { status: "success", data: master, warnings: [], blocked_reasons: [] };
await execute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: masterStep, executionPlan });
activeProviderEnvelope = rawEnvelope;
const verified = await execute({ capability: "generate-content-outline", platform: "xiaohongshu", input: {}, step: outlineStep, executionPlan });
const fact = evidenceCompiler.getSkillOutputFacts().find((item) => item.capability === "generate-content-outline");
assert.deepEqual(fact.runtimeOutput, rawEnvelope, "raw advisory labels must remain unchanged in evidence");
assert.equal(fact.outputHash, hashUnifiedContent(rawEnvelope), "raw advisory labels must remain hash-bound");
assert.deepEqual(fact.verifiedDomainOutput.sections.map((item) => item.adaptationType), ["split", "split", "merge", "supplemental"]);
assert.deepEqual(verified.sections.map((item) => item.adaptationType), ["split", "split", "merge", "supplemental"]);

console.log(JSON.stringify({
  status: "outline-adaptation-materialization-self-test passed",
  globallyValidSupplementalRoles: globallyValidRoles.length,
  runtimeRoleRewrites: 0,
  realProviderCalls: 0,
  retries: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
