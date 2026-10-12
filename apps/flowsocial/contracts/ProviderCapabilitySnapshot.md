# ProviderCapabilitySnapshot@1.0

冻结一次 Provider-neutral 离线能力摘要，不包含密钥、网络端点、Provider 选择或生产能力声明。

```json
{
  "schemaVersion": "1.0",
  "contract": "ProviderCapabilitySnapshot@1.0",
  "id": "capability:offline-full-page:v1",
  "source": "offline_fixture",
  "status": "complete",
  "productionVerified": false,
  "capabilities": {
    "integratedChineseTypography": true,
    "referenceImages": true,
    "exactDimensions": true,
    "supportedDimensions": [{"width": 1080, "height": 1440}],
    "maxCandidateCount": 3,
    "maskEditing": false,
    "preserveRegions": false,
    "seedControl": false,
    "asyncJobs": false
  },
  "snapshotHash": "sha256"
}
```

## 规则与兼容

- Compiler 只做能力检查，不从多个快照中选择 Provider，也不推断缺失能力。
- 上游可将现有能力摘要只读投影到本字段集；缺字段返回 `MISSING_CAPABILITY`。
- 下游只引用 `id` 与 `snapshotHash`，不得把 `productionVerified=false` 描述为真实质量通过。
- 回退：关闭 `xhsIntegratedPageProviderCompiler`；快照仍可读，无数据迁移。
