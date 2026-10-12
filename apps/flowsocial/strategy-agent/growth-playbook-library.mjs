const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const PLAYBOOK_VERSION = "1.1";

export const GROWTH_PLAYBOOKS = Object.freeze([
  {
    id: "xhs-company-vertical-cold-start", name: "小红书企业垂直专业冷启动", platform: "xiaohongshu", growthMode: "steady_vertical",
    accountTypes: ["company_official", "employee_expert", "product_vertical"], stages: ["exploration", "account_setup", "content_market_fit"],
    prerequisites: ["目标受众与业务问题基本明确", "能够持续提供专业知识或业务证据"],
    platformMechanism: "用垂直场景、可收藏方法和稳定专业表达建立小红书搜索与推荐识别",
    resourceRequirements: ["每周至少两个真实业务问题", "基础图文制作能力"], recommendedCadence: { windowDays: 7, items: 4 },
    contentFunctionTargets: { discovery: 20, authority: 35, proof: 15, solution: 20, action: 10 },
    hotspotPolicy: { allowedTiers: ["direct", "bridge"], maxShare: 0.25, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 14, primarySignals: ["目标受众互动", "收藏", "主页访问", "有效咨询"],
    exitConditions: ["连续两个观察窗口无法获得目标受众互动", "内容证据不足以持续输出"], confidence: "high"
  },
  {
    id: "xhs-company-hybrid-cold-start", name: "小红书热点与垂直混合冷启动", platform: "xiaohongshu", growthMode: "hybrid_bridge",
    accountTypes: ["company_official", "founder_ip", "employee_expert", "personal_creator"], stages: ["exploration", "account_setup", "content_market_fit"],
    prerequisites: ["能够快速判断热点与目标受众的真实关联", "具备把热点桥接到业务问题的专业能力"],
    platformMechanism: "以业务相关热点扩大非粉触达，再用垂直内容承接主页访问与关注",
    resourceRequirements: ["热点响应与审核能力", "稳定的垂直内容承接"], recommendedCadence: { windowDays: 7, items: 5 },
    contentFunctionTargets: { discovery: 35, authority: 30, proof: 10, solution: 15, action: 10 },
    hotspotPolicy: { allowedTiers: ["direct", "bridge"], maxShare: 0.45, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 14, primarySignals: ["非粉触达", "目标受众关注", "热点到垂直内容迁移", "有效咨询"],
    exitConditions: ["热点流量无法迁移到垂直内容", "目标受众占比持续下降", "热点响应产能不足"], confidence: "medium"
  },
  {
    id: "xhs-hotspot-experiment", name: "小红书受控热点实验冷启动", platform: "xiaohongshu", growthMode: "hotspot_experiment",
    accountTypes: ["founder_ip", "employee_expert", "personal_creator", "company_official"], stages: ["exploration", "account_setup"],
    prerequisites: ["用户明确接受受众偏移风险", "设置短周期、业务回归路径和退出条件"],
    platformMechanism: "用短周期弱相关实验验证触达，但以目标用户占比和垂直回流而非曝光量判断",
    resourceRequirements: ["快速响应产能", "每日监测目标用户质量"], recommendedCadence: { windowDays: 7, items: 6 },
    contentFunctionTargets: { discovery: 50, authority: 25, proof: 5, solution: 10, action: 10 },
    hotspotPolicy: { allowedTiers: ["direct", "bridge", "weak_experiment"], maxShare: 0.6, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 7, primarySignals: ["有效关注", "主页访问", "垂直内容回流", "目标用户占比"],
    exitConditions: ["只有曝光没有有效关注", "弱相关热点造成账号认知偏移", "无法在实验后回归业务内容"], confidence: "low"
  },
  {
    id: "wechat-enterprise-authority", name: "公众号企业权威与线索经营", platform: "wechat", growthMode: "steady_vertical",
    accountTypes: ["company_official", "institution_service"], stages: ["account_setup", "content_market_fit", "growth", "monetization"],
    prerequisites: ["具备可核验的企业事实和专业资料", "有关注后承接或销售入口"],
    platformMechanism: "通过稳定栏目、深度论证和企业事实积累公众号权威与转发信任",
    resourceRequirements: ["可核验企业资料", "编辑审核与线索承接"], recommendedCadence: { windowDays: 14, items: 2 },
    contentFunctionTargets: { discovery: 10, authority: 35, proof: 20, solution: 25, action: 10 },
    hotspotPolicy: { allowedTiers: ["direct", "bridge"], maxShare: 0.25, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 30, primarySignals: ["打开与读完", "转发", "关注后承接", "有效线索"],
    exitConditions: ["内容无法形成稳定栏目", "缺少可公开证据", "承接设施长期缺失"], confidence: "high"
  },
  {
    id: "wechat-founder-expert-ip", name: "公众号创始人或专家IP经营", platform: "wechat", growthMode: "relationship_ip",
    accountTypes: ["founder_ip", "employee_expert", "personal_creator"], stages: ["exploration", "account_setup", "content_market_fit", "growth"],
    prerequisites: ["有稳定发声者", "能够持续输出真实判断、经验和边界"],
    platformMechanism: "依靠持续署名、真实判断和读者关系形成复访、转发与私域承接",
    resourceRequirements: ["稳定发声者", "可持续的个人经验与观点"], recommendedCadence: { windowDays: 14, items: 2 },
    contentFunctionTargets: { discovery: 15, authority: 40, proof: 15, solution: 20, action: 10 },
    hotspotPolicy: { allowedTiers: ["direct", "bridge"], maxShare: 0.3, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 30, primarySignals: ["关注", "复访", "转发", "私域或咨询意向"],
    exitConditions: ["发声者无法稳定参与", "文章长期缺乏个人判断和真实经验"], confidence: "medium"
  },
  {
    id: "wechat-search-asset", name: "公众号搜索与内容资产经营", platform: "wechat", growthMode: "search_asset",
    accountTypes: ["company_official", "employee_expert", "product_vertical", "institution_service"], stages: ["account_setup", "content_market_fit", "growth", "scaling"],
    prerequisites: ["有稳定高频问题或关键词", "愿意建设栏目、菜单与关联阅读"],
    platformMechanism: "围绕高频搜索问题建设可长期检索、关联阅读和菜单承接的内容资产",
    resourceRequirements: ["关键词与高频问题库", "栏目、菜单和关联阅读维护"], recommendedCadence: { windowDays: 14, items: 2 },
    contentFunctionTargets: { discovery: 15, authority: 35, proof: 15, solution: 25, action: 10 },
    hotspotPolicy: { allowedTiers: ["direct"], maxShare: 0.15, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 30, primarySignals: ["搜索进入", "历史文章阅读", "关注", "菜单或关键词承接"],
    exitConditions: ["主题没有稳定搜索需求", "账号基础设施无法维护"], confidence: "medium"
  },
  {
    id: "wechat-stable-columns", name: "公众号稳定栏目起号", platform: "wechat", growthMode: "steady_vertical",
    accountTypes: ["company_official", "employee_expert", "product_vertical", "institution_service"], stages: ["exploration", "account_setup", "content_market_fit"],
    prerequisites: ["能固定一到两个栏目主题", "团队能按稳定节奏完成编辑审核"],
    platformMechanism: "先以固定栏目和连续主题建立读者预期，再逐步增加案例、搜索资产和业务承接",
    resourceRequirements: ["至少一个可连续更新的栏目", "固定编辑与审核时段"], recommendedCadence: { windowDays: 14, items: 2 },
    contentFunctionTargets: { discovery: 10, authority: 40, proof: 10, solution: 30, action: 10 },
    hotspotPolicy: { allowedTiers: ["direct"], maxShare: 0.15, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 30, primarySignals: ["连续更新完成率", "读完", "转发", "关注与复访"],
    exitConditions: ["连续两个周期无法按栏目更新", "栏目主题与目标受众问题不匹配"], confidence: "high"
  },
  {
    id: "stable-account-portfolio", name: "稳定账号内容组合优化", platform: "all", growthMode: "stable_operation",
    accountTypes: ["company_official", "founder_ip", "employee_expert", "personal_creator", "product_vertical", "institution_service"], stages: ["growth", "monetization", "scaling"],
    prerequisites: ["已有可复盘的内容历史"],
    platformMechanism: "基于历史表现调整内容职能组合，避免稳定账号继续按冷启动方式试错",
    resourceRequirements: ["可归因的历史内容与表现数据"], recommendedCadence: { windowDays: 14, items: 3 },
    contentFunctionTargets: { discovery: 20, authority: 25, proof: 20, solution: 20, action: 15 },
    hotspotPolicy: { allowedTiers: ["direct", "bridge"], maxShare: 0.3, unrelatedAllowed: false, autoDeleteHistoricalContent: false },
    experimentWindowDays: 30, primarySignals: ["内容职能平衡", "目标受众质量", "有效线索", "复访与转化"],
    exitConditions: ["账号进入定位重构", "历史模式明显失效"], confidence: "high"
  }
]);

function claimValue(claims, path) {
  return claims.find((claim) => claim.fieldPath === path && !["rejected", "conflicting", "superseded"].includes(claim.status))?.value;
}

function normalizedStage(value) {
  const text = JSON.stringify(value || "");
  if (/稳定|增长|growth/.test(text)) return "growth";
  if (/转化|变现|monetization/.test(text)) return "monetization";
  if (/规模|scaling/.test(text)) return "scaling";
  if (/起号|冷启动|新建|account_setup/.test(text)) return "account_setup";
  return "exploration";
}

function normalizedIdentity(account = {}, platformRoles = {}) {
  const settings = object(account.strategySettings || account.settings);
  const explicit = String(account.accountIdentity?.subjectType || account.subjectType || settings.subjectType || settings.accountMode || "").trim();
  if (explicit) return explicit;
  const text = JSON.stringify({
    name: account.name,
    publicIdentity: account.accountIdentity?.publicIdentity || account.publicIdentity,
    matrixRole: settings.matrixRole,
    platformRoles
  });
  if (/创始人|founder/.test(text)) return "founder_ip";
  if (/员工|专家|expert|kos/i.test(text)) return "employee_expert";
  if (/个人|personal|creator/.test(text)) return "personal_creator";
  if (/产品|业务线|product/.test(text)) return "product_vertical";
  if (/服务号|机构服务|institution/.test(text)) return "institution_service";
  return "company_official";
}

function matrixProposal(socialAccounts = [], platformRoles = {}, decisionContext = "") {
  const active = list(socialAccounts).filter((item) => item.status !== "archived");
  const roleSignals = new Set(active.map((item) => normalizedIdentity(item, platformRoles)));
  const explicitSingle = /单账号|一个主账号|暂不.{0,4}矩阵|不做.{0,4}矩阵/.test(decisionContext);
  const explicitMatrix = /账号矩阵|多个账号|多账号|矩阵运营/.test(decisionContext);
  const structuralMatrix = active.length > 1 && (roleSignals.size > 1 || new Set(active.map((item) => item.platform)).size > 1);
  const matrixRecommended = explicitSingle ? false : explicitMatrix ? active.length > 1 : structuralMatrix;
  const primarySocialAccountId = active[0]?.id || null;
  const selectedSocialAccountIds = matrixRecommended ? active.map((item)=>item.id) : primarySocialAccountId ? [primarySocialAccountId] : [];
  const accountRoles = Object.fromEntries(selectedSocialAccountIds.map((id,index)=>{
    const account=active.find((item)=>item.id===id);
    const configured=String(account?.strategySettings?.matrixRole || "").trim();
    const role=configured || (!index ? "primary" : account?.platform === "wechat" ? "authority" : "discovery");
    return [id,role];
  }));
  return {
    mode: matrixRecommended ? "role_matrix" : "single_account",
    primarySocialAccountId,
    selectedSocialAccountIds,
    selectedAccountIds:selectedSocialAccountIds,
    accountRoles,
    confidence: explicitSingle || explicitMatrix ? 0.92 : matrixRecommended ? 0.82 : 0.7,
    rationale: explicitSingle
      ? ["用户已明确选择先以单账号验证", "后续可在产能和模式得到验证后升级为矩阵"]
      : explicitMatrix
        ? ["用户已明确希望采用账号矩阵", "现有账号可按平台和发声角色进行差异化分工"]
        : matrixRecommended
          ? ["当前存在多个平台或不同发声角色", "使用角色协同可以避免重复发布和转化归属混乱"]
          : ["当前账号数量或角色差异不足以支持复杂矩阵", "先验证一个主账号更利于控制产能和反馈归因"],
    risks: matrixRecommended ? ["矩阵账号必须有独立角色与内容边界", "团队产能不足时应分阶段启用"] : ["单账号承载过多角色时需要明确栏目分层"],
    accounts: active.map((account) => ({ socialAccountId: account.id, name: account.name, platform: account.platform, subjectType: normalizedIdentity(account, platformRoles), matrixRole: accountRoles[account.id] || null }))
  };
}

function scorePlaybook(card, { account, stage, identity, goalText, growthText, resourceText, capacityText }) {
  if (!(card.platform === "all" || card.platform === account.platform)) return { total: -1, breakdown: {} };
  const explicitHybrid = /混合|桥接/.test(growthText);
  const explicitHotspotExperiment = /热点实验|受控热点/.test(growthText);
  const explicitVertical = /垂直/.test(growthText) && !explicitHybrid && !explicitHotspotExperiment;
  const reachGoal = /热点|流量|曝光|触达|涨粉/.test(goalText);
  const commercialGoal = /咨询|线索|转化|产品|服务|成交/.test(goalText);
  const hasEvidence = /案例|数据|SOP|产品资料|知识库|专业经验/.test(resourceText);
  const hasStableSpeaker = /创始人|专家|负责人|署名|发声者/.test(`${resourceText}${capacityText}`) || ["founder_ip","employee_expert","personal_creator"].includes(identity);
  const hasFastCapacity = /快速|日更|热点|当天|24小时/.test(capacityText);
  const hasSearchAssets = /关键词|高频问题|栏目|菜单|帮助中心|知识库/.test(resourceText);
  const breakdown = {
    platformFit: 15,
    identityFit: card.accountTypes.includes(identity) ? 15 : 6,
    stageFit: card.stages.includes(stage) ? 20 : 8,
    objectiveFit: reachGoal && ["hotspot_experiment", "hybrid_bridge"].includes(card.growthMode) ? 25 : commercialGoal && ["steady_vertical", "search_asset", "stable_operation"].includes(card.growthMode) ? 25 : 15,
    statedPreferenceFit: explicitHybrid && card.growthMode === "hybrid_bridge" ? 15 : explicitHotspotExperiment && card.growthMode === "hotspot_experiment" ? 15 : explicitVertical && card.growthMode === "steady_vertical" ? 15 : 0,
    capacityFit: card.growthMode === "hotspot_experiment" ? (hasFastCapacity ? 5 : 1) : card.growthMode === "relationship_ip" ? (hasStableSpeaker ? 5 : 1) : 5,
    evidenceFit: card.id === "wechat-search-asset" ? (hasSearchAssets ? 5 : 1) : ["steady_vertical","stable_operation"].includes(card.growthMode) ? (hasEvidence ? 5 : 2) : 4,
    riskControl: card.hotspotPolicy?.unrelatedAllowed === false && card.hotspotPolicy?.autoDeleteHistoricalContent === false ? 5 : 0
  };
  return { total: Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0)), breakdown };
}

export function recommendStrategyDecisions({ claims = [], facts = [], socialAccounts = [] } = {}) {
  const platformRoles = object(claimValue(claims, "accountStrategy.platformRoles"));
  const stage = normalizedStage(claimValue(claims, "accountStrategy.growthStage"));
  const goalText = JSON.stringify(claimValue(claims, "accountStrategy.primaryGoal") || "");
  const factValues = list(facts).map((fact) => fact.value);
  const growthText = JSON.stringify({ stage: claimValue(claims, "accountStrategy.growthStage"), facts: factValues });
  const resourceText = JSON.stringify({ resources:claimValue(claims,"accountStrategy.contentResources"),facts:factValues });
  const capacityText = JSON.stringify(factValues.filter((value)=>/产能|团队|审核|热点|发布|编辑/.test(JSON.stringify(value))));
  const decisionContext = JSON.stringify({ platformRoles, facts: factValues });
  const portfolioDecision = matrixProposal(socialAccounts, platformRoles, decisionContext);
  const accountStrategies = portfolioDecision.accounts.map((account) => {
    const identity = account.subjectType || "company_official";
    const ranked = GROWTH_PLAYBOOKS.map((card) => ({ card, fit: scorePlaybook(card, { account, stage, identity, goalText, growthText, resourceText, capacityText }) })).filter((item) => item.fit.total >= 0).sort((a, b) => b.fit.total - a.fit.total).slice(0, 3);
    const selected = ranked[0]?.card || GROWTH_PLAYBOOKS.find((card) => card.id === "stable-account-portfolio");
    return {
      socialAccountId: account.socialAccountId,
      platform: account.platform,
      accountIdentity: { subjectType: identity, publicIdentity: identity, speaker: null, trustSources: identity === "company_official" ? ["institution", "evidence"] : ["expertise", "experience"] },
      matrixRole: portfolioDecision.accountRoles[account.socialAccountId] || account.matrixRole,
      selectedPlaybookId: selected.id,
      growthMode: selected.growthMode,
      candidatePlaybooks: ranked.map(({ card, fit },index) => ({ playbookId: card.id, playbookVersion:PLAYBOOK_VERSION, platform:account.platform, name: card.name, growthMode: card.growthMode, rank:index+1,isRecommended:index===0,score: fit.total, scoreBreakdown: fit.breakdown, recommendationReasons:[`适配${account.platform === "wechat" ? "公众号" : "小红书"}的内容分发与用户关系机制`,`当前账号身份为 ${identity}，阶段为 ${stage}`,goalText?`优先服务当前目标：${goalText.slice(0,80)}`:"优先验证目标受众与内容匹配"], platformMechanism:[card.platformMechanism].filter(Boolean),resourceRequirements:card.resourceRequirements,recommendedCadence:card.recommendedCadence, rationale: card.prerequisites, prerequisites: card.prerequisites, risks: card.exitConditions, observationWindowDays:card.experimentWindowDays,exitConditions:card.exitConditions,contentFunctionTargets: card.contentFunctionTargets, hotspotPolicy: card.hotspotPolicy, experimentPlan: { windowDays: card.experimentWindowDays, hypothesis: `验证“${card.name}”是否能为当前账号带来目标受众和业务信号`, primarySignals: card.primarySignals, exitConditions: card.exitConditions, status: "proposed" } })),
      contentFunctionTargets: selected.contentFunctionTargets,
      recommendedCadence:selected.recommendedCadence,
      playbookVersion:PLAYBOOK_VERSION,
      hotspotPolicy: selected.hotspotPolicy,
      experimentPlan: { windowDays: selected.experimentWindowDays, hypothesis: `验证“${selected.name}”是否能为当前账号带来目标受众和业务信号`, primarySignals: selected.primarySignals, exitConditions: selected.exitConditions, status: "proposed" }
    };
  });
  return {
    schemaVersion: "1.0",
    portfolioDecision,
    accountStrategies,
    selectedGrowthPlaybooks: accountStrategies.map((item) => ({ socialAccountId: item.socialAccountId, playbookId: item.selectedPlaybookId, playbookVersion:item.playbookVersion, growthMode: item.growthMode })),
    unresolvedDecisions: portfolioDecision.accounts.length ? [] : ["尚未创建可运营的小红书或公众号账号"],
    source: "deterministic_playbook_retrieval"
  };
}

export function normalizeStrategyDecisions(candidate, fallback) {
  const raw = object(candidate);
  if (raw.schemaVersion !== "1.0" || !object(raw.portfolioDecision) || !Array.isArray(raw.accountStrategies)) return fallback;
  const knownPlaybooks = new Map(GROWTH_PLAYBOOKS.map((item) => [item.id, item]));
  const fallbackByAccount = new Map(list(fallback.accountStrategies).map((item) => [item.socialAccountId, item]));
  const accountStrategies = raw.accountStrategies.map((item) => {
    const base = fallbackByAccount.get(item.socialAccountId) || {};
    const card = knownPlaybooks.get(item.selectedPlaybookId) || knownPlaybooks.get(base.selectedPlaybookId);
    return {
      ...base,
      ...item,
      selectedPlaybookId: card?.id || base.selectedPlaybookId,
      playbookVersion:PLAYBOOK_VERSION,
      growthMode: card?.growthMode || base.growthMode,
      contentFunctionTargets: card?.contentFunctionTargets || base.contentFunctionTargets,
      hotspotPolicy: { ...(card?.hotspotPolicy || {}), ...object(item.hotspotPolicy), unrelatedAllowed: false, autoDeleteHistoricalContent: false },
      recommendedCadence:object(item.recommendedCadence).windowDays ? item.recommendedCadence : card?.recommendedCadence || base.recommendedCadence,
      candidatePlaybooks:list(base.candidatePlaybooks).map((candidate,index)=>({ ...candidate,rank:index+1,isRecommended:candidate.playbookId===(card?.id||base.selectedPlaybookId) })),
      experimentPlan: { ...object(base.experimentPlan), ...object(item.experimentPlan), exitConditions: list(item.experimentPlan?.exitConditions).length ? list(item.experimentPlan.exitConditions) : list(card?.exitConditions) }
    };
  });
  const portfolioDecision={...object(fallback.portfolioDecision),...object(raw.portfolioDecision)};
  portfolioDecision.selectedSocialAccountIds=list(portfolioDecision.selectedSocialAccountIds||portfolioDecision.selectedAccountIds);
  portfolioDecision.primarySocialAccountId=portfolioDecision.primarySocialAccountId||portfolioDecision.selectedSocialAccountIds[0]||null;
  if(portfolioDecision.mode==="single_account")portfolioDecision.selectedSocialAccountIds=portfolioDecision.primarySocialAccountId?[portfolioDecision.primarySocialAccountId]:[];
  portfolioDecision.selectedAccountIds=portfolioDecision.selectedSocialAccountIds;
  return { ...fallback, ...raw, portfolioDecision, accountStrategies, selectedGrowthPlaybooks: accountStrategies.map((item) => ({ socialAccountId: item.socialAccountId, playbookId: item.selectedPlaybookId,playbookVersion:item.playbookVersion,growthMode: item.growthMode })), source: raw.source || "llm_with_playbook_guardrails" };
}
