# XhsPostCopy Creative Output Contract

Gateway structural validation enforces the canonical envelope and exact nested keys. Runtime semantic validation remains authoritative for outline mapping, allowed IDs, Promotion, and content quality; structural success never repairs or promotes content.

`write-xhs-post-copy` 只返回一个统一 Skill envelope。`status=success` 时，`data` 才是 `XhsPostCopyCreativeOutput@1.0` JSON 对象；其他状态的 `data` 必须为 `null`。所有对象均为 exact object：缺少字段、额外字段、非法 `null` 或错误类型都必须在合同边界失败，调用方不得补默认值、改名或静默修复。

## Exact keys

以下标记供合同测试读取；不得改成近义字段。

```text
XHS_POST_COPY_ENVELOPE_ROOT_KEYS_EXACT: status,data,warnings,blocked_reasons
XHS_POST_COPY_CREATIVE_DATA_KEYS_EXACT: schemaVersion,contract,contentPromise,engagementStrategy,titleCandidates,recommendedTitle,opening,bodySections,ending,pinnedComment,hashtags,cta,promotionUse
XHS_ENGAGEMENT_STRATEGY_KEYS_EXACT: mode,primaryAction,reason,ctaPlacement,ctaText
XHS_TITLE_CANDIDATE_KEYS_EXACT: title,hookType,claimIds,risk
XHS_BODY_SECTION_KEYS_EXACT: sectionId,outlineRole,role,text,claimIds,knowledgeAssetIds
XHS_PROMOTION_USE_KEYS_EXACT: mode,itemIds,disclosure
```

Envelope 根对象字段：

- `status`: `success | needs_review | blocked`。
- `data`: `success` 时为下述 exact creative data；`needs_review` 或 `blocked` 时必须为 `null`。
- `warnings`: 互不重复的非空字符串数组；无警告时也必须显式输出 `[]`。
- `blocked_reasons`: 互不重复的非空字符串数组；`success` 时必须为 `[]`，`needs_review` 或 `blocked` 时必须至少有一项。

`needs_review` 表示存在可由补充输入或人工裁决解决的问题，且 `warnings` 必须至少有一项；`blocked` 表示权威冲突、越权要求或其他无法安全继续的条件，`warnings` 可为空。两者都不是可交付的部分成功：不得在 `data` 中携带草稿，也不得由 Adapter 组装、补值、改写或重试性修补。

Success `data` 字段：

- `schemaVersion`: 必须为字符串 `"1.0"`。
- `contract`: 必须为字符串 `"XhsPostCopyCreativeOutput@1.0"`。
- `contentPromise`: 非空字符串，必须与已确认 ContentMaster 和大纲中的内容承诺一致。
- `engagementStrategy`: exact object，见下文。
- `titleCandidates`: 3–5 个 exact title candidate；这些只是后续标题阶段的预备信号。
- `recommendedTitle`: 非空字符串，必须逐字匹配一个 `titleCandidates[].title`。
- `opening`: 非空字符串。
- `bodySections`: 非空数组，与已确认大纲的 section 数量、顺序和 ID 完全一致。
- `ending`: 非空字符串。
- `pinnedComment`: 字符串，可为空。
- `hashtags`: 3–8 个互不重复的非空字符串。
- `cta`: 字符串，可为空。
- `promotionUse`: exact object，见下文。

`schemaVersion` 和 `contract` 只是本 creative-output 合同的判别字段。除这两个字段外，根对象字段均为 Provider creative fields；Provider 不拥有最终 `XhsPostCopy@1.0` 的系统元数据。

## Nested objects

### engagementStrategy

- `mode`: 必须为 `"auto"`。
- `primaryAction`: `save | share | comment | follow | consult | try | buy | register | none`。
- `reason`: 非空字符串，说明此互动动作与内容承诺的关系。
- `ctaPlacement`: `body | ending | pinned_comment | card | none`。
- `ctaText`: 字符串，可为空；若 placement 为 `none`，不得暗示另有未声明 CTA。

### titleCandidates[]

- `title`: 非空字符串；候选之间必须有实质区别。
- `hookType`: `result | problem | contrast | checklist | question`。
- `claimIds`: 互不重复的非空字符串数组，只能引用当前 ContentMaster 明确授权的 confirmed fact 或 supported interpretation ID；允许空数组。
- `risk`: `low | medium | high`。

标题候选和 `recommendedTitle` 都不是最终标题选择。`generate-platform-titles` 阶段负责最终候选与 final title binding；本合同不得输出相关状态或绑定。

### bodySections[]

- `sectionId`: 非空且唯一，必须逐项等于 `confirmedOutline.sections[].sectionId`。
- `outlineRole`: 必须逐项等于已确认大纲的角色。
- `role`: 必须按下表由 `outlineRole` 唯一映射。
- `text`: 非空字符串。
- `claimIds`: 互不重复的非空字符串数组，只能列出本段实际使用且被 ContentMaster 授权的 confirmed fact 或 supported interpretation ID；允许空数组。
- `knowledgeAssetIds`: 互不重复的非空字符串数组，只能列出本段实际使用且由 Writer Context 授权的 knowledge asset ID；允许空数组。知识资产不得被当成新事实来源。

