import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  validateContentMasterSemanticSpine,
  validateContentOutlineSemanticMapping,
  validateContentStructureIntent
} from "../../content-agent/unified-skill-output-contracts.mjs";
import {
  confirmUnifiedStagedAtomicDualBootstrap,
  createUnifiedStagedAtomicDualBootstrap,
  resumeUnifiedStagedAtomicDualBootstrap
} from "../../content-agent/unified-atomic-multiplatform-product.mjs";

const clone = structuredClone;
const hashObject = (value, field) => {
  const base = clone(value);
  delete base[field];
  return hashUnifiedContent(base);
};
const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });

function structureIntent({ id, structureType, required, optional = [], mode, order }) {
  const base = {
    id, structureType,
    requiredUnits: required.map(([unitId, meaning]) => ({ id: unitId, meaning, boundary: `Only address ${unitId}.` })),
    optionalUnits: optional.map(([unitId, meaning]) => ({ id: unitId, meaning, boundary: `Only address ${unitId}.` })),
    orderingPolicy: { mode, unitOrder: order }
  };
  return { ...base, intentHash: hashUnifiedContent(base) };
}

function contentMaster(intent, id = "master:fixture") {
  const declared = new Map([...intent.requiredUnits, ...intent.optionalUnits].map((unit) => [unit.id, unit]));
  const requiredIds = new Set(intent.requiredUnits.map((unit) => unit.id));
  const spineBase = {
    id: `semantic-spine:${id}`,
    structureIntentRef: { id: intent.id, hash: intent.intentHash },
    structureType: intent.structureType,
    orderingPolicy: clone(intent.orderingPolicy),
    units: intent.orderingPolicy.unitOrder.map((unitId, order) => {
      const source = declared.get(unitId);
      const base = { id: source.id, meaning: source.meaning, required: requiredIds.has(unitId), order, boundary: source.boundary };
      return { ...base, unitHash: hashUnifiedContent(base) };
    })
  };
  const base = {
    content_master_id: id,
    confirmed_facts: [], supported_interpretations: [], author_opinions: [], source_list: [],
    structureIntent: clone(intent), semanticSpine: { ...spineBase, spineHash: hashUnifiedContent(spineBase) }
  };
  return { ...base, contentMasterHash: hashUnifiedContent(base) };
}

function unitRef(master, id) {
  const unit = master.semanticSpine.units.find((item) => item.id === id);
  return { id, hash: unit?.unitHash || "0".repeat(64) };
}

function outline(master, { id, platform, sections }) {
  return {
    id, outline_id: id, schema_version: "1.0", platform, topic: "semantic fixture",
    content_promise: "Preserve the shared meaning with platform-native expression.", content_function: "authority",
    content_purpose_id: "knowledge_howto", conversion_stage_id: "consideration",
    opening_strategy: platform === "xiaohongshu" ? "fast hook" : "contextual lead",
    contentMasterRef: { id: master.content_master_id, hash: master.contentMasterHash },
    semanticSpineRef: { id: master.semanticSpine.id, hash: master.semanticSpine.spineHash },
    sections: sections.map((section, index) => ({
      section_id: `S${index + 1}`, id: `S${index + 1}`, heading: section.heading || `${platform} section ${index + 1}`,
      role: section.role || "method", objective: section.objective || "Adapt the mapped semantic unit.",
      key_points: [], claim_ids: [], boundary: "Do not add unsupported claims.",
      masterUnitRefs: (section.units || []).map((unitId) => unitRef(master, unitId)), adaptationType: section.adaptationType || "direct"
    })),
    closing_strategy: "Close in the platform's own voice.", unresolved_questions: [], confirmation_required: true
  };
}

