# ContentOutline@1.0

## Runtime envelope boundary

Provider output is the complete top-level envelope shown below. Use `status: "ready"`, put the authored outline under `data`, and emit empty `warnings` and `blocked_reasons`. Do not emit bare outline data, a partial envelope, or `result` / `response` / `output` wrappers. The Provider prompt example is platform-specific and, under strict sequencing, uses only placements issued for the current invocation; it remains illustrative and never overrides input authority.

For narrow historical compatibility, trusted Runtime may wrap a bare root only when it has no envelope or wrapper keys and has all five exact outline markers: non-empty string `outline_id`, non-empty string `schema_version`, non-empty string `platform`, array `sections`, and boolean `confirmation_required`. Runtime creates only `{status:"ready", data:<bare>, warnings:[], blocked_reasons:[]}` before the existing semantic and domain gates. It does not infer status, warnings, blocked reasons, narrative, placement, refs, or missing business fields. Empty, partial, malformed, foreign-wrapper, ambiguous, and non-outline values remain unchanged and fail closed through the existing stable envelope paths. Raw Provider evidence and its hash remain unchanged; only canonical runtime output is normalized.

## Runtime-issued strict sequence contract

When the canonical ContentMaster semantic spine uses strict ordering, trusted runtime supplies `strict_sequence_contract`. It is immutable invocation authority, not Provider-authored content:

```json
{
  "schemaVersion": "1.0",
  "contract": "OutlineStrictSequenceSlots@1.0",
  "semanticSpineRef": {"id": "semantic-spine-id", "hash": "spineHash"},
  "slots": [
    {"slotId": "core-slot:1", "order": 0, "masterUnitRef": {"id": "unit-id", "hash": "unitHash"}}
  ],
  "supplementalAnchors": [
    {"anchorId": "supplemental-anchor:0", "position": 0, "afterSlotId": null, "beforeSlotId": "core-slot:1"}
  ],
  "contractHash": "trusted hash of all preceding fields"
}
```

For every strict raw section, declare exactly one placement:

- Core direct/split fill: `{"sequencePlacement":{"kind":"core","slotIds":["core-slot:1"]}}`.
- Contiguous merge fill: list two or more adjacent issued slots in ascending order.
- Supplemental fill: `{"sequencePlacement":{"kind":"supplemental","anchorId":"supplemental-anchor:0"}}`.

Omit redundant `masterUnitIds` on strict raw sections. Runtime deterministically derives ordered unit IDs and refs from issued core slots, or an empty mapping from a supplemental anchor. For historical compatibility, exact supplied IDs remain accepted; malformed or conflicting supplied values fail closed with `OUTLINE_SEQUENCE_UNIT_MAPPING_CONFLICT`.

Emit the section fills in issued slot/anchor order. Runtime validates and consumes that order; it does not sort completed sections, infer placement from headings or keywords, repair narrative, or retry. Missing, malformed, duplicate, unknown, out-of-range, non-contiguous, conflicting, or descending declarations fail closed at stable allowlisted paths. Supplemental anchors never consume core coverage.

Flexible spines and historical invocations without `strict_sequence_contract` retain the prior `masterUnitIds` behavior.

## Raw Provider 输出

所有用户可见字段固定使用简体中文。品牌名、产品名、标准缩写和代码可以保留必要英文，但 `content_promise`、策略说明、章节标题、目标、要点、边界与待确认问题不得是完整英文句子。

无 `strict_sequence_contract` 时，每个 raw section 输出有序 IDs，不输出 cryptographic refs：

```json
{"masterUnitIds": ["unit-id"]}
```

Provider 不负责输出 `adaptationType`。为兼容历史 raw envelope，已存在的 `adaptationType` 仅视为 advisory，可信运行时不会采用它。

Provider 应省略 top-level `contentMasterRef`、`semanticSpineRef` 和所有 hash，不得选择或猜测 master/spine identity；strict sections 只声明 placement，无 strict contract 的 sections 声明 `masterUnitIds`。为兼容历史 raw envelope，exact-shape top-level `{id}` 或 `{id, hash}` 的全部值仅作为 advisory evidence，可信运行时会完整替换为本次 invocation 已冻结的 master/spine refs。Malformed shape 或额外字段仍会在对应 top-level path fail closed。若提供 Section `masterUnitRefs`，其 ID 必须精确匹配 trusted placement/unit mapping，只有 hash 值是 advisory。Raw Provider envelope 保持不变，只有 canonical runtime output 和 `verifiedDomainOutput` 获得可信完整 refs。

