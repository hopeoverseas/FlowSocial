# ProviderCompilationTrace@1.0

记录每个确定性编译决定的输入来源、快照和零调用计数。

```json
{
  "schemaVersion": "1.0",
  "contract": "ProviderCompilationTrace@1.0",
  "id": "trace:compiled-page:P1:stable-hash",
  "compiledRequestRef": {"id": "compiled-page:P1:stable-hash", "hash": "sha256"},
  "inputContracts": [{"contract": "XhsIntegratedPagePromptSet@1.0", "id": "prompt-set:fixture:v1", "schemaVersion": "1.0", "hash": "sha256"}],
  "registrySnapshotRef": "registry:offline:v1",
  "registrySnapshotHash": "sha256",
  "capabilitySnapshotRef": "capability:offline:v1",
  "capabilitySnapshotHash": "sha256",
  "visualDirectionVerification": {
    "candidateSetHash": "sha256",
    "reviewedCandidateSetHash": "sha256",
    "structuralEvidenceHash": "sha256",
    "reviewedStructuralEvidenceHash": "sha256",
    "selectedDirectionRef": {"id": "direction-structured", "hash": "sha256"},
    "reviewedSelectedDirectionRef": {"id": "direction-structured", "hash": "sha256"}
  },
  "decisions": [{"field": "canvas", "sourceRef": "capability:offline:v1", "action": "capability_check", "valueHash": "sha256"}],
  "blockers": [],
  "compiledHash": "sha256",
  "counters": {"networkCalls": 0, "providerCalls": 0, "retries": 0, "cost": 0, "databaseWrites": 0},
  "traceHash": "sha256"
}
```

Trace 必须同时引用输入合同、Registry 快照、能力快照、候选集合、结构证据和选中候选，并逐项记录来源、许可证、风险、能力状态、Prompt、尺寸、候选数、资产授权、Provider 未绑定和费用待确认。`traceHash` 是删除自身字段后对完整 Trace 的确定性 hash；修改 decisions、blockers、inputContracts、快照引用或 counters 均校验失败。校验时必须同时提供 `CompiledPageGenerationRequest@1.0`，并保证 `compiledRequestRef.hash == compiledHash == request.compiledHash`，同时重新验证请求自身 hash。

它不保存密钥、网络 URL 或 Provider 响应。上游来自冻结合同和快照；`validateProviderCompilationTrace` 会拒绝缺少 `traceHash`、配套请求或候选核验字段的旧 Trace，兼容调用方必须把该只读校验错误呈现为 blocker，不原地补写。下游只读消费编译证据；回退时关闭 Compiler，保留现有离线 Trace 作为不可执行证据，无需迁移历史对象。
