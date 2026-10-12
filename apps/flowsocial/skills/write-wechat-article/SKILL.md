---
name: write-wechat-article
description: 根据已批准的公众号子选题和 ContentMaster，生成符合公众号连续阅读、可信论证与转发场景的标题、摘要、大纲、完整正文、引用映射和发布检查。用于公众号写作阶段；不搜索新事实、不生成图片、不排版发布。
---

# 撰写公众号文章

## WechatCreativeDraft@1.0 shadow contract

Provider may return only the coherent narrative draft fields listed below. Runtime-owned IDs, hashes, authority bindings, account references, claim/source maps and preflight results are deliberately excluded from this payload. The offline shadow compiler validates continuity and reference intent, then binds those mechanical fields from frozen authority before producing the existing `WechatArticle@2.0` envelope. It never repairs prose or invokes a Provider.

Provider-owned fields: `article_promise`, `core_argument`, `information_gain`, `title_candidates` (3–5 strings), `recommended_title`, `abstract`, `opening`, `outline`, `article_markdown`, `pull_quotes`, `key_takeaways`, `share_summary`, `share_reason`, `discovery_plan`, `relationship_handoff`, `engagement_strategy`, and `cta`.

Any extra field (including `id`, `hash`, `*_ref`, `account_context`, `claim_map`, `source_list`, or `preflight_checks`) is rejected as a runtime-owned field. The compiler output retains the raw draft as evidence while exposing only the canonical WeChat runtime data to downstream validators.

围绕一个中心论点建立连续的解释链，让标题、摘要、开篇、正文和结论具有一致的信息承诺，并清楚区分事实、解释、观点和未知项。

## 输入要求

要求输入严格包含 `platform`、`content_master`、`platform_brief`、`confirmed_outline` 和 `writer_context`。其中 `writer_context` 必须是编排器在 Provider 调用前生成并冻结的 `UnifiedWriterContext@1.0`，且带有可复算的 `writerContextHash`；它是账号身份、矩阵角色、主题、意图、内容目的、创意机制、旅程阶段和协同状态的唯一执行权威。Skill 不得从提示词、平台 Brief 或 Provider 输出中猜测或覆盖这些字段。执行前完整读取 [contract.md](references/contract.md)、[wechat-platform-playbook.md](references/wechat-platform-playbook.md) 与 [ContentIntentProfile@1.0](../../contracts/ContentIntentProfile.md)。

输出中的上述绑定字段必须与 `writer_context` 逐字段完全一致。`coordination_mode=coordinated` 时，共享活动 ID、差异化角度和禁重范围必须原样回传，且 `matrix_differentiation` 必须为 `pass`；`standalone` 时共享活动 ID 必须为 `""`，该检查才可为 `not_applicable`。任何绑定或 Schema 不一致都应停止，不得由 Adapter 修复、改名或补默认值。

## 工作流

1. 锁定 `core_argument`、内容目的、推广模式、`information_gain`、读者问题、证据与知识边界和禁写项，不重新选题；同时确认公司官方号、创始人号、专家号或个人号的表达身份、信任来源和矩阵分工。`matrix_coordination.shared_campaign_topic_id` 始终必须输出字符串：输入提供共享活动 ID 时原样输出该非空字符串；当前内容不属于共享活动时输出空字符串 `""`。不得合成、默认填充、改写或虚构活动 ID，也不得用该空字符串表达热点是否评估或是否采用。
2. 读取当前任务冻结的 `content_pattern_snapshot` 和已批准 `skill_pattern_packs`；只采用与公众号、当前内容目的和账号范围匹配的论证结构，并保留版本引用。
3. 按内容目的选择论证结构和信息重点，按推广模式决定产品服务是否出现；创意机制只决定论证切口和传播包装，不得替代内容目的；不得把行业文章偷换成广告软文。
4. 生成 3–5 个标题候选，说明每个标题的切入法、主张 ID 和风险；推荐能被正文完整兑现的一项。
5. 写一个可独立传达文章价值的摘要，不把摘要写成悬念广告。
6. 先生成可审计大纲：每节说明论证任务、推进关系、使用证据和需要交代的边界。
7. 按“发生了什么—为什么重要—如何理解—对读者意味着什么—边界与行动”形成连续文章；根据题型调整，不机械套模板。
8. 每个核心段落只承担一个论证任务，使用过渡句解释与前后文的关系。
9. 对数据、案例、产品能力、动态事实和引语绑定 ContentMaster ID；无法证实的内容删除或标记未知。
10. 根据文章价值、公众号阅读场景和冻结的转化阶段自然选择一个主要互动方式并给出理由，不在结尾堆叠全部 CTA，也不照抄完整销售路径。
11. 输出可转发摘要、关键结论、知识资产映射、引用映射、发布时效复检项和营销披露检查，并设计文章进入公众号关系系统后的承接：栏目归属、关联阅读、关注理由、菜单或关键词回复入口；不存在的基础设施不得虚构。

