import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recordDiagnosticAnalysis, sanitizeConsultativeAcknowledgement, startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { conservativeCoverageFromAnswer, coreFieldSpecs, normalizeCoverageAssessment } from "../../strategy-agent/profile-coverage-registry.mjs";
import { resolveDiagnosticState } from "../../strategy-agent/diagnostic-state-resolver.mjs";
import { resolveTurnCompletion } from "../../strategy-agent/turn-completion-resolver.mjs";
import { buildStrategyReadinessSnapshot } from "../../strategy-agent/strategy-readiness.mjs";
import { createDiagnosticQuestion, getPendingDiagnosticQuestion, listCurrentProfileClaims, listDiagnosticCoverageStates, listDiagnosticFieldStates, listDiagnosticQuestions, listDiagnosticTurns, upsertDiagnosticCoverageState, upsertDiagnosticFieldState, upsertProfileClaim } from "../../strategy-agent/strategy-store.mjs";
import { database } from "../../storage.mjs";

const fixture=JSON.parse(readFileSync(new URL("./fixtures/strategy-dialogue/atomicity-and-readiness.json",import.meta.url),"utf8"));
const composerFixture=JSON.parse(readFileSync(new URL("./fixtures/strategy-dialogue/composer-near-duplicate-question.json",import.meta.url),"utf8"));
const accountId=`atomic_${Date.now()}`;
const started=startDiagnostic({accountId});
const sessionId=started.session.id;

