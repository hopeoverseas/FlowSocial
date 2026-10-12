import assert from "node:assert/strict";
import { database } from "../../storage.mjs";
import { decideAgentRecommendation, recordRecommendationRevision, startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { buildRecommendationDisplay } from "../../strategy-agent/recommendation-contract.mjs";
import { buildStrategyReadinessSnapshot } from "../../strategy-agent/strategy-readiness.mjs";
import { repairSessionConsistency } from "../../strategy-agent/session-consistency-repair.mjs";
import { conservativeCoverageFromAnswer, coreFieldSpecs } from "../../strategy-agent/profile-coverage-registry.mjs";
import { buildDeterministicDiagnosticFallback } from "../../strategy-agent/deterministic-extractor.mjs";
import { buildDiagnosticSummary } from "../../strategy-agent/strategy-presentation.mjs";
import { createAgentRecommendation,createDiagnosticQuestion,getAgentRecommendation,getPendingDiagnosticQuestion,listDiagnosticFieldStates,listDiagnosticQuestions,upsertDiagnosticCoverageState,upsertDiagnosticFieldState,upsertProfileClaim } from "../../strategy-agent/strategy-store.mjs";

const accountId=`state_test_${Date.now()}`;
const started=startDiagnostic({accountId});
const sessionId=started.session.id;

try {
  const overview="我们主要提供企业知识库、AI员工和定制智能体，采用项目制收费和顾问式交付。主要客户是成长期外贸工厂的老板和运营负责人。账号目标是未来三个月获取高质量销售线索，目前处于起号阶段。小红书负责场景触达和需求发现，公众号负责深度干货和信任沉淀。用户看完内容后在文末添加销售微信，由销售了解需求并安排诊断，之后提供方案并签约。目前有产品资料、客户案例和SOP，案例需要脱敏后公开。客户名称不能公开，效果不能承诺，数据必须标注来源，内容发布前需要负责人审核。";
  const extraction=buildDeterministicDiagnosticFallback(overview,[],{id:"opening",content:"请介绍业务",targetFieldPaths:["business.primaryOffers","business.businessModel","audiences.primary","accountStrategy.primaryGoal"]});
  assert.deepEqual(new Set(extraction.coreClaimOperations.map((item)=>item.fieldPath)),new Set(Object.keys(coreFieldSpecs)),"整段明确回答必须在同一轮拆入九项核心字段");
  assert.deepEqual(extraction.coreClaimOperations.find((item)=>item.fieldPath==="business.primaryOffers")?.value,["企业知识库","AI员工","定制智能体"],"产品字段不得混入收费或交付方式");
  assert.equal(extraction.coreClaimOperations.find((item)=>item.fieldPath==="accountStrategy.platformRoles")?.value?.xiaohongshu,"场景触达和需求发现","平台角色必须与咨询入口分离");
  assert.equal(extraction.coreClaimOperations.find((item)=>item.fieldPath==="accountStrategy.contentResources")?.value?.publicUsage,"anonymized");
  const replayClaims=extraction.coreClaimOperations.map((item)=>({fieldPath:item.fieldPath,value:item.value,status:"confirmed",confidence:1}));
  const replayCoverage=extraction.coreClaimOperations.map((item)=>conservativeCoverageFromAnswer("core_field",item.fieldPath,item.value,overview));
  const replayStates=extraction.coreClaimOperations.map((item)=>({fieldPath:item.fieldPath,state:"partial"}));
  const replayReadiness=buildStrategyReadinessSnapshot({claims:replayClaims,fieldStates:replayStates,coverageStates:replayCoverage});
  const replaySummary=buildDiagnosticSummary({claims:replayClaims,fieldStates:replayStates,coverageStates:replayCoverage});
  assert.equal(replayReadiness.canGenerateMinimumDraft,true);
  assert.equal(replaySummary.minimumDraftReady,replayReadiness.minimumDraftReady,"页面字段摘要与最低草案门槛必须来自同一规范判定");
  assert.equal(replaySummary.processed,replayReadiness.processedCount);
  assert.equal(replaySummary.fields.find((item)=>item.fieldPath==="business.primaryOffers")?.status,"confirmed","有效字段不能在页面继续显示信息不完整");

  createDiagnosticQuestion({sessionId,content:"用户看完内容后如何进入合作？",targetFieldPaths:["business.conversionPath"]});
  const recommendation=createAgentRecommendation({sessionId,accountId,targetFieldPath:"business.conversionPath",recommendedValue:"内容结尾咨询 → 添加销售微信 → 收集公司和需求 → 判断有效线索 → 需求诊断 → 方案沟通 → 签约",rationale:["适合企业服务的长决策链路"],alternatives:["公众号表单 → 销售跟进 → 需求诊断 → 签约"]});
  assert.equal(typeof recommendation.options[0].display.summary,"string");
  assert.ok(!recommendation.options[0].display.summary.includes("{"),"客户展示层不得出现JSON");

  const refining=decideAgentRecommendation({sessionId,recommendationId:recommendation.id,action:"begin_refinement",optionId:recommendation.options[0].optionId});
  assert.equal(refining.recommendation.status,"refining");
  assert.match(refining.assistantMessage,/想调整/);
  const revisedValue={...recommendation.options[0].completeValue,contactChannel:"企业微信",firstResponse:"30分钟内由销售回复"};
  const revised=recordRecommendationRevision({sessionId,recommendationId:recommendation.id,userInstruction:"改成企业微信承接，并补充回复时效",value:revisedValue,display:buildRecommendationDisplay({value:revisedValue,label:"调整后的企业微信承接方案"})});
  assert.equal(revised.recommendation.status,"revision_ready");
  const accepted=decideAgentRecommendation({sessionId,recommendationId:recommendation.id,action:"accept_with_changes",optionId:revised.recommendation.options[0].optionId});
  assert.equal(accepted.recommendation.status,"accepted_with_changes");
  assert.notEqual(getPendingDiagnosticQuestion(sessionId)?.targetFieldPaths?.[0],"business.conversionPath","采纳完整建议后不得重复原问题");

  const fullSession=startDiagnostic({accountId:`full_${Date.now()}`});
  try {
    for (const [fieldPath,spec] of Object.entries(coreFieldSpecs)) {
      upsertProfileClaim({sessionId:fullSession.session.id,fieldPath,value:{summary:`${spec.label}已确认`},sourceType:"user_statement",sourceRef:`full_${fieldPath}`,confidence:1,status:"confirmed"});
      upsertDiagnosticCoverageState({sessionId:fullSession.session.id,targetType:"core_field",targetId:fieldPath,capturedSlots:spec.slots.filter((item)=>item.required).map((item)=>({slot:item.id,value:"已确认",confidence:1,source:"test"})),missingRequiredSlots:[],missingOptionalSlots:[],status:"confirmed",strategyReady:true,contentReady:true,attempts:1,assessment:{source:"test"}});
      upsertDiagnosticFieldState({sessionId:fullSession.session.id,fieldPath,state:"confirmed",resolutionType:"test"});
    }
    const readiness=buildStrategyReadinessSnapshot({claims:[],fieldStates:[],coverageStates:[]});
    assert.equal(readiness.core.total,9);
    const claims=database.prepare("SELECT field_path FROM profile_claims WHERE session_id=?").all(fullSession.session.id);
    const coverage=database.prepare("SELECT target_type,target_id,status,strategy_ready,content_ready,captured_slots_json,missing_required_slots_json,missing_optional_slots_json,attempts,assessment_json,category,session_id,updated_at FROM diagnostic_coverage_states WHERE session_id=?").all(fullSession.session.id).map((row)=>({sessionId:row.session_id,targetType:row.target_type,targetId:row.target_id,status:row.status,strategyReady:Boolean(row.strategy_ready),contentReady:Boolean(row.content_ready),capturedSlots:JSON.parse(row.captured_slots_json),missingRequiredSlots:JSON.parse(row.missing_required_slots_json),missingOptionalSlots:JSON.parse(row.missing_optional_slots_json),attempts:row.attempts,assessment:JSON.parse(row.assessment_json),category:row.category,updatedAt:row.updated_at}));
    const states=Object.keys(coreFieldSpecs).map((fieldPath)=>({fieldPath,state:"confirmed"}));
    const fullReady=buildStrategyReadinessSnapshot({claims:Object.keys(coreFieldSpecs).map((fieldPath)=>({fieldPath,value:{summary:"已确认"},status:"confirmed"})),fieldStates:states,coverageStates:coverage,draftRevision:{id:"draft_test",stale:false,sourceClaimRevision:1,sourceFactRevision:1,validation:{valid:true}},sessionMeta:{claimRevision:1,factRevision:1}});
    assert.equal(fullReady.canActivate,true,"动态画像0/14不得阻止完整核心策略激活");
    assert.equal(fullReady.core.processed,9);
    const blockedSemantic=buildStrategyReadinessSnapshot({claims:Object.keys(coreFieldSpecs).map((fieldPath)=>({fieldPath,value:{summary:"已确认"},status:"confirmed"})),fieldStates:states,coverageStates:coverage,draftRevision:{id:"draft_semantic_blocked",stale:false,sourceClaimRevision:1,sourceFactRevision:1,validation:{valid:true,semanticGate:{passed:false,errors:[{message:"产品名称不可用"}]}}},sessionMeta:{claimRevision:1,factRevision:1}});
    assert.equal(blockedSemantic.canActivate,false,"未通过语义门禁的草案不得激活");
    assert(blockedSemantic.blockingIssues.some((item)=>item.code==="DRAFT_SEMANTIC_GATE_FAILED"));
  } finally { database.prepare("DELETE FROM diagnostic_sessions WHERE id=?").run(fullSession.session.id); }

  createDiagnosticQuestion({sessionId,content:"重复问题A",targetFieldPaths:["accountStrategy.primaryGoal"]});
  createDiagnosticQuestion({sessionId,content:"重复问题B",targetFieldPaths:["accountStrategy.primaryGoal"]});
  const repair=repairSessionConsistency(sessionId);
  assert.equal(listDiagnosticQuestions(sessionId).filter((item)=>["pending","assisting","recommendation_pending"].includes(item.status)).length,1,"旧会话只能保留一个活动问题");
  assert.equal(repair.repaired,false,"新问题账本应在写入时防止重复活动问题，无需事后修复");

  upsertProfileClaim({sessionId,fieldPath:"accountStrategy.primaryGoal",value:{summary:"获得高质量线索"},sourceType:"test",sourceRef:"coverage_authority",confidence:1,status:"confirmed"});
  const goalSpec=coreFieldSpecs["accountStrategy.primaryGoal"];
  upsertDiagnosticCoverageState({sessionId,targetType:"core_field",targetId:"accountStrategy.primaryGoal",capturedSlots:goalSpec.slots.filter((item)=>item.required).map((item)=>({slot:item.id,value:"已确认",confidence:1,source:"test"})),missingRequiredSlots:[],missingOptionalSlots:[],status:"confirmed",strategyReady:true,contentReady:true,attempts:1,assessment:{source:"coverage_authority"}});
  upsertDiagnosticFieldState({sessionId,fieldPath:"accountStrategy.primaryGoal",state:"asked",resolutionType:"historical_question_creation"});
  const authorityRepair=repairSessionConsistency(sessionId);
  assert.equal(listDiagnosticFieldStates(sessionId).find((item)=>item.fieldPath==="accountStrategy.primaryGoal")?.state,"confirmed","strategyReady coverage不得被问题创建降级为asked");
  assert.equal(getPendingDiagnosticQuestion(sessionId),null,"已关闭槽位对应的pending问题必须结束");
  assert.ok(authorityRepair.actions.some((item)=>item.type==="restore_strategy_ready_field"));

  console.log(JSON.stringify({status:"strategy-dialogue-state-self-test passed",naturalDisplay:true,refinementRevision:revised.recommendation.latestRevision.revision,repeatedQuestionPrevented:true,coverageAuthorityRestored:true,coreFieldTotal:9,dynamicOptional:true,repairActions:authorityRepair.actions.length},null,2));
} finally {
  database.prepare("DELETE FROM diagnostic_sessions WHERE id=?").run(sessionId);
  database.prepare("DELETE FROM profile_fact_events WHERE account_id=?").run(accountId);
  database.prepare("DELETE FROM profile_current_facts WHERE account_id=?").run(accountId);
}

