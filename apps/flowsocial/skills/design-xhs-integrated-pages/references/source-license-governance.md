# 来源与许可证治理

## 生命周期

外部 Pattern、Style Pack 和 Reference Asset 仅允许按以下相邻状态迁移：

```text
quarantine -> normalized -> experimental -> approved -> deprecated
```

允许停留原状态；不允许跳级、逆向或从 `deprecated` 恢复。FlowSocial 原创资产只有在记录可验证的原创声明、`reviewedBy`、`reviewedAt`、`decision=approved` 和独立审批测试后才能晋级 `approved`。本任务初始库统一保持 `experimental`，不包含已批准资产。

## 生产资格 Gate

生产候选必须同时满足：

- `status=approved`；
- 稳定 ID、`schemaVersion`、来源 URL 或原创 Work Item、许可证 ID；
- 许可证明确允许目标用途；
- 参考资产还需 `allows_generation_reference=true` 和用户授权；
- MIT 复用保留来源、版权声明和许可证文本定位；
- 样图许可证独立核验，代码许可证不能自动覆盖图片；
- 无许可证来源只记录抽象方法，不复制 Prompt、代码、图库或样图。

任一项缺失返回 `SOURCE_LICENSE_INELIGIBLE`。外部 Pattern 即使获批，也只能提供结构与方法，不能提供事实、数字、产品能力、案例、专有名词或 CTA。

## 失败处理

- 未授权资产：返回 `UNAUTHORIZED_REFERENCE_ASSET`，移除资产或改用原创几何元素。
- 非法晋级：返回 `ILLEGAL_ASSET_STATUS_TRANSITION`，退回最近合法状态重新审核。
- 来源不完整：保持 `quarantine`，不得进入实验或生产。
- 内容污染：返回 `PATTERN_CONTENT_INJECTION`，停用 Pattern 并保留审计记录。
