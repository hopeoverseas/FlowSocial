# TopicGateReview@1.0

```json
{
  "status": "success | partial | failed | needs_review",
  "data": {
    "thresholds_used": {"overall_min": 70, "evidence_min": 60, "forced_connection_risk_max": 50},
    "approved": [{"topic_id": "", "final_priority": 1, "status": "recommended | needs_research", "editor_reason": "", "required_changes": [], "facts_to_verify": []}],
    "rejected": [{"topic_id": "", "reason": "", "risk_type": "low_value | insufficient_evidence | duplicate | forced_connection | fact_risk | ethical_risk | audience_mismatch"}]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

所有 `topic_id` 必须来自输入。`required_changes` 是后续受约束修订指令，不是已经完成的修改。
