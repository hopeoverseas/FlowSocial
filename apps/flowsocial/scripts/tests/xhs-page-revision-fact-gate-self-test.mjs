import assert from "node:assert/strict";
import { reviseContentPackage } from "../../content-engine.mjs";
import { applyValidatedOperations, evaluateXhsPageFactClaims, projectXhsPageTargets } from "../../content-agent/patch-engine.mjs";
import { rerunRevisionDownstream } from "../../content-agent/revision-rerun-engine.mjs";
import { createXhsVisualStoryboard, validateXhsVisualStoryboard } from "../../content-agent/xhs-visual-storyboard.mjs";

const previousFlag = process.env.XHS_DETERMINISTIC_VISUAL_QUALITY_GATE;
process.env.XHS_DETERMINISTIC_VISUAL_QUALITY_GATE = "1";

const master = {
  central_thesis: "用可核验事实说明服务价值",
  reader_value: "了解服务边界",
  engagement_policy: { selected_primary_action: "consult" },
  confirmed_facts: [
    { fact_id: "F_RESULT", fact: "某外贸工厂使用 AI 数智官后，询盘响应时间从 2 小时缩短到 30 分钟。", source_ids: ["S1"] },
    { fact_id: "F_SERVICE", fact: "FlowSocial 提供内容策略与发布协作服务。", source_ids: ["S2"] }
  ]
};

const baseContent = {
  platform: "xiaohongshu",
  topic_id: "topic_1",
  intent_profile_id: "intent_1",
  content_purpose_id: "knowledge_howto",
  content_promise: "说明服务边界",
  engagement_strategy: { primary_action: "consult", reason: "需要进一步确认" },
  post_copy: {
    title_candidates: ["先确认服务边界", "AI 数智官能做什么", "从事实出发看服务"],
    recommended_title: "先确认服务边界",
    opening: "先看已确认事实。",
    body_sections: [{ heading: "边界", content: "只陈述已确认内容。" }],
    ending: "按实际情况评估。",
    hashtags: ["内容运营"],
    cta: "进一步咨询"
  },
  deck: {
    aspect_ratio: "3:4",
    canvas: { width: 1080, height: 1440 },
    pages: Array.from({ length: 6 }, (_, index) => ({
      page_id: `P${index + 1}`,
      page_number: index + 1,
      page_role: index === 0 ? "cover" : "content",
      headline: index === 0 ? "先确认服务边界" : `服务说明 ${index + 1}`,
      supporting_text: "只陈述已确认内容",
      text_layers: [],
      render_strategy: "html_css",
      visual_direction: "克制的信息卡",
      fact_ids: [],
      interpretation_ids: []
    }))
  },
  image_specs: [],
  skipped_image_pages: ["P1", "P2", "P3", "P4", "P5", "P6"],
  traceability: {}
};

const task = {
  id: "content_fixture",
  version: 2,
  platform: "xiaohongshu",
  ideaTitle: "服务边界",
  contentIntentProfile: { profile_id: "intent_1", purpose: { id: "knowledge_howto" } },
  contentMaster: master,
  currentContent: structuredClone(baseContent)
};

const projection = projectXhsPageTargets(baseContent, "压缩第 5 页，并只保留有来源的效果");
assert.deepEqual(projection.map((page) => [page.page_id, page.json_pointer]), [["P5", "/deck/pages/4"]]);

const idAddressed = applyValidatedOperations(baseContent, [{ op: "replace", path: "/deck/pages/P5/headline", value: "可核验的服务结果" }], { allowedPrefixes: ["/deck/pages"], lockedPrefixes: [] });
assert.equal(idAddressed.operations[0].path, "/deck/pages/4/headline");
assert.equal(idAddressed.content.deck.pages[4].headline, "可核验的服务结果");

