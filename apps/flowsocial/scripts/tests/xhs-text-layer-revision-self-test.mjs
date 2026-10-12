import assert from "node:assert/strict";
import { applyValidatedOperations, contentBodySnapshot, describeContentChange, validateRevisionChange } from "../../content-agent/patch-engine.mjs";

const v2 = {
  post_copy: {
    recommended_title: "AI 数智官落地前先看三个问题",
    opening: "先确认资料、场景和协作流程。",
    body_sections: [{ heading: "落地条件", content: "从已有事实出发。" }],
    ending: "逐步落地。",
    cta: "按实际情况评估",
    hashtags: ["企业AI", "内容运营"]
  },
  deck: {
    pages: Array.from({ length: 7 }, (_, index) => ({
      page_id: `P${index + 1}`,
      headline: `第${index + 1}页`,
      supporting_text: `原有第${index + 1}页说明`,
      text_layers: [{ type: "body", text: `原有第${index + 1}页正文` }],
      fact_ids: index === 2 ? ["F_SERVICE"] : [],
      interpretation_ids: []
    }))
  },
  preflight_checks: [{ check: "legacy", result: "pass" }],
  title_strategy: { selected: "T1" },
  image_specs: [{ page_id: "P2", prompt: "legacy visual" }]
};
const frozenV2 = structuredClone(v2);

const realOperations = [
  { op: "replace", path: "/deck/pages/0/text_layers", value: ["AI数智官落地前，先看这3个问题", { type: "body", content: "企业资料、业务场景、协作流程" }] },
  { op: "replace", path: "/deck/pages/2/text_layers", value: [{ type: "headline", value: "AI数智官不只是聊天工具" }, { type: "body", items: ["面向企业AI应用落地", { content: "服务外贸工厂等客户" }] }] },
  { op: "replace", path: "/deck/pages/2/fact_ids", value: ["F_AI", "F_CUSTOMER"] },
  { op: "replace", path: "/deck/pages/4/text_layers", value: [{ type: "body", text: "有可用资料吗？场景明确吗？协作顺畅吗？" }] },
  { op: "replace", path: "/deck/pages/5/text_layers", value: [{ type: "body", content: "盘点资料、明确场景、逐步落地" }] },
  { op: "replace", path: "/deck/pages/6/text_layers", value: [{ type: "headline", text: "已确认的服务内容" }, { type: "body", value: "AI数智官、B2B独立站增长全案、海外社媒运营" }] }
];
const patched = applyValidatedOperations(v2, realOperations, { allowedPrefixes: ["/deck/pages"], lockedPrefixes: [] });
assert.deepEqual(patched.operations.map((operation) => operation.path), realOperations.map((operation) => operation.path));
const realChange = validateRevisionChange("xiaohongshu", "按明确页面压缩和改写现有文案", v2, patched.content);
assert.equal(realChange.accepted, true);
assert.equal(realChange.change.contentChanged, true);
assert.equal(realChange.change.bodyChanged, true);
assert.notEqual(realChange.change.beforeFingerprint, realChange.change.afterFingerprint);
for (const path of ["/deck/pages/0/text_layers", "/deck/pages/2/text_layers", "/deck/pages/2/fact_ids", "/deck/pages/4/text_layers", "/deck/pages/5/text_layers", "/deck/pages/6/text_layers"]) {
  assert(realChange.change.changedPaths.some((changedPath) => changedPath === path || changedPath.startsWith(`${path}/`)), `missing real changed path ${path}`);
}
assert.deepEqual(v2, frozenV2, "V2 输入不得被 Patch 或版本检测原地修改");

const textOnly = structuredClone(v2);
textOnly.deck.pages[0].text_layers = [{ type: "body", text: "只修改真实渲染文字" }];
assert.equal(describeContentChange("xiaohongshu", v2, textOnly).bodyChanged, true);

const factOnly = structuredClone(v2);
factOnly.deck.pages[2].fact_ids = ["F_SERVICE", "F_CUSTOMER"];
const factChange = describeContentChange("xiaohongshu", v2, factOnly);
assert.equal(factChange.bodyChanged, true);
assert.equal(factChange.bodyLengthDelta, 0, "事实绑定参与指纹，但不得伪造正文字数增量");

const interpretationOnly = structuredClone(v2);
interpretationOnly.deck.pages[2].interpretation_ids = ["I_BOUNDARY"];
assert.equal(describeContentChange("xiaohongshu", v2, interpretationOnly).bodyChanged, true);

const kindOnly = structuredClone(v2);
kindOnly.deck.pages[0].text_layers[0].type = "very_long_headline_role";
const kindChange = describeContentChange("xiaohongshu", v2, kindOnly);
assert.equal(kindChange.bodyChanged, true, "渲染角色变化仍应进入版本指纹");
assert.equal(kindChange.bodyLengthDelta, 0, "type/role/kind 不得计入可见正文字数");
const kindExpansion = validateRevisionChange("xiaohongshu", "内容太少，请扩写", v2, kindOnly);
assert.equal(kindExpansion.accepted, false);
assert.equal(kindExpansion.code, "REVISION_EXPANSION_NOT_APPLIED");

