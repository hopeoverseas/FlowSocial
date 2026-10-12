export const FACT_IMPACTS = Object.freeze(["content_only", "topic", "platform", "strategy", "risk"]);

const list = (value) => Array.isArray(value) ? value : [];

export function normalizeFactAuthorization({ visibility = "unknown", contentUsage = "needs_review" } = {}) {
  const normalizedVisibility = String(visibility || "unknown").trim().toLowerCase();
  const normalizedUsage = String(contentUsage || "needs_review").trim().toLowerCase();
  if (["private", "internal", "forbidden", "不能公开", "不公开", "保密"].includes(normalizedVisibility) || ["forbidden", "prohibited", "private", "do_not_use"].includes(normalizedUsage)) {
    return { visibility: "private", contentUsage: "forbidden" };
  }
  if (["anonymized", "脱敏后可公开", "脱敏", "匿名"].includes(normalizedVisibility) || normalizedUsage === "allowed_with_anonymization") {
    return { visibility: "anonymized", contentUsage: "allowed_with_anonymization" };
  }
  if (["public", "publishable", "可以公开", "可公开"].includes(normalizedVisibility) && !["needs_review", "unknown"].includes(normalizedUsage)) {
    return { visibility: "public", contentUsage: "allowed" };
  }
  if (["public", "publishable", "可以公开", "可公开"].includes(normalizedVisibility)) return { visibility: "public", contentUsage: "allowed" };
  return { visibility: "unknown", contentUsage: "needs_review" };
}

export function authorizationFromUserText(value = "") {
  const text=String(value||"").trim();
  if (/脱敏后?可公开|匿名后?可公开|脱敏使用/.test(text)) return { visibility:"anonymized",contentUsage:"allowed_with_anonymization",publicUsage:"anonymized" };
  if (/不能公开|不得公开|不公开|保密|仅限内部/.test(text)) return { visibility:"private",contentUsage:"forbidden",publicUsage:"private" };
  if (/暂不确定|尚未确定|需要确认|待确认/.test(text)) return { visibility:"unknown",contentUsage:"needs_review",publicUsage:"unknown" };
  if (/全部.{0,3}可公开|全部公开|可以公开|能公开|可公开/.test(text)) return { visibility:"public",contentUsage:"allowed",publicUsage:"public" };
  return { visibility:"unknown",contentUsage:"needs_review",publicUsage:"unknown" };
}

function anonymizationRules(fact) {
  if (fact.visibility !== "anonymized") return [];
  const supplied = fact.anonymizationRules || fact.value?.anonymizationRules || fact.value?.anonymization;
  const rules = list(supplied).map(String).map((item) => item.trim()).filter(Boolean);
  return rules.length ? [...new Set(rules)] : ["移除客户名称、联系人和其他可直接识别主体的信息", "仅保留经授权且无法反向识别主体的数据与案例细节"];
}

export function classifyFactImpact(fact = {}) {
  if (FACT_IMPACTS.includes(fact.strategyImpact)) return fact.strategyImpact;
  const signal = `${fact.factKey || ""} ${fact.factType || ""} ${fact.predicate || ""}`.toLowerCase();
  if (/constraint|boundary|privacy|public_usage|compliance|forbidden|risk|公开|隐私|合规|边界/.test(signal)) return "risk";
  if (/audience\.pain|audience\.common_objection|lead_qualification|market\.priority|brand\.voice|business|conversion|positioning|目标客户|商业模式|转化/.test(signal)) return "strategy";
  if (/platform|publishing_cadence|xiaohongshu|wechat|小红书|公众号|发布频率/.test(signal)) return "platform";
  if (/topic|trend|keyword|content_preference|选题|热点|关键词/.test(signal)) return "topic";
  return "content_only";
}

export function inferFactPlatformScope(fact = {}) {
  if (Array.isArray(fact.platformScope) && fact.platformScope.length) return [...new Set(fact.platformScope)];
  const signal = `${fact.factKey || ""} ${fact.predicate || ""}`.toLowerCase();
  if (/xiaohongshu|xhs|小红书/.test(signal) && !/wechat|公众号/.test(signal)) return ["xiaohongshu"];
  if (/wechat|公众号/.test(signal) && !/xiaohongshu|xhs|小红书/.test(signal)) return ["wechat"];
  return ["xiaohongshu", "wechat"];
}

export function factAffectsStrategy(fact = {}) {
  return ["platform", "strategy", "risk"].includes(classifyFactImpact(fact));
}

export function normalizeGovernedFact(fact = {}) {
  const authorization = normalizeFactAuthorization(fact);
  return {
    id: fact.id || fact.factKey || null,
    key: fact.factKey || fact.key || fact.predicate || "",
    factType: fact.factType || "fact",
    predicate: fact.predicate || "",
    value: fact.value ?? "",
    confidence: Number(fact.confidence ?? 0.5),
    visibility: authorization.visibility,
    contentUsage: authorization.contentUsage,
    status: fact.status || "unknown",
    strategyImpact: classifyFactImpact(fact),
    platformScope: inferFactPlatformScope(fact),
    sourceType: fact.sourceType || "unknown",
    sourceIds: list(fact.sourceEventIds),
    sensitivity: fact.sensitivity || (authorization.visibility === "private" ? "restricted" : "internal"),
    anonymizationRules: anonymizationRules({ ...fact, ...authorization }),
    validFrom: fact.validFrom || fact.createdAt || null,
    expiresAt: fact.expiresAt || null,
    updatedAt: fact.updatedAt || fact.createdAt || null
  };
}

export function buildFactSnapshotPayload({ accountId, facts = [], factRevision = 0, capturedAt = new Date().toISOString() }) {
  const usableFacts = [];
  const contextOnlyFacts = [];
  const forbiddenFacts = [];
  for (const input of facts) {
    if (["rejected", "conflicting", "superseded"].includes(input.status)) continue;
    const fact = normalizeGovernedFact(input);
    const publicEnough = ["public", "publishable", "anonymized"].includes(fact.visibility);
    if (["forbidden", "private", "do_not_use"].includes(fact.contentUsage) || fact.visibility === "private") forbiddenFacts.push(fact);
    else if (["usable", "allowed", "allowed_with_anonymization", "approved", "publishable"].includes(fact.contentUsage) && publicEnough) usableFacts.push(fact);
    else contextOnlyFacts.push(fact);
  }
  return { schemaVersion: "1.0", accountId, factRevision, capturedAt, usableFacts, contextOnlyFacts, forbiddenFacts, missingFacts: [] };
}
