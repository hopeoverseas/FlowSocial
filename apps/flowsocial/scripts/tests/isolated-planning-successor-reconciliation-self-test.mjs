import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { createUnifiedStagedAtomicDualBootstrap, reconcileIsolatedPlanningSuccessor } from "../../content-agent/unified-atomic-multiplatform-product.mjs";

const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });
const input = { requestId: "request:isolated", idempotencyKey: "key:isolated", companyId: "company:1", projectId: "project:1",
  topicIntent: { topic: "successor" }, activeStrategySnapshotRef: ref("strategy:1"), prerequisiteRef: ref("prerequisite:1"),
  accounts: { xiaohongshu: ref("account:xhs"), wechat: ref("account:wechat") }, authorizationSourceRefs: [ref("auth:1")] };
const specs = [
  ["shared", "build-content-master", { id: "master:1", contract: "ContentMaster@3.0" }],
  ["xiaohongshu", "generate-content-outline", { id: "outline:xhs", platform: "xiaohongshu", sections: [] }],
  ["wechat", "generate-content-outline", { id: "outline:wechat", platform: "wechat", sections: [] }]
];
const invocations = specs.map(([platform, capability], index) => { const executionRecord = { index }; const base = { id: `inv:${index}`, platform, capability, executionRecord }; return { ...base, executionRecordHash: hashUnifiedContent(executionRecord), invocationHash: hashUnifiedContent(base) }; });
const facts = specs.map(([platform, capability, data], index) => { const runtimeOutput = { data }; const base = { schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `fact:${index}`, invocationRef: { id: invocations[index].id, hash: invocations[index].invocationHash }, platform, capability, runtimeOutput, outputHash: hashUnifiedContent(runtimeOutput) }; return { ...base, factHash: hashUnifiedContent(base) }; });
const planningBase = { schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", sharedContentMaster: specs[0][2], sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(specs[0][2]) }], platformRuns: specs.slice(1).map(([platform,, outline]) => ({ platform, outline, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(outline) }] })) };
const authority = { bindingRefs: { activeStrategySnapshotRef: input.activeStrategySnapshotRef, prerequisiteRef: input.prerequisiteRef, accountRefs: input.accounts, authorizationSourceRefs: input.authorizationSourceRefs }, prerequisite: { id: "prerequisite" }, authoritySources: [{ id: "auth" }] };
const source = {};
await createUnifiedStagedAtomicDualBootstrap(source, input, { featureFlags: { unifiedContentStagedAtomicDualBootstrapV1: true }, now: () => "2026-08-10T00:00:00.000Z", planBootstrap: async () => ({ authority, actualInvocations: invocations, outputFacts: facts, planning: { ...planningBase, planningHash: hashUnifiedContent(planningBase) } }) });
const original = structuredClone(source);
const target = {};
const request = { bootstrapId: source.unifiedStagedAtomicDualBootstraps[0].id, sourceRevision: "7", sourceStoreHash: "a".repeat(64), operator: { type: "operator", id: "controller" }, apply: false };
const deps = { now: () => "2026-08-10T00:01:00.000Z", resolveTargetAuthority: () => structuredClone(authority) };
const dry = reconcileIsolatedPlanningSuccessor(target, source, request, deps);
assert.equal(dry.applied, false); assert.deepEqual(target, {}); assert.equal(JSON.stringify(dry.bootstrap).includes("_serverAuthority"), false);
const applied = reconcileIsolatedPlanningSuccessor(target, source, { ...request, apply: true }, deps);
assert.equal(applied.applied, true); assert.equal(target.unifiedStagedAtomicDualBootstraps.length, 1); assert.equal(target.planningSuccessorReconciliationReceipts.length, 1);
assert.deepEqual(source, original, "source Store is immutable");
const replay = reconcileIsolatedPlanningSuccessor(target, source, { ...request, apply: true }, deps);
assert.equal(replay.idempotent, true); assert.equal(target.unifiedStagedAtomicDualBootstraps.length, 1); assert.equal(target.planningSuccessorReconciliationReceipts.length, 1);
const beforeFailure = structuredClone(target);
assert.throws(() => reconcileIsolatedPlanningSuccessor(target, source, { ...request, sourceStoreHash: "b".repeat(64), apply: true }, deps));
assert.deepEqual(target, beforeFailure);
assert.throws(() => reconcileIsolatedPlanningSuccessor({}, source, { ...request, apply: true }, { ...deps, resolveTargetAuthority: () => ({ ...authority, changed: true }) }), (error) => error.code === "UNIFIED_STAGED_ATOMIC_RECONCILIATION_TARGET_AUTHORITY_MISMATCH");
const confirmedSource = structuredClone(source); confirmedSource.unifiedStagedAtomicDualBootstraps[0].state = "confirmed";
assert.throws(() => reconcileIsolatedPlanningSuccessor({}, confirmedSource, { ...request, apply: true }, deps));
console.log(JSON.stringify({ status: "isolated-planning-successor-reconciliation-self-test passed", providerCalls: 0, retries: 0, networkCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, platformWrites: 0, publicationWrites: 0, feedbackWrites: 0 }, null, 2));
