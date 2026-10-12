import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  confirmUnifiedStagedAtomicDualBootstrap,
  createUnifiedStagedAtomicDualBootstrap,
  resumeUnifiedStagedAtomicDualBootstrap
} from "../../content-agent/unified-atomic-multiplatform-product.mjs";
import { materializeUnifiedWriterContexts } from "../../content-agent/unified-content-server-adapter.mjs";

const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });
const flags = { unifiedContentStagedAtomicDualBootstrapV1: true };
const input = {
  requestId: "request:staged-bootstrap", idempotencyKey: "key:staged-bootstrap", companyId: "company:fixture", projectId: "project:fixture",
  topicIntent: { topic: "offline bootstrap", intent: "dual platform authority" },
  activeStrategySnapshotRef: ref("strategy:active"), prerequisiteRef: ref("prerequisite:ready"),
  accounts: { xiaohongshu: ref("account:xhs"), wechat: ref("account:wechat") },
  authorizationSourceRefs: [ref("authorization:source")]
};
const expectedBindingRefs = {
  activeStrategySnapshotRef: input.activeStrategySnapshotRef, prerequisiteRef: input.prerequisiteRef,
  accountRefs: input.accounts, authorizationSourceRefs: input.authorizationSourceRefs
};

await assert.rejects(
  () => createUnifiedStagedAtomicDualBootstrap({}, input, { featureFlags: {} }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED"
);
for (const [field, value] of [
  ["contentMaster", {}], ["brief", {}], ["outline", {}], ["writerContext", {}], ["sourcePlan", {}], ["commit", {}], ["outputFact", {}]
]) {
  await assert.rejects(
    () => createUnifiedStagedAtomicDualBootstrap({}, { ...structuredClone(input), [field]: value }, { featureFlags: flags }),
    (error) => error.code === "UNIFIED_STAGED_ATOMIC_CALLER_AUTHORITY_FORBIDDEN",
    `${field} caller injection must be rejected`
  );
}

const opportunity = {
  id: "opportunity:fixture", companyId: "company:fixture", topic: "offline bootstrap",
  contentObjective: "dual platform authority", opportunityHash: ref("opportunity:fixture").hash
};
const nativeV2DecisionBase = {
  schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "decision:native-v2", companyId: "company:fixture",
  projectInputRef: ref("project-input:fixture"), activeStrategySnapshotRef: input.activeStrategySnapshotRef,
  taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
  mechanisms: [
    { mechanism: "strategy_only", role: "primary", evaluationStatus: "evaluated", candidates: [], reason: "No authorized hotspot selected.", factPolicy: null },
    { mechanism: "hotspot", role: "not_selected", evaluationStatus: "evaluated", candidates: [], reason: "No authorized candidate.", factPolicy: "external_event_not_business_fact" }
  ],
  selectedSourceRefs: [], strategyHotspotPolicy: "optional",
  deviation: { status: "none", reason: null, confirmationEventRef: null }, decidedAt: "2026-08-07T12:00:00.000Z"
};
const nativeV2Decision = { ...nativeV2DecisionBase, decisionHash: hashUnifiedContent(nativeV2DecisionBase) };
const writerProject = {
  id: input.projectId, companyId: input.companyId, contentOpportunityRef: { id: opportunity.id, hash: opportunity.opportunityHash },
  activeStrategySnapshotRef: input.activeStrategySnapshotRef, accounts: { xiaohongshu: "account:xhs", wechat: "account:wechat" }
};
const writerPrerequisite = { projectInputRef: nativeV2Decision.projectInputRef };
const store = {
  contentTasks: [{ id: "legacy-task" }], publications: [{ id: "legacy-publication" }], deliveries: [{ id: "legacy-delivery" }],
  unifiedContentOpportunities: [opportunity],
  accounts: [
    { id: "account:xhs", companyId: "company:fixture", platform: "xiaohongshu", accountIdentity: { subjectType: "company_official" } },
    { id: "account:wechat", companyId: "company:fixture", platform: "wechat", accountIdentity: { subjectType: "company_official" } }
  ],
  accountStrategySnapshots: [
    { id: "strategy:xhs", companyId: "company:fixture", socialAccountId: "account:xhs", status: "active", payload: { matrixRole: "discovery", platformPlaybook: { role: "cold_start" } } },
    { id: "strategy:wechat", companyId: "company:fixture", socialAccountId: "account:wechat", status: "active", payload: { matrixRole: "authority", platformPlaybook: { role: "professional_trust" } } }
  ]
};
let planningCalls = 0;
const dependencies = {
  featureFlags: flags, now: () => "2026-08-07T12:00:00.000Z",
  planBootstrap: async () => {
    const writerContexts = materializeUnifiedWriterContexts(store, writerProject, nativeV2Decision, writerPrerequisite);
    assert.equal(writerContexts.xiaohongshu.creative_mechanism, "checklist");
    assert.equal(writerContexts.wechat.creative_mechanism, "framework");
    assert.equal(Object.hasOwn(store.accountStrategySnapshots[0].payload, "creativeMechanism"), false);
    assert.equal(Object.hasOwn(store.accountStrategySnapshots[1].payload, "creativeMechanism"), false);
    planningCalls += 3;
    const sharedContentMaster = { id: "master:fixture", contract: "ContentMaster@3.0", confirmedFacts: [] };
    const xhsOutline = { id: "outline:xiaohongshu", outline_id: "outline:xiaohongshu", platform: "xiaohongshu", sections: [{ id: "S1", role: "hook" }] };
    const wechatOutline = { id: "outline:wechat", outline_id: "outline:wechat", platform: "wechat", sections: [{ id: "S1", role: "hook" }] };
    const specs = [
      { capability: "build-content-master", platform: "shared", output: sharedContentMaster },
      { capability: "generate-content-outline", platform: "xiaohongshu", output: xhsOutline },
      { capability: "generate-content-outline", platform: "wechat", output: wechatOutline }
    ];
    const actualInvocations = specs.map(({ capability, platform }, index) => {
      const executionRecord = { invocationId: `runtime:${index}`, capability, platform };
      const base = { id: `invocation:${index}`, platform, capability, executionRecord };
      return { ...base, executionRecordHash: hashUnifiedContent(executionRecord), invocationHash: hashUnifiedContent(base) };
    });
    const outputFacts = specs.map(({ capability, platform, output }, index) => {
      const runtimeOutput = { status: "ready", data: output, warnings: [], blocked_reasons: [] };
      const base = { schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `fact:${index}`,
        invocationRef: { id: actualInvocations[index].id, hash: actualInvocations[index].invocationHash }, platform, capability,
        runtimeOutput, outputHash: hashUnifiedContent(runtimeOutput) };
      return { ...base, factHash: hashUnifiedContent(base) };
    });
    const planningBase = { schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", sharedContentMaster,
      sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(sharedContentMaster) }],
      platformRuns: [
        { platform: "xiaohongshu", outline: xhsOutline, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(xhsOutline) }] },
        { platform: "wechat", outline: wechatOutline, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(wechatOutline) }] }
      ] };
    return {
      authority: { bindingRefs: structuredClone(expectedBindingRefs), serverAuthorityId: "server-authority:fixture" }, actualInvocations, outputFacts,
      planning: { ...planningBase, planningHash: hashUnifiedContent(planningBase) }
    };
  }
};
const rejectedStore = structuredClone(store);
const rejectedDecision = structuredClone(nativeV2Decision);
rejectedDecision.mechanisms[0].role = "not_selected";
const rejectedBefore = structuredClone(rejectedStore);
let rejectedProviderCalls = 0;
await assert.rejects(
  () => createUnifiedStagedAtomicDualBootstrap(rejectedStore, { ...structuredClone(input), requestId: "request:rejected", idempotencyKey: "key:rejected" }, {
    ...dependencies,
    planBootstrap: async () => {
      materializeUnifiedWriterContexts(rejectedStore, writerProject, rejectedDecision, writerPrerequisite);
      rejectedProviderCalls += 3;
      throw new Error("Provider must not run");
    }
  })
);
assert.equal(rejectedProviderCalls, 0, "invalid v2 must fail before offline Provider invocation");
assert.deepEqual(rejectedStore, rejectedBefore, "invalid v2 must persist nothing");
assert.equal(rejectedStore.unifiedAtomicContentCommits, undefined, "invalid v2 must create zero Commit");
const legacyBefore = { contentTasks: structuredClone(store.contentTasks), publications: structuredClone(store.publications), deliveries: structuredClone(store.deliveries) };
const created = await createUnifiedStagedAtomicDualBootstrap(store, input, dependencies);
assert.equal(created.created, true);
assert.equal(planningCalls, 3);
assert.equal(store.unifiedAtomicContentCommits, undefined);
assert.equal(store.unifiedStagedAtomicDualBootstraps.length, 1);
assert.ok(store.unifiedStagedAtomicDualBootstraps[0].planning.invocations.every((item) => item.invocationHash));
assert.ok(store.unifiedStagedAtomicDualBootstraps[0].planning.outputFacts.every((item) => item.contract === "UnifiedSkillOutputFact@1.0"));
assert.equal(hashUnifiedContent(store.unifiedStagedAtomicDualBootstraps[0].authorityRefs), hashUnifiedContent(expectedBindingRefs));
assert.equal(created.bootstrap.state, "awaiting_outline_confirmation");
assert.equal(Object.hasOwn(created.bootstrap, "_serverAuthority"), false, "server authority must not be exposed");
assert.deepEqual({ contentTasks: store.contentTasks, publications: store.publications, deliveries: store.deliveries }, legacyBefore);

