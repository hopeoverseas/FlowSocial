# 阶段 2 模块边界收口

## 完成范围

- `server.mjs` 已迁出发布周期领域逻辑、小红书准备路由、小红书正式执行与轻修订路由、公众号物化/上传前内容包/生产控制路由。
- `app.js` 已迁出无 DOM 副作用的基础格式化函数，并通过 `app-foundation.js` 在主应用之前加载。
- 现有 HTTP 路径、请求/响应合同、错误码、Feature Flag、幂等规则、人工授权门、Provider 调用预算和断点恢复规则保持不变。

## 模块所有权

- `content-agent/cycle-workbench.mjs`：发布周期工作台领域状态。
- `http/unified-xhs-preparation-routes.mjs`：小红书设计、Provider 计划与授权前路由。
- `http/unified-xhs-execution-routes.mjs`：小红书正式 Provider 执行和轻修订路由。
- `http/unified-wechat-production-routes.mjs`：公众号物化、上传前内容包和生产控制路由。
- `app-foundation.js`：前端纯函数基础层。

## 下游影响

- API 客户端无需修改。
- 历史数据和数据库结构无需迁移。
- 旧 `ContentRun` 与 unified atomic 的兼容关系未在阶段 2 改动，留待阶段 3 独立处理。
- 发布、上传、反馈和不可逆平台操作仍受原人工确认门与关闭状态保护。

## 验证与回滚

- 固定产品测试覆盖新路由边界和前端基础模块，并继续验证零真实外部调用和零平台写入。
- 每批均有独立 Git checkpoint；可逐提交回退。回滚不需要删除或转换任何业务数据。
