import assert from "node:assert/strict";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2 } from "../../strategy-agent/strategy-document.mjs";
import { createRunFromActiveStrategy } from "../../content-agent/strategy-content-orchestrator.mjs";
import { recordPublication, recordPublicationMetrics } from "../../content-agent/publishing-feedback.mjs";
import { buildFeedbackWorkspace } from "../../content-agent/feedback-engine.mjs";

const companyId = "company_v1_golden";
const claims = [
  ["business.primaryOffers", ["企业内容顾问服务"]], ["business.businessModel", "项目制服务"],
  ["audiences.primary", [{ name: "中小企业经营者" }]],
  ["business.conversionPath", { entryCTA: "领取诊断清单", contactChannel: "企业微信", diagnosticStep: "需求诊断" }],
  ["accountStrategy.primaryGoal", "建立专业信任并获得咨询"], ["accountStrategy.growthStage", "account_setup"],
  ["accountStrategy.platformRoles", { xiaohongshu: "发现与触达", wechat: "深度论证与承接" }],
  ["accountStrategy.contentResources", { knowledgeAssetIds: ["knowledge_v1"] }],
  ["accountStrategy.constraints", ["不虚构案例", "不承诺结果"]]
].map(([fieldPath, value], index) => ({ id: `claim_v1_${index}`, fieldPath, value, status: "confirmed" }));
const strategyDecisions = {
  schemaVersion: "1.1",
  decisionRevision: 3, decisionHash: "decision_hash_v1",
  portfolioDecision: {
    mode: "role_matrix",
    primarySocialAccountId: "xhs_v1",
    selectedSocialAccountIds: ["xhs_v1", "wechat_v1"],
    accountRoles: { xhs_v1: "发现与触达", wechat_v1: "深度论证与承接" }
  },
  accountStrategies: [
    { socialAccountId: "xhs_v1", platform: "xiaohongshu", growthMode: "hybrid_bridge", selectedPlaybookId: "xhs_cold_start", accountIdentity: { id: "identity_xhs_v1", subjectType: "company_official", speakerType: "brand_official", trustSources: ["professional_knowledge", "product_capability"] }, experimentPlan: { id: "experiment_xhs", hypothesis: "专业清单能带来目标用户收藏和咨询" } },
    { socialAccountId: "wechat_v1", platform: "wechat", growthMode: "authority_depth", selectedPlaybookId: "wechat_authority", accountIdentity: { id: "identity_wechat_v1", subjectType: "company_official", speakerType: "brand_official", trustSources: ["professional_knowledge", "product_capability"] }, experimentPlan: { id: "experiment_wechat", hypothesis: "深度方法文能提升阅读完成与线索质量" } }
  ],
  selectedGrowthPlaybooks: [
    { socialAccountId: "xhs_v1", playbookId: "xhs_cold_start", growthMode: "hybrid_bridge" },
    { socialAccountId: "wechat_v1", playbookId: "wechat_authority", growthMode: "authority_depth" }
  ]
};
const bundle = assembleStrategyInputBundle({ account: { id: companyId, name: "V1闭环测试公司" }, claims, facts: [], strategyDecisions });
const document = createStrategyDocumentV2({ accountId: companyId, claims, strategyInputBundle: bundle, suggestion: {} });
const activeStrategySnapshot = { schemaVersion: "2.0", id: "strategy_v1_golden", accountId: companyId, status: "active", version: 1, sourceDraftRevisionId: "draft_v1_golden", documentHash: "document_hash_v1_golden", contextHash: bundle.contextHash, activatedAt: new Date().toISOString(), document };
const factSnapshot = { schemaVersion: "1.0", id: "facts_v1_golden", factSnapshotId: "facts_v1_golden", accountId: companyId, factRevision: 0, capturedAt: new Date().toISOString(), usableFacts: [], contextOnlyFacts: [], forbiddenFacts: [], missingFacts: [] };
const store = { contentTasks: [], contentRuns: [], contentWorkflows: [], contentPublications: [], hotspotLibrary: [], referenceAnalyses: [] };
const cases = [
  { platform: "xiaohongshu", socialAccountId: "xhs_v1", topic: "企业做内容前先明确的三件事", metrics: { views: 1200, saves: 86, follows: 18, leads: 3, measurementWindow: "7d" } },
  { platform: "wechat", socialAccountId: "wechat_v1", topic: "从内容曝光到业务咨询的完整承接路径", metrics: { deliveries: 800, views: 420, shares: 22, leads: 5, measurementWindow: "7d", platformMetrics: { completions: 210 } } }
];

