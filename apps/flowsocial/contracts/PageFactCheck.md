# PageFactCheck@1.0

页面事实引用独立 Gate。严格字段为版本/合同/id、候选与内容真值 ref、`evaluationMode=offline_fixture_assertion`、预期/观察 fact IDs、额外 claims、状态、blockers、时间与 `checkHash`。

缺失、替换或新增事实均硬失败；OCR 成功不得覆盖此状态。Adapter 只读且不反写上游真值。历史无证据为 unknown；失败时阻止选择，显式回退 `deterministic_layout`。
