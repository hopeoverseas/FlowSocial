# Content Agent

本文件是内容 Agent 的唯一模块说明。接口细节与实现状态以代码、合同、测试和 Git 历史为准，
不在本目录新增临时状态快照。

## 职责与边界

内容 Agent 消费只读策略快照和当前事实，负责内容计划、来源锁定、`ContentRun` 状态机、
平台正文、交付、发布反馈和战术学习。

它不得：

- 读取原始策略诊断对话重新推断策略；
- 修改策略快照或事实；
- 把假设静默升级为已确认事实；
- 绕过大纲确认直接生成正文；
- 用单篇表现自动改写活动策略。

策略字段变化优先在 `strategy-adapter.mjs` 中兼容。

## 经营对象

```text
Company
  └─ AccountMatrix
      └─ SocialAccount
          ├─ EffectiveAccountStrategy
          ├─ RollingContentPlan
          └─ ContentOpportunity
              └─ ContentRun
                  └─ ContentTask
                      └─ PublicationRecord
                          └─ PerformanceSnapshot
```

热点、知识、爆款蓝图和临时素材是机会的可组合来源。每次 Run 冻结有效策略、账号身份、
来源和事实版本，避免生成期间数据漂移。

## 标准流程

1. 规划下一篇或选择已有机会；
2. 创建 `ContentRun@1.0`；
3. 解析并锁定来源；
4. 生成、修改并确认大纲；
5. 生成平台正文；
6. 执行事实、标题承诺、平台完整性和必要视觉检查；
7. 生成交付包；
8. 记录发布并在 72 小时、7 天和最终窗口补充表现；
9. 生成战术动作；足够证据时生成只读策略复核候选。

## 主要 API

```text
POST /api/v1/content-agent/plan
POST /api/v1/content-agent/runs
POST /api/v1/content-agent/runs/:id/outline
PATCH /api/v1/content-agent/runs/:id/outline
POST /api/v1/content-agent/runs/:id/outline/confirm
GET  /api/v1/content-agent/runs/:id/execution-plan
GET  /api/v1/content-agent/runs/:id/trace
POST /api/v1/content-revisions/:revisionId/start-upstream-run
POST /api/v1/content-tasks/generate
```

生成接口必须携带已确认的 `contentRunId`。旧工作流接口只作为兼容别名。

## 来源与证据

- 知识库、用户明确提供的文本和已选热点可进入事实证据；
- 爆款蓝图只提供标题、结构和互动机制，不能提供业务事实；
- 无文字提取结果的图片只能作为创作素材；
- 所有被采用来源保留锁定快照和使用记录；
- 当前规则型爆款拆解标记为 `demo_rule_based`、`productionReady: false`。

## Skill 编排

每个 Run 生成 `SkillExecutionPlan`，由统一 Runner 执行合同校验、重试、可选降级和 trace。
小红书视觉检查必须等待真实渲染；公众号内容审核不能被当成 HTML 或视觉审核。事实、主题、
目的或推广方式变化会创建新的上游 Run，不原地伪装成局部修订。

## 反馈边界

`PerformanceSnapshot` 区分未提供指标和真实 0，并按观察窗口保留修订历史。单篇数据只形成
内容层动作；账号策略候选要求可比样本、跨周期重复模式和业务结果，并始终等待人工复核。

## 验证

```powershell
npm.cmd run check
npm.cmd run test:content-agent-contracts
npm.cmd run test:content-agent
npm.cmd run test:content-agent-sources
npm.cmd run test:content-agent-libraries
npm.cmd run test:content
npm.cmd run test:artifacts
npm.cmd run test:skills
```

## 小红书轻量图片修改兼容说明（2026-08-19）

- `UnifiedXhsLightRevisionState@1.0` 新增可选的 `approvals`、`executions`、`checkpoints`、`resolutions` 与 `unresolvedCheckpoints` 数组；前端刷新后会恢复仍绑定当前 revision 且尚未执行的计划/审批。旧消费者忽略未知字段即可，已有事实无需迁移。
- Kie 返回的 PNG、JPEG、WebP、AVIF、GIF 或 TIFF 会先保留原始字节，再通过 Sharp 转成 PNG，最后进入既有 1080×1440 归一化流程。成功 revision 的 `rawAsset` 指向供应商原始格式，`normalizedAsset` 仍为 PNG。
- Provider 任务一旦创建，临时查询/下载错误只会重试已有 task；Provider 明确失败、费用异常或图片处理失败才产生 `reconciliation_required` 检查点。同一审批禁止再次调用，且存在未对账检查点时禁止创建同页新计划或确认最终版本。
- 轻量图片修改采用两阶段执行：首次请求只创建 Provider task，并把 `providerTaskId` 以 `provider_task_created` execution 立即写入 SQLite；后续 `continue` 请求只查询已有 task，成功后追加 `UnifiedXhsLightRevisionCompletionFact@1.0` 和新 revision。页面刷新会从 `pendingExecution` 自动续跑，绝不再次调用 `createTask`。
- 下游影响：前端需把 `checkpoints[].requiresReconciliation` 当作付费闸门；审计与导出应允许 `providerTaskId` 为空，表示历史调用未及时持久化 taskId。
- 下游兼容：`UnifiedXhsLightRevisionState@1.0` 新增 `completions` 和可选 `pendingExecution`；旧消费者会忽略未知字段。新的 execution 在完成前没有 `successorRevisionRef`，消费者应通过 completion 获取最终 revision。
- 人工决定放弃不可恢复的旧结果时，追加 `UnifiedXhsLightRevisionReconciliationResolutionFact@1.0`，不删除或改写原检查点。只有 `unresolvedCheckpoints` 会继续阻塞生图和最终确认；历史检查点及已发生费用永久保留。
- 回滚：可回退代码与 Sharp 依赖，但不得删除已经写入的 execution、completion 或检查点事实；旧版本会忽略新增数组。若要恢复生成，必须只查询已有 `providerTaskId`，不能直接清除事实或重新调用 Provider。

