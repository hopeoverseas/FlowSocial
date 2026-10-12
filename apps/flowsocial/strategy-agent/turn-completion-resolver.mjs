import { evaluateStrategyDraftReadiness } from "./strategy-engine.mjs";
import { planNextDiagnosticQuestion } from "./question-planner.mjs";

export function resolveTurnCompletion({ progress={},claims=[],facts=[],fieldStates=[],coverageStates=[],previousQuestions=[],targetAssessment=null,modelRecommendation="",answerAssessment={} }={}) {
  const readiness=evaluateStrategyDraftReadiness(claims,fieldStates,coverageStates);
  const questionPlan=planNextDiagnosticQuestion({progress,claims,facts,fieldStates,coverageStates,previousQuestions,targetAssessment,modelRecommendation,answerAssessment});
  if (questionPlan?.targetFieldPaths?.length) return {state:questionPlan.questionMode==="coverage_follow_up"?"follow_up_current_field":"continue_core",readiness,questionPlan,assistantMessage:questionPlan.content};
  if (readiness.canGenerateDraft) return {state:"offer_minimum_draft",readiness,questionPlan:null,assistantMessage:readiness.qualityComplete
    ? "九项核心策略骨架已经达到完整质量，可以生成策略草案；你也可以继续补充动态画像。"
    : "生成第一版策略草案所需的最小信息已经具备。你可以先生成初步草案，或继续完善质量细节。"};
  return {state:"recoverable_error",readiness,questionPlan:null,assistantMessage:"当前没有可安全提交的下一问题。请重试本轮，系统会从尚未完成的规范字段继续。"};
}
