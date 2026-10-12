import { validateControlledManualPublication } from "./atomic-manual-publication-store.mjs";
import { validatePublicationMetricSnapshotV3 } from "./atomic-publication-feedback-store.mjs";
import { classifyStoredPublicationSnapshot } from "./atomic-publication-lifecycle-store.mjs";
import { validateUnifiedAtomicContentCommitV2 } from "./unified-atomic-content-commit-store.mjs";
import { validateUnifiedAtomicWechatContentCommit } from "./unified-atomic-wechat-commit.mjs";
import { validateAtomicBusinessOutcomeSnapshot } from "./atomic-business-outcome-store.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const clone = (value) => structuredClone(value);

function fail(code, details = null) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details });
}

function sameRef(left, right) {
  return Boolean(left?.id && left?.hash && right?.id && right?.hash
    && left.id === right.id && left.hash === right.hash);
}

function commitRef(commit) {
  return { id: commit?.id, hash: commit?.commitHash };
}

function resolveCommit(store, publication) {
  const matches = list(store.unifiedAtomicContentCommits)
    .filter((item) => sameRef(commitRef(item), publication.commitRef));
  if (matches.length !== 1) fail("ATOMIC_FEEDBACK_WORKSPACE_COMMIT_AMBIGUOUS", { publicationId: publication.id, matches: matches.length });
  const commit = matches[0];
  if (commit.contract === "UnifiedAtomicContentCommit@2.0") validateUnifiedAtomicContentCommitV2(commit);
  else if (commit.contract === "UnifiedAtomicWechatContentCommit@1.0") validateUnifiedAtomicWechatContentCommit(commit);
  else fail("ATOMIC_FEEDBACK_WORKSPACE_COMMIT_UNSUPPORTED", { publicationId: publication.id, contract: commit.contract });
  if (commit.companyId !== publication.companyId || commit.accountId !== publication.accountId
    || commit.platform !== publication.platform || !sameRef(commit.contentProjectRef, publication.contentProjectRef)
    || !sameRef(commit.materializedContentProjectRef, publication.materializedContentProjectRef)
    || !sameRef(commit.platformRunRef, publication.platformRunRef)) {
    fail("ATOMIC_FEEDBACK_WORKSPACE_COMMIT_SCOPE_MISMATCH", { publicationId: publication.id, commitId: commit.id });
  }
  return commit;
}

function resolveOpportunity(store, commit) {
  const ref = commit.contentProjectIdentity?.contentOpportunityRef || commit.contentProject?.contentOpportunityRef;
  const matches = list(store.unifiedContentOpportunities)
    .filter((item) => sameRef({ id: item?.id, hash: item?.opportunityHash }, ref));
  if (matches.length !== 1) fail("ATOMIC_FEEDBACK_WORKSPACE_OPPORTUNITY_AMBIGUOUS", { commitId: commit.id, matches: matches.length });
  const opportunity = matches[0];
  if (opportunity.companyId !== commit.companyId
    || (opportunity.activeStrategySnapshotRef && !sameRef(opportunity.activeStrategySnapshotRef, commit.contentProjectIdentity.activeStrategySnapshotRef))
    || typeof opportunity.topic !== "string" || !opportunity.topic.trim()
    || typeof opportunity.contentObjective !== "string" || !opportunity.contentObjective.trim()) {
    fail("ATOMIC_FEEDBACK_WORKSPACE_OPPORTUNITY_SCOPE_MISMATCH", { commitId: commit.id, opportunityId: opportunity.id });
  }
  return opportunity;
}

function resolveCycleBinding(store, publication, strategySnapshotRef) {
  const matches = [];
  for (const plan of list(store.publishingCyclePlans)) {
    for (const slot of list(plan.slots)) {
      if (slot.unifiedProjectId === publication.contentProjectRef.id) matches.push({ plan, slot });
    }
  }
  if (matches.length > 1) fail("ATOMIC_FEEDBACK_WORKSPACE_CYCLE_BINDING_AMBIGUOUS", { publicationId: publication.id, matches: matches.length });
  if (!matches.length) return null;
  const binding = matches[0];
  const boundStrategyId = binding.slot.strategySnapshotId || binding.plan.strategySnapshotId;
  if (boundStrategyId && boundStrategyId !== strategySnapshotRef.id) {
    fail("ATOMIC_FEEDBACK_WORKSPACE_CYCLE_STRATEGY_MISMATCH", {
      publicationId: publication.id,
      expectedStrategySnapshotId: strategySnapshotRef.id,
      actualStrategySnapshotId: boundStrategyId
    });
  }
  return binding;
}

function normalizedMetricPayload(snapshot) {
  const metrics = clone(snapshot.metrics);
  if (snapshot.platform === "wechat") {
    return {
      views: metrics.reads,
      likes: metrics.likes,
      saves: metrics.favorites,
      comments: metrics.comments,
      shares: metrics.shares,
      follows: metrics.newFollowers,
      unfollows: metrics.unfollows,
      leads: metrics.leads,
      conversions: metrics.conversions
    };
  }
  return metrics;
}

