import { getProviderConfig } from "./provider-config.mjs";
import { getLlmRuntimeStatus, invokeLlm } from "./llm/gateway.mjs";

const defaultTimeout = 30000;

async function fetchJson(url, options = {}, timeoutMs = defaultTimeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || body.error || `Provider error ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}, timeoutMs = defaultTimeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    if (!response.ok) throw new Error(`Hotspot source error ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export function providerStatus() {
  const config = getProviderConfig();
  const modelRuntime = getLlmRuntimeStatus();
  return {
    model: {
      configured: Boolean(config.FLOW_MODEL_API_KEY && config.FLOW_MODEL_BASE_URL && config.FLOW_MODEL_NAME),
      provider: config.FLOW_MODEL_PROVIDER,
      model: config.FLOW_MODEL_NAME,
      connectionState: modelRuntime.connectionState,
      runtimeStartedAt: modelRuntime.runtimeStartedAt,
      lastSuccessAt: modelRuntime.lastSuccessAt,
      lastFailureAt: modelRuntime.lastFailureAt,
      lastError: modelRuntime.lastError,
      lastFailure: modelRuntime.lastFailure,
      recentCalls: modelRuntime.recentCalls,
      recentFailures: modelRuntime.recentFailures,
      tasks: modelRuntime.tasks
    },
    search: { configured: Boolean(config.REDFOX_API_KEY && config.REDFOX_BASE_URL), provider: config.FLOW_SEARCH_PROVIDER, commentCapability: "provider_inline_only" },
    image: { configured: Boolean(config.KIE_API_KEY && config.KIE_BASE_URL && config.KIE_IMAGE_MODEL), provider: config.FLOW_IMAGE_PROVIDER },
    publishing: { configured: false, provider: "Platform adapters" }
  };
}

function providerControlError(code, message) {
  return Object.assign(new Error(message || code), { code, statusCode: 409 });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  return isPlainObject(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function validateAtomicLiveInvocation(payload, control) {
  if (!exactKeys(control, ["liveInvocation"])) {
    throw providerControlError("ATOMIC_PROVIDER_LIVE_INVOCATION_REQUIRED", "Atomic Provider calls require the exact server-owned Live invocation control envelope");
  }
  const identity = control.liveInvocation;
  if (!exactKeys(identity, ["ordinal", "capability", "platform", "stepId"])
    || !Number.isSafeInteger(identity.ordinal) || identity.ordinal < 1
    || ![identity.capability, identity.platform, identity.stepId].every((value) => typeof value === "string" && value.trim() === value && value.length > 0)) {
    throw providerControlError("ATOMIC_PROVIDER_LIVE_INVOCATION_INVALID", "Atomic Provider Live invocation identity is incomplete or malformed");
  }
  const requestedCapability = payload?.skill_runtime?.skill_name;
  if (requestedCapability !== identity.capability) {
    throw providerControlError("ATOMIC_PROVIDER_LIVE_INVOCATION_MISMATCH", "Atomic Provider Live invocation capability does not match the formal Skill request");
  }
  return Object.freeze({ ...identity });
}

export function createProviderTextGenerator({ invoke = invokeLlm } = {}) {
  if (typeof invoke !== "function") throw new TypeError("Provider text generator requires an LLM gateway");
  return async function providerTextGenerator(payload, fallback) {
    return invoke({ task: payload?.task || "unclassified", payload, fallback, contract: payload?.contract || null, maxAttempts: 2 });
  };
}

export function createAtomicProviderTextGenerator({ invoke = invokeLlm } = {}) {
  if (typeof invoke !== "function") throw new TypeError("Atomic Provider text generator requires an LLM gateway");
  return async function atomicProviderTextGenerator(payload, control) {
    const liveInvocation = validateAtomicLiveInvocation(payload, control);
    const result = await invoke({
      task: payload?.task || "unclassified",
      payload,
      fallback: null,
      contract: payload?.contract || null,
      maxAttempts: 1
    });
    const reportedAttempts = Number(result?.telemetry?.attempts);
    const reportedRetryCount = Number(result?.telemetry?.retryCount);
    if ((Number.isFinite(reportedAttempts) && reportedAttempts > 1)
      || (Number.isFinite(reportedRetryCount) && reportedRetryCount !== 0)) {
      throw providerControlError("ATOMIC_PROVIDER_RETRY_BUDGET_VIOLATION", "Atomic Provider Gateway exceeded the single-attempt budget");
    }
    return {
      ...result,
      telemetry: {
        ...(result?.telemetry || {}),
        liveInvocation,
        maxAttempts: 1,
        automaticRetries: 0
      }
    };
  };
}

const defaultTextGenerator = createProviderTextGenerator();
const atomicTextGenerator = createAtomicProviderTextGenerator();

export async function generateText(payload, fallback) {
  return defaultTextGenerator(payload, fallback);
}

export async function generateAtomicText(payload, control) {
  return atomicTextGenerator(payload, control);
}

const redfoxPlatformConfig = {
  douyin: { pathKey: "REDFOX_DOUYIN_SEARCH_PATH", source: "抖音", sortType: "_4" },
  xiaohongshu: { pathKey: "REDFOX_XHS_SEARCH_PATH", source: "小红书", sortType: "default" },
  wechat: { pathKey: "REDFOX_WECHAT_SEARCH_PATH", source: "微信公众号", sortType: "_0" }
};

function normalizeRedfoxItem(item, source) {
  const rawPublishedAt = item.workPublishTime || item.publishTime || item.gmtCreate || item.createTime;
  const publishedAt = /^\d{10,13}$/.test(String(rawPublishedAt || ""))
    ? new Date(Number(rawPublishedAt) * (String(rawPublishedAt).length === 10 ? 1000 : 1)).toISOString()
    : rawPublishedAt || null;
  return {
    id: item.workId || item.photoId || item.uuid || item.id,
    title: item.title || item.workTitle || item.content?.slice(0, 80) || "平台热点内容",
    snippet: item.content || item.workDesc || item.desc || item.summary || "",
    url: item.workUrl || item.url || item.articleUrl || item.link,
    coverUrl: item.coverUrl || item.cover,
    publishedAt,
    source,
    author: item.accountName || item.accountNickname || item.userName || item.nickname,
    metrics: {
      likes: Number(item.workLikedCount || item.likeCount || 0),
      comments: Number(item.workCommentsCount || item.commentCount || 0),
      shares: Number(item.workSharedCount || item.shareCount || item.repostCount || 0),
      saves: Number(item.workCollectedCount || item.collectCount || 0),
      reads: Number(item.workReadedCount || item.readCount || 0)
    },
    comments: Array.isArray(item.commentList) ? item.commentList : Array.isArray(item.comments) ? item.comments : [],
    raw: item
  };
}

export async function collectSearchSignals(payload) {
  const status = providerStatus().search;
  if (!status.configured) return { mode: "demo", items: [] };
  const config = getProviderConfig();
  const keywords = [...new Set((payload.keywords || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
  const platforms = (payload.platforms || Object.keys(redfoxPlatformConfig)).filter((item) => redfoxPlatformConfig[item]);
  const pageSize = Math.min(Math.max(Number(payload.pageSize) || 20, 10), 50);
  const pages = Math.min(Math.max(Number(payload.pages) || 1, 1), 3);
  const pageStart = Math.min(Math.max(Number(payload.pageStart) || 1, 1), 20);
  const requests = platforms.flatMap((platform) => keywords.flatMap((keyword) => Array.from({ length: pages }, (_, pageIndex) => (async () => {
    const platformConfig = redfoxPlatformConfig[platform];
    const endpoint = `${config.REDFOX_BASE_URL.replace(/\/$/, "")}${config[platformConfig.pathKey]}`;
    const response = await fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", REDFOX_API_KEY: config.REDFOX_API_KEY },
      body: JSON.stringify({ keyword, offset: (pageStart + pageIndex - 1) * pageSize, pageNum: pageStart + pageIndex, pageSize, sortType: platformConfig.sortType })
    }, 45000);
    if (response.code !== 2000) throw new Error(response.msg || `RedFox error ${response.code}`);
    const list = response.data?.list || response.data?.records || [];
    return list.map((item) => ({ ...normalizeRedfoxItem(item, platformConfig.source), query: keyword, platform, page: pageStart + pageIndex }));
  })())));
  const settled = await Promise.allSettled(requests);
  const items = settled.filter((result) => result.status === "fulfilled").flatMap((result) => result.value);
  const errors = settled.filter((result) => result.status === "rejected").map((result) => result.reason?.message || "RedFox request failed");
  if (!items.length && errors.length) throw new Error(errors[0]);
  return { mode: "live", items, warnings: [...new Set(errors)] };
}

function decodeXml(value = "") {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function xmlTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1] || "");
}

async function collectBaiduHotList(limit) {
  const sourceUrl = "https://top.baidu.com/board?tab=realtime";
  const html = await fetchText(sourceUrl, { headers: { "User-Agent": "Mozilla/5.0 FlowSocial/0.3" } }, 20000);
  const objects = html.match(/\{"appUrl":[^{}]*?"word":"(?:\\.|[^"])*"(?:,"isTop":(?:true|false))?\}/g) || [];
  const items = [];
  for (const raw of objects) {
    try {
      const item = JSON.parse(raw);
      if (!item.query || items.some((existing) => existing.title === item.query)) continue;
      items.push({
        id: `baidu_${items.length + 1}`,
        title: item.query,
        snippet: item.desc || "",
        url: item.rawUrl || item.url || sourceUrl,
        coverUrl: item.img || null,
        publishedAt: null,
        capturedAt: new Date().toISOString(),
        source: "百度热搜",
        sourceType: "public_hotlist",
        platform: "web",
        rank: items.length + 1,
        hotValue: Number(item.hotScore || 0),
        trend: item.hotChange || "same",
        metrics: {},
        raw: { hotTag: item.hotTag, isTop: item.isTop }
      });
      if (items.length >= limit) break;
    } catch {
      // Ignore malformed embedded entries and keep parsing the public board.
    }
  }
  if (!items.length) throw new Error("百度热搜页面未解析出榜单数据");
  return items;
}

async function collectToutiaoHotList(limit) {
  const sourceUrl = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc";
  const response = await fetchJson(sourceUrl, { headers: { "User-Agent": "Mozilla/5.0 FlowSocial/0.3", Referer: "https://www.toutiao.com/" } }, 20000);
  return (response.data || []).slice(0, limit).map((item, index) => ({
    id: `toutiao_${item.ClusterIdStr || index + 1}`,
    title: item.Title || item.Label || "",
    snippet: item.Brief || item.LabelDesc || "",
    url: item.Url || (item.ClusterIdStr ? `https://www.toutiao.com/trending/${item.ClusterIdStr}/` : sourceUrl),
    coverUrl: item.Image?.url || item.ImageUrl || null,
    publishedAt: null,
    capturedAt: new Date().toISOString(),
    source: "今日头条热榜",
    sourceType: "public_hotlist",
    platform: "web",
    rank: index + 1,
    hotValue: Number(item.HotValue || 0),
    trend: "trending",
    metrics: {}, raw: { label: item.Label }
  })).filter((item) => item.title);
}

async function collectZhihuHotList(limit) {
  const sourceUrl = `https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=${Math.min(limit, 50)}&desktop=true`;
  const response = await fetchJson(sourceUrl, { headers: { "User-Agent": "Mozilla/5.0 FlowSocial/0.3", Referer: "https://www.zhihu.com/hot" } }, 20000);
  return (response.data || []).slice(0, limit).map((item, index) => ({
    id: `zhihu_${item.id || item.target?.id || index + 1}`,
    title: item.target?.title || item.target?.question?.title || "",
    snippet: item.target?.excerpt || item.target?.description || "",
    url: item.target?.url?.replace("api.zhihu.com/questions", "www.zhihu.com/question") || "https://www.zhihu.com/hot",
    coverUrl: item.children?.[0]?.thumbnail || null,
    publishedAt: null,
    capturedAt: new Date().toISOString(),
    source: "知乎热榜",
    sourceType: "public_hotlist",
    platform: "web",
    rank: index + 1,
    hotValue: Number(String(item.detail_text || "").replace(/[^\d]/g, "")) || 0,
    trend: "trending", metrics: {}, raw: { detailText: item.detail_text }
  })).filter((item) => item.title);
}

async function collectGoogleTrends(geo, limit) {
  const sourceUrl = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  const xml = await fetchText(sourceUrl, { headers: { "User-Agent": "Mozilla/5.0 FlowSocial/0.3" } }, 20000);
  const entries = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return entries.slice(0, limit).map((entry, index) => {
    const title = xmlTag(entry, "title");
    const trafficText = xmlTag(entry, "ht:approx_traffic");
    const newsTitle = xmlTag(entry, "ht:news_item_title");
    const newsSnippet = xmlTag(entry, "ht:news_item_snippet");
    const newsUrl = xmlTag(entry, "ht:news_item_url");
    return {
      id: `google_${geo.toLowerCase()}_${index + 1}`,
      title,
      snippet: newsSnippet || newsTitle || xmlTag(entry, "description"),
      url: newsUrl || `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=${encodeURIComponent(geo)}`,
      rawUrl: sourceUrl,
      coverUrl: xmlTag(entry, "ht:picture") || null,
      publishedAt: xmlTag(entry, "pubDate") || null,
      capturedAt: new Date().toISOString(),
      source: `Google Trends ${geo}`,
      sourceType: "public_trends_rss",
      platform: "web",
      rank: index + 1,
      hotValue: Number(trafficText.replace(/[^\d]/g, "")) || 0,
      trend: "trending",
      metrics: {},
      raw: { trafficText }
    };
  }).filter((item) => item.title);
}

export async function collectGlobalHotspots(payload = {}) {
  const limit = Math.min(Math.max(Number(payload.limit) || 30, 5), 50);
  const enabled = new Set(payload.sources?.length ? payload.sources : ["baidu", "toutiao", "google_hk", "google_tw", "google_us", "google_gb"]);
  const adapters = [
    ["baidu", () => collectBaiduHotList(limit)],
    ["toutiao", () => collectToutiaoHotList(limit)],
    ["zhihu", () => collectZhihuHotList(limit)],
    ["google_hk", () => collectGoogleTrends("HK", limit)],
    ["google_tw", () => collectGoogleTrends("TW", limit)],
    ["google_us", () => collectGoogleTrends("US", limit)],
    ["google_gb", () => collectGoogleTrends("GB", limit)],
    ["google_jp", () => collectGoogleTrends("JP", limit)]
  ].filter(([id]) => enabled.has(id));
  const settled = await Promise.allSettled(adapters.map(([, collect]) => collect()));
  const items = settled.filter((result) => result.status === "fulfilled").flatMap((result) => result.value);
  const warnings = settled.map((result, index) => result.status === "rejected" ? `${adapters[index][0]}: ${result.reason?.message || "采集失败"}` : null).filter(Boolean);
  if (!items.length) throw new Error(warnings[0] || "没有可用的无关键词热点来源");
  return { mode: "live", poolType: "global", items, warnings, sources: adapters.map(([id], index) => ({ id, status: settled[index].status === "fulfilled" ? "succeeded" : "failed", count: settled[index].status === "fulfilled" ? settled[index].value.length : 0 })) };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateImage(payload) {
  const status = providerStatus().image;
  if (!status.configured) return { mode: "demo", status: "not_configured", prompt: payload.prompt };
  const config = getProviderConfig();
  const baseUrl = config.KIE_BASE_URL.replace(/\/$/, "");
  const response = await fetchJson(`${baseUrl}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.KIE_API_KEY}` },
    body: JSON.stringify({
      model: payload.model || config.KIE_IMAGE_MODEL,
      input: {
        prompt: payload.prompt,
        aspect_ratio: payload.aspectRatio || payload.aspect_ratio || "3:4",
        quality: payload.quality || config.KIE_IMAGE_QUALITY,
        nsfw_checker: true
      }
    })
  }, 60000);
  const taskId = response.data?.taskId;
  if (response.code !== 200 || !taskId) throw new Error(response.msg || "Kie.ai did not return a taskId");
  const deadline = Date.now() + 10 * 60 * 1000;
  let interval = 2000;
  while (Date.now() < deadline) {
    await wait(interval);
    const record = await fetchJson(`${baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${config.KIE_API_KEY}` }
    }, 30000);
    const state = record.data?.state;
    if (state === "success") {
      const result = JSON.parse(record.data?.resultJson || "{}");
      return { mode: "live", status: "succeeded", taskId, urls: result.resultUrls || [], imageUrl: result.resultUrls?.[0] || null, provider: "Kie.ai", model: record.data?.model || config.KIE_IMAGE_MODEL, quality: payload.quality || config.KIE_IMAGE_QUALITY, referenceImagesUsed: false };
    }
    if (state === "fail") throw new Error(record.data?.failMsg || "Kie.ai image generation failed");
    interval = Math.min(Math.round(interval * 1.5), 10000);
  }
  throw new Error("Kie.ai image generation timed out");
}
