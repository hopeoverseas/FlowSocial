import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  materializeContentMasterSemanticAuthority,
  materializeContentOutlineSemanticAuthority,
  validateContentOutlineSemanticMapping
} from "../../content-agent/unified-skill-output-contracts.mjs";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";

const clone = structuredClone;
const intentBase = {
  id: "structure-intent:top-level-authority-fixture",
  structureType: "ordered_framework",
  requiredUnits: [
    { id: "problem", meaning: "Define the problem.", boundary: "Do not invent causes." },
    { id: "method", meaning: "Explain the method.", boundary: "Do not promise results." }
  ],
  optionalUnits: [],
  orderingPolicy: { mode: "strict", unitOrder: ["problem", "method"] }
};
const intent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
const master = materializeContentMasterSemanticAuthority({
  content_master_id: "master:top-level-authority-fixture",
  confirmed_facts: [], supported_interpretations: [], author_opinions: [], source_list: [],
  semanticUnitIds: intent.orderingPolicy.unitOrder
}, intent);
const trustedMasterRef = { id: master.content_master_id, hash: master.contentMasterHash };
const trustedSpineRef = { id: master.semanticSpine.id, hash: master.semanticSpine.spineHash };
const trustedUnits = new Map(master.semanticSpine.units.map((unit) => [unit.id, { id: unit.id, hash: unit.unitHash }]));

function rawOutline() {
  return {
    outline_id: "outline:top-level-authority-fixture",
    schema_version: "1.0",
    platform: "xiaohongshu",
    topic: "Runtime-owned top-level authority",
    content_promise: "Keep Provider content separate from runtime authority.",
    content_function: "authority",
    content_purpose_id: "knowledge_howto",
    conversion_stage_id: "consideration",
    opening_strategy: "Open with the bounded problem.",
    contentMasterRef: { id: "provider-invented-master", hash: "provider-invented-hash" },
    semanticSpineRef: { id: null, hash: { provider: "invented-spine" } },
    sections: [
      {
        section_id: "S1", heading: "Problem", role: "problem", objective: "Define the problem.",
        key_points: [], claim_ids: [], boundary: "No invented causes.", masterUnitIds: ["problem"],
        masterUnitRefs: [{ id: "problem", hash: "provider-unit-hash" }]
      },
      {
        section_id: "S2", heading: "Method", role: "method", objective: "Explain the method.",
        key_points: [], claim_ids: [], boundary: "No promised results.", masterUnitIds: ["method"],
        masterUnitRefs: [{ id: "method", hash: null }]
      },
      {
        section_id: "S3", heading: "Boundary", role: "boundary", objective: "Restate limits.",
        key_points: [], claim_ids: [], boundary: "No new authority.", masterUnitIds: [], masterUnitRefs: []
      }
    ],
    closing_strategy: "Ask for confirmation.",
    unresolved_questions: [],
    confirmation_required: true
  };
}

const raw = rawOutline();
const rawBefore = clone(raw);
const canonical = materializeContentOutlineSemanticAuthority(raw, master);
assert.deepEqual(raw, rawBefore, "raw top-level authority values must remain unchanged");
assert.deepEqual(canonical.contentMasterRef, trustedMasterRef);
assert.deepEqual(canonical.semanticSpineRef, trustedSpineRef);
assert.deepEqual(canonical.sections[0].masterUnitRefs, [trustedUnits.get("problem")]);
assert.deepEqual(canonical.sections[1].masterUnitRefs, [trustedUnits.get("method")]);
assert.deepEqual(
  canonical.sections.map(({ section_id, heading, role, objective, boundary }) => ({ section_id, heading, role, objective, boundary })),
  raw.sections.map(({ section_id, heading, role, objective, boundary }) => ({ section_id, heading, role, objective, boundary })),
  "authority materialization must not repair content, roles, or order"
);
assert.deepEqual(materializeContentOutlineSemanticAuthority(canonical, master), canonical, "canonical refs must remain idempotent");

