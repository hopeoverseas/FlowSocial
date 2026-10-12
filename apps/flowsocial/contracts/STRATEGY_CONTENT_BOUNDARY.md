# 策略 Agent、内容总编排与内容 Skills 边界

## 目标

三条开发线通过版本化合同协作，不读取彼此的内部会话、数据库表或提示词。

## 所有权

| 线路 | 拥有的对象 | 可以读取 | 禁止直接修改 |
|---|---|---|---|
| 策略 Agent | DiagnosticSession、ProfileClaim、动态事实、StrategyDocument、ActiveStrategySnapshot | 知识摘要、经确认的历史事实、聚合表现信号 | ContentMaster、ContentRun、平台内容包 |
| 内容 Agent 总编排 | ContentStrategyProfile、ContentDirectionCard、ContentExecutionContext、ContentTaskBrief、ContentSourcePlan、ContentRun | ActiveStrategySnapshot、FactSnapshot、知识与热点快照、发布历史 | ProfileClaim、活动策略、Skill 内部提示词 |
| 内容 Skills | 单项能力合同输出 | 编排器传入的冻结输入 | 工作流状态、数据库、策略、其他 Skills |

## 共享合同

- `StrategyDocument@2.0`：策略 Agent 生成、审核和版本化的完整策略。
- `ActiveStrategySnapshot@2.0`：由用户确认的不可变活动版本。
- `FactSnapshot@1.0`：内容任务可复现的事实快照。
- `ContentStrategyProfile@1.0`：内容 Agent 从活动策略投影出的只读执行策略。
- `ContentDirectionCard@1.0`：内容 Planner 对一篇内容作出的方向决策。
- `ContentExecutionContext@1.0`：进入 ContentMaster 前冻结的单篇任务上下文。
- `StrategyContentBridge@1.0`：记录活动策略、事实、方向卡和执行上下文到 ContentRun 的不可变归因。

## 依赖方向

```text
StrategyDocument
→ ActiveStrategySnapshot
→ strategy-adapter
→ ContentStrategyProfile
→ ContentDirectionCard
→ ContentExecutionContext
→ StrategyContentBridge
→ ContentRun
→ ContentMaster
→ ContentOutline
→ Platform Content Package
```

依赖只能由上游指向下游。策略 Agent 不调用写作 Skill；写作 Skill 不读取诊断会话。

## 覆盖优先级

```text
法律、事实与授权边界
> 用户对本篇内容的明确选择
> 已确认平台子选题
> ContentIntentProfile
> 平台策略
> 账号长期策略
> 内容 Planner 推荐
> Skill 默认规则
```

低优先级规则不得覆盖高优先级规则。任何层级都不能覆盖事实真实性、客户隐私、知识授权和法律边界。

## 版本规则

1. 合同升级必须增加版本号，不原地改变既有版本语义。
2. 生产方和消费方通过兼容 Adapter 迁移。
3. 活动策略不可原地修改；继续修改产生新草案 revision。
4. 内容任务固定策略、事实和知识快照 ID。
5. 旧版本在所有消费者迁移完成前保持可读。
