import assert from "node:assert/strict";
import { GROWTH_PLAYBOOKS, recommendStrategyDecisions, normalizeStrategyDecisions } from "../../strategy-agent/growth-playbook-library.mjs";
import { normalizeStrategyDecisionSelection } from "../../strategy-agent/strategy-decision-contract.mjs";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2, validateGeneratedStrategyDocument } from "../../strategy-agent/strategy-document.mjs";
import { projectStrategyForContent } from "../../content-agent/strategy-adapter.mjs";

const claims = [
  { fieldPath: "business.primaryOffers", value: ["海外仓端到端服务"], status: "confirmed" },
  { fieldPath: "business.businessModel", value: "企业服务", status: "confirmed" },
  { fieldPath: "audiences.primary", value: [{ name: "出海品牌负责人" }], status: "confirmed" },
  { fieldPath: "business.conversionPath", value: { steps: ["内容触达", "添加销售微信", "需求诊断", "方案沟通"] }, status: "confirmed" },
  { fieldPath: "accountStrategy.primaryGoal", value: "冷启动阶段建立专业认知并获得有效咨询", status: "confirmed" },
  { fieldPath: "accountStrategy.growthStage", value: "account_setup", status: "confirmed" },
  { fieldPath: "accountStrategy.platformRoles", value: { xiaohongshu: "场景触达", wechat: "深度信任" }, status: "confirmed" },
  { fieldPath: "accountStrategy.contentResources", value: { knowledgeAssetIds: [] }, status: "confirmed" },
  { fieldPath: "accountStrategy.constraints", value: ["不虚构案例", "不追无关热点"], status: "confirmed" }
];
const facts = [
  { factKey: "account.portfolio", value: "采用账号矩阵，由企业号和专家号分工", status: "user_asserted" },
  { factKey: "account.growth_strategy", value: "小红书希望用相关热点桥接和垂直干货混合启动", status: "user_asserted" }
];
const socialAccounts = [
  {
    id: "xhs_company",
    companyId: "company_growth",
    name: "大卖仓官方号",
    platform: "xiaohongshu",
    configuration: { selectionEligible: true },
    accountIdentity: { id: "identity_xhs_company", companyId: "company_growth", socialAccountId: "xhs_company", subjectType: "company_official", speakerType: "brand_official", trustSources: ["professional_knowledge", "product_capability"] },
    strategySettings: { subjectType: "company_official", matrixRole: "品牌与方案" }
  },
  {
    id: "xhs_expert",
    companyId: "company_growth",
    name: "海外仓专家号",
    platform: "xiaohongshu",
    configuration: { selectionEligible: true },
    accountIdentity: { id: "identity_xhs_expert", companyId: "company_growth", socialAccountId: "xhs_expert", subjectType: "employee_expert", speakerType: "expert_advisor", trustSources: ["professional_knowledge", "real_cases"] },
    strategySettings: { subjectType: "employee_expert", matrixRole: "经验与答疑" }
  },
  {
    id: "wechat_company",
    companyId: "company_growth",
    name: "大卖仓公众号",
    platform: "wechat",
    configuration: { selectionEligible: true },
    accountIdentity: { id: "identity_wechat_company", companyId: "company_growth", socialAccountId: "wechat_company", subjectType: "company_official", speakerType: "brand_official", trustSources: ["professional_knowledge", "product_capability"] },
    strategySettings: { subjectType: "company_official", matrixRole: "深度与承接" }
  }
];

const deterministic = recommendStrategyDecisions({ claims, facts, socialAccounts });
assert.equal(deterministic.portfolioDecision.mode, "role_matrix");
assert.equal(deterministic.accountStrategies.length, 3);
assert.equal(deterministic.accountStrategies.find((item) => item.socialAccountId === "xhs_company")?.growthMode, "hybrid_bridge");
assert.ok(deterministic.accountStrategies.every((item) => item.hotspotPolicy.unrelatedAllowed === false));
assert.ok(deterministic.accountStrategies.every((item) => item.hotspotPolicy.autoDeleteHistoricalContent === false));
assert.ok(deterministic.accountStrategies.every((item) => item.candidatePlaybooks.length >= 2));
assert.ok(deterministic.accountStrategies.every((item) => item.candidatePlaybooks.every((candidate) => candidate.platform === item.platform)));
assert.ok(deterministic.accountStrategies.every((item) => item.candidatePlaybooks.every((candidate) => candidate.recommendationReasons.length && candidate.platformMechanism.length && candidate.resourceRequirements.length && candidate.experimentPlan.windowDays && candidate.experimentPlan.exitConditions.length)));

