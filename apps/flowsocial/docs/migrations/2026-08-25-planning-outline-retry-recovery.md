# 统一规划大纲重试恢复兼容说明

## 变更

- `generate-content-outline` 在连接超时时允许执行器既有的一次受控重试；收据同步记录第二次 `started`，不再误报 `UNIFIED_PLANNING_ATTEMPT_RETRY_FORBIDDEN`。
- `build-content-master` 对无效 JSON 或合同校验失败允许一次受控结构修复；大纲在连接超时时最多两次 Provider 尝试。
- 收据的 `retryCount`、`providerCallsStarted`、`providerCallsCompleted` 和 `providerCallsFailed` 反映受控重试结果。
- 同一请求已有 `running` 收据时，服务端返回 `UNIFIED_PLANNING_REQUEST_IN_PROGRESS`，不再并发创建第二个规划尝试。
- 公众号前端不再把后台共享规划阶段显示为“小红书大纲”，统一显示“共享内容规划”。
- 修正公众号图片运行能力提示：整图 Provider 可用时，不再错误禁止 `generated_raster`；封面和概念/场景型插图优先按正文语义生成完整无文字图片，精确流程、比较、数据和清单保留确定性图表。
- 生成式场景/隐喻插画或原创正文语义图表若携带未知、跨章节 claim ID，会移除该非权威绑定并保持图片为非证据型视觉；外部授权素材继续对未知事实引用 fail closed。

## 兼容与下游影响

- 收据合同仍为 `UnifiedContentPlanningAttemptReceipt@1.0`，无数据库迁移。
- 历史失败收据保持不可变；用户可使用原请求键发起恢复，不会创建新的内容项目。
- 成功 Bootstrap 仍包含两个平台各自的大纲引用，平台确认与后续生产合同不变。
- ContentMaster 正常响应仍只调用一次；仅当首个响应无法解析或不符合合同，才用紧凑候选和校验错误执行一次修复。该恢复沿用同一规划请求，不创建项目、不发布内容，也不扩大规划范围。

## 代表性验证

- `node scripts/tests/planning-attempt-receipt-self-test.mjs`
- `node scripts/tests/planning-attempt-receipt-composition-self-test.mjs`
- `node scripts/tests/planning-provider-recovery-self-test.mjs`
- `node scripts/tests/outline-review-recovery-self-test.mjs`
- `node scripts/tests/unified-content-product-api-self-test.mjs`

## 回滚

恢复大纲收据的单次 `started` 限制、移除同请求运行态保护和公众号阶段文案映射即可。历史收据无需转换。
如需单独回滚 ContentMaster 结构修复，将 `content_master.maxAttempts` 恢复为 `1`；其余规划恢复行为不受影响。
