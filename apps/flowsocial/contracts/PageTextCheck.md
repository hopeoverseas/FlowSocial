# PageTextCheck@1.0

离线 fixture OCR 断言合同，不声称真实 OCR 能力。严格字段为版本/合同/id、`candidateRef`、`contentTruthRef`、`evaluationMode=offline_fixture_assertion`、`expected`、`observed`、`matches`、独立 `status`、`blockers`、时间和 `checkHash`。

逐项核对标题、数字、英文产品名、中文专有名词/保护词、CTA、额外文字、伪文字与置信度。失败不修改图片或内容真值，也不改变事实/视觉状态。历史缺证据为 `legacy_quality_unknown`；失败或需审阅时禁止选择并回退确定性路径。
