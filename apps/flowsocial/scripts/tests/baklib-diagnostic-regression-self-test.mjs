import assert from "node:assert/strict";
import { recordDiagnosticAnalysis, startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { buildDeterministicDiagnosticFallback } from "../../strategy-agent/deterministic-extractor.mjs";
import { resolveDiagnosticState } from "../../strategy-agent/diagnostic-state-resolver.mjs";
import { createDiagnosticQuestion, getPendingDiagnosticQuestion, listCurrentProfileClaims, listDiagnosticFieldStates } from "../../strategy-agent/strategy-store.mjs";
import { buildAssistanceFallback, validateAssistanceRelevance } from "../../strategy-agent/consultative-engine.mjs";

const audienceSession = startDiagnostic({ accountId: "eval_baklib_regression", mode: "quick" }).session;
createDiagnosticQuestion({ sessionId: audienceSession.id, content: "谁是你们最希望优先影响的客户和决策人？", goal: "确认核心受众", targetFieldPaths: ["audiences.primary"], expectedAnswerType: "audience_profile" });
const audienceMessage = "Baklib最想优先影响的是SaaS和科技行业的成长期公司，核心决策人是客户成功VP";
const audienceAnalysis = buildDeterministicDiagnosticFallback(audienceMessage, [], getPendingDiagnosticQuestion(audienceSession.id));
const audienceResult = recordDiagnosticAnalysis({ sessionId: audienceSession.id, userMessage: audienceMessage, analysis: audienceAnalysis });
const audienceClaim = listCurrentProfileClaims(audienceSession.id).find((claim) => claim.fieldPath === "audiences.primary");
assert.ok(audienceClaim, "audience claim must be created");
assert.match(JSON.stringify(audienceClaim.value), /SaaS/);
assert.match(JSON.stringify(audienceClaim.value), /客户成功VP/);
assert.equal(listCurrentProfileClaims(audienceSession.id).some((claim) => claim.fieldPath === "business.businessModel"), false, "SaaS industry must not create business model");
assert.notEqual(audienceResult.pendingQuestion?.targetFieldPaths?.[0], "audiences.primary", "next question must advance");

for (const [intent, fieldPath] of [["request_clarification", "accountStrategy.platformRoles"], ["request_examples", "audiences.primary"], ["request_recommendation", "audiences.primary"]]) {
  const assistance = buildAssistanceFallback({ intent, fieldPath, claims: [audienceClaim] });
  assert.equal(validateAssistanceRelevance(assistance, fieldPath, intent).valid, true);
}

const noneSession = startDiagnostic({ accountId: "eval_baklib_none", mode: "quick" }).session;
createDiagnosticQuestion({ sessionId: noneSession.id, content: "目前有哪些内容资源？", goal: "确认内容资源", targetFieldPaths: ["accountStrategy.contentResources"] });
const noneMessage = "没有";
recordDiagnosticAnalysis({ sessionId: noneSession.id, userMessage: noneMessage, analysis: buildDeterministicDiagnosticFallback(noneMessage, [], getPendingDiagnosticQuestion(noneSession.id)) });
const noneState = listDiagnosticFieldStates(noneSession.id).find((item) => item.fieldPath === "accountStrategy.contentResources");
assert.equal(noneState.state, "explicit_none");

const skeletonClaims = [
  { fieldPath: "business.primaryOffers", value: ["企业知识库"], status: "confirmed" },
  { fieldPath: "business.conversionPath", value: "私信咨询", status: "confirmed" },
  { fieldPath: "accountStrategy.primaryGoal", value: "获得咨询", status: "confirmed" }
];
const skippedStates = ["business.primaryOffers", "business.businessModel", "audiences.primary", "business.conversionPath", "accountStrategy.primaryGoal", "accountStrategy.growthStage", "accountStrategy.platformRoles", "accountStrategy.contentResources", "accountStrategy.constraints"].map((fieldPath) => ({ fieldPath, state: fieldPath === "audiences.primary" ? "skipped" : skeletonClaims.some((claim) => claim.fieldPath === fieldPath) ? "confirmed" : "skipped" }));
const resolved = resolveDiagnosticState(skeletonClaims, skippedStates);
assert.equal(resolved.allProcessed, true);
assert.equal(resolved.canGeneratePreliminaryDraft, true);
assert.equal(resolved.canActivate, true, "显式跳过字段可作为假设进入草案，最终激活仍需草案校验与用户确认");
assert.deepEqual(resolved.missingFields, ["business.businessModel", "audiences.primary", "business.conversionPath", "accountStrategy.platformRoles", "accountStrategy.constraints"], "只有‘私信咨询’不足以形成可执行转化链路，测试不得误报字段已经就绪");

console.log(JSON.stringify({ status: "passed", audience: audienceClaim.value, nextQuestion: audienceResult.pendingQuestion?.targetFieldPaths?.[0], explicitNoneState: noneState.state, processedCount: resolved.processedCount, missingFields: resolved.missingFields }, null, 2));

