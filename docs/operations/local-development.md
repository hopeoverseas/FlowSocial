# 本地开发、模型与 API 配置

本文件维护当前运行和排障命令。进度与实测结果见 [PROGRESS.md](../PROGRESS.md)，真实业务验收输入见[业务验收清单](business-acceptance.md)。历史 ContentMaster / ContentRun 和旧图片方案保留在[路线图](../product/product-roadmap.md)的历史章节，不作为启动要求。

## 环境与安装

包要求 Node.js `>=22.5.0`；接手验证与 CI 固定 **24.18.0**，因为应用使用内置 `node:sqlite`。当前没有独立 build/lint 命令，`check` 做正式源文件语法和依赖边界检查。进入应用：

```sh
cd apps/flowsocial
node --version
npm ci --ignore-scripts --no-audit --no-fund
npx --no-install playwright install --with-deps chromium
npm run check
npm run test:offline
```

Windows PowerShell 使用 `npm.cmd` / `npx.cmd`，避免本机脚本策略阻止 `npm.ps1`。安装依赖和 Chromium 需要网络；如果已有与锁文件匹配的 npm 缓存，可在 npm 安装命令中加 `--offline`。不要为安装而读取或处理 GitHub Token。完整产品回归包含公众号图文和移动预览渲染，必须预先安装与锁文件匹配的 Chromium；Linux 的 `--with-deps` 同时安装系统依赖。安装与离线测试分开执行，回归不自动下载浏览器。

## 离线回归

`npm run test:offline` 使用临时源码副本、纯合成空 seed、依赖链接和隔离数据，不读取工作区 seed/运行数据；子进程仅继承必要非敏感变量并阻断外网，同时允许本机 HTTP API 测试。检测到本机 `.env.local` 或平台集成配置时失败关闭，仅检查文件元数据，不读取内容。不要把活动数据库移入测试目录；完整套件不能以跳过断言或复制私人数据库修成通过。

`test:product` 是原有底层回归入口，不包含同样的隔离承诺。新增测试应使用合成夹具、临时数据目录、fake transport 和明确的零外部调用断言。测试输出只能证明合同与本地行为，不证明模型质量、上传、草稿或发布。

## 启动本地产品

```sh
npm run start:product:offline
```

工作台 `http://127.0.0.1:4273/`，健康接口 `http://127.0.0.1:4273/api/v1/health`。不要双击 `index.html`。健康接口的 `runtimeMode: live` 只表明连接本地运行服务，不表明任何平台已发布。

`start:product:offline` 装配 `product-capability-policy.mjs` 当前策略并跳过模型预检；后续 UI 操作仍可能访问外网。它不是断网演示模式，也不能替代 `test:offline`。`start:offline` 直接启动 server，不装配同一组产品默认开关。`npm start` / `start:product` 会做真实模型预检，确认授权与费用后再执行。

启动器可能停止同端口的旧版 FlowSocial。需要手工隔离启动时，在全新源码副本中使用独立数据目录和未占用端口：

```sh
FLOWSOCIAL_DATA_DIR="/absolute/path/to/new-sandbox/data" PORT=4274 npm run start:product:offline
```

该目录必须与活动实例分离；`FLOWSOCIAL_DATA_DIR` 只重定向数据库和部分资产，不能代替完整源码/产物隔离。Windows 用 `$env:FLOWSOCIAL_DATA_DIR`、`$env:PORT` 设置同样值。停止当前终端用 `Ctrl+C`；不要清库、强制重置 Git 或打开发布开关来解决启动错误。

## 配置来源与模型

以下仅是公开配置说明，不包含凭据：

| 来源 | 文本模型/协议 | 图片 |
| --- | --- | --- |
| 未配置时的代码缺省 | DeepSeek / `deepseek-chat` / OpenAI 兼容 | `gpt-image-2-text-to-image` |
| `.env.example` 模板 | MiniMax / `MiniMax-M3` / Anthropic 兼容 | Kie `gpt-image-2-text-to-image` |
| 小红书纯视觉编辑计划 | 取决于具体任务配置 | `seedream/4.5-edit` |

