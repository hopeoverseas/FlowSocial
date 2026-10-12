import assert from "node:assert/strict";
import { startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { applyProfileFactOperation,listSessionProfileFacts } from "../../strategy-agent/strategy-store.mjs";
import { buildStrategyEvidenceRequest,normalizeRetrievedStrategyEvidence } from "../../strategy-agent/strategy-evidence-planner.mjs";
import { planNextEnrichmentQuestion } from "../../strategy-agent/enrichment-planner.mjs";
import { dynamicFactSpecs } from "../../strategy-agent/profile-coverage-registry.mjs";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2,validateGeneratedStrategyDocument } from "../../strategy-agent/strategy-document.mjs";

const accountId=`strategy_vnext_${Date.now()}`;
const oldSession=startDiagnostic({accountId,restartMode:"fresh"}).session;
applyProfileFactOperation({accountId,sessionId:oldSession.id,factKey:"audience.pain_points",predicate:"has_audience_pain_points",value:["旧问题"],operation:"append"});
const freshSession=startDiagnostic({accountId,restartMode:"fresh"}).session;
applyProfileFactOperation({accountId,sessionId:freshSession.id,factKey:"audience.pain_points",predicate:"has_audience_pain_points",value:["新问题"],operation:"append"});
assert.deepEqual(listSessionProfileFacts(accountId,freshSession.id).find((fact)=>fact.factKey==="audience.pain_points")?.value,["新问题"],"fresh session must not merge old company facts");

const claims=[
  {id:"c1",fieldPath:"business.primaryOffers",value:["企业知识库","AI员工"],status:"confirmed",confidence:1},
  {id:"c2",fieldPath:"business.businessModel",value:{chargingModel:"项目制",deliveryModel:"咨询与实施"},status:"confirmed",confidence:1},
  {id:"c3",fieldPath:"audiences.primary",value:{name:"成长型企业",industries:["SaaS"],decisionRoles:["客户成功负责人"],jobsToBeDone:["沉淀企业知识"],painPoints:["知识分散"],buyingTriggers:["业务扩张"]},status:"confirmed",confidence:1},
  {id:"c4",fieldPath:"business.conversionPath",value:{entryCTA:"领取清单",contactChannel:"企业微信",handoffOwner:"销售顾问",informationCollection:"行业与需求",leadQualification:"存在明确项目需求",diagnosticStep:"需求诊断",nextBusinessStep:"方案沟通",cooperationEntry:"签约"},status:"confirmed",confidence:1},
  {id:"c5",fieldPath:"accountStrategy.primaryGoal",value:{summary:"建立专业信任并获得企业咨询"},status:"confirmed",confidence:1},
  {id:"c6",fieldPath:"accountStrategy.growthStage",value:{summary:"account_setup"},status:"confirmed",confidence:1},
  {id:"c7",fieldPath:"accountStrategy.platformRoles",value:{xiaohongshu:"场景触达",wechat:"深度论证"},status:"confirmed",confidence:1},
  {id:"c8",fieldPath:"accountStrategy.contentResources",value:{resourceTypes:["product_material","sop"],publicUsage:"anonymized",knowledgeAssetIds:["file_1"]},status:"confirmed",confidence:1},
  {id:"c9",fieldPath:"accountStrategy.constraints",value:["不虚构案例"],status:"confirmed",confidence:1}
];
const evidenceRequest=buildStrategyEvidenceRequest({claims});
assert.ok(evidenceRequest.queries.length>=3,"strategy evidence request must be targeted");
const retrieved=normalizeRetrievedStrategyEvidence(evidenceRequest,[{queryId:evidenceRequest.queries[0].id,items:[{chunkId:"chunk_1",fileId:"file_1",fileName:"产品资料.pdf",text:"企业知识库适用于知识分散的成长型企业。",score:9}]}]);
assert.equal(retrieved[0].status,"supporting_context");

const readyDynamic=dynamicFactSpecs.filter((spec)=>["account_identity","growth_strategy","audience_insight","brand_expression","platform_operation","operating_capacity","compliance_risk"].includes(spec.id)).map((spec)=>({targetType:"dynamic_fact",targetId:spec.id,status:"sufficient",strategyReady:true,missingRequiredSlots:[]}));
const enrichment=planNextEnrichmentQuestion({claims:[...claims.filter((claim)=>claim.fieldPath!=="accountStrategy.primaryGoal"),{id:"goal",fieldPath:"accountStrategy.primaryGoal",value:{summary:"建立行业专业认知"},status:"confirmed"}],facts:[],coverageStates:readyDynamic,previousQuestions:[]});
assert.notEqual(enrichment?.category,"purchase_decision","non-commercial objective must not force purchase-decision questioning");
assert.ok(["xiaohongshu_infrastructure","wechat_infrastructure","expert_knowledge"].includes(enrichment?.category),"authority objective should prefer active-platform infrastructure or reusable expertise over purchase questions");
assert.ok(enrichment?.relevance?.downstreamUse?.length,"enrichment question must explain downstream value");

const bundle=assembleStrategyInputBundle({account:{id:accountId,name:"测试公司"},claims,facts:[],knowledgeCandidates:[],retrievedKnowledgeEvidence:retrieved,knowledgeEvidenceRequest:evidenceRequest,coverageSnapshot:{core:{items:[]},dynamic:{items:[]}}});
const document=createStrategyDocumentV2({accountId,claims,strategyInputBundle:bundle,suggestion:{schemaVersion:"2.0",business:{valueProposition:"帮助成长型企业沉淀和使用知识"},strategy:{growthStage:"account_setup",operatingMode:"guided",objectives:[{id:"objective_1",type:"authority",label:"建立专业信任并获得企业咨询",priority:1,weight:100}],primaryObjectiveId:"objective_1",contentSystem:{pillars:[{id:"pillar_1",name:"企业知识库方法",strategicPurpose:"建立专业认知",objectiveIds:["objective_1"],audienceIds:[],recommendedContentFunctions:["authority"]}],portfolio:{discovery:20,authority:35,proof:10,solution:25,action:10}},platformPlaybooks:{xiaohongshu:{role:"场景触达",priorityAudienceIds:[],objectivePriorities:["objective_1"],constraints:[]},wechat:{role:"深度论证",priorityAudienceIds:[],objectivePriorities:["objective_1"],constraints:[]}}}}});
assert.equal(validateGeneratedStrategyDocument(document).valid,true,"extended strategy must preserve StrategyDocument@2.0 validity");
assert.equal(document.strategyExtensions.role,"long_term_account_guidance");
assert.equal(document.strategyExtensions.knowledgeEvidencePlan.retrievedEvidence.length,1);
assert.ok(document.strategyExtensions.conversionLadder.stages.length>=4);
assert.equal(document.strategyExtensions.contentFunctionPolicy.functions.authority.target,35);
assert.ok(document.governance.knowledgeSourceIds.includes(retrieved[0].id));

console.log(JSON.stringify({freshFact:listSessionProfileFacts(accountId,freshSession.id)[0]?.value,evidenceQueries:evidenceRequest.queries.length,nextEnrichment:enrichment?.category,extensionKeys:Object.keys(document.strategyExtensions),valid:true},null,2));

