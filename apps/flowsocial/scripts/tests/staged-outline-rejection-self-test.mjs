import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  confirmUnifiedStagedAtomicDualBootstrap,
  createUnifiedStagedAtomicDualBootstrap,
  rejectUnifiedStagedAtomicDualBootstrap,
  resumeUnifiedStagedAtomicDualBootstrap
} from "../../content-agent/unified-atomic-multiplatform-product.mjs";

const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });
const flags = { unifiedContentStagedAtomicDualBootstrapV1: true };
const baseInput = {
  requestId: "request:outline-rejection:1", idempotencyKey: "key:outline-rejection:1",
  companyId: "company:fixture", projectId: "project:fixture",
  topicIntent: { topic: "offline outline review", intent: "explicit user rejection" },
  activeStrategySnapshotRef: ref("strategy:active"), prerequisiteRef: ref("prerequisite:ready"),
  accounts: { xiaohongshu: ref("account:xhs"), wechat: ref("account:wechat") },
  authorizationSourceRefs: [ref("authorization:source")]
};

let planningCalls = 0;
function planningResult(input) {
  const outputs = [
    { capability: "build-content-master", platform: "shared", data: { id: `master:${input.requestId}`, contract: "ContentMaster@3.0", confirmedFacts: [] } },
    { capability: "generate-content-outline", platform: "xiaohongshu", data: { id: `outline:xhs:${input.requestId}`, platform: "xiaohongshu", sections: [{ id: "S1", role: "hook" }] } },
    { capability: "generate-content-outline", platform: "wechat", data: { id: `outline:wechat:${input.requestId}`, platform: "wechat", sections: [{ id: "S1", role: "opening" }] } }
  ];
  const actualInvocations = outputs.map(({ capability, platform }, index) => {
    const executionRecord = { invocationId: `runtime:${input.requestId}:${index}`, capability, platform };
    const base = { id: `invocation:${input.requestId}:${index}`, platform, capability, executionRecord };
    return { ...base, executionRecordHash: hashUnifiedContent(executionRecord), invocationHash: hashUnifiedContent(base) };
  });
  const outputFacts = outputs.map(({ capability, platform, data }, index) => {
    const runtimeOutput = { status: "ready", data, warnings: [], blocked_reasons: [] };
    const base = {
      schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `fact:${input.requestId}:${index}`,
      invocationRef: { id: actualInvocations[index].id, hash: actualInvocations[index].invocationHash },
      platform, capability, runtimeOutput, outputHash: hashUnifiedContent(runtimeOutput)
    };
    return { ...base, factHash: hashUnifiedContent(base) };
  });
  const planningBase = {
    schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0",
    sharedContentMaster: outputs[0].data,
    sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(outputs[0].data) }],
    platformRuns: [
      { platform: "xiaohongshu", outline: outputs[1].data, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(outputs[1].data) }] },
      { platform: "wechat", outline: outputs[2].data, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(outputs[2].data) }] }
    ]
  };
  return {
    authority: {
      bindingRefs: {
        activeStrategySnapshotRef: input.activeStrategySnapshotRef, prerequisiteRef: input.prerequisiteRef,
        accountRefs: input.accounts, authorizationSourceRefs: input.authorizationSourceRefs
      },
      serverAuthorityId: `server-authority:${input.requestId}`
    },
    actualInvocations, outputFacts,
    planning: { ...planningBase, planningHash: hashUnifiedContent(planningBase) }
  };
}
const dependencies = {
  featureFlags: flags,
  now: () => "2026-08-09T01:00:00.000Z",
  planBootstrap: async (input) => { planningCalls += 3; return planningResult(input); }
};

const store = {};
const created = await createUnifiedStagedAtomicDualBootstrap(store, structuredClone(baseInput), dependencies);
assert.equal(planningCalls, 3);
assert.equal(created.bootstrap.state, "awaiting_outline_confirmation");
const storedBeforeRejection = structuredClone(store.unifiedStagedAtomicDualBootstraps[0]);
const protectedBefore = {
  authority: storedBeforeRejection._serverAuthority,
  planning: storedBeforeRejection.planning,
  outlineRefs: storedBeforeRejection.outlineRefs,
  bootstrapFact: storedBeforeRejection.bootstrapFact
};
const decision = {
  actor: { type: "user", id: "human:reviewer" }, decidedAt: "2026-08-09T01:01:00.000Z",
  outlineRefs: created.bootstrap.outlineRefs, reasonCode: "NEEDS_REVISION",
  explanation: "The platform outlines need a different emphasis before drafting."
};