const strictIntent = structureIntent({
  id: "structure-intent:four", structureType: "ordered_framework", mode: "strict",
  required: [["business", "Define the business problem."], ["knowledge", "Explain the knowledge model."], ["workflow", "Apply the workflow."], ["iteration", "Close the learning loop."]],
  order: ["business", "knowledge", "workflow", "iteration"]
});
const strictMaster = contentMaster(strictIntent, "master:four");
const xhsOutline = outline(strictMaster, { id: "outline:xhs:four", platform: "xiaohongshu", sections: [
  { role: "hook", units: [], adaptationType: "supplemental", heading: "先看为什么会卡住" },
  { units: ["business"] }, { units: ["knowledge"] }, { units: ["workflow"] }, { units: ["iteration"] },
  { role: "action", units: [], adaptationType: "supplemental", heading: "收藏后照着复盘" }
] });
const wechatOutline = outline(strictMaster, { id: "outline:wechat:four", platform: "wechat", sections: [
  { units: ["business"] }, { units: ["knowledge", "workflow"], adaptationType: "merge", heading: "从原理到流程" }, { units: ["iteration"] }
] });
validateContentStructureIntent(strictIntent);
validateContentMasterSemanticSpine(strictMaster, strictIntent);
validateContentOutlineSemanticMapping(xhsOutline, strictMaster);
validateContentOutlineSemanticMapping(wechatOutline, strictMaster);
assert.notEqual(xhsOutline.sections.length, wechatOutline.sections.length, "platforms may use different section counts");

const flexibleIntent = structureIntent({
  id: "structure-intent:flexible", structureType: "evidence_lens", mode: "flexible",
  required: [["claim", "State the claim."], ["evidence", "Ground the claim in evidence."]],
  optional: [["counterpoint", "Address a useful counterpoint."]], order: ["claim", "evidence", "counterpoint"]
});
const flexibleMaster = contentMaster(flexibleIntent, "master:flexible");
const flexibleOutline = outline(flexibleMaster, { id: "outline:flexible", platform: "wechat", sections: [
  { units: ["evidence"] }, { units: ["claim"] }, { role: "example", units: [], adaptationType: "supplemental" }
] });
validateContentOutlineSemanticMapping(flexibleOutline, flexibleMaster);
assert.equal(flexibleMaster.semanticSpine.units.length, 3, "generic contract must not hardcode four units");

for (const [label, mutate] of [
  ["missing required", (value) => { value.sections = value.sections.filter((section) => section.masterUnitRefs[0]?.id !== "workflow"); }],
  ["unknown unit", (value) => { value.sections[1].masterUnitRefs = [{ id: "unknown", hash: "0".repeat(64) }]; }],
  ["strict disorder", (value) => { [value.sections[1], value.sections[2]] = [value.sections[2], value.sections[1]]; }],
  ["supplemental replacement", (value) => { value.sections[3].adaptationType = "supplemental"; value.sections[3].role = "hook"; }],
  ["competing framework", (value) => { value.structureIntent = clone(strictIntent); }]
]) {
  const candidate = clone(xhsOutline);
  mutate(candidate);
  assert.throws(() => validateContentOutlineSemanticMapping(candidate, strictMaster), { code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID" }, label);
}
const staleMaster = clone(strictMaster);
staleMaster.semanticSpine.units[0].meaning = "Provider rewrote the required meaning.";
assert.throws(() => validateContentMasterSemanticSpine(staleMaster, strictIntent), { code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID" });

function planningEvidence(master, xhs, wechat) {
  const atomicMaster = { schemaVersion: "3.0", contract: "ContentMaster@3.0", id: master.content_master_id, ...clone(master) };
  const specs = [
    { capability: "build-content-master", platform: "shared", output: master, status: "success" },
    { capability: "generate-content-outline", platform: "xiaohongshu", output: xhs, status: "ready" },
    { capability: "generate-content-outline", platform: "wechat", output: wechat, status: "ready" }
  ];
  const actualInvocations = specs.map(({ capability, platform }, index) => {
    const executionRecord = { invocationId: `runtime:${index}`, capability, platform };
    const base = { id: `invocation:${index}`, platform, capability, executionRecord };
    return { ...base, executionRecordHash: hashUnifiedContent(executionRecord), invocationHash: hashUnifiedContent(base) };
  });
  const outputFacts = specs.map(({ capability, platform, output, status }, index) => {
    const runtimeOutput = { status, data: clone(output), warnings: [], blocked_reasons: [] };
    const base = { schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `fact:${index}`,
      invocationRef: { id: actualInvocations[index].id, hash: actualInvocations[index].invocationHash }, platform, capability,
      runtimeOutput, outputHash: hashUnifiedContent(runtimeOutput) };
    return { ...base, factHash: hashUnifiedContent(base) };
  });
  const planningBase = {
    schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", id: "planning:semantic",
    sharedContentMaster: atomicMaster,
    sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(atomicMaster) }],
    platformRuns: [
      { platform: "xiaohongshu", outline: clone(xhs), skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(xhs) }] },
      { platform: "wechat", outline: clone(wechat), skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(wechat) }] }
    ]
  };
  return { planning: { ...planningBase, planningHash: hashUnifiedContent(planningBase) }, actualInvocations, outputFacts };
}

