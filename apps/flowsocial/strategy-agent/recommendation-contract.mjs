const text = (value) => typeof value === "string" ? value.trim() : "";
const list = (value) => Array.isArray(value) ? value.filter((item)=>item != null) : value == null ? [] : [value];

function valueLines(value) {
  if (typeof value === "string") return value.split(/\s*(?:→|->|\n)\s*/).map((item)=>item.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(valueLines);
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.steps)) return value.steps.flatMap(valueLines);
  return ["summary","xiaohongshu","wechat","primaryOutcome","currentStage","publicUsage"].flatMap((key)=>value[key] == null ? [] : valueLines(value[key]));
}

export function humanizeRecommendationValue(value, fallback="这是一版基于当前信息生成的建议") {
  if (typeof value === "string" && value.trim()) return value.trim();
  const lines=valueLines(value);
  if (lines.length) return lines.join(" → ");
  return text(value?.name || value?.label || value?.description || value?.summary) || fallback;
}

export function buildRecommendationDisplay({ value, label="推荐方案", rationale=[], index=0 }={}) {
  const steps=valueLines(value);
  return { title:label || (index ? `备选方案 ${index}` : "推荐方案"),summary:humanizeRecommendationValue(value),steps:steps.length>1?steps:[],advantages:list(rationale).map((item)=>humanizeRecommendationValue(item,"")).filter(Boolean),attention:list(value?.assumptions).map((item)=>humanizeRecommendationValue(item,"")).filter(Boolean) };
}

export function normalizeRecommendationOption(value,{ recommendationId,index=0,recommended=false,rationale=[] }={}) {
  if (value && typeof value === "object" && value.optionId && value.completeValue != null) return { ...value,display:value.display||buildRecommendationDisplay({value:value.completeValue,label:value.label,index,rationale:value.rationale||rationale}),summary:value.summary||humanizeRecommendationValue(value.completeValue) };
  const label=recommended?"推荐方案":`备选方案 ${index}`;
  return { optionId:`${recommendationId}_option_${index+1}`,label,summary:humanizeRecommendationValue(value),display:buildRecommendationDisplay({value,label,index,rationale:recommended?rationale:[]}),completeValue:value,rationale:recommended?list(rationale):[],assumptions:[],completeness:"unknown" };
}

export function completeRecommendationValue(fieldPath,value) {
  const summary=humanizeRecommendationValue(value);
  const object=value && typeof value === "object" && !Array.isArray(value) ? {...value} : {};
  if (fieldPath === "business.conversionPath") {
    const steps=valueLines(value);
    return { ...object,summary,steps,entryCTA:object.entryCTA||steps[0]||"在内容结尾引导咨询",contactChannel:object.contactChannel||steps.find((x)=>/微信|私信|表单|电话|官网/.test(x))||"通过私信或企业微信咨询",handoffOwner:object.handoffOwner||steps.find((x)=>/销售|顾问|客服/.test(x))||"由销售或顾问承接",informationCollection:object.informationCollection||"首次沟通确认公司、需求、预算与决策角色",leadQualification:object.leadQualification||"根据需求匹配度、预算和决策条件判断有效线索",diagnosticStep:object.diagnosticStep||steps.find((x)=>/诊断|演示|沟通/.test(x))||"安排需求诊断",nextBusinessStep:object.nextBusinessStep||steps.find((x)=>/方案|报价|演示/.test(x))||"输出方案并沟通范围",cooperationEntry:object.cooperationEntry||steps.find((x)=>/签约|付款|立项|合作/.test(x))||"确认范围后签约或立项" };
  }
  if (fieldPath === "accountStrategy.primaryGoal") return { ...object,summary,primaryOutcome:object.primaryOutcome||summary,priority:object.priority||"作为当前首要目标",timeHorizon:object.timeHorizon||"未来三个月",targetAudience:object.targetAudience||"当前核心目标客户",successSignals:object.successSignals||["目标客户互动","有效咨询或业务推进"] };
  if (fieldPath === "accountStrategy.platformRoles") return { ...object,summary,xiaohongshuRole:object.xiaohongshuRole||object.xiaohongshu||"场景触达",xiaohongshuAudience:object.xiaohongshuAudience||"平台内潜在目标客户",xiaohongshuContent:object.xiaohongshuContent||"场景、问题和清单型内容",xiaohongshuConversion:object.xiaohongshuConversion||"私信或引导进入承接渠道",wechatRole:object.wechatRole||object.wechat||"深度信任",wechatAudience:object.wechatAudience||"进一步了解方案的目标客户",wechatContent:object.wechatContent||"方法、案例和系统文章",wechatConversion:object.wechatConversion||"咨询、活动或企业微信承接",crossPlatformRelationship:object.crossPlatformRelationship||"小红书触达，公众号深化信任并承接" };
  if (fieldPath === "business.primaryOffers") return { ...object,summary,offerNames:object.offerNames||list(value),priorityOffers:object.priorityOffers||list(value).slice(0,1),problemsSolved:object.problemsSolved||["解决目标客户的核心业务问题"],targetCustomers:object.targetCustomers||["当前核心受众"],deliverables:object.deliverables||["按实际产品或服务交付"],applicableScenarios:object.applicableScenarios||["目标客户出现对应需求时"] };
  return value;
}