## 强制规则

- 不虚构个人经历、采访、用户反馈、案例、数据或行业共识。
- `matrix_coordination.differentiation_angle` 必须为非空字符串；`matrix_coordination.prohibited_overlap` 必须为仅含非空字符串的数组。
- 蓝图和参考包只能影响标题机制、开头、论证顺序、视觉角色与互动方式，不能提供事实、案例或原文表达。
- 不把单个平台样本外推为整个行业结论。
- 标题、摘要、中心论点和结论必须一致；标题不能比证据更确定。
- 动态信息保留复检标记，并记录应复核的事实 ID。
- 营销内容必须服从输入模式，先交付独立价值，再披露利益关系和 CTA。
- 公司、产品、服务、案例和活动信息只能来自 `knowledge_contract.allowed_assets`。
- 避免连续使用碎片短句、过量小标题、模板化排比和空泛升华。
- `promotion.mode=none` 时不得主动插入产品服务；`soft` 时自然带出不得改变文章中心；`focused` 时仍需提供证据、适用对象和边界。

## 输出规则

只输出 `WechatArticle@2.0` JSON，不附加解释性正文。根字段 `status`、`data`、`warnings`、`blocked_reasons` 始终必填；没有警告或阻断时也必须由本 Skill 明确输出空数组，不得省略、设为 `null` 或交给调用方补默认值。

对未获授权、且不是文章核心主张所必需的时效事实、法规状态、工具能力或外部数字，应省略或改写为不依赖该事实的通用表述。缺少核心主张所必需且无法安全省略的权威输入时，仍应如实阻断。

Canonical example 是可通过结构与代表性正文质量 Gate 的完整样本，不是允许复制的业务内容。Gateway 先检查结构与最低正文质量；writer context、claim/source、preflight 与平台语义仍由 Domain Gate 独立校验，调用方不得补写或扩写。

单次正文恢复只接受合同文档列出的白名单包装并确定性解包。解析失败、Schema 失败与生产质量 Gate 失败分别记录脱敏诊断；任何失败都继续阻断下游，不得用静态补文、字段伪造或空 fallback 制造成功。恢复窗口保持最多一次预检和一次正文调用，禁止后台自动重试。

当且仅当 `wechatBodyFirstRecoveryV1` 显式开启时，手工恢复改为两个内部阶段：先输出 `WechatArticleBodyRecovery@1.0` 原生正文，再输出不含正文的 `WechatArticleMetadataRecovery@1.0`。两阶段必须原样回传同一组 contentRun、策略快照、确认大纲和输入摘要绑定；任一阶段失败立即阻断，禁止第二阶段补写或改写正文。确定性 Adapter 只合并两个已验证对象为既有 `WechatArticle@2.0`，仍须通过原生产质量 Gate。Flag 默认关闭，关闭时保留现有单阶段行为。

## 边界

不联网、不调用 WeWrite 总控、不生成配图、不做 HTML 排版、不进入草稿箱或发布；不调用其他 Skill。
