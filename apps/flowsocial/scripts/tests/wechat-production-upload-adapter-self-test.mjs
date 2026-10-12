import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWechatDraftTransport, createWechatResourceUploadTransport, createWechatUploadAssetReader } from "../../content-agent/wechat-production-upload-adapter.mjs";
import { createWechatDraft, uploadWechatImageResource } from "../../wechat-analytics.mjs";

const dataRoot = await mkdtemp(join(tmpdir(), "flowsocial-wechat-upload-adapter-"));
const projectId = "project_fixture";
const projectRoot = join(dataRoot, "wechat-live-assets", projectId);
await mkdir(join(projectRoot, "images"), { recursive: true });
await writeFile(join(projectRoot, "article.html"), "<p>fixture</p>");
await writeFile(join(projectRoot, "images", "cover.png"), Buffer.from([137, 80, 78, 71]));

const reader = createWechatUploadAssetReader({ dataRoot });
const html = await reader({ kind: "html", descriptor: { relativePath: "article.html" }, context: { contentProjectId: projectId } });
assert.equal(html.bytes.toString(), "<p>fixture</p>");
assert.equal(html.contentType, "text/html; charset=utf-8");
const image = await reader({ kind: "resource", descriptor: { relativePath: "images/cover.png" }, context: { contentProjectId: projectId } });
assert.deepEqual(image.bytes, Buffer.from([137, 80, 78, 71]));
assert.equal(image.contentType, "image/png");
await assert.rejects(() => reader({ kind: "resource", descriptor: { relativePath: "../secret.png" }, context: { contentProjectId: projectId } }), { code: "ATOMIC_WECHAT_UPLOAD_ASSET_PATH_INVALID" });
await assert.rejects(() => reader({ kind: "resource", descriptor: { relativePath: "images/missing.png" }, context: { contentProjectId: projectId } }), { code: "ATOMIC_WECHAT_UPLOAD_ASSET_MISSING" });

const uploadCalls = [];
const transport = createWechatResourceUploadTransport({
  integrationResolver: async (accountId) => ({ accountId, enabled: true, appId: "app", appSecret: "secret" }),
  uploader: async (integration, resource) => {
    uploadCalls.push({ integration, resource });
    return resource.operation === "wechat_permanent_material_upload_for_thumb_media_id" ? { mediaId: "MEDIA_FIXTURE" } : { url: "https://mmbiz.qpic.cn/fixture" };
  }
});
assert.deepEqual(await transport({ accountId: "account", operation: "wechat_permanent_material_upload_for_thumb_media_id", bytes: image.bytes, contentType: image.contentType, relativePath: "images/cover.png" }), { mediaId: "MEDIA_FIXTURE" });
assert.equal(uploadCalls[0].resource.filename, "cover.png");
assert.equal(uploadCalls[0].resource.contentType, "image/png");
const disabledTransport = createWechatResourceUploadTransport({ integrationResolver: async () => null, uploader: async () => assert.fail("uploader must not run") });
await assert.rejects(() => disabledTransport({ accountId: "account", operation: "wechat_uploadimg_for_https_body_url", bytes: image.bytes, contentType: image.contentType, relativePath: "images/cover.png" }), { code: "ATOMIC_WECHAT_UPLOAD_INTEGRATION_UNAVAILABLE" });
const draftTransport = createWechatDraftTransport({
  integrationResolver: async (accountId) => ({ accountId, enabled: true, appId: "app", appSecret: "secret" }),
  creator: async (_integration, draft) => ({ mediaId: `DRAFT_${draft.title}` })
});
assert.deepEqual(await draftTransport({ accountId: "account", draft: { title: "fixture" } }), { mediaId: "DRAFT_fixture" });
await assert.rejects(() => createWechatDraftTransport({ integrationResolver: async () => null })({ accountId: "account", draft: {} }), { code: "ATOMIC_WECHAT_DRAFT_INTEGRATION_UNAVAILABLE" });

const requests = [];
const fetchImpl = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  if (String(url).includes("/cgi-bin/token?")) return new Response(JSON.stringify({ access_token: "token_fixture", expires_in: 7200 }), { status: 200, headers: { "content-type": "application/json" } });
  if (String(url).includes("/cgi-bin/material/add_material?")) return new Response(JSON.stringify({ media_id: "MEDIA_LIVE_SHAPE" }), { status: 200, headers: { "content-type": "application/json" } });
  if (String(url).includes("/cgi-bin/draft/add?")) return new Response(JSON.stringify({ media_id: "DRAFT_LIVE_SHAPE" }), { status: 200, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify({ url: "https://mmbiz.qpic.cn/live-shape" }), { status: 200, headers: { "content-type": "application/json" } });
};
const config = { appId: `adapter-test-${Date.now()}`, appSecret: "not-a-real-secret" };
assert.deepEqual(await uploadWechatImageResource(config, { operation: "wechat_permanent_material_upload_for_thumb_media_id", bytes: image.bytes, contentType: "image/png", filename: "cover.png" }, { fetchImpl }), { mediaId: "MEDIA_LIVE_SHAPE" });
assert.equal(requests.length, 2);
assert.match(requests[1].url, /\/cgi-bin\/material\/add_material\?/);
assert.match(requests[1].url, /type=image/);
assert.equal(requests[1].options.method, "POST");
assert.ok(requests[1].options.body instanceof FormData);
assert.equal(requests[1].options.body.get("media").type, "image/png");
assert.deepEqual(await createWechatDraft(config, { title: "Draft", content: "<p>body</p>", thumbMediaId: "MEDIA_LIVE_SHAPE" }, { fetchImpl }), { mediaId: "DRAFT_LIVE_SHAPE" });
assert.match(requests[2].url, /\/cgi-bin\/draft\/add\?/);
assert.deepEqual(JSON.parse(requests[2].options.body), { articles: [{ title: "Draft", author: "", digest: "", content: "<p>body</p>", content_source_url: "", thumb_media_id: "MEDIA_LIVE_SHAPE", need_open_comment: 0, only_fans_can_comment: 0 }] });
await assert.rejects(
  () => createWechatDraft(config, { title: "Unknown", content: "<p>body</p>", thumbMediaId: "MEDIA_LIVE_SHAPE" }, { fetchImpl: async () => { throw new TypeError("fixture connection reset"); } }),
  (error) => error.code === "WECHAT_DRAFT_RESULT_UNKNOWN" && error.effectUnknown === true
);

console.log("wechat-production-upload-adapter-self-test: ok");
