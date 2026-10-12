import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planNextDiagnosticQuestion } from "../../strategy-agent/question-planner.mjs";
import { planNextEnrichmentQuestion } from "../../strategy-agent/enrichment-planner.mjs";
import { resolveQuestionAnswerDisposition } from "../../strategy-agent/consultative-engine.mjs";
import { conservativeCoverageFromAnswer } from "../../strategy-agent/profile-coverage-registry.mjs";
import { resolveDiagnosticState } from "../../strategy-agent/diagnostic-state-resolver.mjs";
import { buildStrategyReadinessSnapshot } from "../../strategy-agent/strategy-readiness.mjs";
import { buildStrategySessionState } from "../../strategy-agent/strategy-session-state.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/strategy-dialogue-replay-logistics-cold-start.json", import.meta.url), "utf8"));
const noMaterialsFixture = JSON.parse(readFileSync(new URL("./fixtures/strategy-dialogue/no-materials.json", import.meta.url), "utf8"));
const acceptedSafetyFixture = JSON.parse(readFileSync(new URL("./fixtures/strategy-dialogue/accepted-safety-advice.json", import.meta.url), "utf8"));
const claims = [
  ["business.primaryOffers", ["跨境物流服务"]],
  ["business.businessModel", "项目制物流服务"],
  ["audiences.primary", [{ name: "出海商家" }, { name: "国际物流同行" }]],
  ["business.conversionPath", { entryCTA: "私信咨询", contactChannel: "企业微信", nextBusinessStep: "销售完成需求沟通后安排方案会议" }],
  ["accountStrategy.primaryGoal", "小红书冷启动并获得业务咨询"],
  ["accountStrategy.platformRoles", { xiaohongshu: "获客与认知", wechat: "深度承接" }]
].map(([fieldPath, value], index) => ({ id: `claim_${index}`, fieldPath, value, status: "confirmed" }));
const fieldStates = claims.map((claim) => ({ fieldPath: claim.fieldPath, state: "confirmed" }));
fieldStates.push({ fieldPath: "accountStrategy.constraints", state: "temporarily_unknown" });
fieldStates.push({ fieldPath: "accountStrategy.contentResources", state: "skipped" });
const previousQuestions = [
  { content: "先从哪个平台开始？", targetFieldPaths: ["accountStrategy.platformRoles"], targetSlotIds: ["xiaohongshuRole"], attempt: 1 },
  { content: "优先服务哪类受众？", targetFieldPaths: ["audiences.primary"], targetSlotIds: ["segments"], attempt: 1 },
  { content: "有哪些内容资源？", targetFieldPaths: ["accountStrategy.contentResources"], targetSlotIds: ["resourceTypes"], attempt: 1 }
];

const state = resolveDiagnosticState(claims, fieldStates, []);
assert.equal(state.canGenerateMinimumDraft, true);
assert.deepEqual(state.minimumAssumptionFields, ["accountStrategy.constraints"]);
const next = planNextDiagnosticQuestion({ claims, fieldStates, coverageStates: [], previousQuestions, targetAssessment: { followUpNeeded: true, targetType: "core_field", targetId: "accountStrategy.contentResources", missingRequiredSlots: ["resourceTypes"] } });
assert.equal(next.questionMode, "minimum_ready");
assert.deepEqual(next.targetFieldPaths, []);
assert.ok(!/哪个平台|哪类受众|内容资源/.test(next.content));
const readiness = buildStrategyReadinessSnapshot({ claims, fieldStates });
readiness.strategyDecision = { ready: false };
const sessionState = buildStrategySessionState({ session: { id: "diag_replay", accountId: "company_replay" }, readiness, questions: previousQuestions.map((item, index) => ({ ...item, id: `q_${index}`, status: "answered" })) });
assert.equal(sessionState.phase, "strategy_decision_required");
assert.equal(sessionState.questionLedger.invariantValid, true);
const confirmedDecisionState = buildStrategySessionState({
  session: { id: "diag_replay_confirmed", accountId: "company_replay" },
  readiness,
  questions: [],
  strategyDecision: { status: "confirmed", ready: true, revision: 2 }
});
assert.equal(confirmedDecisionState.phase, "strategy_decision_confirmed", "显式确认的账号决策不得被 readiness 的默认占位状态遮蔽");
assert.equal(confirmedDecisionState.nextAction.type, "generate_strategy_draft");

const noMaterialsQuestion = {
  targetFieldPaths:["accountStrategy.contentResources"],
  targetSlotIds:["resourceTypes"],
  relevance:{targetSlotIds:["resourceTypes"],contextRevision:"resource_v1"}
};
const noMaterialsDisposition = resolveQuestionAnswerDisposition(noMaterialsFixture.userAnswer,{pendingQuestion:noMaterialsQuestion,intent:"direct_answer"});
assert.equal(noMaterialsDisposition.kind,noMaterialsFixture.expectedDisposition);
assert.equal(noMaterialsDisposition.closeWholeTarget,true);
assert.equal(noMaterialsDisposition.claimValue.none,true);
assert.equal(resolveQuestionAnswerDisposition("暂无",{pendingQuestion:noMaterialsQuestion,intent:"direct_answer"}).kind,"none_declared");

