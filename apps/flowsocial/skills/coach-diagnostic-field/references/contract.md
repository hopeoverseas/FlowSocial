# DiagnosticAssistanceResult@2.0

输出字段：`assistantMessage`、`assistanceType`、`targetFieldPath`、`checklist`、`examples`、`recommendation`。

`recommendation` 包含一个推荐方案和最多两个备选。每个方案应规范化为：

```json
{
  "optionId": "option_1",
  "label": "推荐方案",
  "display": {
    "title": "面向客户的方案名称",
    "summary": "自然语言摘要",
    "steps": ["步骤一", "步骤二"],
    "advantages": ["优点"],
    "attention": ["仍需用户确认的假设"]
  },
  "completeValue": {},
  "rationale": [],
  "assumptions": [],
  "completeness": "complete | partial"
}
```

`display` 禁止包含 JSON、内部字段名和 `[object Object]`。`completeValue` 不直接展示给用户。
