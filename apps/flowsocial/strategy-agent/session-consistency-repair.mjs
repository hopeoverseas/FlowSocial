import { diagnosticFieldOrder } from "./diagnostic-state-resolver.mjs";
import { completeRecommendationValue } from "./recommendation-contract.mjs";
import { conservativeCoverageFromAnswer, mergeCoverageAssessment } from "./profile-coverage-registry.mjs";
import { getDiagnosticCoverageState,getDiagnosticSession,listAgentRecommendations,listCurrentProfileClaims,listDiagnosticCoverageStates,listDiagnosticFieldStates,listDiagnosticQuestions,markDiagnosticQuestionAnswered,setDiagnosticQuestionStatus,upsertDiagnosticCoverageState,upsertDiagnosticFieldState } from "./strategy-store.mjs";

const activeQuestionStates=new Set(["pending","assisting","recommendation_pending"]);

export function repairSessionConsistency(sessionId) {
  const session=getDiagnosticSession(sessionId); if (!session) return {repaired:false,actions:[]};
  const actions=[];
  const questions=listDiagnosticQuestions(sessionId);
  const active=questions.filter((item)=>activeQuestionStates.has(item.status));
  for (const duplicate of active.slice(0,-1)) { setDiagnosticQuestionStatus(duplicate.id,"superseded"); actions.push({type:"close_duplicate_question",questionId:duplicate.id}); }
  const claims=listCurrentProfileClaims(sessionId);
  const states=new Map(listDiagnosticFieldStates(sessionId).map((item)=>[item.fieldPath,item]));
  for (const claim of claims) {
    if (!claim.fieldPath || !claim.fieldPath.match(/^(business|audiences|accountStrategy)\./)) continue;
    let coverage=getDiagnosticCoverageState(sessionId,"core_field",claim.fieldPath);
    if (!coverage) {
      const inferred=conservativeCoverageFromAnswer("core_field",claim.fieldPath,claim.value,typeof claim.value==="string"?claim.value:JSON.stringify(claim.value));
      coverage=upsertDiagnosticCoverageState({...inferred,sessionId,attempts:0,assessment:{source:"legacy_session_repair",requiresUserReview:true}});
      actions.push({type:"backfill_coverage",fieldPath:claim.fieldPath,status:coverage.status});
    }
    const fieldState=states.get(claim.fieldPath);
    const desired=coverage.strategyReady ? (/agent_recommendation_accepted/.test(claim.sourceType||"")?"accepted_suggestion":"confirmed") : "partial";
    if (fieldState?.state!==desired && !["skipped","temporarily_unknown","not_available"].includes(fieldState?.state)) {
      upsertDiagnosticFieldState({sessionId,fieldPath:claim.fieldPath,state:desired,resolutionType:"consistency_repair",attempts:fieldState?.attempts||0,lastQuestionId:fieldState?.lastQuestionId||null,metadata:{...(fieldState?.metadata||{}),repairedAt:new Date().toISOString()}});
      actions.push({type:"align_field_state",fieldPath:claim.fieldPath,state:desired});
    }
  }
  // Coverage is the authoritative current projection. Historical question
  // creation may have moved a completed field back to `asked`; repair only the
  // projection and leave the question/turn ledger immutable.
  for (const coverage of listDiagnosticCoverageStates(sessionId).filter((item)=>item.targetType==="core_field"&&diagnosticFieldOrder.includes(item.targetId))) {
    if (!coverage.strategyReady) continue;
    const fieldState=states.get(coverage.targetId);
    if (["asked","partial","unasked","recommendation_pending"].includes(fieldState?.state)) {
      const claim=claims.find((item)=>item.fieldPath===coverage.targetId);
      const desired=/agent_recommendation_accepted/.test(claim?.sourceType||"")?"accepted_suggestion":"confirmed";
      upsertDiagnosticFieldState({sessionId,fieldPath:coverage.targetId,state:desired,resolutionType:"coverage_authority_repair",attempts:fieldState?.attempts||0,lastQuestionId:fieldState?.lastQuestionId||null,metadata:{...(fieldState?.metadata||{}),coverageProjectionRepairedAt:new Date().toISOString()}});
      states.set(coverage.targetId,{...fieldState,state:desired});
      actions.push({type:"restore_strategy_ready_field",fieldPath:coverage.targetId,state:desired});
    }
  }
  for (const recommendation of listAgentRecommendations(sessionId).filter((item)=>["accepted","accepted_with_changes"].includes(item.status))) {
    const factTarget=recommendation.targetFieldPath.startsWith("fact:"); if (factTarget) continue;
    const existing=getDiagnosticCoverageState(sessionId,"core_field",recommendation.targetFieldPath);
    if (existing?.strategyReady) continue;
    const acceptedValue=completeRecommendationValue(recommendation.targetFieldPath,recommendation.decision?.acceptedValue ?? recommendation.recommendedValue);
    const assessed=mergeCoverageAssessment(existing,conservativeCoverageFromAnswer("core_field",recommendation.targetFieldPath,acceptedValue,JSON.stringify(acceptedValue)),{targetType:"core_field",targetId:recommendation.targetFieldPath});
    upsertDiagnosticCoverageState({...assessed,sessionId,attempts:existing?.attempts||0,assessment:{source:"accepted_recommendation_repair",recommendationId:recommendation.id}});
    if (assessed.strategyReady) upsertDiagnosticFieldState({sessionId,fieldPath:recommendation.targetFieldPath,state:"accepted_suggestion",resolutionType:"accepted_recommendation_repair",attempts:states.get(recommendation.targetFieldPath)?.attempts||0,lastQuestionId:null,metadata:{recommendationId:recommendation.id}});
    actions.push({type:"repair_accepted_recommendation",fieldPath:recommendation.targetFieldPath,status:assessed.status});
  }
  const coverageSlotClosed=(coverage,slotId)=>[...(coverage?.capturedSlots||[]),...(coverage?.skippedSlots||[])].some((item)=>(typeof item==="string"?item:item?.slot||item?.id)===slotId);
  for (const activeQuestion of listDiagnosticQuestions(sessionId).filter((item)=>activeQuestionStates.has(item.status))) {
    if (!activeQuestion.targetFieldPaths?.length) continue;
    const resolved=activeQuestion.targetFieldPaths.every((field)=>{
      const coverage=getDiagnosticCoverageState(sessionId,"core_field",field);
      return coverage?.strategyReady || (activeQuestion.targetSlotIds?.length&&activeQuestion.targetSlotIds.every((slotId)=>coverageSlotClosed(coverage,slotId)));
    });
    if (resolved) {
      markDiagnosticQuestionAnswered(activeQuestion.id);
      actions.push({type:"close_resolved_question",questionId:activeQuestion.id});
    }
  }
  return {repaired:Boolean(actions.length),actions,coverageStates:listDiagnosticCoverageStates(sessionId)};
}