| outlineRole | role |
| --- | --- |
| `hook` | `scene` |
| `problem` | `problem` |
| `diagnosis` | `conclusion` |
| `evidence` | `evidence` |
| `method` | `method` |
| `example` | `evidence` |
| `action` | `summary` |
| `boundary` | `warning` |

不得新增、删除、合并、拆分或重排大纲 section。

### promotionUse

- `mode`: `none | soft | focused`，必须与 `promotionPolicy.mode` 相同。
- `itemIds`: 互不重复的非空字符串数组。
- `disclosure`: 字符串。

当 policy 为 `none` 时，必须输出 `{"mode":"none","itemIds":[],"disclosure":""}`。当 policy 为 `soft` 或 `focused` 时，只能使用 policy 明确允许的 item ID，至少使用一个，并逐字复制 policy 的 disclosure。

## Authority and mechanism rules

输入必须同时包含完整的 `contentMaster`、`confirmedOutline`、`platformBrief`、`writerContext`、`mechanismDecision` 和 `promotionPolicy`。任何对象缺失、未确认、authority binding 不一致或授权集合不完整时，安全失败且不生成输出。

调用方同时提供 `authorized_references.claim_ids` 与 `authorized_references.knowledge_asset_ids` 作为机器白名单。输出中的所有引用 ID 必须逐字来自相应白名单；`authorized_references.non_claim_opinion_ids` 中的作者观点可用于行文但不得进入 `claimIds`。不确定或未实际使用时必须输出空数组，禁止生成占位 ID、改写 ID 或引用字段名。

- 内容承诺、受众、事实与解释以 ContentMaster 为准。
- 正文结构只以 confirmed outline 为准。
- 平台表达边界以 platform brief 为准。
- 可用知识资产只以 Writer Context 为准。
- 内容机制和热点采用与否只以正式 mechanism decision 为准。不得自行搜索、补选或暗示热点；未采用热点时不得偷偷加入热点表达。
- 推广模式、条目和 disclosure 只以 promotion policy 为准。
- 公众号正文不是输入权威，也不得作为改写母版。

## System assembly boundary

Provider 不得输出 `id`、`authorityBinding`、`componentHash`、任何其他 hash、trace、preflight、quality gate、用户选择、版本、交付或发布状态。系统先验证 exact envelope 和状态；只有 `status=success` 才独立验证 `data` 并显式组装确定性组件：

```js
createXhsPostCopy({
  schemaVersion: "1.0",
  contract: "XhsPostCopy@1.0",
  id: systemGeneratedId,
  authorityBinding: systemVerifiedAuthorityBinding,
  contentPromise: output.data.contentPromise,
  engagementStrategy: output.data.engagementStrategy,
  titleCandidates: output.data.titleCandidates,
  recommendedTitle: output.data.recommendedTitle,
  opening: output.data.opening,
  bodySections: output.data.bodySections,
  ending: output.data.ending,
  pinnedComment: output.data.pinnedComment,
  hashtags: output.data.hashtags,
  cta: output.data.cta,
  promotionUse: output.data.promotionUse
});
```

系统负责验证 authority binding、Outline 映射、引用授权和 promotion policy，并由 `createXhsPostCopy` 计算 `componentHash`。Provider 不得宣称这些 preflight 或 gate 已通过。

## Excluded responsibilities

本输出不得包含 carousel page、deck、text layer、layout、render strategy、ImageSpec、视觉资产、图片提示词或任何视觉规划字段。不得调用其他 Skill、Provider 或外部工具，不得搜索新资料，也不得改变上游权威对象。

## Minimal valid shape

```json
{
  "status": "success",
  "data": {
    "schemaVersion": "1.0",
    "contract": "XhsPostCopyCreativeOutput@1.0",
    "contentPromise": "帮助目标读者完成一个明确动作",
    "engagementStrategy": {"mode":"auto","primaryAction":"save","reason":"步骤型内容适合保存后执行","ctaPlacement":"ending","ctaText":"先收藏，再按步骤完成。"},
    "titleCandidates": [
      {"title":"按这三步完成目标","hookType":"result","claimIds":[],"risk":"low"},
      {"title":"总卡住？先检查这三步","hookType":"problem","claimIds":[],"risk":"low"},
      {"title":"一份可执行的三步清单","hookType":"checklist","claimIds":[],"risk":"low"}
    ],
    "recommendedTitle": "按这三步完成目标",
    "opening": "先把目标拆成三个可执行步骤。",
    "bodySections": [{"sectionId":"section-1","outlineRole":"hook","role":"scene","text":"从最常见的卡点开始。","claimIds":[],"knowledgeAssetIds":[]}],
    "ending": "今天先完成第一步。",
    "pinnedComment": "",
    "hashtags": ["行动清单", "实用方法", "效率提升"],
    "cta": "收藏后开始执行。",
    "promotionUse": {"mode":"none","itemIds":[],"disclosure":""}
  },
  "warnings": [],
  "blocked_reasons": []
}
```
