# DeterministicPageQualityReport@1.0

`DeterministicPageQualityReport@1.0` 是 FlowSocial 确定性小红书页面 Renderer 的新运行报告。它只评价最终确定性画布、中文叠字和可机器验证的版面门禁；不得描述为 `integrated_page_generation`、真实 Provider 视觉质量通过、页面版本或生产交付批准。

## 严格合同

`schemaVersion` 固定为 `"1.0"`，`contract` 固定为 `"DeterministicPageQualityReport@1.0"`。顶层必须且只能包含：

- `schemaVersion`、`contract`、`reportId`、`createdAt`、`source`
- `contentTaskId`、`contentVersion`、`pageId`、`renderSource`
- `canvasStatus`、`contrastStatus`、`overflowStatus`、`safeAreaStatus`
- `subjectOcclusionStatus`、`capacityStatus`、`deliveryEligibility`
- `featureFlagEnabled`、`preset`、`evidence`、`blockers`、`reportHash`

新运行的六个质量状态只允许 `passed` 或 `blocked`。只读历史 Adapter 可将六个状态与 `deliveryEligibility` 投影为 `legacy_quality_unknown`。`deliveryEligibility` 对新运行只允许：

- `blocked`：存在任一硬 blocker；
- `waiting_human_confirmation`：机器门禁通过但 `xhsDeterministicVisualQualityGate=false`，保留既有人工确认链且不得自动交付；
- `eligible`：机器门禁通过且 Flag 开启；这仍不替代既有人工视觉确认。

`reportHash` 是移除自身后，对完整对象稳定 JSON 序列化所得的 SHA-256 小写十六进制摘要。未知字段、缺字段、非法状态、摘要不一致或状态与 blocker 不一致必须拒绝。

`evidence` 必须绑定本次最终渲染的机器事实：

- `outputPng`：最终 PNG 的相对路径、字节数和现场读取所得 SHA-256；
- `backgroundAsset`：存在实际背景资产时，保存资产 ID、相对路径、现场读取 SHA-256、原声明 SHA-256、完整性状态和颜色证据状态；无资产时为 `null`；
- `domMeasurementSummary`：Playwright 最终页面的画布、文字层、安全区和主体区域测量；
- `localBackgroundRegions`：每个实际 DOM 文字层使用的局部底色、来源及同一背景资产 SHA-256；
- `networkCalls`、`providerCalls`、`costCredits`、`activeDatabaseWrites` 固定为 0。

确认和打包前必须通过 `verifyDeterministicPageQualityArtifacts(report, { root })` 重新读取 PNG 与背景资产。任一文件替换、字节数变化、SHA-256 不一致或路径越界均硬阻断。`reportHash` 同时绑定上述摘要和 DOM 测量，不能只验证报告对象而跳过真实文件。

## 精确画布和局部对比度

新输出只有机器读取的 PNG 宽高严格等于 `1080 × 1440` 才可 `canvasStatus: passed`。近似 3:4、其他 3:4 分辨率、尺寸篡改和裁切均为硬阻断；后处理不得改写 Provider 原生尺寸历史结论。

标题、正文、编号卡和页脚分别使用最终 DOM 的实际文字颜色和可验证不透明局部底色计算 WCAG 相对亮度和对比度。不得使用全图平均亮度，也不得直接信任 storyboard 或 asset 上自由填写的颜色区域。存在实际背景资产时，颜色证据必须绑定现场读取的资产 SHA-256；若不能从该资产验证局部颜色，Renderer 必须使用固定不透明文字底/卡片隔离文字与背景，否则以 `BACKGROUND_COLOR_EVIDENCE_UNVERIFIED` 阻断。原声明资产 SHA-256 与现场字节不一致时以 `BACKGROUND_ASSET_SHA256_MISMATCH` 阻断。

最终每层证据来自 Playwright 页面，至少保存 `getBoundingClientRect()`、`scrollWidth/clientWidth`、`scrollHeight/clientHeight`、实际前景/背景色、是否位于安全区、是否与已核验主体区域相交以及 overflow 结果。标题/大号编号阈值为 3.0，其余文字阈值为 4.5；任一层不足即 `LOW_LOCAL_CONTRAST`。

Renderer 只能从固定预设中选择：

- 文字：`dark_text` / `light_text`；
- 遮罩：`none` / `light_scrim` / `dark_scrim`；
- 卡片：`none` / `light_card` / `dark_card`；
- 密度：`comfortable` / `compact`。

不得自由生成颜色、透明度或密度。预设选择按固定顺序、冻结输入确定；无预设满足时必须阻断或显式回退为 `explicit_deterministic_fallback`，不得静默回退。固定矩形和字符容量仅用于渲染前预检与预设选择，绝不能成为最终 `overflowStatus`、`safeAreaStatus` 或 `subjectOcclusionStatus` 的通过依据。

## 硬门禁

下列任一条件形成 blocker，人工确认不得删除或绕过：

- 画布非精确尺寸或 `cropDetected=true`；
- 最终 DOM 任一文本层越出画布、实际容器或安全区，或其 scroll/client 尺寸证明发生溢出；
- 任一局部对比度不足；
- 文本层与声明的主体保护区相交；
- 标题、正文、编号卡或页脚超过固定容量；
- 生成式/授权背景缺少可由实际资产 SHA-256 验证的局部颜色时必须强制选择不透明的固定卡片底色，使文字的局部背景可机器确定；不得使用自由声明或全图平均亮度猜测。主体区域只有在与同一实际资产 SHA-256 绑定时才进入机器关系测量；没有可核验主体区域的图片语义继续保留既有人工确认，不得冒充机器语义通过。

未通过页面不得确认、写入新 Manifest 或进入交付包。质量报告可写入隔离的新运行 audit；不得回写历史 `XhsPostPackage@2.0`、VisualDirectionSet、Manifest、页面版本或图片。

## 上下游、兼容与回退

上游只读消费现有 `XhsPostPackage@2.0`、逐页布局、无字背景候选/确定性背景和安全区声明，不修改历史合同。下游 05F 只能复用本合同的最终画布状态语义；不得把本报告包装为整页 Provider 质量通过。

`adaptLegacyRenderQualityReadOnly(input)` 深拷贝历史渲染元数据，返回 `legacy_quality_unknown` 投影并证明输入未变；它不读取或改写历史图片、Manifest、页面版本。无迁移。

回退方式：关闭 `xhsDeterministicVisualQualityGate`（默认 false），保留人工审核并停在 `waiting_human_confirmation`；出现硬 blocker 时保留预览和报告、停止确认/Manifest/交付，不自动重试、不调用 Provider、不删除历史产物。
