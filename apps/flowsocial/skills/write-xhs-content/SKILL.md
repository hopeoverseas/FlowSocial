---
name: write-xhs-content
description: 根据已批准的小红书子选题和 ContentMaster，一次生成可发布笔记文案、3:4 图文卡片逐页文案、视觉方案及可交给生图模型的无文字 ImageSpec。用于小红书内容制作阶段、实际 imagegen 调用之前；不执行生图、渲染或发布。
---

# 生成小红书图文内容包

围绕一个明确承诺同步设计发布正文与滑动卡片，先产出可审核的文字和图片提示词，再由编排器进入生图环节。

## 必填输出骨架（先建立，再填内容）

开始写任何正文、卡片或 ImageSpec 前，先建立完整 `XhsPostPackage@2.0` 根骨架；完成内容后再次按同一清单逐项核对，不得因为字段为空或位于长输出尾部而省略。

`XHS_ENVELOPE_ROOT_KEYS_EXACT: status,data,warnings,blocked_reasons`

`XHS_DATA_ROOT_KEYS_EXACT: platform,topic_id,intent_profile_id,content_purpose_id,account_context,creative_mechanism,journey_stage,matrix_coordination,content_promise,engagement_strategy,post_copy,deck,image_specs,skipped_image_pages,traceability,preflight_checks`

`XHS_REQUIRED_EVIDENCE_SKELETON` 必须在初始骨架中原样保留键和数组类型；`page_claim_map` 随最终页面补成每页恰好一项，七个 preflight 名称不得增删或重复：

```json
{
  "traceability": {
    "used_fact_ids": [],
    "used_interpretation_ids": [],
    "used_knowledge_asset_ids": [],
    "page_claim_map": []
  },
  "preflight_checks": [
    {"check":"promise_consistency","result":"pass","detail":""},
    {"check":"claim_traceability","result":"pass","detail":""},
    {"check":"image_text_separation","result":"pass","detail":""},
    {"check":"page_non_repetition","result":"pass","detail":""},
    {"check":"intent_and_promotion_alignment","result":"pass","detail":""},
    {"check":"account_identity_alignment","result":"pass","detail":""},
    {"check":"matrix_differentiation","result":"pass","detail":""}
  ]
}
```

当前 `XhsPostPackage@2.0` 没有 opinion trace 字段。`post_copy.title_candidates[].claim_ids`、`post_copy.body_sections[].claim_ids` 和 `traceability.page_claim_map[].claim_ids` 只允许引用 ContentMaster 的 `fact_id` 或 `interpretation_id`，不得引用 `author_opinions[].opinion_id`；需要依赖作者观点而无法用事实或受支持解释表达时，必须停止为 `needs_review`，不得把 opinion ID 塞入现有字段。

`traceability.used_fact_ids` 与 `used_interpretation_ids` 必须分别等于正文、标题和页面实际引用的 fact/interpretation ID 集合，不得遗漏，也不得为了通过校验加入未使用 ID。`used_knowledge_asset_ids` 只能列出 ContentMaster 授权且实际使用的知识资产。

## 输入要求

要求输入严格包含 `platform`、`content_master`、`platform_brief`、`confirmed_outline`、`writer_context`、`design_dna_ref` 和 `design_dna`。其中 `writer_context` 必须是编排器在 Provider 调用前生成并冻结的 `UnifiedWriterContext@1.0`，且带有可复算的 `writerContextHash`；它是账号身份、矩阵角色、主题、意图、内容目的、创意机制、旅程阶段和协同状态的唯一执行权威。Skill 不得从提示词、平台 Brief 或 Provider 输出中猜测或覆盖这些字段。执行前完整读取 [contract.md](references/contract.md)、[xhs-platform-playbook.md](references/xhs-platform-playbook.md) 与 [ContentIntentProfile@1.0](../../contracts/ContentIntentProfile.md)。

输出中的上述绑定字段必须与 `writer_context` 逐字段完全一致。`coordination_mode=coordinated` 时，共享活动 ID、差异化角度和禁重范围必须原样回传，且 `matrix_differentiation` 必须为 `pass`；`standalone` 时共享活动 ID 必须为 `""`，该检查才可为 `not_applicable`。任何绑定或 Schema 不一致都应停止，不得由 Adapter 修复、改名或补默认值。

缺少 `design_dna` 时不得自行套用“科技蓝、霓虹、3D”等默认风格；将状态标记为 `needs_review`，或使用调用方明确允许的中性视觉基线。

## 工作流

1. 锁定子选题的 `single_promise`、内容目的、推广模式、读者场景、事实 ID、知识资产 ID、禁写项和视觉叙事，不重新选题；同时确认公司官方号、创始人号、员工号或个人号的表达身份、信任来源和矩阵分工。`matrix_coordination.shared_campaign_topic_id` 始终必须输出字符串：输入提供共享活动 ID 时原样输出该非空字符串；当前内容不属于共享活动时输出空字符串 `""`。不得合成、默认填充、改写或虚构活动 ID，也不得用该空字符串表达热点是否评估或是否采用。
2. 读取当前任务冻结的 `content_pattern_snapshot` 和已批准 `skill_pattern_packs`；只采用与小红书、当前内容目的和账号范围匹配的结构规则，并保留版本引用。
3. 按内容目的选择信息结构和证据重点，按推广模式决定产品服务是否出现；创意机制只决定表达与传播方式，不得替代内容目的；不得把“轻度带出”写成硬广。
4. 设计 3–5 个可兑现标题并推荐一个；标题、封面、正文开头、逐页内容和 CTA 必须承诺一致。
5. 写发布正文：从具体场景或结论进入，正文使用短段落交付清单、步骤、比较、证据或避坑信息。
6. 结合内容目的、小红书阅读行为和冻结的转化阶段，自然选择一个主要互动方式并记录理由；长期销售链路不能直接变成一串 CTA。
7. 决定 6–10 页卡片节奏；每页只承担一个主要任务，封面负责承诺，中间页推进理解，末页总结或行动。
   将已确认 Outline 的角色确定性映射到正文与卡片，不得直接复制 Outline 角色，也不得临场改名：`hook → scene / cover`、`problem → problem / problem`、`diagnosis → conclusion / conclusion`、`evidence → evidence / evidence`、`method → method / method`、`example → evidence / case`、`action → summary / cta`、`boundary → warning / warning`（斜线前为 `body_sections[].role`，后为 `deck.pages[].role`）。
