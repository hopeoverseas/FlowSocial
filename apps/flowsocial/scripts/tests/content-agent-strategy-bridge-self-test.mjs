import assert from "node:assert/strict";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2 } from "../../strategy-agent/strategy-document.mjs";
import { planNextContent, resolveEditorialDecisionBrief } from "../../content-agent/index.mjs";
import { createRunFromActiveStrategy } from "../../content-agent/strategy-content-orchestrator.mjs";
import { prepareContentMaster } from "../../content-engine.mjs";

const claims = [
  { id: "c1", fieldPath: "business.primaryOffers", value: ["企业知识库", "AI员工"], status: "confirmed" },
  { id: "c2", fieldPath: "business.businessModel", value: "企业AI服务", status: "confirmed" },
  { id: "c3", fieldPath: "audiences.primary", value: [{ name: "出海企业负责人", decisionMakers: ["老板"] }], status: "confirmed" },
  { id: "c4", fieldPath: "business.conversionPath", value: { entryCTA: "领取诊断清单", contactChannel: "企业微信", diagnosticStep: "需求诊断", nextBusinessStep: "方案沟通", cooperationEntry: "签约" }, status: "confirmed" },
  { id: "c5", fieldPath: "accountStrategy.primaryGoal", value: "建立专业认知并获得咨询", status: "confirmed" },
  { id: "c6", fieldPath: "accountStrategy.growthStage", value: "account_setup", status: "confirmed" },
  { id: "c7", fieldPath: "accountStrategy.platformRoles", value: { xiaohongshu: "场景触达", wechat: "深度论证" }, status: "confirmed" },
  { id: "c8", fieldPath: "accountStrategy.contentResources", value: { knowledgeAssetIds: ["folder_1"] }, status: "confirmed" },
  { id: "c9", fieldPath: "accountStrategy.constraints", value: ["不虚构案例"], status: "confirmed" }
];
const bundle = assembleStrategyInputBundle({ account: { id: "bridge_company", name: "桥接测试公司" }, claims, facts: [] });
const document = createStrategyDocumentV2({ accountId: "bridge_company", claims, strategyInputBundle: bundle, suggestion: {} });
document.strategy.audiences[0] = {
  ...document.strategy.audiences[0],
  jobsToBeDone: ["把散落的企业资料变成可持续维护的业务知识"],
  painPoints: ["知识库项目经常停在一次性资料搬运"],
  buyingTriggers: ["跨团队反复回答同一类客户问题"],
  commonObjections: ["担心知识治理投入大、短期看不到结果"],
  contentNeeds: ["能判断知识库项目是否值得启动的清单"]
};
document.strategy.contentSystem.pillars[0] = {
  ...document.strategy.contentSystem.pillars[0],
  strategicPurpose: "先解释知识治理责任，再讨论系统建设",
  typicalProblems: ["资料上传后无人维护，答案很快失效"],
  evidenceRequirement: "authorized_case_evidence",
  preferredSourceTypes: ["knowledge_base", "user_material"],
  excludedAngles: ["把知识库描述成上传文件即可自动见效"]
};
document.strategy.messageArchitecture = {
  ...document.strategy.messageArchitecture,
  coreMessage: "企业知识库的起点是责任与流程，而不是搬运资料",
  supportingMessages: [{ id: "message_governance", text: "先明确知识分类、责任人和更新机制" }],
  phrasesToAvoid: ["一键解决所有知识问题"]
};
document.strategy.platformPlaybooks.xiaohongshu = {
  ...document.strategy.platformPlaybooks.xiaohongshu,
  role: "用高频业务场景触发管理者自查",
  constraints: ["先给判断标准，再给产品承接"]
};
document.strategy.riskPolicy.forbiddenClaims.push("不得承诺知识库上线后立即降本");
document.strategyExtensions.accountGrowthStrategies = [{
  socialAccountId: "social_bridge",
  selectedPlaybookId: "playbook_problem_diagnosis",
  playbookVersion: "1.0",
  growthMode: "problem_diagnosis",
  accountIdentity: { id: "identity_social_bridge", subjectType: "company_official", speakerType: "brand_official", trustSources: ["professional_knowledge"] },
  hotspotPolicy: { unrelatedAllowed: false, autoDeleteHistoricalContent: false },
  experimentPlan: { id: "experiment_objection", hypothesis: "具体业务阻力比泛知识科普更能带来收藏", windowDays: 14, exitConditions: ["连续三篇收藏率无改善"] }
}];
document.strategyExtensions.selectedGrowthPlaybooks = [{
  socialAccountId: "social_bridge",
  playbookId: "playbook_problem_diagnosis",
  playbookVersion: "1.0"
}];
document.strategyExtensions.experimentPlans = [{
  id: "experiment_objection",
  socialAccountId: "social_bridge",
  playbookId: "playbook_problem_diagnosis",
  hypothesis: "具体业务阻力比泛知识科普更能带来收藏",
  windowDays: 14,
  exitConditions: ["连续三篇收藏率无改善"]
}];
const factSnapshot = { schemaVersion: "1.0", id: "facts_bridge", factSnapshotId: "facts_bridge", accountId: "bridge_company", factRevision: 0, capturedAt: new Date().toISOString(), usableFacts: [], contextOnlyFacts: [], forbiddenFacts: [], missingFacts: [] };
const plan = planNextContent({ strategySnapshot: { id: "strategy_bridge", version: 3, accountId: "bridge_company", socialAccountId: "social_bridge", payload: document }, factSnapshot, platform: "xiaohongshu", knowledgeItems: [{ id: "case_asset_1", name: "已授权案例" }], userRequest: { topic: "企业知识库项目为什么经常停在资料搬运", contentPurposeId: "case_result_showcase", promotionMode: "soft", preferredSourceMode: "knowledge", format: "case" } });
const recommendation = plan.recommendations[0];
assert.equal(plan.strategyContext.contentFunctionPolicy.reviewWindowDays, 30);
assert.ok(plan.strategyContext.conversionLadder.stages.length >= 4);
assert.equal(recommendation.contentFunction, "proof");
assert.equal(recommendation.contentDirectionCard.contentPurposeId, "case_result_showcase");
assert.equal(recommendation.contentDirectionCard.promotionMode, "soft");
assert.equal(recommendation.contentExecutionContext.contentIntentProfile.selectedBy, "user");
assert.equal(recommendation.contentExecutionContext.contentIntentProfile.purposeEligibility.eligible, true);
assert.ok(recommendation.contentExecutionContext.contentIntentProfile.conversionStage);
assert.equal(recommendation.topic, "企业知识库项目为什么经常停在资料搬运", "用户明确主题必须优先");
assert.equal(recommendation.contentDirectionCard.contentPurposeId, "case_result_showcase", "用户明确目的必须优先");
assert.equal(recommendation.audienceProblem, "知识库项目经常停在一次性资料搬运");
assert.equal(recommendation.coreClaim, "企业知识库的起点是责任与流程，而不是搬运资料");
assert.equal(recommendation.editorialDecisionBrief.projectionMode, "strategy_semantic_projection");
assert.equal(recommendation.editorialDecisionBrief.audience.buyingTrigger, "跨团队反复回答同一类客户问题");
assert.equal(recommendation.editorialDecisionBrief.distribution.growthPlaybookId, "playbook_problem_diagnosis");
assert.equal(recommendation.editorialDecisionBrief.distribution.experimentPlanId, "experiment_objection");
assert.ok(recommendation.editorialDecisionBrief.sourceAndEvidence.requirements.includes("authorized_case_evidence"));
assert.ok(recommendation.editorialDecisionBrief.boundaries.forbiddenAngles.includes("不得承诺知识库上线后立即降本"));
assert.ok(recommendation.editorialDecisionBrief.boundaries.forbiddenAngles.includes("把知识库描述成上传文件即可自动见效"));

