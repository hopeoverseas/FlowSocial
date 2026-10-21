# FlowSocial 工程进度

状态日期：2026-10-12；下方 2026-10-03 检查为历史基线。本文件只记录实现/修复状态、命令结果与限制。接手边界见 [HANDOVER.md](HANDOVER.md)，后续任务与验收标准见 [NEXT_STEPS.md](NEXT_STEPS.md)。

## 接手基线

| 检查 | 已验证事实 |
| --- | --- |
| 来源与完整性 | 无 `.git`；交接清单 723 项，722 个非数据源 SHA256 匹配；未读取/审计 seed 内容 |
| 安装 | 在独立审计目录离线安装锁定依赖 45 packages 成功，禁止 lifecycle scripts |
| `npm run check` | 正式源码语法与架构边界通过，原基线扫描 215 个正式源文件 |
| Node 24.18.0 产品回归 | 顺序跑到第 32 项失败；前 31 项通过，余下 11 项单独全部通过，合计 **42/43**，不等同于完整套件通过 |
| 唯一已知失败 | `xhs-light-revision-self-test.mjs:22`：`fixture requires one complete XHS provider plan`，依赖本地运行 DB 的完整计划 |
| Node 26.7.0 | 产品 API 用例出现 ECONNRESET，原因不确定；未作为验收环境 |
| 独立启动 smoke | Node 24.18.0、临时数据、随机端口：主页/健康 200，产品策略基线与开关一致，真实平台写入关闭 |
| 原静态目录问题 | 临时副本的无敏感 canary 可经静态 URL 读取（200）；未请求真实 DB、敏感配置或客户文件 |
| 旧接口 | 旧 ContentRun detail smoke 返回 410，错误码 `LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED` |

以上为修复前基线。隔离测试未进行真实模型/平台调用，未访问活动业务数据。

## 本次五项结果

| 项目 | 状态 | 验收证据/剩余项 |
| --- | --- | --- |
| 1. 合成夹具与完整回归 | 已完成 | 轻结构改单测试不再导入运行 DB；合成权威计划/页面 revision，保留原断言；完整隔离产品套件 44/44 通过 |
| 2. 静态范围与付费旁路 | 已完成 | 11 个精确公开资源；4 条旧付费入口 410；HTTP 代表性测试通过，退休请求业务读/写、Provider 和外网调用均为 0；[兼容说明](../apps/flowsocial/docs/migrations/http-static-and-image-boundaries.md) |
| 3. 统一接手文档 | 已完成 | HANDOVER / PROGRESS / NEXT_STEPS 分工明确；README、运行、架构、AGENTS、历史 roadmap 与 OpenAPI 已统一；链接与 YAML 解析通过 |
| 4. GitHub 准备与 CI | 本地准备完成，外部决策待确认 | .gitignore 25 路径验证通过；本机配置/运行数据排除；Node 24.18.0 CI 与隔离 runner 已准备、本机等效命令通过；远程/历史/许可证待确认，GitHub Actions 未运行 |
| 5. 真实业务验收输入 | 清单完成，真实输入与验收待确认 | [business-acceptance.md](operations/business-acceptance.md) 明确精确输入、授权、预算、五个人类门、场景、证据与停止条件；没有真实调用或发布 |

第 4 项提交/排除清单和具体待确认推送步骤维护在 [GITHUB_UPLOAD_PLAN.md](GITHUB_UPLOAD_PLAN.md)。2026-10-03 修复阶段未执行 Git 初始化、stage、commit、push、云端 CI、生产部署或平台调用；2026-10-12 公开发行决定另见下节。

## 最终本地验证（2026-10-03）

命令：`npm run test:offline`，运行环境 Node.js **24.18.0**，最终退出码 **0**。runner 使用临时源码副本、纯合成空 seed、依赖链接与隔离数据，不读取工作区 seed 或运行数据；净化继承配置并阻断外网。

| 检查 | 最终结果与实际含义 |
| --- | --- |
| 外网 guard 自测 | 通过；包含 Node 接受的空白、十进制、十六进制和科学计数法字符串端口负例；用 mock 验证阻断，没有实际外网调用 |
| 正式源码/架构 | **218** 个正式源文件语法检查通过，合同内核和领域导入边界通过 |
| 产品回归 | **44/44** 通过，包含新增 HTTP 安全测试；guard 自测独立于这 44 项 |
| HTTP 静态/费用边界 | 11 个公共资源正常；私有文件、穿越、畸形编码和符号链接拒绝；4 条旧付费接口及旧 ContentRun 410；请求阶段业务读取、持久化、假图片/文本 Provider、受控 transport 和外网调用均为 0 |
| 文档 | 12 个 Markdown 文件相对链接无断链；OpenAPI YAML 解析通过，52 个 paths 无重复，4 条新退休付费路由只声明 410 |
| CI 配置 | YAML 解析、结构检查通过，official actions 固定 SHA；本机等效检查通过，**云端 Actions 未运行** |
| 文件/忽略检查 | 4146 个文件元数据（含 node_modules）无超过 100 MB 文件；敏感文件元数据 0；25 个允许/排除路径验证通过；723 个源码文本文件的高置信密钥格式匹配 0；31 个字面量候选为配置键名映射和测试输入/负例，匹配值未输出，范围与限制见上传计划 |
| 变更范围 | 29 个文件：15 个既有文件修改、14 个新增、无文件删除；未改业务 seed/活动 DB，没有 Git 历史可审计 |

