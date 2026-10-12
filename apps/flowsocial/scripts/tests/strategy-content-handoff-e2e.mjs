import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

const appRoot=fileURLToPath(new URL("../../",import.meta.url));
const dataDir=mkdtempSync(join(tmpdir(),"flowsocial-handoff-"));
copyFileSync(join(appRoot,"data","store.json"),join(dataDir,"store.json"));
process.env.FLOWSOCIAL_DATA_DIR=dataDir;
process.env.FLOWSOCIAL_TEST_MODE="1";
process.env.PORT="0";

const { database,readStore,writeStore }=await import("../../storage.mjs");
const { applyProfileFactOperation,createDiagnosticSession,getDiagnosticSessionMeta,getFactSnapshot,saveStrategyDraftRevision,upsertDiagnosticCoverageState,upsertProfileClaim,updateDiagnosticSessionMeta }=await import("../../strategy-agent/strategy-store.mjs");
const { coreFieldSpecs }=await import("../../strategy-agent/profile-coverage-registry.mjs");
const { recommendStrategyDecisions }=await import("../../strategy-agent/growth-playbook-library.mjs");
const { normalizeStrategyDecisionSelection }=await import("../../strategy-agent/strategy-decision-contract.mjs");
const { saveStrategyDecisionRecord }=await import("../../strategy-agent/strategy-decision-store.mjs");
const { resolveContentAccountContext }=await import("../../workspace-context.mjs");

const suffix=Date.now();
const companyId=`handoff_company_${suffix}`;
const socialAccountId=`handoff_xhs_${suffix}`;
const accountIdentity={
  id:`identity_${socialAccountId}`,
  companyId,
  socialAccountId,
  subjectType:"company_official",
  publicIdentity:"策略交接测试公司官方账号",
  speakerType:"brand_official",
  trustSources:["professional_knowledge","product_capability"],
  version:1
};
const store=readStore();
store.accounts=[];
store.accounts.push(
  {id:companyId,workspaceId:"workspace_default",companyId,accountType:"company",name:"策略交接测试公司",platform:"多平台",status:"active",contentPillars:[]},
  {id:socialAccountId,socialAccountId,workspaceId:"workspace_default",companyId,accountType:"social",name:"策略交接测试公司 · 小红书",platform:"xiaohongshu",status:"active",accountIdentityId:accountIdentity.id,accountIdentity,contentPillars:[]}
);
writeStore(store);

const session=createDiagnosticSession({accountId:companyId,mode:"quick"});
const values={
  "business.primaryOffers":["企业内容运营顾问"],
  "business.businessModel":"项目制服务",
  "audiences.primary":{summary:"成长型企业负责人"},
  "business.conversionPath":{entryCTA:"领取诊断清单",contactChannel:"企业微信",diagnosticStep:"需求诊断",nextBusinessStep:"方案沟通"},
  "accountStrategy.primaryGoal":{summary:"建立专业信任并获得咨询"},
  "accountStrategy.growthStage":"account_setup",
  "accountStrategy.platformRoles":{xiaohongshu:"场景触达"},
  "accountStrategy.contentResources":{summary:"产品资料与运营SOP",publicUsage:"anonymized"},
  "accountStrategy.constraints":["不虚构案例和数据"]
};
for(const [fieldPath,value] of Object.entries(values)){
  upsertProfileClaim({sessionId:session.id,fieldPath,value,sourceType:"test",sourceRef:`handoff_${fieldPath}`,confidence:1,status:"confirmed"});
  const spec=coreFieldSpecs[fieldPath];
  upsertDiagnosticCoverageState({sessionId:session.id,targetType:"core_field",targetId:fieldPath,capturedSlots:spec.slots.filter((item)=>item.required).map((item)=>({slot:item.id,value:"已确认",confidence:1,source:"test"})),missingRequiredSlots:[],missingOptionalSlots:[],status:"confirmed",strategyReady:true,contentReady:true,attempts:1,assessment:{source:"isolated_e2e"}});
}
for(const fact of [
  {factKey:"evidence.public",value:"公开产品资料",visibility:"public",contentUsage:"allowed"},
  {factKey:"evidence.anonymized",value:{summary:"脱敏客户案例",anonymizationRules:["移除客户名称"]},visibility:"anonymized",contentUsage:"allowed_with_anonymization"},
  {factKey:"evidence.private",value:"内部成本数据",visibility:"private",contentUsage:"forbidden"},
  {factKey:"evidence.unknown",value:"待确认授权资料",visibility:"unknown",contentUsage:"needs_review"}
]) applyProfileFactOperation({accountId:companyId,sessionId:session.id,factType:"content_resource",predicate:"has_evidence",status:"user_asserted",confidence:1,sourceType:"user_confirmed",...fact});
const socialAccounts=[{id:socialAccountId,socialAccountId,companyId,name:"策略交接测试公司 · 小红书",platform:"xiaohongshu",status:"active",accountIdentityId:accountIdentity.id,accountIdentity,strategySettings:{subjectType:"company_official"}}];
const claims=Object.entries(values).map(([fieldPath,value])=>({fieldPath,value,status:"confirmed"}));
const preview=recommendStrategyDecisions({claims,facts:[],socialAccounts});
const selection=normalizeStrategyDecisionSelection({...preview,portfolioDecision:{...preview.portfolioDecision,mode:"single_account",selectedAccountIds:[socialAccountId]}},preview,socialAccounts);
const meta=getDiagnosticSessionMeta(session.id);
saveStrategyDecisionRecord({sessionId:session.id,accountId:companyId,preview,selection,status:"confirmed",claimRevision:meta.claimRevision,factRevision:meta.factRevision});
updateDiagnosticSessionMeta(session.id,{conversationPhase:"strategy_decision_confirmed"});

