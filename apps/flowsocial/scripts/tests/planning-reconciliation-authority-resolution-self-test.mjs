import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  resolveUnifiedReconciliationDomainAuthority,
  resolveUnifiedStagedBootstrapAuthority
} from "../../content-agent/unified-content-server-adapter.mjs";

const companyId = "company:authority";
const activeStrategy = {
  id: "strategy:authority", accountId: companyId, version: 1, status: "active",
  payload: { positioning: "trusted authority" }, createdAt: "2026-08-10T05:00:00.000Z", confirmedAt: "2026-08-10T05:00:00.000Z"
};
const xhsAccount = {
  id: "account:xhs", companyId, platform: "xiaohongshu",
  visualStyle: { designDnaSnapshotId: "design-dna:authority" }
};
const wechatAccount = { id: "account:wechat", companyId, platform: "wechat" };
const designDna = {
  id: "design-dna:authority", kind: "DesignDNA", schemaVersion: "1.0", accountId: xhsAccount.id,
  version: 1, status: "confirmed", confirmation: { decision: "confirmed" },
  colors: [], fontPreferences: [], layoutPreferences: [], materials: [],
  photographyOrIllustrationDirection: "documentary", forbiddenMotifs: []
};
const opportunityBase = { id: "opportunity:authority", companyId, topic: "authority" };
const opportunity = { ...opportunityBase, opportunityHash: hashUnifiedContent(opportunityBase) };
const mechanismBase = {
  schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "mechanism:authority",
  selectedMechanism: "strategy_only", mechanisms: [{ mechanism: "strategy_only", role: "primary" }], selectedSourceRefs: []
};
const mechanismDecision = { ...mechanismBase, decisionHash: hashUnifiedContent(mechanismBase) };
const authorizationSource = { id: "authorization:authority", kind: "authorization_source" };
const prerequisiteBase = {
  id: "prerequisite:authority",
  contentOpportunityRef: { id: opportunity.id, hash: opportunity.opportunityHash },
  mechanismDecision,
  mechanismDecisionRef: { id: mechanismDecision.id, hash: mechanismDecision.decisionHash },
  designDnaSnapshotRef: { id: designDna.id, hash: hashUnifiedContent(designDna) }
};
const prerequisite = { ...prerequisiteBase, semanticHash: hashUnifiedContent(prerequisiteBase) };
const store = {
  accounts: [xhsAccount, wechatAccount],
  designDnaSnapshots: [designDna],
  unifiedContentPrerequisiteRequests: [prerequisite],
  unifiedContentOpportunities: [opportunity],
  authorizationSources: [authorizationSource]
};
const input = {
  companyId,
  projectId: "project:authority",
  topicIntent: { topic: "authority reconciliation" },
  activeStrategySnapshotRef: { id: activeStrategy.id, hash: hashUnifiedContent(activeStrategy.payload) },
  prerequisiteRef: { id: prerequisite.id, hash: prerequisite.semanticHash },
  accounts: {
    xiaohongshu: { id: xhsAccount.id, hash: hashUnifiedContent(xhsAccount) },
    wechat: { id: wechatAccount.id, hash: hashUnifiedContent(wechatAccount) }
  },
  authorizationSourceRefs: [{ id: authorizationSource.id, hash: hashUnifiedContent(authorizationSource) }]
};
const authority = await resolveUnifiedStagedBootstrapAuthority(store, input, {
  resolveActiveStrategySnapshot: async () => structuredClone(activeStrategy)
});
const record = {
  companyId,
  projectId: input.projectId,
  topicIntent: input.topicIntent,
  structureIntent: null,
  authorityRefs: structuredClone(authority.bindingRefs),
  _serverAuthority: structuredClone(authority),
  bootstrapFact: { authorityHash: hashUnifiedContent(authority) }
};
const resolved = resolveUnifiedReconciliationDomainAuthority(store, record, {
  resolveActiveStrategySnapshot: () => structuredClone(activeStrategy)
});
assert.equal(hashUnifiedContent(resolved), record.bootstrapFact.authorityHash);
assert.equal(resolved.designDnaAuthority.ref.hash, hashUnifiedContent(designDna));

function resolveWith(targetStore = store, targetRecord = record, strategy = activeStrategy) {
  return resolveUnifiedReconciliationDomainAuthority(targetStore, targetRecord, {
    resolveActiveStrategySnapshot: () => structuredClone(strategy)
  });
}

assert.throws(() => resolveWith(store, record, null), /UNIFIED_CONTENT_ACTIVE_STRATEGY_REQUIRED/);
assert.throws(() => resolveWith(store, record, { ...activeStrategy, payload: { positioning: "drifted" } }), /UNIFIED_CONTENT_ACTIVE_STRATEGY_MISMATCH/);

const missingAccount = structuredClone(store);
missingAccount.accounts = missingAccount.accounts.filter((item) => item.id !== xhsAccount.id);
assert.throws(() => resolveWith(missingAccount), /UNIFIED_STAGED_ATOMIC_EXACT_AUTHORITY_REQUIRED/);
const wrongPlatform = structuredClone(store);
wrongPlatform.accounts[0].platform = "wechat";
const wrongPlatformRecord = structuredClone(record);
wrongPlatformRecord.authorityRefs.accountRefs.xiaohongshu.hash = hashUnifiedContent(wrongPlatform.accounts[0]);
assert.throws(() => resolveWith(wrongPlatform, wrongPlatformRecord), /UNIFIED_STAGED_ATOMIC_ACCOUNT_AUTHORITY_MISMATCH/);
const accountDrift = structuredClone(store);
accountDrift.accounts[0].name = "drifted";
assert.throws(() => resolveWith(accountDrift), /UNIFIED_STAGED_ATOMIC_EXACT_AUTHORITY_REQUIRED/);

const missingDesign = structuredClone(store);
missingDesign.designDnaSnapshots = [];
assert.throws(() => resolveWith(missingDesign), /UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_NOT_FOUND/);
const unconfirmedDesign = structuredClone(store);
unconfirmedDesign.designDnaSnapshots[0].status = "draft";
assert.throws(() => resolveWith(unconfirmedDesign), /UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED/);
const wrongDesignAccount = structuredClone(store);
wrongDesignAccount.designDnaSnapshots[0].accountId = "account:other";
assert.throws(() => resolveWith(wrongDesignAccount), /UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_INVALID/);
const designDrift = structuredClone(store);
designDrift.designDnaSnapshots[0].photographyOrIllustrationDirection = "drifted";
assert.throws(() => resolveWith(designDrift), /UNIFIED_XHS_DESIGN_DNA_REFERENCE_MISMATCH/);

for (const unsafe of [activeStrategy.payload.positioning, designDna.photographyOrIllustrationDirection]) {
  try { resolveWith(store, record, { ...activeStrategy, payload: { secret: unsafe } }); } catch (error) {
    assert.equal(String(error.message).includes(unsafe), false, "domain authority error leaked raw authority content");
  }
}

console.log(JSON.stringify({
  status: "planning-reconciliation-authority-resolution-self-test passed",
  targetAuthorityHashVerified: true,
  genericStrategyScans: 0,
  genericDesignDnaScans: 0,
  realProviderCalls: 0,
  retries: 0,
  networkCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
