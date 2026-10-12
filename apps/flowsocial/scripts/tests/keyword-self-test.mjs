import assert from "node:assert/strict";
import { expandDirectionKeywords, filterRelevantSignals } from "../../keyword-engine.mjs";
import { clusterSignals, runHotspotPipeline } from "../../hotspot-engine.mjs";

const profile = await expandDirectionKeywords({ name: "海外社媒运营" }, { generateText: async () => ({ mode: "test", data: {
  coreKeywords: ["海外社媒运营", "出海品牌社媒"],
  platformKeywords: ["TikTok运营", "Instagram运营"],
  scenarioKeywords: ["海外社媒增长", "海外红人营销"],
  excludeKeywords: ["招聘", "跳舞"]
} }) });
assert.ok(profile.searchKeywords.length >= 6);

const relevance = await filterRelevantSignals([
  { id: "relevant", query: "海外社媒运营", title: "海外社媒运营：TikTok运营与出海品牌社媒增长", summary: "品牌本地化方法", platform: "douyin" },
  { id: "dance", query: "海外社媒运营", title: "晚睡的惩罚", summary: "跳舞挑战", platform: "douyin" },
  { id: "job", query: "海外社媒运营", title: "海外社媒远程岗位招聘", summary: "招聘运营人员", platform: "wechat" }
], profile, { threshold: 70 });
assert.deepEqual(relevance.accepted.map((item) => item.id), ["relevant"]);
assert.equal(relevance.rejected.length, 2);

const clustered = clusterSignals([
  { id: "a", query: "海外社媒运营", title: "TikTok推出品牌内容新功能", source: "抖音", metrics: {} },
  { id: "b", query: "海外社媒运营", title: "Instagram推荐机制调整", source: "小红书", metrics: {} }
]);
assert.equal(clustered.length, 2, "同一查询词下的不同事件不能被强制合并");

let collectionCalls = 0;
const commentRun = await runHotspotPipeline({ poolType: "keyword", directionId: "direction_social", keywords: profile.searchKeywords, keywordProfile: profile, platforms: ["xiaohongshu"], timeWindowDays: 7, targetOpportunityCount: 5 }, {}, {
  collectSearchSignals: async () => { collectionCalls += 1; return { mode: "test", items: [{ id: `post_${collectionCalls}`, query: "海外社媒运营", title: `海外社媒运营 TikTok运营与品牌出海增长 ${collectionCalls}`, snippet: "海外红人营销方法", source: "小红书", platform: "xiaohongshu", publishedAt: new Date().toISOString(), url: `https://example.com/post-${collectionCalls}`, metrics: { likes: 10 }, comments: [{ id: "comment_1", content: "TikTok冷启动应该先做什么？", likeCount: 8 }] }] }; },
  generateText: async (request) => request.task === "translate_hotspot_cards_to_simplified_chinese" ? ({ mode: "test", data: { items: request.items.map((item) => ({ id: item.id, titleZhCn: item.title, summaryZhCn: item.summary, category: "科技互联网" })) } }) : ({ mode: "test", data: { items: [] } })
});
assert.equal(commentRun.opportunities[0].comments[0].text, "TikTok冷启动应该先做什么？");
assert.equal(collectionCalls, 2, "首轮未达到目标数量时应自动执行第二轮搜索");
assert.equal(commentRun.run.collectionRounds.length, 2);

const legacyProfileRun = await runHotspotPipeline({ poolType: "keyword", directionId: "legacy", keywordProfile: { keywords: ["AI智能体"] }, timeWindowDays: 7, targetOpportunityCount: 1 }, {}, {
  collectSearchSignals: async () => ({ mode: "test", items: [{ id: "legacy_1", query: "AI智能体", title: "AI智能体进入企业工作流", snippet: "企业落地方法", source: "小红书", platform: "xiaohongshu", publishedAt: new Date().toISOString(), url: "https://example.com/legacy", metrics: { likes: 20 } }] }),
  generateText: async (request) => request.task === "translate_hotspot_cards_to_simplified_chinese" ? ({ mode: "test", data: { items: request.items.map((item) => ({ id: item.id, titleZhCn: item.title, summaryZhCn: item.summary, category: "科技互联网" })) } }) : ({ mode: "test", data: { items: [] } })
});
assert.equal(legacyProfileRun.run.keywords[0], "AI智能体", "旧主题只有 keywords 字段时也必须兼容");

const scaledFreshnessRun = await runHotspotPipeline({ poolType: "keyword", directionId: "direction_ai", keywordProfile: { keywords: ["AI智能体"] }, timeWindowDays: 7, targetOpportunityCount: 1 }, {}, {
  collectSearchSignals: async () => ({ mode: "test", items: [{ id: "four_days_old", query: "AI智能体", title: "AI智能体进入企业业务流程", snippet: "企业工作流实践", source: "小红书", platform: "xiaohongshu", publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(), url: "https://example.com/four-days", metrics: { likes: 10 } }] }),
  generateText: async (request) => request.task === "judge_hotspot_relevance"
    ? ({ mode: "test", data: { items: request.candidates.map((item) => ({ id: item.id, score: 95, related: true, reason: "直接讨论AI智能体企业应用", matchedKeywords: ["AI智能体"] })) } })
    : request.task === "translate_hotspot_cards_to_simplified_chinese"
      ? ({ mode: "test", data: { items: request.items.map((item) => ({ id: item.id, titleZhCn: item.title, summaryZhCn: item.summary, category: "科技互联网" })) } })
      : ({ mode: "test", data: { items: [] } })
});
assert.equal(scaledFreshnessRun.opportunities.length, 1, "7天窗口内的4天前内容不应按24小时窗口错误清零时效分");
assert.ok(scaledFreshnessRun.opportunities[0].scoreBreakdown.freshness > 50);

console.log(JSON.stringify({ status: "passed", keywords: profile.searchKeywords.length, accepted: relevance.accepted.length, rejected: relevance.rejected.length, clusters: clustered.length, realComments: commentRun.opportunities[0].comments.length }));

