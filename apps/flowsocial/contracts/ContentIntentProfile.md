# ContentIntentProfile@1.0

由 `ContentIntentProfileBuilder` 根据用户在内容生成页的选择确定性生成，不调用 LLM。

```json
{
  "profile_id": "CIP001",
  "topic_id": "",
  "platform": "xiaohongshu | wechat_official_account",
  "purpose": {
    "id": "hotspot_industry_explainer | knowledge_howto | professional_opinion | product_service_promotion | case_result_showcase | brand_story | interactive_discussion | event_announcement",
    "label": "",
    "description": ""
  },
  "promotion": {
    "mode": "none | soft | focused",
    "knowledge_enabled": false,
    "knowledge_asset_ids": [],
    "knowledge_snapshot_id": "",
    "insertion_rule": "do_not_mention | value_first_natural_context | promotion_is_primary"
  },
  "engagement_policy": {
    "mode": "auto",
    "optimize_for": ["open", "finish", "save", "share", "comment", "follow", "conversion"],
    "selected_primary_action": "model_selected | save | share | comment | follow | consult | try | buy | register | none",
    "selection_rule": "平台写作模型根据内容自然选择一个主要互动方式，不在一篇内容中堆叠全部 CTA"
  },
  "strategy_alignment": {
    "content_function": "discovery | authority | proof | solution | action",
    "conversion_stage": {"id": "", "label": "", "action": ""},
    "evidence_requirement": "",
    "purpose_eligible": true,
    "eligible_purpose_ids": [],
    "user_override_applied": false,
    "rule": "用户本篇选择优先；长期策略用于提示与约束，不替代用户选择"
  },
  "source": {
    "type": "user_selection",
    "selected_at": "",
    "ui_version": "content-purpose-v2"
  }
}
```

## 八类内容目的

| ID | 标签 | 描述 |
|---|---|---|
| `hotspot_industry_explainer` | 热点/行业解读 | 讲清发生了什么、为什么重要，以及可能带来的影响 |
| `knowledge_howto` | 知识干货分享 | 提供方法、步骤、清单、工具或避坑建议 |
| `professional_opinion` | 专业观点表达 | 针对事件或趋势给出有依据的判断、分析和立场 |
| `product_service_promotion` | 产品/服务推广 | 介绍产品服务解决的问题、适用场景和价值 |
| `case_result_showcase` | 案例/成果展示 | 用真实案例、过程或成果证明专业能力 |
| `brand_story` | 品牌形象宣传 | 展示公司理念、团队、故事、文化或品牌动态 |
| `interactive_discussion` | 互动话题讨论 | 通过问题、争议或共鸣点吸引用户参与 |
| `event_announcement` | 活动/信息发布 | 发布活动、直播、课程、报告、招聘或更新 |

## 推广与知识库规则

- `none`：不得为了推广调用产品或公司资料，不主动插入产品服务。
- `soft`：可读取用户勾选的知识资产；先交付独立内容价值，只在相关位置自然带出产品或服务。
- `focused`：产品服务是主要内容；必须读取用户勾选的知识资产，并清楚说明问题、适用场景、价值、证据和边界。
- `soft` 或 `focused` 没有知识资产时返回输入错误，不允许模型编造公司、产品、案例或活动信息。
- 内容目的为 `product_service_promotion` 时，推广模式必须是 `soft` 或 `focused`；界面默认选择 `focused`。
- 当内容目的本身是产品推广、案例展示、品牌宣传或活动发布时，即使推广模式为 `none`，仍可读取为完成主题所必需的已选知识资产；此时不得额外扩大宣传范围。

## 目的对内容的控制

内容目的控制信息选择、结构、语气和证据重点，不改变平台子选题和事实。用户修改内容目的时必须重新构建 ContentMaster，并重跑平台内容生成。
