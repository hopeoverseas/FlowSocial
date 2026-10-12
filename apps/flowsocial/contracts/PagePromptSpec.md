# PagePromptSpec@1.0

小红书单页整页图文提示的 Provider-neutral 离线合同。它引用只读 `PageContentTruth@1.0`，不能替代内容真值或直接代表 Provider 请求。

```json
{
  "schemaVersion": "1.0",
  "id": "page-prompt:P1:v1",
  "pageId": "P1",
  "contentTruth": {
    "schemaVersion": "1.0",
    "pageId": "P1",
    "contentVersion": 1,
    "pageRole": "cover",
    "headline": "企业社媒，别只追单篇爆款",
    "supportingText": ["从策略诊断到发布复盘"],
    "labels": [],
    "cta": null,
    "factIds": ["F1"],
    "interpretationIds": [],
    "protectedTerms": ["ContentRun"],
    "forbiddenClaims": []
  },
  "pageArchetypeId": "cover.promise",
  "visualStyleSelectionRef": "style-selection:set-001:v1",
  "promptPatternIds": ["pattern.hierarchy.promise-focus"],
  "promptBlocks": {
    "verbatimText": ["企业社媒，别只追单篇爆款", "从策略诊断到发布复盘"],
    "composition": [],
    "style": [],
    "negativeConstraints": []
  },
  "referenceAssetIds": [],
  "expectedTextHash": "0000000000000000000000000000000000000000000000000000000000000000",
  "fallback": {"mode": "none", "reasons": []}
}
```

字段集合固定为：

- PagePromptSpec：`schemaVersion`、`id`、`pageId`、`contentTruth`、`pageArchetypeId`、`visualStyleSelectionRef`、`promptPatternIds`、`promptBlocks`、`referenceAssetIds`、`expectedTextHash`、`fallback`；
- PageContentTruth：`schemaVersion`、`pageId`、`contentVersion`、`pageRole`、`headline`、`supportingText`、`labels`、`cta`、`factIds`、`interpretationIds`、`protectedTerms`、`forbiddenClaims`；
- promptBlocks：`verbatimText`、`composition`、`style`、`negativeConstraints`；
- fallback：`mode`、`reasons`。

## 不变量

- `verbatimText` 必须由 `contentTruth` 原样且完整投影，顺序和字符均不可改写。
- Pattern、Style Pack 和参考资产不得引入事实、数字、产品能力或 CTA。
- `referenceAssetIds` 必须来自本次输入的已授权资产，且许可证允许生成参考。
- 任一门禁失败时写入 blocker，并将 `fallback.mode` 设为 `deterministic_layout`；不得静默生成。

## 兼容 Adapter

`XhsPostPackage@2.0 -> PageContentTruth@1.0` 为纯只读投影。缺失页码、角色、必要文字或文字层内容时返回 `INPUT_TRUTH_INCOMPLETE`，不补写、不猜测、不回写旧包。回退时删除新入口或关闭 Flag 即可，历史包无需迁移。
