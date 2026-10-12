# XhsIntegratedVisualReview@1.0

整页视觉独立 Gate，仅表示固定离线断言，不表示真实 Provider 视觉质量通过。严格字段为版本/合同/id、`candidateRef`、evaluation mode、层级/语义/品牌/水印 Logo/跨页五项状态、overall、observations、blockers、时间与 `reviewHash`。

任一失败使 overall 失败；未检查或需审阅不能被 OCR、事实或模拟用户选择绕过。历史 `XhsVisualReview@1.0` 只读保留原结论，缺项为 unknown。失败路径阻止选择并要求显式回退。
