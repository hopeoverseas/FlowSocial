# WechatArticleReview@1.0

Gateway validates only the canonical envelope and exact review-object structure. Domain validation remains authoritative for finding references, report-only constraints, blocker/decision consistency, and candidate readiness.

根字段 `status`、`data`、`warnings`、`blocked_reasons` 均为必填；空警告与空阻断仍输出 `[]`，调用方不得合成。

```json
{
  "status": "success | failed | needs_review",
  "data": {
    "decision": "pass | revise | block",
    "findings": [{"finding_id": "WR01", "category": "fact | source | argument | structure | voice | readability | marketing | platform_risk", "location": "", "severity": "suggestion | warning | blocker", "issue": "", "required_action": "", "claim_ids": []}],
    "patches": [{"target": "", "before": "", "after": "", "reason": ""}],
    "changes": [],
    "fact_recheck_required": false,
    "publish_time_checks": []
  },
  "warnings": [],
  "blocked_reasons": []
}
```

`report_only` 时 `patches` 与 `changes` 必须为空。存在 blocker 时 `decision` 必须为 `block`。统一生产链只有 `status=success`、`decision=pass`、不存在 blocker 且 `fact_recheck_required=false` 时才能进入图片规划和候选投影。