## Canonical runtime / persisted 输出

```json
{
  "status": "ready | needs_review | blocked",
  "data": {
    "outline_id": "outline_id",
    "schema_version": "1.0",
    "platform": "xiaohongshu | wechat",
    "topic": "",
    "content_promise": "",
    "content_function": "discovery | authority | proof | solution | action",
    "content_purpose_id": "",
    "conversion_stage_id": "",
    "opening_strategy": "",
    "contentMasterRef": {"id": "content-master-id", "hash": "contentMasterHash"},
    "semanticSpineRef": {"id": "semantic-spine-id", "hash": "spineHash"},
    "sections": [
      {
        "section_id": "S1",
        "heading": "",
        "role": "hook | problem | diagnosis | evidence | method | example | action | boundary",
        "objective": "",
        "key_points": [],
        "claim_ids": [],
        "boundary": "",
        "masterUnitRefs": [{"id": "unit-id", "hash": "unitHash"}],
        "adaptationType": "direct | split | merge | supplemental"
      }
    ],
    "closing_strategy": "",
    "unresolved_questions": [],
    "confirmation_required": true
  },
  "warnings": [],
  "blocked_reasons": []
}
```

公众号大纲至少包含三个章节。小红书大纲必须包含 6–10 个有序、可审阅的展示段；每段的 `section_id`、`objective` 和实质展示内容必须独特，不能复制段落凑足数量。所有 `claim_ids` 必须来自输入 ContentMaster。不得输出完整正文。

四步 ContentMaster semantic spine 不等于固定四页。小红书应在 Outline 阶段用合法 `direct`、同一 unit 的多段 `split`、相邻 units 的 contiguous `merge`，以及不消费 core coverage 的 supplemental anchor，生成 6–10 个展示段，同时保持 required units 100% coverage 与 strict order。该 6–10 段就是用户审阅对象；carousel Runtime 必须逐段消费，不得暗加页面、重排或修正文案。

## Semantic mapping 确定性合同

输入 ContentMaster 含 semantic spine 时，可信运行时在 Provider 返回后、Output Fact 编译前把 `masterUnitIds` 解析为 `masterUnitRefs`，并附加精确 `contentMasterRef` 与 `semanticSpineRef`。canonical runtime 和持久化记录必须包含这些 refs；历史 ContentMaster 没有 spine 时继续读取旧格式。

- 可信运行时必须先解析全部 unit refs，再全局派生分类：零个 refs 为 `supplemental`；两个或更多 refs 为 `merge`；正好一个 ref 时，若该 unit 只出现在一个章节则为 `direct`，若跨多个章节出现则所有单 ref 章节为 `split`。
- `supplemental` 可使用 ContentOutline 全局 schema 已允许的任一 presentation role，但必须保持零个 refs，且不计核心覆盖。`risk`、`cta` 或其他非全局 role 仍在 `data.sections[].role` fail closed。分类派生不修复 role、章节顺序、unit mapping、meaning、boundary 或正文内容。
- 每个 required unit 至少由一个非 supplemental 章节引用；optional unit 可不引用。未知、错配或 malformed unit ID/ref 一律阻断；matching-ID 的 supplied hash 仅为 advisory，canonical runtime 始终替换为 trusted hash。
- strict ordering 按章节展开后的 unit `order` 必须单调不降；flexible ordering 允许平台重排。
- 同一 unit 可以同时位于一个 multi-ref `merge` 章节和重复的 single-ref `split` 章节；若某 unit 的重复映射全部是 single-ref canonical sections，则这些章节必须全部派生为 `split`。`direct + split` 仍 fail closed。supplemental 不计核心覆盖，不能替代 required unit。
- Outline 不得包含自己的 `structureIntent`、`semanticSpine`、`requiredUnits` 或 `orderingPolicy`。meaning 与 boundary 只存在于 ContentMaster unit 中，Outline 通过精确 unit hash 继承，不做关键词相似度判断。
- ContentMaster、structure intent 或 spine hash 变化后，旧 Outline 在 persist、confirm、resume 和 Commit 前均为 stale。
# XHS provider cardinality constraint

For a four-unit frozen semantic spine, a legal six-section outline keeps all four core slots in strict order, splits one core unit into two adjacent sections, and uses one issued supplemental anchor with an empty `masterUnitIds` mapping. Supplemental sections add presentation structure only and cannot invent claims. A four-section XHS response is invalid; Runtime must never add pages or repair cardinality.
