# WechatArticle@2.0

## Provider shadow input

`WechatCreativeDraft@1.0` is an offline, narrative-only input. Its exact provider-owned vocabulary is documented in the Skill file; runtime-owned identity, authority, claim/source, hash and preflight fields must not be supplied by the Provider. The deterministic shadow compiler binds those fields from the frozen `content_master`, confirmed outline, writer context and preflight authority, preserving the unmodified draft as raw evidence.

根字段 `status`、`data`、`warnings`、`blocked_reasons` 均为必填；后两个字段没有内容时仍输出 `[]`，统一生产 Adapter 不得合成。统一生产链只允许完整 `success` 进入标题、审阅和候选阶段；恢复兼容包装不改变这一权威边界。

> 以下 JSON 是字段类型模板，不是 canonical success example，也不是可复制的合法实例。Gateway 使用独立的非空 canonical example 验证结构和代表性正文质量；生成时仍必须按下表和运行时 `writer_context` 填入真实权威值。Domain Gate 保留 writer context、claim/source、preflight 与平台语义验证。

| 类别 | 字段与约束 |
| --- | --- |
| 必填非空 | `topic_id`、`intent_profile_id`、`content_purpose_id`、四个 `account_context` 字段、`creative_mechanism`、`journey_stage`、核心论点与摘要等正文语义字段 |
| 必填且至少一项 | `key_takeaways`；每个 `claim_map[].section_ids` 也至少含一个已存在的章节 ID |
| 必填、允许为空 | `cta`、关系承接中的可选入口字符串，以及合同明确允许为空的数组 |
| 来源约束 | `source_list[]` 必须与权威 `ContentMaster.source_list[]` 的键和值完全一致，不得增加、删减、改写或虚构来源 |
| 协同条件 | `coordinated` 必须原样输出权威机会 ID，且 `matrix_differentiation=pass`；`standalone` 必须输出 `""`，该检查可为 `not_applicable` |

`writer_context` 在 Provider 调用前已冻结并哈希。输出的主题、意图、内容目的、账号身份、矩阵角色、创意机制、旅程阶段和矩阵协调字段必须与其完全一致；Adapter 不得合成或修复不一致输出。每个必需 preflight 名称必须恰好出现一次，错误只报告合同叶路径，不持久化原始 Provider 内容。

