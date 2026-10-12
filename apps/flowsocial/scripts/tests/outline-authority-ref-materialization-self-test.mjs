import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  materializeContentMasterSemanticAuthority,
  materializeContentOutlineSemanticAuthority
} from "../../content-agent/unified-skill-output-contracts.mjs";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";

const clone = structuredClone;
const intentBase = {
  id: "structure-intent:outline-ref-fixture",
  structureType: "ordered_framework",
  requiredUnits: [
    { id: "problem", meaning: "Define the problem.", boundary: "Do not invent causes." },
    { id: "method", meaning: "Explain the method.", boundary: "Do not promise outcomes." }
  ],
  optionalUnits: [],
  orderingPolicy: { mode: "strict", unitOrder: ["problem", "method"] }
};
const intent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
const master = materializeContentMasterSemanticAuthority({
  content_master_id: "master:outline-ref-fixture",
  confirmed_facts: [],
  supported_interpretations: [],
  author_opinions: [],
  source_list: [],
  semanticUnitIds: ["problem", "method"]
}, intent);
const exactMasterRef = { id: master.content_master_id, hash: master.contentMasterHash };
const exactSpineRef = { id: master.semanticSpine.id, hash: master.semanticSpine.spineHash };
const unitRefs = new Map(master.semanticSpine.units.map((unit) => [unit.id, { id: unit.id, hash: unit.unitHash }]));

function rawOutline() {
  return {
    outline_id: "outline:authority-ref-fixture",
    schema_version: "1.0",
    platform: "xiaohongshu",
    topic: "Trusted authority refs",
    content_promise: "Preserve exact semantic authority.",
    content_function: "authority",
    content_purpose_id: "knowledge_howto",
    conversion_stage_id: "consideration",
    opening_strategy: "Open with the bounded problem.",
    sections: [
      {
        section_id: "S1", heading: "Problem", role: "problem", objective: "Define the problem.",
        key_points: [], claim_ids: [], boundary: "No invented causes.", masterUnitIds: ["problem"], adaptationType: "direct"
      },
      {
        section_id: "S2", heading: "Method", role: "method", objective: "Explain the method.",
        key_points: [], claim_ids: [], boundary: "No outcome promise.", masterUnitIds: ["method"], adaptationType: "direct"
      },
      {
        section_id: "S3", heading: "Boundary", role: "boundary", objective: "Restate limits.",
        key_points: [], claim_ids: [], boundary: "No new authority.", masterUnitIds: [], adaptationType: "supplemental"
      }
    ],
    closing_strategy: "Ask for outline confirmation.",
    unresolved_questions: [],
    confirmation_required: true
  };
}

const omitted = rawOutline();
const canonicalOmitted = materializeContentOutlineSemanticAuthority(omitted, master);
assert.deepEqual(canonicalOmitted.contentMasterRef, exactMasterRef);
assert.deepEqual(canonicalOmitted.semanticSpineRef, exactSpineRef);
assert.deepEqual(canonicalOmitted.sections[0].masterUnitRefs, [unitRefs.get("problem")]);

const idOnly = rawOutline();
idOnly.contentMasterRef = { id: exactMasterRef.id };
idOnly.semanticSpineRef = { id: exactSpineRef.id };
idOnly.sections.forEach((section) => {
  section.masterUnitRefs = section.masterUnitIds.map((id) => ({ id }));
  delete section.masterUnitIds;
});
const canonicalIdOnly = materializeContentOutlineSemanticAuthority(idOnly, master);
assert.deepEqual(canonicalIdOnly, canonicalOmitted);

const exactFull = clone(canonicalOmitted);
assert.deepEqual(materializeContentOutlineSemanticAuthority(exactFull, master), canonicalOmitted);

function assertStablePath(label, mutate, fieldPath) {
  const candidate = rawOutline();
  mutate(candidate);
  assert.throws(
    () => materializeContentOutlineSemanticAuthority(candidate, master),
    (error) => error.code === "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID"
      && assert.deepEqual(error.details.fieldPaths, [fieldPath]) === undefined,
    label
  );
}

assertStablePath("conflicting ContentMaster id", (value) => {
  value.contentMasterRef = { id: "master:conflict" };
}, "data.contentMasterRef");
assertStablePath("conflicting semantic spine id", (value) => {
  value.semanticSpineRef = { id: "semantic-spine:conflict" };
}, "data.semanticSpineRef");
assertStablePath("conflicting unit id", (value) => {
  value.sections[0].masterUnitRefs = [{ id: "method" }];
}, "data.sections[].masterUnitRefs");
assertStablePath("extra authority field", (value) => {
  value.contentMasterRef = { id: exactMasterRef.id, providerNote: "untrusted" };
}, "data.contentMasterRef");

const rawEnvelope = { status: "ready", data: idOnly, warnings: [], blocked_reasons: [] };
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
const step = {
  id: "outline", kind: "skill", capability: "generate-content-outline", enabled: true, required: true,
  dependsOn: ["content_master"], inputContract: "MasterAndPlatform", outputContract: "ContentOutline@1.0"
};
const executionPlan = {
  schemaVersion: "1.0", kind: "UnifiedSharedSkillExecutionPlan",
  authorization: { mode: "strict", compatibilityAdapterRequired: true },
  steps: [masterStep, step], createdAt: "2026-08-09T00:00:00.000Z"
};
const masterRuntime = { status: "success", data: master, warnings: [], blocked_reasons: [] };
activeProviderEnvelope = masterRuntime;
await execute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: masterStep, executionPlan });
activeProviderEnvelope = rawEnvelope;
const verified = await execute({ capability: "generate-content-outline", platform: "xiaohongshu", input: {}, step, executionPlan });
const outlineFact = evidenceCompiler.getSkillOutputFacts().find((fact) => fact.capability === "generate-content-outline");
assert.deepEqual(outlineFact.runtimeOutput, rawEnvelope, "raw Provider evidence must remain byte-equivalent");
assert.equal(outlineFact.outputHash, hashUnifiedContent(rawEnvelope), "raw Provider evidence must remain hash-bound");
assert.deepEqual(outlineFact.verifiedDomainOutput.contentMasterRef, exactMasterRef);
assert.deepEqual(outlineFact.verifiedDomainOutput.semanticSpineRef, exactSpineRef);
assert.deepEqual(verified.contentMasterRef, exactMasterRef);

console.log(JSON.stringify({
  status: "outline-authority-ref-materialization-self-test passed",
  realProviderCalls: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0
}, null, 2));
