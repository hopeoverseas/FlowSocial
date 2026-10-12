import assert from "node:assert/strict";
import { createUnifiedWriterContext, hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { runUnifiedStagedContentPlanning } from "../../content-agent/unified-content-orchestrator.mjs";
import {
  createContentOutlineStrictSequenceContract,
  materializeContentMasterSemanticAuthority
} from "../../content-agent/unified-skill-output-contracts.mjs";

const clone = structuredClone;
const ref = (id, value = { id }) => ({ id, hash: hashUnifiedContent(value) });
const structureIntentBase = {
  id: "structure-intent:input-closure", structureType: "ordered_framework",
  requiredUnits: [
    { id: "problem", meaning: "Define the bounded problem.", boundary: "Do not invent causes." },
    { id: "method", meaning: "Explain the accountable method.", boundary: "Do not promise results." },
    { id: "iteration", meaning: "Close the feedback loop.", boundary: "Do not omit evaluation." }
  ],
  optionalUnits: [], orderingPolicy: { mode: "strict", unitOrder: ["problem", "method", "iteration"] }
};
const structureIntent = { ...structureIntentBase, intentHash: hashUnifiedContent(structureIntentBase) };
const semanticUnits = structureIntent.requiredUnits.map((unit, order) => {
  const base = { ...unit, required: true, order };
  return { ...base, unitHash: hashUnifiedContent(base) };
});
const semanticSpineBase = {
  id: "semantic-spine:master:input-closure",
  structureIntentRef: { id: structureIntent.id, hash: structureIntent.intentHash },
  structureType: structureIntent.structureType,
  orderingPolicy: clone(structureIntent.orderingPolicy), units: semanticUnits
};
const contentMaster = materializeContentMasterSemanticAuthority({
  schemaVersion: "3.0", contract: "ContentMaster@3.0", id: "master:input-closure", content_master_id: "master:input-closure",
  confirmed_facts: [], supported_interpretations: [], author_opinions: [], source_list: [],
  semanticUnitIds: structureIntent.orderingPolicy.unitOrder,
  structureIntent, semanticSpine: { ...semanticSpineBase, spineHash: hashUnifiedContent(semanticSpineBase) }
}, structureIntent);
const sharedMaster = { id: contentMaster.id, contract: "SharedContentMaster@3.0", contentMaster };
const expectedStrictSequenceContract = createContentOutlineStrictSequenceContract(contentMaster);
const designDna = { id: "design-dna:confirmed", status: "confirmed", visualSystem: "fixture" };
const designDnaRef = ref(designDna.id, designDna);
const activeStrategySnapshotRef = ref("strategy:active");
const knowledgeSource = { id: "knowledge:input-closure", title: "Verified fixture knowledge" };
const selectedSourceRef = {
  id: knowledgeSource.id,
  hash: hashUnifiedContent({ mechanism: "knowledge", sourceType: "knowledge_base", source: knowledgeSource })
};
const decisionBase = {
  schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "decision:input-closure", companyId: "company:fixture",
  projectInputRef: ref("project-input:fixture"), activeStrategySnapshotRef,
  taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
  mechanisms: [{
    mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated",
    candidates: [{ sourceRef: selectedSourceRef, status: "selected", reason: "selected_and_frozen" }],
    reason: "Verified fixture knowledge is primary.", factPolicy: null
  }],
  selectedSourceRefs: [selectedSourceRef], strategyHotspotPolicy: "optional",
  deviation: { status: "none", reason: null, confirmationEventRef: null }, decidedAt: "2026-08-09T00:00:00.000Z"
};
const mechanismDecision = { ...decisionBase, decisionHash: hashUnifiedContent(decisionBase) };
const mechanismDecisionRef = { id: mechanismDecision.id, hash: mechanismDecision.decisionHash };
const sourcePlan = {
  schemaVersion: "0.1", mode: "knowledge_base",
  sources: [{ type: "knowledge_base", role: "evidence", required: true, candidateIds: [knowledgeSource.id], assets: [knowledgeSource] }]
};
function writerContext(platform) {
  return createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0",
    platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu",
    account_id: platform === "wechat" ? "account:wechat" : "account:xhs",
    topic_id: "opportunity:input-closure", intent_profile_id: "intent", content_purpose_id: "authority",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "authority", trust_source: "institution" },
    creative_mechanism: platform === "wechat" ? "framework" : "checklist", journey_stage: "trust", coordination_mode: "coordinated",
    matrix_coordination: { shared_campaign_topic_id: "opportunity:input-closure", differentiation_angle: platform, prohibited_overlap: [] },
    authority_refs: {
      activeStrategySnapshotRef, contentOpportunityRef: ref("opportunity:input-closure"), mechanismDecisionRef,
      accountRef: ref(`account:${platform}`), accountStrategyRef: ref(`account-strategy:${platform}`)
    }
  });
}
const project = {
  id: "project:input-closure", companyId: "company:fixture", contentOpportunityRef: ref("opportunity:input-closure"),
  activeStrategySnapshotRef, accounts: { xiaohongshu: "account:xhs", wechat: "account:wechat" },
  designDnaSnapshotRef: designDnaRef, designDnaAuthority: { ref: designDnaRef, snapshot: designDna },
  writerContexts: { xiaohongshu: writerContext("xiaohongshu"), wechat: writerContext("wechat") }
};

