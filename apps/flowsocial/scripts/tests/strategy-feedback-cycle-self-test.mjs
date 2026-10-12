import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildFeedbackWorkspace } from "../../content-agent/feedback-engine.mjs";
import { buildContentHistoryIndex } from "../../content-agent/history-index.mjs";
import { buildContentLearningInstruction, buildNextCycleContentPortfolio, evaluateCycleLearning } from "../../content-agent/next-cycle-content-portfolio.mjs";
import { recommendContentTasks } from "../../content-agent/planner.mjs";
import { recordPublication, recordPublicationMetrics } from "../../content-agent/publishing-feedback.mjs";
import { createPublishingCyclePlan } from "../../content-agent/publishing-cycle-plan.mjs";
import { adjustCycleWorkbenchSlot, confirmCycleWorkbenchPlan, saveCycleWorkbenchPlan } from "../../content-agent/cycle-workbench.mjs";
import { projectStrategyForContent } from "../../content-agent/strategy-adapter.mjs";
import {
  bindStrategyAdjustmentsToCycle,
  buildStrategyAdjustmentWorkspace,
  confirmStrategyAdjustmentDecision,
  resolveConfirmedStrategyAdjustmentInputs
} from "../../content-agent/strategy-feedback-cycle.mjs";

const companyId = "company_feedback_cycle";
const socialAccountId = "wechat_feedback_cycle";
const strategyId = "strategy_feedback_cycle_v3";
const growthPlaybookId = "wechat-authority-bridge";
const store = {
  accounts: [{ id: socialAccountId, companyId, workspaceId: "workspace_feedback", platform: "wechat", accountType: "social" }],
  contentTasks: [],
  contentRuns: [],
  contentPublications: [],
  strategySnapshots: [{ id: strategyId, status: "active", immutable: true }]
};

