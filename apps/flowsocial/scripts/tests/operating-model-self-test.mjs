import assert from "node:assert/strict";
import { ensureWorkspaceContext, getCompanyMatrix, resolveOwnershipContext } from "../../workspace-context.mjs";
import { getActiveAccountStrategy, getActiveMatrixStrategy, isAccountActiveInStrategy, resolveEffectiveAccountStrategy, saveAccountStrategySnapshot, saveMatrixStrategySnapshot } from "../../content-agent/strategy-hierarchy.mjs";
import { createContentOpportunity, createRollingContentPlan, listContentOpportunities, markOpportunityStarted, resolvePlanningAccounts, saveRollingContentPlan, validateRollingContentPlan } from "../../content-agent/operating-plan.mjs";

const store = {
  accounts: [
    { id: "company_a", name: "A公司", accountType: "company", platform: "多平台" },
    { id: "xhs_a", name: "A公司小红书", accountType: "social", companyId: "company_a", platform: "xiaohongshu" },
    { id: "wx_a", name: "A公司公众号", accountType: "social", companyId: "company_a", platform: "wechat" },
    { id: "company_b", name: "B公司", accountType: "company", platform: "多平台" },
    { id: "xhs_b", name: "B公司小红书", accountType: "social", companyId: "company_b", platform: "xiaohongshu" }
  ]
};
ensureWorkspaceContext(store);
const matrix = getCompanyMatrix(store, "company_a");
assert.ok(matrix?.id);
assert.equal(resolveOwnershipContext(store, { socialAccountId: "xhs_a" }).companyId, "company_a");

saveMatrixStrategySnapshot(store, {
  workspaceId: "workspace_default", companyId: "company_a", matrixId: matrix.id,
  payload: { accountRoles: { xhs_a: { role: "discovery_and_trust" }, wx_a: { role: "authority_hub" } }, crossAccountRules: ["相同主题必须采用不同角度"] }
});
saveAccountStrategySnapshot(store, {
  workspaceId: "workspace_default", companyId: "company_a", matrixId: matrix.id, socialAccountId: "xhs_a",
  payload: { subjectType: "employee_expert", accountMode: "professional_ip", growthStage: "cold_start", growthPlaybook: "hybrid", platformPlaybook: { role: "场景触达与专业信任" } }
});

const baseSnapshot = {
  id: "strategy_company_a_v1", version: 1, status: "active", accountId: "company_a",
  document: {
    schemaVersion: "2.0", accountId: "company_a", business: { businessModel: "B2B服务", valueProposition: "帮助客户解决问题", offers: [] },
    strategy: { growthStage: "stable", audiences: [{ id: "aud_1", name: "负责人" }], contentSystem: { pillars: [{ id: "p1", name: "行业方法" }], portfolio: { discovery: 20, authority: 30, proof: 20, solution: 20, action: 10 } }, platformPlaybooks: { xiaohongshu: { role: "品牌展示" }, wechat: { role: "深度解释" } }, conversionSystem: {}, riskPolicy: {}, evidencePolicy: {} },
    strategyExtensions: {}, governance: {}
  }
};
const singleSnapshot = structuredClone(baseSnapshot);
singleSnapshot.document.strategyExtensions = { accountPortfolio: { mode: "single_account", primarySocialAccountId: "xhs_a", selectedSocialAccountIds: ["xhs_a"] }, accountGrowthStrategies: [{ socialAccountId: "xhs_a", matrixRole: "primary", selectedPlaybookId: "xhs-hybrid-bridge", playbookVersion: "1.1" }] };
assert.deepEqual(resolvePlanningAccounts({ accounts: store.accounts.filter((item) => item.companyId === "company_a"), strategySnapshot: singleSnapshot }).map((item) => item.id), ["xhs_a"]);
assert.equal(isAccountActiveInStrategy(singleSnapshot, "wx_a"), false);

