---
name: generate-platform-titles
description: 基于已经完成的正文、ContentMaster 和初拟标题，为小红书或公众号生成、评分并选择最终平台标题。用于正文完成后的第二阶段标题优化或单独重做标题；不得创建选题、补充事实、修改正文或控制上下游工作流。
---

# 生成最终平台标题

只处理标题。把正文和 ContentMaster 视为锁定输入，不反向改写选题、大纲、正文、CTA 或事实。

## 输入

要求输入包含：

- `stage: final_after_body`；
- `platform`；
- `content_master`；
- `completed_content`；
- `preliminary_titles`；
- `content_task_brief`；
- 可选的 `same_account_title_signals`。
- 可选的 `content_pattern_snapshot` 与已批准 `skill_pattern_packs`；两者只提供抽象标题机制和禁用项。

历史信号必须来自当前账号可追溯的数据。没有数据时保持空值，不得使用内置经验冒充用户账号规律。

## Production input authority

The production invocation must receive the full immutable `content_master`, the current platform Writer output as `completed_content`, the Writer's `preliminary_titles`, the complete `content_task_brief`, and only explicitly authorized same-account signals. References to those objects are not substitutes for the objects themselves. Signal authorization must match the current account; otherwise `same_account_title_signals` is an empty array.

Authorization is established upstream with an account-matched `sameAccountTitleSignalsAuthorization` record and an explicit `signalIds` allowlist. The Skill receives only the filtered signals and may cite only those IDs in `same_account_signal_usage`.

Only `status: success` is eligible for candidate generation. `failed` and `needs_review` stop at the title stage. The `balanced` recommendation becomes the visible platform title through an additive final-title binding; this projection must not mutate the Writer output fact.

## 原子流程

1. 从完成稿中提取内容类型、目标读者、核心结论、最强证据、读者可带走的结果、真实实体和时效依赖。
2. 先构建 `TitleBrief`，再生成 5–8 个实质不同的候选标题。候选应覆盖稳健、传播、搜索或长期价值中的至少三种动机，不做同一句话的表面替换。
3. 按顺序决策：正文真实结论、读者具体收益、事实证据、强相关实体或关键词、语言节奏。后项不得破坏前项。
4. 默认使用肯定句。只有正文明确回答真实认知缺口、对比、购买决策或争议时才使用疑问句。
5. 为每个候选绑定正文中支持其承诺的 `claim_ids`，并评分、标注风险。
   如果调用输入包含 `editorial_autonomy.empty_claim_ids_when_no_exact_authorized_id=true`，找不到完全匹配的已授权 ID 时使用空数组；不得猜测、改写或生成 claim ID。标题仍须保持低风险、通用表达。
6. 推荐稳健主标题及安全、传播、搜索、实验备选。高风险标题不得成为主标题。

当 `editorial_autonomy.choose_low_risk_titles=true` 时，即使正文只有通用方法论，也应直接生成低风险标题并返回 `status: success`；没有精确授权 claim 时使用空 `claim_ids`，不要因为缺少案例或数字而返回 `needs_review`。

## 约束

- 一个标题只保留一个主承诺；第二分句只能补充证据、结果或交付物。
- 核心实体、变化或结果尽量放在前部。
- 普通标题优先控制在 24–38 个汉字；教程、对比和资源型可放宽，但默认不超过 55 个汉字。
- 最多一个问号或感叹号；禁止连续感叹、模糊双问和仅靠“重磅、最强、杀疯了”等词制造钩子。
- 正文没有依据时，禁止添加数字、公司、产品、评测、结果、官方、首个、最强、开源或个人亲历。
- 关键词必须帮助识别对象、证明可信度、说明交付物或判断相关性。不得将历史相关性称为算法规则、推荐池机制或因果关系。
- 保持账号语气，不复制参考爆款标题，不引入蓝图原文。
- 只采用与当前平台、内容目的和正文承诺一致的参考包规则；正文证据与账号语气优先于历史表现规律。

严格返回 `PlatformTitleList@1.0`。

Provider Gateway 只验证 canonical envelope 与嵌套对象结构。候选数量、七项评分、动机差异、推荐引用、高风险主标题、claim 与账号信号授权仍由 Domain Gate fail closed；不得依赖示例值或后处理修复。
