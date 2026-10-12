# VisualStyleSelection@1.0

记录一套整页提示选择的 Style Pack、来源资格和确定性理由。

```json
{
  "schemaVersion": "1.0",
  "id": "style-selection:set-001:v1",
  "stylePackId": "structured-infographic",
  "stylePackVersion": "1.0",
  "source": {"kind": "flowsocial_original", "workItem": "FS-V1-XHS-VISUAL-05B", "license": "FlowSocial-Proprietary-Original"},
  "status": "experimental",
  "designDnaSnapshotId": "design-dna-001",
  "selectionReason": "高信息密度需要稳定网格和清晰层级",
  "appliesToPageIds": ["P1", "P2"],
  "constraints": [],
  "fallbackStylePackId": "structured-infographic",
  "visualSelectionGate": {"status": "pending_user_review", "selectedBy": null, "selectedAt": null},
  "productionEligible": false
}
```

字段集合固定为：`schemaVersion`、`id`、`stylePackId`、`stylePackVersion`、`source`、`status`、`designDnaSnapshotId`、`selectionReason`、`appliesToPageIds`、`constraints`、`fallbackStylePackId`、`visualSelectionGate`、`productionEligible`。

本任务初始 Style Pack 均为 `experimental`，只能用于离线评测，不具备生产资格。仅未来具有独立审核证据的 `approved` Style Pack 才可进入生产候选；外部 Style Pack 还必须经过 `quarantine -> normalized -> experimental -> approved` 相邻晋级。本合同不能执行晋级、批准或用户选择。缺失 Design DNA 时返回 blocker，除非调用方显式允许已登记的中性原创回退。
