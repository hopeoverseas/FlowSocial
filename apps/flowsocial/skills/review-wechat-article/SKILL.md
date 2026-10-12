---
name: review-wechat-article
description: 审核公众号文章的事实引用、中心论点、结构、信息增量、账号语气、营销边界与发布风险。默认只报告问题；仅在明确允许的范围内返回局部修订补丁。
---

# 审核公众号文章

作为独立编辑节点比较文章、ContentMaster、账号策略与发布规则。生成与审核必须分开。

## 输入要求

要求输入包含 `mode=report_only|patch_allowed`、公众号文章、ContentIntentProfile、ContentMaster、账号策略、当前版本、锁定范围和发布规则。执行前读取 [contract.md](references/contract.md)。

## 审核顺序

1. 核对标题、摘要、正文和结论是否兑现同一主张。
2. 核对事实、数字、日期、引文和链接是否绑定有效来源。
3. 检查事实、解释、观点和未知事项是否混淆。
4. 检查论证链、段落任务、反例、边界和信息重复。
5. 检查账号语气、模板化表达、营销强度和 CTA 合规性。
6. 检查动态信息、敏感议题和平台发布风险。
7. 给出按优先级排序的可执行发现。
8. 检查内容目的、推广模式和知识资产使用是否一致，主要互动方式是否自然且没有堆叠 CTA。

## 修改规则

`report_only` 不得返回修订文章。`patch_allowed` 只能修改 `editable_ranges`，并返回变更日志；不得改变事实、标题、结构或 CTA，除非这些字段明确列入允许范围。

## 输出规则

只输出 `WechatArticleReview@1.0` JSON。根字段 `status`、`data`、`warnings`、`blocked_reasons` 始终必填；没有警告或阻断时仍明确输出空数组。`report_only` 必须返回空的 `patches` 与 `changes`。只有 `status=success`、`decision=pass`、无 blocker 且 `fact_recheck_required=false` 的结果可授权后续图片规划；其他结果只报告审阅结论并阻断候选。

Gateway 只验证 canonical envelope 和 review 对象结构；finding 引用、report-only 边界、blocker/decision 一致性与候选 readiness 保持由 Domain Gate fail closed。

## 边界

- 不联网补证据，不调用 WeWrite 主控或发布模块。
- 不重做选题，不自动发布，不生成 HTML 和图片。
- 审核发现不能被包装成已完成的修改。
