import { createHash, randomUUID } from "node:crypto";
import { recordPublication, recordPublicationMetrics } from "./content-agent/publishing-feedback.mjs";

const API_BASE = "https://api.weixin.qq.com";
const tokenCache = new Map();
const list = (value) => Array.isArray(value) ? value : [];

function apiError(payload, operation) {
  if (!payload || !Number(payload.errcode)) return null;
  const error = new Error(`微信${operation}失败：${payload.errmsg || payload.errcode}`);
  error.statusCode = 502;
  error.code = `WECHAT_${payload.errcode}`;
  return error;
}

async function jsonRequest(url, options = {}, operation = "接口请求", fetchImpl = fetch) {
  const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`微信${operation}失败：HTTP ${response.status}`), { statusCode: 502 });
  const error = apiError(payload, operation);
  if (error) throw error;
  return payload;
}

async function accessToken(config, force = false, fetchImpl = fetch) {
  const cached = tokenCache.get(config.appId);
  if (!force && cached && cached.expiresAt > Date.now() + 120_000) return cached.value;
  const query = new URLSearchParams({ grant_type: "client_credential", appid: config.appId, secret: config.appSecret });
  const payload = await jsonRequest(`${API_BASE}/cgi-bin/token?${query}`, {}, "连接认证", fetchImpl);
  if (!payload.access_token) throw Object.assign(new Error("微信连接认证未返回 access_token"), { statusCode: 502 });
  tokenCache.set(config.appId, { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 7200) * 1000 });
  return payload.access_token;
}

export async function uploadWechatImageResource(config, resource, { fetchImpl = fetch } = {}) {
  const operation = String(resource?.operation || "");
  const endpoint = operation === "wechat_permanent_material_upload_for_thumb_media_id"
    ? "/cgi-bin/material/add_material"
    : operation === "wechat_uploadimg_for_https_body_url"
      ? "/cgi-bin/media/uploadimg"
      : null;
  if (!endpoint) throw Object.assign(new Error("Unsupported WeChat image upload operation"), { code: "ATOMIC_WECHAT_UPLOAD_OPERATION_UNSUPPORTED", statusCode: 400 });
  const bytes = Buffer.isBuffer(resource?.bytes) ? resource.bytes : resource?.bytes instanceof Uint8Array ? Buffer.from(resource.bytes) : null;
  if (!bytes?.length) throw Object.assign(new Error("WeChat image upload bytes are required"), { code: "ATOMIC_WECHAT_UPLOAD_BYTES_REQUIRED", statusCode: 400 });
  const contentType = String(resource?.contentType || "").trim();
  if (!/^image\/(png|jpeg|gif|webp)$/.test(contentType)) throw Object.assign(new Error("Unsupported WeChat image content type"), { code: "ATOMIC_WECHAT_UPLOAD_ASSET_TYPE_INVALID", statusCode: 400 });
  const token = await accessToken(config, false, fetchImpl);
  const query = new URLSearchParams({ access_token: token });
  if (operation === "wechat_permanent_material_upload_for_thumb_media_id") query.set("type", "image");
  const form = new FormData();
  form.append("media", new Blob([bytes], { type: contentType }), String(resource?.filename || "image"));
  const payload = await jsonRequest(`${API_BASE}${endpoint}?${query}`, { method: "POST", body: form }, "image upload", fetchImpl);
  if (operation === "wechat_permanent_material_upload_for_thumb_media_id") {
    if (!payload.media_id) throw Object.assign(new Error("WeChat permanent material upload did not return media_id"), { code: "ATOMIC_WECHAT_UPLOAD_COVER_MEDIA_ID_REQUIRED", statusCode: 502 });
    return { mediaId: String(payload.media_id) };
  }
  if (!payload.url) throw Object.assign(new Error("WeChat body image upload did not return url"), { code: "ATOMIC_WECHAT_UPLOAD_INLINE_URL_REQUIRED", statusCode: 502 });
  return { url: String(payload.url) };
}