for (let index = 0; index < 6; index += 1) {
  const task = {
    id: `task_strategy_cycle_${index}`,
    contentRunId: `run_strategy_cycle_${index}`,
    accountId: socialAccountId,
    socialAccountId,
    companyId,
    workspaceId: "workspace_feedback",
    platform: "wechat",
    version: 1,
    ideaTitle: `模拟反馈文章 ${index + 1}`,
    currentContent: { recommended_title: `模拟反馈文章 ${index + 1}` },
    contentExecutionContext: {
      strategySnapshotId: strategyId,
      effectiveStrategyId: strategyId,
      growthPlaybookId,
      directionCard: { objectiveId: "objective_lead", contentFunction: "authority", pillarId: "pillar_method" }
    }
  };
  const run = {
    id: task.contentRunId,
    workspaceId: "workspace_feedback",
    companyId,
    socialAccountId,
    effectiveStrategyId: strategyId,
    growthPlaybookId,
    sourcePublishingCycleId: index < 3 ? "cycle_feedback_1" : "cycle_feedback_2",
    sourcePublishingSlotId: `slot_strategy_cycle_${index}`
  };
  store.contentTasks.push(task);
  store.contentRuns.push(run);
  const publishedAt = new Date(Date.UTC(2026, index < 3 ? 5 : 6, 1 + index)).toISOString();
  const publication = recordPublication(store, task, {
    platform: "wechat",
    platformContentId: `wechat_strategy_article_${index}`,
    status: "published",
    publishedAt
  });
  recordPublicationMetrics(publication, {
    views: index < 3 ? 70 : 280,
    platformMetrics: { delivered: 1000 },
    measurementWindow: "72h",
    cutoffAt: new Date(new Date(publishedAt).getTime() + 72 * 60 * 60 * 1000).toISOString(),
    source: "simulated_fixture"
  });
  recordPublicationMetrics(publication, {
    views: index < 3 ? 100 : 400,
    platformMetrics: { delivered: 1000 },
    leads: index < 2 ? 2 : 0,
    businessOutcome: index < 2 ? { qualifiedLeads: 1 } : {},
    measurementWindow: "7d",
    cutoffAt: new Date(new Date(publishedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    source: "simulated_fixture"
  });
}

const feedbackWorkspace = buildFeedbackWorkspace(store, {
  accountId: socialAccountId,
  companyId,
  socialAccountId,
  now: "2026-08-28T12:00:00.000Z"
});
assert.equal(feedbackWorkspace.outcomes.length, 6);
assert.equal(feedbackWorkspace.cycleReviews.length, 1);
assert.equal(feedbackWorkspace.cycleReviews[0].eligibleForStrategyReview, true);
assert.deepEqual(feedbackWorkspace.cycleReviews[0].cycleIds.sort(), ["cycle_feedback_1", "cycle_feedback_2"]);
assert.equal(feedbackWorkspace.strategyReviewCandidates.length, 1);
const candidate = feedbackWorkspace.strategyReviewCandidates[0];
assert.equal(candidate.repeatedBottlenecks[0].stage, "delivery_to_open");
assert.equal(candidate.businessObservedCount, 2);

const historyIndex = buildContentHistoryIndex(store, { companyId, socialAccountId, now: "2026-08-28T12:00:00.000Z" });
const beforePortfolio = structuredClone(store);
const portfolio = buildNextCycleContentPortfolio({
  feedbackWorkspace,
  historyIndex,
  strategyAdjustmentWorkspace: { decisions: [], bindings: [] },
  companyId,
  socialAccountId,
  platform: "wechat",
  activeStrategySnapshotId: strategyId,
  itemCount: 6
});
assert.deepEqual(store, beforePortfolio, "next-cycle portfolio projection must be read-only");
assert.deepEqual(portfolio.allocation.counts, { sustain: 3, repair: 2, explore: 1 });
assert.equal(portfolio.repairSignal.changeVariable, "title_value_proposition");
assert.equal(portfolio.authorityBoundary.newTopicRequiredForEverySlot, true);
assert.equal(portfolio.authorityBoundary.newBodyRequiredForEverySlot, true);
const learningInstruction = buildContentLearningInstruction(portfolio, { lane: "repair" }, { topic: "全新的公众号选题" });
assert.equal(learningInstruction.novelty.newTopicRequired, true);
assert.equal(learningInstruction.novelty.newBodyRequired, true);
assert.equal(learningInstruction.experiment.targetMetric, "openRate");
assert.equal(learningInstruction.claims.historicalContentCloned, false);

const planningPortfolio = buildNextCycleContentPortfolio({
  feedbackWorkspace,
  historyIndex,
  strategyAdjustmentWorkspace: { decisions: [], bindings: [] },
  companyId,
  socialAccountId,
  platform: "wechat",
  activeStrategySnapshotId: strategyId,
  itemCount: 5
});
const planningStrategySnapshot = {
  id: strategyId,
  version: 3,
  status: "active",
  accountId: companyId,
  socialAccountId,
  payload: {
    schemaVersion: "2.0",
    accountId: companyId,
    business: {},
    strategy: {
      audiences: [{ id: "audience_owner", name: "企业经营者", painPoints: ["内容送达后缺少明确阅读动机"] }],
      objectives: [],
      contentSystem: {
        pillars: [{
          id: "pillar_method",
          name: "企业经营方法",
          typicalProblems: ["复杂方案难以形成行动判断", "团队经验无法稳定复用", "客户需求缺少统一识别标准", "项目复盘不能转化为新动作", "业务资料分散且难以检索"]
        }],
        portfolio: { discovery: 0, authority: 60, proof: 20, solution: 20, action: 0 }
      },
      platformPlaybooks: { wechat: { role: "专业信任与持续经营" } }
    }
  }
};
const strategyContext = projectStrategyForContent(planningStrategySnapshot);
const freshRecommendations = recommendContentTasks({
  strategyContext,
  platform: "wechat",
  history: historyIndex.items,
  contentPortfolio: planningPortfolio,
  limit: 5
});
assert.equal(freshRecommendations.length, 5);
assert.equal(new Set(freshRecommendations.map((item) => item.topic)).size, freshRecommendations.length);
assert.ok(freshRecommendations.every((item) => !historyIndex.items.some((historyItem) => historyItem.topic === item.topic)));
assert.ok(freshRecommendations.every((item) => item.duplication.hardGatePassed && !["block", "rework"].includes(item.duplication.decision)));
assert.ok(freshRecommendations.every((item) => item.duplication.thresholds?.warn === 0.42));
assert.ok(freshRecommendations.every((item) => item.contentLearningInstruction?.novelty?.newTopicRequired === true));
assert.ok(freshRecommendations.every((item) => item.generationPayload.contentLearningInstruction?.novelty?.newBodyRequired === true));
assert.ok(freshRecommendations.some((item) => item.learningLane === "repair" && item.contentLearningInstruction.experiment.targetMetric === "openRate"));
const xhsPlatformVariants = recommendContentTasks({ strategyContext, platform: "xiaohongshu", history: historyIndex.items, contentPortfolio: planningPortfolio, limit: 3 });
assert.ok(xhsPlatformVariants.every((item) => item.crossPlatformReusePolicy === "shared_mother_topic_distinct_platform_angle"));
assert.ok(xhsPlatformVariants.every((item) => item.platformTopicVariant === "xiaohongshu"));
assert.equal(xhsPlatformVariants.some((item) => freshRecommendations.some((wechatItem) => wechatItem.topic === item.topic)), false, "shared mother topics must still receive distinct platform titles");

const beforeProjection = structuredClone(store);
const initial = buildStrategyAdjustmentWorkspace(store, feedbackWorkspace, { companyId: candidate.companyId, socialAccountId: candidate.socialAccountId });
assert.deepEqual(store, beforeProjection, "candidate projection must be read-only");
assert.equal(initial.candidates.length, 1);
assert.equal(initial.candidates[0].nextCycleExperiment.changeVariable, "title_value_proposition");
assert.equal(initial.candidates[0].authorityBoundary.activeStrategyMutationAllowed, false);

assert.throws(() => confirmStrategyAdjustmentDecision(store, feedbackWorkspace, candidate.id, {
  companyId: candidate.companyId, socialAccountId: candidate.socialAccountId,
  candidateHash: initial.candidates[0].candidateHash, resolution: "approved_for_next_cycle",
  actorType: "agent", actorId: "agent", userConfirmed: true, idempotencyKey: "feedback-cycle-decision"
}), (error) => error.code === "STRATEGY_ADJUSTMENT_USER_CONFIRMATION_REQUIRED");
assert.deepEqual(store, beforeProjection, "rejected authority must perform zero writes");

const confirmed = confirmStrategyAdjustmentDecision(store, feedbackWorkspace, candidate.id, {
  companyId: candidate.companyId, socialAccountId: candidate.socialAccountId,
  candidateHash: initial.candidates[0].candidateHash, resolution: "approved_for_next_cycle",
  actorType: "user", actorId: "user:feedback-owner", userConfirmed: true,
  idempotencyKey: "feedback-cycle-decision"
}, { now: "2026-08-28T12:00:00.000Z" });
assert.equal(confirmed.created, true);
assert.equal(confirmed.decision.claims.activeStrategyMutated, false);
assert.equal(confirmed.decision.claims.nextCycleInputAuthorized, true);
assert.deepEqual(store.strategySnapshots, beforeProjection.strategySnapshots, "confirmation must not mutate active strategy snapshots");
const replay = confirmStrategyAdjustmentDecision(store, feedbackWorkspace, candidate.id, {
  companyId: candidate.companyId, socialAccountId: candidate.socialAccountId,
  candidateHash: initial.candidates[0].candidateHash, resolution: "approved_for_next_cycle",
  actorType: "user", actorId: "user:feedback-owner", userConfirmed: true,
  idempotencyKey: "feedback-cycle-decision"
});
assert.equal(replay.created, false);
assert.equal(replay.decision.factHash, confirmed.decision.factHash);
assert.throws(() => confirmStrategyAdjustmentDecision(store, feedbackWorkspace, candidate.id, {
  companyId: candidate.companyId, socialAccountId: candidate.socialAccountId,
  candidateHash: initial.candidates[0].candidateHash, resolution: "rejected",
  actorType: "user", actorId: "user:feedback-owner", userConfirmed: true,
  idempotencyKey: "feedback-cycle-decision"
}), (error) => error.code === "STRATEGY_ADJUSTMENT_IDEMPOTENCY_CONFLICT");

const inputs = resolveConfirmedStrategyAdjustmentInputs(store, {
  companyId: candidate.companyId,
  decisionIds: [confirmed.decision.id],
  activeStrategySnapshotId: candidate.currentEffectiveStrategyId
});
assert.equal(inputs.userDecisions.length, 1);
assert.equal(inputs.experimentByAccount[candidate.socialAccountId].targetMetric, "openRate");
assert.throws(() => resolveConfirmedStrategyAdjustmentInputs(store, {
  companyId: candidate.companyId,
  decisionIds: [confirmed.decision.id],
  activeStrategySnapshotId: "strategy_stale"
}), (error) => error.code === "STRATEGY_ADJUSTMENT_DECISION_SCOPE_INVALID");

const strategySnapshot = {
  id: candidate.currentEffectiveStrategyId,
  version: 3,
  status: "active",
  document: {
    strategy: { contentSystem: { pillars: [{ id: "methods" }] } },
    strategyExtensions: {
      accountPortfolio: { mode: "single_account", primarySocialAccountId: candidate.socialAccountId, selectedSocialAccountIds: [candidate.socialAccountId] },
      accountGrowthStrategies: [{
        socialAccountId: candidate.socialAccountId,
        selectedPlaybookId: candidate.growthPlaybookId,
        playbookVersion: "1.1",
        recommendedCadence: { windowDays: 7, minItems: 1, maxItems: 5 },
        contentFunctionTargets: { discovery: 100 }
      }]
    }
  }
};
const account = { id: candidate.socialAccountId, companyId: candidate.companyId, name: "反馈测试账号", platform: "wechat", status: "active" };
const plan = createPublishingCyclePlan({
  ownership: { workspaceId: "workspace_feedback", companyId: candidate.companyId },
  strategySnapshot,
  accounts: [account],
  accountPlans: [{
    socialAccountId: account.id,
    account,
    growthPlaybookId: candidate.growthPlaybookId,
    playbookVersion: "1.1",
    cadenceRange: { windowDays: 7, minItems: 1, maxItems: 5 },
    platformCapability: { cadenceRange: { windowDays: 7, minItems: 1, maxItems: 5 } },
    recommendations: freshRecommendations,
    nextCycleContentPortfolio: planningPortfolio,
    contentPillars: ["methods"],
    experiment: inputs.experimentByAccount[account.id]
  }],
  platformCapabilities: { wechat: { cadenceRange: { windowDays: 7, minItems: 1, maxItems: 5 } } },
  capacity: { research: 5, copy: 5, visual: 5, review: 5, publishCommunity: 5 },
  inventory: { topics: 5, evidence: 5 },
  cycleStart: "2026-09-01",
  cycleDays: 7,
  freezeDays: 3,
  userDecisions: inputs.userDecisions
});
assert.equal(plan.userDecisions[0].strategyAdjustmentDecisionRef.id, confirmed.decision.id);
assert.ok(plan.slots.filter((item) => item.zone !== "buffer").every((item) => item.experiment.changeVariable === "title_value_proposition"));
assert.equal(plan.slots.filter((item) => item.zone !== "buffer").length, 5);
assert.equal(new Set(plan.slots.filter((item) => item.zone !== "buffer").map((item) => item.topic)).size, 5);
assert.ok(plan.slots.filter((item) => item.zone !== "buffer").every((item) => item.contentLearningInstruction?.novelty?.newBodyRequired));
const workbenchStore = { contentTasks: store.contentTasks, unifiedContentOpportunities: [] };
const savedPlan = saveCycleWorkbenchPlan(workbenchStore, plan, { now: "2026-08-28T12:05:00.000Z" }).plan;
assert.throws(() => confirmCycleWorkbenchPlan(workbenchStore, plan.cycleId, { confirmedBy: "user" }), (error) => error.code === "PUBLISHING_CYCLE_EXACT_CONFIRMATION_REQUIRED");
const unchangedSchedule = structuredClone(savedPlan.slots[0].targetWindow);
assert.throws(() => adjustCycleWorkbenchSlot(workbenchStore, plan.cycleId, savedPlan.slots[0].slotId, { topic: store.contentTasks[0].ideaTitle, targetWindow: { date: "2026-09-06" }, reason: "验证重复门槛", confirmCommittedChange: true }), (error) => error.code === "PUBLISHING_CYCLE_TOPIC_DUPLICATE");
assert.deepEqual(savedPlan.slots[0].targetWindow, unchangedSchedule, "a rejected topic edit must not partially change the schedule");
const confirmedPlan = confirmCycleWorkbenchPlan(workbenchStore, plan.cycleId, { confirmedBy: "user", expectedPlanHash: savedPlan.confirmationPreviewHash }).plan;
assert.equal(confirmedPlan.confirmation.planHash, savedPlan.confirmationPreviewHash);
const repairSlots = plan.slots.filter((item) => item.learningLane === "repair" && item.zone !== "buffer");
const baselineOpenRate = planningPortfolio.repairSignal.baseline.value;
assert.ok(baselineOpenRate > 0);
const evaluation = evaluateCycleLearning(planningPortfolio, plan, {
  outcomes: repairSlots.map((slot, index) => ({
    publicationId: `next_cycle_publication_${index}`,
    cycleId: plan.cycleId,
    slotId: slot.slotId,
    metrics: { derived: { openRate: baselineOpenRate * 1.2 } },
    evidenceRefs: [`next_cycle_metric_${index}`]
  }))
});
assert.equal(evaluation.status, "supported");
assert.equal(evaluation.claims.autoStrategyActivationAllowed, false);

const bindings = bindStrategyAdjustmentsToCycle(store, inputs.decisionRefs, plan.cycleId, {
  companyId: candidate.companyId,
  boundAt: "2026-08-28T12:10:00.000Z"
});
assert.equal(bindings.length, 1);
assert.equal(bindings[0].claims.activeStrategyMutated, false);
assert.equal(bindStrategyAdjustmentsToCycle(store, inputs.decisionRefs, plan.cycleId, { companyId: candidate.companyId }).length, 0);
assert.throws(() => bindStrategyAdjustmentsToCycle(store, inputs.decisionRefs, "cycle_other", { companyId: candidate.companyId }), (error) => error.code === "STRATEGY_ADJUSTMENT_DECISION_ALREADY_BOUND");

const finalWorkspace = buildStrategyAdjustmentWorkspace(store, feedbackWorkspace, { companyId: candidate.companyId, socialAccountId: candidate.socialAccountId });
assert.equal(finalWorkspace.candidates[0].decision.factHash, confirmed.decision.factHash);
assert.equal(finalWorkspace.candidates[0].cycleBinding.cycleId, plan.cycleId);
assert.deepEqual(resolveConfirmedStrategyAdjustmentInputs(store, {
  companyId: candidate.companyId,
  decisionIds: [],
  activeStrategySnapshotId: "strategy_1"
}).decisionRefs, []);
assert.throws(() => resolveConfirmedStrategyAdjustmentInputs(store, {
  companyId: candidate.companyId,
  decisionIds: [confirmed.decision.id],
  activeStrategySnapshotId: "strategy_1"
}), (error) => error.code === "STRATEGY_ADJUSTMENT_DECISION_SCOPE_INVALID");

const [serverSource, appSource, apiSource, strategyUiSource, adapterSource, plannerSource] = await Promise.all([
  readFile(new URL("../../server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../app.js", import.meta.url), "utf8"),
  readFile(new URL("../../api-client.js", import.meta.url), "utf8"),
  readFile(new URL("../../ui/strategy-adjustment-workbench.js", import.meta.url), "utf8"),
  readFile(new URL("../../content-agent/server-adapter.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../content-agent/planner.mjs", import.meta.url), "utf8")
]);
assert.match(serverSource, /\/content-agent\/strategy-adjustments/);
assert.match(serverSource, /resolveConfirmedStrategyAdjustmentInputs/);
assert.match(serverSource, /bindStrategyAdjustmentsToCycle/);
assert.match(serverSource, /PUBLISHING_CYCLE_STRATEGY_ADJUSTMENT_MISMATCH/);
assert.match(serverSource, /nextCyclePortfolio/);
assert.match(apiSource, /getStrategyAdjustments/);
assert.match(apiSource, /confirmStrategyAdjustment/);
assert.match(strategyUiSource, /批准用于下一周期/);
assert.match(strategyUiSource, /下一周期内容组合/);
assert.match(strategyUiSource, /周期学习结论/);
assert.match(appSource, /strategyAdjustmentDecisionIds/);
assert.match(appSource, /slot\.nextCyclePortfolioRef && raw/);
assert.match(appSource, /冷启动规划/);
assert.match(appSource, /最相近历史内容/);
assert.match(adapterSource, /dataDrivenNextCycleV1/);
assert.match(plannerSource, /hardGatePassed/);
assert.doesNotMatch(strategyUiSource, /activateConfirmedStrategyDraft|rollbackStrategySnapshot/);

console.log(JSON.stringify({
  status: "strategy-feedback-cycle-self-test passed",
  simulatedPublications: feedbackWorkspace.outcomes.length,
  simulatedCycles: feedbackWorkspace.cycleReviews[0].cycleCount,
  detectedBottleneck: candidate.repeatedBottlenecks[0].stage,
  nextCycleAllocation: portfolio.allocation.counts,
  immutableDecision: true,
  activeStrategyMutations: 0,
  nextCycleBindings: 1,
  cycleLearningStatus: evaluation.status,
  providerCalls: 0,
  platformActions: 0
}, null, 2));