const alternateDocument = structuredClone(document);
alternateDocument.strategy.audiences[0] = {
  ...alternateDocument.strategy.audiences[0],
  id: "audience_operator",
  name: "一线知识运营负责人",
  jobsToBeDone: ["建立每周知识更新与失效清理机制"],
  painPoints: ["没有责任人持续维护知识条目"],
  buyingTriggers: ["客服引用了已经失效的制度答案"],
  commonObjections: ["业务团队不愿额外维护"],
  contentNeeds: ["低成本建立更新责任制的方法"]
};
alternateDocument.strategy.contentSystem.pillars[0] = {
  ...alternateDocument.strategy.contentSystem.pillars[0],
  id: "pillar_maintenance",
  name: "知识运营机制",
  strategicPurpose: "帮助一线运营建立可持续更新节奏",
  typicalProblems: ["知识失效后没有人负责下线"],
  excludedAngles: ["只讨论采购系统"]
};
alternateDocument.strategy.messageArchitecture.coreMessage = "知识库能否持续有效，取决于日常更新机制";
alternateDocument.strategyExtensions.accountGrowthStrategies[0].selectedPlaybookId = "playbook_howto_routine";
alternateDocument.strategyExtensions.accountGrowthStrategies[0].experimentPlan = {
  id: "experiment_checklist",
  hypothesis: "周更清单比观念文章更能带来转发",
  windowDays: 14,
  exitConditions: ["转发率无改善"]
};
alternateDocument.strategyExtensions.experimentPlans[0] = {
  id: "experiment_checklist",
  socialAccountId: "social_bridge",
  playbookId: "playbook_howto_routine",
  hypothesis: "周更清单比观念文章更能带来转发",
  windowDays: 14,
  exitConditions: ["转发率无改善"]
};
const alternatePlan = planNextContent({
  strategySnapshot: { id: "strategy_bridge_alt", version: 4, accountId: "bridge_company", socialAccountId: "social_bridge", payload: alternateDocument },
  factSnapshot,
  platform: "xiaohongshu",
  knowledgeItems: [{ id: "case_asset_1", name: "已授权案例" }],
  userRequest: { topic: "知识库每周维护该怎么做", contentPurposeId: "knowledge_howto", preferredSourceMode: "knowledge", format: "howto" }
});
assert.notEqual(alternatePlan.recommendations[0].audienceProblem, recommendation.audienceProblem);
assert.notEqual(alternatePlan.recommendations[0].coreClaim, recommendation.coreClaim);
assert.notEqual(alternatePlan.recommendations[0].editorialDecisionBrief.distribution.growthPlaybookId, recommendation.editorialDecisionBrief.distribution.growthPlaybookId);
assert.notEqual(alternatePlan.recommendations[0].contentDirectionCard.audienceProblem, recommendation.contentDirectionCard.audienceProblem);
assert.notEqual(alternatePlan.recommendations[0].contentDirectionCard.coreClaim, recommendation.contentDirectionCard.coreClaim);
assert.notEqual(alternatePlan.recommendations[0].contentDirectionCard.growthPlaybookId, recommendation.contentDirectionCard.growthPlaybookId);
assert.equal(resolveEditorialDecisionBrief({}).projectionMode, "legacy_projection", "历史运行缺少新投影时必须兼容读取");

