# KeywordTopicCandidateList@1.0

```json
{
  "status": "success | partial | failed | needs_review",
  "data": {"topics": [{
    "topic_id": "KT001",
    "topic_category": "keyword",
    "status": "recommended | needs_research",
    "mother_title": "",
    "core_question": "",
    "core_angle": "",
    "core_claim": "",
    "why_now": "",
    "reader_value": "",
    "target_audience": [],
    "content_type": "tutorial | analysis | comparison | case | opinion | checklist",
    "evidence_boundary": "",
    "cluster_ids": [],
    "evidence_ids": [],
    "scores": {"topic_relevance": 0, "evidence_strength": 0, "content_value": 0, "timeliness": 0, "differentiation": 0, "overall": 0},
    "risks": [],
    "additional_research": {"needed": false, "queries": [], "facts_to_verify": []}
  }]},
  "warnings": [],
  "blocked_reasons": []
}
```

所有分数为 0–100。`recommended` 必须具有可支持核心主张的证据；否则降级为 `needs_research`。
