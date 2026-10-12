import { createHash } from "node:crypto";
import { activateExactStrategyDocument, activateStrategySnapshot, appendDiagnosticTurn, applyProfileFactOperation, createAgentRecommendation, createDiagnosticQuestion, createDiagnosticSession, createEnrichmentQuestion, getAgentRecommendation, getDiagnosticCoverageState, getDiagnosticSession, getDiagnosticSessionContext, getDiagnosticSessionMeta, getLatestOpenDiagnosticSession, getLatestStrategyDraftRevision, getPendingAgentRecommendation, getPendingDiagnosticQuestion, getPendingEnrichmentQuestion, getStrategyDraftRevision, getStrategySnapshot, listCurrentProfileClaims, listCurrentProfileFacts, listDiagnosticCoverageStates, listDiagnosticFieldStates, listDiagnosticQuestions, listDiagnosticTurns, listEnrichmentQuestions, listSessionProfileFacts, markDiagnosticQuestionAnswered, saveAgentRecommendationDecision, saveAgentRecommendationRevision, saveDirectionSet, saveStrategySnapshot, setAgentRecommendationStatus, setDiagnosticProgress, setDiagnosticQuestionStatus, setEnrichmentQuestionStatus, updateDiagnosticSessionContext, updateDiagnosticSessionMeta, upsertDiagnosticCoverageState, upsertDiagnosticFieldState, upsertProfileClaim } from "./strategy-store.mjs";
import { evaluateDiagnosticCompleteness, evaluateProfileMetrics, normalizeDiagnosticAnalysis } from "./diagnostic-engine.mjs";
import { createStrategyDraft, evaluateStrategyDraftReadiness, validateStrategyDraft } from "./strategy-engine.mjs";
import { normalizeDirectionSet, validateDirectionSet } from "./direction-engine.mjs";
import { planNextDiagnosticQuestion } from "./question-planner.mjs";
import { assistanceIntents, resolveQuestionAnswerDisposition } from "./consultative-engine.mjs";
import { enrichmentCompletionMessage, planNextEnrichmentQuestion } from "./enrichment-planner.mjs";
import { validateStrategyDocumentV2 } from "../contracts/strategy-content-contracts.mjs";
import { conservativeCoverageFromAnswer, mergeCoverageAssessment } from "./profile-coverage-registry.mjs";
import { buildRecommendationDisplay } from "./recommendation-contract.mjs";
import { resolveTurnCompletion } from "./turn-completion-resolver.mjs";
import { buildStrategyReadinessSnapshot } from "./strategy-readiness.mjs";
import { naturalRecommendationAcceptedMessage } from "./strategy-presentation.mjs";

function activationConflict(message, code, details = []) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = code;
  error.details = details;
  return error;
}

function stableDocumentHash(document) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

