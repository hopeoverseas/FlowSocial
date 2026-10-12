import { buildPublicationTimeline, latestPerformanceSnapshot } from "./publishing-feedback.mjs";
import { normalizePerformanceSnapshot } from "./feedback-engine.mjs";
import { atomicPublicationIdentity, projectAtomicFeedbackPublications } from "./atomic-feedback-workspace-adapter.mjs";
import { validateUnifiedAtomicContentCommitV2 } from "./unified-atomic-content-commit-store.mjs";
import { validateUnifiedAtomicWechatContentCommit } from "./unified-atomic-wechat-commit.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const normalize = (value) => String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

function shingles(value, size = 2) {
  const text = normalize(value);
  if (!text) return new Set();
  if (text.length <= size) return new Set([text]);
  return new Set(Array.from({ length: text.length - size + 1 }, (_, index) => text.slice(index, index + size)));
}

function similarity(left, right) {
  const a = shingles(left);
  const b = shingles(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function taskTitle(task) {
  return task.currentContent?.post_copy?.recommended_title || task.currentContent?.recommended_title || task.ideaTitle || "";
}

function hasPublishableContent(task = {}) {
  const content = task.currentContent || task.contentPackage || {};
  return ["succeeded", "content_ready", "published"].includes(task.status)
    || Boolean(content.article_markdown || content.recommended_title || content.post_copy?.recommended_title || content.post_copy?.body || content.body);
}

export function publicationQueueStage(task = {}, publication = null, { now = new Date().toISOString() } = {}) {
  if (!publication) return hasPublishableContent(task) ? "ready_to_publish" : "needs_completion";
  if (["scheduled", "draft"].includes(publication.status)) return "ready_to_publish";
  if (publication.status === "failed") return "needs_completion";
  if (publication.status === "archived") return "complete";
  return buildPublicationTimeline(publication, { now }).maturity.queueStage;
}

function atomicCommitRef(commit) {
  return `${commit?.id || ""}::${commit?.commitHash || ""}`;
}

function atomicTitle(commit, opportunity) {
  if (commit.platform === "xiaohongshu") return commit.assemblyOutput?.post_copy?.recommended_title || commit.candidate?.title || opportunity.topic;
  return commit.materializedComponents?.article?.article?.recommended_title
    || commit.materializedComponents?.article?.recommended_title
    || opportunity.topic;
}

function atomicHistoryItems(store, { accountId, companyId, socialAccountId, now, featureFlags }) {
  const publications = projectAtomicFeedbackPublications(store, { normalizeSnapshot: normalizePerformanceSnapshot, featureFlags });
  const publicationsByCommit = publications.reduce((acc, item) => {
    const key = `${item.exactRefs.commitRef.id}::${item.exactRefs.commitRef.hash}`;
    acc.set(key, [...(acc.get(key) || []), item]);
    return acc;
  }, new Map());
  return list(store.unifiedAtomicContentCommits)
    .filter((commit) => ["UnifiedAtomicContentCommit@2.0", "UnifiedAtomicWechatContentCommit@1.0"].includes(commit?.contract))
    .flatMap((commit) => {
      if (commit.contract === "UnifiedAtomicContentCommit@2.0") validateUnifiedAtomicContentCommitV2(commit);
      else validateUnifiedAtomicWechatContentCommit(commit);
      const opportunityRef = commit.contentProjectIdentity.contentOpportunityRef;
      const opportunity = list(store.unifiedContentOpportunities).find((item) => item.id === opportunityRef.id && item.opportunityHash === opportunityRef.hash);
      if (!opportunity) throw Object.assign(new Error("ATOMIC_HISTORY_OPPORTUNITY_NOT_FOUND"), { code: "ATOMIC_HISTORY_OPPORTUNITY_NOT_FOUND", statusCode: 409, details: { commitId: commit.id } });
      const matchedPublications = publicationsByCommit.get(atomicCommitRef(commit)) || [null];
      return matchedPublications.map((publication) => {
        const timeline = publication ? buildPublicationTimeline(publication, { now }) : null;
        return {
          historyItemId: `${commit.contentProjectRef.id}:${commit.platform}:${publication?.id || "unpublished"}`,
          authority: "unified_atomic",
          immutableSource: true,
          unifiedProjectId: commit.contentProjectRef.id,
          exactRefs: {
            contentProjectRef: structuredClone(commit.contentProjectRef),
            materializedContentProjectRef: structuredClone(commit.materializedContentProjectRef),
            commitRef: { id: commit.id, hash: commit.commitHash },
            platformRunRef: structuredClone(commit.platformRunRef),
            activeStrategySnapshotRef: structuredClone(commit.contentProjectIdentity.activeStrategySnapshotRef),
            contentOpportunityRef: structuredClone(opportunityRef)
          },
          contentTaskId: null,
          contentRunId: null,
          accountId: commit.accountId,
          companyId: commit.companyId,
          socialAccountId: commit.accountId,
          platform: commit.platform,
          title: atomicTitle(commit, opportunity),
          topic: opportunity.topic,
          contentPillar: opportunity.contentPillarId || null,
          contentRole: opportunity.contentRole || null,
          audienceProblem: opportunity.audienceProblem || null,
          coreClaim: opportunity.coreClaim || opportunity.contentObjective || null,
          angle: opportunity.angle || null,
          sourceIds: [],
          status: publication ? "published" : "materialized",
          queueStage: publication ? timeline.maturity.queueStage : "needs_completion",
          createdAt: opportunity.createdAt || publication?.publishedAt || null,
          publication: publication ? {
            id: publication.id,
            authority: "unified_atomic",
            immutableSource: true,
            status: publication.status,
            url: publication.url,
            platformContentId: publication.platformContentId,
            publishedAt: publication.publishedAt,
            cycleId: publication.cycleId,
            slotId: publication.slotId,
            dueAt: Object.fromEntries(Object.entries(timeline.maturity.windows).map(([window, item]) => [window, item.dueAt])),
            maturityStatus: timeline.maturity.queueStage,
            missingFields: timeline.maturity.missingFields,
            qualityIssues: timeline.maturity.qualityIssues,
            nextAllowedAction: timeline.maturity.nextAllowedAction,
            distance: timeline.maturity.distance,
            metrics: latestPerformanceSnapshot(publication),
            timeline,
            exactRefs: structuredClone(publication.exactRefs)
          } : null
        };
      });
    })
    .filter((item) => {
      if (companyId && item.companyId !== companyId) return false;
      if (socialAccountId && item.socialAccountId !== socialAccountId) return false;
      return !accountId || item.accountId === accountId || item.companyId === accountId || item.socialAccountId === accountId;
    });
}

export function buildContentHistoryIndex(store, { accountId = null, companyId = null, socialAccountId = null, now = new Date().toISOString(), featureFlags = {} } = {}) {
  const publications = list(store.contentPublications);
  const atomicItems = atomicHistoryItems(store, { accountId, companyId, socialAccountId, now, featureFlags });
  const atomicPublicationKeys = new Set(atomicItems.filter((item) => item.publication).map((item) => atomicPublicationIdentity({
    accountId: item.socialAccountId,
    platform: item.platform,
    platformContentId: item.publication.platformContentId
  })));
  const legacyCandidates = list(store.contentTasks)
    .filter((task) => {
      const taskCompanyId = task.companyId || task.contentExecutionContext?.companyId || task.generationPayload?.companyId || null;
      const taskSocialAccountId = task.socialAccountId || task.accountId || task.contentExecutionContext?.socialAccountId || null;
      if (companyId && taskCompanyId !== companyId) return false;
      if (socialAccountId && taskSocialAccountId !== socialAccountId) return false;
      return !accountId || task.accountId === accountId || taskCompanyId === accountId || taskSocialAccountId === accountId;
    })
    .map((task) => {
      const publication = publications.find((item) => item.contentTaskId === task.id);
      const timeline = publication ? buildPublicationTimeline(publication, { now }) : null;
      return {
        historyItemId: task.id,
        authority: "legacy_content_task",
        immutableSource: false,
        unifiedProjectId: null,
        exactRefs: null,
        contentTaskId: task.id,
        contentRunId: task.contentRunId || task.contentWorkflowId || null,
        accountId: task.accountId,
        companyId: task.companyId || task.contentExecutionContext?.companyId || task.generationPayload?.companyId || null,
        socialAccountId: task.socialAccountId || task.accountId || task.contentExecutionContext?.socialAccountId || null,
        platform: task.platform,
        title: taskTitle(task),
        topic: task.contentIdentity?.topic || task.ideaTitle || "",
        contentPillar: task.contentIdentity?.contentPillar || task.contentTaskBrief?.contentPillar || null,
        contentRole: task.contentIdentity?.contentRole || task.contentTaskBrief?.contentRole || null,
        audienceProblem: task.contentIdentity?.audienceProblem || task.contentTaskBrief?.audienceProblem || null,
        coreClaim: task.contentIdentity?.coreClaim || task.contentTaskBrief?.coreClaim || task.contentMaster?.central_thesis || null,
        angle: task.contentIdentity?.angle || task.contentTaskBrief?.angle || null,
        sourceIds: task.contentIdentity?.sourceIds || [],
        status: task.status,
        queueStage: publicationQueueStage(task, publication, { now }),
        createdAt: task.createdAt,
        publication: publication ? {
          id: publication.id,
          status: publication.status,
          url: publication.url || null,
          platformContentId: publication.platformContentId || null,
          publishedAt: publication.publishedAt,
          cycleId: publication.cycleId || publication.attribution?.cycleId || null,
          slotId: publication.slotId || publication.attribution?.slotId || null,
          dueAt: Object.fromEntries(Object.entries(timeline.maturity.windows).map(([window, item]) => [window, item.dueAt])),
          maturityStatus: timeline.maturity.queueStage,
          missingFields: timeline.maturity.missingFields,
          qualityIssues: timeline.maturity.qualityIssues,
          nextAllowedAction: timeline.maturity.nextAllowedAction,
          distance: timeline.maturity.distance,
          metrics: latestPerformanceSnapshot(publication),
          timeline
        } : null
      };
    });
  const legacyItems = legacyCandidates.filter((item) => !item.publication || !atomicPublicationKeys.has(atomicPublicationIdentity({
    accountId: item.socialAccountId,
    platform: item.platform,
    platformContentId: item.publication.platformContentId
  })));
  const items = [...atomicItems, ...legacyItems];

  const clusters = [];
  for (const item of items) {
    const signature = `${item.topic}\n${item.audienceProblem}\n${item.coreClaim}`;
    const matched = clusters
      .map((cluster) => ({ cluster, score: similarity(signature, cluster.signature) }))
      .sort((left, right) => right.score - left.score)[0];
    if (matched?.score >= 0.52) {
      matched.cluster.items.push(item.historyItemId);
      matched.cluster.platforms = [...new Set([...matched.cluster.platforms, item.platform])];
    } else {
      clusters.push({ id: `cluster_${clusters.length + 1}`, label: item.topic || item.title, signature, items: [item.historyItemId], platforms: [item.platform] });
    }
  }

  const pillarCoverage = Object.entries(items.reduce((acc, item) => {
    const key = item.contentPillar || "未分类";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).map(([pillar, count]) => ({ pillar, count }));

  const queueCounts = Object.fromEntries(["needs_completion", "ready_to_publish", "awaiting_72h", "ready_for_72h", "awaiting_7d", "ready_for_7d", "mature", "data_quality_issue", "complete"].map((stage) => [stage, items.filter((item) => item.queueStage === stage).length]));
  return {
    schemaVersion: "1.4", accountId, companyId, socialAccountId, evaluatedAt: now,
    sourceSummary: {
      atomic: atomicItems.length,
      atomicPublished: atomicItems.filter((item) => item.publication).length,
      legacy: legacyItems.length,
      deduplicatedLegacy: legacyCandidates.length - legacyItems.length
    },
    items, queueCounts, clusters: clusters.map(({ signature, ...cluster }) => cluster), pillarCoverage
  };
}
