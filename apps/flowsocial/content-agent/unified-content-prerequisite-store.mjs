import {
  UNIFIED_CONTENT_CONTRACTS,
  hashUnifiedContent,
  validateContentMechanismDecision,
  validateContentMechanismDecisionV2,
  validateUnifiedContentOpportunity,
  withUnifiedContentHash
} from "./unified-content-contracts.mjs";
import { buildCanonicalUnifiedProjectInputRef, buildContentMechanismDecisionV2 } from "./source-planner.mjs";

const HASH = /^[a-f0-9]{64}$/;
const PLATFORMS = Object.freeze(["xiaohongshu", "wechat"]);

function fail(code, message = code, statusCode = 409) {
  throw Object.assign(new Error(message), { code, statusCode });
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) fail("UNIFIED_PREREQUISITE_INPUT_INVALID", `${label} is required`, 400);
  return value.trim();
}

function exactInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("UNIFIED_PREREQUISITE_INPUT_INVALID", "request object is required", 400);
  const allowed = ["companyId", "contentObjective", "hotspotEvaluation", "idempotencyKey", "topic", "wechatAccountId", "xiaohongshuAccountId"];
  const actual = Object.keys(input).sort();
  if (JSON.stringify(actual) !== JSON.stringify(allowed)) fail("UNIFIED_PREREQUISITE_INPUT_FIELDS_INVALID", `expected ${allowed.join(",")}`, 400);
}

function recordsById(store, id) {
  const roots = [store.companies, store.accounts, store.socialAccounts].filter(Array.isArray);
  return roots.flatMap((items) => items.filter((item) => item?.id === id));
}

function uniqueRecord(store, id, code) {
  const records = recordsById(store, id);
  const unique = [...new Map(records.map((item) => [hashUnifiedContent(item), item])).values()];
  if (!unique.length) fail(code, code, 404);
  if (unique.length !== 1) fail(`${code}_AMBIGUOUS`);
  return unique[0];
}

function accountRef(account) {
  return { id: account.id, hash: hashUnifiedContent(account) };
}

export function resolveConfirmedDesignDnaAuthority(store, { accountId, requestedRef = null } = {}) {
  const account = uniqueRecord(store, accountId, "UNIFIED_XHS_ACCOUNT_NOT_FOUND");
  const snapshotId = account.visualStyle?.designDnaSnapshotId;
  if (typeof snapshotId !== "string" || !snapshotId.trim()) fail("UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED");
  const matches = (Array.isArray(store.designDnaSnapshots) ? store.designDnaSnapshots : []).filter((item) => item?.id === snapshotId);
  const unique = [...new Map(matches.map((item) => [hashUnifiedContent(item), item])).values()];
  if (!unique.length) fail("UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_NOT_FOUND", undefined, 404);
  if (unique.length !== 1) fail("UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_AMBIGUOUS");
  const snapshot = unique[0];
  if (snapshot.status !== "confirmed") fail("UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED");
  if (snapshot.kind !== "DesignDNA" || snapshot.schemaVersion !== "1.0" || snapshot.accountId !== account.id
    || !Number.isInteger(snapshot.version) || snapshot.version < 1
    || snapshot.confirmation?.decision !== "confirmed"
    || !Array.isArray(snapshot.colors) || !Array.isArray(snapshot.fontPreferences)
    || !Array.isArray(snapshot.layoutPreferences) || !Array.isArray(snapshot.materials)
    || typeof snapshot.photographyOrIllustrationDirection !== "string" || !Array.isArray(snapshot.forbiddenMotifs)) {
    fail("UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_INVALID");
  }
  const ref = { id: snapshot.id, hash: hashUnifiedContent(snapshot) };
  if (requestedRef && !sameRef(requestedRef, ref)) fail("UNIFIED_XHS_DESIGN_DNA_REFERENCE_MISMATCH");
  return { ref, snapshot: structuredClone(snapshot) };
}

