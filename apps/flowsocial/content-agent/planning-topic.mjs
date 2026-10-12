const DEFAULT_AUDIENCE = "核心目标用户";
const DEFAULT_PILLAR = "核心业务主题";
const MAX_AUDIENCE_LENGTH = 24;
export const MAX_PLANNING_TOPIC_LENGTH = 48;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueShortValues(values, limit = 3) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanText).filter((value) => value && value.length <= 12))].slice(0, limit);
}

function paragraphLike(value, maxLength) {
  const text = cleanText(value);
  const sentenceMarks = (text.match(/[。！？；]/g) || []).length;
  return text.length > maxLength || sentenceMarks > 1;
}

function shortPhrase(value, maxLength, fallback) {
  const text = cleanText(value);
  if (!text) return fallback;
  const firstClause = text.split(/[。！？；：]/)[0].trim();
  const candidate = firstClause || text;
  return candidate.length <= maxLength ? candidate : `${candidate.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function compactAudienceLabel(audience = {}) {
  if (typeof audience === "string") {
    const value = cleanText(audience);
    return !paragraphLike(value, MAX_AUDIENCE_LENGTH) ? value : DEFAULT_AUDIENCE;
  }
  const name = cleanText(audience?.name);
  if (name && !paragraphLike(name, MAX_AUDIENCE_LENGTH)) return name;

  const industries = uniqueShortValues(audience?.industries);
  if (industries.length) return `${industries.join("、")}企业决策者`;

  const roles = uniqueShortValues(audience?.decisionRoles || audience?.decisionMakers, 2);
  if (roles.length) return roles.join("与");

  return DEFAULT_AUDIENCE;
}

export function normalizePlanningAudience(audience = {}) {
  if (!audience || typeof audience !== "object" || Array.isArray(audience)) {
    return { name: compactAudienceLabel(audience), summary: cleanText(audience) };
  }
  const originalName = cleanText(audience.name);
  const name = compactAudienceLabel(audience);
  return {
    ...audience,
    name,
    summary: cleanText(audience.summary) || (originalName !== name ? originalName : "")
  };
}

export function normalizePlanningTopic(rawTopic, { contentFunction, contentPillar, audience } = {}) {
  const topic = cleanText(rawTopic);
  if (topic && !paragraphLike(topic, MAX_PLANNING_TOPIC_LENGTH)) return topic;

  const pillar = shortPhrase(contentPillar, 18, DEFAULT_PILLAR);
  const audienceLabel = compactAudienceLabel(audience);
  const fallbackByFunction = {
    discovery: `${pillar}最容易忽略的关键问题`,
    authority: `${pillar}怎么做：给${audienceLabel}一套可执行方法`,
    proof: `${pillar}真实案例：如何验证实际效果`,
    solution: `${pillar}应用指南：从问题判断到方案选择`,
    action: `${pillar}下一步行动清单`
  };
  const fallback = fallbackByFunction[contentFunction] || `${pillar}：一个值得验证的内容方向`;
  return fallback.length <= MAX_PLANNING_TOPIC_LENGTH
    ? fallback
    : `${fallback.slice(0, MAX_PLANNING_TOPIC_LENGTH - 1)}…`;
}
