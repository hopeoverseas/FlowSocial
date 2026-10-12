# VisualAssetRegistrySnapshot@1.0

按引用登记 Page Archetype、Style Pack、Prompt Pattern 和 Reference Asset，不复制 05B 文件内容。

```json
{
  "schemaVersion": "1.0",
  "contract": "VisualAssetRegistrySnapshot@1.0",
  "id": "registry:xhs-integrated-page:v1",
  "lifecycle": ["quarantine", "normalized", "experimental", "approved", "deprecated"],
  "sourceLibraries": [{"library": "PageArchetypeLibrary", "schemaVersion": "1.0", "sourceRef": "skills/design-xhs-integrated-pages/references/page-archetypes.json", "sourceHash": "sha256"}],
  "entries": [{
    "id": "cover.promise",
    "assetType": "page_archetype",
    "sourceRef": "skills/design-xhs-integrated-pages/references/page-archetypes.json",
    "sourceHash": "sha256",
    "status": "experimental",
    "license": {"id": "FlowSocial-Proprietary-Original", "allowsOfflineCompilation": true, "allowsGenerationReference": false},
    "authorization": null,
    "applicabilityHash": "sha256",
    "failureModesHash": "sha256",
    "entryHash": "sha256"
  }],
  "productionQuery": {"status": "blocked_no_approved_assets", "eligibleAssetIds": [], "blocker": {"code": "NO_APPROVED_ASSETS", "scope": "productionQuery", "detail": "本任务禁止 approved", "fallback": "deterministic_layout"}},
  "snapshotHash": "sha256"
}
```

## 治理

- 生命周期只允许相邻迁移；本任务即使面对 `experimental -> approved` 也必须返回 `APPROVED_ASSET_FORBIDDEN`。
- 05B 的 6/3/15 个稳定 ID 仅以来源引用和 hash 登记为 `experimental`，不复制、不改状态。
- `entries[].id` 在 Page Archetype、Style Pack、Prompt Pattern 与 Reference Asset 合并后必须全局唯一；构建器和 Snapshot validator 都必须拒绝任意跨类型重复 ID。
- Reference Asset 需独立许可证和授权证据；授权不等于资产获批。
- 禁止网络更新、GitHub 拉取、自动学习、自动晋级和生产查询放行。
- 上游是 05B 冻结库；构建器遇到重复 ID 不重命名、不覆盖，硬失败为 `REGISTRY_DUPLICATE_ASSET_ID`。`validateVisualAssetRegistrySnapshot` 会拒绝手工或旧 Snapshot 中的重复 ID，兼容调用方必须把该只读校验错误呈现为 blocker，不原地修复。下游 Compiler 只消费冻结 snapshot。回退时关闭 `xhsVisualAssetRegistry` 并移除离线查询即可，无数据迁移。