let server;
try{
  ({server}=await import("../../server.mjs"));
  if(!server.listening)await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  const call=async(path,options={})=>{
    const response=await fetch(base+path,{headers:{"content-type":"application/json"},...options});
    const body=await response.json();
    if(!response.ok)throw Object.assign(new Error(body.error||`HTTP ${response.status}`),{status:response.status,body});
    return body;
  };

  const health=await call("/health");
  assert.ok(health.buildId);
  assert.equal(health.processId,process.pid);
  assert.equal(health.restartRequired,false);

  const beforeDraft=await call(`/companies/${companyId}/content-planning-readiness`);
  assert.equal(beforeDraft.ready,false);
  assert.equal(beforeDraft.nextAction.type,"generate_strategy_draft");

  const requestId=`draftreq_handoff_${suffix}`;
  const accepted=await call(`/agent/sessions/${session.id}/strategy-draft`,{method:"POST",body:JSON.stringify({requestId,async:true})});
  assert.equal(accepted.draftRequest.status,"running");
  let drafted;
  for(let attempt=0;attempt<100;attempt+=1){
    const status=await call(`/agent/sessions/${session.id}/strategy-draft/requests/${requestId}`);
    if(status.draftRequest.status==="failed")throw new Error(status.draftRequest.errorMessage);
    if(status.draftRequest.status==="succeeded"){drafted=status;break;}
    await new Promise((resolve)=>setTimeout(resolve,20));
  }
  assert.ok(drafted,"an async draft request must be recoverable by request id");
  assert.ok(drafted.draftRevision?.id);
  assert.equal(drafted.validation?.valid,true,"only a fully valid recovered draft may be reviewed or activated");
  assert.equal(drafted.validation?.semanticGate?.passed,true,"test-mode fallback must pass the semantic gate before activation");
  assert.equal(drafted.validation?.semanticGate?.handoffAllowed,true,"semantic validation must explicitly allow Content Agent handoff");
  assert.equal(drafted.validation?.semanticGate?.sourceMode,"validated_fallback","fallback provenance must remain visible on the recovered request");
  const beforeActivation=await call(`/companies/${companyId}/content-planning-readiness`);
  assert.equal(beforeActivation.ready,false);
  assert.equal(beforeActivation.nextAction.type,"activate_strategy_draft");

  const activated=await call(`/agent/sessions/${session.id}/activate`,{method:"POST",body:JSON.stringify({draftRevisionId:drafted.draftRevision.id})});
  assert.ok(activated.snapshot?.id);
  assert.equal(activated.snapshot.payload?.strategyExtensions?.accountGrowthStrategies?.[0]?.accountIdentity?.subjectType,accountIdentity.subjectType,"活动策略必须保留确认时的账号身份");
  assert.equal(activated.strategySessionState?.nextAction?.type,"open_content_planning");
  assert.equal(activated.contentPlanningReadiness?.ready,true);
  const activatedFactSnapshot=getFactSnapshot(activated.snapshot.payload.governance.factSnapshotId);
  assert.deepEqual(activatedFactSnapshot.usableFacts.map((fact)=>fact.key),["evidence.public","evidence.anonymized"]);
  assert.equal(activatedFactSnapshot.usableFacts[1].contentUsage,"allowed_with_anonymization");
  assert.deepEqual(activatedFactSnapshot.forbiddenFacts.map((fact)=>fact.key),["evidence.private"]);
  assert.deepEqual(activatedFactSnapshot.contextOnlyFacts.map((fact)=>fact.key),["evidence.unknown"]);

  const afterActivation=await call(`/companies/${companyId}/content-planning-readiness`);
  assert.equal(afterActivation.ready,true);
  assert.equal(afterActivation.strategy.snapshotId,activated.snapshot.id);
  const plan=await call("/content-agent/plan",{method:"POST",body:JSON.stringify({accountId:socialAccountId,companyId,socialAccountId,platform:"xiaohongshu",limit:2,inputMode:"active_strategy"})});
  assert.equal(plan.strategySnapshotId,activated.snapshot.id);
  assert.equal(plan.ownership.companyId,companyId);
  assert.equal(plan.ownership.socialAccountId,socialAccountId);
  assert.equal(plan.accountContext.socialAccountId,socialAccountId);
  assert.equal(plan.accountContext.strategySnapshotId,activated.snapshot.id);
  assert.equal(plan.accountContext.selectionSource,"user_confirmed");
  assert.ok(plan.accountContext.accountStrategySnapshotId);
  assert.equal(plan.recommendations[0].generationPayload.accountContext.socialAccountId,socialAccountId);
  const defaultedPlan=await call("/content-agent/plan",{method:"POST",body:JSON.stringify({accountId:companyId,companyId,platform:"xiaohongshu",limit:1,inputMode:"active_strategy"})});
  assert.equal(defaultedPlan.accountContext.socialAccountId,socialAccountId,"公司 ID 只能定位公司，单账号策略应解析出具体社媒账号");
  assert.equal(defaultedPlan.accountContext.selectionSource,"single_account_default");

  const matrixStore=readStore();
  const matrixAccountId=`handoff_wechat_${suffix}`;
  matrixStore.accounts.push({id:matrixAccountId,socialAccountId:matrixAccountId,workspaceId:"workspace_default",companyId,accountType:"social",name:"矩阵公众号",platform:"wechat",status:"active"});
  const matrixSnapshot={accountId:companyId,document:{strategyExtensions:{accountPortfolio:{mode:"role_matrix",selectedSocialAccountIds:[socialAccountId,matrixAccountId]},accountGrowthStrategies:[{socialAccountId},{socialAccountId:matrixAccountId}]}}};
  assert.throws(()=>resolveContentAccountContext(matrixStore,{companyId,accountId:companyId,strategySnapshot:matrixSnapshot}),error=>error.code==="SOCIAL_ACCOUNT_SELECTION_REQUIRED"&&error.details.selectableAccounts.length===2);
  const selectedMatrix=resolveContentAccountContext(matrixStore,{companyId,socialAccountId:matrixAccountId,platform:"wechat",strategySnapshot:matrixSnapshot});
  assert.equal(selectedMatrix.socialAccountId,matrixAccountId);
  assert.equal(selectedMatrix.selectionSource,"user_confirmed");
  const nextDiagnosis=await call("/agent/sessions",{method:"POST",body:JSON.stringify({accountId:companyId,mode:"quick",restartMode:"fresh"})});
  const whileEditing=await call(`/companies/${companyId}/content-planning-readiness`);
  assert.equal(whileEditing.ready,true,"新诊断未完成不得自动阻断可用的旧活动策略");
  assert.equal(whileEditing.strategySessionState.activeStrategyTrack.snapshotId,activated.snapshot.id);
  assert.equal(whileEditing.strategySessionState.editingSessionTrack.phase,"core_diagnosis");
  assert.equal(whileEditing.strategySessionState.nextAction.type,"continue_strategy_diagnosis");
  assert.ok(nextDiagnosis.session.id);

  const immutablePayloadBefore=database.prepare("SELECT payload_json FROM strategy_snapshots WHERE id=?").get(activated.snapshot.id).payload_json;
  const incompleteStore=readStore();
  const incompleteAccount=incompleteStore.accounts.find((item)=>item.id===socialAccountId);
  incompleteAccount.accountIdentity={...incompleteAccount.accountIdentity,subjectType:"",speakerType:"",trustSources:[]};
  incompleteAccount.subjectType="";
  writeStore(incompleteStore);
  const repairNeeded=await call(`/companies/${companyId}/content-planning-readiness`);
  assert.equal(repairNeeded.ready,false);
  assert.equal(repairNeeded.nextAction.type,"update_strategy_account_decisions");
  assert.equal(repairNeeded.accounts[0].compatibilityStatus,"confirmation_required");
  assert.equal(repairNeeded.accounts[0].snapshotIdentity.subjectType,accountIdentity.subjectType);
  const compatibilityPreview=await call(`/agent/sessions/${session.id}/strategy-decisions/preview`,{method:"POST",body:JSON.stringify({compatibilityRepair:true})});
  assert.equal(compatibilityPreview.compatibilityRepair,true);
  assert.equal(compatibilityPreview.record.selection.accountStrategies[0].accountIdentity.subjectType,accountIdentity.subjectType,"活动快照身份只能作为待确认建议返回");
  await call(`/agent/sessions/${session.id}/strategy-decisions/confirm`,{method:"POST",body:JSON.stringify({selection:compatibilityPreview.record.selection})});
  const repaired=await call(`/companies/${companyId}/content-planning-readiness`);
  assert.equal(repaired.ready,true,"用户确认与活动快照一致的身份后应恢复内容交接");
  const immutablePayloadAfter=database.prepare("SELECT payload_json FROM strategy_snapshots WHERE id=?").get(activated.snapshot.id).payload_json;
  assert.equal(immutablePayloadAfter,immutablePayloadBefore,"兼容迁移不得重写历史活动策略快照");
  const repairedStore=readStore();
  const migrationRevision=repairedStore.accountIdentityRevisions.find((item)=>item.socialAccountId===socialAccountId&&item.migrationType==="confirm_active_snapshot_alignment");
  assert.ok(migrationRevision,"兼容迁移必须留下可审计身份版本");
  assert.equal(migrationRevision.previousIdentity.subjectType,"","身份版本必须保留迁移前投影作为回退依据");
  assert.equal(migrationRevision.nextIdentity.subjectType,accountIdentity.subjectType);
  const changedAccount=repairedStore.accounts.find((item)=>item.id===socialAccountId);
  changedAccount.accountIdentity={...changedAccount.accountIdentity,subjectType:"founder_ip",speakerType:"founder",speakerDetail:"创始人"};
  changedAccount.subjectType="founder_ip";
  writeStore(repairedStore);
  const identityChanged=await call(`/companies/${companyId}/content-planning-readiness`);
  assert.equal(identityChanged.ready,false);
  assert.equal(identityChanged.accounts[0].compatibilityStatus,"next_strategy_required","用户改变账号身份后必须生成并激活下一版策略");
  assert.notEqual(identityChanged.nextAction.type,"update_strategy_account_decisions","身份已改变时不得反复回到同一账号补齐步骤");

  console.log(JSON.stringify({status:"strategy-content-handoff-e2e passed",stages:[beforeDraft.nextAction.type,beforeActivation.nextAction.type,afterActivation.nextAction.type,repairNeeded.nextAction.type],strategySnapshotId:activated.snapshot.id,recommendations:plan.recommendations?.length||0,compatibilityRepair:true,historicalSnapshotImmutable:true,isolatedData:true},null,2));
}finally{
  if(server?.listening)await new Promise((resolve)=>server.close(resolve));
  database.close();
  rmSync(dataDir,{recursive:true,force:true});
}
