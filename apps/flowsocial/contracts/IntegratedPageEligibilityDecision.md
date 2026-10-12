# IntegratedPageEligibilityDecision@1.0

记录单页从执行计划到候选选择之间的独立资格状态。Provider 成功、原生尺寸、规范化、最终画布、OCR、事实、视觉、用户选中和交付不得合并。

## 核心字段

```json
{
  "schemaVersion": "1.0",
  "contract": "IntegratedPageEligibilityDecision@1.0",
  "planRef": {"id": "", "hash": "sha256"},
  "pageId": "P1",
  "providerStatus": "not_called | succeeded | failed",
  "providerNativeDimensions": null,
  "providerNativeDimensionStatus": "pending | passed | failed",
  "normalizationStatus": "not_run | succeeded | blocked",
  "finalDeliveryDimensionStatus": "pending | passed | blocked",
  "gates": {"ocr": "not_run", "fact": "not_run", "visual": "not_run"},
  "userSelectionStatus": "not_selected",
  "deliveryStatus": "not_delivered",
  "eligibleStage": "provider_execution | candidate_selection | blocked",
  "productionEligible": false,
  "blockers": [],
  "decisionHash": "sha256"
}
```

原生尺寸非 1080×1440 只记录 `failed`；若安全等比规范化后的最终字节为精确 1080×1440，且 OCR、事实和视觉 Gate 全部通过，可进入 `candidate_selection`。非等比拉伸、受保护区域裁切、最终尺寸或任一 Gate 失败必须阻断。

## 上下游、迁移与回退

- 上游只读引用 `IntegratedPageExecutionPlan@1.0`，不得修改计划或 Provider 原始事实。
- 下游用户选择、页面版本和交付继续创建各自状态与证据，不由本决定自动推进。
- 无数据迁移；历史质量未知对象继续由既有 Adapter 读取。
- 回退为保留证据并显式选择 `deterministic_layout`；关闭 Flag 不删除已有决定。
