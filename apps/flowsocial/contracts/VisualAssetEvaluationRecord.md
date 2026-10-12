# VisualAssetEvaluationRecord@1.0

记录资产的离线 fixture 评测，不代表人工批准或真实视觉质量通过。

```json
{
  "schemaVersion": "1.0",
  "contract": "VisualAssetEvaluationRecord@1.0",
  "id": "asset-eval:cover.promise:v1",
  "assetId": "cover.promise",
  "assetType": "page_archetype",
  "registrySnapshotRef": "registry:xhs-integrated-page:v1",
  "evaluationMode": "offline_fixture",
  "decision": "retain_experimental | reject | needs_review",
  "evidenceRefs": ["fixture:direction-structure"],
  "observations": [],
  "risks": [],
  "failureModes": [],
  "remediation": [],
  "reviewState": "pending_human_review",
  "productionEligible": false,
  "recordHash": "sha256"
}
```

本合同只允许 `retain_experimental`、`reject` 或 `needs_review`；不得记录 `approved` 决策。上游只读引用 Registry 条目，下游仅用于未来人工评审。回退时删除未接线的评测模块，Registry 和 05B 源文件不变。
