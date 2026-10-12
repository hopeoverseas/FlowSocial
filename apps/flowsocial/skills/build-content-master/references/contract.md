# ContentMaster@2.0

## Raw Provider 输出

Provider 输出业务字段，并在启用冻结结构意图时增加：

```json
{
  "status": "success",
  "data": {
    "content_master_id": "CM001",
    "confirmed_facts": [
      {"fact_id": "F001", "fact": "Verified fact supported by the cited source.", "source_ids": ["SRC001"]}
    ],
    "supported_interpretations": [],
    "author_opinions": [],
    "source_list": [{"source_id": "SRC001"}],
    "semanticUnitIds": ["unit-id"]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

Provider owns the local semantic identities it creates (`fact_id`, `interpretation_id`, and `opinion_id`) and must emit each as a stable non-empty string. Every confirmed fact must contain non-empty text and at least one existing source binding. Source identity comes from frozen input authority: Provider selects existing `source_id` values and must not invent them. Runtime validates and preserves these business identities; it never derives or rewrites them from text, order, or hashes.

启用冻结结构权威时，`semanticUnitIds` 必须存在，并且是与冻结 `unitOrder` 完全一致的有序字符串数组。缺失、类型错误、重复、未知、遗漏或重排均 fail closed；runtime 不通过关键词、meaning 相似度或 authority echo 推断该声明。

Provider 不计算或授权 `structureIntent`、`semanticSpine`、`intentHash`、`unitHash`、`spineHash` 或 `contentMasterHash`，应省略这些字段。为兼容 raw evidence，若 Provider 回显它们，原始 envelope 与 hash 保持不变，但这些值仅是 advisory evidence：既不阻断也不覆盖 canonical authority。可信 runtime 只使用已验证的 `semanticUnitIds`、冻结 `structureIntent` 与业务内容构造 canonical spine 和 hashes；不会把 echo 合并进业务内容，也不会用 echo 修补缺失或冲突的 `semanticUnitIds`。

## Canonical runtime / persisted 输出

```json
{
  "status": "success | failed | needs_review",
  "data": {
    "content_master_id": "CM001",
    "topic_id": "",
    "intent_profile_id": "CIP001",
    "platform": "xiaohongshu | wechat_official_account",
    "content_purpose": {
      "id": "hotspot_industry_explainer | knowledge_howto | professional_opinion | product_service_promotion | case_result_showcase | brand_story | interactive_discussion | event_announcement",
      "label": "",
      "description": ""
    },
    "target_audience": [],
    "central_question": "",
    "central_thesis": "",
    "reader_value": "",
    "content_emphasis": [],
    "strategy_alignment": {
      "content_function": "discovery | authority | proof | solution | action",
      "platform_role": "",
      "conversion_stage": {"id": "", "label": "", "action": ""},
      "evidence_requirement": "",
      "purpose_eligible": true,
      "user_override_applied": false
    },
    "confirmed_facts": [{"fact_id": "F001", "fact": "Verified fact supported by the cited source.", "source_ids": ["SRC001"]}],
    "supported_interpretations": [{"interpretation_id": "I001", "text": "Supported interpretation.", "source_ids": ["SRC001"], "confidence": "high | medium | low"}],
    "author_opinions": [{"opinion_id": "O001", "text": ""}],
    "unknowns": [],
    "examples": [],
    "knowledge_contract": {
      "enabled": false,
      "snapshot_id": "",
      "allowed_assets": [{"asset_id": "", "asset_type": "company_profile | product | service | case | event | other", "allowed_uses": []}],
      "forbidden_uses": []
    },
    "promotion": {
      "mode": "none | soft | focused",
      "insertion_rule": "do_not_mention | value_first_natural_context | promotion_is_primary",
      "allowed_items": [],
      "allowed_claims": [],
      "forbidden_claims": [],
      "disclosure": ""
    },
    "engagement_policy": {
      "mode": "auto",
      "optimize_for": ["open", "finish", "save", "share", "comment", "follow", "conversion"],
      "selected_primary_action": "model_selected | save | share | comment | follow | consult | try | buy | register | none",
      "cta_rule": "select_one_primary_action_naturally"
    },
    "claims_to_avoid": [],
    "publish_time_checks": [],
    "source_list": [{"source_id": "SRC001"}]
    ,"structureIntent": {
      "id": "structure-intent-id",
      "structureType": "ordered_framework",
      "requiredUnits": [{"id": "unit-id", "meaning": "", "boundary": ""}],
      "optionalUnits": [],
      "orderingPolicy": {"mode": "strict | flexible", "unitOrder": ["unit-id"]},
      "intentHash": "sha256"
    },
    "semanticSpine": {
      "id": "semantic-spine-id",
      "structureIntentRef": {"id": "structure-intent-id", "hash": "intentHash"},
      "structureType": "ordered_framework",
      "orderingPolicy": {"mode": "strict | flexible", "unitOrder": ["unit-id"]},
      "units": [{"id": "unit-id", "meaning": "", "required": true, "order": 0, "boundary": "", "unitHash": "sha256"}],
      "spineHash": "sha256"
    },
    "contentMasterHash": "sha256"
  },
  "warnings": [],
  "blocked_reasons": []
}
```

`confirmed_facts` 必须有来源；低置信解释不得改写为确定事实。知识资产只允许按照 `allowed_uses` 被引用。

## Semantic spine 确定性合同

当输入包含 `structureIntent` 时，可信运行时在 Provider 返回后、Output Fact 编译前构造上述三个字段；canonical runtime 与持久化记录必须包含它们。历史输入没有该字段时继续按原合同读取，不迁移旧快照。

- `intentHash` 覆盖除自身外的完整 `structureIntent`。required/optional unit ID 不得重复，`unitOrder` 必须逐一且仅一次列出全部 unit。
- semantic spine 由可信运行时按 `unitOrder` 逐项复制 unit 的 ID、meaning、required、order 和 boundary；`unitHash` 覆盖该 unit 的五个字段，`spineHash` 覆盖除自身外的完整 spine。
- `contentMasterHash` 覆盖除自身与历史平台标签外的共享 ContentMaster 数据。运行时包装产生的 `ContentMaster@3.0`、`id` 和 `schemaVersion` 不改变该语义 hash。
- 结构意图只能来自冻结的用户/策略输入。Provider 只声明 unit IDs，不得增删、替换、重排或改写 unit，也不得输出另一套核心框架或把自己提供的 hash 当作权威。
- 本篇 `business -> knowledge -> workflow -> iteration` 只是 strict fixture；合同支持任意正数的 required units、任意 optional units 与 flexible ordering。