const replay = await createUnifiedStagedAtomicDualBootstrap(store, input, dependencies);
assert.equal(replay.created, false);
assert.equal(planningCalls, 3);
assert.equal(store.unifiedStagedAtomicDualBootstraps.length, 1);

const fullPlanningFixture = await dependencies.planBootstrap();
planningCalls -= 3;
const scopedInvocations = fullPlanningFixture.actualInvocations.filter((item) => item.platform !== "wechat");
const scopedOutputFacts = fullPlanningFixture.outputFacts.filter((item) => item.platform !== "wechat");
const scopedPlanningBase = {
  ...structuredClone(fullPlanningFixture.planning),
  platformRuns: fullPlanningFixture.planning.platformRuns.filter((item) => item.platform === "xiaohongshu")
};
delete scopedPlanningBase.planningHash;
const scopedInput = {
  ...structuredClone(input), requestId: "request:scoped-xhs", idempotencyKey: "key:scoped-xhs", targetPlatform: "xiaohongshu"
};
let scopedPlanningCalls = 0;
const scoped = await createUnifiedStagedAtomicDualBootstrap(store, scopedInput, {
  ...dependencies,
  planBootstrap: async (received) => {
    assert.equal(received.targetPlatform, "xiaohongshu");
    scopedPlanningCalls += 2;
    return {
      authority: structuredClone(fullPlanningFixture.authority), actualInvocations: scopedInvocations, outputFacts: scopedOutputFacts,
      planning: { ...scopedPlanningBase, planningHash: hashUnifiedContent(scopedPlanningBase) }
    };
  }
});
assert.equal(scopedPlanningCalls, 2, "platform-scoped bootstrap must contain master plus one platform outline only");
assert.equal(scoped.bootstrap.targetPlatform, "xiaohongshu");
assert.deepEqual(Object.keys(scoped.bootstrap.outlineRefs), ["xiaohongshu"]);
assert.equal(Object.hasOwn(scoped.bootstrap.outlines, "wechat"), false);
assert.equal(store.unifiedStagedAtomicDualBootstraps.length, 2);
const scopedConfirmed = confirmUnifiedStagedAtomicDualBootstrap(store, scoped.bootstrap.id, {
  actor: { type: "user", id: "human:scoped-xhs" }, confirmedAt: "2026-08-07T12:00:30.000Z",
  outlineRefs: scoped.bootstrap.outlineRefs
}, { featureFlags: flags });
assert.equal(scopedConfirmed.bootstrap.state, "confirmed");
await assert.rejects(
  () => resumeUnifiedStagedAtomicDualBootstrap(store, scoped.bootstrap.id, { idempotencyKey: scopedInput.idempotencyKey }, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_SCOPED_USE_PLATFORM_RESUME"
);
await assert.rejects(
  () => createUnifiedStagedAtomicDualBootstrap(store, { ...structuredClone(input), topicIntent: { topic: "changed", intent: "conflict" } }, dependencies),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_IDEMPOTENCY_CONFLICT"
);
await assert.rejects(
  () => resumeUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, { idempotencyKey: input.idempotencyKey }, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_OUTLINES_NOT_CONFIRMED"
);
assert.equal(store.unifiedAtomicContentCommits, undefined);

assert.throws(
  () => confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, {
    actor: { type: "service", id: "server" }, confirmedAt: "2026-08-07T12:01:00.000Z", outlineRefs: created.bootstrap.outlineRefs
  }, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_OUTLINE_CONFIRMATION_INVALID"
);
const staleRefs = structuredClone(created.bootstrap.outlineRefs);
staleRefs.wechat.hash = "0".repeat(64);
assert.throws(
  () => confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, {
    actor: { type: "user", id: "human:fixture" }, confirmedAt: "2026-08-07T12:01:00.000Z", outlineRefs: staleRefs
  }, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_OUTLINE_CONFIRMATION_STALE"
);
const confirmation = {
  actor: { type: "user", id: "human:fixture" }, confirmedAt: "2026-08-07T12:01:00.000Z", outlineRefs: created.bootstrap.outlineRefs
};
const confirmed = confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, confirmation, { featureFlags: flags });
assert.equal(confirmed.changed, true);
const confirmationReplay = confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, confirmation, { featureFlags: flags });
assert.equal(confirmationReplay.changed, false);