const stagedInput = {
  requestId: "request:semantic", idempotencyKey: "key:semantic", companyId: "company:fixture", projectId: "project:fixture",
  topicIntent: { topic: "semantic fixture", intent: "dual platform adaptation" }, structureIntent: strictIntent,
  activeStrategySnapshotRef: ref("strategy:active"), prerequisiteRef: ref("prerequisite:ready"),
  accounts: { xiaohongshu: ref("account:xhs"), wechat: ref("account:wechat") }, authorizationSourceRefs: [ref("authorization:source")]
};
const flags = { unifiedContentStagedAtomicDualBootstrapV1: true };
const authorityRefs = {
  activeStrategySnapshotRef: stagedInput.activeStrategySnapshotRef, prerequisiteRef: stagedInput.prerequisiteRef,
  accountRefs: stagedInput.accounts, authorizationSourceRefs: stagedInput.authorizationSourceRefs,
  structureIntentRef: { id: strictIntent.id, hash: strictIntent.intentHash }
};
const store = {};
let planningCalls = 0;
const validEvidence = planningEvidence(strictMaster, xhsOutline, wechatOutline);
const dependencies = {
  featureFlags: flags, now: () => "2026-08-09T10:00:00.000Z",
  planBootstrap: async () => {
    planningCalls += 3;
    return { authority: { bindingRefs: clone(authorityRefs), serverAuthorityId: "authority:semantic" }, ...clone(validEvidence) };
  }
};
const created = await createUnifiedStagedAtomicDualBootstrap(store, stagedInput, dependencies);
assert.equal(created.created, true);
assert.equal(store.unifiedStagedAtomicDualBootstraps.length, 1);
assert.deepEqual(created.bootstrap.structureIntent, strictIntent);

