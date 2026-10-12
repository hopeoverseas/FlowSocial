import assert from "node:assert/strict";
import { recordDiagnosticAnalysis, startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { createDiagnosticQuestion, createStrategyDraftRequest, getStrategyDraftRequest, listDiagnosticFieldStates, listDiagnosticQuestions, updateStrategyDraftRequest } from "../../strategy-agent/strategy-store.mjs";
import { openingDiagnosticQuestion, planNextDiagnosticQuestion } from "../../strategy-agent/question-planner.mjs";
import { buildDiagnosticSummary } from "../../strategy-agent/strategy-presentation.mjs";
import { normalizeCoverageAssessment } from "../../strategy-agent/profile-coverage-registry.mjs";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2 } from "../../strategy-agent/strategy-document.mjs";
import { resolveStrategyNextAction } from "../../strategy-agent/strategy-session-state.mjs";

const accountId=`state_regression_${Date.now()}`;
const started=startDiagnostic({accountId,restartMode:"fresh"});
createDiagnosticQuestion({sessionId:started.session.id,...openingDiagnosticQuestion()});
const summary=buildDiagnosticSummary({claims:[],fieldStates:listDiagnosticFieldStates(started.session.id),coverageStates:[]});
assert.equal(summary.processed,0,"an opening question must not count touched fields as completed");
assert.equal(summary.inProgress,4,"the four opening targets should be shown as in progress");
recordDiagnosticAnalysis({sessionId:started.session.id,userMessage:"我们采用项目制交付。",analysis:{intent:"direct_answer",coreClaimOperations:[{operation:"create",fieldPath:"business.businessModel",value:"项目制服务",sourceType:"user_statement",status:"confirmed"}],answerAssessment:{status:"partially_answered",answeredFieldPaths:["business.businessModel"]}}});
const openingLedger=listDiagnosticQuestions(started.session.id);
assert.equal(openingLedger[0].status,"answered","an answer to any canonical opening target must close the opening question");
assert.notEqual(openingLedger.at(-1)?.content,openingLedger[0].content,"a closed opening question must not be asked again");
const request=createStrategyDraftRequest({requestId:`draftreq_state_${Date.now()}`,sessionId:started.session.id,accountId});
assert.equal(request.status,"running");
updateStrategyDraftRequest({requestId:request.id,sessionId:started.session.id,status:"failed",errorCode:"TEST_FAILURE",errorMessage:"isolated"});
assert.equal(getStrategyDraftRequest(started.session.id,request.id).errorCode,"TEST_FAILURE","draft request state must remain queryable by session and request id");

const initialConversion=normalizeCoverageAssessment({capturedSlots:[],status:"partial"},{targetType:"core_field",targetId:"business.conversionPath"});
const afterSingleSkip=normalizeCoverageAssessment({capturedSlots:[],skippedSlots:["entryCTA"],status:"partial"},{targetType:"core_field",targetId:"business.conversionPath"});
assert(!afterSingleSkip.missingRequiredSlots.includes("entryCTA"),"the current slot should be skipped");
assert(afterSingleSkip.missingRequiredSlots.includes("contactChannel"),"the remaining field slots must stay active");
const next=planNextDiagnosticQuestion({claims:[],fieldStates:[],coverageStates:[afterSingleSkip],previousQuestions:[],targetAssessment:afterSingleSkip});
assert.deepEqual(next.targetSlotIds,["contactChannel"],"the planner must continue with the next slot in the same field");
assert.equal(resolveStrategyNextAction({readiness:{canGenerateMinimumDraft:false}}).type,"continue_strategy_diagnosis");
assert.equal(resolveStrategyNextAction({readiness:{canGenerateMinimumDraft:true},strategyDecision:{ready:false}}).type,"confirm_strategy_decisions","minimum readiness must lead to account/playbook confirmation, not draft generation");
assert.equal(resolveStrategyNextAction({readiness:{canGenerateMinimumDraft:true},strategyDecision:{ready:true}}).type,"generate_strategy_draft");

const claims=[
  {id:"offer_claim",fieldPath:"business.primaryOffers",value:["企业知识库服务"],status:"confirmed",confidence:1},
  {id:"audience_claim",fieldPath:"audiences.primary",value:["成长型科技企业负责人"],status:"confirmed",confidence:1},
  {id:"conversion_claim",fieldPath:"business.conversionPath",value:{entryCTA:"文章结尾邀请咨询",contactChannel:"添加企业微信：secret_wx_12345",handoffOwner:"销售顾问",informationCollection:"公司、需求和预算",leadQualification:"需求、预算和决策条件匹配",diagnosticStep:"安排需求诊断",nextBusinessStep:"输出方案",cooperationEntry:"确认范围后签约"},status:"confirmed",confidence:1},
  {id:"goal_claim",fieldPath:"accountStrategy.primaryGoal",value:{summary:"获得高质量销售线索"},status:"confirmed",confidence:1}
];
const facts=[{id:"fact_1",factKey:"audience.common_objection",factType:"audience_insight",predicate:"has_common_objection",value:"客户担心项目落地周期过长",status:"user_asserted",confidence:0.95,visibility:"internal",contentUsage:"needs_review"}];
const bundle=assembleStrategyInputBundle({account:{id:accountId,name:"测试公司"},claims,facts,factSnapshotId:"factsnapshot_test"});
const document=createStrategyDocumentV2({accountId,claims,strategyInputBundle:bundle,suggestion:{schemaVersion:"2.0",business:{offers:["@{name=broken}"]},strategy:{objectives:["@{id=broken}"],conversionSystem:{primaryPath:"@{id=broken}"}}}});
assert.equal(document.business.offers[0].name,"企业知识库服务","malformed model objects must not replace confirmed claims");
assert.equal(document.strategy.conversionSystem.contactChannel,"联系企业服务人员","the conversion channel must be normalized to a planning-safe action");
assert(!JSON.stringify(document.strategy.conversionSystem).includes("secret_wx_12345"),"sensitive contact details must not enter the strategy document");
assert.equal(document.governance.factSnapshotId,"factsnapshot_test","the draft must freeze its fact snapshot");
assert.equal(document.governance.factApplications.length,1,"every governed dynamic fact needs an explicit disposition");
assert.equal(document.strategy.dynamicContext.strategySignals.length,1,"strategy-impact facts must materially enter the strategy document");

console.log(JSON.stringify({status:"strategy-agent-state-regression-self-test passed",summary:{completed:summary.processed,inProgress:summary.inProgress},nextSkippedSlot:next.targetSlotIds[0],conversionSteps:document.strategy.conversionSystem.primaryPath.steps,factApplications:document.governance.factApplications},null,2));

