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
  id: "structure-intent:hash-advisory-fixture",
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
  content_master_id: "master:hash-advisory-fixture",
  confirmed_facts: [], supported_interpretations: [], author_opinions: [], source_list: [],
  semanticUnitIds: intent.orderingPolicy.unitOrder
}, intent);
const trustedMasterRef = { id: master.content_master_id, hash: master.contentMasterHash };
const trustedSpineRef = { id: master.semanticSpine.id, hash: master.semanticSpine.spineHash };
const trustedUnits = new Map(master.semanticSpine.units.map((unit) => [unit.id, { id: unit.id, hash: unit.unitHash }]));

function rawOutline() {
  return {
    outline_id: "outline:hash-advisory-fixture",
    schema_version: "1.0",
    platform: "xiaohongshu",
    topic: "Advisory raw hashes",
    content_promise: "Keep cryptographic authority in trusted runtime.",
    content_function: "authority",
    content_purpose_id: "knowledge_howto",
    conversion_stage_id: "consideration",
    opening_strategy: "Open with the bounded problem.",
    contentMasterRef: { id: trustedMasterRef.id, hash: "provider-stale-master-hash" },
    semanticSpineRef: { id: trustedSpineRef.id, hash: { invented: true } },
    sections: [
      {
        section_id: "S1", heading: "Problem", role: "problem", objective: "Define the problem.",
        key_points: [], claim_ids: [], boundary: "No invented causes.",
        masterUnitRefs: [{ id: "problem", hash: null }]
      },
      {
        section_id: "S2", heading: "Method", role: "method", objective: "Explain the method.",
        key_points: [], claim_ids: [], boundary: "No promised results.",
        masterUnitRefs: [{ id: "method", hash: "0".repeat(64) }]
      },
      {
        section_id: "S3", heading: "Boundary", role: "boundary", objective: "Restate limits.",
        key_points: [], claim_ids: [], boundary: "No new authority.", masterUnitRefs: []
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
assert.deepEqual(raw, rawBefore, "advisory hashes must remain unchanged in raw output");
assert.deepEqual(canonical.contentMasterRef, trustedMasterRef);
assert.deepEqual(canonical.semanticSpineRef, trustedSpineRef);
assert.deepEqual(canonical.sections[0].masterUnitRefs, [trustedUnits.get("problem")]);
assert.deepEqual(canonical.sections[1].masterUnitRefs, [trustedUnits.get("method")]);
assert.deepEqual(canonical.sections.map((section) => section.adaptationType), ["direct", "direct", "supplemental"]);
assert.deepEqual(
  canonical.sections.map(({ section_id, heading, role, objective, boundary }) => ({ section_id, heading, role, objective, boundary })),
  raw.sections.map(({ section_id, heading, role, objective, boundary }) => ({ section_id, heading, role, objective, boundary })),
  "hash materialization must not repair section content, role, or order"
);
assert.deepEqual(materializeContentOutlineSemanticAuthority(canonical, master), canonical, "exact full canonical refs must remain idempotent");

const omitted = rawOutline();
delete omitted.contentMasterRef;
delete omitted.semanticSpineRef;
omitted.sections.forEach((section) => {
  section.masterUnitIds = section.masterUnitRefs.map((ref) => ref.id);
  delete section.masterUnitRefs;
});
assert.deepEqual(materializeContentOutlineSemanticAuthority(omitted, master), canonical);

const idOnly = rawOutline();
idOnly.contentMasterRef = { id: trustedMasterRef.id };
idOnly.semanticSpineRef = { id: trustedSpineRef.id };
idOnly.sections.forEach((section) => {
  section.masterUnitRefs = section.masterUnitRefs.map((ref) => ({ id: ref.id }));
});
assert.deepEqual(materializeContentOutlineSemanticAuthority(idOnly, master), canonical);

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

assertStablePath("extra top ref field", (value) => { value.contentMasterRef.note = "untrusted"; }, "data.contentMasterRef");
assertStablePath("conflicting unit id", (value) => {
  value.sections[0].masterUnitIds = ["problem"];
  value.sections[0].masterUnitRefs[0].id = "method";
}, "data.sections[].masterUnitRefs");
assertStablePath("extra unit ref field", (value) => { value.sections[0].masterUnitRefs[0].note = "untrusted"; }, "data.sections[].masterUnitRefs");
assertStablePath("unknown unit id", (value) => { value.sections[0].masterUnitRefs[0].id = "unknown"; }, "data.sections[].masterUnitIds");
assertStablePath("duplicate unit mapping", (value) => {
  value.sections[0].masterUnitRefs = [{ id: "problem" }, { id: "problem" }];
}, "data.sections[].masterUnitRefs");
assertStablePath("missing required coverage", (value) => { value.sections.splice(1, 1); }, "data.sections[].masterUnitRefs");
assertStablePath("strict ordering", (value) => { [value.sections[0], value.sections[1]] = [value.sections[1], value.sections[0]]; }, "data.sections[].masterUnitRefs");
assertStablePath("invalid supplemental role", (value) => { value.sections[2].role = "problem"; }, "data.sections[].adaptationType");
assertStablePath("competing framework", (value) => { value.structureIntent = clone(intent); }, "data.sections");

const staleCanonical = clone(canonical);
staleCanonical.sections[0].masterUnitRefs[0].hash = "0".repeat(64);
assert.throws(
  () => validateContentOutlineSemanticMapping(staleCanonical, master),
  (error) => error.code === "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID"
    && error.details.fieldPaths.includes("data.sections[].masterUnitRefs"),
  "canonical stale hashes must remain fail closed"
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
assert.deepEqual(fact.runtimeOutput, rawEnvelope, "raw advisory hashes must remain byte-equivalent");
assert.equal(fact.outputHash, hashUnifiedContent(rawEnvelope), "raw advisory hashes must remain hash-bound");
assert.equal(fact.runtimeOutput.data.contentMasterRef.hash, "provider-stale-master-hash");
assert.deepEqual(fact.runtimeOutput.data.semanticSpineRef.hash, { invented: true });
assert.deepEqual(fact.verifiedDomainOutput.contentMasterRef, trustedMasterRef);
assert.deepEqual(fact.verifiedDomainOutput.semanticSpineRef, trustedSpineRef);
assert.deepEqual(verified.sections[0].masterUnitRefs, [trustedUnits.get("problem")]);

console.log(JSON.stringify({
  status: "outline-authority-hash-advisory-materialization-self-test passed",
  realProviderCalls: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0
}, null, 2));
