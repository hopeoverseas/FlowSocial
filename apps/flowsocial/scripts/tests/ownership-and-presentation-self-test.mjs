import assert from "node:assert/strict";
import { ensureWorkspaceContext, resolveOwnershipContext } from "../../workspace-context.mjs";
import { buildDiagnosticSummary, naturalRecommendationAcceptedMessage } from "../../strategy-agent/strategy-presentation.mjs";
import { createContentDirectionCard, createContentExecutionContext } from "../../content-agent/execution-context.mjs";

const store = ensureWorkspaceContext({
  accounts: [
    { id: "company_a", name: "公司A", accountType: "company" },
    { id: "company_b", name: "公司B", accountType: "company" },
    { id: "xhs_a", name: "A小红书", platform: "xiaohongshu", companyId: "company_a" },
    { id: "wx_b", name: "B公众号", platform: "wechat", companyId: "company_b" }
  ],
  contentTasks: []
});

const ownershipA = resolveOwnershipContext(store, { accountId: "xhs_a" });
const ownershipB = resolveOwnershipContext(store, { accountId: "wx_b" });
assert.equal(ownershipA.companyId, "company_a");
assert.equal(ownershipB.companyId, "company_b");
assert.notEqual(ownershipA.companyId, ownershipB.companyId);

const summary = buildDiagnosticSummary({
  claims: [{ fieldPath: "business.primaryOffers", value: ["咨询服务"], status: "confirmed" }],
  fieldStates: [{ fieldPath: "business.primaryOffers", state: "confirmed" }],
  coverageStates: [{ targetType: "core_field", targetId: "business.primaryOffers", strategyReady: true, contentReady: true, capturedSlots: ["offerNames"], missingRequiredSlots: [] }]
});
assert.equal(summary.total, 9);
assert.equal(summary.processed, 1);
assert.equal(summary.strategyReady, 1);

const accepted = naturalRecommendationAcceptedMessage({
  fieldPath: "accountStrategy.primaryGoal",
  value: { primaryOutcome: "获得高质量咨询", timeHorizon: "90天", successSignals: ["每月30条有效线索"] },
  nextMessage: "接下来确认平台分工。"
});
assert.ok(!accepted.includes("{"));
assert.ok(!accepted.includes("[object Object]"));

const strategyContext = {
  workspaceId: ownershipA.workspaceId,
  companyId: ownershipA.companyId,
  socialAccountId: ownershipA.socialAccountId,
  strategySnapshotId: "strategy_a_v2",
  factSnapshotId: "facts_a_v3",
  contentPillars: [{ id:"pillar_a",name:"行业方法" }],
  audiences: [{ id:"audience_a",name:"企业负责人" }],
  primaryObjectiveId:"objective_a",
  messageArchitecture:{ supportingMessages:[] },
  offers:[],platformPlaybooks:{},evidencePolicy:{},riskPolicy:{}
};
const recommendation={ topic:"企业增长方法",angle:"从可执行步骤切入",coreClaim:"方法必须与业务目标对应",format:"checklist",contentRole:"trust",contentPillar:"pillar_a",targetAudience:"audience_a",sourcePlan:{schemaVersion:"0.1",sources:[]},generationPayload:{contentPurposeId:"knowledge_share",promotionMode:"none"} };
const directionCard=createContentDirectionCard({strategyContext,recommendation,platform:"xiaohongshu"});
const context = createContentExecutionContext({strategyContext,directionCard,recommendation});
assert.equal(context.companyId, "company_a");
assert.equal(context.socialAccountId, "xhs_a");
assert.equal(context.strategySnapshotId, "strategy_a_v2");

console.log(JSON.stringify({ status: "ownership-and-presentation-self-test passed", ownershipIsolation: true, canonicalCoreTotal: summary.total, naturalDisplay: true, frozenExecutionOwnership: { companyId: context.companyId, socialAccountId: context.socialAccountId } }, null, 2));

