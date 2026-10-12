import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2, repairGeneratedStrategyDocument, validateGeneratedStrategyDocument, validateStrategyDocumentSemantics } from "../../strategy-agent/strategy-document.mjs";
import { projectStrategyForContent } from "../../content-agent/strategy-adapter.mjs";
import { validateContentStrategyProfileV1 } from "../../contracts/strategy-content-contracts.mjs";

const claims = [
  { id: "c1", fieldPath: "business.primaryOffers", value: ["企业知识库打造", "AI员工打造"], status: "confirmed", confidence: 1 },
  { id: "c2", fieldPath: "business.businessModel", value: "企业服务", status: "confirmed", confidence: 1 },
  { id: "c3", fieldPath: "audiences.primary", value: [{ name: "外贸工厂负责人", decisionMakers: ["老板"] }], status: "confirmed", confidence: 1 },
  { id: "c4", fieldPath: "business.conversionPath", value: { steps: ["内容", "咨询", "诊断", "方案"] }, status: "confirmed", confidence: 1 },
  { id: "c5", fieldPath: "accountStrategy.primaryGoal", value: "建立专业认知并获得企业咨询", status: "confirmed", confidence: 1 },
  { id: "c6", fieldPath: "accountStrategy.growthStage", value: "account_setup", status: "confirmed", confidence: 1 },
  { id: "c7", fieldPath: "accountStrategy.platformRoles", value: { xiaohongshu: "场景触达", wechat: "深度信任" }, status: "confirmed", confidence: 1 },
  { id: "c8", fieldPath: "accountStrategy.contentResources", value: { knowledgeAssetIds: [] }, status: "confirmed", confidence: 1 },
  { id: "c9", fieldPath: "accountStrategy.constraints", value: ["不虚构案例和数据"], status: "confirmed", confidence: 1 }
];
const bundle = assembleStrategyInputBundle({ account: { id: "account_v2", name: "测试公司" }, claims, facts: [{ id: "f1", factKey: "audience.pain_points", value: ["不知道从哪个岗位开始"], status: "user_asserted" }], claimRevision: 9, factRevision: 1 });
const document = createStrategyDocumentV2({ accountId: "account_v2", claims, strategyInputBundle: bundle, suggestion: {} });
assert.equal(validateGeneratedStrategyDocument(document).valid, true);
const fallbackSemantics=validateStrategyDocumentSemantics({document,claims,strategyInputBundle:bundle,providerMode:"validated_fallback"});
assert.equal(fallbackSemantics.passed,true,"来源正确的 fallback 仍需通过语义门禁");
assert.equal(fallbackSemantics.sourceMode,"validated_fallback");
assert.equal(fallbackSemantics.riskLevel,"medium");
const profile = projectStrategyForContent({ id: "snapshot_v2", accountId: "account_v2", payload: document }, []);
assert.equal(validateContentStrategyProfileV1(profile).valid, true);
assert.equal(profile.contentPillars.length, 2);
assert.equal(Object.values(profile.contentFunctionPortfolio).reduce((sum, value) => sum + value, 0), 100);
const malformed = structuredClone(document);
malformed.business.valueProposition = "保留这条有效的模型价值主张";
malformed.strategy.contentSystem.portfolio.action += 1;
const repaired = repairGeneratedStrategyDocument({ candidate: malformed, fallback: document });
assert.equal(repaired.mode,"field_repairs");
assert.equal(repaired.document.business.valueProposition,"保留这条有效的模型价值主张","field repair must preserve valid model fields");
assert.deepEqual(repaired.document.strategy.contentSystem.portfolio,document.strategy.contentSystem.portfolio);
assert(repaired.repairTrace.some((item)=>item.path==="strategy.contentSystem"),"field repair must record its trace");
const recoveryDocument=createStrategyDocumentV2({
  accountId:"account_recovery",
  claims:[
    ...claims.filter((item)=>item.fieldPath!=="business.primaryOffers"),
    {id:"offer_nested",fieldPath:"business.primaryOffers",value:{services:["知识库咨询"]},status:"confirmed",confidence:1}
  ],
  strategyInputBundle:{
    ...bundle,
    dynamicFacts:{strategy:[{id:"pillar_fact",factKey:"content.pillars",factType:"content_direction",predicate:"has_content_pillars",value:{contentPillars:["客户成功方法论"]},status:"user_asserted"}]},
    strategyDecisions:{accountStrategies:[{socialAccountId:"xhs_recovery",focusOffers:["AI 员工实施"],contentPillars:["AI 落地案例"]}]}
  },
  suggestion:{schemaVersion:"2.0",business:{offers:[]},strategy:{contentSystem:{pillars:[]}}}
});
assert(recoveryDocument.business.offers.some((item)=>item.name==="知识库咨询"),"nested claims must recover at least one offer");
assert(recoveryDocument.business.offers.some((item)=>item.name==="AI 员工实施"),"confirmed account decisions may contribute an explicit offer focus");
assert(recoveryDocument.strategy.contentSystem.pillars.some((item)=>item.name==="客户成功方法论"),"facts and account decisions must recover content pillars");
assert(recoveryDocument.strategy.contentSystem.pillars.some((item)=>item.name==="AI 落地案例"),"account decision pillars must survive deterministic recovery");
const invalidFallback=structuredClone(document);
invalidFallback.business.offers=[];
invalidFallback.strategy.contentSystem.pillars=[];
const unrecoverable=repairGeneratedStrategyDocument({candidate:invalidFallback,fallback:invalidFallback});
assert.equal(unrecoverable.validation.valid,false,"a full fallback must be revalidated and remain blocked when the complete contract is invalid");
const semanticFailure=structuredClone(document);
semanticFailure.business.offers[0].name="主要产品";
semanticFailure.strategy.platformPlaybooks.xiaohongshu.role="添加销售微信";
semanticFailure.strategy.riskPolicy.forbiddenClaims=["我们是一家面向外贸工厂提供企业知识库和AI员工服务的公司，核心业务覆盖咨询、实施、培训和长期运营服务，主要客户是成长期企业，商业模式是项目制交付。"];
const rejectedSemantics=validateStrategyDocumentSemantics({document:semanticFailure,claims,strategyInputBundle:bundle,providerMode:"validated_fallback"});
assert.equal(rejectedSemantics.passed,false);
assert.equal(rejectedSemantics.activationAllowed,false);
assert.equal(rejectedSemantics.handoffAllowed,false);
assert(rejectedSemantics.errors.some((item)=>item.code==="OFFER_NAME_NOT_SEMANTIC"),"“主要产品”不得成为伪 offer");
assert(rejectedSemantics.errors.some((item)=>item.code==="PLATFORM_ROLE_IS_CONVERSION_CHANNEL"),"咨询入口不得成为平台角色");
assert(rejectedSemantics.errors.some((item)=>item.code==="RISK_POLICY_CONTAINS_BUSINESS_INTRO"),"公司介绍不得进入禁止声明");
const appSource=readFrontendSourceSync();
const htmlSource=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
assert.match(htmlSource,/agentDraftQualityGate/,"草案卡必须就地提供来源与语义风险区域");
assert.match(appSource,/semanticGate\?\.sourceMode/,"前端必须读取服务端语义门禁来源");
assert.match(appSource,/禁止激活和交接内容 Agent/,"前端必须解释语义门禁失败的下游影响");

console.log(JSON.stringify({ status: "strategy-document-self-test passed", offers: document.business.offers.length, audiences: document.strategy.audiences.length, pillars: document.strategy.contentSystem.pillars.length, primaryObjectiveId: document.strategy.primaryObjectiveId }, null, 2));

