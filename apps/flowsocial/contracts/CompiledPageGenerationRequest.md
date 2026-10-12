# CompiledPageGenerationRequest@1.0

Provider-neutral 的单页确定性编译结果。它不是 Provider 请求，也不能直接执行。

```json
{
  "schemaVersion": "1.0",
  "contract": "CompiledPageGenerationRequest@1.0",
  "id": "compiled-page:P1:stable-hash",
  "promptSetRef": {"id": "prompt-set:fixture:v1", "hash": "sha256"},
  "pagePromptSpecRef": {"id": "page-prompt:fixture:P1:v1", "hash": "sha256"},
  "reviewDecisionRef": {"id": "prompt-review:fixture:v1", "hash": "sha256"},
  "capabilitySnapshotRef": {"id": "capability:offline:v1", "hash": "sha256"},
  "registrySnapshotRef": {"id": "registry:offline:v1", "hash": "sha256"},
  "canvas": {"width": 1080, "height": 1440},
  "candidateCount": 1,
  "prompt": {"verbatimText": [], "composition": [], "style": [], "negativeConstraints": []},
  "referenceAssets": [],
  "requestedFeatures": {"mask": null, "preserveRegions": [], "seed": null},
  "expectedTextHash": "sha256",
  "execution": {"status": "awaiting_cost_confirmation | blocked", "provider": null, "retries": 0, "networkCalls": 0, "providerCalls": 0, "cost": 0, "databaseWrites": 0},
  "blockers": [],
  "compiledHash": "sha256"
}
```

## 硬阻断与兼容

- 阻断未授权资产、事实改写、Prompt 内容注入、缺失能力、候选数越界、尺寸不支持，以及 Mask/锁区误声明。
- `PromptReviewDecision` 含任意 blocker 或 `overallStatus` 不是 `awaiting_cost_confirmation` 时必须输出 `execution.status=blocked`，并保留审阅 blocker；不得重新解释或丢弃方向结构、来源、许可证和能力 blocker。
- Compiler 必须重新验证冻结候选集合与选中候选；同 ID 内容替换返回候选 hash blocker，不得按 ID 静默接受。
- 相同冻结输入必须产生相同 `compiledHash`；不得混入当前时间、随机数、Provider 或环境变量。
- 上游通过只读 Adapter 引用 05B 合同，不修改 `XhsIntegratedPagePromptSet@1.0`。
- 下游只能在未来独立任务完成费用确认和 Provider 绑定后消费；本合同固定 `provider=null`、`retries=0`。
- blocker 的 `deterministic_layout` 仅为显式回退建议，Compiler 不执行回退。
- 回退：关闭 Compiler Flag 并移除新离线模块，保留 05B Prompt Set。
