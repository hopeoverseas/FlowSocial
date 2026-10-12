# FlowSocial 项目结构

本文件是仓库目录和文件治理的唯一说明。结构变化时直接修改本文件，不新建
`项目结构-v2.md`、日期快照或同类说明。

## 顶层布局

```text
apps/flowsocial/             唯一可运行应用
docs/HANDOVER.md              接手事实与待确认输入
docs/PROGRESS.md              工程进度与实测状态
docs/NEXT_STEPS.md            P0/P1/P2 任务与验收
docs/product/                唯一产品路线图（历史决策明确标注）
docs/architecture/           唯一系统架构说明
docs/operations/             本地运行、协作与运行数据规则
LICENSE                     MIT 许可证
```

## 应用内部所有权

```text
strategy-agent/             策略 Agent 与诊断状态
content-agent/               平台 staged atomic、审阅、交付、反馈与学习
contracts/                   跨领域合同、稳定引用与确定性哈希内核
skills/                      唯一 Skill 源与 manifest
llm/                         模型网关、Provider Adapter 与任务注册
http/                        HTTP 路由适配层；只做协议转换、鉴权闸门和用例调用
ui/                          浏览器工作台的领域视图模块
image-providers/             图片 Provider 的能力、编译、执行计划和规范化适配
tests/fixtures/              可复现输入与模型评测集
scripts/tests/               离线自测与合同评测；旧 live 命令须显式授权
scripts/maintenance/         迁移、备份、回填和修复脚本
scripts/live/                必须显式运行的真实 Provider / 平台调用脚本
scripts/demos/               可复现演示脚本
defaults/                    可公开的空初始化种子
data/                        仅保存在本机的 seed 与运行数据，全部忽略
artifacts/                   本地生成产物
```

`skills/design-xhs-integrated-pages/` 是唯一的小红书整页 Prompt 离线 Skill；其版本化输出合同位于
`contracts/PagePromptSpec.md`、`contracts/XhsIntegratedPagePromptSet.md` 和
`contracts/VisualStyleSelection.md`。离线评测固定放在 `scripts/fixtures/xhs-integrated-design/`，
不得复制为第二套 Skill、Contracts 或应用。

## 固定文档

| 主题 | 固定文件 |
| --- | --- |
| 项目入口 | `README.md` |
| 接手事实与待确认输入 | `docs/HANDOVER.md` |
| 当前工程进度和实测结果 | `docs/PROGRESS.md` |
| 可执行任务及验收标准 | `docs/NEXT_STEPS.md` |
| GitHub 上传范围与待确认计划 | `docs/GITHUB_UPLOAD_PLAN.md` |
| 目录与文件规则 | `PROJECT_STRUCTURE.md` |
| 产品范围和优先级 | `docs/product/product-roadmap.md` |
| 系统与 Agent 边界 | `docs/architecture/system-architecture.md` |
| 真实业务验收输入与证据 | `docs/operations/business-acceptance.md` |
| 协作与工作区规则 | `AGENTS.md`、`docs/operations/collaboration.md` |
| 本地运行和 API | `docs/operations/local-development.md` |
| 开源许可 | `LICENSE` |

模块自己的长期接口说明只放在模块 `README.md`；Skill 的 `SKILL.md` 和合同说明属于
可执行规范，不视为重复文档。

## 文件治理规则

1. 仓库只允许一个可运行应用、一个 Skills 源和一个 Contracts 源。
2. 同一主题不得新增带 `V2`、`最终版`、日期或“交接方案”的并行文档，直接修改固定文件。
3. 用户指定的接手事实、工程状态和下一步分别更新 HANDOVER、PROGRESS、NEXT_STEPS；不新增任务登记或治理层。临时对话留在 Codex，长期产品结论更新到固定文档，执行历史由 Git 保留。
4. 临时计划、原始验收附件和恢复材料保存在仓库外；本清单中的固定接手文档持续维护。清理既有附件必须遵循所有者授权，不自动删除。
5. 仅 `defaults/store.json` 空种子随源码提交；整个 `data/`（含原本机 seed）、数据库、上传、知识文件、备份和密钥属于本地数据。
6. 策略 Agent 与内容 Agent 只通过 `contracts/` 中的版本化合同协作。
7. 源码目录迁移必须独立提交，不与文档清理或业务功能混在一起。
8. 删除文件前必须确认无运行引用、无活动任务依赖，并在 Git 差异中可恢复。
9. 开始开发前先确认 Git 工作区；源码快照缺少 `.git` 时说明历史不可验证，未经所有者决定不凭空初始化或替换原历史。默认当前工作区；用户明确允许子 agent 时按文件分工，保持每个强耦合文件只有一位写者。临时 worktree 仅在必要时创建并及时清理。
10. 本机 `research/`、调研附件、交接导出清单与报告不随公开源码分发；长期公开架构和产品说明维护在 `docs/`。保留本机材料，不自动删除。
11. `contracts/` 是稳定内核，不得反向依赖 `strategy-agent/`、`content-agent/`、`http/` 或 `ui/`。
12. `strategy-agent/` 与 `content-agent/` 不得直接互相导入；协作必须经过合同、快照或显式 Adapter。
13. `server.mjs` 和 `app.js` 是组合入口，不应继续承接新的领域规则；新增后端路由和前端工作台优先落到 `http/`、`ui/`。
