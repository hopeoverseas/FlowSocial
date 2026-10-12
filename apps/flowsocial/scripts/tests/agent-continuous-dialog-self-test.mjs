import assert from "node:assert/strict";
import { startDiagnostic, recordDiagnosticAnalysis } from "../../strategy-agent/agent-orchestrator.mjs";
import { openingDiagnosticQuestion } from "../../strategy-agent/question-planner.mjs";
import { createDiagnosticQuestion, getPendingDiagnosticQuestion, listCurrentProfileClaims, listCurrentProfileFacts, listDiagnosticQuestions, listDiagnosticTurns } from "../../strategy-agent/strategy-store.mjs";

const accountId = `account_dialog_test_${Date.now()}`;
const started = startDiagnostic({ accountId, mode: "quick" });
createDiagnosticQuestion({ sessionId: started.session.id, ...openingDiagnosticQuestion() });

const first = recordDiagnosticAnalysis({
  sessionId: started.session.id,
  userMessage: "我们为外贸工厂提供企业知识库和AI员工项目，主要面向老板和运营负责人，希望通过内容获得企业咨询；项目一般按方案交付。我们积累了制造、家居和消费电子行业的实施经验。",
  analysis: {
    coreClaimOperations: [
      { operation: "create", fieldPath: "business.primaryOffers", value: ["企业知识库", "AI员工"], status: "confirmed", confidence: 0.96 },
      { operation: "create", fieldPath: "business.businessModel", value: "项目制方案交付", status: "confirmed", confidence: 0.94 },
      { operation: "create", fieldPath: "audiences.primary", value: ["外贸工厂老板", "运营负责人"], status: "confirmed", confidence: 0.94 },
      { operation: "create", fieldPath: "business.conversionPath", value: "内容触达后进入企业咨询", status: "confirmed", confidence: 0.9 },
      { operation: "create", fieldPath: "accountStrategy.primaryGoal", value: "获得企业咨询", status: "confirmed", confidence: 0.95 },
      { operation: "create", fieldPath: "accountStrategy.platformRoles", value: { xiaohongshu: "发现与触达", wechat: "深度论证" }, status: "confirmed", confidence: 0.92 },
      { operation: "create", fieldPath: "accountStrategy.constraints", value: ["不虚构案例"], status: "confirmed", confidence: 0.92 },
      { operation: "create", fieldPath: "accountStrategy.contentResources", value: { summary: "多行业实施经验", industries: ["制造", "家居", "消费电子"], publicUsage: "unknown" }, status: "confirmed", confidence: 0.92 }
    ],
    discoveredFactOperations: [
      { operation: "create", factKey: "company.served_industries", factType: "industry_experience", subject: "company", predicate: "served_industries", value: ["制造", "家居", "消费电子"], status: "user_asserted", visibility: "unknown", contentUsage: "needs_review", confidence: 0.94 }
    ],
    acknowledgement: "已记录业务、受众、目标和行业经验。",
    answerAssessment: { status: "answered", answeredFieldPaths: ["business.primaryOffers", "business.businessModel", "audiences.primary", "business.conversionPath", "accountStrategy.primaryGoal", "accountStrategy.contentResources"], remainingGaps: [] }
  }
});

assert.equal(first.progress.readyToDraft, true, "核心字段应足以生成策略草案");
assert.equal(first.pendingQuestion, null, "达到最小草案门槛后不应自动追问可选资源槽位");
assert.equal(first.facts.length, 1, "行业经验应进入动态事实库");

const second = recordDiagnosticAnalysis({
  sessionId: started.session.id,
  userMessage: "客户名称不能公开，但项目过程和成果可以脱敏后使用。",
  analysis: {
    coreClaimOperations: [
      { operation: "refine", fieldPath: "accountStrategy.contentResources", value: { publicUsage: "anonymized" }, status: "confirmed", confidence: 0.98 }
    ],
    discoveredFactOperations: [
      { operation: "create", factKey: "content.case_public_usage", factType: "content_constraint", subject: "company", predicate: "case_public_usage", value: { customerNames: "forbidden", anonymizedCases: "allowed" }, status: "user_asserted", visibility: "anonymized", contentUsage: "allowed", confidence: 0.98 }
    ],
    acknowledgement: "已记录案例只能脱敏使用。",
    answerAssessment: { status: "answered", answeredFieldPaths: ["accountStrategy.contentResources.publicUsage"], remainingGaps: [] }
  }
});

const resources = listCurrentProfileClaims(started.session.id).find((claim) => claim.fieldPath === "accountStrategy.contentResources");
assert.equal(resources.value.publicUsage, "anonymized", "第二轮回答应细化原有核心字段，而非被丢弃");
assert.equal(listCurrentProfileFacts(accountId).length, 2, "第二轮回答应新增动态事实");
assert.equal(second.pendingQuestion, null, "草案就绪后的补充信息不应重新打开核心问卷");
assert.equal(second.progress.evidenceReadiness.publishableCount, 1, "脱敏案例应计入可用于内容的证据");
assert.equal(second.progress.contentReadiness.level, "较高", "最小策略、资源和可用事实齐备时内容启动度应提升");
assert.equal(listDiagnosticQuestions(started.session.id).filter((item) => item.status === "pending").length, 0, "草案就绪后不应遗留待回答问题");
assert.equal(listDiagnosticTurns(started.session.id).filter((item) => item.role === "user").length, 2, "两轮用户回答都应持久化");
assert.equal(getPendingDiagnosticQuestion(started.session.id), null);

console.log(JSON.stringify({
  status: "passed",
  sessionId: started.session.id,
  completeness: second.progress.completeness,
  nextQuestion: null,
  factCount: second.progress.profileRichness.factCount,
  evidenceReadiness: second.progress.evidenceReadiness,
  contentReadiness: second.progress.contentReadiness
}, null, 2));