const activeStrategySnapshot = {
  schemaVersion: "2.0",
  id: "strategy_bridge",
  accountId: "bridge_company",
  status: "active",
  version: 1,
  sourceDraftRevisionId: "draft_bridge_1",
  documentHash: "document_hash_bridge",
  contextHash: "context_hash_bridge",
  activatedAt: new Date().toISOString(),
  document
};
const ownership = { workspaceId: "workspace_bridge", companyId: "bridge_company", socialAccountId: "social_bridge" };
const store = { contentTasks: [], contentRuns: [], contentWorkflows: [], contentPublications: [], hotspotLibrary: [], referenceAnalyses: [] };
const bridgeResult = createRunFromActiveStrategy({
  store,
  payload: {
    platform: "xiaohongshu",
    recommendationId: "candidate_user_directed",
    expectedStrategySnapshotId: activeStrategySnapshot.id,
    expectedDirectionCardId: recommendation.contentDirectionCard.id,
    userRequest: { topic: "企业知识库项目为什么经常停在资料搬运", contentPurposeId: "case_result_showcase", promotionMode: "soft", preferredSourceMode: "knowledge", format: "case" }
  },
  ownership,
  activeStrategySnapshot,
  currentFacts: [],
  factSnapshot,
  knowledgeItems: [{ id: "case_asset_1", name: "已授权案例" }]
});
assert.equal(bridgeResult.workflow.strategySnapshotId, activeStrategySnapshot.id);
assert.equal(bridgeResult.workflow.factSnapshotId, factSnapshot.id);
assert.equal(bridgeResult.workflow.directionCardId, recommendation.contentDirectionCard.id);
assert.equal(bridgeResult.workflow.bridge.kind, "StrategyContentBridge");
assert.equal(bridgeResult.workflow.generationPayload.contentExecutionContext.strategySnapshotId, activeStrategySnapshot.id);
assert.equal(bridgeResult.workflow.editorialDecisionSnapshot.kind, "EditorialDecisionBrief");
assert.equal(bridgeResult.workflow.strategyProjectionSnapshot.strategySnapshotId, activeStrategySnapshot.id);
assert.equal(bridgeResult.workflow.growthPlaybookSnapshot.selectedPlaybookId, "playbook_problem_diagnosis");
assert.equal(bridgeResult.workflow.experimentSnapshot.id, "experiment_objection");
assert.equal(store.contentRuns.length, 1, "the bridge must create exactly one persisted ContentRun");
assert.throws(() => createRunFromActiveStrategy({
  store,
  payload: { platform: "xiaohongshu", expectedStrategySnapshotId: "strategy_old" },
  ownership,
  activeStrategySnapshot,
  factSnapshot,
  knowledgeItems: [{ id: "case_asset_1", name: "已授权案例" }]
}), (error) => error.code === "STRATEGY_PLAN_STALE");
assert.throws(() => createRunFromActiveStrategy({
  store,
  payload: {
    platform: "xiaohongshu",
    recommendationId: "candidate_user_directed",
    expectedStrategySnapshotId: activeStrategySnapshot.id,
    expectedDirectionCardId: "direction_stale",
    userRequest: { topic: "企业知识库项目为什么经常停在资料搬运", contentPurposeId: "case_result_showcase", promotionMode: "soft", preferredSourceMode: "knowledge", format: "case" }
  },
  ownership,
  activeStrategySnapshot,
  factSnapshot,
  knowledgeItems: [{ id: "case_asset_1", name: "已授权案例" }]
}), (error) => error.code === "CONTENT_DIRECTION_STALE");

