import assert from "node:assert/strict";
import {
  adaptAccountPortfolioV1,
  assertSharedContract,
  validateActiveStrategySnapshotV2,
  validateContentDirectionCardV1,
  validateContentExecutionContextV1,
  validateContentStrategyProfileV1,
  validateFactSnapshotV1,
  validateStrategyDocumentV2
} from "../../contracts/strategy-content-contracts.mjs";
import { validateStrategySnapshotContract } from "../../content-agent/contracts.mjs";
import { projectStrategyForContent } from "../../content-agent/strategy-adapter.mjs";
import { resolveEffectiveAccountStrategy } from "../../content-agent/strategy-hierarchy.mjs";

const document = {
  schemaVersion: "2.0",
  accountId: "account_contract_test",
  business: {
    businessModel: "企业服务",
    valueProposition: "把企业业务知识转化为可执行任务的 AI 员工",
    offers: [{ id: "offer_knowledge", name: "企业知识库打造", problemsSolved: ["知识分散"], targetAudienceIds: ["audience_owner"] }]
  },
  strategy: {
    growthStage: "account_setup",
    operatingMode: "guided",
    objectives: [{ id: "objective_authority", type: "authority", label: "建立专业认知", weight: 60 }, { id: "objective_leads", type: "lead_capture", label: "获得有效咨询", weight: 40 }],
    primaryObjectiveId: "objective_authority",
    positioning: { category: "企业 AI 应用落地服务", positioningStatement: "面向企业真实岗位交付 AI 应用", differentiators: ["从业务场景出发"] },
    audiences: [{ id: "audience_owner", name: "成长型企业负责人", priority: 1, decisionRoles: ["老板"], jobsToBeDone: ["寻找AI落地路径"], painPoints: ["不知道从哪个岗位开始"], buyingTriggers: ["业务增长受限"], commonObjections: ["担心员工不会用"], contentNeeds: ["场景和案例"] }],
    messageArchitecture: { coreMessage: "AI 应进入真实岗位", supportingMessages: [], misconceptionsToCorrect: [] },
    contentSystem: {
      pillars: [{ id: "pillar_job_ai", name: "岗位 AI 落地", strategicPurpose: "建立场景化专业认知", objectiveIds: ["objective_authority"], audienceIds: ["audience_owner"], recommendedContentFunctions: ["authority", "proof"] }],
      portfolio: { discovery: 15, authority: 35, proof: 20, solution: 20, action: 10 }
    },
    platformPlaybooks: {
      xiaohongshu: { role: "场景触达与认知建立", priorityAudienceIds: ["audience_owner"], objectivePriorities: ["authority"], constraints: [] },
      wechat: { role: "深度论证与信任沉淀", priorityAudienceIds: ["audience_owner"], objectivePriorities: ["authority", "lead_capture"], constraints: [] }
    },
    conversionSystem: { primaryPath: { id: "path_consult", steps: ["阅读", "咨询", "诊断"] }, platformPaths: {}, ctaOptions: [] },
    evidencePolicy: { defaultVisibility: "internal_only", knowledgeFolderIds: [], claimRules: [] },
    riskPolicy: { forbiddenClaims: [], sensitiveTopics: [], mandatoryDisclosures: [] }
  },
  governance: { confirmedClaimIds: [], strategyFactIds: [], knowledgeSourceIds: [], hypotheses: [], conflicts: [], missingInformation: [], sourceContextHash: "context_hash_test" }
};

assertSharedContract(validateStrategyDocumentV2(document));

