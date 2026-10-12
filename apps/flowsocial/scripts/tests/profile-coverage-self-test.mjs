import assert from "node:assert/strict";
import { conservativeCoverageFromAnswer, mergeCoverageAssessment, normalizeCoverageAssessment, buildCoverageSnapshot, dynamicFactSpecs } from "../../strategy-agent/profile-coverage-registry.mjs";
import { planNextDiagnosticQuestion } from "../../strategy-agent/question-planner.mjs";
import { planNextEnrichmentQuestion } from "../../strategy-agent/enrichment-planner.mjs";

const shortPath=conservativeCoverageFromAnswer("core_field","business.conversionPath","加销售微信","加销售微信");
assert.equal(shortPath.strategyReady,false,"仅有咨询入口不能完成转化路径");
assert.ok(shortPath.missingRequiredSlots.includes("leadQualification"));

const first=normalizeCoverageAssessment({ capturedSlots:[{slot:"contactChannel",value:"销售微信"},{slot:"handoffOwner",value:"销售"}] },{targetType:"core_field",targetId:"business.conversionPath"});
const second=mergeCoverageAssessment(first,{ capturedSlots:[{slot:"entryCTA",value:"文末咨询"},{slot:"informationCollection",value:"公司与需求"},{slot:"leadQualification",value:"需求和预算匹配"}],status:"partial" },{targetType:"core_field",targetId:"business.conversionPath"});
assert.equal(second.capturedSlots.length,5,"多轮回答应累积覆盖，不得覆盖上一轮");

const plan=planNextDiagnosticQuestion({ claims:[{fieldPath:"business.conversionPath",value:"加销售微信",status:"confirmed"}],fieldStates:[{fieldPath:"business.conversionPath",state:"partial"}],coverageStates:[second],previousQuestions:[],targetAssessment:second });
assert.equal(plan.targetFieldPaths[0],"business.conversionPath");
assert.match(plan.content,/还需要补充/);

const dynamicPartial=normalizeCoverageAssessment({ capturedSlots:[{slot:"painPoints",value:["获客成本高"]}] },{targetType:"dynamic_fact",targetId:"audience_insight"});
const enrichment=planNextEnrichmentQuestion({ coverageStates:[dynamicPartial],previousQuestions:[{targetFactKey:"audience.pain_points",attempt:1}] });
assert.equal(enrichment.category,"audience_insight","同一动态类别信息不足时应继续追问");
assert.equal(enrichment.attempt,2);
assert.ok(dynamicFactSpecs.length>=19);

const snapshot=buildCoverageSnapshot([second],[dynamicPartial]);
assert.equal(snapshot.core.total,9);
assert.equal(snapshot.dynamic.total,1,"动态画像只显示当前已实例化且相关的类别，不再出现固定 0/14");
assert.ok(snapshot.core.items[0].missingRequiredLabels.length>0);

console.log(JSON.stringify({status:"profile-coverage-self-test passed",conversionCaptured:second.capturedSlots.map((x)=>x.slot),dynamicCategories:dynamicFactSpecs.length,nextCoreQuestion:plan.content,nextDynamicQuestion:enrichment.content},null,2));

