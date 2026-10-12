# Cycle Workbench 模块拆分

## 变更范围

- 将发布周期工作台的保存、确认、槽位调整和启动运行逻辑从 `server.mjs` 迁至 `content-agent/cycle-workbench.mjs`。
- `server.mjs` 继续以原名称导出全部工作台函数，现有测试和调用方无需切换入口。
- HTTP 路径、请求体、响应体、错误码、持久化时机和 Feature Flag 均未改变。
- 新模块加入运行时 Build ID 源文件清单，修改后健康检查会正确提示需要重启。

## 下游影响

- API 客户端和前端无变更。
- 直接从 `server.mjs` 导入工作台函数的兼容调用仍可使用。
- 新代码应优先从 `content-agent/cycle-workbench.mjs` 导入领域函数，避免加载 HTTP Server 与存储启动副作用。

## 验证

- `cycle-workbench-self-test.mjs` 同时锁定新模块行为和 `server.mjs` 兼容导出。
- 完整产品测试继续验证发布计划到内容生产主链的组合行为。

## 回滚

可以回退本次提交，或将新模块函数原样移回 `server.mjs` 并恢复原导入。该拆分不迁移数据、不改变数据库结构，也不会产生需要清理的兼容数据。