const normalized = normalizeStrategyDecisions({
  schemaVersion: "1.0",
  portfolioDecision: deterministic.portfolioDecision,
  accountStrategies: deterministic.accountStrategies.map((item) => ({ ...item, selectedPlaybookId: item.selectedPlaybookId, hotspotPolicy: { unrelatedAllowed: true, autoDeleteHistoricalContent: true } }))
}, deterministic);
assert.ok(normalized.accountStrategies.every((item) => item.hotspotPolicy.unrelatedAllowed === false));
assert.ok(normalized.accountStrategies.every((item) => item.hotspotPolicy.autoDeleteHistoricalContent === false));

const confirmedSelection = normalizeStrategyDecisionSelection(normalized, normalized, socialAccounts);
const bundle = assembleStrategyInputBundle({ account: { id: "company_growth", name: "大卖仓" }, claims, facts, strategyDecisions: confirmedSelection });
const document = createStrategyDocumentV2({ accountId: "company_growth", claims, strategyInputBundle: bundle, suggestion: {} });
assert.equal(validateGeneratedStrategyDocument(document).valid, true);
assert.equal(document.strategyExtensions.accountPortfolio.mode, "role_matrix");
assert.equal(document.strategyExtensions.accountGrowthStrategies.length, 3);
assert.equal(document.strategyExtensions.experimentPlans.length, 3);
assert.equal(document.strategyExtensions.selectedGrowthPlaybooks.length, 3);
assert.equal(new Set(document.strategyExtensions.accountGrowthStrategies.map((item) => item.matrixRole)).size, 3);
assert.ok(document.strategyExtensions.accountGrowthStrategies.every((item) => item.playbookVersion));

const singleDecision = structuredClone(normalized);
singleDecision.portfolioDecision.mode = "single_account";
singleDecision.portfolioDecision.primarySocialAccountId = "xhs_company";
singleDecision.portfolioDecision.selectedSocialAccountIds = ["xhs_company"];
singleDecision.portfolioDecision.selectedAccountIds = ["xhs_company"];
const singleSelection = normalizeStrategyDecisionSelection(singleDecision, normalized, socialAccounts);
const singleBundle = assembleStrategyInputBundle({ account: { id: "company_growth", name: "单账号测试" }, claims, facts, strategyDecisions: singleSelection });
const singleDocument = createStrategyDocumentV2({ accountId: "company_growth", claims, strategyInputBundle: singleBundle, suggestion: {} });
assert.equal(singleDocument.strategyExtensions.accountPortfolio.mode, "single_account");
assert.deepEqual(singleDocument.strategyExtensions.accountPortfolio.selectedSocialAccountIds, ["xhs_company"]);
assert.deepEqual(singleDocument.strategyExtensions.accountGrowthStrategies.map((item) => item.socialAccountId), ["xhs_company"]);
assert.deepEqual(singleDocument.strategyExtensions.selectedGrowthPlaybooks.map((item) => item.socialAccountId), ["xhs_company"]);
assert.equal(singleDocument.strategyExtensions.accountPlanningStates.find((item) => item.socialAccountId === "wechat_company")?.planningStatus, "pending");

const profile = projectStrategyForContent({ id: "strategy_growth", accountId: "company_growth", socialAccountId: "xhs_company", payload: document }, []);
assert.equal(profile.growthMode, "hybrid_bridge");
assert.equal(profile.hotspotPolicy.unrelatedAllowed, false);

console.log(JSON.stringify({
  status: "strategy-growth-playbook-self-test passed",
  playbooks: GROWTH_PLAYBOOKS.length,
  portfolioMode: document.strategyExtensions.accountPortfolio.mode,
  accountStrategies: document.strategyExtensions.accountGrowthStrategies.length,
  projectedGrowthMode: profile.growthMode
}, null, 2));
