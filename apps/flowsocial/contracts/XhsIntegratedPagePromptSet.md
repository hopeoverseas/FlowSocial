# XhsIntegratedPagePromptSet@1.0

冻结一套小红书整页提示规格及其跨页选择。该合同只用于离线设计阶段，不是页面版本、视觉候选或交付 Manifest。

```json
{
  "schemaVersion": "1.0",
  "contract": "XhsIntegratedPagePromptSet@1.0",
  "id": "prompt-set:set-001:v1",
  "status": "draft",
  "sourcePackage": {"contract": "XhsPostPackage@2.0", "contentVersion": 1, "readOnly": true},
  "visualStyleSelection": {
    "schemaVersion": "1.0",
    "id": "style-selection:set-001:v1",
    "stylePackId": "structured-infographic",
    "stylePackVersion": "1.0",
    "source": {"kind": "flowsocial_original", "workItem": "FS-V1-XHS-VISUAL-05B", "license": "FlowSocial-Proprietary-Original"},
    "status": "experimental",
    "designDnaSnapshotId": "design-dna-001",
    "selectionReason": "离线评测选择",
    "appliesToPageIds": ["P1"],
    "constraints": [],
    "fallbackStylePackId": "structured-infographic",
    "visualSelectionGate": {"status": "pending_user_review", "selectedBy": null, "selectedAt": null},
    "productionEligible": false
  },
  "pagePromptSpecs": [{
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
      "protectedTerms": [],
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
  }],
  "crossPageRules": {
    "singleStylePack": true,
    "stablePalette": true,
    "stableTypographyRoles": true,
    "repetitionLimit": 2
  },
  "visualSelectionGate": {"status": "pending_user_review", "selectedBy": null, "selectedAt": null},
  "productionEligible": false,
  "blockers": [],
  "trace": {
    "libraryVersion": "1.0",
    "networkCalls": 0,
    "providerCalls": 0,
    "databaseWrites": 0
  }
}
```

顶层字段集合固定为：`schemaVersion`、`contract`、`id`、`status`、`sourcePackage`、`visualStyleSelection`、`pagePromptSpecs`、`crossPageRules`、`visualSelectionGate`、`productionEligible`、`blockers`、`trace`。不得使用其他字段别名。嵌入的 `visualStyleSelection` 和每个 `pagePromptSpecs[]` 必须分别满足完整 `VisualStyleSelection@1.0` 与 `PagePromptSpec@1.0`，不能只包含 ID。

## 状态

- `draft`：离线页面真值、来源、许可证、授权和能力门禁通过，但实验资产尚未获得正式审核，用户也未完成视觉选择。
- `blocked`：至少一个硬门禁失败；调用方不得发起 Provider 请求。

所有输出固定 `productionEligible=false`，且 `visualSelectionGate.status=pending_user_review`。该合同不得记录候选选择、OCR 结果、Provider 任务、资产版本或交付状态。后续合同只能引用本冻结版本，不得原地改写。