本机验证日志保存在仓库外，不随公开源码分发。日志是本地验证证据，不提交 Git。以上不证明真实 Provider 质量、真实平台效果、历史无敏感信息或团队公网就绪。

## 本次变更文件

| 范围 | 文件 |
| --- | --- |
| HTTP 行为 | `apps/flowsocial/server.mjs`；新增 `http/static-assets.mjs`、`docs/migrations/http-static-and-image-boundaries.md`（后二者在应用目录内） |
| 轻修订夹具 | `apps/flowsocial/scripts/tests/xhs-light-revision-self-test.mjs`；新增同目录 `helpers/xhs-light-revision-fixture.mjs` |
| 离线回归 | `apps/flowsocial/package.json`、`scripts/maintenance/run-product-tests.mjs`；新增 `scripts/maintenance/run-offline-product-tests.mjs`、`offline-network-guard.mjs`，以及 `scripts/tests/http-security-boundaries-self-test.mjs`、`offline-network-guard-self-test.mjs`（上述 scripts 均在应用目录内） |
| GitHub 准备 | 根与应用 `.gitignore`；新增根 `.nvmrc`、`.github/workflows/offline-ci.yml` |
| 固定文档 | 根 `README.md`、`AGENTS.md`、`PROJECT_STRUCTURE.md`、`docs/README.md`；应用 `README.md`、`openapi.yaml`；`docs/architecture/system-architecture.md`、`docs/operations/local-development.md`、`docs/product/product-roadmap.md` |
| 新接手文档 | `docs/HANDOVER.md`、`docs/PROGRESS.md`、`docs/NEXT_STEPS.md`、`docs/GITHUB_UPLOAD_PLAN.md`、`docs/operations/business-acceptance.md` |

原 `HANDOFF-REPORT.md`、`HANDOFF-MANIFEST.json` 和业务 seed 保留原样。未删除任何交接源文件；依赖仅在被忽略的 node_modules 内安装。

## 已有实现能力

- 策略事实、诊断、策略快照与激活；公司/矩阵/账号范围一致性。
- 周期选题、机会与目标平台大纲；小红书/公众号 staged atomic 主链。
- 不可变内容/page revision、人工审阅、精确选择、本地包。
- 受控小红书 Provider 计划/审批/预算/checkpoint 与单页轻结构修订。
- 本地人工发布事实、精确反馈事实、生命周期和下一周期衔接。

这表示实现与本地合同存在，不表示真实平台已发布，也不表示真实模型质量已经验收。

## 未开始或尚不确定

| 事项 | 状态与边界 |
| --- | --- |
| 真实双平台业务闭环 | 本次未执行；账号、授权、预算、精确版本与发布前人工确认缺失 |
| 微信资源上传/草稿/发布 | 默认关闭；历史 WECHAT_40164，IP 白名单变更未独立确认 |
| 原业务数据迁移 | 是否需要不确定；源码 seed 不能恢复活动 DB/外置文件 |
| GitHub 公开发行 | 所有者已授权新建公开 `hopeoverseas/FlowSocial`、MIT、新 `main` 历史；实际验证记录见下节 |
| 公网团队部署 | 未准备生产方案；缺登录/RBAC、多实例并发和运维验收 |
| 持久任务队列、平台回调、自动指标回收 | 未发现当前主链实现，不把日历/轮询称为完整后台调度 |
| 看板真实统计修复 | 未开始；`server.mjs:2665` 的 GET /dashboard 仍有 generated `+18`、drafts `+7` 演示偏移，不作为真实统计或验收证据 |

## 风险跟踪

本轮修复了静态范围、四条未受控付费 HTTP 入口和回归对运行 DB 的依赖。剩余优先风险是 Git 历史未知、真实业务输入缺失和看板 `server.mjs:2665` 的演示偏移。组合入口较大、单 JSON 状态写入、无统一认证/RBAC、默认 CORS/Origin 和公开资料权利仍需独立评审。修复第一批边界不代表完成全部安全审计或团队部署准备。

原交接 SHA 只标识修复前快照；本轮改变源码/文档后不可继续声称所有现文件仍与原清单一致。未建立 Git 时保留原交接旁证和改动清单，后续按所有者决定形成可回退基线。

