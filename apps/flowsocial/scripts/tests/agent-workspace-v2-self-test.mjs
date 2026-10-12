import assert from "node:assert/strict";
import { database } from "../../storage.mjs";
import { decideAgentRecommendation, recordDiagnosticAnalysis } from "../../strategy-agent/agent-orchestrator.mjs";
import { createAgentRecommendation, createDiagnosticQuestion, createDiagnosticSession, getDiagnosticSessionMeta, getLatestStrategyDraftRevision, listCurrentProfileClaims, listCurrentProfileFacts, saveStrategyDraftRevision, upsertDiagnosticCoverageState, upsertProfileClaim } from "../../strategy-agent/strategy-store.mjs";
import { coreFieldSpecs } from "../../strategy-agent/profile-coverage-registry.mjs";

const accountId = `test_workspace_${Date.now()}`;
const session = createDiagnosticSession({ accountId, mode: "quick" });

try {
  createDiagnosticQuestion({ sessionId: session.id, content: "用户如何从内容进入咨询？", targetFieldPaths: ["business.conversionPath"] });
  const recommendation = createAgentRecommendation({
    sessionId: session.id,
    accountId,
    targetFieldPath: "business.conversionPath",
    recommendedValue: "内容 → 私信 → 企微 → 演示",
    alternatives: ["内容 → 官网表单 → 销售跟进 → 需求诊断"]
  });
  const alternative = recommendation.options[1];
  const accepted = decideAgentRecommendation({ sessionId: session.id, recommendationId: recommendation.id, action: "accept", optionId: alternative.optionId });
  assert.equal(accepted.recommendation.status, "accepted");
  assert.deepEqual(listCurrentProfileClaims(session.id).find((item) => item.fieldPath === "business.conversionPath").value.steps, ["内容", "官网表单", "销售跟进", "需求诊断"]);

  createDiagnosticQuestion({ sessionId: session.id, content: "未来三个月的账号目标是什么？", targetFieldPaths: ["accountStrategy.primaryGoal"] });
  const goalRecommendation = createAgentRecommendation({ sessionId: session.id, accountId, targetFieldPath: "accountStrategy.primaryGoal", recommendedValue: "获得企业咨询" });
  decideAgentRecommendation({ sessionId: session.id, recommendationId: goalRecommendation.id, action: "accept_with_changes", optionId: goalRecommendation.options[0].optionId, modifiedValue: "未来三个月获得20条有效企业咨询" });
  assert.equal(listCurrentProfileClaims(session.id).find((item) => item.fieldPath === "accountStrategy.primaryGoal").value, "未来三个月获得20条有效企业咨询");

  const requiredValues = {
    "business.primaryOffers": ["企业知识库"],
    "business.businessModel": "SaaS订阅与私有化交付",
    "audiences.primary": { summary: "SaaS成长期企业的客户成功负责人" },
    "accountStrategy.growthStage": "launch",
    "accountStrategy.platformRoles": { xiaohongshu: "场景触达", wechat: "深度信任" },
    "accountStrategy.contentResources": { summary: "产品资料和SOP", publicUsage: "anonymized" },
    "accountStrategy.constraints": ["不虚构数据"]
  };
  for (const [fieldPath, value] of Object.entries(requiredValues)) upsertProfileClaim({ sessionId: session.id, fieldPath, value, sourceType: "user_statement", sourceRef: `complete_${fieldPath}`, confidence: 1, status: "confirmed" });
  for (const [fieldPath,spec] of Object.entries(coreFieldSpecs)) upsertDiagnosticCoverageState({ sessionId:session.id,targetType:"core_field",targetId:fieldPath,capturedSlots:spec.slots.filter((item)=>item.required).map((item)=>({slot:item.id,value:"测试确认",confidence:1,source:"test"})),missingRequiredSlots:[],missingOptionalSlots:[],status:"confirmed",strategyReady:true,contentReady:true,attempts:1,assessment:{source:"test"} });
  recordDiagnosticAnalysis({ sessionId: session.id, userMessage: "核心信息确认完成。", analysis: { intent: "direct_answer", intentConfidence: 1, coreClaimOperations: [], discoveredFactOperations: [], answerAssessment: { status: "answered", answeredFieldPaths: [], remainingGaps: [] }, acknowledgement: "核心信息已确认。" } });
  assert.equal(getDiagnosticSessionMeta(session.id).conversationPhase, "core_complete");

  saveStrategyDraftRevision({ sessionId: session.id, accountId, draft: { business: {}, accountStrategy: {} }, validation: { valid: true }, providerMode: "test" });
  upsertProfileClaim({ sessionId: session.id, fieldPath: "accountStrategy.constraints", value: ["不虚构数据"], sourceType: "user_statement", sourceRef: "test", confidence: 1, status: "confirmed" });
  assert.equal(getLatestStrategyDraftRevision(session.id).stale, true);

  recordDiagnosticAnalysis({ sessionId: session.id, userMessage: "我们还有一套客户成功培训SOP。", analysis: { intent: "direct_answer", intentConfidence: 1, coreClaimOperations: [], discoveredFactOperations: [{ operation: "create", factKey: "test.training_sop", factType: "content_resource", predicate: "has_training_sop", value: { summary: "客户成功培训SOP" }, confidence: 1 }], answerAssessment: { status: "answered", answeredFieldPaths: [], remainingGaps: [] }, acknowledgement: "已记录这项补充。" } });
  assert.equal(listCurrentProfileFacts(accountId).some((item) => item.factKey === "test.training_sop"), true);

  console.log(JSON.stringify({ status: "passed", recommendationOption: alternative.completeValue, modifiedGoal: "未来三个月获得20条有效企业咨询", conversationPhase: "core_complete", draftStale: true, postCompletionFactStored: true }, null, 2));
} finally {
  database.prepare("DELETE FROM diagnostic_sessions WHERE id = ?").run(session.id);
  database.prepare("DELETE FROM profile_fact_events WHERE account_id = ?").run(accountId);
  database.prepare("DELETE FROM profile_current_facts WHERE account_id = ?").run(accountId);
}