const noMaterialClaims = [
  {fieldPath:"accountStrategy.contentResources",value:noMaterialsDisposition.claimValue,status:"confirmed"},
  {fieldPath:"accountStrategy.constraints",value:["所有发布内容使用真实信息"],status:"confirmed"}
];
const nextEnrichment = planNextEnrichmentQuestion({claims:noMaterialClaims,facts:[],coverageStates:[],previousQuestions:[]});
assert.ok(nextEnrichment);
assert.ok(!noMaterialsFixture.forbiddenNextCategories.includes(nextEnrichment.category),"没有资料后不得追问案例、数据或资料公开范围");

const safetyCoverage = conservativeCoverageFromAnswer(
  "core_field",
  "accountStrategy.constraints",
  acceptedSafetyFixture.recommendation,
  acceptedSafetyFixture.recommendation.join("；")
);
for (const slotId of acceptedSafetyFixture.expectedCapturedSlots) {
  assert.ok(safetyCoverage.capturedSlots.some((item)=>item.slot===slotId),`采纳建议后应关闭 ${slotId}`);
}
const opinionWithoutSourceCoverage = conservativeCoverageFromAnswer(
  "core_field",
  "accountStrategy.constraints",
  "只使用可验证来源；没有来源就标为观点",
  ""
);
assert.ok(opinionWithoutSourceCoverage.capturedSlots.some((item)=>item.slot==="dataSourceRules"),"采纳“没有来源就标为观点”后必须关闭数据引用规则");
const repeatedSafetyQuestion = planNextDiagnosticQuestion({
  claims:[],
  fieldStates:[],
  coverageStates:[{...safetyCoverage,updatedAt:"safety_v1"}],
  previousQuestions:[{
    content:"数据引用要遵守什么规则？",
    targetFieldPaths:["accountStrategy.constraints"],
    targetSlotIds:["dataSourceRules"],
    relevance:{targetSlotIds:["dataSourceRules"],contextRevision:"safety_v1"},
    attempt:1
  }],
  targetAssessment:{...safetyCoverage,targetType:"core_field",targetId:"accountStrategy.constraints"}
});
assert.notDeepEqual(repeatedSafetyQuestion?.targetSlotIds,["dataSourceRules"],"同一上下文已处理的问题槽位不得换一种说法再次询问");
const complianceFollowUp = planNextEnrichmentQuestion({
  claims:[
    {fieldPath:"accountStrategy.contentResources",value:{cases:["脱敏案例"]},status:"confirmed"},
    {fieldPath:"accountStrategy.constraints",value:acceptedSafetyFixture.recommendation,status:"confirmed"}
  ],
  facts:[],
  coverageStates:[{...safetyCoverage,targetType:"core_field",targetId:"accountStrategy.constraints",updatedAt:"safety_v1"}],
  previousQuestions:[],
  preferredCategory:"compliance_risk"
});
assert.ok(!complianceFollowUp || !complianceFollowUp.relevance.targetSlotIds.some((slotId)=>["clientIdentity","projectDetails","internalProcess","productInfo","employeeInfo","absoluteClaims"].includes(slotId)),"核心诊断已经处理的内容安全问题不得在动态补充中换措辞重问");

const slotNegative = resolveQuestionAnswerDisposition("没有这项",{
  pendingQuestion:{targetFieldPaths:["accountStrategy.constraints"],targetSlotIds:["mandatoryReviewRules"]},
  intent:"direct_answer"
});
assert.equal(slotNegative.kind,"explicit_negative");
assert.equal(slotNegative.closeWholeTarget,false);
assert.deepEqual(slotNegative.skippedSlotIds,["mandatoryReviewRules"]);
const plainLanguageNegative = resolveQuestionAnswerDisposition("目前没有额外规定",{
  pendingQuestion:{targetFieldPaths:["accountStrategy.constraints"],targetSlotIds:["confidentialInformation"]},
  intent:"direct_answer"
});
assert.equal(plainLanguageNegative.kind,"explicit_negative");
assert.deepEqual(plainLanguageNegative.skippedSlotIds,["confidentialInformation"]);

