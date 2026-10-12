# FlowSocial

FlowSocial 是面向小红书和微信公众号的本地社媒运营工作台，连接策略诊断、周期选题、平台内容生产、人工审阅、本地交付、人工发布记录与反馈复盘。当前只有一个可运行应用：[`apps/flowsocial`](apps/flowsocial)。

开源仓库：[hopeoverseas/FlowSocial](https://github.com/hopeoverseas/FlowSocial)。项目代码采用 [MIT License](LICENSE)，第三方依赖保留各自许可证。

## 接手入口

先读 [接手说明](docs/HANDOVER.md)、[工程进度](docs/PROGRESS.md)和 [下一步任务](docs/NEXT_STEPS.md)，再按模块阅读合同、Skill 与迁移记录。业务验收前填写[验收输入清单](docs/operations/business-acceptance.md)。长期工作规则见 [AGENTS.md](AGENTS.md)。

本项目从不含原 Git 历史的交接源码建立新的 `main` 历史。公开发行只含源码、文档、离线测试与新建的 `defaults/store.json` 空种子，不包含原机器的业务数据或授权。原始交接清单作为本地旁证保留，不进入公开仓库。

2026-10-12，所有者明确选择新项目、公开仓库和 MIT 协议；发行范围见 [GitHub 上传记录](docs/GITHUB_UPLOAD_PLAN.md)。活动数据库、账号授权、上传与交付物通过独立私有渠道处理，不能加入源码仓库，具体见[运行数据规则](docs/operations/runtime-data.md)。

旧 `xhs-publish-complete` 脚本使用的固定历史内容包和来源快照保留在本机，不随公开源码分发；对应历史验收需操作者自备私有输入，不属于普通公开 CI。脚本源码保留，不能以开源发行替代其授权、预算与精确版本确认。

## 技术栈与目录

后端使用 Node.js 原生 HTTP、内置 `node:sqlite` 和本地文件；前端使用原生 JavaScript/CSS。依赖包括 Busboy、Mammoth、pdf-parse、Playwright 和 Sharp。安装声明为 Node.js `>=22.5.0`，接手验证与 CI 使用 **Node.js 24.18.0**。这里没有前端构建工具链或独立的 build/lint 命令。

```text
apps/flowsocial/
├─ server.mjs / app.js   后端与前端组合入口
├─ strategy-agent/      事实、诊断、策略快照与激活
├─ content-agent/       周期、原子内容、审阅、交付与反馈
├─ contracts/           跨模块版本化合同与确定性哈希
├─ skills/              唯一内容和视觉 Skill 源
├─ llm/                 模型网关、任务注册与 Provider Adapter
├─ image-providers/     图片计划、编译、执行与规范化
├─ http/ / ui/          路由与工作台视图模块
├─ scripts/ / tests/    维护、离线测试、夹具和显式 live 脚本
├─ defaults/            随源码分发的空初始化种子
└─ data/ / artifacts/   被 Git 忽略的本地运行产物
```

架构边界见[系统架构](docs/architecture/system-architecture.md)，目录所有权见 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)。

## 本地启动

从仓库根目录运行；Windows PowerShell 使用 `npm.cmd`：

```sh
git clone https://github.com/hopeoverseas/FlowSocial.git
cd FlowSocial
nvm use
cd apps/flowsocial
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:offline
npm run start:product:offline
```

打开 `http://127.0.0.1:4273/`，健康检查为 `GET /api/v1/health`。不要通过 `file://` 打开页面。图片渲染确需 Chromium 时另行运行 `npx playwright install chromium`；依赖和浏览器安装需要网络，普通产品回归不需要浏览器或密钥。

`start:product:offline` 装配当前产品开关并跳过启动模型预检，页面后续动作仍可能访问外部服务。它与阻断外网的 `test:offline` 不同。`npm start` / `start:product` 启动时会进行真实模型预检；启用前须确认授权和费用。启动器可能停止占用同端口的旧版 FlowSocial，隔离验收必须使用独立目录、独立数据与端口。

配置模板与代码缺省值并不相同：模板示例为 MiniMax / Anthropic 兼容协议，未配置时的文本代码缺省为 DeepSeek / `deepseek-chat` / OpenAI 兼容协议。图片初次生成与 regenerate 使用 `gpt-image-2-text-to-image`，image_edit 使用 `seedream/4.5-edit`。实际配置看本地设置和健康接口的非敏感摘要；密钥仅由操作者在本机配置。详细步骤见[本地开发](docs/operations/local-development.md)。

## 核心流程与当前开关

