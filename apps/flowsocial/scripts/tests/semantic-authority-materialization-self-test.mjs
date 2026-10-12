import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  materializeContentMasterSemanticAuthority,
  materializeContentOutlineSemanticAuthority,
  validateContentMasterSemanticSpine,
  validateContentOutlineSemanticMapping,
  validateUnifiedSkillDomainOutput
} from "../../content-agent/unified-skill-output-contracts.mjs";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";
import { createUnifiedStagedAtomicDualBootstrap } from "../../content-agent/unified-atomic-multiplatform-product.mjs";

const clone = structuredClone;

function frozenIntent({ id, units, optional = [], mode = "strict", order }) {
  const base = {
    id,
    structureType: mode === "strict" ? "ordered_framework" : "evidence_lens",
    requiredUnits: units.map(([unitId, meaning]) => ({ id: unitId, meaning, boundary: `Keep ${unitId} inside its frozen boundary.` })),
    optionalUnits: optional.map(([unitId, meaning]) => ({ id: unitId, meaning, boundary: `Keep ${unitId} inside its frozen boundary.` })),
    orderingPolicy: { mode, unitOrder: order }
  };
  return { ...base, intentHash: hashUnifiedContent(base) };
}

function rawMaster(id, semanticUnitIds) {
  return {
    content_master_id: id,
    confirmed_facts: [],
    supported_interpretations: [],
    author_opinions: [],
    source_list: [],
    semanticUnitIds
  };
}

function rawOutline({ id, platform, sections }) {
  return {
    outline_id: id,
    schema_version: "1.0",
    platform,
    topic: "trusted materialization",
    content_promise: "Preserve frozen meaning with platform-native expression.",
    content_function: "authority",
    content_purpose_id: "knowledge_howto",
    conversion_stage_id: "consideration",
    opening_strategy: "platform-native opening",
    sections: sections.map((section, index) => ({
      section_id: `S${index + 1}`,
      heading: section.heading || `Section ${index + 1}`,
      role: section.role || "method",
      objective: `Adapt section ${index + 1} without changing frozen meaning.`,
      key_points: [`Distinct presentation point ${index + 1}.`],
      claim_ids: [],
      boundary: "No unsupported claims.",
      masterUnitIds: clone(section.ids || []),
      adaptationType: section.adaptationType || "direct"
    })),
    closing_strategy: "Close in the platform voice.",
    unresolved_questions: [],
    confirmation_required: true
  };
}

const strictIntent = frozenIntent({
  id: "structure-intent:strict-four",
  units: [
    ["business", "Define the business problem, objective, and success criteria."],
    ["knowledge", "Inventory the available data, documents, rules, and experience."],
    ["workflow", "Embed AI in an accountable and traceable workflow."],
    ["iteration", "Improve through feedback, evaluation, and correction."]
  ],
  order: ["business", "knowledge", "workflow", "iteration"]
});
const providerMaster = rawMaster("master:raw-four", strictIntent.orderingPolicy.unitOrder);
const canonicalMaster = materializeContentMasterSemanticAuthority(providerMaster, strictIntent);
validateContentMasterSemanticSpine(canonicalMaster, strictIntent);
assert.equal(canonicalMaster.structureIntent.intentHash, strictIntent.intentHash);
assert.ok(canonicalMaster.semanticSpine.units.every((unit) => /^[a-f0-9]{64}$/.test(unit.unitHash)));
assert.match(canonicalMaster.semanticSpine.spineHash, /^[a-f0-9]{64}$/);
assert.match(canonicalMaster.contentMasterHash, /^[a-f0-9]{64}$/);
assert.deepEqual(
  materializeContentMasterSemanticAuthority(providerMaster, strictIntent),
  canonicalMaster,
  "same frozen intent and Provider payload must materialize byte-identically"
);

const canonicalMasterReplay = materializeContentMasterSemanticAuthority(canonicalMaster, strictIntent);
assert.deepEqual(canonicalMasterReplay, canonicalMaster, "canonical materialization must be idempotent for cached planning");

const masterEnvelope = { status: "success", data: providerMaster, warnings: [], blocked_reasons: [] };
const verifiedMaster = validateUnifiedSkillDomainOutput({
  capability: "build-content-master",
  platform: "xiaohongshu",
  outputContract: "ContentMaster@2.0",
  runtimeOutput: masterEnvelope,
  sourceSkillInput: { structureIntent: strictIntent }
});
assert.deepEqual(verifiedMaster.contentMaster, canonicalMaster);