function strategyRef(strategy) {
  const payload = strategy.document || strategy.payload;
  if (!payload || strategy.status !== "active") fail("UNIFIED_CANONICAL_ACTIVE_STRATEGY_REQUIRED");
  return { id: strategy.id, hash: hashUnifiedContent(payload) };
}

function resolveHotspotPolicy(strategy) {
  const payload = strategy.document || strategy.payload || {};
  const value = payload.strategyHotspotPolicy
    || payload.hotspotPolicy
    || payload.contentPolicy?.hotspot
    || payload.accountStrategy?.hotspotPolicy;
  return ["required", "preferred", "optional", "disabled"].includes(value) ? value : "optional";
}

function validateHotspotEvaluation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("UNIFIED_HOTSPOT_EVALUATION_REQUIRED", "hotspotEvaluation is required", 400);
  const keys = Object.keys(value).sort();
  const expected = ["candidateRefs", "factPolicy", "reason", "status"];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) fail("UNIFIED_HOTSPOT_EVALUATION_FIELDS_INVALID", undefined, 400);
  if (!Array.isArray(value.candidateRefs)) fail("UNIFIED_HOTSPOT_CANDIDATES_INVALID", undefined, 400);
  for (const ref of value.candidateRefs) if (!ref?.id || !HASH.test(ref.hash || "")) fail("UNIFIED_HOTSPOT_CANDIDATE_REF_INVALID", undefined, 400);
  if (!['rejected', 'not_available'].includes(value.status)) fail("UNIFIED_STRATEGY_ONLY_HOTSPOT_STATUS_INVALID", undefined, 400);
  if (value.status === "not_available" && value.candidateRefs.length) fail("UNIFIED_HOTSPOT_NOT_AVAILABLE_HAS_CANDIDATES", undefined, 400);
  if (value.status === "rejected" && !value.candidateRefs.length) fail("UNIFIED_HOTSPOT_REJECTED_REQUIRES_CANDIDATES", undefined, 400);
  text(value.reason, "hotspotEvaluation.reason");
  if (value.factPolicy !== "external_event_not_business_fact") fail("UNIFIED_HOTSPOT_FACT_POLICY_INVALID", undefined, 400);
  return structuredClone(value);
}