function assertClosedOutlineInput(value) {
  assert.ok(value?.content_master, "outline input requires the full canonical ContentMaster");
  assert.ok(value?.platform_brief, "outline input requires the exact Platform Brief");
  assert.ok(["xiaohongshu", "wechat_official_account"].includes(value?.platform), "outline input requires normalized platform identity");
  assert.ok(value?.strict_sequence_contract, "strict outline input requires the runtime-issued sequence contract");
}
assert.throws(
  () => assertClosedOutlineInput({ activeStrategySnapshotRef, priorOutputs: {} }),
  /full canonical ContentMaster/,
  "the old generic context/priorOutputs shape must fail the focused closure assertion"
);

const captured = [];
let masterCalls = 0;
let writerCalls = 0;
let serviceCalls = 0;
const result = await runUnifiedStagedContentPlanning({ project, mechanismDecision, sourcePlan }, {
  now: () => "2026-08-09T00:00:00.000Z",
  serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: true },
  buildSharedContentMaster: async () => { masterCalls += 1; return clone(sharedMaster); },
  buildPlatformBrief: async ({ platform, sharedContentMasterRef }) => {
    const brief = {
      id: `brief:${platform}:input-closure`, platform, accountId: project.accounts[platform],
      sharedContentMasterRef: clone(sharedContentMasterRef),
      brief: platform === "xiaohongshu"
        ? { designDna: clone(designDna), designDnaRef: clone(designDnaRef) }
        : { tone: "analytical" }
    };
    return brief;
  },
  executeSkillStep: async ({ platform, step, input }) => {
    if (step.capability !== "generate-content-outline") writerCalls += 1;
    captured.push({ platform, capability: step.capability, input: clone(input), originalInput: input });
    return { id: `outline:${platform}`, outline_id: `outline:${platform}`, platform, sections: [{ id: "S1", section_id: "S1", role: "method" }] };
  },
  executeServiceStep: async () => { serviceCalls += 1; throw new Error("planning-only must not execute service steps"); },
  executeAtomicSkillActivity: async () => { writerCalls += 1; throw new Error("planning-only must not execute atomic writer steps"); }
});

assert.equal(masterCalls, 1);
assert.equal(captured.length, 2, "planning must invoke XHS and WeChat outline exactly once each");
assert.equal(masterCalls + captured.length, 3, "planning must invoke exactly three planning Skills");
assert.equal(writerCalls, 0, "planning-only must invoke no writer");
assert.equal(serviceCalls, 0, "planning-only must invoke no service/artifact step");
for (const call of captured) {
  const canonicalBrief = result.platformRuns.find((run) => run.platform === call.platform).brief;
  assert.equal(call.capability, "generate-content-outline");
  assertClosedOutlineInput(call.input);
  assert.deepEqual(Object.keys(call.input).sort(), ["content_master", "platform", "platform_brief", "strict_sequence_contract"]);
  assert.equal(call.input.platform, call.platform === "wechat" ? "wechat_official_account" : "xiaohongshu");
  assert.deepEqual(call.input.content_master, contentMaster);
  assert.deepEqual(call.input.platform_brief, canonicalBrief);
  assert.notStrictEqual(call.originalInput.content_master, contentMaster);
  assert.notStrictEqual(call.originalInput.content_master.semanticSpine, contentMaster.semanticSpine);
  assert.notStrictEqual(call.originalInput.platform_brief, canonicalBrief);
  assert.deepEqual(call.input.strict_sequence_contract, expectedStrictSequenceContract);
  assert.notStrictEqual(call.originalInput.strict_sequence_contract, expectedStrictSequenceContract);
  assert.notStrictEqual(call.originalInput.strict_sequence_contract.slots, expectedStrictSequenceContract.slots);
  assert.deepEqual(
    call.input.strict_sequence_contract.slots.map(({ order, masterUnitRef }) => ({ order, masterUnitRef })),
    semanticUnits.map((unit, order) => ({ order, masterUnitRef: { id: unit.id, hash: unit.unitHash } }))
  );
  assert.deepEqual(
    call.input.content_master.semanticSpine.units.map(({ id, meaning, order, boundary }) => ({ id, meaning, order, boundary })),
    semanticUnits.map(({ id, meaning, order, boundary }) => ({ id, meaning, order, boundary }))
  );
}
assert.deepEqual(result.sharedContentMaster, sharedMaster);
assert.equal(result.platformRuns.length, 2);