模板不保证接收方账号有相应权限；代码缺省也不证明服务可用。操作者需真实生成时自行复制公开模板为本机 `.env.local` 并私下配置密钥；Agent 不读出配置内容。配置入口以 `provider-config.mjs`、`platform-integration-config.mjs` 为准，前端只获取是否已配置和非敏感摘要。本地平台集成配置不是用户 OAuth、团队登录或权限系统。

手工文件配置改变后应重启本机服务；页面配置入口的生效方式以接口响应和健康状态为准。没有真实验收输入时不执行 `test:model:live`、`test:providers:live` 或 `scripts/live/`。

## 产品开关与接口

产品策略 v5.0 的 local-package 默认：本地生产、原子产品、审阅/选择、本地交付开放；`ATOMIC_MANUAL_PUBLICATION_V1`、`ATOMIC_EXACT_FEEDBACK_V1`、发布生命周期和策略反馈开放的是本地事实记录。受控小红书 Provider 执行需精确计划、人工费用批准和调用上限；自动重试为 0。

`PLATFORM_PUBLISHING_V1`、旧 `CONTENT_PROMOTION_V1`、公众号资源上传与公众号草稿开关默认关闭。Feature Flag 打开也不能替代人工授权、精确选择和发布确认。公众号历史 `WECHAT_40164` 必须独立确认 IP 白名单后才可讨论重新授权调用。

旧 ContentRun 路由已退役并返回 `410 / LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED`，包括详情、trace、execution-plan、来源选择、大纲与旧写入。新主链见 staged atomic、原子产品和 `http/` 适配模块；[OpenAPI](../../apps/flowsocial/openapi.yaml) 默认服务端口为 4273，API 文档版本与应用包版本分别管理，文档尚未覆盖全部现行路由。

静态入口仅服务 `http/static-assets.mjs` 的 11 个精确资源；新前端资源需要同步清单和 HTTP 测试。data、后端代码、上传和交付物通过静态 URL 一律 404，产物使用现有版本化预览/下载 API。旧 images/generate 返回 410 `UNGOVERNED_IMAGE_GENERATION_REMOVED`；旧 content-tasks assets/generate、visual-candidates/retry、revise 返回 410 `LEGACY_PAID_CONTENT_GENERATION_REMOVED`。更换到原子计划/审批/执行或新上游内容版本，不能直接照搬旧载荷或恢复无审批费用路径，详见[迁移说明](../../apps/flowsocial/docs/migrations/http-static-and-image-boundaries.md)。

## 资料、检索与运行数据

- 上传解析支持 PDF、DOCX、TXT、Markdown、CSV、JSON、HTML，单文件限制 25 MB。
- 原文存在本机知识目录，元数据、切片和知识快照存在 SQLite；源码不能夹带客户资料。
- SQLite 建有检索索引，当前搜索还包含应用层中文关键词评分；不应把它描述成完整向量检索。
- 生成冻结资料引用；后续资料变化不会自动改写旧内容事实。
- 默认数据库为 `data/flowsocial.db`，示例 seed 初始化只适用于新工作区。备份、私有迁移和回退见[运行数据规则](runtime-data.md)，不要在活跃 WAL 上做文件替换。

## 排障与部署边界

| 现象 | 下一步 |
| --- | --- |
| 页面/健康接口不可用 | 核对终端、Node 版本和独立端口；不清库 |
| 模型 401/403 | 由操作者核对账号权限与本机授权，输出仅保留错误类别 |
| 模型 402 | 由操作者确认余额与预算，不自动付费或换凭据 |
| Provider 超时/响应未知 | 保留同一精确请求与幂等引用，先查效果并对账，禁止自动重试 |
| 缺少精确原图 | 阻断 image_edit，不猜测引用或覆盖历史图片 |
| 缺浏览器 | 在测试前执行 npx --no-install playwright install --with-deps chromium，安装锁定版本对应的浏览器和系统依赖 |
| 旧接口 410 | 转用现行 unified atomic 主链，不恢复退休写入 |

当前只有本地回环服务方案，没有生产 Docker/Compose、生产发布脚本或多租户认证/RBAC。进程内 mutationQueue 不能保障多实例写入；本地 SQLite/JSON 状态也不等同于并发 SaaS。团队公网部署需独立评审认证、Origin/CORS、权限、持久队列、备份与数据回退，未经评审不暴露服务到公网。
