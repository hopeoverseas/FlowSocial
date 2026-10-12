# XhsVisualSetSnapshot@1.0

冻结整套页面所选修订，可混合 `normalized_integrated` 与 `deterministic_layout`。严格字段包含版本/合同/id、任务/内容版本、快照 revision、父快照、operation、唯一 page 列表、创建者/时间、blockers 和 `snapshotHash`。

每页冻结 revision ref、来源和 text/fact/visual/finalCanvas 四项通过状态；任一非 passed 不得冻结。整套恢复创建新快照和新页面修订，不改旧快照。旧快照只读；关闭 Flag 即停止写入。