const supportedText = "某外贸工厂使用 AI 数智官后，询盘响应时间从 2 小时缩短到 30 分钟";
const successPatch = {
  status: "success",
  data: {
    operations: [
      { op: "replace", path: "/deck/pages/P5/headline", value: "询盘响应时间有据可查" },
      { op: "replace", path: "/deck/pages/P5/supporting_text", value: supportedText },
      { op: "replace", path: "/deck/pages/P5/fact_ids", value: ["F_RESULT"] }
    ]
  }
};
let capturedPrompt;
const revised = await reviseContentPackage({ task, instruction: "压缩第 5 页，并只保留有来源的效果", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async (request) => { capturedPrompt = request; return { mode: "offline_fixture", data: successPatch }; }
});
assert.equal(capturedPrompt.input.page_projection[0].json_pointer, "/deck/pages/4");
assert.equal(revised.qualityReview.status, "passed");
assert.equal(revised.versionProjection.baseVersion, 2);
assert.equal(revised.versionProjection.proposedVersion, 3);
assert.deepEqual(revised.versionProjection.invalidatedNodes, ["storyboard", "render", "visual_review", "delivery"]);
assert.equal(revised.contentPackage.deck.pages[4].supporting_text, supportedText);
assert.deepEqual(task.currentContent, baseContent, "修订投影不得原地覆盖 V2");

const versions = [{ version: 2, parentVersion: 1, content: structuredClone(task.currentContent), manifest: { version: 2, sha256: "historical" } }];
versions.push({ version: revised.versionProjection.proposedVersion, parentVersion: revised.versionProjection.baseVersion, content: structuredClone(revised.contentPackage) });
assert.equal(versions[1].parentVersion, 2);
assert.deepEqual(versions[0].content, baseContent);
assert.deepEqual(versions[0].manifest, { version: 2, sha256: "historical" });

const unrelated = structuredClone(baseContent);
unrelated.deck.pages[4].supporting_text = "真实案例：外贸工厂询盘响应时间缩短，转化率提升";
unrelated.deck.pages[4].fact_ids = ["F_SERVICE"];
const unrelatedGate = evaluateXhsPageFactClaims(unrelated, master);
assert.equal(unrelatedGate.status, "blocked");
assert.equal(unrelatedGate.failures[0].reason, "FACT_SEMANTIC_MISMATCH");
assert.equal("claim" in unrelatedGate.failures[0], false, "诊断不得泄露完整页面文案");

const missingEvidence = structuredClone(unrelated);
missingEvidence.deck.pages[4].fact_ids = [];
assert.equal(evaluateXhsPageFactClaims(missingEvidence, master).failures[0].reason, "FACT_EVIDENCE_MISSING");

let emptyCalls = 0;
const empty = await reviseContentPackage({ task, instruction: "压缩第 5 页", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async () => { emptyCalls += 1; return { mode: "offline_fixture", data: { status: "needs_review", data: { operations: [] } } }; }
});
assert.equal(emptyCalls, 2);
assert.equal(empty.patch.operations.length, 0);
assert(empty.qualityReview.blockers.includes("requested_change_not_applied"));
assert.equal(empty.contentPackage.deck.pages[4].supporting_text, baseContent.deck.pages[4].supporting_text);

const outOfScope = await reviseContentPackage({ task, instruction: "压缩第 5 页", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async () => ({ mode: "offline_fixture", data: { status: "success", data: { operations: [{ op: "replace", path: "/post_copy/recommended_title", value: "越权修改" }] } } })
});
assert.equal(outOfScope.patch.operations.length, 0);
assert.equal(outOfScope.patch.blockedOperations[0].path, "/post_copy/recommended_title");
assert(outOfScope.qualityReview.blockers.includes("requested_change_not_applied"));

const wrongPage = await reviseContentPackage({ task, instruction: "只修改第 5 页", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async () => ({ mode: "offline_fixture", data: { status: "success", data: { operations: [{ op: "replace", path: "/deck/pages/5/headline", value: "越权修改 P6" }] } } })
});
assert.equal(wrongPage.patch.operations.length, 0);
assert.equal(wrongPage.patch.blockedOperations[0].path, "/deck/pages/5/headline");
assert(wrongPage.qualityReview.blockers.includes("requested_change_not_applied"));
assert.equal(wrongPage.contentPackage.deck.pages[5].headline, baseContent.deck.pages[5].headline);

const nonEditableField = await reviseContentPackage({ task, instruction: "只修改第 5 页", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async () => ({ mode: "offline_fixture", data: { status: "success", data: { operations: [{ op: "replace", path: "/deck/pages/4/render_strategy", value: "generated_raster" }] } } })
});
assert.equal(nonEditableField.patch.operations.length, 0);
assert.equal(nonEditableField.patch.blockedOperations[0].path, "/deck/pages/4/render_strategy");
assert(nonEditableField.qualityReview.blockers.includes("requested_change_not_applied"));

