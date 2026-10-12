# ProviderCapabilityEvaluation@1.0

`ProviderCapabilityEvaluation@1.0` 是一次隔离的 Provider 能力观察，不是页面版本、交付物、生产接入证明或视觉质量放行。`schemaVersion` 固定为 `"1.0"`，合同名固定为 `"ProviderCapabilityEvaluation@1.0"`。

## 严格对象

顶层字段必须且只能包含：

- `schemaVersion`、`contract`、`evaluationId`、`createdAt`
- `source`、`provider`、`model`、`pageCase`、`runMode`
- `providerStatus`、`textStatus`、`factStatus`、`visualStatus`、`dimensionStatus`
- `referenceIsolationStatus`、`costStatus`、`editingStatus`、`selectionStatus`、`deliveryStatus`
- `evidence`、`blockers`、`productionDataWritten`、`evaluationHash`

`evaluationHash` 是移除自身后，对完整对象执行稳定 JSON 序列化所得的 SHA-256 小写十六进制摘要。未知字段、字段缺失、非法枚举、摘要不一致都必须拒绝。

状态彼此独立：

| 字段 | 允许值 |
| --- | --- |
| `providerStatus` | `not_requested`、`succeeded`、`failed`、`blocked` |
| `textStatus`、`factStatus`、`visualStatus`、`dimensionStatus`、`referenceIsolationStatus` | `pending_human_review`、`passed`、`failed`、`not_tested`、`blocked` |
| `costStatus` | `not_measured`、`within_budget`、`measured`、`blocked` |
| `editingStatus` | `not_tested`、`passed`、`failed`、`blocked` |
| `selectionStatus` | 只能是 `not_selected` |
| `deliveryStatus` | 只能是 `not_delivered` |

`productionDataWritten` 只能为 `false`。Provider 终态成功、结果 URL、文件下载或尺寸解析只允许改变各自证据和 `providerStatus`，不得自动把文字、事实、视觉、尺寸、参考隔离、编辑、选择或交付标为通过。人工审阅必须逐项记录；未输入参考资产时 `referenceIsolationStatus` 必须为 `not_tested`。

`evidence` 必须且只能包含：`candidateCount`、`expectedCredits`、`actualCreditsDelta`、`outputRelativePath`、`outputSha256`、`observedDimensions`、`manualReview`、`requestHash`、`sourceRef`。不得保存 API Key、Authorization、Provider 原始响应、任务 ID、结果 URL、带 token 的 URL 或调用前后余额。`actualCreditsDelta` 可为 `null`；它只保存差值。

成功产物一旦保存，`outputSha256` 必须是该 PNG/JPEG/WebP 文件原始字节的 SHA-256 小写十六进制摘要。验证器在 `verifyOutput: true` 时必须重新读取隔离文件并比对摘要；文件替换、截断或路径越界都必须失败。由于 `outputSha256` 位于 `evidence` 内，`evaluationHash` 同时绑定合同字段和真实输出内容摘要。没有本地文件的 05A 历史投影可保持 `outputRelativePath/outputSha256: null`，不得伪造文件绑定。

本合同的精确尺寸门槛固定为 `1080 × 1440`。只有 `width === 1080 && height === 1440` 才允许 `dimensionStatus: passed`；任何近似 3:4、其他 3:4 分辨率或仅宽高比合格的产物都必须为 `failed`。尺寸状态由机器证据派生，人工审阅不得覆盖。05A 的 `1680 × 2240` 只读投影因此为 `failed`。

## 上下游与只读兼容 Adapter

上游是 05C-R 冻结编译输出、冻结模型 fixture 与三类固定真值。本任务不修改 05C-R 合同，也不把 Provider 选择写回 Compiler。下游只可读取能力矩阵；`selectionStatus` 与 `deliveryStatus` 在本合同版本不可晋级。

`adapt05ABaselineReadOnly(input)` 接受 05A 的脱敏证据副本，先深拷贝并验证 `readOnly: true`，再投影为本合同。Adapter 不写原对象、不重新调用 Seedream、不推断未记录状态；成本只引用 05A 已记录的消费差值。兼容失败返回 blocker，不修改历史证据。

## 执行与回退

脚本默认 dry-run，只有显式 `--live` 才可调用 Kie.ai。Live 前必须同时满足：模型/接口/官方来源/credits 已冻结；最多 2 模型、每模型 3 请求、每请求 1 候选、总计最多 6 请求；单次预计不超过 20 credits、累计预计和实耗不超过 100 credits；隔离目录已被 Git 忽略；凭据仅从本机既有配置只读加载；有界轮询；自动重试为 0。每次付费请求前重新查询余额并检查剩余次数及累计停止线，失败后停止后续依赖调用。

真实图片和脱敏运行证据只写 `.tmp/xhs-integrated-page-provider-comparison/`，不提交。回退方式是停止下一次调用，保留隔离证据，将未完成状态维持 `blocked`/`not_tested`，不补测、不自动重试、不接生产。删除本任务代码不会要求数据迁移；05A 和 05C-R 历史对象保持不变。
