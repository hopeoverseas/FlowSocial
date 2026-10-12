# GitHub 公开发行记录

更新：2026-10-12。所有者已明确授权创建新项目、公开仓库、MIT 协议并上传源码，不再等待私有仓库或原历史方案确认。

| 项目 | 已确认决定 / 执行状态 |
| --- | --- |
| 目标 | [hopeoverseas/FlowSocial](https://github.com/hopeoverseas/FlowSocial) |
| 可见性 | Public，由所有者明确指定 |
| 许可证 | 根目录 MIT LICENSE；包及 lockfile 标注 MIT，第三方依赖保留自身许可 |
| 历史 | 新建 main 历史，原交接没有可独立验证的 Git 仓库 |
| 创建/推送 | 本次执行中；45/45 离线回归及空工作台启动已通过，远端结果与 CI 状态见 PROGRESS |

## 公开范围

提交项目源码、版本化合同、Skills、公开界面文件、离线测试与合成夹具、维护/真实调用脚本源码、固定工程文档、MIT 协议、锁文件及离线 CI。真实调用脚本只作为源码分发，本次不执行。

新增 `apps/flowsocial/defaults/store.json` 公共空种子。新克隆不包含任何业务账号、历史内容或运行数据库；初始化兼容性见[空种子迁移说明](../apps/flowsocial/docs/migrations/public-empty-seed.md)。

固定历史 `scripts/fixtures/xhs-publish-complete/` 内容包/来源快照、整个 `data/`、本机研究材料、原 HANDOFF 导出清单/报告、环境文件、本机配置、私钥、凭据、会话、数据库/dump/备份、上传素材、预览/交付包、依赖目录、日志与缓存均排除。原文件保留在本地，不被本次发行覆盖或删除。空密钥 `.env.example` 模板仅在占位字段检查通过后提交；任何真实凭据不得混入模板。

## 发布前验证

1. 使用 Git 忽略规则列出精确候选路径；对敏感文件仅检查元数据，不打开私有文件。
2. 对候选源码执行脱敏密钥/凭据格式检查及 100 MB 大文件检查，仅输出文件位置和类别，不输出匹配值。
3. 在候选源码的干净临时副本使用 Node 24.18.0 运行 `npm run test:offline`；安装和产品回归分开，测试使用合成输入、临时数据与外网阻断。
4. 在不含私有数据/配置的副本，以独立数据目录、随机端口和 `start:product:offline` 检查首页、健康和空账号列表；不触发真实 Provider 或平台。
5. 创建新 main 初始提交，创建明确指定的公开仓库并推送；核对远端提交、公开可见性、默认分支、MIT 识别及 CI 实际结果。

`.github/workflows/offline-ci.yml` 只具 `contents: read`，不持久化 checkout 凭据，安装禁用 lifecycle scripts，不部署或访问真实平台。Actions 固定到官方仓库 SHA，参考[GitHub 安全使用说明](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions)。

## 执行边界

仓库创建和推送已由本次用户请求授权；不执行强制推送、自动合并、生产部署、客户数据上传或真实社媒发布。若外部请求结果未知，先读取仓库/提交状态核实，不盲目重复创建或推送。使用已登录 gh，不读取、输出或手工处理 GitHub token；认证缺失时由用户执行 gh auth login 或配置 SSH。

真正的业务内容质量与发布闭环仍依赖[业务验收输入和人工门](operations/business-acceptance.md)。公开源码和 CI 通过不等于真实平台已上传、已建草稿或已发布。
