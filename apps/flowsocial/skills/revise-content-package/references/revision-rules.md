# 内容包局部修改路由

| 用户要求 | 执行模式 | 修改范围 | 后续节点 |
|---|---|---|---|
| 缩短标题、换开头、调整某段措辞 | `local_patch` | 指定文案字段 | 文案/文章审核；封面文字变化时重渲染 |
| 修改某张卡片文字 | `local_patch` | 指定 `deck.pages[n].text_layers` | 对应页 Renderer + 视觉审核 |
| 调整某张图片方向或风格 | `scoped_regeneration` | 对应 ImageSpec | 单资产 imagegen + 对应页 Renderer + 视觉审核 |
| 增删或重排卡片 | `scoped_regeneration` | Deck 结构 | Deck 校验 + 受影响资产 + Renderer + 视觉审核 |
| 减少或加强营销 | `rerun_upstream` | ContentIntentProfile.promotion | ContentMaster + 平台内容包 + 审核 |
| 改成另一种内容目的 | `rerun_upstream` | ContentIntentProfile.purpose | ContentMaster + 平台内容包 + 审核 |
| 添加新数据、案例或产品能力 | `rerun_upstream` | Knowledge/Evidence + ContentMaster | 证据校验后重新生成 |
| 更换选题 | `rerun_upstream` | 平台子选题 | ContentIntentProfile + ContentMaster + 全部下游 |
| 更换平台 | `rerun_upstream` | 平台分支 | 新建对应平台内容包 |

## 互动方式

互动目标保持 `auto`。用户没有明确要求时，不单独修改 CTA。用户明确要求某种互动时，可以局部修改 CTA，但只能保留一个自然的主要动作，不能堆叠“点赞、收藏、转发、关注、评论、咨询”。

## 版本规则

- 以不可变 `base_version` 为输入，每次成功修改提出 `base_version + 1`。
- 保存用户原始指令、补丁、影响范围、质检结果和资产版本。
- 图片重生也必须创建内容包新版本，即使文字没有变化。
- 撤销通过把历史版本复制成新版本实现，不删除历史记录。