const ambiguousCard = await reviseContentPackage({ task, instruction: "把这张卡片压缩一下", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async () => ({ mode: "offline_fixture", data: { status: "success", data: { operations: [{ op: "replace", path: "/deck/pages/4/supporting_text", value: "不得猜测目标页" }] } } })
});
assert.deepEqual(ambiguousCard.patch.allowedPrefixes, []);
assert.equal(ambiguousCard.patch.operations.length, 0);
assert(ambiguousCard.qualityReview.blockers.includes("requested_change_not_applied"));

const overflowTask = structuredClone(task);
overflowTask.currentContent.deck.pages[4].supporting_text = "容量不可降低".repeat(40);
const overflowStoryboard = createXhsVisualStoryboard(overflowTask);
const capacityCheck = validateXhsVisualStoryboard(overflowStoryboard).checks.find((check) => check.check === "template_capacity");
assert.equal(capacityCheck.result, "fail");
assert(capacityCheck.detail.capacityOverflow.includes("P5"));

process.env.XHS_DETERMINISTIC_VISUAL_QUALITY_GATE = "0";
let flagOffPrompt;
const flagOff = await reviseContentPackage({ task, instruction: "压缩第 5 页", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async (request) => {
    flagOffPrompt = request;
    return { mode: "offline_fixture", data: { status: "success", data: { operations: [{ op: "replace", path: "/deck/pages/4/supporting_text", value: "兼容旧索引路径" }] } } };
  }
});
assert.deepEqual(flagOffPrompt.input.page_projection.map((page) => page.page_id), ["P5"]);
assert.deepEqual(flagOffPrompt.input.allowed_paths, [
  "/deck/pages/4/headline",
  "/deck/pages/4/supporting_text",
  "/deck/pages/4/text_layers",
  "/deck/pages/4/fact_ids",
  "/deck/pages/4/interpretation_ids"
]);
assert.equal(flagOff.contentPackage.deck.pages[4].supporting_text, "兼容旧索引路径");
assert.equal(flagOff.qualityReview.checks.find((check) => check.check === "page_claims_semantically_traceable").detail.status, "disabled");

process.env.XHS_DETERMINISTIC_VISUAL_QUALITY_GATE = "1";
const unsupportedRevision = await reviseContentPackage({ task, instruction: "将第 5 页改为案例成效", routing: { requestClass: "page_text", executionMode: "local_patch" } }, {
  generateText: async () => ({ mode: "offline_fixture", data: { status: "success", data: { operations: [
    { op: "replace", path: "/deck/pages/4/supporting_text", value: "真实案例：外贸工厂询盘响应时间缩短，转化率提升" },
    { op: "replace", path: "/deck/pages/4/fact_ids", value: ["F_SERVICE"] }
  ] } } })
});
assert(unsupportedRevision.qualityReview.blockers.includes("page_claims_semantically_traceable"));
const downstream = await rerunRevisionDownstream({
  task,
  contentPackage: unsupportedRevision.contentPackage,
  revisionImpact: { changedPaths: ["/deck/pages/4/supporting_text", "/deck/pages/4/fact_ids"], affectedSteps: ["schema_and_reference", "render", "visual_review"] },
  instruction: "将第 5 页改为案例成效"
}, { generateText: async () => { throw new Error("XHS page_text downstream must stay offline and deterministic"); } });
assert.equal(downstream.qualityReview.status, "needs_review");
assert.equal(downstream.qualityReview.decision, "block");
assert(downstream.qualityReview.blockers.includes("page_claims_semantically_traceable"));
assert.equal(downstream.qualityReview.checks.find((check) => check.check === "page_claims_semantically_traceable").result, "fail");

if (previousFlag == null) delete process.env.XHS_DETERMINISTIC_VISUAL_QUALITY_GATE;
else process.env.XHS_DETERMINISTIC_VISUAL_QUALITY_GATE = previousFlag;

console.log("xhs page revision fact gate self-test passed", {
  projectedPage: projection[0].page_id,
  proposedVersion: revised.versionProjection.proposedVersion,
  semanticFailures: unrelatedGate.failures.length,
  capacityStatus: capacityCheck.result
});