function projectMetricHistory(store, publication, normalizeSnapshot, featureFlags) {
  const candidates = list(store.unifiedAtomicPublicationMetricSnapshots)
    .filter((item) => item?.publicationRef?.id === publication.id || item?.publicationRef?.hash === publication.factHash);
  const exact = [];
  for (const snapshot of candidates) {
    validatePublicationMetricSnapshotV3(snapshot);
    if (!sameRef(snapshot.publicationRef, { id: publication.id, hash: publication.factHash })
      || !sameRef(snapshot.contentProjectRef, publication.contentProjectRef)
      || snapshot.workspaceId !== publication.workspaceId || snapshot.companyId !== publication.companyId
      || snapshot.accountId !== publication.accountId || snapshot.platform !== publication.platform
      || snapshot.platformContentId !== publication.canonicalPlatformContentId) {
      fail("ATOMIC_FEEDBACK_WORKSPACE_SNAPSHOT_SCOPE_MISMATCH", { publicationId: publication.id, snapshotId: snapshot.id });
    }
    const lifecycle = featureFlags.atomicPublicationLifecycleV1 === true
      ? classifyStoredPublicationSnapshot(store, publication, snapshot, { featureFlags })
      : { classification: "valid_active", bindingRef: null };
    if (["valid_active", "valid_pre_takedown"].includes(lifecycle.classification)) exact.push({ snapshot, lifecycle });
  }
  exact.sort((left, right) => left.snapshot.recordedAt.localeCompare(right.snapshot.recordedAt) || left.snapshot.id.localeCompare(right.snapshot.id));
  const revisions = new Map();
  return exact.map(({ snapshot, lifecycle }) => {
    const businessMatches = list(store.unifiedAtomicBusinessOutcomeSnapshots).filter((item) => item?.metricSnapshotRef?.id === snapshot.id && item?.metricSnapshotRef?.hash === snapshot.snapshotHash);
    if (businessMatches.length > 1) fail("ATOMIC_FEEDBACK_WORKSPACE_BUSINESS_OUTCOME_AMBIGUOUS", { publicationId: publication.id, snapshotId: snapshot.id });
    const businessOutcome = businessMatches[0] || null;
    if (businessOutcome) {
      validateAtomicBusinessOutcomeSnapshot(businessOutcome);
      if (!sameRef(businessOutcome.publicationRef, { id: publication.id, hash: publication.factHash })
        || !sameRef(businessOutcome.contentProjectRef, publication.contentProjectRef)
        || businessOutcome.workspaceId !== publication.workspaceId
        || businessOutcome.companyId !== publication.companyId
        || businessOutcome.accountId !== publication.accountId
        || businessOutcome.platform !== publication.platform) {
        fail("ATOMIC_FEEDBACK_WORKSPACE_BUSINESS_OUTCOME_SCOPE_MISMATCH", { publicationId: publication.id, snapshotId: snapshot.id });
      }
    }
    const revisionKey = `${snapshot.measurementWindow.label}:${snapshot.measurementWindow.startedAt}:${snapshot.measurementWindow.endedAt}`;
    const revision = (revisions.get(revisionKey) || 0) + 1;
    revisions.set(revisionKey, revision);
    const normalized = normalizeSnapshot({
      platform: snapshot.platform,
      metrics: normalizedMetricPayload(snapshot),
      businessOutcome: clone(businessOutcome?.outcomes || {}),
      measurementWindow: snapshot.measurementWindow.label,
      windowStartedAt: snapshot.measurementWindow.startedAt,
      windowEndedAt: snapshot.measurementWindow.endedAt,
      cutoffAt: snapshot.cutoffAt,
      collectedAt: snapshot.collectedAt,
      source: snapshot.source.kind,
      sourceMetadata: {
        authority: "unified_atomic",
        snapshotRef: { id: snapshot.id, hash: snapshot.snapshotHash },
        publicationRef: clone(snapshot.publicationRef),
        evidenceRef: clone(snapshot.source.evidenceRef || null),
        rawRowHash: snapshot.source.rawRowHash || null,
        lifecycleClassification: lifecycle.classification,
        lifecycleBindingRef: clone(lifecycle.bindingRef || null)
      },
      revision
    }, snapshot.collectedAt);
    normalized.id = snapshot.id;
    normalized.atomicSnapshotRef = { id: snapshot.id, hash: snapshot.snapshotHash };
    return normalized;
  });
}

