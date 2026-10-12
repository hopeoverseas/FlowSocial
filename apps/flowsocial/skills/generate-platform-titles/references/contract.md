# PlatformTitleList@1.0

The canonical example is a structurally valid success instance, not reusable business copy. Gateway validates exact envelope/object shape; Domain validation retains candidate cardinality, score ranges, distinct motivations, recommendation resolution, risk, claim, and same-account signal authority.

Production validation is fail-closed. All seven scores are integers from 1 through 5. Candidate IDs are unique, declared enums are exact, and at least three motivations are represented. All five recommendation fields reference existing candidates; `balanced` never references a high-risk candidate. Every A/B reference resolves to two different candidates. Same-account signal IDs must resolve to the explicitly authorized invocation input. Only a complete root envelope with `status: success`, `warnings`, and `blocked_reasons` may continue.

The production title input is the exact object set `{stage, platform, content_master, completed_content, preliminary_titles, content_task_brief, same_account_title_signals}`. The first five content values are required; signal input is an array and is empty when no account-matched authorization exists.

```json
{
  "status": "success | failed | needs_review",
  "data": {
    "stage": "final_after_body",
    "platform": "xiaohongshu | wechat_official_account",
    "title_brief": {
      "content_type": "",
      "target_reader": "",
      "core_conclusion": "",
      "reader_takeaway": "",
      "strongest_evidence": [],
      "real_entities": [],
      "freshness_dependency": "none | low | medium | high"
    },
    "candidates": [
      {
        "title_id": "T01",
        "title": "",
        "motivation": "balanced | safe | spread | search | evergreen | experiment",
        "method": "",
        "claim_ids": [],
        "scores": {
          "fulfillment": 1,
          "relevance": 1,
          "specificity": 1,
          "curiosity": 1,
          "clarity": 1,
          "uniqueness": 1,
          "overall": 1
        },
        "risk": "low | medium | high",
        "risk_reasons": []
      }
    ],
    "recommendations": {
      "balanced": "T01",
      "safe": "T02",
      "spread": "T03",
      "search": "T04",
      "experiment": "T05"
    },
    "ab_tests": [
      {"title_a": "T01", "title_b": "T05", "single_variable": "", "hypothesis": ""}
    ],
    "same_account_signal_usage": {
      "used": false,
      "signal_ids": [],
      "interpretation": ""
    }
  },
  "warnings": [],
  "blocked_reasons": []
}
```

候选数量为 5–8 个。所有 `claim_ids` 必须来自输入 ContentMaster。高风险候选不得成为 `balanced`。历史信号只能描述为同账号历史相关性，不得表述为平台算法或因果规律。
