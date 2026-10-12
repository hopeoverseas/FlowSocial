# NaturalizationResult@1.0

```json
{
  "status": "success | failed | needs_review",
  "data": {
    "mode": "audit_only | rewrite_copy_only",
    "findings": [{"finding_id": "N01", "location": "", "severity": "info | warning | blocker", "pattern": "", "reason": "", "suggestion": ""}],
    "revised_text": null,
    "changes": [{"location": "", "before": "", "after": "", "reason": ""}],
    "protected_field_check": {"passed": true, "violations": []},
    "requires_fact_recheck": false
  },
  "warnings": [],
  "blocked_reasons": []
}
```

`audit_only` 时 `revised_text` 必须为 `null`。发生任何改写时 `requires_fact_recheck` 必须为 `true`。
