---
name: generate-content-outline
description: 将已冻结方向、ContentTaskBrief、ContentSourcePlan 和 ContentMaster semantic spine 转换成可确认的平台大纲。用于正文前规划小红书或公众号结构，并显式映射 master units；不得确认大纲、撰写正文、生成标题或补充事实。
---

# 生成可确认内容大纲

只生成结构，不写完整段落。把 ContentMaster 视为唯一事实和主张合同。

## 工作步骤

1. 明确冻结 DirectionCard 的承诺、目标读者、五类内容职能、内容目的、平台角色和本篇转化阶段。
2. 提取 ContentMaster 的中心问题、核心观点、可用事实、未知信息和风险边界。
3. 如有 `content_pattern_snapshot` 或已批准的 `skill_pattern_packs`，只把其中与当前平台和内容目的匹配的规则作为结构候选；记录实际采用的版本，不照搬示例措辞。
4. 为小红书生成 6–10 个有独特目标和内容的用户可审阅展示段；为公众号生成 4–8 个论证章节。语义四步不是固定四页：通过合法 direct、split 或 contiguous merge，在保持完整覆盖和严格顺序的同时形成小红书展示段。
5. 启用 `strict_sequence_contract` 时，按已签发 slot/anchor 顺序填充章节：core 声明精确 `sequencePlacement.slotIds`，supplemental 声明一个已签发 `sequencePlacement.anchorId`；不得重排或改写合同。
6. 启用 strict placement 时省略冗余 `masterUnitIds`；无 strict contract 时继续声明有序 `masterUnitIds`。不要分类 `adaptationType`，也不要计算或猜测 refs/hash；可信运行时会从 placement 解析 refs 并全局派生 canonical 分类。
7. 保证 required units 覆盖 100%、未知引用为 0，并服从 strict ordering；flexible ordering 可按平台重排。
8. 检查章节是否重复、跳步、引入无证据主张或暗中建立竞争性核心框架；保留待用户确认的问题，不自行填补。

## 约束

- 所有面向用户展示的文字必须使用简体中文，包括 `topic`、`content_promise`、`opening_strategy`、`closing_strategy`、章节标题、目标、要点、边界和待确认问题；仅品牌名、产品名、标准缩写与代码可保留必要英文，不得输出完整英文句子。
- 只引用 ContentMaster 中存在的 `claim_ids`。
- 爆款蓝图只能影响结构和节奏，不能提供事实。
- 参考包与 ContentMaster、ContentTaskBrief 冲突时，始终服从后两者；不得把相关性评分写成平台因果规则。
- 不写完整正文、标题候选、封面文案、图片提示词或 CTA 成品。
- 不执行确认动作。始终返回 `confirmation_required: true`。
- 不决定是否进入正文生成；该状态由产品编排器控制。
- 不依据长期内容配比改选本篇方向；大纲只执行已冻结的单篇选择。
- 小红书与公众号可使用不同语气、篇幅、标题组织和章节数量；不得要求文案相同。
- 小红书的 6–10 个展示段必须在 Outline 阶段完整生成并等待用户审阅；不得把扩页留给 carousel Runtime，Runtime 不得暗加页、重排或修正文案。

严格返回完整 `ContentOutline@1.0` envelope：`status: "ready"`、`data`、空 `warnings` 与空 `blocked_reasons`；不要返回 bare data 或 `result`/`response`/`output` wrapper。Provider 提示中的结构示例只说明当前平台与本次已签发 placement 的输出形状，不能替代输入权威。省略 top-level authority refs 和所有 hash，不得猜测 authority identity。可信运行时独占 canonical master/spine/ref 权威。详细 raw/canonical envelope、slot、group、anchor、兼容与失败合同见 [contract.md](references/contract.md)。
### XHS cardinality recipe (machine constraint)

When the frozen semantic spine contains four core units, emit six or more sections using the issued strict placement contract: keep core slots in order, split one core unit into two adjacent sections, and add one supplemental section at an issued supplemental anchor. A supplemental section must have an empty `masterUnitIds` mapping and may only add presentation structure, not facts or claims. Every section must have unique `section_id`, `objective`, and presentation content. Never pad with duplicate prose, invent `claim_ids`, or leave cardinality repair to Runtime.
