import assert from "node:assert/strict";
import { confirmUnifiedPlatformOutline, listUnifiedPlatformOutlineConfirmations } from "../../content-agent/unified-platform-outline-confirmation.mjs";

const ref = (id, char) => ({ id, hash: char.repeat(64) });
const bootstrap = {
  id: "bootstrap_outline_fixture",
  state: "awaiting_outline_confirmation",
  outlineRefs: {
    xiaohongshu: ref("xhs_outline_fixture", "a"),
    wechat: ref("wechat_outline_fixture", "b")
  }
};
const store = {};

const xhs = confirmUnifiedPlatformOutline(store, bootstrap, "xiaohongshu", {
  actor: { type: "user", id: "reviewer_xhs" },
  confirmedAt: "2026-08-20T10:00:00.000Z",
  outlineRef: bootstrap.outlineRefs.xiaohongshu,
  idempotencyKey: "confirm_xhs_fixture"
});
assert.equal(xhs.created, true);
assert.equal(xhs.allConfirmed, false);
assert.equal(xhs.confirmations.xiaohongshu.platform, "xiaohongshu");

const replay = confirmUnifiedPlatformOutline(store, bootstrap, "xiaohongshu", {
  actor: { type: "user", id: "reviewer_xhs" },
  confirmedAt: "2026-08-20T10:00:00.000Z",
  outlineRef: bootstrap.outlineRefs.xiaohongshu,
  idempotencyKey: "confirm_xhs_fixture"
});
assert.equal(replay.created, false);
assert.equal(store.unifiedContentPlatformOutlineConfirmations.length, 1);

const wechat = confirmUnifiedPlatformOutline(store, bootstrap, "wechat", {
  actor: { type: "user", id: "reviewer_wechat" },
  confirmedAt: "2026-08-20T10:01:00.000Z",
  outlineRef: bootstrap.outlineRefs.wechat,
  idempotencyKey: "confirm_wechat_fixture"
});
assert.equal(wechat.allConfirmed, true);
assert.deepEqual(Object.keys(wechat.confirmations).sort(), ["wechat", "xiaohongshu"]);
assert.equal(listUnifiedPlatformOutlineConfirmations(store, bootstrap).allConfirmed, true);

assert.throws(() => confirmUnifiedPlatformOutline(store, bootstrap, "wechat", {
  actor: { type: "user", id: "reviewer_wechat" },
  confirmedAt: "2026-08-20T10:02:00.000Z",
  outlineRef: ref("stale", "c"),
  idempotencyKey: "confirm_stale_fixture"
}), (error) => error.code === "UNIFIED_PLATFORM_OUTLINE_STALE");

const scopedBootstrap = {
  id: "bootstrap_outline_scoped_xhs",
  state: "awaiting_outline_confirmation",
  targetPlatform: "xiaohongshu",
  outlineRefs: { xiaohongshu: ref("xhs_outline_scoped_fixture", "d") }
};
const scoped = confirmUnifiedPlatformOutline(store, scopedBootstrap, "xiaohongshu", {
  actor: { type: "user", id: "reviewer_scoped_xhs" },
  confirmedAt: "2026-08-20T10:03:00.000Z",
  outlineRef: scopedBootstrap.outlineRefs.xiaohongshu,
  idempotencyKey: "confirm_scoped_xhs_fixture"
});
assert.equal(scoped.allConfirmed, true, "a platform-scoped bootstrap is complete after its only outline is confirmed");
assert.deepEqual(Object.keys(scoped.confirmations), ["xiaohongshu"]);

console.log("unified-platform-outline-confirmation-self-test: ok");
