import assert from "node:assert/strict";
import { hashUnifiedContent, withUnifiedContentHash } from "../../content-agent/unified-content-contracts.mjs";
import { resolveUnifiedWriterCreativeMechanism } from "../../content-agent/unified-content-server-adapter.mjs";

const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });

const v1 = withUnifiedContentHash({
  schemaVersion: "1.0",
  contract: "ContentMechanismDecision@1.0",
  id: "decision:v1",
  companyId: "company:fixture",
  projectInputRef: ref("input:v1"),
  activeStrategySnapshotRef: ref("strategy:active"),
  evaluated: [{ mechanism: "strategy_only", status: "selected", candidateRefs: [], reason: null, factPolicy: null }],
  selectedMechanism: "strategy_only",
  selectedSourceRefs: [],
  strategyHotspotPolicy: "optional",
  deviation: { status: "none", reason: null, userConfirmationStatus: "not_required" },
  decidedAt: "2026-08-09T00:00:00.000Z",
  decisionHash: ""
}, "decisionHash");

const v2 = withUnifiedContentHash({
  schemaVersion: "2.0",
  contract: "ContentMechanismDecision@2.0",
  id: "decision:v2",
  companyId: "company:fixture",
  projectInputRef: ref("input:v2"),
  activeStrategySnapshotRef: ref("strategy:active"),
  taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
  mechanisms: [
    { mechanism: "strategy_only", role: "primary", evaluationStatus: "evaluated", candidates: [], reason: "No authorized hotspot selected.", factPolicy: null },
    { mechanism: "hotspot", role: "not_selected", evaluationStatus: "evaluated", candidates: [], reason: "No authorized candidate.", factPolicy: "external_event_not_business_fact" }
  ],
  selectedSourceRefs: [],
  strategyHotspotPolicy: "optional",
  deviation: { status: "none", reason: null, confirmationEventRef: null },
  decidedAt: "2026-08-09T00:00:00.000Z",
  decisionHash: ""
}, "decisionHash");

assert.equal(resolveUnifiedWriterCreativeMechanism("xiaohongshu", v1), "checklist", "v1 projection must remain unchanged");
assert.equal(resolveUnifiedWriterCreativeMechanism("wechat", v1), "framework", "v1 WeChat projection must remain unchanged");

const v2Before = hashUnifiedContent(v2);
assert.equal(resolveUnifiedWriterCreativeMechanism("xiaohongshu", v2), "checklist");
assert.equal(resolveUnifiedWriterCreativeMechanism("wechat", v2), "framework");
assert.equal(hashUnifiedContent(v2), v2Before, "native v2 Decision must remain immutable");
assert.equal(resolveUnifiedWriterCreativeMechanism("xiaohongshu", v2, "account_specific_story"), "account_specific_story", "explicit account strategy must win");

for (const mutate of [
  (decision) => { decision.mechanisms = decision.mechanisms.filter((item) => item.role !== "primary"); },
  (decision) => { decision.mechanisms.push({ ...structuredClone(decision.mechanisms[0]), mechanism: "blueprint" }); },
  (decision) => { decision.mechanisms[0].mechanism = "unknown"; },
  (decision) => { decision.schemaVersion = "1.0"; }
]) {
  const invalid = structuredClone(v2);
  mutate(invalid);
  const invalidBase = structuredClone(invalid);
  delete invalidBase.decisionHash;
  invalid.decisionHash = hashUnifiedContent(invalidBase);
  assert.throws(() => resolveUnifiedWriterCreativeMechanism("xiaohongshu", invalid), undefined, "invalid v2 must fail closed");
}

assert.throws(
  () => resolveUnifiedWriterCreativeMechanism("xiaohongshu", { ...structuredClone(v2), contract: "ContentMechanismDecision@3.0" }),
  (error) => error.code === "UNIFIED_WRITER_CONTEXT_MECHANISM_DECISION_VERSION_UNSUPPORTED"
);

console.log(JSON.stringify({
  status: "writer-context-mechanism-v2-self-test passed",
  providerCalls: 0,
  persistCalls: 0,
  commitWrites: 0
}, null, 2));
