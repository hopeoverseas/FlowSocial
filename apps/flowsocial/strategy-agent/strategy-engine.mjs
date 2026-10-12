function claimMap(claims = []) {
  const result = new Map();
  for (const claim of claims) {
    if (!["confirmed", "inferred"].includes(claim.status)) continue;
    const existing = result.get(claim.fieldPath);
    if (!existing || claim.status === "confirmed" || Number(claim.confidence) > Number(existing.confidence)) result.set(claim.fieldPath, claim);
  }
  return result;
}

const value = (map, path, fallback) => map.get(path)?.value ?? fallback;

const placeholderPattern = /^(未提及|未知|暂无|不清楚|待补充|none|null|unknown|n\/a)$/i;

const draftRequiredFields = ["business.primaryOffers", "audiences.primary", "business.conversionPath", "accountStrategy.primaryGoal"];
const activationRequiredFields = [...draftRequiredFields, "business.businessModel", "accountStrategy.platformRoles"];

const meaningful = (input) => {
  if (input == null) return false;
  if (typeof input === "string") return Boolean(input.trim()) && !placeholderPattern.test(input.trim());
  if (Array.isArray(input)) return input.some(meaningful);
  if (typeof input === "object") return Object.values(input).some(meaningful);
  return true;
};

export function evaluateStrategyDraftReadiness(claims = [], fieldStates = [], coverageStates = []) {
  const resolved = resolveDiagnosticState(claims, fieldStates, coverageStates);
  return {
    ...resolved,
    assumptionsRequired: [...new Set([...resolved.unresolvedFields, ...resolved.requiredSkippedFields])]
  };
}

export function toStringArray(input, limit = 20) {
  const source = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[、,，;；\n]/)
      : input == null
        ? []
        : [input];
  return [...new Set(source.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.name || item.label || item.title || "").trim();
    return String(item || "").trim();
  }).filter((item) => item && !placeholderPattern.test(item)))].slice(0, limit);
}

function normalizeAudiences(input) {
  const source = Array.isArray(input) ? input : input == null ? [] : [input];
  return source.map((item, index) => {
    if (typeof item === "string") return { id: `audience_${index + 1}`, name: item.trim().replace(/行业行业/g, "行业").replace(/客户客户/g, "客户") };
    if (!item || typeof item !== "object") return null;
    const name = String(item.name || item.description || item.label || "").trim().replace(/行业行业/g, "行业").replace(/客户客户/g, "客户");
    return name ? { ...item, id: item.id || `audience_${index + 1}`, name } : null;
  }).filter(Boolean);
}