const captured = [];
const prepared = await prepareContentMaster({ payload: recommendation.generationPayload, selection: null, intentProfile: { profile_id: "intent_bridge", topic_id: null, platform: "xiaohongshu", purpose: { id: "case_result_showcase", label: "案例/成果展示", description: "用真实案例证明能力" }, promotion: { mode: "soft", knowledge_enabled: true, knowledge_asset_ids: ["case_asset_1"], knowledge_snapshot_id: "knowledge_bridge", insertion_rule: "value_first_natural_context" }, engagement_policy: { mode: "auto", selected_primary_action: "model_selected", optimize_for: ["save", "share", "comment", "follow", "conversion"] }, strategy_alignment: { content_function: "proof", conversion_stage: recommendation.contentDirectionCard.conversionStage } }, citations: [{ citationId: "K1", fileId: "case_asset_1", fileName: "已授权案例", chunkId: "chunk_1", text: "项目先完成知识分类和责任人确认，再进入系统搭建。" }], knowledgeAssets: [{ id: "case_asset_1", name: "已授权案例" }], contentTaskBrief: recommendation.contentTaskBrief, contentSourcePlan: recommendation.sourcePlan, factSnapshot }, { generateText: async (request, fallback) => { captured.push(request); const response = structuredClone(fallback); response.data.engagement_policy = { ...response.data.engagement_policy, selected_primary_action: "share" }; return { mode: "bridge_test", data: response }; } });
assert.equal(captured[0].input.content_execution_context.id, recommendation.contentExecutionContext.id);
assert.equal(captured[0].input.content_execution_context.writingBrief.coreClaim, "企业知识库的起点是责任与流程，而不是搬运资料");
assert.equal(captured[0].input.content_task_brief.writingBrief.audienceProblem, "知识库项目经常停在一次性资料搬运");
assert.equal("conversation" in captured[0].input.content_execution_context.editorialDecisionBrief, false, "写作输入不得携带策略对话内部状态");
assert.equal(prepared.contentMaster.strategy_alignment.content_function, "proof");
assert.equal(prepared.contentMaster.engagement_policy.selected_primary_action, "share", "valid model-selected action must not be overwritten");

console.log(JSON.stringify({ status: "content-agent-strategy-bridge-self-test passed", contentFunction: recommendation.contentFunction, purpose: recommendation.contentDirectionCard.contentPurposeId, conversionStage: recommendation.contentDirectionCard.conversionStage, contentRunId: bridgeResult.workflow.id, strategySnapshotId: bridgeResult.workflow.strategySnapshotId, selectedPrimaryAction: prepared.contentMaster.engagement_policy.selected_primary_action }, null, 2));