## 2026-10-12 公开发行

所有者明确授权：新建 `hopeoverseas/FlowSocial` 公开仓库，采用 MIT 协议，建立新的 `main` 历史。未恢复原 Git 历史；原交接清单保留在本地。

本次发行新增根 `LICENSE`、包/lockfile 的 MIT 声明、`defaults/store.json` 公共空种子、仅新库使用公共种子的兼容回退、初始化专用测试及迁移说明。整个 `data/` 和本机研究/交接材料排除在 Git 外。原本机数据未读取、替换或删除。

发布前验证已完成：

| 检查 | 2026-10-12 结果 |
| --- | --- |
| 公共依赖安装 | 干净副本 npm ci --ignore-scripts 安装 45 packages 成功；原工作区依赖保留 |
| 离线产品套件 | Node 24.18.0，45/45 通过，218 正式源码与架构检查通过，独立网络 guard 通过 |
| 公共空种子 | 新库回退、独立目录优先、原本机 seed 兼容、已有 SQLite 不重置均通过 |
| 干净源码启动 | 随机端口/专属临时数据，首页、health、dashboard 均 200，业务账号 0，模型/图片未配置 |
| 提交范围 | 730 文件；整段 data、研究/交接材料、5 个固定历史 live 内容包、依赖和凭据均排除 |
| 脱敏源码复查 | 728 文本候选高置信密钥格式 0；5 个模板凭据字段为空；3 处 live helper 默认字面量为测试占位符，未显示值 |
| 文档 | 13 个主要 Markdown 相对链接无断链，CI 与 MIT 元数据校验通过 |
| 文本换行 | Git 属性规范仓库文本为 LF，Windows cmd/bat 工作副本用 CRLF；本地原文件字节未批量改写 |

初次验证在旧本机依赖加载时超时，使用干净副本重新安装锁定依赖后复测通过，没有放宽或跳过测试。交接代码仍有 66 处原有 EOF 多余空行格式诊断，不作为业务修复修改它们。未读取/替换活动数据，未调用真实社媒 Provider 或平台。

### 远端发行与云端验证

- 已创建 [hopeoverseas/FlowSocial](https://github.com/hopeoverseas/FlowSocial)，核实 Public 可见性、默认分支 main、GitHub 识别 MIT License。
- 初始 main 提交为 [8b7d5a5](https://github.com/hopeoverseas/FlowSocial/commit/8b7d5a5fd692eb1b1459d383f645a0f55e0a71e2)，首次推送后本地与远端 SHA 一致，工作区干净；原交接没有可保留的 Git 历史。
- [首轮 Actions](https://github.com/hopeoverseas/FlowSocial/actions/runs/38266954711) 安装 npm 依赖成功，但公众号图文交付测试因 Chromium 可执行文件缺失而失败。本机通过依赖预先安装的浏览器，原“完整回归无需浏览器”文档不准确，已修正。
- 修复提交 [21f52dd](https://github.com/hopeoverseas/FlowSocial/commit/21f52ddcc9496479b3d4b77dd2d1274cc3b23c68) 补入测试前的 `npx --no-install playwright install --with-deps chromium`；安装与离线回归独立，未跳过断言或改动业务代码。
- [修复后 Actions](https://github.com/hopeoverseas/FlowSocial/actions/runs/38269293209) 于 2026-10-12 15:22 UTC 完成并成功：Ubuntu 24.04、Node 24.18.0，锁定依赖与 Chromium/系统依赖安装成功，完整 `npm run test:offline` 通过；218 个正式源码、架构和外网 guard 检查通过，输出 `product-tests: ok (45 tests)`。
- 本机 Git HTTPS 传输遇到 HTTP/2/连接失败；通过已登录 gh 的 Git Data API 同步修复。先核实远端父提交，再逐项比对文件树和完整提交 SHA，最后执行非强制的 fast-forward 更新。修复同步后核验本地/远端 main 均为 21f52dd；后续发行文档更新不改动该次验证的业务源码和 CI。

## 2026-10-22 跨电脑与 IDE 共创说明

- 起始基线：开工前本地 main 与 GitHub origin/main 均为 6e4c2b7673c31eac01fca7e136f0ceb840d5d8da，工作区干净；远程核验成功。
- 文档：新增根目录 CONTRIBUTING.md，说明公开仓库、跨平台环境、IDE/Skill 要求、模块地图、启动、每次共创前同步核对、分支方式和收尾文档；同步更新 README、AGENTS、PROJECT_STRUCTURE、docs 索引和协作说明。
- 验证：重新读取和审阅本次文档差异；未安装依赖，未运行 npm run check 或产品测试，因为本次只改文档。既有 CI 结果仍以 2026-10-12 的历史记录为准。
- 记录时的工作分支：docs/cross-ide-contributing。是否已并入主线以 GitHub main 和提交历史为准。