const omitted = rawOutline();
delete omitted.contentMasterRef;
delete omitted.semanticSpineRef;
assert.deepEqual(materializeContentOutlineSemanticAuthority(omitted, master), canonical);

const arbitraryIdOnly = rawOutline();
arbitraryIdOnly.contentMasterRef = { id: { provider: "arbitrary" } };
arbitraryIdOnly.semanticSpineRef = { id: 42 };
assert.deepEqual(materializeContentOutlineSemanticAuthority(arbitraryIdOnly, master), canonical);

function assertStablePath(label, mutate, fieldPath) {
  const candidate = rawOutline();
  mutate(candidate);
  assert.throws(
    () => materializeContentOutlineSemanticAuthority(candidate, master),
    (error) => {
      assert.equal(error.code, "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID");
      assert.deepEqual(error.details.fieldPaths, [fieldPath]);
      return true;
    },
    label
  );
}

assertStablePath("null master ref", (value) => { value.contentMasterRef = null; }, "data.contentMasterRef");
assertStablePath("empty spine ref", (value) => { value.semanticSpineRef = {}; }, "data.semanticSpineRef");
assertStablePath("extra top-level field", (value) => { value.contentMasterRef.extra = true; }, "data.contentMasterRef");
assertStablePath("conflicting section unit id", (value) => { value.sections[0].masterUnitRefs[0].id = "method"; }, "data.sections[].masterUnitRefs");
assertStablePath("extra section ref field", (value) => { value.sections[0].masterUnitRefs[0].extra = true; }, "data.sections[].masterUnitRefs");
assertStablePath("unknown unit id", (value) => { value.sections[0].masterUnitIds = ["unknown"]; }, "data.sections[].masterUnitIds");
assertStablePath("duplicate unit mapping", (value) => {
  value.sections[0].masterUnitIds = ["problem", "problem"];
  value.sections[0].masterUnitRefs = [{ id: "problem" }, { id: "problem" }];
}, "data.sections[].masterUnitRefs");
assertStablePath("missing required unit", (value) => { value.sections.splice(1, 1); }, "data.sections[].masterUnitRefs");
assertStablePath("strict unit order", (value) => { [value.sections[0], value.sections[1]] = [value.sections[1], value.sections[0]]; }, "data.sections[].masterUnitRefs");
assertStablePath("invalid supplemental role", (value) => { value.sections[2].role = "problem"; }, "data.sections[].adaptationType");
assertStablePath("competing framework", (value) => { value.structureIntent = clone(intent); }, "data.sections");

const staleCanonical = clone(canonical);
staleCanonical.contentMasterRef.hash = "0".repeat(64);
assert.throws(
  () => validateContentOutlineSemanticMapping(staleCanonical, master),
  (error) => error.code === "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID"
    && error.details.fieldPaths.includes("data.contentMasterRef"),
  "canonical top-level refs must still undergo strict hash validation"
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
assert.deepEqual(fact.runtimeOutput, rawEnvelope, "raw top-level authority evidence must remain byte-equivalent");
assert.equal(fact.outputHash, hashUnifiedContent(rawEnvelope), "raw top-level authority evidence must remain hash-bound");
assert.equal(fact.runtimeOutput.data.contentMasterRef.id, "provider-invented-master");
assert.deepEqual(fact.runtimeOutput.data.semanticSpineRef, raw.semanticSpineRef);
assert.deepEqual(fact.verifiedDomainOutput.contentMasterRef, trustedMasterRef);
assert.deepEqual(fact.verifiedDomainOutput.semanticSpineRef, trustedSpineRef);
assert.deepEqual(verified.sections[0].masterUnitRefs, [trustedUnits.get("problem")]);

console.log(JSON.stringify({
  status: "outline-top-level-authority-materialization-self-test passed",
  realProviderCalls: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0
}, null, 2));
