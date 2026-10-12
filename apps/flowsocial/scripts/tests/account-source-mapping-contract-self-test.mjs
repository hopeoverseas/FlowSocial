import assert from "node:assert/strict";
import { adaptAccountPortfolioV1 } from "../../contracts/strategy-content-contracts.mjs";
import { adaptLegacyStrategyDecisionSelection, normalizeStrategyDecisionSelection, validateStrategyDecisionSelection } from "../../strategy-agent/strategy-decision-contract.mjs";
import { ensureWorkspaceContext, projectSocialAccount, socialAccountIdentityId } from "../../workspace-context.mjs";

const company={id:"company_contract",name:"合同测试公司",accountType:"company",status:"active"};
const legacy={id:"acc_xhs",name:"历史小红书账号",platform:"xiaohongshu",status:"active"};
const store={accounts:[company,legacy]};
ensureWorkspaceContext(store);
assert.equal(store.accounts.filter((item)=>item.accountType==="social").length,1,"migration must not silently create platform accounts");
assert.equal(legacy.companyId,company.id);
assert.equal(legacy.accountIdentityId,socialAccountIdentityId("acc_xhs"));
assert.equal(legacy.configurationStatus,"setup_required");

const configured=projectSocialAccount({
  ...legacy,
  operatorName:"合同测试公司品牌部",
  accountIdentity:{id:legacy.accountIdentityId,companyId:company.id,socialAccountId:legacy.id,subjectType:"company_official",publicIdentity:"企业官方号",speakerType:"brand_official",speakerDetail:"品牌内容团队",trustSources:["professional_knowledge","real_cases"],version:3}
},company);
assert.equal(configured.configuration.planningEligible,true);
assert.equal(configured.accountIdentity.companyId,company.id);
assert.equal(configured.accountIdentity.socialAccountId,legacy.id);

const preview={
  schemaVersion:"1.0",
  portfolioDecision:{mode:"single_account",selectedAccountIds:[legacy.id],accounts:[{socialAccountId:legacy.id,name:legacy.name,platform:legacy.platform}]},
  accountStrategies:[{socialAccountId:legacy.id,platform:legacy.platform,accountIdentity:{},selectedPlaybookId:"playbook_1",growthMode:"steady_vertical",candidatePlaybooks:[{playbookId:"playbook_1",growthMode:"steady_vertical"}],hotspotPolicy:{unrelatedAllowed:false,autoDeleteHistoricalContent:false}}]
};
const selection=normalizeStrategyDecisionSelection(preview,preview,[configured]);
assert.equal(selection.schemaVersion,"1.1");
assert.equal(selection.portfolioDecision.primarySocialAccountId,legacy.id);
assert.deepEqual(selection.portfolioDecision.selectedSocialAccountIds,[legacy.id]);
assert.equal(selection.portfolioDecision.accountRoles[legacy.id],"primary");
assert.equal(selection.accountStrategies[0].accountIdentity.id,legacy.accountIdentityId);
assert.equal(validateStrategyDecisionSelection(selection,[configured]).valid,true);

const legacySelection=adaptLegacyStrategyDecisionSelection({...selection,schemaVersion:"1.0",portfolioDecision:{mode:"single_account",selectedAccountIds:[legacy.id]}});
assert.deepEqual(legacySelection.portfolioDecision.selectedSocialAccountIds,[legacy.id]);
assert.equal(adaptAccountPortfolioV1({mode:"single_account",selectedAccountIds:[legacy.id]},selection.accountStrategies).primarySocialAccountId,legacy.id);

console.log(JSON.stringify({status:"account-source-mapping-contract-self-test passed",companyId:company.id,socialAccountId:legacy.id,accountIdentityId:legacy.accountIdentityId,legacyCompatible:true},null,2));