function normalizePlatformRoles(input) {
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

export function buildStrategySynthesisRequest({ accountId, claims, account, strategyInputBundle = null, platformScope = ["xiaohongshu", "wechat"] }) {
  return {
    task: "synthesize_account_strategy",
    contract: "StrategySynthesisResult@2.0",
    accountId,
    account,
    profileClaims: claims,
    strategyInputBundle,
    platformScope,
    rules: [
      "优先综合 StrategyInputBundle 中的已确认骨架、策略级动态事实、平台事实、风险事实和已确认知识证据",
      "读取 strategyDecisions 中已经过方法库约束的单账号/角色矩阵建议、账号身份、增长打法、热点政策和实验边界；不得自行发明方法卡",
      "本轮对话确认的信息决定当前方向；retrievedKnowledgeEvidence只能补证、发现缺口或形成待确认冲突，不得覆盖对话结论",
      "content_only 事实可以用于理解业务与内容资源，但不得擅自升级为长期策略结论",
      "冲突信息不得自行选择，必须写入 missingInformation 或 hypotheses",
      "只把confirmed声明写入confirmedFacts",
      "把inferred声明和策略判断写入hypotheses",
      "不得虚构产品、案例、团队经历、客户结果或数据",
      "账号阶段决定关注重点，用户当前模式决定帮助方式",
      "内容职能比例必须结合账号阶段、业务目标和证据准备度给出依据，不得无理由套用默认比例",
      "完整转化流程用于长期业务理解；同时生成分级CTA原则，避免每篇内容承担整条销售路径",
      "策略必须区分公司共享事实、矩阵协同和单账号增长策略；不存在矩阵条件时保留单账号模式",
      "完全无关热点、自动删除历史内容、批量重复铺量、刷量和伪装素人不得进入自动推荐",
      "输出可验证的30—90天长期策略，不生成具体发文日历，不承诺涨粉或成交结果",
      "保留兼容的StrategyDocument@2.0字段；新增长期执行规则写入strategyExtensions"
    ]
  };
}

export function createStrategyDraft({ accountId, claims, strategy = {} }) {
  const byPath = claimMap(claims);
  const confirmedClaimIds = claims.filter((claim) => claim.status === "confirmed").map((claim) => claim.id);
  const inferred = claims.filter((claim) => claim.status === "inferred");
  const primaryOffers = toStringArray(value(byPath, "business.primaryOffers", strategy.business?.primaryOffers || []));
  const audiences = normalizeAudiences(strategy.audiences?.length ? strategy.audiences : value(byPath, "audiences.primary", []));
  return {
    schemaVersion: "1.0",
    accountId,
    business: {
      businessModel: value(byPath, "business.businessModel", strategy.business?.businessModel || ""),
      primaryOffers,
      valueProposition: value(byPath, "business.valueProposition", strategy.business?.valueProposition || ""),
      conversionPath: value(byPath, "business.conversionPath", strategy.business?.conversionPath || "")
    },
    audiences,
    accountStrategy: {
      growthStage: value(byPath, "accountStrategy.growthStage", strategy.accountStrategy?.growthStage || "exploration"),
      operatingMode: strategy.accountStrategy?.operatingMode || "guided",
      primaryGoal: value(byPath, "accountStrategy.primaryGoal", strategy.accountStrategy?.primaryGoal || ""),
      platformRoles: normalizePlatformRoles(value(byPath, "accountStrategy.platformRoles", strategy.accountStrategy?.platformRoles || {})),
      contentPillars: toStringArray(strategy.accountStrategy?.contentPillars || []),
      contentPortfolio: strategy.accountStrategy?.contentPortfolio || {},
      tone: toStringArray(strategy.accountStrategy?.tone || []),
      forbiddenTopics: toStringArray(strategy.accountStrategy?.forbiddenTopics || [])
      ,contentResources: value(byPath, "accountStrategy.contentResources", strategy.accountStrategy?.contentResources || null)
      ,constraints: value(byPath, "accountStrategy.constraints", strategy.accountStrategy?.constraints || [])
    },
    knowledgeScope: strategy.knowledgeScope || { folderIds: [] },
    confirmedClaimIds,
    hypotheses: [
      ...(Array.isArray(strategy.hypotheses) ? strategy.hypotheses : []),
      ...inferred.map((claim) => ({ fieldPath: claim.fieldPath, value: claim.value, confidence: claim.confidence, sourceClaimId: claim.id }))
    ],
    missingInformation: Array.isArray(strategy.missingInformation) ? strategy.missingInformation : toStringArray(strategy.missingInformation || []),
    createdAt: new Date().toISOString()
  };
}

export function validateStrategyDraft(snapshot) {
  const errors = [];
  if (!snapshot?.accountId) errors.push("accountId is required");
  if (!Array.isArray(snapshot?.business?.primaryOffers) || !snapshot.business.primaryOffers.length) errors.push("business.primaryOffers must be a non-empty array");
  if (typeof snapshot?.business?.conversionPath !== "string" || !snapshot.business.conversionPath.trim()) errors.push("business.conversionPath is required");
  if (!Array.isArray(snapshot?.audiences) || !snapshot.audiences.length) errors.push("audiences must be a non-empty array");
  if (!snapshot?.accountStrategy?.primaryGoal) errors.push("accountStrategy.primaryGoal is required");
  if (!snapshot?.accountStrategy?.platformRoles || typeof snapshot.accountStrategy.platformRoles !== "object" || Array.isArray(snapshot.accountStrategy.platformRoles)) errors.push("accountStrategy.platformRoles must be an object");
  if (!Array.isArray(snapshot?.accountStrategy?.contentPillars)) errors.push("accountStrategy.contentPillars must be an array");
  if (!Array.isArray(snapshot?.hypotheses)) errors.push("hypotheses must be an array");
  if (!Array.isArray(snapshot?.missingInformation)) errors.push("missingInformation must be an array");
  return { valid: errors.length === 0, errors };
}
import { resolveDiagnosticState } from "./diagnostic-state-resolver.mjs";