for (const item of cases) {
  const result = createRunFromActiveStrategy({ store, payload: { platform: item.platform, expectedStrategySnapshotId: activeStrategySnapshot.id, userRequest: { topic: item.topic, preferredSourceMode: "knowledge", contentPurposeId: "knowledge_howto", format: item.platform === "wechat" ? "article" : "checklist" } }, ownership: { workspaceId: "workspace_v1", companyId, socialAccountId: item.socialAccountId }, activeStrategySnapshot, currentFacts: [], factSnapshot, knowledgeItems: [{ id: "knowledge_v1", name: "已确认业务方法资料" }] });
  assert.equal(result.workflow.featureFlags.viralLearningV1, false);
  assert.equal(result.workflow.skillExecutionPlan.policy.implicitHotspotSearch, false);
  assert.equal(result.workflow.sourceTrace.decisions.length, 4);
  assert.equal(result.workflow.sourceTrace.decisions.find((decision) => decision.type === "hotspot").reasonCode, "no_hotspot_selected_no_runtime_search");
  assert.equal(result.workflow.sourceTrace.decisions.find((decision) => decision.type === "knowledge").used, true);
  assert.equal(result.workflow.sourceTrace.decisions.find((decision) => decision.type === "reference_post").used, false);
  assert.equal(result.workflow.sourceTrace.decisions.find((decision) => decision.type === "viral_blueprint").used, false);
  const task = { id: `task_${item.socialAccountId}`, contentRunId: result.workflow.id, accountId: item.socialAccountId, companyId, socialAccountId: item.socialAccountId, platform: item.platform, ideaTitle: item.topic, version: 1, contentTaskBrief: result.recommendation.contentTaskBrief, contentIdentity: result.recommendation.contentIdentity, contentExecutionContext: result.recommendation.contentExecutionContext, generationPayload: result.workflow.generationPayload };
  store.contentTasks.push(task);
  const publication = recordPublication(store, task, { status: "published", adoptionStatus: "adopted", note: "V1系统闭环模拟，不代表真实平台发布" });
  const duplicate = recordPublication(store, task, { status: "published", adoptionStatus: "adopted" });
  assert.equal(duplicate.id, publication.id, "同一发布动作必须幂等");
  recordPublicationMetrics(publication, { ...item.metrics, source: "manual" });
}

const companyWorkspace = buildFeedbackWorkspace(store, { companyId });
assert.equal(companyWorkspace.outcomes.length, 2);
assert.equal(buildFeedbackWorkspace(store, { companyId, socialAccountId: "xhs_v1" }).outcomes.length, 1);
assert.equal(buildFeedbackWorkspace(store, { companyId, socialAccountId: "wechat_v1" }).outcomes.length, 1);
assert.deepEqual(new Set(companyWorkspace.outcomes.map((item) => item.platform)), new Set(["xiaohongshu", "wechat"]));
assert.ok(companyWorkspace.outcomes.every((item) => item.attribution.companyId === companyId));
assert.ok(companyWorkspace.outcomes.every((item) => item.attribution.strategyDecisionRevision === 3));
assert.equal(companyWorkspace.growthPlaybookSignals.length, 2);
assert.equal(companyWorkspace.strategySignalBundle.policy.autoApply, false);

console.log(JSON.stringify({ status: "v1-golden-path-self-test passed", mode: "local_manual_publication_simulation", platforms: cases.map((item) => item.platform), runs: store.contentRuns.length, publications: store.contentPublications.length, outcomes: companyWorkspace.outcomes.length, growthPlaybookSignals: companyWorkspace.growthPlaybookSignals.length }, null, 2));
