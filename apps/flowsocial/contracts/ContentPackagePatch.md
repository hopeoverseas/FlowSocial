# ContentPackagePatch@1.0

```json
{
  "status": "success | needs_clarification | needs_review | blocked",
  "data": {
    "content_task_id": "",
    "base_version": 1,
    "user_instruction": "",
    "request_class": "copy | page_text | visual_direction | image_spec | structure | promotion | purpose | claim | topic | platform",
    "execution_mode": "local_patch | scoped_regeneration | rerun_upstream | ask_user",
    "target_paths": [],
    "locked_paths": [],
    "operations": [
      {"op": "test | replace | add | remove", "path": "/post_copy/recommended_title", "value": "", "reason": ""}
    ],
    "evidence_impact": "none | recheck | requires_new_evidence",
    "rerun_plan": [
      {"stage": "patch_apply | imagegen | renderer | xhs_review | wechat_review | content_intent | content_master | platform_writer", "scope": [], "reason": ""}
    ],
    "quality_checks": [
      {"check": "locked_fields_preserved | claims_traceable | intent_preserved | platform_fit | visual_consistency", "result": "pass | fail | pending", "detail": ""}
    ],
    "version": {"parent": 1, "proposed": 2, "change_summary": ""},
    "clarifying_question": ""
  },
  "warnings": [],
  "blocked_reasons": []
}
```

补丁必须作用于当前内容包的克隆版本。程序先执行 `test` 操作和锁定字段校验，再应用修改；原版本永不覆盖。事实、选题、平台或内容目的变化不得伪装成局部文案修改。
