import assert from "node:assert/strict";
import {
  ensureReferenceLibraries,
  recordContentSourceUsage,
  recordReferenceAnalysis
} from "../../content-agent/library-store.mjs";

const createdAt = "2026-07-27T08:00:00.000Z";
const store = {
  referenceAnalyses: [],
  referencePosts: [],
  viralBlueprintLibrary: [],
  hotspotLibrary: [{ id: "hotspot_1", title: "行业新规", usedByContentIds: [] }]
};

const analysis = {
  id: "analysis_1",
  createdAt,
  reference: { platform: "xiaohongshu", title: "参考内容" },
  blueprint: {
    viralType: "反常识清单",
    titleFormula: "人群 + 误区 + 新判断",
    bodyFormula: ["问题", "误区", "方法", "行动"],
    forbiddenReplication: ["原文句子", "原图"]
  },
  doNotCopy: ["原文句子", "原图"]
};

const recorded = recordReferenceAnalysis(store, {
  platform: "xiaohongshu",
  url: "https://example.com/post/1",
  title: "参考内容",
  rawText: "这段原文只用于分析和溯源，不能作为用户事实。",
  savedReason: "结构值得学习"
}, analysis);
store.referenceAnalyses.push(analysis);

assert.equal(store.referencePosts.length, 1);
assert.equal(store.viralBlueprintLibrary.length, 1);
assert.equal(recorded.referencePost.analysisId, analysis.id);
assert.equal(recorded.referencePost.rawText.includes("不能作为用户事实"), true);
assert.equal(recorded.viralBlueprint.extractionMode, "demo_rule_based");
assert.equal(recorded.viralBlueprint.status, "needs_skill_upgrade");
assert.deepEqual(recorded.viralBlueprint.doNotCopy, ["原文句子", "原图"]);
assert.equal(analysis.productionReady, false);

ensureReferenceLibraries(store);
ensureReferenceLibraries(store);
assert.equal(store.referencePosts.length, 1, "migration must be idempotent");
assert.equal(store.viralBlueprintLibrary.length, 1, "blueprint migration must be idempotent");

const task = {
  id: "content_1",
  createdAt: "2026-07-27T09:00:00.000Z",
  contentSourceEvidence: {
    hotspots: [{ id: "hotspot_1" }],
    viralBlueprints: [{ id: recorded.viralBlueprint.id }]
  }
};
recordContentSourceUsage(store, task);
recordContentSourceUsage(store, task);

assert.deepEqual(store.hotspotLibrary[0].usedByContentIds, [task.id]);
assert.deepEqual(store.viralBlueprintLibrary[0].usedByContentIds, [task.id]);
assert.equal(store.hotspotLibrary[0].lastUsedAt, task.createdAt);
assert.equal(store.viralBlueprintLibrary[0].lastUsedAt, task.createdAt);

console.log(JSON.stringify({
  passed: true,
  referencePosts: store.referencePosts.length,
  viralBlueprints: store.viralBlueprintLibrary.length,
  extractionMode: store.viralBlueprintLibrary[0].extractionMode,
  productionReady: analysis.productionReady,
  hotspotUsage: store.hotspotLibrary[0].usedByContentIds,
  blueprintUsage: store.viralBlueprintLibrary[0].usedByContentIds
}, null, 2));

