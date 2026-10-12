import assert from "node:assert/strict";
import { database } from "../../storage.mjs";
import { startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { getDiagnosticSessionMeta } from "../../strategy-agent/strategy-store.mjs";
import { recommendStrategyDecisions } from "../../strategy-agent/growth-playbook-library.mjs";
import { normalizeStrategyDecisionSelection, validateStrategyDecisionSelection } from "../../strategy-agent/strategy-decision-contract.mjs";
import { getStrategyDecisionRecord, saveStrategyDecisionRecord, strategyDecisionReadiness } from "../../strategy-agent/strategy-decision-store.mjs";
import { normalizeSocialAccountIdentity } from "../../workspace-context.mjs";

const accountId=`decision_flow_${Date.now()}`;
const session=startDiagnostic({accountId,restartMode:"fresh"}).session;
try{
  const nullIdentity=normalizeSocialAccountIdentity({id:"null_identity",companyId:accountId,accountIdentity:null});
  assert.equal(nullIdentity.subjectType,"");
  assert.equal(nullIdentity.speakerType,"");
  assert.deepEqual(nullIdentity.trustSources,[]);
  const legacyIdentity=normalizeSocialAccountIdentity({id:"legacy_identity",companyId:accountId,subjectType:"company_official",speakerType:"brand_official",trustSources:["professional_knowledge"]});
  assert.equal(legacyIdentity.subjectType,"company_official");
  assert.equal(legacyIdentity.speakerType,"brand_official");
  const fullIdentity=normalizeSocialAccountIdentity({id:"full_identity",companyId:accountId,accountIdentity:{subjectType:"employee_expert",speakerType:"expert_advisor",trustSources:["industry_data"]}});
  assert.deepEqual(fullIdentity.trustSources,["industry_data"]);
  const socialAccounts=[
    {id:`${accountId}_xhs`,companyId:accountId,name:"测试公司 · 小红书",platform:"xiaohongshu",status:"active",strategySettings:{subjectType:"company_official"},accountIdentity:{subjectType:"company_official",speakerType:"brand_official",trustSources:["professional_knowledge","real_cases"]}},
    {id:`${accountId}_wx`,companyId:accountId,name:"测试公司 · 公众号",platform:"wechat",status:"active",strategySettings:{subjectType:"employee_expert"},accountIdentity:{subjectType:"employee_expert",speakerType:"expert_advisor",trustSources:["professional_knowledge","industry_data"]}}
  ];
  const claims=[{fieldPath:"accountStrategy.primaryGoal",value:"起号阶段建立专业信任并获得咨询",status:"confirmed"},{fieldPath:"accountStrategy.growthStage",value:"account_setup",status:"confirmed"},{fieldPath:"accountStrategy.platformRoles",value:{xiaohongshu:"场景触达",wechat:"深度信任"},status:"confirmed"}];
  const preview=recommendStrategyDecisions({claims,facts:[{value:"希望采用热点桥接和垂直干货混合启动"}],socialAccounts});
  assert.equal(preview.accountStrategies.length,2);
  assert.ok(preview.accountStrategies[0].candidatePlaybooks[0].scoreBreakdown);
  const selection=normalizeStrategyDecisionSelection({...preview,portfolioDecision:{...preview.portfolioDecision,mode:"role_matrix",selectedSocialAccountIds:socialAccounts.map((item)=>item.id),accountRoles:{[socialAccounts[0].id]:"primary",[socialAccounts[1].id]:"trust"}}},preview,socialAccounts);
  assert.deepEqual(selection.portfolioDecision.selectedSocialAccountIds,socialAccounts.map((item)=>item.id));
  assert.equal(selection.accountStrategies[0].accountIdentity.speakerType,"brand_official");
  assert.equal(validateStrategyDecisionSelection(selection).valid,true);
  const oneAccountMatrix=structuredClone(selection);
  oneAccountMatrix.portfolioDecision.mode="role_matrix";
  oneAccountMatrix.portfolioDecision.selectedSocialAccountIds=[socialAccounts[0].id];
  oneAccountMatrix.portfolioDecision.selectedAccountIds=[socialAccounts[0].id];
  oneAccountMatrix.portfolioDecision.rationaleSelection={mode:"role_matrix",selectedSocialAccountIds:[socialAccounts[0].id],accountRoles:{[socialAccounts[0].id]:"primary"}};
  assert.equal(validateStrategyDecisionSelection(oneAccountMatrix).valid,false,"role_matrix must contain at least two active accounts");
  const duplicateRoles=structuredClone(selection);
  duplicateRoles.portfolioDecision.accountRoles=Object.fromEntries(socialAccounts.map((item)=>[item.id,"primary"]));
  duplicateRoles.portfolioDecision.rationaleSelection={mode:"role_matrix",selectedSocialAccountIds:socialAccounts.map((item)=>item.id),accountRoles:{...duplicateRoles.portfolioDecision.accountRoles}};
  assert.equal(validateStrategyDecisionSelection(duplicateRoles).valid,false,"role_matrix accounts must have distinct roles");
  const mismatchedRationale=structuredClone(selection);
  mismatchedRationale.portfolioDecision.rationaleSelection.selectedSocialAccountIds=[socialAccounts[0].id];
  assert.equal(validateStrategyDecisionSelection(mismatchedRationale).valid,false,"selection rationale must describe the actual matrix");
  const meta=getDiagnosticSessionMeta(session.id);
  let record=saveStrategyDecisionRecord({sessionId:session.id,accountId,preview,selection,status:"preview",claimRevision:meta.claimRevision,factRevision:meta.factRevision});
  assert.equal(strategyDecisionReadiness(record,meta).ready,false);
  record=saveStrategyDecisionRecord({sessionId:session.id,accountId,preview,selection,status:"confirmed",claimRevision:meta.claimRevision,factRevision:meta.factRevision});
  assert.equal(getStrategyDecisionRecord(session.id).status,"confirmed");
  assert.equal(strategyDecisionReadiness(record,meta).ready,true);
  assert.ok(record.decisionHash);
  assert.equal(strategyDecisionReadiness(record,{...meta,factRevision:meta.factRevision+1}).ready,false,"a new fact revision must invalidate the confirmed decision");
  assert(strategyDecisionReadiness(record,{...meta,factRevision:meta.factRevision+1}).blockers.some((item)=>item.code==="STRATEGY_DECISION_STALE"));
  const nullAccounts=socialAccounts.map((item)=>({...item,accountIdentity:null,subjectType:null,speakerType:null,trustSources:null,configuration:{selectionEligible:true,baseComplete:true,identityComplete:false}}));
  const nullPreview=recommendStrategyDecisions({claims,facts:[],socialAccounts:nullAccounts});
  const userCompletedStrategies=nullPreview.accountStrategies.map((item,index)=>({...item,accountIdentity:{subjectType:index?"employee_expert":"company_official",speakerType:index?"expert_advisor":"brand_official",speakerDetail:"",trustSources:index?["industry_data"]:["professional_knowledge"]}}));
  const nullSelection=normalizeStrategyDecisionSelection({...nullPreview,schemaVersion:"1.1",accountStrategies:userCompletedStrategies,portfolioDecision:{...nullPreview.portfolioDecision,mode:"role_matrix",selectedSocialAccountIds:nullAccounts.map((item)=>item.id),accountRoles:Object.fromEntries(nullAccounts.map((item,index)=>[item.id,index?"trust":"primary"]))}},nullPreview,nullAccounts);
  const nullValidation=validateStrategyDecisionSelection(nullSelection,nullAccounts);
  assert.equal(nullValidation.valid,true,`显式 null 身份在用户选择完整身份后必须可确认：${JSON.stringify(nullValidation.errors)}`);
  const singleSelection=normalizeStrategyDecisionSelection({...nullSelection,portfolioDecision:{...nullSelection.portfolioDecision,mode:"single_account",selectedSocialAccountIds:[nullAccounts[0].id],primarySocialAccountId:nullAccounts[0].id,rationaleSelection:{mode:"single_account",selectedSocialAccountIds:[nullAccounts[0].id],accountRoles:{[nullAccounts[0].id]:"primary"}}}},nullPreview,nullAccounts);
  assert.equal(validateStrategyDecisionSelection(singleSelection,nullAccounts).valid,true,"单账号空身份兼容回放必须通过");
  console.log(JSON.stringify({status:"strategy-decision-flow-self-test passed",accounts:selection.accountStrategies.length,portfolioMode:selection.portfolioDecision.mode,decisionRevision:record.revision},null,2));
}finally{
  database.prepare("DELETE FROM diagnostic_sessions WHERE id = ?").run(session.id);
}