function atomicAttribution(publication, commit, opportunity, cycleBinding) {
  const strategySnapshotRef = commit.contentProjectIdentity.activeStrategySnapshotRef;
  const slot = cycleBinding?.slot || {};
  const plan = cycleBinding?.plan || {};
  const writerContext = commit.authorityInputs?.writerContext || commit.candidate?.writerContext || {};
  return {
    schemaVersion: "2.0",
    authority: "unified_atomic",
    workspaceId: publication.workspaceId,
    companyId: publication.companyId,
    socialAccountId: publication.accountId,
    matrixId: null,
    rollingPlanId: plan.rollingPlanId || null,
    rollingPlanItemId: slot.rollingPlanItemId || null,
    cycleId: plan.cycleId || null,
    slotId: slot.slotId || null,
    contentOpportunityId: opportunity.id,
    effectiveStrategyId: strategySnapshotRef.id,
    strategyResolution: null,
    strategySnapshotId: strategySnapshotRef.id,
    strategySnapshotVersion: slot.strategyVersion || plan.strategyVersion || null,
    strategyDecisionRevision: null,
    strategyDecisionHash: strategySnapshotRef.hash,
    factSnapshotId: null,
    knowledgeSnapshotId: null,
    contentPatternSnapshotId: null,
    contentPatternBlueprintVersions: [],
    contentExecutionContextId: null,
    directionCardId: null,
    objectiveId: slot.objectiveId || null,
    contentFunction: slot.contentFunction || writerContext.content_function || null,
    contentPillarId: slot.contentPillarId || null,
    audienceId: slot.audienceId || null,
    topic: opportunity.topic,
    sourcePlanId: commit.usageBinding?.sourcePlanRef?.id || commit.authorityInputs?.sourcePlan?.id || null,
    sourceIdsByType: {},
    contentVersion: 1,
    selectedTitleId: null,
    finalTitle: commit.candidate?.title || commit.materializedComponents?.article?.title || null,
    titleMechanism: null,
    creativeMechanism: commit.usageBinding?.creativeMechanism?.writerContextValue || writerContext.creative_mechanism || null,
    growthMode: slot.growthMode || null,
    growthPlaybookId: slot.growthPlaybookId || null,
    validationHypothesis: slot.validationHypothesis || slot.experiment?.hypothesis || null,
    experimentPlanId: slot.experimentId || slot.experiment?.id || null,
    selectedCoverId: null,
    coverMechanism: null,
    openingMechanism: writerContext.opening_strategy || null,
    structureMechanism: writerContext.structure_strategy || null,
    primaryCta: writerContext.conversion_stage_id || null,
    publishingVariables: {
      format: slot.format || null,
      publishType: null,
      scheduledFor: slot.scheduledFor || null,
      commercial: false,
      wordCount: null
    },
    exactRefs: {
      contentProjectRef: clone(publication.contentProjectRef),
      materializedContentProjectRef: clone(publication.materializedContentProjectRef),
      commitRef: clone(publication.commitRef),
      platformRunRef: clone(publication.platformRunRef),
      publicationRef: { id: publication.id, hash: publication.factHash },
      activeStrategySnapshotRef: clone(strategySnapshotRef),
      contentOpportunityRef: { id: opportunity.id, hash: opportunity.opportunityHash }
    }
  };
}

export function atomicPublicationIdentity(publication) {
  return [publication?.accountId || "", publication?.platform || "", publication?.platformContentId || publication?.canonicalPlatformContentId || ""].join("::");
}

export function projectAtomicFeedbackPublications(store, { normalizeSnapshot, featureFlags = {} } = {}) {
  if (typeof normalizeSnapshot !== "function") fail("ATOMIC_FEEDBACK_WORKSPACE_NORMALIZER_REQUIRED");
  const publications = store.unifiedAtomicManualPublications === undefined ? [] : store.unifiedAtomicManualPublications;
  const snapshots = store.unifiedAtomicPublicationMetricSnapshots === undefined ? [] : store.unifiedAtomicPublicationMetricSnapshots;
  if (!Array.isArray(publications) || !Array.isArray(snapshots)) fail("ATOMIC_FEEDBACK_WORKSPACE_STORE_INVALID");
  return publications.map((publication) => {
    validateControlledManualPublication(publication);
    const commit = resolveCommit(store, publication);
    const opportunity = resolveOpportunity(store, commit);
    const strategySnapshotRef = commit.contentProjectIdentity.activeStrategySnapshotRef;
    const cycleBinding = resolveCycleBinding(store, publication, strategySnapshotRef);
    const metricHistory = projectMetricHistory(store, publication, normalizeSnapshot, featureFlags);
    return {
      id: publication.id,
      contract: "AtomicFeedbackWorkspacePublicationProjection@1.0",
      authority: "unified_atomic",
      immutableSource: true,
      companyId: publication.companyId,
      accountId: publication.accountId,
      socialAccountId: publication.accountId,
      contentTaskId: null,
      contentRunId: null,
      platform: publication.platform,
      platformContentId: publication.canonicalPlatformContentId,
      url: publication.canonicalPlatformUrl,
      status: "published",
      publishedAt: publication.publishedAt,
      attribution: atomicAttribution(publication, commit, opportunity, cycleBinding),
      cycleId: cycleBinding?.plan?.cycleId || null,
      slotId: cycleBinding?.slot?.slotId || null,
      metricHistory,
      latestMetrics: metricHistory.at(-1) || null,
      userFeedback: {},
      exactRefs: {
        publicationRef: { id: publication.id, hash: publication.factHash },
        contentProjectRef: clone(publication.contentProjectRef),
        commitRef: clone(publication.commitRef)
      }
    };
  });
}