export async function createWechatDraft(config, draft, { fetchImpl = fetch } = {}) {
  const token = await accessToken(config, false, fetchImpl);
  const article = {
    title: String(draft?.title || "").trim(),
    author: String(draft?.author || "").trim(),
    digest: String(draft?.digest || "").trim(),
    content: String(draft?.content || ""),
    content_source_url: String(draft?.contentSourceUrl || "").trim(),
    thumb_media_id: String(draft?.thumbMediaId || "").trim(),
    need_open_comment: Number(draft?.needOpenComment || 0),
    only_fans_can_comment: Number(draft?.onlyFansCanComment || 0)
  };
  if (!article.title || !article.content || !article.thumb_media_id) {
    throw Object.assign(new Error("WeChat draft title, content, and thumb_media_id are required"), { code: "ATOMIC_WECHAT_DRAFT_PAYLOAD_REQUIRED", statusCode: 400 });
  }
  const query = new URLSearchParams({ access_token: token });
  let payload;
  try {
    payload = await jsonRequest(`${API_BASE}/cgi-bin/draft/add?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ articles: [article] })
    }, "draft creation", fetchImpl);
  } catch (error) {
    if (String(error?.code || "").startsWith("WECHAT_")) throw error;
    throw Object.assign(new Error(`WeChat draft result is unknown: ${error?.message || "request failed"}`), {
      code: "WECHAT_DRAFT_RESULT_UNKNOWN", statusCode: 503, effectUnknown: true, cause: error
    });
  }
  if (!payload.media_id) throw Object.assign(new Error("WeChat draft result is unknown because media_id is missing"), {
    code: "WECHAT_DRAFT_RESULT_UNKNOWN", statusCode: 503, effectUnknown: true
  });
  return { mediaId: String(payload.media_id) };
}

async function datacube(token, endpoint, beginDate, endDate) {
  return jsonRequest(`${API_BASE}/datacube/${endpoint}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ begin_date: beginDate, end_date: endDate })
  }, `数据同步（${endpoint}）`);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function syncDates(days) {
  const result = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    result.push(isoDate(date));
  }
  return result;
}