function ensureCollections(store) {
  store.unifiedContentOpportunities ||= [];
  store.unifiedContentMechanismDecisions ||= [];
  store.unifiedContentPrerequisiteRequests ||= [];
  return store;
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function buildUnifiedProjectInputAuthority({ companyId, accounts, activeStrategySnapshotRef, contentOpportunityRef }) {
  const value = {
    schemaVersion: "1.0",
    contract: "UnifiedContentProjectInput@1.0",
    companyId,
    accounts: structuredClone(accounts),
    activeStrategySnapshotRef: structuredClone(activeStrategySnapshotRef),
    contentOpportunityRef: structuredClone(contentOpportunityRef)
  };
  return { value, ref: buildCanonicalUnifiedProjectInputRef(value) };
}

export function buildUnifiedProjectInputRef(input) {
  return buildUnifiedProjectInputAuthority(input).ref;
}

export function createUnifiedContentPrerequisites(store, input, {
  canonicalActiveStrategy,
  nativeMechanismDecisionV2 = false,
  now = new Date().toISOString()
} = {}) {
  exactInput(input);
  if (typeof nativeMechanismDecisionV2 !== "boolean") fail("UNIFIED_PREREQUISITE_MECHANISM_CONTRACT_INVALID", undefined, 500);
  ensureCollections(store);
  const companyId = text(input.companyId, "companyId");
  const company = uniqueRecord(store, companyId, "UNIFIED_COMPANY_NOT_FOUND");
  const xhs = uniqueRecord(store, text(input.xiaohongshuAccountId, "xiaohongshuAccountId"), "UNIFIED_XHS_ACCOUNT_NOT_FOUND");
  const wechat = uniqueRecord(store, text(input.wechatAccountId, "wechatAccountId"), "UNIFIED_WECHAT_ACCOUNT_NOT_FOUND");
  if (xhs.companyId !== companyId || xhs.platform !== "xiaohongshu") fail("UNIFIED_XHS_ACCOUNT_OWNERSHIP_MISMATCH");
  if (wechat.companyId !== companyId || wechat.platform !== "wechat") fail("UNIFIED_WECHAT_ACCOUNT_OWNERSHIP_MISMATCH");
  if (!canonicalActiveStrategy || canonicalActiveStrategy.accountId !== companyId || canonicalActiveStrategy.id !== company.activeStrategySnapshotId || canonicalActiveStrategy.status !== "active") fail("UNIFIED_CANONICAL_ACTIVE_STRATEGY_MISMATCH");
  const activeStrategySnapshotRef = strategyRef(canonicalActiveStrategy);
  const designDnaAuthority = resolveConfirmedDesignDnaAuthority(store, { accountId: xhs.id });
  const hotspot = validateHotspotEvaluation(input.hotspotEvaluation);
  const strategyHotspotPolicy = resolveHotspotPolicy(canonicalActiveStrategy);
  if (["required", "preferred"].includes(strategyHotspotPolicy)) fail("UNIFIED_STRATEGY_ONLY_REQUIRES_DEVIATION_CONFIRMATION", undefined, 409);
  const accounts = { xiaohongshu: accountRef(xhs), wechat: accountRef(wechat) };
  const semanticBase = {
    companyId,
    accounts,
    activeStrategySnapshotRef,
    designDnaSnapshotRef: designDnaAuthority.ref,
    topic: text(input.topic, "topic"),
    contentObjective: text(input.contentObjective, "contentObjective"),
    selectedMechanism: "strategy_only",
    hotspotEvaluation: hotspot,
    strategyHotspotPolicy
  };
  const requestedMechanismContract = nativeMechanismDecisionV2
    ? UNIFIED_CONTENT_CONTRACTS.mechanismDecisionV2
    : UNIFIED_CONTENT_CONTRACTS.mechanismDecision;
  const semantic = nativeMechanismDecisionV2
    ? { ...semanticBase, mechanismDecisionContract: requestedMechanismContract }
    : semanticBase;
  const semanticHash = hashUnifiedContent(semantic);
  const idempotencyKey = text(input.idempotencyKey, "idempotencyKey");
  const previousMatches = store.unifiedContentPrerequisiteRequests.filter((item) => item.idempotencyKey === idempotencyKey);
  if (nativeMechanismDecisionV2 && previousMatches.length > 1) fail("UNIFIED_PREREQUISITE_IDEMPOTENCY_AUTHORITY_DUPLICATE");
  const previous = previousMatches[0];
  if (previous) {
    if (previous.semanticHash !== semanticHash) fail("UNIFIED_PREREQUISITE_IDEMPOTENCY_CONFLICT");
    const opportunities = store.unifiedContentOpportunities.filter((item) => sameRef({ id: item.id, hash: item.opportunityHash }, previous.contentOpportunityRef));
    const mechanismDecisions = store.unifiedContentMechanismDecisions.filter((item) => sameRef({ id: item.id, hash: item.decisionHash }, previous.mechanismDecisionRef));
    if (nativeMechanismDecisionV2 && (opportunities.length !== 1 || mechanismDecisions.length !== 1)) {
      fail("UNIFIED_PREREQUISITE_IDEMPOTENCY_AUTHORITY_INVALID");
    }
    const opportunity = opportunities[0];
    const mechanismDecision = mechanismDecisions[0];
    if (!opportunity || !mechanismDecision) fail("UNIFIED_PREREQUISITE_IDEMPOTENCY_RECORD_MISSING");
    validateUnifiedContentOpportunity(opportunity);
    if (nativeMechanismDecisionV2) {
      if (opportunity.companyId !== companyId
        || opportunity.semanticHash !== semanticHash
        || opportunity.topic !== semantic.topic
        || opportunity.contentObjective !== semantic.contentObjective
        || !sameRef(opportunity.activeStrategySnapshotRef, activeStrategySnapshotRef)
        || !sameRef(opportunity.accountRefs?.xiaohongshu, accounts.xiaohongshu)
        || !sameRef(opportunity.accountRefs?.wechat, accounts.wechat)) {
        fail("UNIFIED_PREREQUISITE_OPPORTUNITY_AUTHORITY_MISMATCH");
      }
      if (previous.mechanismDecisionContract !== requestedMechanismContract
        || mechanismDecision.contract !== requestedMechanismContract
        || mechanismDecision.companyId !== companyId
        || !sameRef(previous.designDnaSnapshotRef, designDnaAuthority.ref)
        || !sameRef(mechanismDecision.activeStrategySnapshotRef, activeStrategySnapshotRef)) {
        fail("UNIFIED_PREREQUISITE_MECHANISM_AUTHORITY_MISMATCH");
      }
      validateContentMechanismDecisionV2(mechanismDecision);
      const expectedProjectInputRef = buildUnifiedProjectInputRef({
        companyId,
        accounts: { xiaohongshu: xhs.id, wechat: wechat.id },
        activeStrategySnapshotRef,
        contentOpportunityRef: previous.contentOpportunityRef
      });
      if (!sameRef(previous.projectInputRef, expectedProjectInputRef)
        || !sameRef(mechanismDecision.projectInputRef, expectedProjectInputRef)) {
        fail("UNIFIED_PREREQUISITE_PROJECT_INPUT_AUTHORITY_MISMATCH");
      }
    } else {
      validateContentMechanismDecision(mechanismDecision);
    }
    return { created: false, opportunity: structuredClone(opportunity), mechanismDecision: structuredClone(mechanismDecision), projectInputRef: structuredClone(mechanismDecision.projectInputRef), designDnaSnapshotRef: structuredClone(designDnaAuthority.ref) };
  }
  if (store.unifiedContentPrerequisiteRequests.some((item) => item.semanticHash === semanticHash)) fail("UNIFIED_PREREQUISITE_SEMANTIC_DUPLICATE");
  const opportunity = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: "UnifiedContentOpportunity@1.0",
    id: `unified_opportunity:${semanticHash.slice(0, 24)}`,
    companyId,
    accountRefs: accounts,
    activeStrategySnapshotRef,
    topic: semantic.topic,
    contentObjective: semantic.contentObjective,
    status: "ready",
    idempotencyKey,
    semanticHash,
    createdAt: now,
    opportunityHash: ""
  }, "opportunityHash");
  validateUnifiedContentOpportunity(opportunity);
  const contentOpportunityRef = { id: opportunity.id, hash: opportunity.opportunityHash };
  const projectInputAuthority = buildUnifiedProjectInputAuthority({
    companyId,
    accounts: { xiaohongshu: xhs.id, wechat: wechat.id },
    activeStrategySnapshotRef,
    contentOpportunityRef
  });
  const projectInputRef = projectInputAuthority.ref;
  let mechanismDecision;
  if (nativeMechanismDecisionV2) {
    if (hotspot.status !== "not_available") {
      fail("UNIFIED_PREREQUISITE_NATIVE_V2_HOTSPOT_SOURCE_PREIMAGE_REQUIRED", undefined, 409);
    }
    const strategyPayload = canonicalActiveStrategy.document || canonicalActiveStrategy.payload;
    mechanismDecision = buildContentMechanismDecisionV2({
      brief: {
        accountId: xhs.id,
        strategySnapshotId: activeStrategySnapshotRef.id,
        platform: "xiaohongshu",
        topic: semantic.topic
      },
      strategyContext: {
        accountId: companyId,
        companyId,
        strategySnapshotId: activeStrategySnapshotRef.id,
        strategySnapshot: structuredClone(strategyPayload),
        strategyHotspotPolicy
      },
      sourcePlan: { mode: "strategy_only", sources: [] },
      mechanismEvaluations: [
        {
          mechanism: "hotspot",
          role: "not_selected",
          evaluationStatus: "evaluated",
          candidates: [],
          reason: hotspot.reason
        },
        {
          mechanism: "strategy_only",
          role: "primary",
          evaluationStatus: "evaluated",
          candidates: [],
          reason: "selected_after_explicit_hotspot_evaluation"
        }
      ],
      projectInput: projectInputAuthority.value,
      projectInputRef,
      activeStrategySnapshotRef,
      decidedAt: now
    });
    validateContentMechanismDecisionV2(mechanismDecision);
  } else {
    const evaluated = [
      { mechanism: "hotspot", status: hotspot.status, candidateRefs: hotspot.candidateRefs, reason: hotspot.reason, factPolicy: hotspot.factPolicy },
      { mechanism: "strategy_only", status: "selected", candidateRefs: [], reason: "selected_after_explicit_hotspot_evaluation", factPolicy: null }
    ];
    mechanismDecision = withUnifiedContentHash({
      schemaVersion: "1.0",
      contract: UNIFIED_CONTENT_CONTRACTS.mechanismDecision,
      id: `mechanism_decision:${hashUnifiedContent({ projectInputRef, evaluated }).slice(0, 24)}`,
      companyId,
      projectInputRef,
      activeStrategySnapshotRef,
      evaluated,
      selectedMechanism: "strategy_only",
      selectedSourceRefs: [],
      strategyHotspotPolicy,
      deviation: { status: "none", reason: null, userConfirmationStatus: "not_required" },
      decidedAt: now,
      decisionHash: ""
    }, "decisionHash");
    validateContentMechanismDecision(mechanismDecision);
  }
  store.unifiedContentOpportunities.push(opportunity);
  store.unifiedContentMechanismDecisions.push(mechanismDecision);
  const prerequisiteBinding = {
    idempotencyKey,
    semanticHash,
    designDnaSnapshotRef: structuredClone(designDnaAuthority.ref),
    contentOpportunityRef,
    mechanismDecisionRef: { id: mechanismDecision.id, hash: mechanismDecision.decisionHash },
    projectInputRef,
    createdAt: now
  };
  if (nativeMechanismDecisionV2) prerequisiteBinding.mechanismDecisionContract = requestedMechanismContract;
  store.unifiedContentPrerequisiteRequests.push(prerequisiteBinding);
  return { created: true, opportunity: structuredClone(opportunity), mechanismDecision: structuredClone(mechanismDecision), projectInputRef, designDnaSnapshotRef: structuredClone(designDnaAuthority.ref) };
}

