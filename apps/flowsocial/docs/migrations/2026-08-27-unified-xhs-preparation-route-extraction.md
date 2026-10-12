# Unified XHS Preparation 路由拆分

## 变更范围

- 将小红书统一生产的生产状态、设计编译、Provider 计划和执行授权四个 HTTP 端点迁至 `http/unified-xhs-preparation-routes.mjs`。
- `server.mjs` 仍负责请求入口、存储实例、Feature Flag 解析和运行时依赖；新 handler 只负责路由匹配与 HTTP 编排。
- Provider 正式执行、轻修订、视觉审阅、人工确认、内容推广和交付路由未移动。

## 兼容性与下游影响

- URL、HTTP 方法、请求体、响应状态、响应体和错误码保持不变。
- `created` 为真时才持久化的幂等规则保持不变。
- Provider 执行授权仍只是人工授权事实，不会在该 handler 内触发付费调用或平台写入。
- Feature Flag 关闭时继续在调用领域函数之前失败关闭。

## 验证

- `unified-xhs-preparation-routes-self-test.mjs` 锁定未处理协议、方法限制、作用域查询、Feature Flag、幂等持久化和错误映射。
- 该测试加入固定产品测试清单；统一内容产品 API 测试继续覆盖真实 Server 组合入口。

## 回滚

回退本次提交即可恢复内联路由。该重构不改变数据库结构、不迁移数据，也不修改任何历史内容或授权记录。
