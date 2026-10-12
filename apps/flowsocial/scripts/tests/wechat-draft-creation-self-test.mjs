import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { executeAtomicWechatDraftCreation, previewAtomicWechatDraftCreation, projectAtomicWechatDraftCreation } from "../../content-agent/wechat-draft-creation.mjs";

const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });
const refs = { project: ref("project"), materialized: ref("materialized"), commit: ref("commit"), run: ref("run"), article: ref("article"), version: ref("version"), manifest: ref("manifest"), upload: ref("upload"), post: ref("post"), delivery: ref("delivery") };
const promotion = { id: "promotion", promotionHash: hashUnifiedContent({ id: "promotion" }), promotedVersionRef: refs.version };
const context = {
  authority: { workspaceId: "workspace", companyId: "company", accountId: "wechat-account", executionProjectRef: refs.project, materializedProjectRef: refs.materialized, payload: { commitRef: refs.commit }, platformRunRef: refs.run, candidateRef: refs.article },
  promotion,
  version: { article: { recommended_title: "本次测试草稿", abstract: "只创建草稿，不发布" } },
  delivery: { id: refs.delivery.id, factHash: refs.delivery.hash, manifestRef: refs.manifest }, evidence: { id: refs.upload.id, factHash: refs.upload.hash },
  postUpload: { id: refs.post.id, factHash: refs.post.hash, html: '<article><img src="https://mmbiz.qpic.cn/fixture.png"><p>正文</p></article>' },
  execution: { attempts: [{ role: "cover", status: "succeeded", response: { mediaId: "cover-media-id" } }] }
};
const contextResolver = () => context;
const flags = { atomicWechatDraftCreationV1: true };
const scope = { projectId: "project", platform: "wechat" };
const preview = previewAtomicWechatDraftCreation({}, scope, { featureFlags: flags, contextResolver });
assert.equal(preview.claims.providerCalls, 0);
assert.equal(preview.claims.explicitHumanConfirmationRequired, true);
assert.equal(preview.request.draft.thumbMediaId, "cover-media-id");
assert.equal(preview.request.claims.platformPublicationPerformed, false);

const store = {}; let calls = 0;
const request = { request: scope, previewToken: preview.previewToken, actorType: "user", actorId: "user:test", confirmedAt: "2026-08-18T10:00:00.000Z", idempotencyKey: "draft-once" };
const options = { featureFlags: flags, contextResolver, now: "2026-08-18T10:00:01.000Z", transport: async ({ accountId, draft }) => { calls += 1; assert.equal(accountId, "wechat-account"); assert.equal(draft.title, "本次测试草稿"); return { mediaId: "draft-media-id" }; } };
const created = await executeAtomicWechatDraftCreation(store, request, options);
assert.equal(created.created, true); assert.equal(created.execution.status, "succeeded"); assert.equal(created.execution.platformPublicationPerformed, false); assert.equal(created.draftArtifact.semantics, "wechat_draft_created_not_published"); assert.equal(calls, 1);
const replay = await executeAtomicWechatDraftCreation(store, request, options);
assert.equal(replay.created, false); assert.equal(replay.providerCalls, 0); assert.equal(calls, 1);
await assert.rejects(() => executeAtomicWechatDraftCreation(store, { ...request, idempotencyKey: "draft-second" }, options), { code: "ATOMIC_WECHAT_DRAFT_ALREADY_ATTEMPTED" });
assert.equal(calls, 1);
assert.deepEqual(projectAtomicWechatDraftCreation(store, scope, { featureFlags: flags, contextResolver }), { schemaVersion: "1.0", contract: "AtomicWechatDraftCreationProjection@1.0", ready: true, draftCreated: true, effectUnknown: false, published: false, executionRef: { id: created.execution.id, hash: created.execution.factHash }, mediaId: "draft-media-id", blockers: ["wechat_draft_not_published"] });

const unknownStore = {};
const unknown = await executeAtomicWechatDraftCreation(unknownStore, { ...request, idempotencyKey: "draft-unknown" }, { ...options, transport: async () => { calls += 1; throw Object.assign(new Error("connection reset"), { code: "WECHAT_DRAFT_RESULT_UNKNOWN", effectUnknown: true }); } });
assert.equal(unknown.execution.status, "result_unknown"); assert.equal(unknown.execution.draftCreated, false); assert.equal(unknownStore.unifiedContentWechatLifecycleFacts, undefined);
const unknownState = projectAtomicWechatDraftCreation(unknownStore, scope, { featureFlags: flags, contextResolver });
assert.equal(unknownState.effectUnknown, true); assert.equal(unknownState.draftCreated, false);
await assert.rejects(() => executeAtomicWechatDraftCreation(unknownStore, { ...request, idempotencyKey: "draft-unknown-second" }, options), { code: "ATOMIC_WECHAT_DRAFT_ALREADY_ATTEMPTED" });

console.log("wechat-draft-creation-self-test: ok");
