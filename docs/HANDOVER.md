# FlowSocial 接手说明

盘点日期：2026-10-03；公开发行决策更新：2026-10-12。所有者已选择 `hopeoverseas/FlowSocial`、公开仓库、MIT 协议和新的 `main` 历史。本文维护接手事实、系统边界和待确认业务输入；工程实测状态只维护在 [PROGRESS.md](PROGRESS.md)，优先级和验收任务只维护在 [NEXT_STEPS.md](NEXT_STEPS.md)。具体运行命令以[本地开发](operations/local-development.md)为准。

## A. 项目一句话定位

一个面向小红书与微信公众号的本地社媒工作台，把冻结业务事实和策略变成可追溯的平台内容，再通过人工选择、本地交付、人工发布记录和精确反馈推进下一周期。

## B. 架构与目录地图

唯一应用 `apps/flowsocial` 使用原生 Node HTTP、原生 JS/CSS、内置 SQLite 和本地文件。模块所有权见 [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)，数据/合同边界见[系统架构](architecture/system-architecture.md)。

| 模块/文件 | 当前职责与证据 |
| --- | --- |
| `strategy-agent/` | 事实治理、诊断、策略文档、版本激活；`strategy-store.mjs` 持久化策略领域 |
| `content-agent/` | 周期、机会、平台 staged atomic、不可变版本、审阅、交付和反馈 |
| `contracts/` / `skills/` | 跨模块可执行合同、哈希与唯一内容/视觉能力源 |
| `llm/` / `image-providers/` | Provider 端口、计划编译、调用预算、执行与规范化 |
| `http/` / `ui/` | 当前路由投影、退休接口响应和工作台视图 |
| `server.mjs` / `app.js` | 较大的组合入口；新增领域规则应继续提取到模块 |
| `storage.mjs` | SQLite `app_state` JSON 状态与 API 错误；WAL，进程内写队列不等同于多实例锁 |
| `scripts/tests/` / `tests/fixtures/` | 产品回归与合成夹具；`scripts/live/` 是显式真实调用 |

账号模型含 Workspace、Company、AccountMatrix、SocialAccount 与范围一致性校验，尚不能证明具备用户 OAuth、登录、团队 RBAC 或多租户安全隔离。未发现持久 cron/队列、平台 webhook 回调或自动指标采集主链；发布和指标主要由人工录入。模型/Provider 轮询不等同于持久任务调度。

## C. 本地启动与部署

推荐 Node.js 24.18.0，包声明最低 22.5.0。在应用目录安装锁定依赖后运行 `npm run check`、`npm run test:offline`，首次本地查看用 `npm run start:product:offline`。工作台和 API 默认端口 **4273**，只监听 `127.0.0.1`。

`start:product:offline` 只跳过启动模型预检，页面后续动作仍可能真实调用 Provider；断网回归必须用隔离 runner。`npm start` / `start:product` 会进行真实模型预检。启动器可能停止同端口旧版进程，验收使用独立副本/数据/端口。

当前没有独立 build/lint、生产 Docker/Compose 或生产部署脚本。本地服务不是可直接公网部署的 SaaS；认证、权限、CORS/Origin、多实例并发、持久队列与运维均需先设计和验收。业务数据迁移见[运行数据规则](operations/runtime-data.md)，普通接手检查不读取活动数据库或敏感配置。

## D. 核心业务流程与数据流

1. 用户确认业务资料、账号、有效策略与来源，生成冻结快照。
2. 规划周期和机会，仅为目标平台创建 staged atomic 大纲，用户确认后生产正文/视觉。
3. 修改追加不可变 revision，保留上游引用、哈希、父版本与失效关系。
4. 人工检查当前精确正文/页面/图片版本，完成审阅、选择和本地交付。
5. 用户人工发布后登记精确发布对象、时间、证据与幂等引用；本地记录不会执行平台 API。
6. 72h / 7d 指标绑定同一发布版本，缺失值为 `null`；战术建议或策略候选用于下一周期，长期策略需人工激活。