## 发布排期到双平台工作区迁移说明（2026-08-20）

- 该阶段曾以 `slots/:slotId/runs` 作为单平台入口；Phase 7 已移除这个兼容入口。当前平台范围仍由用户显式选择，但统一通过下述采纳入口进入 staged atomic bootstrap。
- 新的主入口为 `POST /api/v1/content-agent/publishing-cycles/:cycleId/slots/:slotId/adopt-to-unified-project`。它只接受已确认周期的承诺槽位，校验活动策略和双平台账号，并幂等创建 `UnifiedContentPrerequisite`；重试返回同一个 `projectId` 和 `productionEntryId`。
- `PublishingCyclePlan.slots[]` 新增可选的 `unifiedProjectId`、`unifiedProductionEntryId`、`adoptedAt`、`adoptedBy`。旧消费者可忽略这些字段；Phase 7 审计确认当前数据目录没有需要迁移的历史 `contentRunId`。
- 双平台大纲仍来自同一次共享内容主表规划，但用户通过 `UnifiedPlatformOutlineConfirmation@1.0` 分别确认小红书和公众号。只有两个精确 outline ref 都被人工确认后，bootstrap 才转为 `confirmed`。
- 下游影响：前端不得再按标题或账号猜测权威输入；必须使用采纳接口返回的精确 entry/project 引用。公众号与小红书分别展示大纲、生成、审阅和版本状态。
- 回滚：可关闭统一内容前置与 staged bootstrap 功能开关，排期槽位仍保留采纳引用和事件；不得删除已经生成的 prerequisite 或平台大纲确认事实。Phase 7 之后旧运行入口不会恢复，除非整体回退 Phase 7 提交。

### Phase 3 写链收口

- 当前产品 UI 只创建 unified prerequisite、staged atomic bootstrap 与后续原子产品事实，不再调用旧 ContentRun 写接口。
- 周期槽位与内容机会通过统一采纳入口冻结 `unifiedProjectId` 和 `unifiedProductionEntryId`；Phase 7 已删除历史 ContentRun 兼容页面和客户端方法。
- 周期、机会、滚动计划、策略推荐、反馈跟进与旧上游修订的兼容路由在 Phase 7 统一返回 `LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED`。
- 接受反馈默认只记录优化动作，下一篇必须重新经过统一项目入口和用户大纲确认。

### Phase 6 旧 ContentRun 退役

- 旧 `ContentRun` 现在只保留历史详情、执行计划、轨迹、内容归因和反馈关联读取。
- 所有旧创建、来源选择、大纲变更和正文生成入口统一返回 `410 LEGACY_CONTENT_RUN_WRITES_RETIRED`；显式 `entryMode: "legacy"` 也不再恢复写权限。

### Phase 7 旧 ContentRun 兼容层删除

- 当前数据目录经只读审计确认旧运行、旧任务和旧发布记录均为零，兼容层无需迁移数据。
- `/content-agent/runs` 只保留 unified staged atomic bootstrap；`/content-agent/workflows`、旧运行详情/轨迹/大纲和旧正文生成接口统一返回 `410 LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED`。
- 前端不再加载历史 ContentRun 页面、深链和客户端方法；内容计划只进入统一的小红书或公众号生产工作台。
- 迁移检查、下游影响和回滚方式见 `docs/migrations/2026-08-28-phase-7-content-run-compatibility-removal.md`。
- `/content-agent/runs` 只接受 unified bootstrap 请求；当前浏览器客户端在发起 HTTP 前阻止旧写方法，历史工作台禁用写按钮。
- 不迁移、不覆盖、不删除历史 `contentRuns/contentWorkflows`。新内容必须从内容计划或统一内容生产工作台建立权威输入。