const badStore = {};
let badPlanningCalls = 0;
const missingOutline = clone(xhsOutline);
missingOutline.sections = missingOutline.sections.filter((section) => section.masterUnitRefs[0]?.id !== "workflow");
await assert.rejects(
  () => createUnifiedStagedAtomicDualBootstrap(badStore, { ...clone(stagedInput), requestId: "request:bad", idempotencyKey: "key:bad" }, {
    featureFlags: flags, now: dependencies.now,
    planBootstrap: async () => {
      badPlanningCalls += 3;
      return { authority: { bindingRefs: clone(authorityRefs), serverAuthorityId: "authority:semantic" }, ...planningEvidence(strictMaster, missingOutline, wechatOutline) };
    }
  }),
  { code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID" }
);
assert.equal(badPlanningCalls, 3, "invalid Provider outputs are rejected after the planned calls");
assert.deepEqual(badStore, {}, "invalid semantic output persists nothing");

function rehashStoredOutline(record, platform) {
  const key = platform === "wechat" ? "wechatOutline" : "xiaohongshuOutline";
  const outlineValue = record.planning.outputs[key];
  const run = record.planning.serverPlanning.platformRuns.find((item) => item.platform === platform);
  run.outline = clone(outlineValue);
  run.skillRecords.find((item) => item.stepId === "outline").outputHash = hashUnifiedContent(outlineValue);
  const fact = record.planning.outputFacts.find((item) => item.platform === platform && item.capability === "generate-content-outline");
  fact.runtimeOutput.data = clone(outlineValue);
  fact.outputHash = hashUnifiedContent(fact.runtimeOutput);
  fact.factHash = hashObject(fact, "factHash");
  record.outlineRefs[platform] = { id: outlineValue.outline_id || outlineValue.id, hash: hashUnifiedContent(outlineValue) };
  record.bootstrapFact.outputFactRefs = record.planning.outputFacts.map((item) => ({ id: item.id, hash: item.factHash }));
  record.planning.serverPlanning.planningHash = hashObject(record.planning.serverPlanning, "planningHash");
  record.bootstrapFact.planningHash = hashUnifiedContent({
    serverPlanning: record.planning.serverPlanning, outputs: record.planning.outputs,
    invocations: record.planning.invocations, outputFacts: record.planning.outputFacts
  });
  record.bootstrapFact.factHash = hashObject(record.bootstrapFact, "factHash");
}

const staleConfirmStore = clone(store);
const staleConfirmRecord = staleConfirmStore.unifiedStagedAtomicDualBootstraps[0];
staleConfirmRecord.planning.outputs.xiaohongshuOutline.contentMasterRef.hash = "0".repeat(64);
rehashStoredOutline(staleConfirmRecord, "xiaohongshu");
const staleConfirmBefore = clone(staleConfirmStore);
assert.throws(() => confirmUnifiedStagedAtomicDualBootstrap(staleConfirmStore, created.bootstrap.id, {
  actor: { type: "user", id: "human:fixture" }, confirmedAt: "2026-08-09T10:01:00.000Z", outlineRefs: staleConfirmRecord.outlineRefs
}, { featureFlags: flags }), { code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID" });
assert.deepEqual(staleConfirmStore, staleConfirmBefore, "stale outline fails before confirmation persistence");

const confirmation = {
  actor: { type: "user", id: "human:fixture" }, confirmedAt: "2026-08-09T10:01:00.000Z", outlineRefs: created.bootstrap.outlineRefs
};
confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, confirmation, { featureFlags: flags });
const staleResumeStore = clone(store);
const staleResumeRecord = staleResumeStore.unifiedStagedAtomicDualBootstraps[0];
staleResumeRecord.planning.outputs.wechatOutline.semanticSpineRef.hash = "0".repeat(64);
rehashStoredOutline(staleResumeRecord, "wechat");
staleResumeRecord.confirmation.outlineRefs = clone(staleResumeRecord.outlineRefs);
staleResumeRecord.confirmation.confirmationHash = hashObject(staleResumeRecord.confirmation, "confirmationHash");
let materializerCalls = 0;
const staleResumeBefore = clone(staleResumeStore);
await assert.rejects(() => resumeUnifiedStagedAtomicDualBootstrap(staleResumeStore, created.bootstrap.id, { idempotencyKey: stagedInput.idempotencyKey }, {
  featureFlags: flags, materializeBootstrapCommits: async () => { materializerCalls += 1; throw new Error("must not run"); }
}), { code: "UNIFIED_CONTENT_SEMANTIC_SPINE_INVALID" });
assert.equal(materializerCalls, 0, "stale semantic authority fails before Commit materialization");
assert.deepEqual(staleResumeStore, staleResumeBefore);

console.log(JSON.stringify({
  status: "content-master-semantic-spine-self-test passed", fixtures: ["ordered-four-unit", "flexible-non-four-unit"],
  planningCalls, invalidPlanningCalls: badPlanningCalls, materializerCalls, realProviderCalls: 0,
  externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, platformWrites: 0
}, null, 2));