小红书初次生成/regenerate 为 `gpt-image-2-text-to-image`，纯视觉编辑为 `seedream/4.5-edit`。付费主链绑定精确 Prompt、计划、人工批准、调用/credits 上限；未知效果进入 checkpoint 并停止自动重试。

默认产品策略 v5.0 开放本地人工发布事实、精确反馈事实和生命周期 UI，关闭真实平台发布、公众号资源上传与公众号草稿。历史 `ContentRun` 详情/trace/execution-plan/来源/大纲及旧写入已返回 410，不能再声称当前提供旧记录只读 API。

## E. 完成度判断

源码中已具备策略激活、周期/机会、平台大纲隔离、原子内容、不可变版本、人工审阅/选择、本地包、人工发布/反馈事实及下一周期相关能力；这些是本地合同和实现能力。工程验证结果、修复进展和未开始事项以 [PROGRESS.md](PROGRESS.md) 为准。

真实 Provider 质量、实际账号发布、反馈回收、团队线上部署尚未由本次接手验证。已批准公众号图文包仅为本地交付；历史 `WECHAT_40164` 的 IP 白名单变更未获独立证据，不能重试。

## F. 文档与源码差异

| 原说明 | 本次核对事实/处理 |
| --- | --- |
| ContentRun 仍有详情等只读兼容 | `http/retired-content-run-routes.mjs` 已返回 410；现行文档已纠正，历史 roadmap 明确历史 |
| 人工发布/反馈仍关闭 | 产品策略开放的是本地事实记录；真实平台写入仍关闭 |
| 图片默认 Seedream text-to-image | 当前图片生成/regenerate 为 gpt-image-2，纯视觉 edit 为 Seedream 4.5 |
| OpenAPI 服务地址 4173 | 默认服务地址统一为 4273；OpenAPI 仍未覆盖全部当前路由 |
| 新环境产品回归无条件可通过 | 初始夹具依赖私人运行状态已修复；最终隔离套件 44/44 通过，范围/证据见 PROGRESS |
| 源码包等于原仓库备份 | 无 Git 历史、活动 DB、账号授权或历史产物；不能恢复原业务上下文 |

模板 MiniMax / Anthropic 与代码缺省 DeepSeek / `deepseek-chat` 是不同配置来源，不能混写成一个当前默认值。实际 Provider 权限和质量仍需授权后的真实验收。

## G. 风险、坑与技术债

- 原静态服务可读应用根目录非点文件，现仅允许 11 个精确公开资源；旧泛化生图及 content-tasks 生图/重试/修订付费入口现返回 410。下游需迁移到受控主链，详见[兼容说明](../apps/flowsocial/docs/migrations/http-static-and-image-boundaries.md)；代表性测试和完整回归状态见 PROGRESS，不代表全面安全审计。
- `GET /dashboard` 仍用 `contentTasks.length + 18` 与 draft 数量 `+ 7`（`apps/flowsocial/server.mjs:2665`），带演示偏移；本轮未修复报表，不能把这些数字作为真实业务统计或验收证据。
- 单个 app_state JSON 写入缺少多实例并发控制；进程内 mutationQueue 仅约束当前进程。
- server/app 入口较大；拆分须保留版本、门禁、幂等、预算和历史事实，不能按行数切割。
- 无用户登录/团队 RBAC，CORS/Origin 不是统一认证；本地回环监听不提供团队公网安全性。
- 导入存储可自动建表及进行增量列迁移，迁移行为在模块和维护脚本内；不应把 Markdown 迁移记录当成全部迁移执行器。
- 项目代码采用根目录 MIT LICENSE，第三方依赖保留各自许可。本机业务数据、原 seed、研究材料和交付物不属于公开发行范围。

## H. 接手时建议的五项下一步