function dateChunks(dates, size = 7) {
  const chunks = [];
  for (let index = 0; index < dates.length; index += size) chunks.push(dates.slice(index, index + size));
  return chunks;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizedTitle(value) {
  return String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function taskTitle(task = {}) {
  return task.currentContent?.post_copy?.recommended_title || task.currentContent?.recommended_title || task.ideaTitle || "";
}

function stableId(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function measurementWindow(refDate) {
  const ageDays = Math.max(1, Math.ceil((Date.now() - new Date(`${refDate}T00:00:00Z`).getTime()) / 86_400_000));
  if (ageDays <= 3) return "72h";
  if (ageDays <= 7) return "7d";
  return "final";
}

function latestDetail(details) {
  return [...details].sort((left, right) => String(left.stat_date || "").localeCompare(String(right.stat_date || ""))).at(-1) || {};
}

function normalizeArticle(item) {
  const details = list(item.detail_list);
  const detail = latestDetail(details);
  return {
    refDate: item.ref_date,
    msgId: String(item.msgid || item.msg_id || ""),
    title: String(item.title || "未命名公众号文章"),
    contentUrl: String(item.content_url || ""),
    publishType: number(item.publish_type),
    readUsers: number(detail.read_user),
    shareUsers: number(detail.share_user),
    favorites: number(detail.collection_user),
    likes: number(detail.like_user),
    watchingUsers: number(detail.zaikan_user),
    comments: number(detail.comment_count),
    subscribedReaders: number(detail.read_subscribe_user),
    readDeliveryRate: number(detail.read_delivery_rate),
    readFinishRate: number(detail.read_finish_rate),
    averageActiveTime: number(detail.read_avg_activetime),
    praiseMoney: number(detail.praise_money),
    readSources: list(detail.read_user_source),
    readJumpPositions: list(detail.read_jump_position),
    detailDates: details.map((detail) => detail.stat_date).filter(Boolean)
  };
}

function findPublication(store, accountId, article) {
  const publications = list(store.contentPublications).filter((item) => item.accountId === accountId && item.platform === "wechat");
  const byId = publications.find((item) => item.platformContentId === article.msgId || item.sourceMetadata?.wechatMsgId === article.msgId);
  if (byId) return byId;
  return publications.find((item) => article.contentUrl && (item.url === article.contentUrl || item.sourceMetadata?.contentUrl === article.contentUrl)) || null;
}

function createImportedTask(store, account, article) {
  const task = {
    id: `content_wechat_import_${stableId(`${account.id}:${article.msgId || article.title}:${article.refDate}`)}`,
    schemaVersion: "1.0",
    workspaceId: account.workspaceId || "workspace_default",
    companyId: account.companyId || null,
    socialAccountId: account.id,
    accountId: account.id,
    platform: "wechat",
    status: "succeeded",
    sourceType: "platform_history_import",
    ideaTitle: article.title,
    currentContent: { recommended_title: article.title, article_markdown: "" },
    contentIdentity: { topic: article.title, sourceIds: [] },
    version: 1,
    createdAt: `${article.refDate}T00:00:00.000Z`,
    updatedAt: new Date().toISOString()
  };
  store.contentTasks ||= [];
  store.contentTasks.push(task);
  return task;
}

function upsertArticle(store, account, article) {
  let publication = findPublication(store, account.id, article);
  let imported = false;
  if (!publication) {
    const task = createImportedTask(store, account, article);
    imported = true;
    publication = recordPublication(store, task, {
      platform: "wechat",
      status: "published",
      publishedAt: `${article.refDate}T00:00:00.000Z`,
      adoptionStatus: "historical_import",
      note: "由微信公众号官方数据接口导入；未使用标题自动绑定"
    });
  }
  publication.platformContentId = article.msgId || publication.platformContentId || null;
  publication.sourceMetadata = { ...(publication.sourceMetadata || {}), provider: "wechat_official_api", apiVersion: "published_content_v2", wechatMsgId: article.msgId || null, refDate: article.refDate, title: article.title, contentUrl: article.contentUrl || null, publishType: article.publishType };
  const syncKey = `wechat:${article.msgId || stableId(article.title)}:${article.refDate}:${article.detailDates.at(-1) || article.refDate}`;
  const payload = {
    views: article.readUsers,
    likes: article.likes,
    saves: article.favorites,
    comments: article.comments,
    shares: article.shareUsers,
    platformMetrics: {
      opens: article.readUsers,
      readers: article.readUsers,
      shareUsers: article.shareUsers,
      watchingUsers: article.watchingUsers,
      subscribedReaders: article.subscribedReaders,
      readDeliveryRate: article.readDeliveryRate,
      readFinishRate: article.readFinishRate,
      averageActiveTime: article.averageActiveTime,
      praiseMoney: article.praiseMoney,
      readSources: article.readSources,
      readJumpPositions: article.readJumpPositions
    },
    measurementWindow: measurementWindow(article.refDate),
    windowStartedAt: `${article.refDate}T00:00:00.000Z`,
    windowEndedAt: `${article.detailDates.at(-1) || article.refDate}T23:59:59.999Z`,
    source: "wechat_official_api",
    sourceMetadata: { syncKey, provider: "wechat_official_api", apiVersion: "published_content_v2", wechatMsgId: article.msgId || null, refDate: article.refDate, title: article.title, contentUrl: article.contentUrl || null }
  };
  const snapshot = recordPublicationMetrics(publication, payload);
  return { publication, snapshot, imported };
}

function upsertAccountSnapshots(store, accountId, summaryItems, cumulateItems) {
  store.platformAccountSnapshots ||= [];
  const byDate = new Map();
  for (const item of summaryItems) {
    const date = item.ref_date;
    if (!date) continue;
    const current = byDate.get(date) || { refDate: date, newFollowers: 0, unfollows: 0, followerCount: null, sourceBreakdown: [] };
    current.newFollowers += number(item.new_user);
    current.unfollows += number(item.cancel_user);
    current.sourceBreakdown.push({ source: item.user_source ?? null, newFollowers: number(item.new_user), unfollows: number(item.cancel_user) });
    byDate.set(date, current);
  }
  for (const item of cumulateItems) {
    const date = item.ref_date;
    if (!date) continue;
    const current = byDate.get(date) || { refDate: date, newFollowers: 0, unfollows: 0, followerCount: null, sourceBreakdown: [] };
    current.followerCount = number(item.cumulate_user);
    byDate.set(date, current);
  }
  for (const item of byDate.values()) {
    const snapshot = {
      id: `account_metrics_${stableId(`wechat:${accountId}:${item.refDate}`)}`,
      schemaVersion: "1.0",
      accountId,
      platform: "wechat",
      refDate: item.refDate,
      newFollowers: item.newFollowers,
      unfollows: item.unfollows,
      netFollowers: item.newFollowers - item.unfollows,
      followerCount: item.followerCount,
      sourceBreakdown: item.sourceBreakdown,
      source: "wechat_official_api",
      collectedAt: new Date().toISOString()
    };
    const existingIndex = store.platformAccountSnapshots.findIndex((entry) => entry.accountId === accountId && entry.platform === "wechat" && entry.refDate === item.refDate);
    if (existingIndex >= 0) store.platformAccountSnapshots[existingIndex] = snapshot;
    else store.platformAccountSnapshots.push(snapshot);
  }
  return [...byDate.values()].sort((left, right) => left.refDate.localeCompare(right.refDate));
}

function upsertContentSummarySnapshots(store, accountId, summaryItems) {
  store.platformAccountSnapshots ||= [];
  const snapshots = [];
  for (const item of summaryItems) {
    const refDate = item.ref_date;
    if (!refDate) continue;
    const detail = item.detail || {};
    const existingIndex = store.platformAccountSnapshots.findIndex((entry) => entry.accountId === accountId && entry.platform === "wechat" && entry.refDate === refDate);
    const existing = existingIndex >= 0 ? store.platformAccountSnapshots[existingIndex] : {
      id: `account_metrics_${stableId(`wechat:${accountId}:${refDate}`)}`,
      schemaVersion: "1.0",
      accountId,
      platform: "wechat",
      refDate,
      source: "wechat_official_api"
    };
    const snapshot = {
      ...existing,
      contentMetrics: {
        readUsers: number(detail.read_user),
        shareUsers: number(detail.share_user),
        watchingUsers: number(detail.zaikan_user),
        likes: number(detail.like_user),
        comments: number(detail.comment_count),
        collections: number(detail.collection_user),
        originalPageReaders: number(detail.redirect_ori_page_user),
        publishedPages: number(detail.send_page_count),
        readSources: list(detail.read_user_source)
      },
      source: "wechat_official_api",
      apiVersion: "published_content_v2",
      collectedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) store.platformAccountSnapshots[existingIndex] = snapshot;
    else store.platformAccountSnapshots.push(snapshot);
    snapshots.push(snapshot);
  }
  return snapshots.sort((left, right) => left.refDate.localeCompare(right.refDate));
}

export async function testWechatConnection(config) {
  const startedAt = Date.now();
  await accessToken(config, true);
  return { ok: true, connected: true, latencyMs: Date.now() - startedAt, provider: "微信公众号官方 API", appId: config.appId };
}

export async function syncWechatAnalytics(store, account, config, requestedDays = 7) {
  const days = Math.min(Math.max(Number(requestedDays || config.syncDays || 7), 1), 30);
  const token = await accessToken(config);
  const dates = syncDates(days);
  const articles = [];
  const warnings = [];
  for (const date of dates) {
    try {
      const payload = await datacube(token, "getarticletotaldetail", date, date);
      articles.push(...list(payload.list).map(normalizeArticle));
    } catch (error) {
      warnings.push({ date, message: error.message, code: error.code || null, scope: "published_content_detail" });
    }
  }
  if (!articles.length && warnings.length === dates.length) {
    const error = new Error(warnings[0].message);
    error.statusCode = 502;
    error.details = warnings;
    throw error;
  }
  const unique = [...new Map(articles.map((article) => [`${article.msgId}:${article.refDate}:${article.title}`, article])).values()];
  const results = unique.map((article) => upsertArticle(store, account, article));
  const userSummaryItems = [];
  const userCumulateItems = [];
  const contentSummaryItems = [];
  for (const chunk of dateChunks(dates)) {
    try {
      const [summary, cumulate, contentSummary] = await Promise.all([
        datacube(token, "getusersummary", chunk[0], chunk.at(-1)),
        datacube(token, "getusercumulate", chunk[0], chunk.at(-1)),
        datacube(token, "getbizsummary", chunk[0], chunk.at(-1))
      ]);
      userSummaryItems.push(...list(summary.list));
      userCumulateItems.push(...list(cumulate.list));
      contentSummaryItems.push(...list(contentSummary.list));
    } catch (error) {
      warnings.push({ date: `${chunk[0]}~${chunk.at(-1)}`, message: error.message, code: error.code || null, scope: "account_summary" });
    }
  }
  const accountSnapshots = upsertAccountSnapshots(store, account.id, userSummaryItems, userCumulateItems);
  const contentSummarySnapshots = upsertContentSummarySnapshots(store, account.id, contentSummaryItems);
  store.platformSyncRuns ||= [];
  const run = {
    id: `platform_sync_${randomUUID().slice(0, 8)}`,
    platform: "wechat",
    accountId: account.id,
    source: "wechat_official_api",
    apiVersion: "published_content_v2",
    days,
    status: warnings.length ? "partial" : "succeeded",
    articleCount: results.length,
    importedCount: results.filter((item) => item.imported).length,
    matchedCount: results.filter((item) => !item.imported).length,
    accountSnapshotCount: accountSnapshots.length,
    contentSummarySnapshotCount: contentSummarySnapshots.length,
    latestFollowerCount: accountSnapshots.at(-1)?.followerCount ?? null,
    warnings,
    completedAt: new Date().toISOString()
  };
  store.platformSyncRuns.push(run);
  return run;
}
