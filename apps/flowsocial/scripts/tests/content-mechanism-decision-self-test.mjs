import assert from "node:assert/strict";
import { planContentSources } from "../../content-agent/source-planner.mjs";
import {
  beginOutline,
  createContentWorkflow
} from "../../content-agent/workflow-engine.mjs";
import { validateContentMechanismDecision } from "../../content-agent/unified-content-contracts.mjs";

const brief = {
  schemaVersion: "0.1",
  strategySnapshotId: "strategy_001",
  factSnapshotId: "facts_001",
  accountId: "account_001",
  platform: "xiaohongshu",
  contentPillar: "岗位AI应用场景",
  contentRole: "traffic",
  contentFunction: "discovery",
  contentPurposeId: "trend_interpretation",
  targetAudience: "企业管理者",
  audienceProblem: "不知道如何判断 AI 热点",
  coreClaim: "热点必须服从业务事实边界",
  topic: "企业如何判断 AI 热点是否值得跟进",
  angle: "决策清单",
  format: "checklist",
  riskBoundaries: [],
  generationMode: "recommended"
};

function strategyContext(policy = "optional") {
  return {
    accountId: "account_001",
    companyId: "company_001",
    strategySnapshotId: "strategy_001",
    strategyDecisionHash: "strategy-hash-input",
    strategyHotspotPolicy: policy,
    knowledgeFolderIds: [],
    factSnapshot: {
      usableFacts: [{ id: "fact_001", value: "用户确认的业务事实" }],
      contextOnlyFacts: [],
      forbiddenFacts: [],
      missingFacts: []
    }
  };
}

const hotspot = {
  id: "hotspot_001",
  title: "企业 AI Agent 进入务实评估阶段",
  summary: "外部事件背景",
  status: "recommended",
  relevanceTier: "direct"
};
const knowledge = { id: "knowledge_001", title: "企业内部落地手册" };

const hotspotPlan = planContentSources({
  brief,
  strategyContext: strategyContext("preferred"),
  hotspots: [hotspot],
  knowledgeItems: [knowledge],
  preferredMode: "hotspot"
});
validateContentMechanismDecision(hotspotPlan.mechanismDecision);
assert.equal(hotspotPlan.mechanismDecision.selectedMechanism, "hotspot");
assert.equal(hotspotPlan.mechanismDecision.deviation.status, "none");
assert.equal(hotspotPlan.mechanismDecision.evaluated.find((item) => item.mechanism === "hotspot").factPolicy, "external_event_not_business_fact");
assert.ok(hotspotPlan.mechanismDecision.evaluated.every((item) => ["selected", "rejected", "not_available"].includes(item.status)));

const knowledgePlan = planContentSources({
  brief,
  strategyContext: strategyContext("optional"),
  hotspots: [hotspot],
  knowledgeItems: [knowledge],
  preferredMode: "knowledge"
});
assert.equal(knowledgePlan.mechanismDecision.selectedMechanism, "knowledge");
assert.equal(knowledgePlan.mechanismDecision.evaluated.find((item) => item.mechanism === "hotspot").status, "rejected");
assert.match(knowledgePlan.mechanismDecision.evaluated.find((item) => item.mechanism === "hotspot").reason, /not_selected/);

const missingRequiredHotspotPlan = planContentSources({
  brief,
  strategyContext: strategyContext("required"),
  hotspots: [],
  knowledgeItems: [knowledge],
  preferredMode: "auto"
});
assert.equal(missingRequiredHotspotPlan.mechanismDecision.selectedMechanism, "knowledge");
assert.equal(missingRequiredHotspotPlan.mechanismDecision.deviation.status, "blocked");
assert.equal(missingRequiredHotspotPlan.mechanismDecision.deviation.userConfirmationStatus, "pending");
assert.equal(missingRequiredHotspotPlan.mechanismDecision.evaluated.find((item) => item.mechanism === "hotspot").status, "not_available");