const snapshot = { schemaVersion: "2.0", id: "strategy_1", accountId: document.accountId, version: 1, status: "active", sourceDraftRevisionId: "draft_1", documentHash: "document_hash", contextHash: "context_hash_test", activatedAt: new Date().toISOString(), document };
assertSharedContract(validateActiveStrategySnapshotV2(snapshot));
assert.equal(validateStrategySnapshotContract(snapshot).valid, true);
const mismatchedSnapshot = structuredClone(snapshot);
mismatchedSnapshot.accountId = "different_company";
assert.equal(validateActiveStrategySnapshotV2(mismatchedSnapshot).valid, false);
assert.ok(validateActiveStrategySnapshotV2(mismatchedSnapshot).errors.some((item) => item.path === "document.accountId"));
const payloadSnapshot = { ...snapshot, document: undefined, payload: structuredClone(document) };
assertSharedContract(validateActiveStrategySnapshotV2(payloadSnapshot));
payloadSnapshot.payload.accountId = "different_company";
assert.equal(validateActiveStrategySnapshotV2(payloadSnapshot).valid, false);

const legacyMigrationEffective = resolveEffectiveAccountStrategy({
  baseSnapshot: snapshot,
  matrixSnapshot: null,
  accountSnapshot: {
    id: "legacy_account_strategy",
    source: "migration_default",
    version: 1,
    payload: {
      subjectType: "company_official",
      accountMode: "professional_lead",
      growthPlaybook: "steady_vertical",
      audiences: [{ id: "legacy_audience", name: "旧账号受众", priority: 1 }],
      contentPillars: [{ id: "legacy_pillar", name: "旧账号方向" }],
      platformPlaybook: { role: "旧平台描述" }
    }
  },
  ownership: {
    workspaceId: "workspace_default",
    companyId: document.accountId,
    socialAccountId: "social_xhs",
    socialAccount: { id: "social_xhs", platform: "xiaohongshu" }
  }
});
assertSharedContract(validateActiveStrategySnapshotV2(legacyMigrationEffective));
assert.equal(legacyMigrationEffective.document.strategy.audiences[0].id, "audience_owner");
assert.equal(legacyMigrationEffective.document.strategy.contentSystem.pillars[0].id, "pillar_job_ai");
assert.equal(legacyMigrationEffective.document.strategy.platformPlaybooks.xiaohongshu.role, "场景触达与认知建立");
assert.equal(legacyMigrationEffective.document.strategy.accountPolicy.subjectType, "company_official");

const accountSettingsEffective = resolveEffectiveAccountStrategy({
  baseSnapshot: snapshot,
  matrixSnapshot: null,
  accountSnapshot: {
    id: "account_settings_strategy",
    source: "account_settings_confirmed",
    version: 2,
    payload: {
      subjectType: "company_official",
      accountMode: "professional_lead",
      growthPlaybook: "steady_vertical",
      audiences: [{ id: "settings_audience", name: "设置页受众", priority: 1 }],
      contentPillars: [{ id: "settings_pillar", name: "设置页方向" }],
      platformPlaybook: { role: "设置页平台描述" }
    }
  },
  ownership: {
    workspaceId: "workspace_default",
    companyId: document.accountId,
    socialAccountId: "social_xhs",
    socialAccount: { id: "social_xhs", platform: "xiaohongshu" }
  }
});
assertSharedContract(validateActiveStrategySnapshotV2(accountSettingsEffective));
assert.equal(accountSettingsEffective.document.strategy.audiences[0].id, "audience_owner");
assert.equal(accountSettingsEffective.document.strategy.contentSystem.pillars[0].id, "pillar_job_ai");
assert.equal(accountSettingsEffective.document.strategy.platformPlaybooks.xiaohongshu.role, "场景触达与认知建立");

const factSnapshot = { schemaVersion: "1.0", id: "facts_1", accountId: document.accountId, factRevision: 1, capturedAt: new Date().toISOString(), usableFacts: [{ id: "fact_1", key: "audience.pain_points", value: ["不知道从哪个岗位开始"], strategyImpact: "strategy", platformScope: ["xiaohongshu", "wechat"], sourceType: "user_confirmed", visibility: "public", contentUsage: "allowed" }], contextOnlyFacts: [], forbiddenFacts: [], missingFacts: [] };
assertSharedContract(validateFactSnapshotV1(factSnapshot));

