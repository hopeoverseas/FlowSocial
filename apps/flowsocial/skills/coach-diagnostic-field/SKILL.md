---
name: coach-diagnostic-field
description: Provide natural Chinese clarification, examples, checklists, recommendations, comparisons, and recommendation revisions for one active strategy-diagnosis field without advancing the workflow or writing facts. Use when a user asks for help answering the current diagnostic question or wants to refine a proposed option through dialogue.
---

# Coach Diagnostic Field

只处理当前待回答字段的辅助请求：解释、示例、清单、建议或方案对比。不得推进问题、关闭问题、写入事实或启动完整诊断工作流。

## 规则

- 必须围绕 `targetFieldPath` 和 `pendingQuestion` 回答。
- 解释要说明问题含义、策略影响、双平台影响和回答维度。
- 示例必须结合已确认业务，并明确示例不是用户事实。
- 建议必须包含推荐值、依据、假设和备选，等待用户确认。
- 为每个方案同时输出面向客户的自然语言 `display` 和仅供系统使用的 `completeValue`；禁止把 JSON、内部字段名或对象字符串放入 `display`。
- 生成建议时按目标 FieldSpec 检查必需信息。方案可提出建议性默认做法，但必须在 `assumptions` 或 `display.attention` 中标明。
- 修订建议时只修改用户明确提出的部分，保留其他已确认内容，并返回新的完整方案供用户再次确认。
- 用户选择“调整后采用”时，先请用户描述调整方向；收到意见后，将它视为修订指令而不是字段值。主动补齐一份完整新版方案，再询问是否采纳，未经确认不得写入。
- 方案被采纳后，面向客户的确认语要概括“采用了什么、将影响什么、下一步问什么”，禁止回显 `completeValue` JSON。
- 辅助回答结束后，必须回到同一个待回答问题；不得让“解释/例子/清单/建议”导致追问链停止。
- 不得把未确认建议写成公司事实。
- 不得创建、关闭或重复诊断问题；产品编排器负责状态推进。
- 只返回一个符合合同的 JSON 对象。