const machineConfirmationPlan = planContentSources({
  brief,
  strategyContext: strategyContext("required"),
  hotspots: [],
  knowledgeItems: [knowledge],
  mechanismDecisionConfirmation: { status: "confirmed", confirmedByType: "machine_gate", eventRef: "gate_001" }
});
assert.equal(machineConfirmationPlan.mechanismDecision.deviation.userConfirmationStatus, "pending");

const userConfirmedPlan = planContentSources({
  brief,
  strategyContext: strategyContext("required"),
  hotspots: [],
  knowledgeItems: [knowledge],
  mechanismDecisionConfirmation: { status: "confirmed", confirmedByType: "user", eventRef: "user_event_001" }
});
assert.equal(userConfirmedPlan.mechanismDecision.deviation.status, "degraded");
assert.equal(userConfirmedPlan.mechanismDecision.deviation.userConfirmationStatus, "confirmed");

const forgedConfirmedPlan = structuredClone(userConfirmedPlan);
delete forgedConfirmedPlan.mechanismDecisionConfirmation;
assert.throws(() => createContentWorkflow({}, {
  accountId: brief.accountId,
  recommendation: { id: "recommendation_forged", topic: brief.topic, sourcePlan: forgedConfirmedPlan },
  generationPayload: {
    ideaTitle: brief.topic,
    platform: brief.platform,
    companyId: "company_001",
    strategySnapshotId: "strategy_001",
    contentTaskBrief: brief,
    contentSourcePlan: forgedConfirmedPlan
  }
}), (error) => error.code === "CONTENT_MECHANISM_CONFIRMATION_EVIDENCE_REQUIRED");

const store = {};
const workflow = createContentWorkflow(store, {
  accountId: brief.accountId,
  recommendation: { id: "recommendation_001", topic: brief.topic, sourcePlan: missingRequiredHotspotPlan },
  generationPayload: {
    ideaTitle: brief.topic,
    platform: brief.platform,
    companyId: "company_001",
    strategySnapshotId: "strategy_001",
    contentTaskBrief: brief,
    contentIdentity: { topic: brief.topic },
    contentSourcePlan: missingRequiredHotspotPlan
  }
});
assert.equal(workflow.contentMechanismDecision.decisionHash, missingRequiredHotspotPlan.mechanismDecision.decisionHash);
assert.equal(workflow.mechanismDecisionBinding.activeStrategySnapshotRef.id, "strategy_001");
assert.match(workflow.mechanismDecisionBinding.sharedContentMasterInputRef.id, /^shared_master_input:/);
assert.match(workflow.mechanismDecisionBinding.sourcePlanRef.hash, /^[a-f0-9]{64}$/);
assert.throws(() => beginOutline(workflow), (error) => error.code === "CONTENT_MECHANISM_USER_CONFIRMATION_REQUIRED");

const invalid = structuredClone(hotspotPlan.mechanismDecision);
invalid.evaluated.find((item) => item.mechanism === "hotspot").factPolicy = "business_fact";
assert.throws(() => validateContentMechanismDecision(invalid), (error) => error.code === "ContentMechanismDecision:HOTSPOT_FACT_POLICY");

const inconsistent = structuredClone(hotspotPlan.mechanismDecision);
inconsistent.selectedMechanism = "knowledge";
assert.throws(() => validateContentMechanismDecision(inconsistent), (error) => error.code === "ContentMechanismDecision:SELECTION_INCONSISTENT");

console.log(JSON.stringify({
  status: "content-mechanism-decision-self-test ok",
  scenarios: [
    "hotspot_selected",
    "hotspot_rejected",
    "hotspot_unavailable",
    "knowledge_priority",
    "strategy_deviation_pending",
    "explicit_user_confirmation",
    "machine_gate_not_confirmation",
    "invalid_hotspot_fact_policy"
  ]
}, null, 2));
