import assert from "node:assert/strict";
import { syncWechatAnalytics, testWechatConnection } from "../../wechat-analytics.mjs";

const originalFetch = globalThis.fetch;
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
let tokenRequests = 0;
let cubeRequests = 0;

globalThis.fetch = async (url) => {
  if (String(url).includes("/cgi-bin/token")) {
    tokenRequests += 1;
    return new Response(JSON.stringify({ access_token: "test_token", expires_in: 7200 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  cubeRequests += 1;
  if (String(url).includes("getusersummary")) {
    return new Response(JSON.stringify({ list: [{ ref_date: yesterday, user_source: 0, new_user: 4, cancel_user: 1 }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (String(url).includes("getusercumulate")) {
    return new Response(JSON.stringify({ list: [{ ref_date: yesterday, cumulate_user: 108 }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (String(url).includes("getbizsummary")) {
    return new Response(JSON.stringify({ list: [{ ref_date: yesterday, detail: { read_user: 72, share_user: 7, zaikan_user: 6, like_user: 8, comment_count: 4, collection_user: 4, redirect_ori_page_user: 2, send_page_count: 2, read_user_source: [{ user_count: 60, scene_desc: "公众号会话" }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({
    list: [
      { ref_date: yesterday, msgid: "wechat_001", title: "已经在 FlowSocial 里的文章", content_url: "https://mp.weixin.qq.com/s/test-1", publish_type: 1, detail_list: [{ stat_date: yesterday, read_user: 42, share_user: 5, collection_user: 3, like_user: 6, zaikan_user: 4, comment_count: 2, read_subscribe_user: 20, read_delivery_rate: 0.42, read_finish_rate: 0.7, read_avg_activetime: 32.5, praise_money: 0, read_user_source: [{ user_count: 30, scene_desc: "公众号会话" }], read_jump_position: [] }] },
      { ref_date: yesterday, msgid: "wechat_002", title: "发布于接入前的历史文章", content_url: "https://mp.weixin.qq.com/s/test-2", publish_type: 1, detail_list: [{ stat_date: yesterday, read_user: 30, share_user: 2, collection_user: 1, like_user: 2, zaikan_user: 1, comment_count: 2, read_subscribe_user: 12, read_delivery_rate: 0.3, read_finish_rate: 0.6, read_avg_activetime: 27, praise_money: 0, read_user_source: [], read_jump_position: [] }] }
    ]
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  const account = { id: "acc_wechat_test", workspaceId: "workspace_test", companyId: "company_test", platform: "wechat" };
  const config = { appId: "wx_test", appSecret: "secret", syncDays: 1 };
  const store = {
    accounts: [account],
    contentTasks: [{ id: "task_existing", accountId: account.id, socialAccountId: account.id, companyId: account.companyId, workspaceId: account.workspaceId, platform: "wechat", status: "succeeded", version: 1, currentContent: { recommended_title: "已经在 FlowSocial 里的文章" }, contentIdentity: { topic: "已有选题" }, createdAt: new Date().toISOString() }],
    contentPublications: []
  };

  const connection = await testWechatConnection(config);
  assert.equal(connection.ok, true);
  const first = await syncWechatAnalytics(store, account, config, 1);
  assert.equal(first.articleCount, 2);
  assert.equal(first.matchedCount, 0);
  assert.equal(first.importedCount, 2, "title-only matches must be imported for later review, not auto-bound");
  assert.equal(first.accountSnapshotCount, 1);
  assert.equal(first.contentSummarySnapshotCount, 1);
  assert.equal(first.latestFollowerCount, 108);
  assert.equal(store.contentTasks.length, 3);
  assert.equal(store.contentPublications.length, 2);
  assert.equal(store.contentPublications.find((item) => item.platformContentId === "wechat_001").latestMetrics.views, 42);
  assert.equal(store.contentPublications.find((item) => item.platformContentId === "wechat_001").latestMetrics.platformMetrics.opens, 42);
  assert.equal(store.contentPublications.find((item) => item.platformContentId === "wechat_001").latestMetrics.comments, 2);
  assert.equal(store.contentPublications.find((item) => item.platformContentId === "wechat_001").sourceMetadata.apiVersion, "published_content_v2");

  const second = await syncWechatAnalytics(store, account, config, 1);
  assert.equal(second.importedCount, 0);
  assert.equal(store.contentTasks.length, 3);
  assert.equal(store.contentPublications.length, 2);
  assert.ok(store.contentPublications.every((item) => item.metricHistory.length === 1));
  assert.equal(store.platformAccountSnapshots.length, 1);
  assert.equal(store.platformAccountSnapshots[0].netFollowers, 3);
  assert.equal(store.platformAccountSnapshots[0].contentMetrics.readUsers, 72);
  assert.equal(tokenRequests, 1);
  assert.equal(cubeRequests, 8);

  console.log(JSON.stringify({ status: "wechat-analytics-self-test passed", publications: store.contentPublications.length, importedHistory: first.importedCount, idempotent: true }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