let persistCalls = 0;
let materializerCalls = 0;
const beforeInvalid = structuredClone(store);
assert.throws(
  () => rejectUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, { ...structuredClone(decision), actor: { type: "service", id: "server" } }, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_INVALID"
);
const staleDecision = structuredClone(decision);
staleDecision.outlineRefs.wechat.hash = "0".repeat(64);
assert.throws(
  () => rejectUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, staleDecision, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_STALE"
);
assert.deepEqual(store, beforeInvalid, "invalid rejection must not mutate the temporary Store");

const rejected = rejectUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, decision, { featureFlags: flags });
if (rejected.changed) persistCalls += 1;
assert.equal(rejected.changed, true);
assert.equal(rejected.bootstrap.state, "rejected");
assert.equal(rejected.bootstrap.reviewDecision.contract, "OutlineReviewDecision@1.0");
assert.equal(rejected.bootstrap.reviewDecision.schemaVersion, "1.0");
assert.equal(rejected.bootstrap.reviewDecision.actor.id, decision.actor.id);
assert.equal(rejected.bootstrap.reviewDecision.decidedAt, decision.decidedAt);
assert.deepEqual(rejected.bootstrap.reviewDecision.outlineRefs, created.bootstrap.outlineRefs);
assert.deepEqual(rejected.bootstrap.reviewDecision.rejectedBootstrapRef, created.bootstrap.bootstrapFact.bootstrapRef);
const decisionBase = structuredClone(rejected.bootstrap.reviewDecision);
delete decisionBase.decisionHash;
assert.equal(rejected.bootstrap.reviewDecision.decisionHash, hashUnifiedContent(decisionBase));
const rejectedRecord = store.unifiedStagedAtomicDualBootstraps[0];
assert.deepEqual({
  authority: rejectedRecord._serverAuthority,
  planning: rejectedRecord.planning,
  outlineRefs: rejectedRecord.outlineRefs,
  bootstrapFact: rejectedRecord.bootstrapFact
}, protectedBefore, "rejection must not rewrite persisted planning authority or evidence");
assert.equal(store.unifiedAtomicContentCommits, undefined);

const storeAfterRejection = structuredClone(store);
const replay = rejectUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, decision, { featureFlags: flags });
if (replay.changed) persistCalls += 1;
assert.equal(replay.changed, false);
assert.deepEqual(store, storeAfterRejection, "semantic replay must perform zero duplicate writes");
assert.equal(persistCalls, 1, "only the first rejection would request Server persistence");

for (const conflicting of [
  { ...structuredClone(decision), actor: { type: "user", id: "human:other" } },
  { ...structuredClone(decision), decidedAt: "2026-08-09T01:01:01.000Z" },
  staleDecision,
  { ...structuredClone(decision), reasonCode: "WRONG_STRUCTURE" },
  { ...structuredClone(decision), explanation: "Different explanation." }
]) {
  assert.throws(
    () => rejectUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, conflicting, { featureFlags: flags }),
    (error) => error.code === "UNIFIED_STAGED_ATOMIC_OUTLINE_REJECTION_CONFLICT"
  );
}
assert.throws(
  () => confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, {
    actor: decision.actor, confirmedAt: "2026-08-09T01:02:00.000Z", outlineRefs: created.bootstrap.outlineRefs
  }, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_REJECTED"
);
await assert.rejects(
  () => resumeUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, { idempotencyKey: baseInput.idempotencyKey }, {
    featureFlags: flags,
    materializeBootstrapCommits: async () => { materializerCalls += 1; throw new Error("must not run"); }
  }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_REJECTED"
);
assert.equal(materializerCalls, 0);
assert.equal(store.unifiedAtomicContentCommits, undefined);

