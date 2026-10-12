import { validateActiveStrategySnapshotV2 } from "../contracts/strategy-content-contracts.mjs";
import { planContentFromWorkspace } from "./server-adapter.mjs";
import { createContentWorkflow } from "./workflow-engine.mjs";

function fail(message, code, statusCode = 409, details = []) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  throw error;
}

function assertActiveStrategy(snapshot, expectedStrategySnapshotId) {
  if (!snapshot) fail("当前公司尚未激活策略，请先在策略 Agent 中确认并激活策略", "ACTIVE_STRATEGY_REQUIRED");
  const validation = validateActiveStrategySnapshotV2(snapshot);
  if (!validation.valid) {
    fail("当前活动策略不符合内容 Agent 的 v2 消费契约，请重新生成并激活策略", "ACTIVE_STRATEGY_INVALID", 409, validation.errors);
  }
  if (expectedStrategySnapshotId && snapshot.id !== expectedStrategySnapshotId) {
    fail("活动策略已在内容规划后发生变化，请重新获取内容方向", "STRATEGY_PLAN_STALE", 409, [
      { path: "expectedStrategySnapshotId", expected: expectedStrategySnapshotId, actual: snapshot.id }
    ]);
  }
}

function selectRecommendation(plan, { recommendationId, expectedDirectionCardId }) {
  const recommendations = plan.recommendations || [];
  const recommendation = recommendationId ? recommendations.find((item) => item.id === recommendationId) : recommendations[0];
  if (!recommendation) fail("所选内容方向已不在当前计划中，请重新获取内容方向", "CONTENT_DIRECTION_STALE");
  if (expectedDirectionCardId && recommendation.contentDirectionCard?.id !== expectedDirectionCardId) {
    fail("内容方向已因策略、历史内容或素材变化而更新，请重新确认方向", "CONTENT_DIRECTION_STALE", 409, [
      { path: "expectedDirectionCardId", expected: expectedDirectionCardId, actual: recommendation.contentDirectionCard?.id || null }
    ]);
  }
  if (["block", "rework"].includes(recommendation.duplication?.decision)) {
    fail("所选方向未通过重复度门槛，请选择其他方向或调整主题", "CONTENT_DIRECTION_BLOCKED");
  }
  const missingRequiredSource = recommendation.sourcePlan?.sources?.some((source) => source.required && !(source.candidateIds || []).length);
  if (missingRequiredSource) fail("所选方向缺少必需的事实或素材，暂时不能创建内容任务", "CONTENT_SOURCE_REQUIRED");
  return recommendation;
}

/**
 * The single production bridge from an immutable active strategy to a ContentRun.
 * Planning is repeated server-side so clients cannot inject or reuse stale strategy context.
 */
export function createRunFromActiveStrategy({
  store,
  payload,
  ownership,
  activeStrategySnapshot,
  currentFacts = [],
  factSnapshot,
  knowledgeItems = [],
  viralLearningEnabled = false
}) {
  const platform = payload.platform || "xiaohongshu";
  if (!["xiaohongshu", "wechat"].includes(platform)) fail("platform must be xiaohongshu or wechat", "UNSUPPORTED_CONTENT_PLATFORM", 400);
  assertActiveStrategy(activeStrategySnapshot, payload.expectedStrategySnapshotId);

  const scopedSnapshot = {
    ...activeStrategySnapshot,
    workspaceId: ownership.workspaceId,
    companyId: ownership.companyId,
    socialAccountId: ownership.socialAccountId
  };
  const viralLearningV1Enabled = false;
  const plan = planContentFromWorkspace({
    payload: {
      inputMode: "active_strategy",
      platform,
      limit: payload.limit || 3,
      userRequest: payload.userRequest || null,
      workspaceId: ownership.workspaceId,
      companyId: ownership.companyId,
      socialAccountId: ownership.socialAccountId,
      accountId: ownership.socialAccountId || ownership.companyId
    },
    store,
    activeStrategySnapshot: scopedSnapshot,
    currentFacts,
    factSnapshot,
    knowledgeItems,
    ownershipContext: ownership,
    viralLearningEnabled: viralLearningV1Enabled
  });
  const recommendation = selectRecommendation(plan, payload);
  const generationPayload = {
    ...recommendation.generationPayload,
    workspaceId: ownership.workspaceId,
    companyId: ownership.companyId,
    socialAccountId: ownership.socialAccountId,
    selectionSource: payload.selectionSource || null,
    accountStrategySnapshotId: activeStrategySnapshot.resolution?.accountStrategySnapshotId || null,
    matrixId: ownership.company?.matrixId || null,
    accountId: ownership.socialAccountId || ownership.companyId,
    sourceType: "active_strategy",
    strategySnapshotId: activeStrategySnapshot.id,
    strategySnapshotVersion: activeStrategySnapshot.version,
    effectiveStrategyId: activeStrategySnapshot.effectiveStrategyId || null,
    strategyResolution: activeStrategySnapshot.resolution || null,
    featureFlags: {
      ...(recommendation.generationPayload?.featureFlags || {}),
      viralLearningV1: viralLearningV1Enabled
    },
    sourcePolicy: {
      implicitHotspotSearch: false,
      approvedBlueprintOnly: true,
      automaticSkillPromotion: false
    }
  };
  const workflow = createContentWorkflow(store, {
    accountId: ownership.socialAccountId || ownership.companyId,
    recommendation,
    generationPayload
  });
  workflow.bridge = {
    kind: "StrategyContentBridge",
    schemaVersion: "1.0",
    strategySnapshotId: activeStrategySnapshot.id,
    strategySnapshotVersion: activeStrategySnapshot.version,
    factSnapshotId: workflow.factSnapshotId,
    directionCardId: workflow.directionCardId,
    contentExecutionContextId: workflow.contentExecutionContextId,
    plannedAt: plan.generatedAt,
    createdAt: workflow.createdAt
  };
  workflow.capabilityStatus = {
    viralLearningV1: {
      enabled: viralLearningV1Enabled,
      requested: viralLearningEnabled === true,
      reason: "p1_locked_no_automatic_learning_or_skill_promotion"
    }
  };
  return { workflow, plan, recommendation };
}
