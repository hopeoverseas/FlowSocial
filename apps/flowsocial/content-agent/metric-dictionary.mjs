export const METRIC_DICTIONARY_VERSION = "1.0";

export const CORE_METRICS = Object.freeze([
  "impressions", "views", "likes", "saves", "comments", "shares",
  "follows", "unfollows", "leads", "conversions"
]);

export const BUSINESS_METRICS = Object.freeze([
  "qualifiedLeads", "salesAcceptedLeads", "proposals", "wonDeals", "revenue"
]);

const shared = {
  impressions: ["impressions", "exposure", "exposures", "曝光", "曝光数", "展现量"],
  views: ["views", "view_count", "reads", "read_user", "观看", "观看数", "阅读人数", "阅读uv"],
  likes: ["likes", "like_count", "like_user", "点赞", "点赞数"],
  saves: ["saves", "favorites", "collection_user", "收藏", "收藏数"],
  comments: ["comments", "comment_count", "评论", "评论数"],
  shares: ["shares", "share_user", "分享", "分享人数"],
  follows: ["follows", "new_followers", "new_user", "新增关注", "新增粉丝"],
  unfollows: ["unfollows", "cancel_user", "取消关注", "取关"],
  leads: ["leads", "inquiries", "咨询", "线索", "咨询数", "线索数"],
  conversions: ["conversions", "transactions", "成交", "成交数"]
};

const platform = {
  xiaohongshu: {
    coverClicks: ["coverClicks", "cover_clicks", "笔记观看", "封面点击", "观看数"],
    averageViewSeconds: ["averageViewSeconds", "average_view_seconds", "平均观看时长", "平均观看时长(秒)"],
    completionRate: ["completionRate", "completion_rate", "完播率", "完读率"],
    profileVisits: ["profileVisits", "profile_visits", "主页访客", "主页访问"],
    directMessages: ["directMessages", "direct_messages", "私信", "私信数"],
    followerCount: ["followerCount", "follower_count", "粉丝数", "累计粉丝"],
    trafficSources: ["trafficSources", "traffic_sources", "流量来源"],
    viewerProfile: ["viewerProfile", "viewer_profile", "观看人群画像"],
    followerProfile: ["followerProfile", "follower_profile", "粉丝画像"]
  },
  wechat: {
    delivered: ["delivered", "deliveries", "送达人数", "送达"],
    opens: ["opens", "readers", "read_user", "阅读人数", "阅读uv"],
    readPv: ["readPv", "read_pv", "阅读次数", "阅读pv"],
    completions: ["completions", "finishedReads", "读完人数"],
    shareUsers: ["shareUsers", "share_users", "share_user", "分享人数"],
    shareCount: ["shareCount", "share_count", "分享次数"],
    watchingUsers: ["watchingUsers", "zaikan_user", "在看人数", "在看"],
    subscribedReaders: ["subscribedReaders", "read_subscribe_user", "文后关注"],
    regularReaders: ["regularReaders", "regular_readers", "常读用户"],
    readDeliveryRate: ["readDeliveryRate", "read_delivery_rate", "送达阅读率"],
    readFinishRate: ["readFinishRate", "read_finish_rate", "完读率"],
    averageActiveTime: ["averageActiveTime", "read_avg_activetime", "平均阅读时长"],
    menuClicks: ["menuClicks", "menu_clicks", "菜单点击"],
    keywordReplies: ["keywordReplies", "keyword_replies", "关键词回复"],
    praiseMoney: ["praiseMoney", "praise_money", "赞赏金额"],
    readSources: ["readSources", "read_user_source", "阅读来源"],
    readJumpPositions: ["readJumpPositions", "read_jump_position", "跳出位置"]
  }
};

export const PLATFORM_METRIC_KEYS = Object.freeze(Object.fromEntries(Object.entries(platform).map(([name, metrics]) => [name, Object.freeze(Object.keys(metrics))])));

export const CORE_METRICS_BY_PLATFORM = Object.freeze({
  xiaohongshu: Object.freeze(["impressions", "views", "likes", "saves", "comments", "shares", "follows", "leads", "conversions"]),
  wechat: Object.freeze(["views", "shares", "follows", "unfollows", "leads", "conversions"])
});

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_\-（）()]/g, "");
}

function indexAliases(definition) {
  return new Map(Object.entries(definition).flatMap(([canonical, aliases]) => aliases.map((alias) => [normalizedKey(alias), canonical])));
}

const sharedIndex = indexAliases(shared);
const platformIndexes = Object.fromEntries(Object.entries(platform).map(([key, value]) => [key, indexAliases(value)]));

export function metricDictionary(platformName = null) {
  return {
    schemaVersion: METRIC_DICTIONARY_VERSION,
    platform: platformName,
    coreMetrics: shared,
    platformMetrics: platformName ? platform[platformName] || {} : platform
  };
}

export function canonicalMetricKey(key, platformName = null) {
  const normalized = normalizedKey(key);
  return sharedIndex.get(normalized) || platformIndexes[platformName]?.get(normalized) || null;
}

export function mapMetricRow(row = {}, platformName = null) {
  const metrics = {};
  const platformMetrics = {};
  const unmapped = {};
  for (const [key, value] of Object.entries(row || {})) {
    const canonical = canonicalMetricKey(key, platformName);
    if (!canonical) unmapped[key] = value;
    else if (CORE_METRICS.includes(canonical)) metrics[canonical] = value;
    else platformMetrics[canonical] = value;
  }
  return { metrics, platformMetrics, unmapped };
}

export function metricValue(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().endsWith("%")) {
    const percentage = Number(value.trim().slice(0, -1));
    return Number.isFinite(percentage) && percentage >= 0 ? percentage / 100 : null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

