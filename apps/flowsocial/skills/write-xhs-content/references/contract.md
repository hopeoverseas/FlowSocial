# XhsPostPackage@2.0

> 以下 JSON 是字段类型模板，不是可复制的合法实例。`"a | b"` 表示枚举，空字符串仅表示该字段类型；生成时必须按下表和运行时 `writer_context` 填入真实权威值。

## 必填根键与证据骨架

生成任何可变正文、deck 或 ImageSpec 前先实例化根骨架，完成后再按相同清单核对。任何键都不得因空值或输出较长而省略。

`XHS_ENVELOPE_ROOT_KEYS_EXACT: status,data,warnings,blocked_reasons`

`XHS_DATA_ROOT_KEYS_EXACT: platform,topic_id,intent_profile_id,content_purpose_id,account_context,creative_mechanism,journey_stage,matrix_coordination,content_promise,engagement_strategy,post_copy,deck,image_specs,skipped_image_pages,traceability,preflight_checks`

`XHS_REQUIRED_EVIDENCE_SKELETON`：

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

初始空 `page_claim_map` 只是建骨架动作；最终输出必须按 deck 每页填入恰好一项。七个 preflight 名称是 exact set：必须全部存在、各出现一次，禁止未知或自定义名称。

当前版本没有 opinion trace 字段。标题、正文和逐页 `claim_ids` 只允许使用 ContentMaster 的 `confirmed_facts[].fact_id` 或 `supported_interpretations[].interpretation_id`，不得使用 `author_opinions[].opinion_id`。需要 opinion 才能成立且无法改用事实或受支持解释时，输出非成功状态并请求审核；不得发明未版本化字段。

`traceability.used_fact_ids` 和 `used_interpretation_ids` 必须分别与标题、正文、页面及 `page_claim_map` 实际使用的 fact/interpretation ID 集合完全相等：不得漏报，也不得填入虽获授权但未使用的 ID。`used_knowledge_asset_ids` 只能包含 ContentMaster `knowledge_contract.allowed_assets` 中实际使用的资产。

| 类别 | 字段与约束 |
| --- | --- |
| 必填非空 | `topic_id`、`intent_profile_id`、`content_purpose_id`、四个 `account_context` 字段、`creative_mechanism`、`journey_stage`、`matrix_coordination.differentiation_angle` |
| 必填、允许为空 | `pinned_comment`、`cta`、`engagement_strategy.cta_text`、页面 `visual_need` 及合同明确为数组的集合 |
| 协同条件 | `coordinated` 必须原样输出权威机会 ID，且 `matrix_differentiation=pass`；`standalone` 必须输出 `""`，该检查可为 `not_applicable` |
| 精确结构 | 根对象及所有嵌套对象只允许合同列出的键；七项 preflight 是唯一允许的 exact set；`image_spec_alignment` 是验证诊断路径，不是输出字段 |

`writer_context` 在 Provider 调用前已冻结并哈希。输出的主题、意图、内容目的、账号身份、矩阵角色、创意机制、旅程阶段和矩阵协调字段必须与其完全一致；Adapter 不得合成或修复不一致输出。