```json
{
  "status": "success | failed | needs_review",
  "data": {
    "platform": "wechat_official_account",
    "topic_id": "",
    "intent_profile_id": "",
    "content_purpose_id": "",
    "account_context": {
      "subject_type": "company | founder | expert | personal",
      "account_mode": "official | expert | founder_ip | personal_ip",
      "matrix_role": "",
      "trust_source": "institution | expertise | experience | personality | mixed"
    },
    "creative_mechanism": "search_answer | framework | case_reconstruction | industry_analysis | opinion | trend_bridge | story",
    "journey_stage": "discover | understand | trust | consider | convert | retain",
    "matrix_coordination": {
      "shared_campaign_topic_id": "",
      "differentiation_angle": "",
      "prohibited_overlap": []
    },
    "article_promise": "",
    "core_argument": "",
    "information_gain": "",
    "title_candidates": [
      {"title": "", "approach": "event | question | conclusion | contrast | method", "claim_ids": [], "risk": "low | medium | high"}
    ],
    "recommended_title": "",
    "abstract": "",
    "opening": {"type": "event | scene | question | conclusion", "text": "", "claim_ids": []},
    "outline": [
      {
        "section_id": "W1",
        "heading": "",
        "purpose": "",
        "relation_to_previous": "start | explain | support | contrast | limit | conclude",
        "claim_ids": [],
        "boundary_to_cover": ""
      }
    ],
    "article_markdown": "",
    "pull_quotes": [{"text": "", "claim_ids": []}],
    "key_takeaways": [],
    "share_summary": "",
    "share_reason": "",
    "discovery_plan": {
      "subscription_value": "",
      "search_keywords": [],
      "recommendation_hook": "",
      "social_sharing_context": ""
    },
    "relationship_handoff": {
      "column": "",
      "related_content_ids": [],
      "menu_path": "",
      "keyword_reply": "",
      "follow_reason": "",
      "primary_next_step": ""
    },
    "engagement_strategy": {
      "mode": "auto",
      "primary_action": "share | comment | follow | consult | try | buy | register | none",
      "reason": "",
      "cta_placement": "ending | article_section | none",
      "cta_text": ""
    },
    "cta": "",
    "claim_map": [{"claim_id": "", "section_ids": []}],
    "used_knowledge_asset_ids": [],
    "source_list": [],
    "publish_time_checks": [{"fact_id": "", "reason": "", "check_before": "publish"}],
    "preflight_checks": [
      {"check": "title_body_alignment", "result": "pass | fail", "detail": ""},
      {"check": "argument_continuity", "result": "pass | fail", "detail": ""},
      {"check": "claim_traceability", "result": "pass | fail", "detail": ""},
      {"check": "marketing_disclosure", "result": "pass | fail | not_applicable", "detail": ""},
      {"check": "intent_and_promotion_alignment", "result": "pass | fail", "detail": ""},
      {"check": "account_identity_alignment", "result": "pass | fail", "detail": ""},
      {"check": "relationship_handoff_validity", "result": "pass | fail | not_applicable", "detail": ""},
      {"check": "matrix_differentiation", "result": "pass | fail | not_applicable", "detail": ""}
    ]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

正文只能使用输入 ContentMaster 中存在的 claim/source ID。长度由调用方设置，不在 Skill 内硬编码。`abstract` 应能独立说明读者将获得什么，`share_summary` 用于转发场景但不得制造正文没有的结论。

`matrix_coordination.shared_campaign_topic_id` 是必填字符串。空字符串 `""` 仅表示当前内容不属于共享活动；非空字符串必须是输入已提供的共享活动 ID，并原样保留。缺失、`null` 或非字符串均不合法。不得合成、默认填充、改写或虚构该字段，也不得把空字符串解释为热点未评估、未采用或其他热点状态。`matrix_coordination.differentiation_angle` 必须为非空字符串；`matrix_coordination.prohibited_overlap` 必须为仅含非空字符串的数组。

## 单次恢复兼容与脱敏诊断

`write_wechat_article_v2_recovery` 的 Provider 调用上限仍为 `maxAttempts=1`。兼容 Adapter 只允许确定性解包以下对象路径：直出文章对象、`data`、`result`、`result.data`、`response`、`response.data`、`output` 和 `output.data`。解包不得补造字段、改写正文或改变事实；字段缺失、截断 JSON 和短正文仍然失败。

恢复请求的 `article_markdown_min_chars` 使用显式安全余量：生产质量 Gate 保持 1200 字符，恢复目标为 1600 个去除首尾空白后的 `article_markdown` 字符（1200 + 400 安全余量）。该余量只约束模型原生输出，不降低 Gate，不允许静态补文、后处理扩写或增加 Provider 调用。

失败分为三个独立阶段：

- `provider_parse`：空响应、非法 JSON 或截断 JSON；
- `contract_schema`：JSON 可解析，但必需字段的类型或形状不符合 `WechatArticle@2.0`；
- `production_quality_gate`：Schema 合法，但未达到既有的正文长度、H2、标题、大纲、信息增量或图片计划门槛。

持久化诊断仅允许包含 `errorCode`、`validationFieldPaths`、`topLevelShape`、`responseCharacterCount`、`parseMode`、`wrapperPath`、configured/requested/effective model、调用时间和 `costStatus`。禁止保存原始 Prompt、原始正文、完整 Provider 响应、私有响应头或认证信息。

回退方式是移除确定性包装 Adapter 并恢复为现有硬阻断；不得回退为空 fallback 放行，也不得重置历史任务、恢复次数或版本。

## 正文优先两阶段恢复（内部合同）

`WECHAT_BODY_FIRST_RECOVERY_V1` 默认关闭。显式开启后，手工恢复恰好执行两个内容调用，每阶段 `maxAttempts=1`，不自动重试：

- `WechatArticleBodyRecovery@1.0`：`schemaVersion=1.0`，只承载 `binding`、`confirmed_outline_id`、模型原生 `article_markdown`、`claim_map` 与 `used_source_ids`。正文自身必须达到既有 1200 字和 3 个 H2 Gate。
- `WechatArticleMetadataRecovery@1.0`：`schemaVersion=1.0`，承载标题、摘要、信息增量、冻结大纲、图片计划等既有必填元数据；禁止出现 `article_markdown`。

两者的 `binding` 均包含 `contentRunId`、`strategySnapshotId`、`confirmedOutlineId` 和基于冻结输入生成的 SHA-256 `inputSummaryHash`。Adapter 要求两份 binding 与调用方冻结值完全相等，并核对元数据大纲标题、正文来源 ID；拒绝跨任务拼接、字段篡改和未授权来源。Adapter 不填字段、不扩写正文，仅将白名单字段组装成现有 `WechatArticle@2.0` 后重新运行 Schema、事实和生产质量 Gate。历史对象与版本无需迁移；回退方式为关闭 Flag。
