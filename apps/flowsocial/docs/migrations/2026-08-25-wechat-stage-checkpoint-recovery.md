# 公众号分阶段恢复与审阅语义调整

## 变更

- 新增可选、追加式集合 `unifiedWechatStageCheckpoints`。
- 公众号正文、内容审阅、配图规划每完成一步，立即保存该步受控 Output Fact。
- 同一 `materializationId + stepId` 恢复时，只有执行计划、输入 Hash、Invocation Hash 和能力名称全部一致才会复用；任何不一致都会返回冲突，不会自动重调 Provider。
- `review-wechat-article` 的 `revise` 仅表示编辑建议，不再阻断配图规划；`block`、`fact_recheck_required=true` 或 blocker finding 仍然阻断。

## 兼容性

- 旧数据库没有 `unifiedWechatStageCheckpoints` 时按空集合读取，无需离线迁移。
- 已完成的公众号 Commit 和生产 Run 仍优先按原幂等逻辑返回，不依赖检查点。
- 检查点只复用原始受控 Output Fact，不改写正文、审阅结果或配图规划。

## 下游影响

- 前端仍调用原来的平台恢复接口，不增加按钮或人工闸门。
- 后一步失败后再次点击，系统从第一个未完成阶段继续；已完成 Provider 阶段不会重复计费。
- 普通可读性建议会随审阅结果进入后续人工编辑，不再被当作内容安全失败。

## 回滚

1. 停止向 `runUnifiedAtomicWechatCommitOrchestration` 传入检查点读取/保存回调，即可恢复旧的一次性执行行为。
2. 恢复审阅 readiness 对 `decision === "pass"` 的要求，即可恢复旧阻断语义。
3. `unifiedWechatStageCheckpoints` 为追加式辅助数据，回滚代码时可以保留；旧代码会忽略该集合。不要在回滚过程中删除历史 Commit 或 Provider 证据。
