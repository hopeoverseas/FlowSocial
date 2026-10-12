import assert from "node:assert/strict";

if (process.env.FLOWSOCIAL_HOTSPOT_LIVE !== "1") {
  throw new Error("Live test is disabled. Set FLOWSOCIAL_HOTSPOT_LIVE=1 explicitly.");
}

const baseUrl = String(process.env.FLOWSOCIAL_LIVE_BASE_URL || "").replace(/\/$/, "");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/v1$/.test(baseUrl)) {
  throw new Error("FLOWSOCIAL_LIVE_BASE_URL must point to an isolated localhost /api/v1 server.");
}

const counters = { globalCollections: 0, keywordCollections: 0, contentGenerations: 0 };
const limits = { globalCollections: 1, keywordCollections: 1, contentGenerations: 1 };

function consume(name) {
  counters[name] += 1;
  if (counters[name] > limits[name]) throw new Error(`Live call limit exceeded: ${name}`);
}

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.code = payload.code || null;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const health = await api("/health");
assert.ok(health.status);
const accounts = (await api("/accounts")).items || [];
const socialAccount = accounts.find((item) =>
  item.accountType !== "company"
  && ["xiaohongshu", "wechat"].includes(item.platform)
  && !["disabled", "setup_required"].includes(item.status)
);
if (!socialAccount) throw new Error("No configured Xiaohongshu or WeChat social account exists in the isolated store.");
const companyId = socialAccount.companyId || process.env.FLOWSOCIAL_LIVE_COMPANY_ID || "account_damaishuzhi";
const directions = (await api(`/content-directions?companyId=${encodeURIComponent(companyId)}`)).items || [];
const direction = directions.find((item) =>
  (item.coreKeywords || item.searchKeywords || item.keywords || []).length
);
if (!direction) throw new Error("No keyword-enabled content direction exists for the selected account.");
const keywords = (direction.coreKeywords || direction.searchKeywords || direction.keywords).slice(0, 2);

const libraryBeforeGlobal = await api(`/hotspot-library?status=active&companyId=${encodeURIComponent(companyId)}`);
consume("globalCollections");
const globalPreview = await api("/hotspot-runs", {
  method: "POST",
  body: {
    poolType: "global",
    requireLive: true,
    companyId,
    globalSources: ["baidu"],
    timeWindowDays: 1,
    targetOpportunityCount: 3,
    limit: 10
  }
});
assert.equal(globalPreview.run.mode, "live");
assert.ok(globalPreview.opportunities.some((item) => item.sourceUrl && item.collectedAt));
const libraryAfterGlobalPreview = await api(`/hotspot-library?status=active&companyId=${encodeURIComponent(companyId)}`);
assert.equal(
  libraryAfterGlobalPreview.items.length,
  libraryBeforeGlobal.items.length,
  "Global preview must not automatically enter the hotspot library."
);

consume("keywordCollections");
const keywordPreview = await api("/hotspot-runs", {
  method: "POST",
  body: {
    poolType: "keyword",
    requireLive: true,
    companyId,
    directionId: direction.id,
    keywordProfile: direction,
    keywords,
    platforms: ["xiaohongshu"],
    pages: 1,
    pageSize: 10,
    maxCollectionRounds: 1,
    timeWindowDays: 7,
    relevanceThreshold: 70,
    minimumHotspotScore: 1,
    targetOpportunityCount: 1
  }
});
assert.equal(keywordPreview.run.mode, "live");
const selectedPreview = keywordPreview.opportunities.find((item) =>
  ["direct", "bridge"].includes(item.relevanceTier) && item.sourceUrl
);
if (!selectedPreview) {
  throw new Error("The single live keyword collection returned no direct/bridge hotspot with a source URL.");
}

const commit = await api(`/hotspot-runs/${encodeURIComponent(keywordPreview.previewId)}/commit`, {
  method: "POST",
  body: {
    opportunityIds: [selectedPreview.id],
    companyId,
    committedBy: "live_acceptance_user"
  }
});
const hotspotAsset = commit.items?.[0];
assert.ok(hotspotAsset?.id);
assert.notEqual(hotspotAsset.id, selectedPreview.id);
assert.equal(hotspotAsset.sourceUrl, selectedPreview.sourceUrl);

const opportunity = await api("/content-agent/opportunities", {
  method: "POST",
  body: {
    companyId,
    socialAccountId: socialAccount.id,
    platform: socialAccount.platform,
    sourceType: "hotspot",
    sourceId: hotspotAsset.id,
    topic: hotspotAsset.title,
    angle: hotspotAsset.relevanceReason || "解释热点与目标用户的真实关系",
    contentPurposeId: "hotspot_industry_explainer",
    preferredSourceMode: "hotspot",
    metadata: {
      relevanceTier: hotspotAsset.relevanceTier,
      sourceUrl: hotspotAsset.sourceUrl
    }
  }
});
const run = await api(`/content-agent/opportunities/${encodeURIComponent(opportunity.id)}/runs`, {
  method: "POST",
  body: {}
});
assert.equal(opportunity.contentRunId, null);
assert.deepEqual(run.hotspotAssetIds, [hotspotAsset.id]);

const outlined = await api(`/content-agent/runs/${encodeURIComponent(run.id)}/outline`, {
  method: "POST",
  body: {}
});
assert.ok(outlined.outline);
const confirmed = await api(`/content-agent/runs/${encodeURIComponent(run.id)}/outline/confirm`, {
  method: "POST",
  body: {}
});
assert.ok(confirmed.outlineConfirmedAt);

consume("contentGenerations");
const task = await api("/content-tasks/generate", {
  method: "POST",
  body: { contentRunId: run.id }
});
const trace = await api(`/content-agent/runs/${encodeURIComponent(run.id)}/trace`);
const libraryAfter = await api(`/hotspot-library?status=active&companyId=${encodeURIComponent(companyId)}`);
const persistedHotspot = libraryAfter.items.find((item) => item.id === hotspotAsset.id);
assert.deepEqual(task.hotspotAssetIds, [hotspotAsset.id]);
assert.deepEqual(task.contentSourceEvidence.hotspots.map((item) => item.id), [hotspotAsset.id]);
assert.deepEqual(trace.lineage.hotspotAssetIds, [hotspotAsset.id]);
assert.ok(persistedHotspot.usedByContentRunIds.includes(run.id));
assert.ok(persistedHotspot.usedByContentTaskIds.includes(task.id));

console.log(JSON.stringify({
  kind: "FlowSocialHotspotLiveAcceptance",
  live: true,
  isolatedServer: baseUrl,
  providerModes: {
    global: globalPreview.run.mode,
    keyword: keywordPreview.run.mode,
    content: task.providerMode
  },
  counters,
  companyId,
  socialAccountId: socialAccount.id,
  strategySnapshotId: run.strategySnapshotId,
  hotspotAssetId: hotspotAsset.id,
  hotspotSourceUrl: hotspotAsset.sourceUrl,
  contentOpportunityId: opportunity.id,
  contentRunId: run.id,
  contentTaskId: task.id
}, null, 2));
