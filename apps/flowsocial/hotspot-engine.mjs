import { randomUUID } from "node:crypto";
import { collectGlobalHotspots, collectSearchSignals, generateText, providerStatus } from "./providers.mjs";
import { filterRelevantSignals } from "./keyword-engine.mjs";

const id = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`;
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
const cleanText = (value = "") => String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const unique = (items, limit = 30) => [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit);

export function classifyHotspotFailure(error, context = {}) {
  const message = String(error?.message || error || "热点采集失败");
  const explicitCode = String(error?.code || "");
  let errorClass = explicitCode.startsWith("HOTSPOT_") ? explicitCode : "HOTSPOT_PROVIDER_FAILED";
  if (/timeout|timed out|超时|ETIMEDOUT/i.test(`${explicitCode} ${message}`)) errorClass = "HOTSPOT_PROVIDER_TIMEOUT";
  else if (/401|403|unauthorized|forbidden|鉴权|密钥|AUTH/i.test(`${explicitCode} ${message}`)) errorClass = "HOTSPOT_PROVIDER_AUTH";
  else if (/429|rate.?limit|限流/i.test(`${explicitCode} ${message}`)) errorClass = "HOTSPOT_PROVIDER_RATE_LIMIT";
  else if (/network|fetch|ECONN|ENOTFOUND|网络/i.test(`${explicitCode} ${message}`)) errorClass = "HOTSPOT_PROVIDER_NETWORK";
  return {
    providerMode: context.providerMode || "unknown",
    errorClass,
    failureStage: context.failureStage || "collection",
    message,
    retryAction: {
      action: "retry_collection",
      label: "重试真实热点采集",
      preservesPreview: true
    }
  };
}

function relevanceTier(score, poolType) {
  if (poolType === "global") return "weak_experiment";
  const numeric = Number(score) || 0;
  if (numeric >= 85) return "direct";
  if (numeric >= 70) return "bridge";
  if (numeric >= 50) return "weak_experiment";
  return "unrelated";
}

function canonicalTitle(value = "") {
  return cleanText(value).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").replace(/(最新|热搜|热议|冲上热搜)$/g, "");
}

function grams(value) {
  const normalized = canonicalTitle(value);
  if (normalized.length < 2) return new Set([normalized]);
  return new Set([...Array(normalized.length - 1)].map((_, index) => normalized.slice(index, index + 2)));
}

export function titleSimilarity(left, right) {
  const a = canonicalTitle(left);
  const b = canonicalTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 5) return 0.86;
  const ga = grams(a);
  const gb = grams(b);
  const intersection = [...ga].filter((item) => gb.has(item)).length;
  return intersection / Math.max(1, ga.size + gb.size - intersection);
}

function parseDate(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function normalizeComments(comments, source) {
  return (Array.isArray(comments) ? comments : []).map((item, index) => ({
    id: String(item.id || item.commentId || `${source}_${index + 1}`),
    text: cleanText(item.content || item.text || item.comment || ""),
    author: cleanText(item.userName || item.nickname || item.author || ""),
    likes: Number(item.likeCount || item.likedCount || item.likes || 0),
    publishedAt: parseDate(item.publishTime || item.createTime || item.publishedAt),
    source,
    url: item.url || null,
    mode: "live"
  })).filter((item) => item.text).slice(0, 20);
}

function normalizeSignal(item, poolType) {
  const metrics = item.metrics || {};
  return {
    id: String(item.id || id("signal")),
    poolType,
    query: item.query || null,
    title: cleanText(item.title || item.snippet || "未命名热点"),
    summary: cleanText(item.snippet || item.summary || ""),
    url: item.url || null,
    rawUrl: item.rawUrl || null,
    coverUrl: item.coverUrl || null,
    source: item.source || "未知来源",
    sourceType: item.sourceType || (poolType === "keyword" ? "authorized_platform_search" : "public_hotlist"),
    platform: item.platform || "web",
    author: cleanText(item.author || ""),
    publishedAt: parseDate(item.publishedAt),
    capturedAt: parseDate(item.capturedAt) || new Date().toISOString(),
    rank: Number(item.rank) || null,
    hotValue: Number(item.hotValue) || 0,
    trend: item.trend || "unknown",
    metrics: {
      likes: Number(metrics.likes || 0), comments: Number(metrics.comments || 0), shares: Number(metrics.shares || 0),
      saves: Number(metrics.saves || 0), reads: Number(metrics.reads || 0)
    },
    comments: normalizeComments(item.comments, item.source || "未知来源"),
    relevance: item.relevance || null
  };
}

function withinWindow(signal, days) {
  if (!signal.publishedAt) return true;
  const age = Date.now() - new Date(signal.publishedAt).getTime();
  return age >= 0 && age <= Math.max(1, days) * 86400000;
}

function engagementTotal(signal) {
  const m = signal.metrics || {};
  return m.likes + m.comments * 2 + m.shares * 3 + m.saves * 2 + m.reads * 0.05 + signal.hotValue * 0.01;
}

function dedupeSignals(signals) {
  const seenUrls = new Set();
  const kept = [];
  for (const signal of signals) {
    const urlKey = signal.url?.replace(/[?#].*$/, "");
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (kept.some((item) => item.source === signal.source && titleSimilarity(item.title, signal.title) >= 0.92)) continue;
    if (urlKey) seenUrls.add(urlKey);
    kept.push(signal);
  }
  return kept;
}

export function clusterSignals(signals) {
  const clusters = [];
  for (const signal of signals) {
    let cluster = clusters.find((item) => titleSimilarity(item.title, signal.title) >= 0.58);
    if (!cluster) {
      cluster = { id: id("event"), title: signal.title, signals: [], queries: [] };
      clusters.push(cluster);
    }
    cluster.signals.push(signal);
    cluster.queries = unique([...cluster.queries, signal.query]);
    cluster.title = [...cluster.signals].sort((a, b) => engagementTotal(b) - engagementTotal(a))[0]?.title || cluster.title;
  }
  return clusters;
}

function scoreCluster(cluster, timeWindowDays = 7) {
  const sources = unique(cluster.signals.map((item) => item.source));
  const newestTime = cluster.signals.map((item) => item.publishedAt || item.capturedAt).filter(Boolean).sort().at(-1);
  const hours = newestTime ? Math.max(0, (Date.now() - new Date(newestTime).getTime()) / 3600000) : 72;
  const engagement = cluster.signals.reduce((sum, item) => sum + engagementTotal(item), 0);
  const relevanceScores = cluster.signals.map((item) => Number(item.relevance?.score)).filter(Number.isFinite);
  const windowHours = Math.max(24, Number(timeWindowDays || 7) * 24);
  const breakdown = {
    heat: clamp(35 + Math.log10(Math.max(1, engagement)) * 14),
    freshness: clamp(100 - (hours / windowHours) * 70),
    crossSource: clamp(35 + sources.length * 18),
    engagement: clamp(Math.log10(Math.max(1, engagement)) * 24),
    evidence: clamp(35 + cluster.signals.length * 9),
    relevance: relevanceScores.length ? clamp(relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length) : 100
  };
  const score = clamp(breakdown.heat * 0.2 + breakdown.freshness * 0.15 + breakdown.crossSource * 0.1 + breakdown.engagement * 0.15 + breakdown.evidence * 0.1 + breakdown.relevance * 0.3);
  return { score, breakdown, sources, newestTime };
}

function buildOpportunity(cluster, context) {
  const scored = scoreCluster(cluster, context.timeWindowDays);
  const sorted = [...cluster.signals].sort((a, b) => engagementTotal(b) - engagementTotal(a));
  const lead = sorted[0];
  const tier = relevanceTier(scored.breakdown.relevance, context.poolType);
  const comments = sorted.flatMap((item) => item.comments || []).sort((a, b) => b.likes - a.likes).slice(0, 30);
  return {
    id: id("opp"), eventId: cluster.id, poolType: context.poolType,
    directionId: context.poolType === "keyword" ? context.directionId || null : null,
    title: cluster.title, originalTitle: cluster.title,
    summary: lead.summary || `该事件由${scored.sources.join("、")}的实时信号组成，请打开来源复核。`,
    originalSummary: lead.summary || "", language: "zh-CN", translationStatus: "original",
    score: scored.score, relevanceScore: scored.breakdown.relevance,
    relevanceTier: tier,
    requiresSecondConfirmation: tier === "weak_experiment",
    trend: "rising",
    expiresInHours: context.poolType === "global" ? 24 : 72,
    sourceCount: scored.sources.length, signalCount: cluster.signals.length, status: "preview",
    lifecycle: "discovered",
    sourceUrl: lead.url || null,
    sourcePlatform: lead.platform || lead.source || "unknown",
    providerMode: context.providerMode || "unknown",
    providerTrace: {
      provider: context.provider || "unknown",
      mode: context.providerMode || "unknown",
      stage: "collection",
      collectedAt: context.collectedAt,
      warnings: context.warnings || []
    },
    keywords: context.poolType === "keyword" ? unique(cluster.queries) : [cluster.title],
    matchedKeywords: unique(cluster.signals.flatMap((item) => item.relevance?.matched || [])),
    relevanceReason: unique(cluster.signals.map((item) => item.relevance?.reason), 3).join("；"),
    whyHot: `${cluster.signals.length}条有效信号，覆盖${scored.sources.length}个来源；主题相关性${scored.breakdown.relevance}，综合热度${scored.score}。`,
    topicIdeas: [], productFits: [], risks: ["发布前打开来源核对事实与时间", "跨领域借势必须建立真实关联", "敏感事件需提高人工审核等级"],
    comments, commentQuestions: comments.map((item) => item.text).slice(0, 8),
    commentCapability: comments.length ? "collected" : "not_available",
    scoreBreakdown: scored.breakdown,
    sourceEvidence: sorted.slice(0, 8).map((item) => ({
      type: item.sourceType, source: item.source, sourcePlatform: item.platform || item.source, title: item.title, label: item.title,
      signal: item.rank ? `榜单第${item.rank}位${item.hotValue ? ` · 热度${item.hotValue}` : ""}` : `${engagementTotal(item).toFixed(0)}互动加权值`,
      url: item.url, rawUrl: item.rawUrl, publishedAt: item.publishedAt, capturedAt: item.capturedAt, mode: "live"
    })),
    collectedAt: context.collectedAt, newestSignalAt: scored.newestTime, createdAt: context.collectedAt
  };
}

const traditionalMap = new Map(Object.entries({ "臺": "台", "灣": "湾", "體": "体", "國": "国", "際": "际", "運": "运", "營": "营", "號": "号", "關": "关", "鍵": "键", "詞": "词", "熱": "热", "點": "点", "資": "资", "訊": "讯", "業": "业", "經": "经", "濟": "济", "與": "与", "為": "为", "發": "发", "現": "现", "後": "后", "務": "务", "動": "动", "會": "会", "場": "场", "學": "学" }));
const toSimplified = (value) => [...String(value || "")].map((char) => traditionalMap.get(char) || char).join("");
function fallbackCategory(value) {
  const text = String(value || "");
  if (/世界杯|足球|篮球|网球|比赛|联赛|冠军|运动员|体育|橄榄球/.test(text)) return "体育赛事";
  if (/AI|人工智能|科技|芯片|互联网|软件|机器人|手机/.test(text)) return "科技互联网";
  if (/股票|目标价|经济|公司|市场|金融|财经|商业/.test(text)) return "财经商业";
  if (/总统|首相|王储|战争|外交|国际|联合国|制裁/.test(text)) return "国际局势";
  if (/演唱会|电影|明星|说唱|综艺|音乐/.test(text)) return "文化娱乐";
  return "国内社会";
}

function diversifiedTop(items, limit) {
  const order = ["国内社会", "国际局势", "科技互联网", "财经商业", "体育赛事", "文化娱乐"];
  const groups = new Map(order.map((category) => [category, items.filter((item) => item.category === category)]));
  const result = [];
  let index = 0;
  while (result.length < limit && index < items.length) {
    let added = false;
    for (const category of order) {
      const item = groups.get(category)?.shift();
      if (item && result.length < limit) { result.push(item); added = true; }
    }
    if (!added) break;
    index += 1;
  }
  return result;
}

async function localizeOpportunities(opportunities, dependencies = {}) {
  if (!opportunities.length) return opportunities;
  const canUseModel = dependencies.generateText || providerStatus().model.configured;
  if (!canUseModel) return opportunities.map((item) => ({ ...item, title: toSimplified(item.title), summary: toSimplified(item.summary), category: fallbackCategory(item.title), translationStatus: "local_conversion" }));
  try {
    const invoke = dependencies.generateText || generateText;
    const result = await invoke({
      task: "translate_hotspot_cards_to_simplified_chinese",
      rules: ["忠实翻译，不增加事实", "中文繁体转为简体", "英文及其他语言翻译为自然简体中文", "专有名词可保留原文括注"],
      items: opportunities.map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
      categories: ["国内社会", "国际局势", "科技互联网", "财经商业", "体育赛事", "文化娱乐"],
      output_schema: { items: [{ id: "", titleZhCn: "", summaryZhCn: "", category: "" }] }
    }, { items: [] });
    const translated = new Map((result.data?.items || result.data?.data?.items || []).map((item) => [item.id, item]));
    return opportunities.map((item) => {
      const zh = translated.get(item.id);
      const title = cleanText(zh?.titleZhCn || toSimplified(item.title));
      return { ...item, title, summary: cleanText(zh?.summaryZhCn || toSimplified(item.summary)), category: zh?.category || fallbackCategory(title), translationStatus: zh ? "translated" : "local_conversion" };
    });
  } catch {
    return opportunities.map((item) => ({ ...item, title: toSimplified(item.title), summary: toSimplified(item.summary), category: fallbackCategory(item.title), translationStatus: "local_conversion" }));
  }
}

export async function runHotspotPipeline(payload = {}, store = {}, dependencies = {}) {
  const poolType = payload.poolType === "global" || payload.mode === "global" ? "global" : "keyword";
  const direction = (store.contentDirections || []).find((item) => item.id === payload.directionId) || {};
  const suppliedProfile = payload.keywordProfile || {};
  const profile = {
    ...suppliedProfile,
    coreKeywords: suppliedProfile.coreKeywords || suppliedProfile.keywords || payload.coreKeywords || direction.coreKeywords || payload.keywords || direction.keywords || [],
    platformKeywords: suppliedProfile.platformKeywords || payload.platformKeywords || direction.platformKeywords || [],
    scenarioKeywords: suppliedProfile.scenarioKeywords || payload.scenarioKeywords || direction.scenarioKeywords || [],
    excludeKeywords: suppliedProfile.excludeKeywords || payload.excludeKeywords || direction.excludeKeywords || []
  };
  const allKeywords = unique(payload.keywords?.length ? payload.keywords : [...profile.coreKeywords, ...profile.scenarioKeywords, ...profile.platformKeywords], 24);
  const primaryKeywords = unique([...(profile.coreKeywords || []), ...(profile.scenarioKeywords || [])], 10);
  const keywords = primaryKeywords.length ? primaryKeywords : allKeywords.slice(0, 10);
  const secondaryKeywords = allKeywords.filter((item) => !keywords.includes(item)).slice(0, 12);
  if (poolType === "keyword" && !keywords.length) throw new Error("关键词热点采集至少需要一个关键词");
  const timeWindowDays = Math.max(1, Number(payload.timeWindowDays) || (poolType === "global" ? 1 : 7));
  const collectedAt = new Date().toISOString();
  const targetCount = Math.min(Math.max(Number(payload.targetOpportunityCount || payload.maxOpportunities) || (poolType === "keyword" ? 10 : 20), 1), 30);
  const collector = dependencies.collectSearchSignals || collectSearchSignals;
  const collectionRounds = [];
  let collected = poolType === "global"
    ? await (dependencies.collectGlobalHotspots || collectGlobalHotspots)({ limit: payload.limit || 40, sources: payload.globalSources, timeWindowDays })
    : await collector({ keywords, timeWindowDays, platforms: payload.platforms || ["douyin", "xiaohongshu", "wechat"], pages: payload.pages || 2, pageSize: payload.pageSize || 20 });
  if (payload.requireLive && collected.mode !== "live") {
    const error = new Error(`真实热点采集要求 live Provider，当前模式为 ${collected.mode || "unknown"}`);
    error.code = "HOTSPOT_PROVIDER_NOT_LIVE";
    throw error;
  }
  collectionRounds.push({ round: 1, keywords, collected: collected.items?.length || 0, mode: "core_and_scenario" });
  let normalized = (collected.items || []).map((item) => normalizeSignal(item, poolType));
  let timely = normalized.filter((item) => withinWindow(item, timeWindowDays));
  let relevance = poolType === "keyword"
    ? await filterRelevantSignals(timely, profile, { generateText: dependencies.generateText, threshold: payload.relevanceThreshold || 70 })
    : { accepted: timely, rejected: [], threshold: null };
  let deduped = dedupeSignals(relevance.accepted);
  let clusters = clusterSignals(deduped);
  if (poolType === "keyword" && clusters.length < targetCount && Number(payload.maxCollectionRounds || 2) > 1) {
    const roundKeywords = secondaryKeywords.length ? secondaryKeywords : keywords;
    const second = await collector({ keywords: roundKeywords, timeWindowDays, platforms: payload.platforms || ["douyin", "xiaohongshu", "wechat"], pages: 1, pageStart: secondaryKeywords.length ? 1 : Math.min(3, Number(payload.pages || 2) + 1), pageSize: payload.pageSize || 20 });
    collectionRounds.push({ round: 2, keywords: roundKeywords, collected: second.items?.length || 0, mode: secondaryKeywords.length ? "platform_and_remaining" : "deeper_page" });
    collected = { ...collected, items: [...(collected.items || []), ...(second.items || [])], warnings: unique([...(collected.warnings || []), ...(second.warnings || [])]), sources: unique([...(collected.sources || []), ...(second.sources || [])]) };
    normalized = collected.items.map((item) => normalizeSignal(item, poolType));
    timely = normalized.filter((item) => withinWindow(item, timeWindowDays));
    relevance = await filterRelevantSignals(timely, profile, { generateText: dependencies.generateText, threshold: payload.relevanceThreshold || 70 });
    deduped = dedupeSignals(relevance.accepted);
    clusters = clusterSignals(deduped);
  }
  const providerName = poolType === "global" ? "public_hotlists" : "redfox_search";
  let opportunities = clusters.map((cluster) => buildOpportunity(cluster, {
    poolType,
    directionId: payload.directionId,
    collectedAt,
    timeWindowDays,
    provider: providerName,
    providerMode: collected.mode,
    warnings: collected.warnings || []
  }))
    .sort((a, b) => b.score - a.score).slice(0, 40);
  const qualityRejected = poolType === "keyword" ? opportunities.filter((item) => item.score < (Number(payload.minimumHotspotScore) || 55)) : [];
  if (poolType === "keyword") opportunities = opportunities.filter((item) => item.score >= (Number(payload.minimumHotspotScore) || 55));
  opportunities = await localizeOpportunities(opportunities, dependencies);
  let historicalAdded = 0;
  if (poolType === "global" && timeWindowDays > 1) {
    const cutoff = Date.now() - timeWindowDays * 86400000;
    const seenTitles = new Set(opportunities.map((item) => canonicalTitle(item.originalTitle || item.title)));
    const historical = (store.hotspotLibrary || []).filter((item) => {
      const timestamp = new Date(item.lastSeenAt || item.collectedAt || item.createdAt || 0).getTime();
      return item.poolType === "global" && item.status !== "ignored" && timestamp >= cutoff && !seenTitles.has(canonicalTitle(item.originalTitle || item.title));
    }).sort((a, b) => new Date(b.lastSeenAt || b.collectedAt || 0) - new Date(a.lastSeenAt || a.collectedAt || 0));
    const reserve = Math.min(historical.length, Math.ceil(targetCount * 0.4));
    opportunities = diversifiedTop(opportunities, targetCount - reserve);
    const additions = historical.slice(0, reserve).map((item) => ({ ...item, status: "preview", fromHistoricalSnapshot: true }));
    historicalAdded = additions.length;
    opportunities.push(...additions);
  } else opportunities = poolType === "global" ? diversifiedTop(opportunities, targetCount) : opportunities.slice(0, targetCount);
  const warnings = unique(collected.warnings || []);
  const stats = {
    collected: normalized.length, timely: timely.length, relevancePassed: relevance.accepted.length,
    relevanceRejected: relevance.rejected.length, deduped: deduped.length, clusters: clusters.length,
    opportunities: opportunities.length, target: targetCount, shortfall: Math.max(0, targetCount - opportunities.length), qualityRejected: qualityRejected.length,
    qualityRejectedSamples: qualityRejected.slice(0, 8).map((item) => ({ title: item.title, score: item.score, relevanceScore: item.relevanceScore, freshness: item.scoreBreakdown?.freshness })), historicalAdded
  };
  const stages = [
    { id: "collect", name: "实时采集", status: "succeeded", count: normalized.length, note: poolType === "global" ? "无关键词公开榜源" : `${collectionRounds.length}轮自适应搜索 · ${unique(collectionRounds.flatMap((item) => item.keywords)).length}个关键词` },
    { id: "normalize", name: "字段与中文标准化", status: "succeeded", count: normalized.length, note: "统一来源、时间、热度和中文展示" },
    { id: "relevance", name: "主题相关性", status: "succeeded", count: relevance.accepted.length, note: poolType === "keyword" ? `淘汰${relevance.rejected.length}条低相关内容` : "全网池不执行主题过滤" },
    { id: "dedupe", name: "去重与时效", status: "succeeded", count: deduped.length, note: `去除${relevance.accepted.length - deduped.length}条重复内容` },
    { id: "cluster", name: "真实事件聚类", status: "succeeded", count: clusters.length, note: "按事件标题与内容相似度聚类，不按查询词强制合并" },
    { id: "score", name: "热点评分", status: "succeeded", count: opportunities.length, note: `相关性、热度、时效、互动与证据；淘汰${qualityRejected.length}个低质量结果` }
  ];
  const run = {
    id: id("hotrun"), status: "preview_ready", mode: collected.mode, poolType,
    directionId: poolType === "keyword" ? payload.directionId || null : null,
    keywords: unique(collectionRounds.flatMap((item) => item.keywords)), keywordProfile: profile, collectionRounds, timeWindowDays, stats, sources: collected.sources || [], warnings,
    providerTrace: {
      provider: providerName,
      mode: collected.mode || "unknown",
      stage: "collection",
      collectedAt,
      warnings
    },
    stages, opportunityIds: opportunities.map((item) => item.id), createdAt: collectedAt, completedAt: new Date().toISOString()
  };
  return { run, opportunities, rejectedByRelevance: relevance.rejected.slice(0, 50), rejectedByQuality: qualityRejected.slice(0, 30), warnings };
}
