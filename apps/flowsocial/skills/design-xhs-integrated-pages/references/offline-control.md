# 整页视觉离线审阅、Compiler 与 Registry

仅在 `FS-V1-XHS-VISUAL-05C-R` 的离线边界内使用本流程。

## 审阅顺序

1. 为候选记录 Archetype 计划、构图模型、层级策略、图片角色、来源、许可证、风险与能力状态；仅换颜色的候选必须阻断。
2. 独立完成 `visualDirectionSelection`，再独立完成 `promptReview`。
3. 始终保持 `costConfirmation.status=pending`；不得将 Prompt 批准解释为费用确认。
4. 输出 `PromptReviewDecision@1.0`，保留冻结 Prompt Set hash、完整候选 refs、候选集合 hash、结构证据 hash 和选中候选 ref/hash。任何 blocker 都使 `overallStatus=blocked`。

## Compiler

只调用 `image-providers/xhs-integrated-page/compiler.mjs` 的纯函数。输入冻结 Prompt Set、审阅决策、能力快照、Registry 快照、原始 05B 库定义和显式编译选项。输出 `CompiledPageGenerationRequest@1.0` 与 `ProviderCompilationTrace@1.0`。

- 不选择 Provider；`execution.provider=null`。
- 不执行请求；网络、Provider、重试、费用和数据库写入计数均为 0。
- 阻断事实改写、Prompt 注入、缺失能力、未授权资产、候选数越界、尺寸不支持及 Mask/锁区误声明。
- 重新计算视觉候选集合、结构证据和选中候选 hash；来源、许可证、风险或能力状态等同 ID 替换必须阻断。审阅决策含 blocker 或未达到 `awaiting_cost_confirmation` 时不得编译为待费用确认。
- Trace 使用完整对象 `traceHash` 并与已验证请求 hash 交叉核验；没有配套请求时不得单独宣称 Trace 有效。
- blocker 只建议显式 `deterministic_layout`，不执行回退。

## Registry

使用 `registry.mjs` 只登记 05B 文件引用、稳定 ID 和 hash。生命周期严格为：

```text
quarantine -> normalized -> experimental -> approved -> deprecated
```

本任务禁止进入 `approved`，生产查询必须为空。四类 Registry entry ID 必须全局唯一，Reference Asset 不得覆盖任何 05B 稳定 ID。Reference Asset 的授权与许可证只允许离线编译，不等于资产批准。禁止自动导入、自动学习、自动晋级或网络更新。

## 合同

读取仓库唯一 Contracts 根目录中的 `PromptReviewDecision@1.0`、`ProviderCapabilitySnapshot@1.0`、`CompiledPageGenerationRequest@1.0`、`ProviderCompilationTrace@1.0`、`VisualAssetRegistrySnapshot@1.0` 和 `VisualAssetEvaluationRecord@1.0`。所有 Adapter 只读，关闭三个 Feature Flag 即停止新离线流程，不改写 05B 或历史对象。
