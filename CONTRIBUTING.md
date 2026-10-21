# 跨电脑与 IDE 共创指南

本指南供 macOS（包括 Intel）、Windows、Linux，以及 VS Code、Cursor、Codex、JetBrains 等 IDE 使用。GitHub 上的 main 是已合并项目的最新基线；云盘同步状态、IDE 缓存和本地聊天记录都不能代替 Git 核对。

## 仓库与开始阅读

- GitHub：[hopeoverseas/FlowSocial](https://github.com/hopeoverseas/FlowSocial)
- 远程地址：https://github.com/hopeoverseas/FlowSocial.git
- 默认分支：main
- 许可证：根目录 [MIT License](LICENSE)
- 唯一可运行应用：apps/flowsocial/

首次接手建议依次阅读 [本指南](CONTRIBUTING.md)、[AGENTS.md](AGENTS.md)、[项目入口](README.md)、[接手说明](docs/HANDOVER.md)、[工程进度](docs/PROGRESS.md)、[下一步任务](docs/NEXT_STEPS.md)，再按任务查看[架构](docs/architecture/system-architecture.md)、[本地运行说明](docs/operations/local-development.md)、模块合同和迁移记录。

main 只表示已经进入 GitHub 主线的进度。Pull Request 分支、未提交工作和本机数据不自动属于主线；开始任务前必须确认自己的克隆确实包含 GitHub 最新 main。

## 必需环境与可选工具

| 项目 | 要求 |
| --- | --- |
| Git | 用于克隆、同步和审阅；使用每台电脑各自的克隆目录 |
| Node.js | 使用根目录 .nvmrc 指定的 **24.18.0**；包声明最低 >=22.5.0，CI 固定 24.18.0 |
| npm | 随 Node.js 提供；依赖以 apps/flowsocial/package-lock.json 为准，只用 npm ci，不要混用 yarn/pnpm |
| 浏览器 | 日常使用需要本机浏览器；完整测试需要 Playwright Chromium；只读代码或运行语法/架构检查时不需要 |
| IDE | 任意能编辑 JavaScript、Markdown 和 YAML 的 IDE；IDE 及扩展均非项目运行依赖 |

Intel Mac 请安装 x64 版 Node.js 24.18.0；Windows 请安装 x64 版。可用 nvm/fnm 或对应平台的 Node.js 安装包管理版本。Windows PowerShell 若遇到脚本执行策略阻止 npm.ps1 / npx.ps1，使用 npm.cmd / npx.cmd。

应用使用 Node.js 原生 HTTP、内置 node:sqlite 和原生 JavaScript/CSS；没有独立前端构建工具链或必需 build/lint 命令。项目没有强制安装的 IDE 插件、MCP 连接器或外部 AI Skill，也没有 Docker/Compose 依赖。AI IDE 若支持仓库指令，应读取根目录 AGENTS.md；不支持时，在开始任务时明确让它先读本指南和 AGENTS.md。不需要为了贡献代码安装某个特定 IDE。

应用目录下的 SKILL.md 文件是随产品运行的内容/视觉能力定义，供应用的 Skill Runtime 使用；它们不是 IDE 扩展，也不要求安装到个人 IDE。项目的运行配置模板在应用目录，真实配置和密钥只保存在本机，绝不复制到公开仓库。

## 克隆与安装

每台电脑应使用独立 Git 克隆，不要让两台电脑或多个写入者同时改同一个 SynologyDrive/OneDrive 同步目录中的工作树。

### macOS Intel / Linux

~~~sh
git clone https://github.com/hopeoverseas/FlowSocial.git
cd FlowSocial
nvm install
nvm use
node --version
git status --short --branch

cd apps/flowsocial
npm ci --ignore-scripts --no-audit --no-fund
npx --no-install playwright install chromium
npm run check
npm run test:offline
~~~

Linux 首次安装 Chromium 时使用 npx --no-install playwright install --with-deps chromium 安装浏览器和系统依赖。macOS Intel 必须使用 x64 Node.js，而不是 Apple Silicon 的 arm64 构建。

### Windows PowerShell

先用 nvm-windows 安装并切换版本，再克隆项目：

~~~powershell
nvm install 24.18.0
nvm use 24.18.0
git clone https://github.com/hopeoverseas/FlowSocial.git
Set-Location FlowSocial
node --version
git status --short --branch

Set-Location apps/flowsocial
npm.cmd ci --ignore-scripts --no-audit --no-fund
npx.cmd --no-install playwright install chromium
npm.cmd run check
npm.cmd run test:offline
~~~

安装完成后，node --version 应输出 v24.18.0。依赖和 Chromium 安装需要网络；离线测试本身会使用隔离数据和合成输入，并阻断外网。不得为了测试复制活动数据库或客户资料。

## 代码地图与运行方式

| 路径 | 主要职责 |
| --- | --- |
| server.mjs、app.js | Node HTTP 服务和应用组合入口 |
| strategy-agent/ | 业务事实、诊断、策略快照及激活 |
| content-agent/ | 周期选题、平台内容生产、不可变版本、审阅、交付和反馈 |
| contracts/ | Agent 与模块之间的版本化数据合同、引用和哈希规则 |
| skills/ | 产品运行时使用的内容与视觉 Skill |
| llm/、image-providers/ | 模型网关、Provider 适配、图片计划、预算与执行 |
| http/、ui/ | HTTP 路由适配和浏览器工作台模块 |
| storage.mjs、data/、artifacts/ | SQLite/本地存储实现；data/ 和运行产物只留在本机 |
| scripts/maintenance/ | 隔离测试、启动、检查和维护工具 |
| scripts/tests/、tests/fixtures/ | 自动化测试与合成夹具 |
| scripts/live/ | 可能触发真实模型或平台效果的脚本，运行前必须单独确认授权、费用和目标 |
| .github/workflows/offline-ci.yml | Ubuntu 24.04 上的 Node 24.18.0 离线产品检查 |

代码地图中的 strategy-agent、content-agent 等路径均相对于 apps/flowsocial/。CI 目前只在 Ubuntu 24.04 执行；Windows 和 Intel Mac 的本地命令已列出，但每次 CI 不代表这些平台也已实测。

本地启动命令必须在 apps/flowsocial/ 中执行：

~~~sh
npm run start:product:offline
~~~

然后访问 http://127.0.0.1:4273/。该入口跳过启动时的模型预检，但后续页面动作仍可能访问外部 Provider；offline 不代表整段交互断网。测试与产品边界见 [README](README.md) 和[本地开发说明](docs/operations/local-development.md)。当前项目是本机工作台，不是已具备认证和多租户隔离的生产 SaaS。

## 每次开始共创前：从 GitHub 同步并核对

先检查仓库地址、分支和本地改动：

~~~sh
git remote get-url origin
git status --short --branch
~~~

origin 必须是 https://github.com/hopeoverseas/FlowSocial.git（或该仓库对应的 SSH 地址）。若工作区有未提交改动，先保护并确认这些改动归属；不要重置、清理、自动 stash、覆盖文件或在未核对时切换分支。

只有在确认工作区干净后，才从 main 同步：

~~~sh
git switch main
git fetch origin
git pull --ff-only origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short --branch
~~~

开始新任务前，HEAD 与 origin/main 的完整 SHA 必须一致，且 git status --porcelain 为空。若远端地址错误、认证不可用、拉取冲突、分支分叉或本机有未解释改动，先保留现场并报告；不要用 reset --hard、强制推送或重写历史来“对齐”。没有 GitHub 权限时，由项目所有者自行完成 gh auth login 或 SSH 配置，不要索取或处理 token。

同步通过后，从 main 新建本次任务分支，例如 docs/cross-ide-guide、fix/dashboard-counts。不要把新工作直接写到 main。处理已有功能分支时，先检查它与最新 origin/main 的关系；不要未经确认自动 rebase、合并或覆盖分支。

云盘只负责文件存放，不提供可靠的 Git 分支并发控制。不同电脑分别 git clone，用 GitHub 分支/PR 交换改动；不要依赖 Finder 显示的云端“已同步”来判断代码版本。

## 完成共创后留下什么

每项实际完成的功能、修复或有结论的文档工作，都要留下可被下一台电脑读到的 Git 变更，并在 [docs/PROGRESS.md](docs/PROGRESS.md) 记录一条简短进度：日期、起始 commit、分支或 PR、完成内容、实际运行的命令及其结果、尚存问题。只记录本次真实执行的验证；没运行测试就明确写“未运行”，不能沿用旧结果。

按影响范围同步维护其他固定文档：

- 修改范围、优先级或验收条件：更新 [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)。
- 稳定架构、业务边界、未决输入或风险变化：更新 [docs/HANDOVER.md](docs/HANDOVER.md)。
- 启动、安装、配置或排障行为变化：更新 [本地开发说明](docs/operations/local-development.md) 和必要的 README。
- API、数据结构、状态机、数据库迁移、权限/开关或模块边界变化：更新对应合同、迁移说明和 [架构说明](docs/architecture/system-architecture.md)。
- 顶层目录或文件职责变化：更新 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)。

文档与代码一并提交，让所有 IDE 在下一次 fetch/pull 后都能读到同一版本。提交/PR 说明写清目标、改动范围、验证结果、风险和下一步；不要另建重复的日期版接手文档或私人工作日志。不要把密钥、真实业务输入、客户数据、活动数据库、上传文件写进文档、夹具、提交说明或 PR。