const successorInput = {
  ...structuredClone(baseInput), requestId: "request:outline-rejection:2", idempotencyKey: "key:outline-rejection:2",
  supersedesBootstrapRef: rejected.bootstrap.reviewDecision.rejectedBootstrapRef
};
const successor = await createUnifiedStagedAtomicDualBootstrap(store, successorInput, dependencies);
assert.deepEqual(successor.bootstrap.supersedesBootstrapRef, rejected.bootstrap.reviewDecision.rejectedBootstrapRef);
assert.deepEqual(successor.bootstrap.bootstrapFact.supersedesBootstrapRef, rejected.bootstrap.reviewDecision.rejectedBootstrapRef);
assert.equal(successor.bootstrap.state, "awaiting_outline_confirmation");
assert.equal(planningCalls, 6);

for (const [label, invalidRef] of [
  ["unknown", ref("staged-atomic-bootstrap:unknown")],
  ["pending", successor.bootstrap.bootstrapFact.bootstrapRef]
]) {
  const callsBefore = planningCalls;
  await assert.rejects(
    () => createUnifiedStagedAtomicDualBootstrap(store, {
      ...structuredClone(baseInput), requestId: `request:invalid:${label}`, idempotencyKey: `key:invalid:${label}`,
      supersedesBootstrapRef: invalidRef
    }, dependencies),
    (error) => ["UNIFIED_STAGED_ATOMIC_SUPERSEDED_BOOTSTRAP_NOT_FOUND", "UNIFIED_STAGED_ATOMIC_SUPERSEDES_BOOTSTRAP_STATE_INVALID"].includes(error.code)
  );
  assert.equal(planningCalls, callsBefore, `${label} lineage must fail before planning Provider calls`);
}
const crossProjectStore = structuredClone(store);
crossProjectStore.unifiedStagedAtomicDualBootstraps[0].projectId = "project:other";
const callsBeforeCrossProject = planningCalls;
await assert.rejects(
  () => createUnifiedStagedAtomicDualBootstrap(crossProjectStore, {
    ...structuredClone(baseInput), requestId: "request:invalid:cross-project", idempotencyKey: "key:invalid:cross-project",
    supersedesBootstrapRef: rejected.bootstrap.reviewDecision.rejectedBootstrapRef
  }, dependencies),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_SUPERSEDES_BOOTSTRAP_STATE_INVALID"
);
assert.equal(planningCalls, callsBeforeCrossProject);

const historicalStore = structuredClone(store);
const historical = historicalStore.unifiedStagedAtomicDualBootstraps[1];
delete historical.supersedesBootstrapRef;
delete historical.bootstrapFact.supersedesBootstrapRef;
const historicalFactBase = structuredClone(historical.bootstrapFact);
delete historicalFactBase.factHash;
historical.bootstrapFact.factHash = hashUnifiedContent(historicalFactBase);
const historicalReplay = await createUnifiedStagedAtomicDualBootstrap(historicalStore, successorInput, dependencies);
assert.equal(historicalReplay.created, false, "historical bootstrap without successor lineage must remain valid");

assert.throws(
  () => rejectUnifiedStagedAtomicDualBootstrap(store, successor.bootstrap.id, decision, { featureFlags: {} }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED"
);
const serverSource = await readFile(new URL("../../server.mjs", import.meta.url), "utf8");
assert.match(serverSource, /\(confirm\|reject\|resume\)/, "Server must expose the explicit reject action on the staged route");
assert.match(serverSource, /rejectUnifiedStagedAtomicDualBootstrap\(store, id, payload, \{ featureFlags: flags \}\)/);
assert.match(serverSource, /if \(result\.changed \|\| result\.created\) await unifiedContentServerDependencies\.persistStore\(store\)/,
  "Server persistence must remain conditional on a real state change");

console.log(JSON.stringify({
  status: "staged-outline-rejection-self-test passed",
  rejectionWrites: persistCalls, planningInvocations: planningCalls, materializerCalls,
  realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0,
  browserCalls: 0, imageCalls: 0, platformWrites: 0, publicationWrites: 0, feedbackWrites: 0
}, null, 2));