1. 修复轻结构改单的合成夹具，保留断言并跑完整隔离产品回归。
2. 限制静态资产范围，关闭未受控泛化付费入口并验证零 Provider 调用。
3. 统一接手/进度/任务/运行文档，区分历史设计、本地事实和真实平台效果。
4. 准备忽略规则、敏感文件/大文件检查与 Node 24 离线 CI；按所有者已确认的公开仓库、MIT 与新 main 历史决定提交。
5. 明确业务数据、账号授权、调用预算和精确内容版本，填好真实验收清单后执行人工门禁。

以上为 2026-10-03 接手时建议；任务目标、验收标准、影响、命令和风险见 [NEXT_STEPS.md](NEXT_STEPS.md)，实际完成证据见 [PROGRESS.md](PROGRESS.md)。源码提交/排除范围和公开发行记录见 [GITHUB_UPLOAD_PLAN.md](GITHUB_UPLOAD_PLAN.md)。

## I. 待所有者确认

- 仓库与历史决策已确认：新建公开 `hopeoverseas/FlowSocial`，MIT 协议，建立新的 `main` 历史；发布与验证记录见 GITHUB_UPLOAD_PLAN / PROGRESS。
- 先用于本机运营，还是团队线上服务；两者的认证、权限和运维要求不同。
- 使用新 seed 工作区，还是另行授权私有业务数据迁移；原数据、资料与外置资产的责任人和版本。
- 真实验收用哪个账号/策略/内容版本、哪些权限和预算；只填非敏感引用，不把凭据写入文档。

## 交接版本证据

原交接盘点时未发现 `.git`。交接清单列出 723 个源文件，接手检查验证了 722 个非数据文件 SHA256 一致；`data/store.json` 内容未读取或审计，清单字节数为空。来源提交/分支仅是交接文档声明，不能作为原项目可验证 Git 历史。2026-10-12 经所有者授权建立新的 main 历史并上传公开仓库；当前 Git 与发行验证记录见 PROGRESS。原 HANDOFF 报告和清单保留为本地交付旁证，不进入公开仓库且不改写。

## 关键源码证据索引

以下行号为本次核对位置，后续改动时以对应符号为准：

| 结论 | 源码位置 |
| --- | --- |
| 默认/隔离数据目录、WAL 与 app_state JSON | `apps/flowsocial/storage.mjs:7`、`:14`、`:38`；读写 `readStore` / `writeStore` |
| 本地人工发布/反馈开关与真实平台写入关闭 | `apps/flowsocial/product-capability-policy.mjs:25`、`:37` |
| 旧 ContentRun 410 与覆盖路由 | `apps/flowsocial/http/retired-content-run-routes.mjs:10`、`:29` |
| 本地发布事实绑定 preview、幂等且不调用平台 | `apps/flowsocial/content-agent/atomic-manual-publication-store.mjs:211`、`:242` |
| 精确反馈窗口/版本/幂等 | `apps/flowsocial/content-agent/atomic-publication-feedback-store.mjs:16`、`:294` |
| regenerate/edit 的模型分支 | `apps/flowsocial/content-agent/unified-content-xhs-light-revision.mjs:180` |
| 存储导入时的增量迁移 | `apps/flowsocial/strategy-agent/strategy-store.mjs:319` |
| 离线产品启动只跳过模型预检 | `apps/flowsocial/scripts/maintenance/start-product-offline.mjs:4`、`start-server.mjs:59` |
| 启动器可停止同端口旧服务 | `apps/flowsocial/scripts/maintenance/start-server.mjs:29` |
| 资料单文件限制与检索入口 | `apps/flowsocial/knowledge-base.mjs:240`、`:505` |
| 静态资源精确清单与路径检查 | `apps/flowsocial/http/static-assets.mjs:7`、`:20` |
| 旧付费入口在请求体/状态前返回 410 | `apps/flowsocial/server.mjs:1430`；实际位置以对应错误码分支为准 |
| 看板仍有演示数量偏移，不能用作真实统计 | `apps/flowsocial/server.mjs:2665`，generated `+18` / drafts `+7` |