export function listUnifiedContentPrerequisites(store, { companyId = null } = {}) {
  ensureCollections(store);
  return {
    opportunities: store.unifiedContentOpportunities.filter((item) => !companyId || item.companyId === companyId).map((item) => structuredClone(item)),
    mechanismDecisions: store.unifiedContentMechanismDecisions.filter((item) => !companyId || item.companyId === companyId).map((item) => structuredClone(item)),
    entryOptions: store.unifiedContentPrerequisiteRequests.flatMap((binding) => {
      const opportunity = store.unifiedContentOpportunities.find((item) => sameRef(binding.contentOpportunityRef, { id: item.id, hash: item.opportunityHash }));
      const mechanismDecision = store.unifiedContentMechanismDecisions.find((item) => sameRef(binding.mechanismDecisionRef, { id: item.id, hash: item.decisionHash }));
      if (!opportunity || !mechanismDecision || (companyId && opportunity.companyId !== companyId)) return [];
      return [{
        id: `production-entry:${binding.semanticHash.slice(0, 24)}`,
        companyId: opportunity.companyId,
        topicIntent: { topic: opportunity.topic, objective: opportunity.contentObjective },
        activeStrategySnapshotRef: structuredClone(opportunity.activeStrategySnapshotRef),
        prerequisiteRef: { id: binding.idempotencyKey, hash: binding.semanticHash },
        accounts: structuredClone(opportunity.accountRefs),
        authorizationSourceRefs: [structuredClone(binding.mechanismDecisionRef)],
        mechanismDecisionRef: structuredClone(binding.mechanismDecisionRef),
        designDnaSnapshotRef: structuredClone(binding.designDnaSnapshotRef),
        createdAt: binding.createdAt
      }];
    })
  };
}
