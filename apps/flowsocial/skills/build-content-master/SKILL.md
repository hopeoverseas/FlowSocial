---
name: build-content-master
description: 根据已冻结主题、ContentIntentProfile 和用户/策略结构意图，建立小红书与公众号共享的事实合同与不可变 semantic spine。用于双平台大纲和写作之前；不生成平台大纲、正文或图片。
---

# 建立内容母版

把主题、内容目的、已授权知识资产和结构意图固定为可追溯合同。平台分支可以改变表达，但不得越过 ContentMaster。

## 输入要求

要求输入包含已批准主题、`ContentExecutionContext@1.0`、`ContentIntentProfile@1.0`、Evidence、已授权知识资产及快照版本。启用结构权威时，还必须包含已冻结且带 hash 的 `structureIntent`；不得接受 caller 预制的 ContentMaster、Outline 或生成结果。执行前完整读取 [contract.md](references/contract.md) 与 [ContentIntentProfile@1.0](../../contracts/ContentIntentProfile.md)。

## 工作流

1. 校验 DirectionCard、内容目的、五类内容职能、推广模式、知识资产 ID 和平台子选题是否完整且相容；用户本篇明确选择高于长期策略默认值。
2. 将材料拆为 `confirmed_facts`、`supported_interpretations`、`author_opinions` 和 `unknowns`。
3. 为事实、解释和观点声明稳定且非空的本次 ContentMaster 业务 ID；为事实和解释绑定至少一个已有 `source_id`，为公司、产品、案例和活动信息绑定 `knowledge_asset_ids`。
4. 根据内容目的固定中心问题、中心论点、读者收益、内容重点和禁写方向。
5. 按推广模式建立知识使用合同：`none` 不主动插入，`soft` 价值优先自然带出，`focused` 以产品服务为主要内容。
6. 将动态价格、库存、时间、活动和平台规则加入发布前复检。
7. 读取 ExecutionContext 中本篇选择的转化阶段；建立互动策略约束，让平台写作模型从正文价值、平台和该阶段自然选择一个主要互动方式，不得把完整销售链路塞进单篇内容。
8. 按冻结 `structureIntent` 声明本篇采用的完整有序 `semanticUnitIds`；该字段不可省略，不得增删、重复、改写或重排 unit。省略 `structureIntent`、`semanticSpine` 和所有 authority hash，不要计算或猜测它们。
9. 建立 `claims_to_avoid`，保护跨平台事实、内容目的、结构意图和推广边界一致。

## 输出规则

只输出 `ContentMaster@2.0` raw JSON。启用结构权威时必须输出精确 `semanticUnitIds`，并省略 runtime-owned authority 字段；可信运行时会保留 raw evidence，再独立生成 canonical semantic authority。详细边界见 [contract.md](references/contract.md)。证据或知识不足时返回 `needs_review`，不得补造。

## 边界

- 不生成双平台标题、正文、卡片、图片 Prompt 或 HTML。
- 不重新选择内容目的，不改变用户的推广模式。
- 不搜索新资料，不扩大已授权知识和营销范围。
- 不决定最终 CTA，只定义自动选择规则。
- 不按长期配比机械决定本篇目的；长期配比只用于 Planner 推荐，不覆盖用户本次选择。
- 不把本篇四单元 fixture 当作通用模板；unit 数量与顺序只来自冻结结构意图。