```json
{
  "status": "success | partial | failed | needs_review",
  "data": {
    "platform": "xiaohongshu",
    "topic_id": "",
    "intent_profile_id": "",
    "content_purpose_id": "",
    "account_context": {
      "subject_type": "company | founder | employee | personal",
      "account_mode": "official | expert | founder_ip | employee_ip | personal_ip",
      "matrix_role": "",
      "trust_source": "institution | expertise | experience | personality | mixed"
    },
    "creative_mechanism": "search_answer | checklist | case_reconstruction | contrast | experiment | opinion | trend_bridge | story",
    "journey_stage": "discover | understand | trust | consider | convert | retain",
    "matrix_coordination": {
      "shared_campaign_topic_id": "",
      "differentiation_angle": "",
      "prohibited_overlap": []
    },
    "content_promise": "",
    "engagement_strategy": {
      "mode": "auto",
      "primary_action": "save | share | comment | follow | consult | try | buy | register | none",
      "reason": "",
      "cta_placement": "body | ending | pinned_comment | card | none",
      "cta_text": ""
    },
    "post_copy": {
      "title_candidates": [
        {"title": "", "hook_type": "result | problem | contrast | checklist | question", "claim_ids": [], "risk": "low | medium | high"}
      ],
      "recommended_title": "",
      "opening": "",
      "body_sections": [
        {"section_id": "S1", "role": "scene | problem | conclusion | method | evidence | warning | summary", "text": "", "claim_ids": []}
      ],
      "ending": "",
      "pinned_comment": "",
      "hashtags": [],
      "cta": ""
    },
    "deck": {
      "deck_id": "DECK001",
      "canvas": {"width": 1080, "height": 1440, "ratio": "3:4"},
      "design_dna_version": "",
      "reading_arc": "",
      "pages": [
        {
          "page": 1,
          "role": "cover | problem | conclusion | method | evidence | case | warning | summary | cta",
          "objective": "",
          "takeaway": "",
          "text_layers": [
            {"type": "headline | body | label | footer", "text": "", "max_lines": 3, "priority": 1}
          ],
          "layout_hint": "",
          "visual_function": "attention | explain | compare | demonstrate | pace | none",
          "visual_need": "",
          "render_strategy": "html_css | authorized_asset | generated_raster | no_visual_needed",
          "asset_ids": [],
          "fact_ids": [],
          "interpretation_ids": [],
          "must_avoid": []
        }
      ]
    },
    "image_specs": [
      {
        "asset_id": "xhs-deck001-p03-bg",
        "page": 3,
        "use_case": "illustration-story | photorealistic-natural | stylized-concept | product-context | texture-background",
        "asset_type": "carousel-background | subject-cutout | scene-illustration",
        "scene": "",
        "subject": "",
        "style_and_medium": "",
        "composition": "",
        "lighting": "",
        "palette": [],
        "materials": "",
        "text_safe_area": "",
        "prompt": "",
        "negative_prompt": "text, letters, numbers, watermark, logo, interface screenshot, illegible symbols",
        "reference_asset_ids": [],
        "design_dna_version": "",
        "size": "1024x1536",
        "must_keep": [],
        "must_avoid": [],
        "text_policy": "no_text_in_image"
      }
    ],
    "skipped_image_pages": [
      {"page": 2, "reason": "html_css | authorized_asset | no_visual_needed"}
    ],
    "traceability": {
      "used_fact_ids": [],
      "used_interpretation_ids": [],
      "used_knowledge_asset_ids": [],
      "page_claim_map": [{"page": 1, "claim_ids": []}]
    },
    "preflight_checks": [
      {"check": "promise_consistency", "result": "pass | fail", "detail": ""},
      {"check": "claim_traceability", "result": "pass | fail", "detail": ""},
      {"check": "image_text_separation", "result": "pass | fail", "detail": ""},
      {"check": "page_non_repetition", "result": "pass | fail", "detail": ""},
      {"check": "intent_and_promotion_alignment", "result": "pass | fail", "detail": ""},
      {"check": "account_identity_alignment", "result": "pass | fail", "detail": ""},
      {"check": "matrix_differentiation", "result": "pass | fail | not_applicable", "detail": ""}
    ]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

## 数量与一致性

- 根字段 `status`、`data`、`warnings`、`blocked_reasons` 均为必填；后两个字段没有内容时仍输出 `[]`，调用方不得合成。
- `matrix_coordination.shared_campaign_topic_id` 是必填字符串。空字符串 `""` 仅表示当前内容不属于共享活动；非空字符串必须是输入已提供的共享活动 ID，并原样保留。缺失、`null` 或非字符串均不合法。不得合成、默认填充、改写或虚构该字段，也不得把空字符串解释为热点未评估、未采用或其他热点状态。
- `matrix_coordination.differentiation_angle` 必须为非空字符串；`matrix_coordination.prohibited_overlap` 必须为仅含非空字符串的数组。

- 标题候选 3–5 个，标签 3–8 个；正文长度服从调用方策略。
- 卡片默认 6–10 页，但不得通过重复信息凑页数。
- `image_specs` 与 `render_strategy=generated_raster` 页面必须双向一一对应：每个生成页恰好有一个 ImageSpec，每个 ImageSpec 的 `page` 唯一且只能指向生成页，生成页的 `asset_ids` 恰好包含该 ImageSpec 的唯一 `asset_id`，ImageSpec 的 `design_dna_version` 必须与 `deck.design_dna_version` 完全相同。非生成页不得进入 `image_specs`，必须逐页进入 `skipped_image_pages`，且 `reason` 与该页 `render_strategy` 完全相同。
- `status=success` 时，`preflight_checks` 必须恰好包含上述七个唯一名称，各出现一次且不得有未知名称。`promise_consistency`、`claim_traceability`、`image_text_separation`、`page_non_repetition`、`intent_and_promotion_alignment`、`account_identity_alignment` 必须为 `pass`；只有 `matrix_differentiation` 可为 `pass` 或在确实不适用时为 `not_applicable`。任一必需项缺失、重复、未知或结果不满足时不得输出 `success`。
- `recommended_title`、封面 headline、`opening` 和 `content_promise` 必须语义一致。
- 所有 claim/fact/interpretation ID 必须存在于输入 ContentMaster；XHS v2.0 的标题、正文和逐页 `claim_ids` 只能引用 fact/interpretation ID，禁止 opinion ID。

## Outline 角色映射

Writer 必须按下表从已确认 Outline 生成正文与卡片角色；不得把 Outline 角色直接复制到 Writer，也不得新增别名或扩大枚举。

| Outline `sections[].role` | `body_sections[].role` | `deck.pages[].role` |
| --- | --- | --- |
| `hook` | `scene` | `cover` |
| `problem` | `problem` | `problem` |
| `diagnosis` | `conclusion` | `conclusion` |
| `evidence` | `evidence` | `evidence` |
| `method` | `method` | `method` |
| `example` | `evidence` | `case` |
| `action` | `summary` | `cta` |
| `boundary` | `warning` | `warning` |

## 嵌套项要求

- `body_sections[]` 每项必须显式包含 `section_id`、`role`、`text`、`claim_ids`。前三者必须为非空字符串；`claim_ids` 必须为字符串数组且每个 ID 可回指 ContentMaster，空数组合法。
- `deck.pages[]` 每项必须显式包含 `page`、`role`、`objective`、`takeaway`、`text_layers`、`layout_hint`、`visual_function`、`visual_need`、`render_strategy`、`asset_ids`、`fact_ids`、`interpretation_ids`、`must_avoid`。`page` 必须是从 1 连续递增的正整数；`objective`、`takeaway`、`layout_hint` 必须为非空字符串；`visual_need` 必须为字符串，允许空串；数组字段必须显式提供且元素类型符合合同。
- `text_layers[].max_lines` 与 `text_layers[].priority` 都必须是大于 0 的整数。
- `render_strategy` 只能是 `html_css`、`authorized_asset`、`generated_raster`、`no_visual_needed`；页面确实无需独立视觉时使用 `no_visual_needed`。
- Adapter 不得重命名字段、转换类型、补默认值或合成缺失字段；任一嵌套字段不合格时必须停止在 Writer 合同边界。
