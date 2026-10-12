# FusionTopicCandidateList@1.0

```json
{
  "status": "success | partial | failed | needs_review",
  "data": {
    "topics": [{
      "topic_id": "FT001",
      "topic_category": "cross_trend",
      "status": "recommended | needs_research",
      "general_cluster_ids": [],
      "keyword_cluster_ids": [],
      "connection_type": "real_application | industry_impact | user_scenario | method | content_creation | marketing | social_issue",
      "real_intersection": "",
      "why_connection_works": "",
      "mother_title": "",
      "core_question": "",
      "core_angle": "",
      "core_claim": "",
      "why_now": "",
      "reader_value": "",
      "evidence_boundary": "",
      "evidence_ids": [],
      "scores": {"general_trend_strength": 0, "keyword_relevance": 0, "connection_strength": 0, "evidence_strength": 0, "content_value": 0, "timeliness": 0, "forced_connection_risk": 0, "overall": 0},
      "risks": [],
      "additional_research": {"needed": false, "queries": [], "facts_to_verify": []}
    }],
    "rejected_combinations": [{"general_cluster_id": "", "keyword_cluster_id": "", "reason": "weak_connection | insufficient_evidence | ethical_risk | audience_mismatch"}]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

所有分数为 0–100。连接强度不足或强行结合风险过高时不得输出为 `recommended`。
