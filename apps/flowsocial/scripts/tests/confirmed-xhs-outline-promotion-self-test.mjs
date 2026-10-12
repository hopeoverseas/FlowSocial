import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { confirmUnifiedStagedAtomicDualBootstrap, createUnifiedStagedAtomicDualBootstrap, promoteConfirmedXhsOutlineSuccessor } from "../../content-agent/unified-atomic-multiplatform-product.mjs";

const flags = { featureFlags: { unifiedContentStagedAtomicDualBootstrapV1: true } };
assert.throws(() => promoteConfirmedXhsOutlineSuccessor({}, {
  bootstrapId: "missing", sourceRevision: 171, candidate: {}, actor: { type: "user", id: "tester" },
  confirmedAt: "2026-08-12T12:00:00.000Z"
}, flags), (error) => error.code === "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_NOT_FOUND");
assert.throws(() => promoteConfirmedXhsOutlineSuccessor({ unifiedStagedAtomicDualBootstraps: "invalid" }, {
  bootstrapId: "missing", sourceRevision: 171, candidate: {}, actor: { type: "user", id: "tester" },
  confirmedAt: "2026-08-12T12:00:00.000Z"
}, flags), (error) => error.code === "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_STORE_INVALID");

const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });
const input = { requestId: "promotion-request", idempotencyKey: "promotion-key", companyId: "company", projectId: "project", topicIntent: { topic: "topic" }, activeStrategySnapshotRef: ref("strategy"), prerequisiteRef: ref("prerequisite"), accounts: { xiaohongshu: ref("xhs"), wechat: ref("wechat") }, authorizationSourceRefs: [ref("auth")] };
const xhs = { outline_id: "outline-xhs", platform: "xiaohongshu", confirmation_required: true, sections: [1, 2, 3, 4, 5, 6].map((n) => ({ section_id: `S${n}`, heading: `H${n}` })) };
const wechat = { outline_id: "outline-wechat", platform: "wechat", sections: [{ section_id: "S1", heading: "W" }] };
const plan = (request) => {
  const master = { id: "master", contract: "ContentMaster@3.0", confirmedFacts: [] };
  const outputs = [{ platform: "shared", capability: "build-content-master", data: master }, { platform: "xiaohongshu", capability: "generate-content-outline", data: xhs }, { platform: "wechat", capability: "generate-content-outline", data: wechat }];
  const invocations = outputs.map((item, i) => { const executionRecord = { invocationId: `run-${i}`, capability: item.capability, platform: item.platform }; const base = { id: `inv-${i}`, platform: item.platform, capability: item.capability, executionRecord }; return { ...base, executionRecordHash: hashUnifiedContent(executionRecord), invocationHash: hashUnifiedContent(base) }; });
  const facts = outputs.map((item, i) => { const runtimeOutput = { status: "ready", data: item.data, warnings: [], blocked_reasons: [] }; const base = { schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `fact-${i}`, invocationRef: { id: invocations[i].id, hash: invocations[i].invocationHash }, platform: item.platform, capability: item.capability, runtimeOutput, outputHash: hashUnifiedContent(runtimeOutput) }; return { ...base, factHash: hashUnifiedContent(base) }; });
  const serverPlanning = { schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", sharedContentMaster: master, sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(master) }], platformRuns: [{ platform: "xiaohongshu", outline: xhs, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(xhs) }] }, { platform: "wechat", outline: wechat, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(wechat) }] }] };
  return { authority: { bindingRefs: { activeStrategySnapshotRef: input.activeStrategySnapshotRef, prerequisiteRef: input.prerequisiteRef, accountRefs: input.accounts, authorizationSourceRefs: input.authorizationSourceRefs }, orchestrationInput: { project: { platformInputs: { xiaohongshu: {}, wechat: {} } } } }, planning: { ...serverPlanning, planningHash: hashUnifiedContent(serverPlanning) }, actualInvocations: invocations, outputFacts: facts };
};
const store = {};
const created = await createUnifiedStagedAtomicDualBootstrap(store, input, { ...flags, now: () => "2026-08-12T12:00:00.000Z", planBootstrap: async () => plan(input) });
const confirmed = confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, { actor: { type: "user", id: "tester" }, confirmedAt: "2026-08-12T12:01:00.000Z", outlineRefs: created.bootstrap.outlineRefs }, flags);
const candidate = { candidateType: "XHSOutlineReviewCandidate", reviewStatus: "awaiting_user_review", bootstrapId: confirmed.bootstrap.id, sourceRevision: 171, sourceOutlineRef: confirmed.bootstrap.outlineRefs.xiaohongshu, sourceMasterRef: { id: "master", hash: hashUnifiedContent(plan(input).planning.sharedContentMaster) }, outline: { ...xhs }, outlineHash: hashUnifiedContent(xhs) };
const promoted = promoteConfirmedXhsOutlineSuccessor(store, { bootstrapId: confirmed.bootstrap.id, sourceRevision: 171, candidate, actor: { type: "user", id: "tester" }, confirmedAt: "2026-08-12T12:02:00.000Z" }, flags);
assert.equal(promoted.bootstrap.outlines.xiaohongshu.sections.length, 6);
const successor = store.unifiedStagedAtomicDualBootstraps.at(-1);
assert.deepEqual(successor._serverAuthority.orchestrationInput.project.platformInputs.xiaohongshu.confirmedOutlineRef, successor.outlineRefs.xiaohongshu);
assert.equal(hashUnifiedContent(successor._serverAuthority), successor.bootstrapFact.authorityHash);
console.log(JSON.stringify({ status: "confirmed-xhs-outline-promotion-self-test passed", providerCalls: 0, databaseWrites: 0 }));
