# Provider 执行计划

> Adapter 边界：Provider、model 和请求字段 projection 是三个独立身份。执行计划必须显式携带 `{id, version, projectionKey}`；当前 Kie Image 2 与 Nano Banana 2 继续使用各自严格投影。未来 Provider 只有在字段语义完全兼容时才可复用既有 projection key，无需修改计划合同版本；否则必须注册新 projection 并补合同测试。不得根据 Provider 名称硬编码或隐式推断字段。

仅在需要从已审阅 Prompt Set 创建隔离 Provider 执行计划时读取本文件。

## 顺序

1. 通过 `scripts/invoke-skill.mjs` 生成带 Skill、库定义和逐页资产 hash 的调用证据。
2. 保持历史 `CompiledPageGenerationRequest@1.0` 与 Trace 只读，用 05K Adapter 创建 `IntegratedPageExecutionPlan@1.0`。
3. 分别校验视觉方向、Prompt 审阅、费用确认、能力快照、Registry、Feature Flag 和逐页资产 hash。
4. 只从计划中物化 Provider 请求；调用方不得传入 Prompt、模型或参数覆盖。
5. Provider、OCR、事实、视觉、用户选中和交付状态分别推进，不自动串联。

## Prompt 投影

逐页 Prompt 必须依次包含页面语义、视觉媒介、构图与层级、材质/空间/光影、跨页统一规则、逐字真值和负面约束。固定的测试文案、米白背景或几何卡片不得替代 Skill 输出。

Image 2 与 Nano Banana 2 使用各自冻结字段投影；模型 ID、入口、字段列表、能力和成本确认全部进入 hash。两种模型不得被描述为等价。

## 尺寸资格

Provider 原生尺寸只记录能力事实。原生像素非 1080×1440 时，若明确采用安全等比规范化、禁止非等比拉伸和受保护区域裁切，可继续等待规范化后 Gate；只有最终画布精确 1080×1440 且 OCR、事实、视觉 Gate 全通过时才可进入 `candidate_selection`。

关闭 `xhsIntegratedPageSkillExecutionPlan` 后停止创建和物化计划。`productionEligible` 始终为 `false`，回退只能显式选择 `deterministic_layout`。
