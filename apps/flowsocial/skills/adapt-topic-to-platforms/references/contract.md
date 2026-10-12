# PlatformTopicPair@2.0

```json
{
  "status": "success | failed | needs_review",
  "data": {
    "topic_id": "",
    "mother_topic_invariants": {
      "core_question": "",
      "fact_ids": [],
      "forbidden_claims": []
    },
    "xiaohongshu": {
      "fit_score": 0,
      "fit_reason": "",
      "platform_topic": "",
      "single_promise": "",
      "reader_scenario": "",
      "target_reader": "",
      "content_angle": "",
      "practical_value": "",
      "emotional_tension": "",
      "save_trigger": "",
      "share_trigger": "",
      "comment_trigger": "",
      "recommended_format": "tutorial | checklist | comparison | case | warning | opinion",
      "carousel_logic": ["cover", "problem", "method", "evidence", "summary"],
      "visual_story": "",
      "cover_message_direction": "",
      "title_directions": [],
      "evidence_focus": [],
      "platform_risks": [],
      "not_suitable_reason": ""
    },
    "wechat_official_account": {
      "fit_score": 0,
      "fit_reason": "",
      "platform_topic": "",
      "core_argument": "",
      "target_reader": "",
      "information_gain": "",
      "opening_question": "",
      "content_angle": "",
      "recommended_format": "trend_analysis | event_explainer | case_study | methodology | tutorial | opinion",
      "argument_chain": ["background", "cause", "mechanism", "impact", "boundary", "conclusion"],
      "reader_takeaway": "",
      "share_reason": "",
      "title_directions": [],
      "evidence_focus": [],
      "platform_risks": [],
      "not_suitable_reason": ""
    }
  },
  "warnings": [],
  "blocked_reasons": []
}
```

两个平台可以使用同一事实，但必须具有不同的阅读任务：小红书让读者快速看懂、保存并执行；公众号让读者获得完整解释并愿意转发。所有 `fact_ids` 必须存在于输入。