const rehash = (value, field) => { delete value[field]; value[field] = hashUnifiedContent(value); };
const rehashBootstrapFact = (record) => rehash(record.bootstrapFact, "factHash");
async function assertRestartTamperRejected(label, mutate) {
  const tampered = structuredClone(store);
  const record = tampered.unifiedStagedAtomicDualBootstraps[0];
  mutate(record);
  let materializerCalls = 0;
  await assert.rejects(() => resumeUnifiedStagedAtomicDualBootstrap(tampered, created.bootstrap.id, { idempotencyKey: input.idempotencyKey }, {
    featureFlags: flags, materializeBootstrapCommits: async () => { materializerCalls += 1; throw new Error("must not run"); }
  }), undefined, label);
  assert.equal(materializerCalls, 0, `${label}: tampered restart must fail before Provider/materializer`);
  assert.equal(tampered.unifiedAtomicContentCommits, undefined, `${label}: tampered restart must create zero Commit`);
}
await assertRestartTamperRejected("authority", (record) => { record._serverAuthority.serverAuthorityId = "tampered"; });
await assertRestartTamperRejected("shared master correctly rehashed children", (record) => {
  record.planning.outputs.sharedContentMaster.confirmedFacts.push("tampered");
  record.planning.serverPlanning.sharedContentMaster = structuredClone(record.planning.outputs.sharedContentMaster);
  rehash(record.planning.serverPlanning, "planningHash");
  const fact = record.planning.outputFacts.find((item) => item.platform === "shared");
  fact.runtimeOutput.data = structuredClone(record.planning.outputs.sharedContentMaster); rehash(fact, "outputHash");
  // outputHash covers runtimeOutput, not the Fact itself.
  fact.outputHash = hashUnifiedContent(fact.runtimeOutput); rehash(fact, "factHash");
  record.bootstrapFact.outputFactRefs = record.planning.outputFacts.map((item) => ({ id: item.id, hash: item.factHash })); rehashBootstrapFact(record);
});
await assertRestartTamperRejected("server planning correctly self-rehashed", (record) => {
  record.planning.serverPlanning.createdAt = "2026-08-07T12:00:01.000Z"; rehash(record.planning.serverPlanning, "planningHash");
});
await assertRestartTamperRejected("invocation correctly self-rehashed", (record) => {
  const invocation = record.planning.invocations[0]; invocation.capability = "tampered-capability";
  const invocationBase = structuredClone(invocation); delete invocationBase.executionRecordHash; delete invocationBase.invocationHash;
  invocation.invocationHash = hashUnifiedContent(invocationBase);
  const fact = record.planning.outputFacts[0]; fact.invocationRef.hash = invocation.invocationHash; rehash(fact, "factHash");
  record.bootstrapFact.invocationRefs[0].hash = invocation.invocationHash;
  record.bootstrapFact.outputFactRefs[0].hash = fact.factHash; rehashBootstrapFact(record);
});
await assertRestartTamperRejected("output fact correctly self-rehashed", (record) => {
  const fact = record.planning.outputFacts[1]; fact.runtimeOutput.data.sections[0].role = "tampered";
  fact.outputHash = hashUnifiedContent(fact.runtimeOutput); rehash(fact, "factHash");
  record.bootstrapFact.outputFactRefs[1].hash = fact.factHash; rehashBootstrapFact(record);
});
await assertRestartTamperRejected("confirmation correctly self-rehashed", (record) => {
  record.confirmation.outlineRefs.wechat.hash = "0".repeat(64); rehash(record.confirmation, "confirmationHash");
});

const restartedStore = structuredClone(store);
let restoredAuthority = null;
const beforeFailedResume = structuredClone(restartedStore);
await assert.rejects(
  () => resumeUnifiedStagedAtomicDualBootstrap(restartedStore, created.bootstrap.id, { idempotencyKey: input.idempotencyKey }, {
    featureFlags: flags,
    materializeBootstrapCommits: async (value) => {
      restoredAuthority = value.authority;
      return { xiaohongshuCommit: null, wechatCommit: null };
    }
  })
);
assert.equal(restoredAuthority.serverAuthorityId, "server-authority:fixture", "restart resume must use persisted server authority");
assert.deepEqual(restartedStore, beforeFailedResume, "failed materialization must add no partial Commit and mutate no bootstrap state");
await assert.rejects(
  () => resumeUnifiedStagedAtomicDualBootstrap(restartedStore, created.bootstrap.id, { idempotencyKey: input.idempotencyKey, outline: {} }, { featureFlags: flags }),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_CALLER_AUTHORITY_FORBIDDEN"
);

console.log(JSON.stringify({
  status: "staged-atomic-dual-bootstrap-self-test passed", formalPlanningInvocations: planningCalls,
  realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, platformWrites: 0
}, null, 2));