const profile = { schemaVersion: "1.0", strategySnapshotId: snapshot.id, factSnapshotId: factSnapshot.id, accountId: document.accountId, accountStage: "account_setup", businessModel: "企业服务", offers: document.business.offers, valueProposition: document.business.valueProposition, primaryObjectiveId: "objective_authority", objectives: document.strategy.objectives, audiences: document.strategy.audiences, contentPillars: document.strategy.contentSystem.pillars, contentFunctionPortfolio: document.strategy.contentSystem.portfolio, platformPlaybooks: document.strategy.platformPlaybooks, conversionSystem: document.strategy.conversionSystem, evidencePolicy: document.strategy.evidencePolicy, riskPolicy: document.strategy.riskPolicy, factSnapshot };
assertSharedContract(validateContentStrategyProfileV1(profile));

const projected = projectStrategyForContent(snapshot, []);
assertSharedContract(validateContentStrategyProfileV1(projected));
assert.equal(projected.sourceStrategySchemaVersion, "2.0");
assert.equal(projected.primaryObjectiveId, "objective_authority");
assert.equal(Object.values(projected.contentPortfolio).reduce((sum, value) => sum + value, 0), 100);

const directionCard = { schemaVersion: "1.0", id: "direction_1", strategySnapshotId: snapshot.id, platform: "xiaohongshu", objectiveId: "objective_authority", contentFunction: "authority", pillarId: "pillar_job_ai", audienceId: "audience_owner", messageIds: [], offerIds: [], topic: "企业应该从哪个岗位开始落地 AI", angle: "岗位选择清单", coreClaim: "先选择高频、标准化且可验证的岗位任务" };
assertSharedContract(validateContentDirectionCardV1(directionCard));

const execution = { schemaVersion: "1.0", id: "execution_1", companyId: document.accountId, socialAccountId: "social_xhs", strategySnapshotId: snapshot.id, factSnapshotId: factSnapshot.id, knowledgeSnapshotId: "knowledge_1", accountContext: { workspaceId: "workspace_default", companyId: document.accountId, socialAccountId: "social_xhs", platform: "xiaohongshu", strategySnapshotId: snapshot.id, selectionSource: "user_confirmed" }, directionCard, contentIntentProfile: { profile_id: "intent_1" }, sourcePlan: { sources: [] }, resolvedPolicies: {}, userOverrides: {}, createdAt: new Date().toISOString() };
assertSharedContract(validateContentExecutionContextV1(execution));
const historicalExecution = structuredClone(execution);
delete historicalExecution.companyId;
delete historicalExecution.socialAccountId;
delete historicalExecution.accountContext;
assertSharedContract(validateContentExecutionContextV1(historicalExecution));
for (const [field, value] of [["companyId", "different_company"], ["socialAccountId", "different_social"], ["strategySnapshotId", "different_strategy"]]) {
  const mismatchedExecution = structuredClone(execution);
  mismatchedExecution.accountContext[field] = value;
  const validation = validateContentExecutionContextV1(mismatchedExecution);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.path === `accountContext.${field}`));
}

const invalid = structuredClone(document);
invalid.strategy.contentSystem.portfolio.action = 11;
assert.equal(validateStrategyDocumentV2(invalid).valid, false);
const legacyMatrix=adaptAccountPortfolioV1({mode:"role_matrix",selectedSocialAccountIds:["legacy_only"],primarySocialAccountId:"legacy_only",accountRoles:{legacy_only:"primary"}},[{socialAccountId:"legacy_only"}]);
assert.equal(legacyMatrix.compatibilityStatus,"compatibility_required","historical invalid matrix must remain readable but require explicit repair");

console.log(JSON.stringify({ status: "strategy-content-contract-self-test passed", contracts: ["StrategyDocument@2.0", "ActiveStrategySnapshot@2.0", "FactSnapshot@1.0", "ContentStrategyProfile@1.0", "ContentDirectionCard@1.0", "ContentExecutionContext@1.0"] }, null, 2));

