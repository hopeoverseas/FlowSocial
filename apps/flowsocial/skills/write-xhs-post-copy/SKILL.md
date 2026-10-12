---
name: write-xhs-post-copy
description: 为小红书生成原子正文、互动选择和供后续标题阶段使用的预备标题信号。用于已具备完整 ContentMaster、确认大纲、平台 brief、Writer Context、正式机制决策与推广政策的正文写作阶段；不得从公众号正文改写，不规划轮播、视觉资产、追踪、preflight、最终标题绑定或发布状态。
---

# Write XHS Post Copy

只生成携带 `XhsPostCopyCreativeOutput@1.0` data 的统一 Skill envelope。开始前读取 [references/contract.md](references/contract.md)，严格遵守 envelope/data exact keys、状态语义、枚举、引用和 Outline 映射。

## 输入门槛

要求调用方提供以下完整、不可变对象，而非仅提供引用：

- `contentMaster`
- `confirmedOutline`
- `platformBrief`
- `writerContext`
- `mechanismDecision`
- `promotionPolicy`

缺少任一对象、对象状态未确认、authority binding 不一致或授权 ID 集合不完整时停止，不生成猜测性输出。只从这些小红书上游权威写作；不得读取公众号正文作为母版。

## 原子流程

1. 锁定 ContentMaster 的内容承诺、受众、已确认事实、受支持解释、授权知识资产和推广边界。
2. 按 `confirmedOutline.sections` 的顺序逐项写 `bodySections`；保持 `sectionId` 与 `outlineRole`，并使用合同规定的正文角色映射。不得新增、删除、合并或重排 section。
3. 只把正文真实使用的 fact、interpretation 和 knowledge asset ID 写入对应引用数组。`input.authorized_references` 是可填写 ID 的机器白名单；每个 `claimIds` 只能逐字复制 `authorized_references.claim_ids` 中的值，每个 `knowledgeAssetIds` 只能逐字复制 `authorized_references.knowledge_asset_ids` 中的值。`non_claim_opinion_ids` 代表可以用于表达、但绝不能写入 `claimIds` 的作者观点 ID。没有使用明确事实或资产时输出 `[]`，不得自造、改写大小写或引用未授权 ID，也不得把知识资产当作新事实来源。
4. 只读取正式 `mechanismDecision` 决定当前内容机制和是否采用热点。不得自行寻找、补选或暗示热点；未采用时不得偷偷加入热点表达。
5. 按 `promotionPolicy` 生成 `promotionUse`。`none` 不插入推广；`soft` 与 `focused` 只能使用明确允许的 item ID 和原样 disclosure。
6. 生成正文、结尾、标签、CTA、置顶评论和 3–5 个实质不同的预备标题信号。标题承诺必须由正文和授权 claim 支持。
7. 如果输入包含 `editorial_autonomy`：以 `confirmed_outline.sections` 数组顺序为唯一正文顺序，忽略不影响事实授权的 placement/anchor 顺序提示；可将未定义的框架改写为“本文整理的通用步骤”，可在没有案例和数据时只写通用方法论，并自行选择一个轻量 CTA。以上属于编辑判断，不应返回 `needs_review` 或 `blocked`。
8. 只有事实冲突、未授权事实/案例/数据、主题越权或必要权威对象缺失时才返回 `needs_review`/`blocked`。对照 reference 的 exact contract 做最后检查。只输出一个 JSON 对象，不附加 Markdown 或解释。

## 权限边界

- Provider 只拥有 creative-output 字段。不得输出 `id`、`authorityBinding`、任何 hash、trace、preflight、quality gate、版本事实、选择、交付或发布状态。
- `titleCandidates` 与 `recommendedTitle` 只是 preliminary signals。后续 `generate-platform-titles` 才能创建最终标题候选和 final title binding；本 Skill 不拥有该权限。
- 只有 `status=success` 时，系统才可把已验证 `data` 与系统生成的 schema、contract、ID、authority binding 组合，并调用确定性 `createXhsPostCopy` 计算 `componentHash`。`needs_review` 或 `blocked` 不得组装、补值或修补。
- 不规划 carousel page、deck、text layer、layout、render strategy、ImageSpec、视觉资产或图片提示词。
- 不调用其他 Skill、Provider 或外部工具；不搜索新资料，不改变 ContentMaster、确认大纲或机制决策。

## 输出

仅输出符合 [references/contract.md](references/contract.md) 的 exact envelope：`status`、`data`、`warnings`、`blocked_reasons`。成功时 `data` 必须是完整 `XhsPostCopyCreativeOutput@1.0`；非成功时 `data` 必须为 `null`。缺失、额外、错误类型或不符合状态语义的值均不可由调用方补默认值或修复；应在合同边界安全失败。

Provider Gateway 只验证 envelope 与 exact object shape；Outline 映射、授权子集、Promotion 和正文质量继续由原子 Runtime fail closed，不能借结构通过绕过。