const matrixSnapshot = structuredClone(baseSnapshot);
matrixSnapshot.document.strategyExtensions = { accountPortfolio: { mode: "role_matrix", primarySocialAccountId: "xhs_a", selectedSocialAccountIds: ["xhs_a", "wx_a"] }, accountGrowthStrategies: [{ socialAccountId: "xhs_a", matrixRole: "discovery", selectedPlaybookId: "xhs-hybrid-bridge", playbookVersion: "1.1" }, { socialAccountId: "wx_a", matrixRole: "authority", selectedPlaybookId: "wechat-stable-columns", playbookVersion: "1.1" }] };
assert.deepEqual(resolvePlanningAccounts({ accounts: store.accounts.filter((item) => item.companyId === "company_a"), strategySnapshot: matrixSnapshot }).map((item) => item.id), ["xhs_a", "wx_a"]);
const ownership = resolveOwnershipContext(store, { companyId: "company_a", socialAccountId: "xhs_a" });
const effective = resolveEffectiveAccountStrategy({ baseSnapshot, matrixSnapshot: getActiveMatrixStrategy(store, matrix.id), accountSnapshot: getActiveAccountStrategy(store, "xhs_a"), ownership });
assert.equal(effective.document.strategy.growthStage, "cold_start");
assert.equal(effective.document.strategy.matrixPolicy.matrixRole, "discovery_and_trust");
assert.equal(effective.document.strategy.accountPolicy.subjectType, "employee_expert");
assert.equal(effective.document.strategy.platformPlaybooks.xiaohongshu.role, "场景触达与专业信任");

const recommendation = {
  id: "candidate_1", platform: "xiaohongshu", topic: "一个测试选题", contentPillar: "行业方法", contentFunction: "authority", reason: "补齐专业解释", format: "howto",
  generationPayload: { contentPurposeId: "knowledge_howto" }, sourcePlan: { mode: "knowledge" }, contentDirectionCard: { id: "direction_1" }
};
const rollingPlan = createRollingContentPlan({ ownership: resolveOwnershipContext(store, { companyId: "company_a" }), strategySnapshot: baseSnapshot, windowDays: 14, accountPlans: [{ account: store.accounts.find((item) => item.id === "xhs_a"), plan: { recommendations: [recommendation], effectiveStrategyId: effective.effectiveStrategyId } }] });
assert.equal(validateRollingContentPlan(rollingPlan).valid, true);
saveRollingContentPlan(store, rollingPlan);
assert.equal(rollingPlan.items[0].socialAccountId, "xhs_a");
assert.equal(rollingPlan.items[0].accountName, "A公司小红书");
assert.ok(rollingPlan.items[0].strategyVersion);
assert.ok(rollingPlan.items[0].growthPlaybookId);
assert.ok(rollingPlan.items[0].playbookVersion);
assert.ok(rollingPlan.items[0].experimentId);

const matrixOwnership = resolveOwnershipContext(store, { companyId: "company_a" });
const matrixPlan = createRollingContentPlan({
  ownership: matrixOwnership,
  strategySnapshot: matrixSnapshot,
  windowDays: 14,
  accountPlans: [
    { account: store.accounts.find((item) => item.id === "xhs_a"), plan: { strategyContext: { growthStrategy: { matrixRole: "discovery", selectedPlaybookId: "xhs-hybrid-bridge", playbookVersion: "1.1" }, activeExperimentPlan: { id: "experiment_xhs", windowDays: 14, exitConditions: ["目标用户占比不足"] } }, recommendations: [{ ...recommendation, id: "candidate_xhs", growthPlaybookId: "xhs-hybrid-bridge" }], effectiveStrategyId: "effective_xhs" } },
    { account: store.accounts.find((item) => item.id === "wx_a"), plan: { strategyContext: { growthStrategy: { matrixRole: "authority", selectedPlaybookId: "wechat-stable-columns", playbookVersion: "1.1" }, activeExperimentPlan: { id: "experiment_wx", windowDays: 30, exitConditions: ["连续两个窗口无有效阅读"] } }, recommendations: [{ ...recommendation, id: "candidate_wx", platform: "wechat", growthPlaybookId: "wechat-stable-columns" }], effectiveStrategyId: "effective_wx" } }
  ]
});
assert.equal(matrixPlan.items.length, 2);
assert.equal(new Set(matrixPlan.items.map((item) => item.socialAccountId)).size, 2);
assert.equal(new Set(matrixPlan.items.map((item) => item.matrixRole)).size, 2);
assert.equal(new Set(matrixPlan.items.map((item) => item.growthPlaybookId)).size, 2);
assert.equal(new Set(matrixPlan.items.map((item) => item.experimentId)).size, 2);

const opportunity = createContentOpportunity(store, { ownership, platform: "xiaohongshu", sourceType: "hotspot", sourceId: "hotspot_1", topic: "热点与业务结合" });
assert.equal(listContentOpportunities(store, { companyId: "company_b" }).length, 0);
markOpportunityStarted(store, opportunity.id, "content_run_1");
assert.equal(opportunity.status, "in_progress");

console.log(JSON.stringify({ status: "operating-model-self-test passed", matrixId: matrix.id, effectiveStrategyId: effective.effectiveStrategyId, rollingPlanItems: rollingPlan.items.length, opportunityIsolation: true }, null, 2));