const resourceClaims=[
  ...claims.slice(0,5),
  {fieldPath:"accountStrategy.contentResources",value:{summary:"客户案例和产品资料"},status:"confirmed"}
];
const resourceStates=resourceClaims.map((item)=>({fieldPath:item.fieldPath,state:"confirmed"}));
const resourceCoverage={targetType:"core_field",targetId:"accountStrategy.contentResources",capturedSlots:[{slot:"resourceTypes",value:"客户案例"}],skippedSlots:[],missingRequiredSlots:["publicUsage"],missingOptionalSlots:[],status:"partial",strategyReady:false,contentReady:false,assessment:{source:"answer"},updatedAt:"2026-07-30T10:00:00.000Z"};
const priorPublicUsageQuestion={content:"哪些资料可以公开？",targetFieldPaths:["accountStrategy.contentResources"],targetSlotIds:["publicUsage"],relevance:{targetSlotIds:["publicUsage"],contextRevision:"2026-07-30T09:00:00.000Z"},attempt:1,status:"answered"};
const afterTimestampOnly=planNextDiagnosticQuestion({claims:resourceClaims,fieldStates:resourceStates,coverageStates:[{...resourceCoverage,updatedAt:"2026-07-30T11:00:00.000Z"}],previousQuestions:[priorPublicUsageQuestion]});
assert.notDeepEqual(afterTimestampOnly?.targetSlotIds,["publicUsage"],"coverage更新时间变化不得重开publicUsage");
const afterNewResource=planNextDiagnosticQuestion({claims:resourceClaims,fieldStates:resourceStates,coverageStates:[{...resourceCoverage,assessment:{source:"document_confirmed",fileId:"file_new"},updatedAt:"2026-07-30T12:00:00.000Z"}],previousQuestions:[priorPublicUsageQuestion]});
assert.deepEqual(afterNewResource?.targetSlotIds,["publicUsage"],"用户确认新资料后应以新语义版本允许重开公开范围");
const publicUsageSkipped={...resourceCoverage,skippedSlots:["publicUsage"],missingRequiredSlots:[],status:"confirmed",strategyReady:true,updatedAt:"2026-07-30T13:00:00.000Z"};
const afterPublicUsageSkip=planNextDiagnosticQuestion({claims:resourceClaims,fieldStates:resourceStates,coverageStates:[publicUsageSkipped],previousQuestions:[priorPublicUsageQuestion]});
assert.notDeepEqual(afterPublicUsageSkip?.targetSlotIds,["publicUsage"],"publicUsage跳过后不得重复询问");

const caseCoverage={targetType:"dynamic_fact",targetId:"case_evidence",capturedSlots:[],skippedSlots:[],missingRequiredSlots:["background","problem"],missingOptionalSlots:[],status:"partial",strategyReady:false,contentReady:false,assessment:{source:"answer"},updatedAt:"2026-07-30T11:00:00.000Z"};
const priorCaseQuestion={content:"案例背景是什么？",category:"case_evidence",targetFactKey:"profile.case_evidence",relevance:{targetSlotIds:["background"],contextRevision:"2026-07-30T10:00:00.000Z"},attempt:1,status:"answered"};
const afterEnrichmentTimestampOnly=planNextEnrichmentQuestion({claims:[{fieldPath:"accountStrategy.contentResources",value:{cases:["脱敏案例"]},status:"confirmed",updatedAt:"2026-07-30T12:00:00.000Z"}],facts:[],coverageStates:[caseCoverage],previousQuestions:[priorCaseQuestion],preferredCategory:"case_evidence"});
assert.ok(!afterEnrichmentTimestampOnly || !afterEnrichmentTimestampOnly.relevance.targetSlotIds.includes("background"),"动态画像 coverage/claim 时间戳变化不得重开相同槽位");

const editingReadiness={...readiness,canGenerateMinimumDraft:false,canGenerateDraft:false,canActivate:false,core:{processed:2,total:9},blockingItems:[{code:"MINIMUM_FIELD_UNPROCESSED"}],strategyDecision:{ready:false}};
const dualTrack=buildStrategySessionState({session:{id:"diag_new",accountId:"company_replay"},sessionMeta:{conversationPhase:"core_diagnosis"},readiness:editingReadiness,questions:[],activeStrategy:{id:"strategy_active_old",version:3,sourceSessionId:"diag_old"}});
assert.equal(dualTrack.activeStrategyTrack.exists,true);
assert.equal(dualTrack.editingSessionTrack.phase,"core_diagnosis");
assert.equal(dualTrack.nextAction.type,"continue_strategy_diagnosis","旧活动策略不得把新诊断伪装成已完成");

console.log(JSON.stringify({ status: "strategy-dialogue-replay-self-test passed", caseId: fixture.caseId, invariants: [...fixture.expectedInvariants,"no_materials_closes_resource_branch","accepted_advice_closes_covered_slots","explicit_negative_closes_current_slot","coverage_timestamp_does_not_reopen_slot","enrichment_timestamp_does_not_reopen_slot","new_resource_changes_semantic_revision","confirmed_strategy_decision_wins","active_and_editing_tracks_are_separate"], minimumAssumptionFields: state.minimumAssumptionFields, sessionPhase: sessionState.phase }, null, 2));