try {
  const sanitizedComposer=sanitizeConsultativeAcknowledgement(composerFixture.modelReply);
  assert.equal(sanitizedComposer,composerFixture.expectedAcknowledgement);
  const finalComposerReply=`${sanitizedComposer}\n\n${composerFixture.canonicalQuestion}`;
  assert.equal(finalComposerReply.split(composerFixture.canonicalQuestion).length-1,1,"最终回复只能追加一次 canonical question");
  assert.ok(!finalComposerReply.includes("品牌曝光，还是有效咨询"),"模型的近义选择题必须被移除");
  createDiagnosticQuestion({sessionId,content:"用户从内容如何进入后续合作？",targetFieldPaths:[fixture.expected.pendingTarget],targetSlotIds:["entryCTA","contactChannel"]});
  const failed=recordDiagnosticAnalysis({sessionId,userMessage:"我想先做品牌曝光",analysis:{intent:"direct_answer",coreClaimOperations:[],targetAssessment:fixture.wrongTargetAssessment,nextQuestionRecommendation:fixture.freeModelQuestion}});
  assert.equal(getPendingDiagnosticQuestion(sessionId)?.targetFieldPaths?.[0],fixture.expected.pendingTarget,"无同目标证据时不得关闭当前问题");
  assert.equal(failed.pendingQuestion?.id,getPendingDiagnosticQuestion(sessionId)?.id);

  const coverage=conservativeCoverageFromAnswer("core_field",fixture.expected.pendingTarget,fixture.conversionAnswer,fixture.conversionAnswer);
  const accepted=recordDiagnosticAnalysis({sessionId,userMessage:fixture.conversionAnswer,analysis:{intent:"direct_answer",coreClaimOperations:[{operation:"create",fieldPath:fixture.expected.pendingTarget,value:fixture.conversionAnswer,status:"confirmed"}],targetAssessment:coverage,nextQuestionRecommendation:fixture.freeModelQuestion,acknowledgement:"已记录转化链路。"}});
  assert.notEqual(accepted.pendingQuestion?.id,failed.pendingQuestion?.id,"同目标证据写入后旧问题才可关闭");
  assert.ok(listDiagnosticQuestions(sessionId).filter((item)=>["pending","assisting","recommendation_pending"].includes(item.status)).length<=1,"问题账本最多一个活动问题");
  assert.ok(!accepted.assistantMessage.includes(fixture.freeModelQuestion),"模型自由问题不得进入诊断主链");

  const readinessClaims=[];
  const readinessStates=[];
  const readinessCoverage=[];
  for (const [fieldPath,spec] of Object.entries(coreFieldSpecs)) {
    const value=fieldPath==="business.conversionPath"?fixture.conversionAnswer:{summary:`${spec.label}已确认`};
    readinessClaims.push({fieldPath,value,status:"confirmed"});
    readinessStates.push({fieldPath,state:"confirmed"});
    const assessment=fieldPath==="business.conversionPath"
      ? coverage
      : normalizeCoverageAssessment({capturedSlots:[{slot:spec.slots.find((item)=>item.required)?.id,value:"已确认",confidence:1,source:"test"}]},{targetType:"core_field",targetId:fieldPath});
    readinessCoverage.push(assessment);
  }
  const readiness=resolveDiagnosticState(readinessClaims,readinessStates,readinessCoverage);
  assert.equal(readiness.minimumDraftReady,fixture.expected.minimumDraftReady,"有效 claim 不应因部分 coverage 被抹除");
  assert.equal(readiness.qualityComplete,fixture.expected.qualityComplete);
  const completion=resolveTurnCompletion({claims:readinessClaims,fieldStates:readinessStates,coverageStates:readinessCoverage,modelRecommendation:fixture.freeModelQuestion});
  assert.equal(completion.state,fixture.expected.nextAction);
  assert.equal(completion.questionPlan,null);
  const snapshot=buildStrategyReadinessSnapshot({claims:readinessClaims,fieldStates:readinessStates,coverageStates:readinessCoverage});
  assert.equal(snapshot.schemaVersion,"1.2");
  assert.equal(snapshot.stage,"minimum_ready");
  assert.equal(snapshot.coreDiagnosis.minimumReady,true);
  assert.equal(snapshot.coreDiagnosis.qualityComplete,false);
  assert.equal(snapshot.nextAction.type,"confirm_strategy_decisions");
  const blockedDraft={id:"draft_blocked",revision:1,sourceClaimRevision:0,sourceFactRevision:0,stale:false,validation:{valid:true,activationAllowed:false,handoffAllowed:false,semanticGate:{passed:true,activationAllowed:false,handoffAllowed:false,errors:[]}}};
  const blockedSnapshot=buildStrategyReadinessSnapshot({claims:readinessClaims,fieldStates:readinessStates,coverageStates:readinessCoverage,draftRevision:blockedDraft,sessionMeta:{claimRevision:0,factRevision:0}});
  assert.equal(blockedSnapshot.canActivate,false,"UI readiness 必须服从草案 activation/handoff 门禁");
  assert.ok(blockedSnapshot.blockingItems.some((item)=>item.code==="DRAFT_ACTIVATION_NOT_ALLOWED"));

  const skipSession=startDiagnostic({accountId:`skip_${Date.now()}`}).session;
  try {
    createDiagnosticQuestion({sessionId:skipSession.id,content:"哪些效果不能承诺？",targetFieldPaths:["accountStrategy.constraints"],targetSlotIds:["forbiddenClaims"]});
    const skipped=recordDiagnosticAnalysis({sessionId:skipSession.id,userMessage:"跳过这个问题",analysis:{intent:"skip_question",coreClaimOperations:[]}});
    const skipCoverage=listDiagnosticCoverageStates(skipSession.id).find((item)=>item.targetId==="accountStrategy.constraints");
    const skipFieldState=listDiagnosticFieldStates(skipSession.id).find((item)=>item.fieldPath==="accountStrategy.constraints");
    assert.ok(skipCoverage?.skippedSlots.includes("forbiddenClaims"),"跳过当前问题必须关闭对应槽位并写入问题账本");
    assert.notEqual(skipFieldState?.state,"temporarily_unknown","跳过一个槽位不得把整个策略字段标成暂时未知");
    assert.notDeepEqual(skipped.pendingQuestion?.targetSlotIds,["forbiddenClaims"],"已跳过槽位不得立即重复追问");
  } finally {
    database.prepare("DELETE FROM diagnostic_sessions WHERE id=?").run(skipSession.id);
  }
  const provenanceSession=startDiagnostic({accountId:`provenance_${Date.now()}`}).session;
  try {
    recordDiagnosticAnalysis({sessionId:provenanceSession.id,userMessage:"我们采用项目制交付",sourceTurnId:"turn_from_another_session",analysis:{intent:"direct_answer",coreClaimOperations:[{operation:"create",fieldPath:"business.businessModel",value:"项目制交付",sourceType:"user_statement",sourceRef:"model_supplied_source",status:"confirmed"}]}});
    const sourceClaim=listCurrentProfileClaims(provenanceSession.id).find((item)=>item.fieldPath==="business.businessModel");
    const sourceTurn=listDiagnosticTurns(provenanceSession.id).find((item)=>item.role==="user"&&item.content==="我们采用项目制交付");
    assert.equal(sourceClaim?.sourceRef,sourceTurn?.id,"模型或跨会话 sourceRef 不得覆盖本轮用户回答来源");
  } finally {
    database.prepare("DELETE FROM diagnostic_sessions WHERE id=?").run(provenanceSession.id);
  }
  const appSource=readFrontendSourceSync();
  assert.match(appSource,/coreDiagnosis\?\.missingFields/,"前端核心缺失计数必须只读取规范核心缺口");
  assert.match(appSource,/confirm_strategy_decisions/,"前端必须把账号决策显示为独立下一动作");

  console.log(JSON.stringify({status:"strategy-dialogue-atomicity-self-test passed",caseId:fixture.caseId},null,2));
} finally {
  database.prepare("DELETE FROM diagnostic_sessions WHERE id=?").run(sessionId);
  database.prepare("DELETE FROM profile_fact_events WHERE account_id=?").run(accountId);
  database.prepare("DELETE FROM profile_current_facts WHERE account_id=?").run(accountId);
}