export function sanitizeConsultativeAcknowledgement(input) {
  const normalized=String(input||"").replace(/\r\n?/g,"\n").replace(/[ \t]+/g," ").trim();
  if(!normalized)return "";
  const promptPattern=/(?:请|你可以|可以|接下来|下面|如果|若|不确定|暂时不清楚).{0,24}(?:选择|说明|回答|告诉|补充|确认|建议)|(?:是否|能否|要不要|还是|或者|或是|什么|哪些|如何|怎么|为什么|多少|谁|哪里)/u;
  return normalized
    .split(/(?<=[。！？!?])|\n+/u)
    .map((item)=>item.trim())
    .filter((item)=>item&&!/[？?]\s*$/u.test(item)&&!promptPattern.test(item))
    .join("")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

export function startDiagnostic({ accountId, mode = "quick", openingMessage = null, restartMode = "fresh", rediagnoseFields = [] }) {
  const previousSession = getLatestOpenDiagnosticSession(accountId);
  const session = createDiagnosticSession({ accountId, mode, restartMode, inheritedFromSessionId: previousSession?.id || null, rediagnoseFields });
  if (["retain_core","retain_all","partial"].includes(restartMode) && previousSession) {
    const previousClaims = listCurrentProfileClaims(previousSession.id);
    for (const claim of previousClaims) {
      if (claim.status !== "confirmed") continue;
      if (restartMode === "partial" && rediagnoseFields.includes(claim.fieldPath)) continue;
      upsertProfileClaim({ sessionId: session.id, fieldPath: claim.fieldPath, value: claim.value, type: claim.type, sourceType: "inherited_confirmed", sourceRef: claim.id, confidence: 1, status: "confirmed" });
      upsertDiagnosticFieldState({ sessionId: session.id, fieldPath: claim.fieldPath, state: "confirmed", resolutionType: "inherited_confirmed", metadata: { inheritedFromSessionId: previousSession.id, sourceClaimId: claim.id } });
      const inheritedCoverage=getDiagnosticCoverageState(previousSession.id,"core_field",claim.fieldPath);
      if (inheritedCoverage) upsertDiagnosticCoverageState({ ...inheritedCoverage,sessionId:session.id,assessment:{ ...(inheritedCoverage.assessment||{}),inheritedFromSessionId:previousSession.id } });
    }
  }
  if (["retain_facts","retain_all","update"].includes(restartMode) && previousSession) {
    for (const fact of listSessionProfileFacts(accountId,previousSession.id)) applyProfileFactOperation({ accountId,sessionId:session.id,turnId:null,factKey:fact.factKey,factType:fact.factType,subject:fact.subject,predicate:fact.predicate,value:fact.value,operation:"create",status:"user_asserted",confidence:fact.confidence,visibility:fact.visibility,contentUsage:fact.contentUsage,sourceType:"carried_forward" });
  }
  if (openingMessage) appendDiagnosticTurn({ sessionId: session.id, role: "user", content: openingMessage });
  return { session: getDiagnosticSession(session.id), sessionContext: getDiagnosticSessionContext(session.id), turns: listDiagnosticTurns(session.id), claims: listCurrentProfileClaims(session.id), historicalClaims: ["retain_facts","update"].includes(restartMode) && previousSession ? listCurrentProfileClaims(previousSession.id) : [] };
}

export function resumeDiagnosticQuestionFlow(sessionId, { reason = "knowledge_processed" } = {}) {
  const session = getDiagnosticSession(sessionId);
  if (!session) throw new Error("Diagnostic session not found");
  const claims = listCurrentProfileClaims(sessionId);
  const facts = listSessionProfileFacts(session.accountId, sessionId);
  const fieldStates = listDiagnosticFieldStates(sessionId);
  const readiness = evaluateStrategyDraftReadiness(claims, fieldStates, listDiagnosticCoverageStates(sessionId));
  const pending = getPendingDiagnosticQuestion(sessionId);
  const coverageStates = listDiagnosticCoverageStates(sessionId);
  const resolvedTargets = pending?.targetFieldPaths?.length && pending.targetFieldPaths.every((fieldPath) => coverageStates.find((item)=>item.targetType==="core_field"&&item.targetId===fieldPath)?.strategyReady);
  if (pending && resolvedTargets) markDiagnosticQuestionAnswered(pending.id);
  const activePending = getPendingDiagnosticQuestion(sessionId);
  let message;
  let nextQuestion = activePending;
  if (activePending) {
    const contentResourceFollowup = activePending.targetFieldPaths?.some((fieldPath) => fieldPath.startsWith("accountStrategy.contentResources"));
    message = contentResourceFollowup
      ? `我已经把资料中能确认的内容证据记录下来。除此之外，还有没有案例、数据、SOP、客户常见问题或业务经验需要补充？没有的话也可以继续下一项。\n\n${activePending.content}`
      : `资料已经处理完成。继续刚才的问题：${activePending.content}`;
  }
  else {
    const plan = planNextDiagnosticQuestion({ progress: evaluateDiagnosticCompleteness(claims), claims, facts, fieldStates, coverageStates, previousQuestions: listDiagnosticQuestions(sessionId) });
    if (plan?.targetFieldPaths?.length) {
      nextQuestion = createDiagnosticQuestion({ sessionId, ...plan });
      message = `资料已经处理完成，并补充了相关策略信息。下面继续：${plan.content}`;
    } else {
      message = "九项策略骨架已经处理完成。你现在可以生成策略草案，也可以继续完善动态事实或修改已有字段。";
      updateDiagnosticSessionMeta(sessionId, { conversationPhase: "core_complete", completionAnnouncedAt: new Date().toISOString() });
    }
  }
  const assistantTurn = appendDiagnosticTurn({ sessionId, role: "assistant", content: message, metadata: { reason, resumedQuestionId: nextQuestion?.id || null } });
  return { assistantMessage: message, assistantTurn, pendingQuestion: nextQuestion, draftReadiness: readiness };
}

function mergeClaimValue(previous, incoming, operation) {
  if (operation === "append") {
    if (Array.isArray(previous) || Array.isArray(incoming)) {
      const values = [...(Array.isArray(previous) ? previous : previous == null ? [] : [previous]), ...(Array.isArray(incoming) ? incoming : incoming == null ? [] : [incoming])];
      return [...new Map(values.map((item) => [typeof item === "string" ? item.trim() : JSON.stringify(item), item])).values()];
    }
    if (previous && typeof previous === "object" && incoming && typeof incoming === "object") return { ...previous, ...incoming };
  }
  if (operation === "refine" && previous && typeof previous === "object" && incoming && typeof incoming === "object") return { ...previous, ...incoming };
  return incoming;
}

export function recordDiagnosticAnalysis({ sessionId, userMessage, analysis, sourceTurnId = null }) {
  const diagnosticSession = getDiagnosticSession(sessionId);
  if (!diagnosticSession) throw new Error("Diagnostic session not found");
  const sessionMetaBefore = getDiagnosticSessionMeta(sessionId);
  const pendingQuestion = getPendingDiagnosticQuestion(sessionId);
  const userTurn = appendDiagnosticTurn({ sessionId, role: "user", content: userMessage });
  const normalized = normalizeDiagnosticAnalysis(analysis);
  normalized.acknowledgement=sanitizeConsultativeAcknowledgement(normalized.acknowledgement);
  const intent = normalized.intent || "direct_answer";
  const answerDisposition=resolveQuestionAnswerDisposition(userMessage,{pendingQuestion,intent});
  const isAssistance = assistanceIntents.has(intent);
  const isTerminalWithoutValue = ["cannot_answer", "temporarily_unknown", "skip_question", "skip_field"].includes(intent);
  const closesCurrentSlots=Boolean(!answerDisposition.closeWholeTarget && answerDisposition.skippedSlotIds?.length);
  const pendingTarget=pendingQuestion?.targetFieldPaths?.[0]||null;
  if (pendingQuestion && normalized.targetAssessment && (normalized.targetAssessment.targetType!=="core_field" || normalized.targetAssessment.targetId!==pendingTarget)) normalized.targetAssessment=null;
  if (pendingTarget && (normalized.targetAssessment || closesCurrentSlots)) {
    const previousCoverage=getDiagnosticCoverageState(sessionId,"core_field",pendingTarget);
    const rawAssessment=normalized.targetAssessment || {};
    const mergedAssessment=mergeCoverageAssessment(previousCoverage,{
      ...rawAssessment,
      skippedSlots:[...(rawAssessment.skippedSlots||[]),...(answerDisposition.skippedSlotIds||[])]
    },{targetType:"core_field",targetId:pendingTarget});
    normalized.targetAssessment=mergedAssessment;
    upsertDiagnosticCoverageState({
      ...mergedAssessment,
      sessionId,
      attempts:(previousCoverage?.attempts||0)+1,
      assessment:{...(previousCoverage?.assessment||{}),...(rawAssessment.assessment||{}),source:"diagnostic_turn",userTurnId:userTurn.id}
    });
  }
  let activeRecommendation = getPendingAgentRecommendation(sessionId);
  let recommendation = null;
  const assistanceTargetField = pendingQuestion?.targetFieldPaths?.[0] || normalized.assistanceRequest?.targetFieldPath || null;
  if (isAssistance && normalized.recommendationDraft?.recommendedValue != null && assistanceTargetField) {
    if (activeRecommendation) setAgentRecommendationStatus(activeRecommendation.id, "superseded");
    recommendation = createAgentRecommendation({
      sessionId,
      accountId: diagnosticSession.accountId,
      targetFieldPath: assistanceTargetField,
      recommendedValue: normalized.recommendationDraft.recommendedValue,
      rationale: normalized.recommendationDraft.rationale || [],
      alternatives: normalized.recommendationDraft.alternatives || []
    });
    activeRecommendation = recommendation;
    if (!pendingQuestion && !assistanceTargetField.startsWith("fact:")) upsertDiagnosticFieldState({ sessionId, fieldPath: assistanceTargetField, state: "recommendation_pending", resolutionType: "post_completion_assistance", metadata: { recommendationId: recommendation.id } });
  }
  if (["adopt_recommendation", "modify_recommendation"].includes(intent) && activeRecommendation) {
    const modifiedValue = normalized.recommendationAction?.modifiedValue;
    normalized.coreClaimOperations.push({
      operation: "correct",
      fieldPath: activeRecommendation.targetFieldPath,
      value: intent === "modify_recommendation" && modifiedValue != null ? modifiedValue : activeRecommendation.recommendedValue,
      type: "strategy_decision",
      sourceType: "agent_recommendation_accepted",
      sourceRef: activeRecommendation.id,
      confidence: 1,
      status: "confirmed"
    });
    recommendation = setAgentRecommendationStatus(activeRecommendation.id, intent === "modify_recommendation" ? "accepted_with_changes" : "accepted");
  } else if (intent === "reject_recommendation" && activeRecommendation) {
    recommendation = setAgentRecommendationStatus(activeRecommendation.id, "rejected");
  }

  const currentBefore = new Map(listCurrentProfileClaims(sessionId).map((claim) => [claim.fieldPath, claim]));
  const requestedSourceTurn=sourceTurnId
    ? listDiagnosticTurns(sessionId).find((turn)=>turn.id===sourceTurnId&&turn.role==="user"&&turn.content.trim()===String(userMessage||"").trim())
    : null;
  for (const operation of normalized.coreClaimOperations) {
    if (!operation?.fieldPath || operation.value == null) continue;
    const previous = currentBefore.get(operation.fieldPath);
    const value = mergeClaimValue(previous?.value, operation.value, operation.operation || "create");
    const recommendationSource=operation.sourceType==="agent_recommendation_accepted"&&activeRecommendation?.id===operation.sourceRef
      ? operation.sourceRef
      : null;
    const trustedSourceRef=recommendationSource || requestedSourceTurn?.id || userTurn.id;
    upsertProfileClaim({
      sessionId,
      fieldPath: operation.fieldPath,
      value,
      type: operation.type || "fact",
      sourceType: operation.sourceType || "user_statement",
      sourceRef: trustedSourceRef,
      confidence: operation.confidence,
      status: operation.operation === "reject" ? "rejected" : operation.status || "confirmed"
    });
    const targetCoverage = normalized.targetAssessment?.targetType === "core_field" && normalized.targetAssessment.targetId === operation.fieldPath ? normalized.targetAssessment : null;
    upsertDiagnosticFieldState({
      sessionId,
      fieldPath: operation.fieldPath,
      state: operation.resolutionState || (operation.sourceType === "agent_recommendation_accepted" ? "accepted_suggestion" : operation.operation === "reject" ? "conflicting" : targetCoverage?.minimumDraftReady || targetCoverage?.strategyReady ? "confirmed" : "partial"),
      resolutionType: operation.resolutionState === "explicit_none" ? "explicit_none" : operation.sourceType === "agent_recommendation_accepted" ? "agent_recommendation_accepted" : "user_answer",
      attempts: listDiagnosticFieldStates(sessionId).find((item) => item.fieldPath === operation.fieldPath)?.attempts || 0,
      lastQuestionId: pendingQuestion?.id || null,
      metadata: { sourceRef: trustedSourceRef }
    });
    currentBefore.set(operation.fieldPath, { ...operation, value });
  }
  const answeredPendingField = pendingQuestion?.targetFieldPaths?.some((fieldPath)=>normalized.coreClaimOperations.some((operation)=>operation?.fieldPath===fieldPath&&operation.value!=null));
  if ((isTerminalWithoutValue || closesCurrentSlots) && !answeredPendingField && pendingQuestion?.targetFieldPaths?.length) {
      for (const fieldPath of pendingQuestion.targetFieldPaths) {
      const existingState = listDiagnosticFieldStates(sessionId).find((item) => item.fieldPath === fieldPath);
      const coverage=normalized.targetAssessment?.targetType==="core_field"&&normalized.targetAssessment.targetId===fieldPath?normalized.targetAssessment:null;
      const closesWholeField=intent === "skip_field" || (!closesCurrentSlots && isTerminalWithoutValue);
      const state=closesWholeField ? (intent === "skip_field" ? "skipped" : "temporarily_unknown") : coverage?.minimumDraftReady ? "confirmed" : "partial";
      upsertDiagnosticFieldState({ sessionId, fieldPath, state, resolutionType: intent, attempts: existingState?.attempts || pendingQuestion.attempt || 1, lastQuestionId: pendingQuestion.id, metadata: { ...(existingState?.metadata||{}),userTurnId:userTurn.id,skippedSlotIds:pendingQuestion.targetSlotIds||[] } });
    }
  }
  let questionClosed=false;
  if (pendingQuestion) {
    if (isAssistance || intent === "reject_recommendation") {
      const assistedState = recommendation ? "recommendation_pending" : "assisting";
      setDiagnosticQuestionStatus(pendingQuestion.id, assistedState);
      const assistanceFields = recommendation?.targetFieldPath ? [recommendation.targetFieldPath] : pendingQuestion.targetFieldPaths || [];
      for (const fieldPath of assistanceFields) {
        const existing = listDiagnosticFieldStates(sessionId).find((item) => item.fieldPath === fieldPath);
        upsertDiagnosticFieldState({ sessionId, fieldPath, state: assistedState, attempts: existing?.attempts || pendingQuestion.attempt || 1, lastQuestionId: pendingQuestion.id, metadata: { ...(existing?.metadata || {}), assistanceIntent: intent, recommendationId: recommendation?.id || activeRecommendation?.id || null } });
      }
    } else if (isTerminalWithoutValue || closesCurrentSlots) {
      setDiagnosticQuestionStatus(pendingQuestion.id, "skipped");
      questionClosed=true;
    } else {
      const pendingTargets=new Set(pendingQuestion.targetFieldPaths||[]);
      const sameTargetOperation=normalized.coreClaimOperations.some((operation)=>pendingTargets.has(operation?.fieldPath)&&operation.value!=null);
      const sameTargetCoverage=normalized.targetAssessment?.targetType==="core_field"&&pendingTargets.has(normalized.targetAssessment.targetId)&&(normalized.targetAssessment.capturedSlots?.length||normalized.targetAssessment.skippedSlots?.length);
      if (sameTargetOperation || sameTargetCoverage) {
        if (normalized.targetAssessment?.followUpNeeded) setDiagnosticQuestionStatus(pendingQuestion.id,"partially_answered");
        else markDiagnosticQuestionAnswered(pendingQuestion.id);
        questionClosed=true;
      }
    }
  }
  for (const operation of normalized.discoveredFactOperations) {
    applyProfileFactOperation({
      accountId: diagnosticSession.accountId,
      sessionId,
      turnId: userTurn.id,
      ...operation,
      operation: operation.operation || "create",
      status: operation.operation === "reject" ? "rejected" : operation.status || "user_asserted"
    });
  }
  const claims = listCurrentProfileClaims(sessionId);
  const facts = listCurrentProfileFacts(diagnosticSession.accountId);
  const progress = evaluateDiagnosticCompleteness(claims);
  const metrics = evaluateProfileMetrics(claims, facts);
  const fieldStates = listDiagnosticFieldStates(sessionId);
  const coverageStates = listDiagnosticCoverageStates(sessionId);
  const keepsCurrentQuestion = isAssistance || intent === "reject_recommendation" || Boolean(pendingQuestion&&!questionClosed);
  const completionResolution=keepsCurrentQuestion ? null : resolveTurnCompletion({ progress,claims,facts,fieldStates,coverageStates,previousQuestions:listDiagnosticQuestions(sessionId),modelRecommendation:normalized.nextQuestionRecommendation,answerAssessment:normalized.answerAssessment,targetAssessment:normalized.targetAssessment });
  const questionPlan = keepsCurrentQuestion ? pendingQuestion : completionResolution?.questionPlan;
  let assistantContent = normalized.assistanceResponse || "";
  if (!assistantContent && intent === "reject_recommendation") assistantContent = "没问题，这条建议不会写入策略。你可以告诉我哪里不合适，我会换一种方案。";
  if (!assistantContent && pendingQuestion && !questionClosed && !isAssistance) assistantContent = `我还没能从这次回答中确认“${pendingQuestion.goal || "当前策略信息"}”。请补充回答下面这个问题，或直接选择跳过。\n\n${pendingQuestion.content}`;
  if (!assistantContent && completionResolution?.state === "core_complete" && sessionMetaBefore?.completionAnnouncedAt) assistantContent = normalized.acknowledgement || "已记录这次补充。九项核心策略仍然完整；你可以更新策略草案，或继续完善动态画像。";
  if (!assistantContent) assistantContent = [normalized.acknowledgement,completionResolution?.assistantMessage||questionPlan?.content].filter(Boolean).join("\n\n");
  let assistantTurn = null;
  if (assistantContent) {
    assistantTurn = appendDiagnosticTurn({ sessionId, role: "assistant", content: assistantContent, metadata: { intent, questionGoal: questionPlan?.goal, questionPlan, acknowledgement: normalized.acknowledgement, recommendationId: recommendation?.id || activeRecommendation?.id || null, providerTelemetry: analysis?.providerTelemetry || null, assistanceValidation: analysis?.assistanceValidation || null } });
    if (!keepsCurrentQuestion && questionPlan?.content && (questionPlan.targetFieldPaths || []).length) createDiagnosticQuestion({ sessionId, ...questionPlan });
  }
  const draftReadiness = evaluateStrategyDraftReadiness(claims, fieldStates, coverageStates);
  const status = draftReadiness.canGenerateDraft ? "ready_to_confirm" : "collecting";
  const previousMeta = sessionMetaBefore;
  const nextPhase = draftReadiness.coreComplete
    ? (previousMeta?.conversationPhase === "strategy_active" ? "revising" : previousMeta?.conversationPhase === "draft_created" || previousMeta?.conversationPhase === "revising" ? previousMeta.conversationPhase : "core_complete")
    : "core_diagnosis";
  updateDiagnosticSessionMeta(sessionId, { conversationPhase: nextPhase, completionAnnouncedAt: draftReadiness.coreComplete && !previousMeta?.completionAnnouncedAt ? new Date().toISOString() : null });
  const session = setDiagnosticProgress({ sessionId, status, completeness: progress.completeness, criticalMissingFields: progress.criticalMissingFields });
  return { session, sessionMeta: getDiagnosticSessionMeta(sessionId), claims, facts, fieldStates, draftReadiness, progress: { ...progress, ...metrics, readyToDraft: draftReadiness.canGenerateDraft }, pendingQuestion: getPendingDiagnosticQuestion(sessionId), recommendation: recommendation || (keepsCurrentQuestion ? activeRecommendation : null), analysis: normalized, assistantMessage: assistantContent, assistantTurn };
}

export function decideAgentRecommendation({ sessionId, recommendationId, action, optionId = null, modifiedValue = null }) {
  const session = getDiagnosticSession(sessionId);
  const recommendation = getAgentRecommendation(recommendationId);
  const pendingQuestion = getPendingDiagnosticQuestion(sessionId);
  if (!session || !recommendation || recommendation.sessionId !== sessionId) throw new Error("Recommendation does not belong to this diagnostic session");
  if (!["pending_confirmation","revision_ready"].includes(recommendation.status)) throw new Error("Recommendation is no longer ready for confirmation");
  if (action === "begin_refinement") {
    if (recommendation.status !== "pending_confirmation") throw new Error("Current revision must be confirmed or refined through chat");
    const selected=recommendation.options.find((item)=>item.optionId===optionId)||recommendation.options[0];
    setAgentRecommendationStatus(recommendationId,"refining");
    const assistantMessage=`可以。你想调整这套方案的哪一部分？可以直接说希望保留什么、删掉什么、改成什么，或者补充新的限制。我会根据你的想法生成修改版，再交给你确认。`;
    appendDiagnosticTurn({sessionId,role:"assistant",content:assistantMessage,metadata:{conversationMode:"recommendation_refinement",recommendationId,baseOptionId:selected.optionId}});
    return { session,getRecommendation:getAgentRecommendation(recommendationId),recommendation:getAgentRecommendation(recommendationId),assistantMessage,pendingQuestion };
  }
  if (action === "reject") {
    const rejected = setAgentRecommendationStatus(recommendationId, "rejected");
    if (pendingQuestion) setDiagnosticQuestionStatus(pendingQuestion.id, "assisting");
    const pendingEnrichment = getPendingEnrichmentQuestion(sessionId);
    if (pendingEnrichment && recommendation.targetFieldPath.startsWith("fact:")) setEnrichmentQuestionStatus(pendingEnrichment.id, "assisting");
    const userTurn = appendDiagnosticTurn({ sessionId, role: "user", content: "这些方案都不适合，暂不采用。", metadata: { intent: "reject_recommendation", recommendationId } });
    const assistantMessage = "没问题，这些方案不会写入策略。你可以直接描述真实做法，或者让我根据新的限制重新给出建议。";
    appendDiagnosticTurn({ sessionId, role: "assistant", content: assistantMessage, metadata: { recommendationId, sourceTurnId: userTurn.id } });
    return { recommendation: rejected, assistantMessage, pendingQuestion, sessionMeta: getDiagnosticSessionMeta(sessionId) };
  }
  const selected = recommendation.options.find((item) => item.optionId === optionId) || recommendation.options[0];
  const rawAcceptedValue = action === "accept_with_changes" && modifiedValue != null ? modifiedValue : selected?.completeValue;
  const acceptedValue = typeof rawAcceptedValue === "string" && recommendation.targetFieldPath === "business.conversionPath"
    ? { summary: rawAcceptedValue.trim(), steps: rawAcceptedValue.split(/\s*(?:→|->|到)\s*/).filter(Boolean), assumptions: [] }
    : typeof rawAcceptedValue === "string" && recommendation.targetFieldPath === "accountStrategy.contentResources"
    ? { summary: rawAcceptedValue.trim(), resourceTypes: [], publicUsage: "unknown" }
    : rawAcceptedValue;
  if (acceptedValue == null || (typeof acceptedValue === "string" && !acceptedValue.trim())) throw new Error("Accepted recommendation value is required");
  const acceptMode = action === "accept_with_changes" ? "modified" : selected.optionId === recommendation.options[0]?.optionId ? "recommended" : "alternative";
  const userTurn = appendDiagnosticTurn({ sessionId, role: "user", content: action === "accept_with_changes" ? "我调整后采纳这条建议。" : `我选择并采纳：${selected.label}`, metadata: { intent: "accept_recommendation", recommendationId, optionId: selected.optionId, acceptMode } });
  if (recommendation.targetFieldPath.startsWith("fact:")) {
    const factKey = recommendation.targetFieldPath.slice(5);
    applyProfileFactOperation({ accountId: session.accountId, sessionId, turnId: userTurn.id, factKey, factType: "operating_preference", predicate: `has_${factKey.replace(/[^a-z0-9]+/gi, "_")}`, value: acceptedValue, operation: "create", status: "user_asserted", confidence: 1, visibility: "unknown", contentUsage: "needs_review", sourceType: action === "accept_with_changes" ? "agent_recommendation_accepted_with_changes" : "agent_recommendation_accepted" });
    const enrichmentQuestion = getPendingEnrichmentQuestion(sessionId);
    if (enrichmentQuestion) {
      const previousCoverage=getDiagnosticCoverageState(sessionId,"dynamic_fact",enrichmentQuestion.category);
      const assessment=mergeCoverageAssessment(previousCoverage,conservativeCoverageFromAnswer("dynamic_fact",enrichmentQuestion.category,acceptedValue,typeof acceptedValue === "string" ? acceptedValue : JSON.stringify(acceptedValue)),{targetType:"dynamic_fact",targetId:enrichmentQuestion.category});
      upsertDiagnosticCoverageState({ ...assessment,sessionId,category:enrichmentQuestion.category,attempts:(previousCoverage?.attempts||0)+1,assessment:{ source:"accepted_recommendation" } });
    }
    if (enrichmentQuestion) setEnrichmentQuestionStatus(enrichmentQuestion.id, "answered");
    saveAgentRecommendationDecision({ recommendationId, selectedOptionId: selected.optionId, acceptMode, acceptedValue, validation: { valid: true, targetFactKey: factKey } });
    const accepted = setAgentRecommendationStatus(recommendationId, action === "accept_with_changes" ? "accepted_with_changes" : "accepted");
    const facts = listCurrentProfileFacts(session.accountId);
    const sessionFacts = listSessionProfileFacts(session.accountId, sessionId);
    const nextPlan = planNextEnrichmentQuestion({ facts: sessionFacts, claims:listCurrentProfileClaims(sessionId), previousQuestions: listEnrichmentQuestions(sessionId), coverageStates:listDiagnosticCoverageStates(sessionId) });
    let nextQuestion = null;
    let assistantMessage;
    if (nextPlan) {
      nextQuestion = createEnrichmentQuestion({ sessionId, ...nextPlan });
      updateDiagnosticSessionContext(sessionId, { enrichmentStatus: "active" });
      assistantMessage = `已将这条建议写入动态事实库。接下来：${nextQuestion.content}`;
    } else {
      updateDiagnosticSessionContext(sessionId, { enrichmentStatus: "completed" });
      assistantMessage = enrichmentCompletionMessage();
    }
    appendDiagnosticTurn({ sessionId, role: "assistant", content: assistantMessage, metadata: { recommendationId, factKey, questionKind: "enrichment", nextQuestionId: nextQuestion?.id || null } });
    return { session, sessionMeta: getDiagnosticSessionMeta(sessionId), sessionContext: getDiagnosticSessionContext(sessionId), claims: listCurrentProfileClaims(sessionId), facts, fieldStates: listDiagnosticFieldStates(sessionId), coverageStates:listDiagnosticCoverageStates(sessionId), draftReadiness: evaluateStrategyDraftReadiness(listCurrentProfileClaims(sessionId), listDiagnosticFieldStates(sessionId),listDiagnosticCoverageStates(sessionId)), pendingQuestion: null, pendingEnrichmentQuestion: nextQuestion, recommendation: accepted, assistantMessage };
  }
  upsertProfileClaim({ sessionId, fieldPath: recommendation.targetFieldPath, value: acceptedValue, type: "strategy_decision", sourceType: action === "accept_with_changes" ? "agent_recommendation_accepted_with_changes" : "agent_recommendation_accepted", sourceRef: recommendationId, confidence: 1, status: "confirmed" });
  const previousCoverage=getDiagnosticCoverageState(sessionId,"core_field",recommendation.targetFieldPath);
  const acceptedAssessment=mergeCoverageAssessment(previousCoverage,conservativeCoverageFromAnswer("core_field",recommendation.targetFieldPath,acceptedValue,typeof acceptedValue === "string" ? acceptedValue : JSON.stringify(acceptedValue)),{targetType:"core_field",targetId:recommendation.targetFieldPath});
  upsertDiagnosticCoverageState({ ...acceptedAssessment,sessionId,attempts:(previousCoverage?.attempts||0)+1,assessment:{ source:"accepted_recommendation" } });
  upsertDiagnosticFieldState({ sessionId, fieldPath: recommendation.targetFieldPath, state: acceptedAssessment.strategyReady ? "accepted_suggestion" : "partial", resolutionType: action === "accept_with_changes" ? "agent_recommendation_modified" : "agent_recommendation_accepted", attempts: 1, lastQuestionId: pendingQuestion?.id || null, metadata: { recommendationId, optionId: selected.optionId, userTurnId: userTurn.id } });
  for (const fieldState of listDiagnosticFieldStates(sessionId)) {
    if (fieldState.fieldPath !== recommendation.targetFieldPath && fieldState.state === "recommendation_pending" && fieldState.metadata?.recommendationId === recommendationId) {
      upsertDiagnosticFieldState({ sessionId, fieldPath: fieldState.fieldPath, state: pendingQuestion?.targetFieldPaths?.includes(fieldState.fieldPath) ? "asked" : "unasked", attempts: fieldState.attempts, lastQuestionId: pendingQuestion?.id || fieldState.lastQuestionId, metadata: {} });
    }
  }
  if (pendingQuestion) markDiagnosticQuestionAnswered(pendingQuestion.id);
  saveAgentRecommendationDecision({ recommendationId, selectedOptionId: selected.optionId, acceptMode, acceptedValue, validation: { valid: true, targetFieldPath: recommendation.targetFieldPath } });
  const accepted = setAgentRecommendationStatus(recommendationId, action === "accept_with_changes" ? "accepted_with_changes" : "accepted");
  const claims = listCurrentProfileClaims(sessionId);
  const facts = listCurrentProfileFacts(session.accountId);
  const fieldStates = listDiagnosticFieldStates(sessionId);
  const progress = evaluateDiagnosticCompleteness(claims);
  const metrics = evaluateProfileMetrics(claims, facts);
  const draftReadiness = evaluateStrategyDraftReadiness(claims, fieldStates, listDiagnosticCoverageStates(sessionId));
  const completionResolution=resolveTurnCompletion({progress,claims,facts,fieldStates,coverageStates:listDiagnosticCoverageStates(sessionId),previousQuestions:listDiagnosticQuestions(sessionId),targetAssessment:acceptedAssessment});
  const questionPlan=completionResolution.questionPlan;
  const completion = !(questionPlan?.targetFieldPaths || []).length;
  const assistantMessage = naturalRecommendationAcceptedMessage({ fieldPath:recommendation.targetFieldPath,value:acceptedValue,nextMessage:completion ? completionResolution.assistantMessage : questionPlan.content });
  appendDiagnosticTurn({ sessionId, role: "assistant", content: assistantMessage, metadata: { recommendationId, optionId: selected.optionId, questionPlan } });
  if (!completion) createDiagnosticQuestion({ sessionId, ...questionPlan });
  updateDiagnosticSessionMeta(sessionId, { conversationPhase: draftReadiness.coreComplete ? "core_complete" : "core_diagnosis", completionAnnouncedAt: draftReadiness.coreComplete ? new Date().toISOString() : null });
  const updatedSession = setDiagnosticProgress({ sessionId, status: draftReadiness.canGenerateDraft ? "ready_to_confirm" : "collecting", completeness: progress.completeness, criticalMissingFields: progress.criticalMissingFields });
  return { session: updatedSession, sessionMeta: getDiagnosticSessionMeta(sessionId), claims, facts, fieldStates, draftReadiness, progress: { ...progress, ...metrics, readyToDraft: draftReadiness.canGenerateDraft }, pendingQuestion: getPendingDiagnosticQuestion(sessionId), recommendation: accepted, assistantMessage };
}

export function recordRecommendationRevision({ sessionId,recommendationId,userInstruction,value,display=null,baseOptionId=null }) {
  const session=getDiagnosticSession(sessionId); const recommendation=getAgentRecommendation(recommendationId);
  if (!session || !recommendation || recommendation.sessionId!==sessionId || !["refining","revision_ready"].includes(recommendation.status)) throw new Error("Recommendation is not in refinement mode");
  appendDiagnosticTurn({sessionId,role:"user",content:userInstruction,metadata:{conversationMode:"recommendation_refinement",recommendationId}});
  const revised=saveAgentRecommendationRevision({recommendationId,baseOptionId,userInstruction,value,display:display||buildRecommendationDisplay({value,label:"调整后的方案"})});
  const assistantMessage="我已经根据你的想法生成了修改版。请先看方案内容；你可以继续告诉我哪里要改，也可以确认采用这版。";
  appendDiagnosticTurn({sessionId,role:"assistant",content:assistantMessage,metadata:{conversationMode:"recommendation_refinement",recommendationId,revision:revised.latestRevision?.revision}});
  return {session,recommendation:revised,assistantMessage,pendingQuestion:getPendingDiagnosticQuestion(sessionId),sessionMeta:getDiagnosticSessionMeta(sessionId)};
}

export function confirmStrategy({ sessionId, accountId, strategy }) {
  const claims = listCurrentProfileClaims(sessionId);
  const readiness = evaluateStrategyDraftReadiness(claims, listDiagnosticFieldStates(sessionId),listDiagnosticCoverageStates(sessionId));
  if (!readiness.canActivate) throw new Error(`Strategy is not ready to activate: ${readiness.unresolvedFields.join(", ") || readiness.activationMissingFields.join(", ")}`);
  const payload = createStrategyDraft({ accountId, claims, strategy });
  const validation = validateStrategyDraft(payload);
  if (!validation.valid) throw new Error(`Strategy draft is incomplete: ${validation.errors.join("; ")}`);
  const draft = saveStrategySnapshot({ accountId, sourceSessionId: sessionId, payload, status: "draft" });
  const active = activateStrategySnapshot(draft.id);
  setDiagnosticProgress({ sessionId, status: "completed", completeness: 100, criticalMissingFields: [] });
  updateDiagnosticSessionMeta(sessionId, { conversationPhase: "strategy_active" });
  return active;
}

export function activateConfirmedStrategyDraft({ sessionId, draftRevisionId }) {
  const session = getDiagnosticSession(sessionId);
  if (!session) throw activationConflict("诊断会话不存在", "SESSION_NOT_FOUND");
  if (!draftRevisionId) throw activationConflict("请选择要激活的策略草案版本", "DRAFT_REVISION_REQUIRED");
  const draftRevision = getStrategyDraftRevision(draftRevisionId);
  const latestRevision = getLatestStrategyDraftRevision(sessionId);
  if (!draftRevision || draftRevision.sessionId !== sessionId || draftRevision.accountId !== session.accountId) {
    throw activationConflict("该策略草案不属于当前诊断会话", "DRAFT_REVISION_MISMATCH");
  }
  if (!latestRevision || latestRevision.id !== draftRevision.id) {
    throw activationConflict("当前选择的不是最新策略草案，请打开最新版本后再激活", "DRAFT_NOT_LATEST");
  }
  if (draftRevision.stale) {
    throw activationConflict("策略信息已发生变化，这版草案已经过期，请先更新策略草案", "DRAFT_STALE", draftRevision.staleReasons);
  }
  const meta = getDiagnosticSessionMeta(sessionId);
  if (draftRevision.sourceClaimRevision !== meta.claimRevision || draftRevision.sourceFactRevision !== meta.factRevision) {
    throw activationConflict("策略事实或核心字段已更新，请重新生成草案后再激活", "DRAFT_CONTEXT_CHANGED");
  }
  const readiness = buildStrategyReadinessSnapshot({claims:listCurrentProfileClaims(sessionId),fieldStates:listDiagnosticFieldStates(sessionId),coverageStates:listDiagnosticCoverageStates(sessionId),pendingQuestion:getPendingDiagnosticQuestion(sessionId),pendingRecommendation:getPendingAgentRecommendation(sessionId),draftRevision,sessionMeta:meta});
  if (!readiness.canActivate) {
    throw activationConflict("当前策略信息尚未达到激活条件", "STRATEGY_NOT_READY", [...(readiness.unresolvedFields || []), ...(readiness.activationMissingFields || [])]);
  }
  if (draftRevision.validation?.semanticGate?.passed === false || draftRevision.validation?.activationAllowed === false || draftRevision.validation?.handoffAllowed === false) {
    throw activationConflict("策略草案未通过语义质量门禁，不能激活或交接内容 Agent", "STRATEGY_SEMANTIC_GATE_FAILED", (draftRevision.validation?.semanticGate?.errors || []).map((item)=>item.message || item.code));
  }
  const validation = validateStrategyDocumentV2(draftRevision.draft);
  if (!validation.valid) {
    throw activationConflict("策略草案未通过内容 Agent 消费协议校验，请重新生成", "STRATEGY_DOCUMENT_INVALID", validation.errors.map((item) => `${item.path} ${item.message}`));
  }
  const contextHash = draftRevision.validation?.contextHash || draftRevision.draft?.governance?.sourceContextHash;
  if (!contextHash || contextHash !== draftRevision.draft?.governance?.sourceContextHash) {
    throw activationConflict("策略草案的来源上下文无法核验，请重新生成", "STRATEGY_CONTEXT_HASH_MISMATCH");
  }
  const active = activateExactStrategyDocument({
    accountId: session.accountId,
    sourceSessionId: sessionId,
    sourceDraftRevisionId: draftRevision.id,
    payload: draftRevision.draft,
    documentHash: stableDocumentHash(draftRevision.draft),
    contextHash
  });
  setDiagnosticProgress({ sessionId, status: "completed", completeness: 100, criticalMissingFields: [] });
  updateDiagnosticSessionMeta(sessionId, { conversationPhase: "strategy_active" });
  return active;
}

export function rollbackStrategySnapshot({ accountId, targetSnapshotId }) {
  const target = getStrategySnapshot(targetSnapshotId);
  if (!target || target.accountId !== accountId) throw activationConflict("找不到要恢复的策略版本", "ROLLBACK_TARGET_NOT_FOUND");
  const document = target.document || target.payload;
  const validation = validateStrategyDocumentV2(document);
  if (!validation.valid || !target.sourceDraftRevisionId || !target.contextHash) {
    throw activationConflict("该历史版本不是可恢复的 v2 策略，只能保留查看", "ROLLBACK_TARGET_INCOMPATIBLE", validation.errors.map((item) => `${item.path} ${item.message}`));
  }
  return activateExactStrategyDocument({
    accountId,
    sourceSessionId: target.sourceSessionId || `rollback:${target.id}`,
    sourceDraftRevisionId: target.sourceDraftRevisionId,
    payload: document,
    documentHash: stableDocumentHash(document),
    contextHash: target.contextHash,
    activationReason: `rollback_from:${target.id}`
  });
}

export function publishDirectionSet({ strategySnapshotId, rawDirectionSet }) {
  const payload = normalizeDirectionSet(rawDirectionSet, strategySnapshotId);
  const validation = validateDirectionSet(payload);
  if (!validation.valid) throw new Error(`Direction set is incomplete: ${validation.errors.join("; ")}`);
  return saveDirectionSet({ strategySnapshotId, payload, status: "active" });
}
