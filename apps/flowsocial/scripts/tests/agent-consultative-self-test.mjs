import assert from "node:assert/strict";
import { recordDiagnosticAnalysis, startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { createDiagnosticQuestion, getDiagnosticSessionMeta, getPendingAgentRecommendation, getPendingDiagnosticQuestion, listCurrentProfileClaims, listDiagnosticFieldStates, listDiagnosticQuestions } from "../../strategy-agent/strategy-store.mjs";
import { evaluateStrategyDraftReadiness } from "../../strategy-agent/strategy-engine.mjs";

const claim = (fieldPath, value) => ({ operation: "create", fieldPath, value, type: "fact", sourceType: "user_statement", confidence: 0.96, status: "confirmed" });

// 6/9 后仍必须追问具体字段，不能进入无限开放式兜底。
const sixFieldSession = startDiagnostic({ accountId: `consultative_six_${Date.now()}` });
createDiagnosticQuestion({ sessionId: sixFieldSession.session.id, content: "请介绍业务和账号目标。", targetFieldPaths: ["business.primaryOffers", "business.businessModel", "audiences.primary", "accountStrategy.primaryGoal"] });
const afterSix = recordDiagnosticAnalysis({
  sessionId: sixFieldSession.session.id,
  userMessage: "我们做企业AI服务，希望获得咨询。",
  analysis: {
    intent: "direct_answer",
    coreClaimOperations: [
      claim("business.primaryOffers", ["企业AI服务"]), claim("business.businessModel", "项目制"), claim("audiences.primary", ["企业负责人"]),
      claim("business.conversionPath", "内容 → 私信 → 需求诊断 → 方案沟通"), claim("accountStrategy.primaryGoal", "获得有效咨询"), claim("accountStrategy.growthStage", "account_setup")
    ],
    acknowledgement: "我已经了解了业务基础。"
  }
});
assert.equal(afterSix.progress.completedFieldCount, 6);
assert.match(afterSix.pendingQuestion.content, /小红书和微信公众号分别希望承担什么角色/);
assert.doesNotMatch(afterSix.pendingQuestion.content, /还有哪些会影响账号定位/);

// 用户要求清单时，当前问题必须保持打开。
recordDiagnosticAnalysis({
  sessionId: sixFieldSession.session.id,
  userMessage: "我不清楚，可以列个清单吗？",
  analysis: { intent: "request_checklist", assistanceResponse: "可以，请对照产品资料、案例、SOP和数据清单。" }
});
const assistedQuestion = getPendingDiagnosticQuestion(sixFieldSession.session.id);
assert.equal(assistedQuestion.targetFieldPaths[0], "accountStrategy.platformRoles");
assert.equal(assistedQuestion.status, "assisting");
assert.equal(listDiagnosticQuestions(sixFieldSession.session.id).filter((item) => ["pending", "assisting", "recommendation_pending"].includes(item.status)).length, 1);

// 建议必须先保存为 pending，用户采纳后才进入骨架。
const recommendationSession = startDiagnostic({ accountId: `consultative_reco_${Date.now()}` });
createDiagnosticQuestion({ sessionId: recommendationSession.session.id, content: "用户看完内容后如何进入合作？", targetFieldPaths: ["business.conversionPath"], expectedAnswerType: "conversion_path" });
const recommendationTurn = recordDiagnosticAnalysis({
  sessionId: recommendationSession.session.id,
  userMessage: "我不清楚，你有什么建议？",
  analysis: {
    intent: "request_recommendation",
    assistanceResponse: "建议使用内容触达、私信、需求诊断、方案沟通的路径。",
    recommendationDraft: { recommendedValue: "内容触达 → 私信 → 需求诊断 → 方案沟通 → 签约", rationale: ["降低咨询门槛"], alternatives: [] }
  }
});
assert.equal(recommendationTurn.recommendation.status, "pending_confirmation");
assert.equal(listCurrentProfileClaims(recommendationSession.session.id).some((item) => item.fieldPath === "business.conversionPath"), false, "未采纳建议不得写入骨架");
const recommendationId = getPendingAgentRecommendation(recommendationSession.session.id).id;

const acceptedTurn = recordDiagnosticAnalysis({
  sessionId: recommendationSession.session.id,
  userMessage: "可以，就采用这个方案。",
  analysis: { intent: "adopt_recommendation", recommendationAction: { recommendationId, action: "accept" }, acknowledgement: "好，这条路径将作为当前策略。" }
});
const acceptedClaim = listCurrentProfileClaims(recommendationSession.session.id).find((item) => item.fieldPath === "business.conversionPath");
assert.equal(acceptedClaim.value, "内容触达 → 私信 → 需求诊断 → 方案沟通 → 签约");
assert.equal(acceptedClaim.sourceType, "agent_recommendation_accepted");
assert.equal(listDiagnosticFieldStates(recommendationSession.session.id).find((item) => item.fieldPath === "business.conversionPath").state, "accepted_suggestion");
assert.equal(acceptedTurn.recommendation.status, "accepted");

const readiness = evaluateStrategyDraftReadiness(afterSix.claims, afterSix.fieldStates);
assert.equal(readiness.canGenerateDraft, false, "平台分工和内容边界未处理时不应生成最小草案");
assert.equal(readiness.coreComplete, false, "六项信息不能被误判为九字段诊断完成");
assert.equal(getDiagnosticSessionMeta(sixFieldSession.session.id).conversationPhase, "core_diagnosis", "未完成九字段时必须留在诊断阶段");
assert.equal(readiness.canActivate, false, "仍有未解决字段时不能激活正式策略");

console.log(JSON.stringify({ status: "passed", sixFieldNextQuestion: afterSix.pendingQuestion.content, checklistQuestionStatus: assistedQuestion.status, recommendationId, acceptedSource: acceptedClaim.sourceType, draftReadiness: readiness }, null, 2));

