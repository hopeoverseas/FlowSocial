# IntegratedPageExecutionPlan@1.0

隔离实验整页 Provider 执行计划。它只冻结可执行字段，不执行网络请求，也不表示生产资格或视觉质量通过。

## 输入

- 经 `design-xhs-integrated-pages` 实际调用产生的 Prompt Set、Skill 定义 hash、三类库快照 hash 和逐页资产 hash；
- 已选择视觉方向、已批准 Prompt、独立费用确认；
- `ProviderCapabilitySnapshot@1.0`、`VisualAssetRegistrySnapshot@1.0`；
- 显式 Provider、model、候选数、质量字段和默认关闭 Feature Flag。

旧 `CompiledPageGenerationRequest@1.0` 与 `ProviderCompilationTrace@1.0` 只读消费。旧 Compiler 的精确尺寸 blocker 仅可在安全规范化政策完整时重分类为原生能力事实；其他 blocker 原样传播。

## 核心字段

```json
{
  "schemaVersion": "1.0",
  "contract": "IntegratedPageExecutionPlan@1.0",
  "mode": "isolated_experimental",
  "skillBinding": {"name": "design-xhs-integrated-pages", "invocationHash": "sha256", "promptSetRef": {"id": "", "hash": "sha256"}},
  "provider": {"id": "kie.ai", "model": "nano-banana-2", "lifecycle": "experimental", "adapter": {"id": "kie-jobs-nano-banana-2", "version": "1.0", "projectionKey": "nano-banana-2.v1"}},
  "cost": {"status": "confirmed", "confirmationHash": "sha256", "estimatedTotal": 0},
  "pages": [],
  "states": {"visualDirection": "selected", "promptReview": "approved", "costConfirmation": "confirmed", "provider": "not_called", "ocr": "not_run", "fact": "not_run", "visual": "not_run", "userSelection": "not_selected", "delivery": "not_delivered"},
  "productionEligible": false,
  "execution": {"status": "blocked", "networkCalls": 0, "providerCalls": 0, "retries": 0, "actualCost": 0, "databaseWrites": 0},
  "inputHash": "sha256",
  "planHash": "sha256"
}
```

`provider.id`、`provider.model` 与 `provider.adapter` 分别表示服务商身份、模型入口和请求投影实现。`adapter.projectionKey` 冻结字段投影；兼容同一投影的未来 Provider 可以复用该 projection，而不修改 `IntegratedPageExecutionPlan@1.0`。新增字段投影必须注册新 projection key 并通过合同测试，禁止按 Provider 名称隐式推断请求结构。

每页必须绑定内容真值、Archetype、Style Pack、Pattern、Reference Asset、旧 Compiler request/trace、Prompt 分段、Provider request、原生尺寸资格、最终交付资格、预计费用、blocker 和 `pageHash`。Provider request 只能从计划物化；接口不接受 Prompt、模型或字段覆盖。

## 上下游、迁移与回退

- 上游：冻结 Prompt Set 或任一审阅、能力、Registry、Provider、费用字段变化都会产生新 hash 或 blocker。
- 下游：Provider Adapter 只能消费通过 `planHash` 与 `invocationHash` 校验且状态为 `ready_for_isolated_provider_execution` 的页面。
- 迁移：无。历史 Prompt Set、Trace、候选、页面版本和 Manifest 不回写。
- 回退：关闭 `xhsIntegratedPageSkillExecutionPlan`，停止新计划；显式建议 `deterministic_layout`，不静默执行。
