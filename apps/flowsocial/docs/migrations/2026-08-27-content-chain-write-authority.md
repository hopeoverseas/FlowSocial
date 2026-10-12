# 内容链写入权威合同

## 目的

阶段 3 首先收敛写入权，而不是删除历史读取。`content-chain-authority.mjs` 将 unified atomic 与旧 ContentRun 的入口规则从 Server 条件分支提升为可测试合同。

## 最终规则

- `/content-agent/runs` 默认由 `unified_atomic` 负责，并创建 staged atomic bootstrap。
- `/content-agent/workflows` 暂时保留为 unified 的兼容别名，但不是规范入口。
- 旧 ContentRun 写入只允许显式 `entryMode: "legacy"`；不会因参数缺失而自动降级。
- unified 分支不得调用 `createContentWorkflow`，也不得产生旧 ContentRun 写入。
- 历史 ContentRun、发布归因、反馈跟进和周期槽位引用继续可读，当前批次不迁移、不删除。
- 当前前端不再调用周期槽位、机会、滚动计划、策略推荐或上游修订的旧写入口。
- 周期槽位和内容机会先采纳为统一权威输入，再创建 staged atomic 项目。
- 接受反馈动作默认只记录优化动作；下一篇从统一内容计划创建，不再自动追加旧 ContentRun。

## 下游影响

- `FlowAPI.createContentRun()` 无显式模式时继续默认 unified。
- 周期槽位、机会、滚动计划、策略推荐、反馈跟进和旧上游修订的历史 API 仍保留用于回滚，但写入必须显式携带 `entryMode: "legacy"`。
- API 路径和数据库结构没有变化；反馈接受响应新增 `followup`，且默认不再返回新建的 `nextContentRun`。

## 兼容与迁移说明

- 不迁移、不重写、不删除历史 `contentRuns/contentWorkflows`；旧详情、追踪、发布和反馈关联继续读取原 ID。
- 新采纳引用写入 `unifiedProjectId` 与 `unifiedProductionEntryId`，不会覆盖历史 `contentRunId`。
- 无显式 legacy 模式的旧写请求返回 `409 LEGACY_CONTENT_RUN_WRITE_EXPLICIT_OPT_IN_REQUIRED`，避免静默分叉。
- 反馈动作默认响应 `followup.authority=unified_atomic` 和 `requires_new_unified_project`，下游不得再假设一定返回 `nextContentRun`。
- 临时素材在形成知识资产或其他不可变引用前不得进入统一生成；机会采纳接口返回 `UNIFIED_CONTENT_TEMPORARY_MATERIAL_AUTHORITY_REQUIRED`，不会静默丢弃输入。

## 回滚

如需紧急回退，可对单次历史维护请求显式传入 `entryMode: "legacy"`，或回退阶段 3 的两个 checkpoint。回退不会要求数据逆迁移；不得删除已经生成的 prerequisite、bootstrap、确认事实或历史 ContentRun。