8. 为每页写 `text_layers`，将中文、数字、标签和 CTA 全部交给确定性 Renderer 排版。
9. 为每页选择 `html_css`、`authorized_asset`、`generated_raster` 或 `no_visual_needed`；图表、流程、步骤和大量文字优先使用 HTML/CSS，页面无需独立视觉时明确使用 `no_visual_needed`。
10. 只为 `generated_raster` 页生成独立 ImageSpec，描述主体、场景、构图、光线、色板、材质和文字安全区；提示词要求画面内无文字、无水印、无 Logo。每个 `generated_raster` 页必须且只能对应一个 ImageSpec，ImageSpec 的 `page` 必须唯一并指回该页，该页 `asset_ids` 必须且只能包含对应 ImageSpec 的 `asset_id`，且 ImageSpec 的 `design_dna_version` 必须与 `deck.design_dna_version` 完全相同。非 `generated_raster` 页不得出现在 `image_specs`，必须逐页进入 `skipped_image_pages`，其 `reason` 与页面 `render_strategy` 完全相同。
11. 执行一致性检查：内容目的已兑现，推广强度未越界，每条事实和知识主张可回指，每个资产可回指页面；同一矩阵活动中的账号表达有明确差异，不复制同标题、同封面承诺和同 CTA。`status=success` 时，`preflight_checks` 必须恰好包含且各包含一次 `promise_consistency`、`claim_traceability`、`image_text_separation`、`page_non_repetition`、`intent_and_promotion_alignment`、`account_identity_alignment`、`matrix_differentiation`；不得输出未知或自定义检查名。前六项结果必须为 `pass`，只有 `matrix_differentiation` 可在确实不适用时为 `not_applicable`，否则也必须为 `pass`。

## 强制规则

- 没有真实经历证据时，不写“我亲测、我用了、亲身经历”。
- 蓝图和参考包只能影响标题机制、开头、信息路径、视觉角色与互动方式，不能提供事实、案例或原文表达。
- 数字、日期、产品能力、案例和结论只能来自 ContentMaster。
- `matrix_coordination.differentiation_angle` 必须为非空字符串；`matrix_coordination.prohibited_overlap` 必须为仅含非空字符串的数组。
- 公司、产品、服务、案例和活动信息只能使用 `knowledge_contract.allowed_assets`，并绑定资产 ID。
- 不用表情、网络黑话或悬念词替代信息价值；表情数量服从账号策略。
- 不要求图片模型生成中文、数字、数据图、Logo、CTA、产品界面或品牌标识。
- 不生成未经授权的真人、名人、角色、商标、产品截图或艺术家风格仿制。
- 图片只承担氛围、场景、主体或隐喻；关键事实与文字由 Renderer 叠加。
- 生成式图片没有明确功能时，使用 `html_css` 或 `no_visual_needed`，不为凑数量生图。
- `promotion.mode=none` 时不得主动插入产品服务；`soft` 时产品内容不能抢占主要价值；`focused` 时仍必须说明适用边界。

## 输出规则

只输出 `XhsPostPackage@2.0` JSON，不附加 Markdown 说明。根字段 `status`、`data`、`warnings`、`blocked_reasons` 始终必填；没有警告或阻断时也必须由本 Skill 明确输出空数组，不得省略、设为 `null` 或交给调用方补默认值。`image_specs` 为空是合法结果；调用方必须先做 Schema、引用和风险校验，再把其中的 ImageSpec 交给 ImageProviderAdapter。

`body_sections` 的每一项必须原样提供 `section_id`、`role`、`text`、`claim_ids`：前三者为非空字符串，`claim_ids` 为字符串数组且 ID 必须可回指 ContentMaster。`deck.pages` 的每一项必须原样提供 `page`、`role`、`objective`、`takeaway`、`text_layers`、`layout_hint`、`visual_function`、`visual_need`、`render_strategy`、`asset_ids`、`fact_ids`、`interpretation_ids`、`must_avoid`；`page` 为从 1 连续递增的正整数，`objective`、`takeaway`、`layout_hint` 为非空字符串，`visual_need` 为字符串（允许空串），各数组字段必须显式提供。`text_layers[].max_lines` 和 `priority` 都是大于 0 的整数。不得由调用方重命名字段、类型转换、补默认值或修复不合格 Provider 输出。

## 边界

- 不调用 `imagegen`，不选择最终图片，不重试图片。
- 不生成 HTML、PNG，不执行发布。
- 不重新搜索资料、改变子选题或突破营销边界。
- 不调用其他 Skill；后续生图、渲染和视觉复核由编排器决定。
