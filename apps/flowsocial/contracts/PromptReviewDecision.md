# PromptReviewDecision@1.0

记录视觉方向选择、Prompt 审阅和费用确认三个独立状态。本离线任务只允许费用保持 `pending`。

```json
{
  "schemaVersion": "1.0",
  "contract": "PromptReviewDecision@1.0",
  "id": "prompt-review:fixture-001:v1",
  "promptSetRef": {"id": "prompt-set:fixture-001:v1", "schemaVersion": "1.0", "hash": "sha256"},
  "visualDirectionSelection": {
    "status": "pending | selected | rejected",
    "candidateIds": ["direction-structured", "direction-editorial"],
    "candidateRefs": [{"id": "direction-editorial", "hash": "sha256"}, {"id": "direction-structured", "hash": "sha256"}],
    "candidateSetHash": "sha256",
    "selectedDirectionRef": null,
    "structuralEvidenceHash": "sha256",
    "decidedBy": null,
    "decidedAt": null
  },
  "promptReview": {"status": "pending | approved | changes_requested", "reviewedPromptSetHash": null, "reviewedBy": null, "reviewedAt": null},
  "costConfirmation": {"status": "pending", "currency": null, "estimatedCost": null, "confirmedBy": null, "confirmedAt": null},
  "overallStatus": "direction_pending | prompt_review_pending | awaiting_cost_confirmation | blocked",
  "blockers": [],
  "decisionHash": "sha256"
}
```

## 规则与兼容

- 颜色替换不能构成独立方向；候选必须以 Archetype 计划、构图模型、层级策略或图片角色形成可验证结构差异。
- `candidateRefs` 冻结每个完整候选的 hash，`candidateSetHash` 按 ID 排序后冻结整个集合；选择后 `selectedDirectionRef` 必须与集合中的 ID/hash 完全一致。完整候选 hash 覆盖构图、层级、图片角色、来源、许可证、风险和能力状态。
- 只能先选择视觉方向，再审阅 Prompt；费用确认不随 Prompt 批准自动推进。
- `overallStatus` 必须由三个独立状态和 `blockers` 唯一推导：任何 blocker 或方向拒绝均为 `blocked`；只有方向已选择、Prompt 已批准、费用仍 pending 且无 blocker 时才是 `awaiting_cost_confirmation`。
- 上游只读引用 `XhsIntegratedPagePromptSet@1.0` 和 `VisualStyleSelection@1.0`，hash 不一致返回 blocker，不回写旧合同。
- 下游 Compiler 只读取已选择方向和已批准 Prompt，并重新计算候选集合、结构证据及选中候选 hash；`validatePromptReviewDecision` 会拒绝缺少新增 hash/ref 的旧草案，兼容调用方必须把该只读校验错误呈现为 blocker，不能补写或猜测。费用仍为 `pending`，输出不可执行。
- 回退：关闭 `xhsIntegratedPageDirectionReview` 并移除离线调用方；历史 Prompt Set 保持不变。
