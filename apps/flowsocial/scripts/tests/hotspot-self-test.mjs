import assert from "node:assert/strict";

const baiduItems = [
  { appUrl: "https://www.baidu.com/s?wd=AI世界杯", desc: "AI 技术进入世界杯内容生产", hotChange: "up", hotScore: "8000000", query: "AI世界杯", rawUrl: "https://www.baidu.com/s?wd=AI世界杯", show: [], url: "https://www.baidu.com/s?wd=AI世界杯", word: "AI世界杯", isTop: true },
  { appUrl: "https://www.baidu.com/s?wd=机器人", desc: "机器人产业新进展", hotChange: "same", hotScore: "6000000", query: "机器人产业", rawUrl: "https://www.baidu.com/s?wd=机器人", show: [], url: "https://www.baidu.com/s?wd=机器人", word: "机器人产业" }
];

const googleXml = `<?xml version="1.0"?><rss><channel>
<item><title>AI世界杯</title><ht:approx_traffic>5000+</ht:approx_traffic><description/><link>https://trends.google.com/</link><pubDate>${new Date().toUTCString()}</pubDate><ht:news_item><ht:news_item_title>AI powers World Cup media workflows</ht:news_item_title><ht:news_item_url>https://example.com/ai-world-cup</ht:news_item_url></ht:news_item></item>
<item><title>企业智能体</title><ht:approx_traffic>1000+</ht:approx_traffic><description/><link>https://trends.google.com/</link><pubDate>${new Date().toUTCString()}</pubDate><ht:news_item><ht:news_item_title>Enterprise agents</ht:news_item_title><ht:news_item_url>https://example.com/agents</ht:news_item_url></ht:news_item></item>
</channel></rss>`;

globalThis.fetch = async (url) => {
  if (String(url).includes("top.baidu.com")) return new Response(`<script>${baiduItems.map((item) => JSON.stringify(item)).join(",")}</script>`, { status: 200 });
  if (String(url).includes("trends.google.com")) return new Response(googleXml, { status: 200 });
  throw new Error(`Unexpected URL in hotspot self-test: ${url}`);
};

const { runHotspotPipeline } = await import("../../hotspot-engine.mjs");
const result = await runHotspotPipeline({ poolType: "global", globalSources: ["baidu", "google_hk"], timeWindowDays: 1, limit: 10 });

assert.equal(result.run.poolType, "global");
assert.equal(result.run.stats.collected, 4);
const worldCup = result.opportunities.find((item) => item.title === "AI世界杯");
assert.ok(worldCup);
assert.equal(worldCup.sourceCount, 2);
assert.equal(worldCup.signalCount, 2);
assert.equal(worldCup.sourceEvidence.length, 2);
assert.ok(worldCup.score >= 70);
assert.ok(worldCup.sourceEvidence.every((item) => !String(item.url).includes("/trending/rss")), "打开来源不能指向RSS/XML");
assert.deepEqual(result.run.stages.map((item) => item.id), ["collect", "normalize", "relevance", "dedupe", "cluster", "score"]);

const historical = await runHotspotPipeline({ poolType: "global", globalSources: ["baidu", "google_hk"], timeWindowDays: 7, targetOpportunityCount: 3, limit: 10 }, {
  hotspotLibrary: [{ id: "history_1", poolType: "global", status: "active", title: "三天前的体育热点", originalTitle: "三天前的体育热点", summary: "历史快照", category: "体育赛事", score: 75, lastSeenAt: new Date(Date.now() - 3 * 86400000).toISOString(), sourceEvidence: [] }]
});
assert.equal(historical.run.stats.historicalAdded, 1);

console.log(JSON.stringify({ status: "passed", stats: result.run.stats, historicalAdded: historical.run.stats.historicalAdded, top: result.opportunities[0].title, sourceCount: result.opportunities[0].sourceCount }));

