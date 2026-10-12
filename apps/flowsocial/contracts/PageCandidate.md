# PageCandidate@1.0

绑定源 PNG 字节、Spec、Compiler Trace 与能力评估的实验候选；上游成功不能自动推进下游 Gate 或选择。

严格字段：`schemaVersion`、`contract`、`id`、任务/版本/页面字段、`specRef`、`compilerTraceRef`、`capabilityEvaluationRef`、`generationMode`、`lifecycle=experimental`、`sourceAsset`、`providerStatus`、`providerNativeDimensions`、`providerNativeDimensionStatus`、`normalizationStatus`、`finalCanvasStatus`、`textStatus`、`factStatus`、`visualStatus`、`selectionStatus`、`costStatus`、`blockers`、`candidateHash`。三层尺寸状态独立；源资产 SHA-256 按实际字节计算。未知字段、hash 篡改或 `approved` 硬失败。

历史候选只读为 unknown/`legacy_quality_unknown`，不得伪造通过。任一 Gate 不通过时不得选择，回退仅为显式 `deterministic_layout`。
