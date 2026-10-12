import assert from "node:assert/strict";
import {
  appendUnifiedProductionRevision,
  appendUnifiedPromptCostApproval,
  getUnifiedProductionLifecycleState,
  reconcileUnifiedProductionCommand,
  settleUnifiedProductionCommand,
  startUnifiedProductionCommand
} from "../../contracts/unified-production-lifecycle-contract.mjs";

const hash = (character) => character.repeat(64);
const ref = (id, character) => ({ id, hash: hash(character) });
const scope = { projectId: "unified-project-fixture", platform: "wechat" };
const store = {};

const authority = appendUnifiedProductionRevision(store, { scope, id: "revision-authority", parentRevisionRef: null, changedLayers: ["authority"], sourceRef: ref("authority-source", "a"), recordedAt: "2026-08-17T00:00:00.000Z" }).revision;
const visual = appendUnifiedProductionRevision(store, { scope, id: "revision-visual", parentRevisionRef: { id: authority.id, hash: authority.revisionHash }, changedLayers: ["visual"], sourceRef: ref("visual-source", "b"), recordedAt: "2026-08-17T00:01:00.000Z" }).revision;
const content = appendUnifiedProductionRevision(store, { scope, id: "revision-content", parentRevisionRef: { id: visual.id, hash: visual.revisionHash }, changedLayers: ["content"], sourceRef: ref("content-source", "c"), recordedAt: "2026-08-17T00:02:00.000Z" }).revision;
assert.deepEqual(content.invalidatedLayers, ["content", "delivery"], "a copy edit must not invalidate visual facts");

const approval = appendUnifiedPromptCostApproval(store, { scope, id: "approval-visual", visualRevisionRef: { id: visual.id, hash: visual.revisionHash }, promptPlanRef: ref("prompt-plan", "d"), costPlanRef: ref("cost-plan", "e"), decision: "approved", decidedBy: "user:reviewer", decidedAt: "2026-08-17T00:03:00.000Z" }).approval;
let state = getUnifiedProductionLifecycleState(store, scope);
assert.equal(state.promptCostApproval.id, approval.id, "copy-only revisions retain the current visual approval");

const visual2 = appendUnifiedProductionRevision(store, { scope, id: "revision-visual-2", parentRevisionRef: { id: content.id, hash: content.revisionHash }, changedLayers: ["visual"], sourceRef: ref("visual-source-2", "f"), recordedAt: "2026-08-17T00:04:00.000Z" }).revision;
state = getUnifiedProductionLifecycleState(store, scope);
assert.equal(state.promptCostApproval, null, "a changed visual revision makes the old prompt/cost approval stale");
assert.ok(state.blockers.includes("current_prompt_cost_approval_required"));

const started = startUnifiedProductionCommand(store, { scope, id: "command-1", commandKind: "local-visual-production", versionRef: { id: visual2.id, hash: visual2.revisionHash }, idempotencyKey: "visual-production:fixture:1", recordedAt: "2026-08-17T00:05:00.000Z" });
assert.equal(started.created, true);
assert.equal(startUnifiedProductionCommand(store, { scope, id: "command-1", commandKind: "local-visual-production", versionRef: { id: visual2.id, hash: visual2.revisionHash }, idempotencyKey: "visual-production:fixture:1", recordedAt: "2026-08-17T00:05:00.000Z" }).created, false, "same idempotency identity is replay-safe");
settleUnifiedProductionCommand(store, { scope, id: "command-1", state: "unknown_effect", effectRef: null, recordedAt: "2026-08-17T00:06:00.000Z" });
assert.equal(store.unifiedProductionCommands.length, 2, "command settlement must append history instead of replacing the pending fact");
assert.equal(store.unifiedProductionCommands[0].state, "pending");
state = getUnifiedProductionLifecycleState(store, scope);
assert.ok(state.blockers.includes("unknown_effect_reconciliation_required"));
assert.throws(() => startUnifiedProductionCommand(store, { scope, id: "command-2", commandKind: "local-visual-production", versionRef: { id: visual2.id, hash: visual2.revisionHash }, idempotencyKey: "visual-production:fixture:1", recordedAt: "2026-08-17T00:07:00.000Z" }), /UNIFIED_PRODUCTION_COMMAND_IDEMPOTENCY_CONFLICT/);
reconcileUnifiedProductionCommand(store, { scope, id: "command-1", observedState: "not_found", observedAt: "2026-08-17T00:08:00.000Z", evidenceRef: ref("reconciliation-evidence", "1") });
assert.equal(store.unifiedProductionCommands.length, 3, "reconciliation must append a third immutable command fact");
state = getUnifiedProductionLifecycleState(store, scope);
assert.equal(state.unresolvedCommandRefs.length, 0, "unknown effects are cleared only by an explicit reconciliation fact");
assert.throws(() => appendUnifiedPromptCostApproval(store, { scope, id: "approval-invalid", visualRevisionRef: { id: content.id, hash: content.revisionHash }, promptPlanRef: ref("prompt-plan", "2"), costPlanRef: ref("cost-plan", "3"), decision: "approved", decidedBy: "user:reviewer", decidedAt: "2026-08-17T00:09:00.000Z" }), /UNIFIED_PROMPT_COST_APPROVAL_VISUAL_REVISION_REQUIRED/);
console.log(JSON.stringify({ status: "unified-production-lifecycle-contract-self-test passed", revisions: store.unifiedProductionRevisions.length, commandFacts: store.unifiedProductionCommands.length }));
