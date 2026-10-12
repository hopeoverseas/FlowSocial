# PublishingCyclePlan@1.0

`PublishingCyclePlan` 是策略激活与内容生产之间的确定性周期计划合同。它描述某一组已存在的社媒账号在一个周期内可以承诺、可以继续编辑和应保留缓冲的内容槽位；它不创建 `ContentRun`，不修改策略，也不代表自动发布指令。

## 顶层合同

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | `"PublishingCyclePlan"` | 固定对象类型 |
| `schemaVersion` | `"1.0"` | 固定合同版本 |
| `cycleId` | string | 由公司、策略版本、账号集合、周期开始日和周期长度确定性生成 |
| `status` | `draft \| confirmed \| active \| reviewing \| completed \| superseded \| blocked` | 周期状态；`blocked` 仅用于前置条件不足的不可执行结果 |
| `workspaceId` / `companyId` | string | 所有权上下文 |
| `strategySnapshotId` / `strategyVersion` | string / number | 已激活策略快照引用 |
| `playbookVersions` | array | 每个账号采用的打法和版本 |
| `planningHorizon` | object | `startDate`、`endDate` 与 `committedUntil`；日期范围为半开周期 |
| `cadenceRange` | object | 当前周期可承诺的最小、最大、目标数量及逐账号明细 |
| `cadenceByAccount` | array | 逐账号 `minimum`、`target`、`maximum` 与理由 |
| `slots` | array | 发布槽位 |
| `feedbackCheckpoints` | array | 每个已排期槽位的 72h、7d 与周期观察面；不是算法事实 |
| `conflicts` | array | 产能、库存、平台能力和矩阵共享资源冲突 |
| `assumptions` | array | 缺省输入和推断的显式记录 |
| `userDecisions` | array | 待确认或已确认的用户决策 |
| `blockers` | array | 阻止生成可执行周期的结构化问题 |

## 槽位合同

每个槽位必须包含唯一 `slotId`、`zone`、真实 `accountId`、`platform`、策略和打法版本、`targetWindow`、`contentPillarId`、`objective`、`contentType`、`experimentId`、`requiredEvidenceIds` 与 `requiredAssetTypes`。实现同时保留 `state`、`socialAccountId` 等兼容别名。

- `committed`：已进入冻结范围，修改需要显式确认。
- `draft`：周期后段候选，可以继续调整。
- `buffer`：不绑定发布日期的容量缓冲，用于替换或机会内容。

槽位只预留工作，不创建或伪造 `ContentRun`；`contentRunId` 在本合同产生时必须为空。

## 频率与平台规则

打法中的频率只能作为 `playbook_candidate` 候选。引擎必须再同时应用：

1. 当前账号的平台能力额度；
2. 主题与证据库存；
3. 研究、文案、视觉、审核、发布与社群承接五段产能；
4. 多账号共享资源上限。

输出必须是区间。小红书与公众号可以拥有不同的资产要求和反馈观察面，但不得把经验频率、黄金发布时间或算法传闻写成平台固定事实。

## 稳定阻塞码

| code | 条件 |
| --- | --- |
| `STRATEGY_NOT_ACTIVE` | 没有活动策略快照 |
| `ACCOUNT_IDENTITY_UNCONFIRMED` | 策略没有选择账号 |
| `ACCOUNT_MAPPING_MISSING` | 选择的账号无法映射到真实社媒账号 |
| `PLAYBOOK_NOT_SELECTED` | 账号未选择增长打法 |
| `PLAYBOOK_CADENCE_MISSING` | 打法没有候选频率 |
| `PLATFORM_CAPABILITY_UNKNOWN` | 当前账号的平台能力额度未知 |
| `CRITICAL_CAPACITY_MISSING` | 五段关键产能输入不完整 |

产能不足不会伪装成阻塞：引擎降低目标并在 `conflicts` 中返回 `CADENCE_EXCEEDS_CAPACITY`；矩阵共享资源不足返回 `MATRIX_RESOURCE_COLLISION`。

## RollingContentPlan@1.0 兼容

`adaptPublishingCyclePlanToRollingContentPlan(plan)` 返回新的 `RollingContentPlan@1.0` 对象：

- 不修改输入周期计划或历史滚动计划；
- 忽略 `buffer` 槽位；
- 保存 `sourcePublishingCycleId` 和 `sourcePublishingSlotId`；
- 只有周期达到 `confirmed`、`active` 或 `reviewing` 后，`committed` 才映射为 `planned`；未确认周期的全部槽位保持 `draft`；
- 现有 `createRollingContentPlan` 入口和验证规则继续可用。
