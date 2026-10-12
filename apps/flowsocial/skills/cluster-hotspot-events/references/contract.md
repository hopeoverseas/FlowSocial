# HotspotEventClusterList@1.0

输入 Evidence 使用项目统一字段，不接收供应商原始 JSON。

```json
{
  "status": "success | partial | failed | needs_review",
  "data": {
    "event_clusters": [{
      "cluster_id": "HC001",
      "hotspot_type": "keyword | general",
      "canonical_title": "",
      "source_summary": "",
      "entities": [],
      "keywords": [],
      "time_range": {"from": "", "to": ""},
      "confirmed_facts": [{"fact_id": "F001", "fact": "", "evidence_ids": []}],
      "discussion_signals": [{"signal": "", "evidence_ids": []}],
      "audience_questions": [],
      "risks": [],
      "uncertainties": [],
      "evidence_ids": []
    }],
    "unclustered_evidence_ids": [],
    "invalid_evidence": [{"evidence_id": "", "reason": ""}]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

校验：所有引用 ID 必须存在；`confirmed_facts[].evidence_ids` 不得为空；空簇不得输出。
