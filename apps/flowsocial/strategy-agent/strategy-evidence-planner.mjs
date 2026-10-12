const list = (value) => Array.isArray(value) ? value.filter(Boolean) : value == null ? [] : [value];
const text = (value) => typeof value === "string" ? value.trim() : value && typeof value === "object" ? String(value.summary || value.name || "").trim() : "";

function claimMap(claims = []) {
  return new Map(claims.filter((claim)=>["confirmed","accepted_suggestion"].includes(claim.status)).map((claim)=>[claim.fieldPath,claim.value]));
}

function names(value) {
  return list(value).flatMap((item)=>typeof item === "string" ? item.split(/[、，,；;\n]/) : [item?.name || item?.label || item?.summary]).map((item)=>String(item || "").trim()).filter(Boolean);
}

export function buildStrategyEvidenceRequest({ claims = [], maxQueries = 5 } = {}) {
  const byPath = claimMap(claims);
  const offers = names(byPath.get("business.primaryOffers"));
  const audiences = names(byPath.get("audiences.primary"));
  const goal = text(byPath.get("accountStrategy.primaryGoal"));
  const resources = byPath.get("accountStrategy.contentResources") || {};
  const queries = [];
  const add = (purpose, query, targetPaths, evidenceTypes) => {
    if (!query.trim() || queries.some((item)=>item.query===query.trim())) return;
    queries.push({ id:`strategy_query_${queries.length+1}`,purpose,query:query.trim(),targetPaths,evidenceTypes });
  };
  if (offers.length) add("核对产品服务、适用场景与交付边界",`${offers.slice(0,3).join(" ")} 产品 服务 适用场景 交付流程 常见问题`,["business.offers","strategy.contentSystem"],["product","service","sop","faq"]);
  if (audiences.length) add("补充目标客户的真实问题和决策顾虑",`${audiences.slice(0,3).join(" ")} 客户问题 采购顾虑 常见异议`,["strategy.audiences","strategy.messageArchitecture"],["faq","sales","case"]);
  if (/信任|咨询|转化|案例|专业/.test(goal) || list(resources.cases).length) add("寻找可用于建立信任的案例与证据","客户案例 项目背景 实施过程 成果数据 客户反馈 公开授权",["strategy.contentSystem","strategy.evidencePolicy"],["case","data","authorization"]);
  add("核对品牌、合规和公开表达边界","品牌表达规范 禁用语 客户信息 脱敏 广告法 合规 审核",["strategy.messageArchitecture","strategy.riskPolicy"],["brand","compliance","policy"]);
  if (/热点|行业|流量|曝光|触达/.test(goal)) add("补充行业观点和可持续监测范围","行业趋势 政策 技术变化 市场观点 重点地区",["strategy.contentSystem","strategy.platformPlaybooks"],["report","opinion","market"]);
  return {
    schemaVersion:"1.0",
    mode:"targeted_retrieval",
    sourcePriority:["current_confirmed_conversation","confirmed_knowledge_evidence","performance_signals","model_hypothesis"],
    rules:["知识库不得覆盖本轮用户确认","检索片段只能作为证据或候选信息","冲突必须进入待确认项","内容素材不得自动升级为长期策略事实"],
    queries:queries.slice(0,maxQueries)
  };
}

export function normalizeRetrievedStrategyEvidence(request, results = []) {
  const byQuery = new Map(results.map((item)=>[item.queryId,item]));
  return request.queries.flatMap((query)=>{
    const result = byQuery.get(query.id);
    return list(result?.items).slice(0,4).map((item)=>({
      id:`retrieval:${query.id}:${item.chunkId}`,
      queryId:query.id,
      purpose:query.purpose,
      targetPaths:query.targetPaths,
      evidenceTypes:query.evidenceTypes,
      fileId:item.fileId,
      fileName:item.fileName,
      chunkId:item.chunkId,
      excerpt:String(item.text || "").slice(0,900),
      score:Number(item.score || 0),
      status:"supporting_context",
      usage:"strategy_evidence_only"
    }));
  });
}