for (const [label, mutate] of [
  ["wrong unit ids", (value) => { value.semanticUnitIds[1] = "invented"; }],
  ["missing unit ids", (value) => { delete value.semanticUnitIds; }]
]) {
  const candidate = clone(providerMaster);
  mutate(candidate);
  assert.throws(
    () => materializeContentMasterSemanticAuthority(candidate, strictIntent),
    { code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID" },
    label
  );
}

const authorityEcho = clone(providerMaster);
authorityEcho.structureIntent = { provider: "advisory" };
authorityEcho.semanticSpine = { provider: "advisory", spineHash: "0".repeat(64) };
authorityEcho.contentMasterHash = "0".repeat(64);
const authorityEchoBefore = clone(authorityEcho);
assert.deepEqual(materializeContentMasterSemanticAuthority(authorityEcho, strictIntent), canonicalMaster);
assert.deepEqual(authorityEcho, authorityEchoBefore, "raw Provider authority echoes must remain unchanged advisory evidence");

const providerOutline = rawOutline({
  id: "outline:raw-four",
  platform: "xiaohongshu",
  sections: [
    { role: "hook", ids: [], adaptationType: "supplemental" },
    { ids: ["business"] },
    { role: "evidence", ids: ["knowledge"] },
    { ids: ["knowledge", "workflow"], adaptationType: "merge" },
    { ids: ["iteration"] },
    { ids: ["iteration"] }
  ]
});
const canonicalOutline = materializeContentOutlineSemanticAuthority(providerOutline, canonicalMaster);
validateContentOutlineSemanticMapping(canonicalOutline, canonicalMaster);
assert.deepEqual(
  canonicalOutline.sections.map((section) => section.adaptationType),
  ["supplemental", "direct", "split", "merge", "split", "split"],
  "canonical composition accepts repeated single-ref split alongside multi-ref merge"
);
assert.equal(Object.hasOwn(canonicalOutline.sections[1], "masterUnitIds"), false);
assert.deepEqual(canonicalOutline.sections[1].masterUnitRefs[0], {
  id: "business",
  hash: canonicalMaster.semanticSpine.units[0].unitHash
});
assert.deepEqual(materializeContentOutlineSemanticAuthority(canonicalOutline, canonicalMaster), canonicalOutline);

for (const [label, mutate] of [
  ["unknown id", (value) => { value.sections[1].masterUnitIds = ["unknown"]; }],
  ["missing required", (value) => { value.sections = value.sections.filter((section) => !section.masterUnitIds?.includes("workflow")); }],
  ["strict disorder", (value) => { [value.sections[1], value.sections[2]] = [value.sections[2], value.sections[1]]; }],
  ["competing framework", (value) => { value.structureIntent = clone(strictIntent); }],
  ["malformed supplied ref", (value) => { value.contentMasterRef = { id: "master:advisory", extra: true }; }]
]) {
  const candidate = clone(providerOutline);
  mutate(candidate);
  assert.throws(
    () => materializeContentOutlineSemanticAuthority(candidate, canonicalMaster),
    { code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID" },
    label
  );
}

const flexibleIntent = frozenIntent({
  id: "structure-intent:flexible-three",
  units: [["claim", "State the claim."], ["evidence", "Ground the claim in evidence."]],
  optional: [["counterpoint", "Address a useful counterpoint."]],
  mode: "flexible",
  order: ["claim", "evidence", "counterpoint"]
});
const flexibleMaster = materializeContentMasterSemanticAuthority(rawMaster("master:flexible", ["claim", "evidence", "counterpoint"]), flexibleIntent);
const flexibleOutline = materializeContentOutlineSemanticAuthority(rawOutline({
  id: "outline:flexible",
  platform: "wechat",
  sections: [{ ids: ["evidence"] }, { ids: ["claim"] }, { role: "example", ids: [], adaptationType: "supplemental" }]
}), flexibleMaster);
assert.equal(flexibleMaster.semanticSpine.units.length, 3);
validateContentOutlineSemanticMapping(flexibleOutline, flexibleMaster);

const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
let activeProviderEnvelope = null;
const execute = createUnifiedSkillActivityExecutor({
  evidenceCompiler,
  generateText: async () => ({ mode: "offline_test", data: clone(activeProviderEnvelope) })
});
const masterStep = { id: "content_master", kind: "skill", capability: "build-content-master", enabled: true, required: true, dependsOn: [], inputContract: "FrozenIntent", outputContract: "ContentMaster@2.0" };
const outlineStep = { id: "outline", kind: "skill", capability: "generate-content-outline", enabled: true, required: true, dependsOn: ["content_master"], inputContract: "MasterAndPlatform", outputContract: "ContentOutline@1.0" };
const executionPlan = {
  schemaVersion: "1.0", kind: "UnifiedSharedSkillExecutionPlan",
  authorization: { mode: "strict", compatibilityAdapterRequired: true },
  steps: [masterStep, outlineStep], createdAt: "2026-08-09T00:00:00.000Z"
};
const authorityEchoEnvelope = { status: "success", data: authorityEcho, warnings: [], blocked_reasons: [] };
activeProviderEnvelope = authorityEchoEnvelope;
await execute({ capability: masterStep.capability, platform: "xiaohongshu", input: { structureIntent: strictIntent }, step: masterStep, executionPlan });
activeProviderEnvelope = { status: "ready", data: providerOutline, warnings: [], blocked_reasons: [] };
await execute({ capability: outlineStep.capability, platform: "xiaohongshu", input: {}, step: outlineStep, executionPlan });
const providerWechatOutline = clone(providerOutline);
providerWechatOutline.outline_id = "outline:raw-four:wechat";
providerWechatOutline.platform = "wechat";
activeProviderEnvelope = { status: "ready", data: providerWechatOutline, warnings: [], blocked_reasons: [] };
await execute({ capability: outlineStep.capability, platform: "wechat", input: {}, step: outlineStep, executionPlan });
const facts = evidenceCompiler.getSkillOutputFacts();
assert.equal(facts.length, 3);
assert.deepEqual(facts[0].runtimeOutput, authorityEchoEnvelope, "raw Provider authority echoes must remain unchanged in the Output Fact");
assert.equal(facts[0].outputHash, hashUnifiedContent(authorityEchoEnvelope), "raw Provider authority echoes must remain hash-bound");
assert.equal(facts[0].runtimeOutput.data.contentMasterHash, "0".repeat(64), "raw advisory hash must not be overwritten");
assert.match(facts[0].verifiedDomainOutput.contentMaster.contentMasterHash, /^[a-f0-9]{64}$/);
assert.deepEqual(facts[0].verifiedDomainOutput.contentMaster, canonicalMaster, "verified canonical master must ignore raw authority echoes");
assert.ok(facts[1].verifiedDomainOutput.sections.every((section) => section.masterUnitRefs.every((unitRef) => /^[a-f0-9]{64}$/.test(unitRef.hash))));

const atomicMaster = { schemaVersion: "3.0", contract: "ContentMaster@3.0", id: canonicalMaster.content_master_id, ...clone(canonicalMaster) };
const canonicalXhsOutline = facts.find((fact) => fact.platform === "xiaohongshu" && fact.capability === "generate-content-outline").verifiedDomainOutput;
const canonicalWechatOutline = facts.find((fact) => fact.platform === "wechat" && fact.capability === "generate-content-outline").verifiedDomainOutput;
const planningBase = {
  schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", id: "planning:raw-canonical-boundary",
  sharedContentMaster: atomicMaster,
  sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(atomicMaster) }],
  platformRuns: [
    { platform: "xiaohongshu", outline: canonicalXhsOutline, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(canonicalXhsOutline) }] },
    { platform: "wechat", outline: canonicalWechatOutline, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(canonicalWechatOutline) }] }
  ]
};
const stagedInput = {
  requestId: "request:raw-canonical-boundary", idempotencyKey: "key:raw-canonical-boundary",
  companyId: "company:fixture", projectId: "project:fixture", topicIntent: { topic: "trusted materialization", intent: "dual platform" },
  structureIntent: strictIntent,
  activeStrategySnapshotRef: { id: "strategy:active", hash: hashUnifiedContent({ id: "strategy:active" }) },
  prerequisiteRef: { id: "prerequisite:ready", hash: hashUnifiedContent({ id: "prerequisite:ready" }) },
  accounts: {
    xiaohongshu: { id: "account:xhs", hash: hashUnifiedContent({ id: "account:xhs" }) },
    wechat: { id: "account:wechat", hash: hashUnifiedContent({ id: "account:wechat" }) }
  },
  authorizationSourceRefs: [{ id: "authorization:source", hash: hashUnifiedContent({ id: "authorization:source" }) }]
};
const authorityRefs = {
  activeStrategySnapshotRef: stagedInput.activeStrategySnapshotRef,
  prerequisiteRef: stagedInput.prerequisiteRef,
  accountRefs: stagedInput.accounts,
  authorizationSourceRefs: stagedInput.authorizationSourceRefs,
  structureIntentRef: { id: strictIntent.id, hash: strictIntent.intentHash }
};
const stagedStore = {};
const staged = await createUnifiedStagedAtomicDualBootstrap(stagedStore, stagedInput, {
  featureFlags: { unifiedContentStagedAtomicDualBootstrapV1: true },
  now: () => "2026-08-09T10:00:00.000Z",
  planBootstrap: async () => ({
    authority: { bindingRefs: clone(authorityRefs), serverAuthorityId: "authority:raw-canonical-boundary" },
    planning: { ...planningBase, planningHash: hashUnifiedContent(planningBase) },
    actualInvocations: evidenceCompiler.getActualInvocations(),
    outputFacts: facts
  })
});
assert.equal(staged.created, true);
assert.equal(stagedStore.unifiedStagedAtomicDualBootstraps[0].planning.outputs.sharedContentMaster.contentMasterHash, canonicalMaster.contentMasterHash);
assert.ok(staged.bootstrap.outlines.wechat.sections.every((section) => Array.isArray(section.masterUnitRefs)));

console.log(JSON.stringify({
  status: "semantic-authority-materialization-self-test passed",
  fixtures: ["strict-four-unit", "flexible-non-four-unit"],
  canonicalOutputFacts: facts.length,
  realProviderCalls: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0
}, null, 2));
