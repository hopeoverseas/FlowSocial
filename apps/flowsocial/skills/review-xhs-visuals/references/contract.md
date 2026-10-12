# XhsVisualReview@1.0

```json
{
  "status": "success | failed | needs_review",
  "data": {
    "decision": "pass | revise | block",
    "page_findings": [{"finding_id": "XV01", "page": 1, "element": "headline | body | image | layout | footer | deck", "severity": "suggestion | warning | blocker", "issue": "", "evidence": "", "patch": {"target": "", "operation": "", "value": ""}}],
    "deck_findings": [],
    "passed_checks": [],
    "rerun_stages": []
  },
  "warnings": [],
  "blocked_reasons": []
}
```

`rerun_stages` 只能引用 `write-xhs-content.visual_plan`、`write-xhs-content.image_specs`、图片执行器或 Renderer，不得回到选题阶段。若只修改提示词，不得重写已锁定的发布正文和卡片文字层。

## 离线纵切兼容

`XhsVisualReview@1.0` 保持历史只读，不原地改版。05F 新链使用独立的 `XhsIntegratedVisualReview@1.0`，其严格字段和完整对象 hash 见仓库合同；它与 `PageTextCheck@1.0`、`PageFactCheck@1.0` 相互独立。历史缺失字段投影为 `legacy_quality_unknown` 或 blocker，不得推断 passed。选择和恢复只能引用不可变 `PageAssetRevision@1.0`，预览仅供离线审阅。关闭 Flag 后停止新增对象并继续保留历史只读路径；无法验证时回退为显式 `deterministic_layout`，不得静默执行。