const scopedCaptured = [];
const scopedResult = await runUnifiedStagedContentPlanning({ project, mechanismDecision, sourcePlan }, {
  now: () => "2026-08-09T00:00:00.000Z",
  serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: true },
  buildSharedContentMaster: async () => clone(sharedMaster),
  buildPlatformBrief: async ({ platform, sharedContentMasterRef }) => ({
    id: `brief:${platform}:scoped`, platform, accountId: project.accounts[platform], sharedContentMasterRef: clone(sharedContentMasterRef),
    brief: { designDna: clone(designDna), designDnaRef: clone(designDnaRef) }
  }),
  executeSkillStep: async ({ platform, input }) => {
    scopedCaptured.push({ platform, input: clone(input) });
    return { id: `outline:${platform}:scoped`, outline_id: `outline:${platform}:scoped`, platform, sections: [{ id: "S1", section_id: "S1", role: "method" }] };
  },
  executeServiceStep: async () => { throw new Error("scoped planning must not execute service steps"); },
  executeAtomicSkillActivity: async () => { throw new Error("scoped planning must not execute writer steps"); }
}, { targetPlatform: "xiaohongshu" });
assert.equal(scopedCaptured.length, 1, "XHS-scoped planning must invoke exactly one outline Skill");
assert.equal(scopedCaptured[0].platform, "xiaohongshu");
assert.equal(scopedResult.platformRuns.length, 1);
assert.equal(scopedResult.platformRuns[0].platform, "xiaohongshu");
assert.equal(scopedCaptured.some((item) => item.platform === "wechat"), false, "XHS planning must make zero WeChat outline calls");

const wechatScopedCaptured = [];
const wechatScopedResult = await runUnifiedStagedContentPlanning({ project, mechanismDecision, sourcePlan }, {
  now: () => "2026-08-09T00:00:00.000Z",
  serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: true },
  buildSharedContentMaster: async () => clone(sharedMaster),
  buildPlatformBrief: async ({ platform, sharedContentMasterRef }) => ({
    id: `brief:${platform}:scoped`, platform, accountId: project.accounts[platform], sharedContentMasterRef: clone(sharedContentMasterRef),
    brief: { tone: "analytical" }
  }),
  executeSkillStep: async ({ platform, input }) => {
    wechatScopedCaptured.push({ platform, input: clone(input) });
    return { id: `outline:${platform}:scoped`, outline_id: `outline:${platform}:scoped`, platform, sections: [{ id: "S1", section_id: "S1", role: "method" }] };
  },
  executeServiceStep: async () => { throw new Error("scoped planning must not execute service steps"); },
  executeAtomicSkillActivity: async () => { throw new Error("scoped planning must not execute writer steps"); }
}, { targetPlatform: "wechat" });
assert.deepEqual(wechatScopedCaptured.map((item) => item.platform), ["wechat"], "WeChat-scoped planning must invoke only its outline Skill");
assert.deepEqual(wechatScopedResult.platformRuns.map((item) => item.platform), ["wechat"]);
assert.equal(wechatScopedCaptured.some((item) => item.platform === "xiaohongshu"), false, "WeChat planning must make zero XHS outline calls");

console.log(JSON.stringify({
  status: "outline-skill-input-closure-self-test passed", fixtures: ["generic-non-four-unit"], formalPlanningSkillInvocations: 3,
  writerCalls: 0, realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0,
  platformWrites: 0, publicationWrites: 0, feedbackWrites: 0
}, null, 2));