const derivedOnly = structuredClone(v2);
derivedOnly.preflight_checks = [{ check: "new", result: "fail" }];
derivedOnly.title_strategy = { selected: "T2", diagnostics: ["changed"] };
derivedOnly.image_specs = [{ page_id: "P5", prompt: "derived change" }];
const derivedChange = validateRevisionChange("xiaohongshu", "只刷新派生元数据", v2, derivedOnly);
assert.equal(derivedChange.accepted, false);
assert.equal(derivedChange.code, "REVISION_NO_CONTENT_CHANGE");
assert.equal(derivedChange.change.contentChanged, true);
assert.equal(derivedChange.change.bodyChanged, false);

const sortingNoise = structuredClone(v2);
sortingNoise.deck.pages[2].text_layers = [{ text: "  原有第3页正文  ", type: "BODY" }];
sortingNoise.deck.pages[2].fact_ids = ["F_EXTRA", "F_SERVICE"];
sortingNoise.deck.pages[2].interpretation_ids = ["I2", "I1"];
const sortingBaseline = structuredClone(v2);
sortingBaseline.deck.pages[2].fact_ids = ["F_SERVICE", "F_EXTRA"];
sortingBaseline.deck.pages[2].interpretation_ids = ["I1", "I2"];
assert.deepEqual(contentBodySnapshot("xiaohongshu", sortingNoise), contentBodySnapshot("xiaohongshu", sortingBaseline));
assert.equal(describeContentChange("xiaohongshu", sortingBaseline, sortingNoise).bodyChanged, false);
const layerShapeBaseline = structuredClone(v2);
layerShapeBaseline.deck.pages[1].text_layers = ["相同可见文案"];
const layerShapeNoise = structuredClone(v2);
layerShapeNoise.deck.pages[1].text_layers = [{ content: "  相同可见文案  " }];
assert.equal(describeContentChange("xiaohongshu", layerShapeBaseline, layerShapeNoise).bodyChanged, false);

const exactNoop = validateRevisionChange("xiaohongshu", "保持不变", v2, structuredClone(v2));
assert.equal(exactNoop.accepted, false);
assert.equal(exactNoop.code, "REVISION_NO_CONTENT_CHANGE");

const factExpansion = validateRevisionChange("xiaohongshu", "内容太少，请扩写", v2, factOnly);
assert.equal(factExpansion.accepted, false);
assert.equal(factExpansion.code, "REVISION_EXPANSION_NOT_APPLIED");

const shorter = structuredClone(v2);
shorter.deck.pages[4].text_layers = [{ type: "body", text: "精简文案" }];
const invalidExpansion = validateRevisionChange("xiaohongshu", "内容太少，请扩写第5页", v2, shorter);
assert.equal(invalidExpansion.accepted, false);
assert.equal(invalidExpansion.code, "REVISION_EXPANSION_NOT_APPLIED");
assert(invalidExpansion.change.bodyLengthDelta < 0);

const compression = validateRevisionChange("xiaohongshu", "压缩第5页", v2, shorter);
assert.equal(compression.accepted, true);
assert(compression.change.bodyLengthDelta < 0);

const expanded = structuredClone(v2);
expanded.deck.pages[4].text_layers = [{ type: "body", text: "原有第5页正文，并补充适用条件、执行步骤和明确边界。" }];
const validExpansion = validateRevisionChange("xiaohongshu", "内容太少，请扩写第5页", v2, expanded);
assert.equal(validExpansion.accepted, true);
assert(validExpansion.change.bodyLengthDelta > 0);

const nestedItemsLonger = structuredClone(v2);
nestedItemsLonger.deck.pages[1].text_layers = [{ type: "list", items: ["第一项", { content: "第二项补充更多可见文字", items: [{ value: "嵌套说明" }] }] }];
const nestedLongerChange = describeContentChange("xiaohongshu", v2, nestedItemsLonger);
assert(nestedLongerChange.bodyLengthDelta > 0, "递归 items 可见文字增加必须形成正 delta");
const nestedItemsShorter = structuredClone(nestedItemsLonger);
nestedItemsShorter.deck.pages[1].text_layers = [{ type: "list", items: ["短项"] }];
const nestedShorterChange = describeContentChange("xiaohongshu", nestedItemsLonger, nestedItemsShorter);
assert(nestedShorterChange.bodyLengthDelta < 0, "递归 items 可见文字减少必须形成负 delta");

const deleted = structuredClone(v2);
deleted.deck.pages[4].text_layers = [];
const deletion = validateRevisionChange("xiaohongshu", "删除第5页无来源表述", v2, deleted);
assert.equal(deletion.accepted, true);
assert(deletion.change.bodyLengthDelta < 0);

assert.deepEqual(v2, frozenV2, "所有检测完成后 V2 仍须保持不变");
console.log("xhs text layer revision self-test passed", {
  realOperationCount: realOperations.length,
  realChangedPathCount: realChange.change.changedPaths.length,
  factOnlyDelta: factChange.bodyLengthDelta,
  compressionDelta: compression.change.bodyLengthDelta
});
