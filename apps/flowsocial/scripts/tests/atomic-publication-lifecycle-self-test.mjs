import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  validateAtomicPublicationLifecycleFact,
  validatePublicationSnapshotLifecycleBinding
} from "../../content-agent/atomic-publication-lifecycle-store.mjs";

const ref = (id, seed) => ({ id, hash: seed.repeat(64) });
const publicationRef = ref("publication:one", "a");
const priorHead = ref("publication:one", "a");

function lifecycleFact(contract, semantics, idempotencyKey, claims) {
  const requestHash = hashUnifiedContent(semantics);
  const id = `atomic-publication-lifecycle:${hashUnifiedContent({ contract, requestHash, idempotencyKey }).slice(0, 24)}`;
  const base = {
    schemaVersion: "1.0", contract, id, idempotencyKey, requestHash, ...semantics,
    recordedAt: "2026-08-07T09:00:00.000Z", immutable: true, claims
  };
  return { ...base, factHash: hashUnifiedContent(base) };
}

const correction = lifecycleFact("ControlledPublicationCorrection@1.0", {
  publicationRef, previousLifecycleHeadRef: priorHead, effectivePublishedAt: "2026-08-01T00:00:00.000Z",
  evidenceRefs: [ref("evidence:correction", "b")], actorType: "user", actorId: "user:reviewer",
  method: "manual_platform_observation", observedAt: "2026-08-07T08:00:00.000Z"
}, "correction-key", { identityChanged: false, publicationMutated: false, platformActionPerformed: false });
assert.equal(validateAtomicPublicationLifecycleFact(correction), true);

const takedown = lifecycleFact("ControlledPublicationTakedown@1.0", {
  publicationRef, previousLifecycleHeadRef: { id: correction.id, hash: correction.factHash },
  action: "unpublish", actionAttemptedAt: "2026-08-07T08:10:00.000Z", outcome: "confirmed_removed",
  observedAt: "2026-08-07T08:11:00.000Z", observedAvailability: "unavailable",
  evidenceRefs: [ref("evidence:takedown", "c")], actorType: "user", actorId: "user:reviewer", method: "manual_platform_observation"
}, "takedown-key", { platformActionExecutedBySystem: false, localStateProvesPlatformRollback: false });
assert.equal(validateAtomicPublicationLifecycleFact(takedown), true);
for (const [label, mutate] of [
  ["invalid-action", (value) => { value.action = "local_flag"; }],
  ["failed-unavailable", (value) => { value.outcome = "failed"; value.observedAvailability = "unavailable"; }],
  ["unknown-available", (value) => { value.outcome = "unknown"; value.observedAvailability = "available"; }]
]) {
  const contradictory = structuredClone(takedown);
  mutate(contradictory);
  const semantics = structuredClone(contradictory);
  for (const key of ["schemaVersion", "contract", "id", "idempotencyKey", "requestHash", "recordedAt", "immutable", "claims", "factHash"]) delete semantics[key];
  contradictory.requestHash = hashUnifiedContent(semantics);
  contradictory.id = `atomic-publication-lifecycle:${hashUnifiedContent({ contract: contradictory.contract, requestHash: contradictory.requestHash, idempotencyKey: contradictory.idempotencyKey }).slice(0, 24)}`;
  delete contradictory.factHash;
  contradictory.factHash = hashUnifiedContent(contradictory);
  assert.throws(() => validateAtomicPublicationLifecycleFact(contradictory), { code: "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID" }, label);
}

const replacement = lifecycleFact("ControlledPublicationReplacement@1.0", {
  publicationRef, replacementPublicationRef: ref("publication:two", "d"),
  previousLifecycleHeadRef: { id: takedown.id, hash: takedown.factHash }, replacementPreviousLifecycleHeadRef: ref("publication:two", "d"),
  confirmedTakedownRef: { id: takedown.id, hash: takedown.factHash }, actorType: "user", actorId: "user:reviewer",
  method: "manual_platform_observation", observedAt: "2026-08-07T08:12:00.000Z"
}, "replacement-key", { oldPublicationMutated: false, newPublicationMutated: false, platformActionPerformed: false });
assert.equal(validateAtomicPublicationLifecycleFact(replacement), true);

const snapshotRef = ref("snapshot:one", "e");
const bindingBase = {
  schemaVersion: "1.0", contract: "PublicationMetricSnapshotLifecycleBinding@1.0",
  id: `atomic-publication-snapshot-lifecycle:${hashUnifiedContent({ snapshotRef, publicationRef }).slice(0, 24)}`,
  snapshotRef, publicationRef, lifecycleHeadRefAtCapture: { id: correction.id, hash: correction.factHash }, takedownRefAtCapture: null,
  effectivePublishedAtAtCapture: "2026-08-01T00:00:00.000Z", classificationAtCapture: "valid_active",
  createdAt: "2026-08-07T09:00:00.000Z", immutable: true
};
const binding = { ...bindingBase, bindingHash: hashUnifiedContent(bindingBase) };
assert.equal(validatePublicationSnapshotLifecycleBinding(binding), true);

for (const [label, mutate] of [
  ["extra-key", (value) => { value.extra = true; }],
  ["identity-change-claim", (value) => { value.claims.identityChanged = true; }],
  ["non-user", (value) => { value.actorType = "service"; }],
  ["unordered-evidence", (value) => { value.evidenceRefs = [ref("z", "f"), ref("a", "1")]; }]
]) {
  const forged = structuredClone(correction);
  mutate(forged);
  delete forged.factHash;
  forged.factHash = hashUnifiedContent(forged);
  assert.throws(() => validateAtomicPublicationLifecycleFact(forged), { code: "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID" }, label);
}

const forgedBinding = structuredClone(binding);
forgedBinding.publicationRef = ref("publication:other", "f");
delete forgedBinding.bindingHash;
forgedBinding.bindingHash = hashUnifiedContent(forgedBinding);
assert.throws(() => validatePublicationSnapshotLifecycleBinding(forgedBinding), { code: "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID" });

console.log(JSON.stringify({
  status: "atomic-publication-lifecycle-self-test passed",
  contracts: [correction.contract, takedown.contract, replacement.contract, binding.contract],
  providerCalls: 0, browserCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, platformActions: 0
}, null, 2));