```text
冻结业务事实、账号与策略
→ 周期选题与来源确认
→ 目标平台大纲与人工确认
→ 平台范围 staged atomic 正文/视觉版本
→ 事实与质量检查
→ 人工审阅、精确版本选择
→ 可追溯本地内容包
→ 用户人工发布，记录精确发布对象与证据
→ 72h / 7d 指标快照与下一周期
```

小红书与公众号共享冻结上游输入，但大纲、正文、图片和交付版本按平台隔离；每次修改追加不可变版本。单篇反馈先形成战术建议，长期策略变更需策略 Agent 和人工确认。

当前产品策略 `product-capability-policy.mjs` v5.0 开放本地内容包、人工审阅/选择、本地人工发布事实和精确反馈事实；受控小红书 Provider 入口还要求精确计划、人工费用批准、调用上限与零自动重试。真实平台发布、公众号资源上传和公众号草稿入口默认关闭。批准的公众号图文包仍是本地交付；历史 `WECHAT_40164` 失败必须等 IP 白名单独立确认后再考虑重新授权调用。

旧 `ContentRun` 的详情、trace、execution-plan、来源选择、大纲和旧写入接口已退役，返回 `410 / LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED`；历史数据保持不可变，不能把旧路由当作当前只读兼容 API。新内容使用 unified staged atomic 主链，迁移背景见 [Phase 7 记录](apps/flowsocial/docs/migrations/2026-08-28-phase-7-content-run-compatibility-removal.md)。

静态 GET/HEAD 只服务明确的 11 个浏览器资源；运行数据、源码和产物不再经静态目录访问。旧 `/images/generate` 返回 `410 / UNGOVERNED_IMAGE_GENERATION_REMOVED`，旧 content-tasks 的 assets/generate、visual-candidates/retry 和 revise 返回 `410 / LEGACY_PAID_CONTENT_GENERATION_REMOVED`。调用方应转用现有原子计划/批准/执行或不可变后继内容主链，不能直接复用旧请求体；兼容、影响与回退见[边界迁移说明](apps/flowsocial/docs/migrations/http-static-and-image-boundaries.md)。

## 测试与验收

```sh
cd apps/flowsocial
npm run check
npm run test:offline
```

`check` 检查正式源码语法与架构依赖边界。`test:offline` 在隔离数据环境执行产品回归，允许本机 HTTP 测试、阻断外网并清理继承的密钥环境；发现本机敏感配置时失败关闭，不读取配置内容。`test:product` 是原有底层入口，不应直接用于活动工作区。

2026-10-03 基线验证为 44/44 产品测试通过。本次公开发行增加空种子初始化与兼容回归；当前实测结果和 CI 状态统一记录在 [PROGRESS.md](docs/PROGRESS.md)。轻结构改单使用独立合成夹具，安全测试覆盖静态访问和旧付费入口。离线测试、HTML、ZIP、健康检查不能证明真实 Provider 成功、平台上传、草稿或发布。

## 部署与限制

当前验证的是监听 `127.0.0.1` 的本地单工作区服务，未提供生产部署脚本、Docker/Compose 或多租户登录/RBAC。SQLite 的进程内写队列也不是持久任务队列或多实例并发控制。团队公网部署必须先补认证、权限、Origin/CORS 边界、数据迁移和运维方案；当前不能直接按生产 SaaS 部署。

看板 `GET /dashboard` 仍有生成数 `+18`、草稿数 `+7` 的演示偏移，本轮未修复，不可用作真实业务统计或验收证据；后续任务见 NEXT_STEPS 的 P1-4。

本地部署就是安装依赖、指定独立运行目录和数据目录、启动产品入口并保留终端；备份、迁移与回退按[运行数据规则](docs/operations/runtime-data.md)执行。历史路线图中的 ContentMaster / ContentRun 和旧视觉方案仅说明过去设计，当前实现以架构、迁移记录及产品策略为准。

## 固定文档职责

| 文件 | 唯一职责 |
| --- | --- |
| [HANDOVER.md](docs/HANDOVER.md) | 接手事实、边界与尚待确认的输入 |
| [PROGRESS.md](docs/PROGRESS.md) | 已完成/进行中/未开始和实测状态 |
| [NEXT_STEPS.md](docs/NEXT_STEPS.md) | P0/P1/P2 任务与验收标准 |
| [业务验收](docs/operations/business-acceptance.md) | 真实验收输入、场景、证据和停止条件 |
| [系统架构](docs/architecture/system-architecture.md) | 长期模块、数据及兼容边界 |
| [产品路线图](docs/product/product-roadmap.md) | 长期产品方向与明确标注的历史决策 |
| [本地开发](docs/operations/local-development.md) | 运行、配置与排障命令 |

同一主题直接更新固定文件；不增加日期版或“最终版”平行说明。许可证全文见根目录 [LICENSE](LICENSE)。
