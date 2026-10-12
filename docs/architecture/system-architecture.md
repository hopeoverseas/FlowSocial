# FlowSocial 系统架构

本文件是 FlowSocial 系统边界的唯一长期说明。实现变化时直接更新本文件；字段级约束以
`apps/flowsocial/contracts/`、各 Skill 的 `SKILL.md` 和测试为准。工程实测状态见 `docs/PROGRESS.md`。

## 1. 主链

```text
策略诊断
  → StrategyDocument / StrategySnapshot
  → 账号身份、增长打法与有效策略
  → PublishingCycle / ContentOpportunity
  → 平台范围的 UnifiedStagedAtomicBootstrap（大纲确认）
  → 小红书或公众号 Atomic Product（正文 → 视觉 → 质检 → 审阅 → 交付）
  → PublicationRecord
  → PerformanceSnapshot
  → OptimizationAction / StrategyReviewCandidate
  → 下一周期的新选题
```

V1 的完成标准是真实用户不清库、不改数据库、不绕过状态机，从诊断稳定走到发布复盘并继续下一篇。
本次接手只验证本地实现与离线合同；真实账号、Provider、平台证据与成熟反馈仍须独立验收。

## 2. 模块边界

| 模块 | 负责 | 不负责 | 主要合同 |
| --- | --- | --- | --- |
| 策略 Agent | 事实采集、诊断状态、策略草案、账号打法与激活 | 正文生成、发布、自动改写历史事实 | `StrategyDocument`、`StrategySnapshot` |
| 内容 Agent | 发布周期、来源快照、平台大纲、原子内容、交付和战术学习 | 从原始聊天重新推断策略、修改活动策略 | `PublishingCycle`、`UnifiedStagedAtomicBootstrap`、平台 Atomic Product、`ContentPackage` |
| 发布与反馈 | 发布记录、分窗口指标、漏斗诊断和候选优化动作 | 用单篇表现自动改变策略 | `PublicationRecord`、`PerformanceSnapshot` |
| Skills | 在 manifest 和版本化输入输出合同内执行原子能力 | 私自建立第二套状态机或事实源 | Skill manifest、输入输出 schema |
| LLM 网关 | Provider 配置、超时、重试、降级和可观测性 | 隐藏真实失败原因、把规则降级伪装成模型成功 | 任务注册与诊断记录 |
| 合同内核 | 跨领域 schema、稳定引用、确定性哈希和兼容校验 | 依赖 Agent、HTTP 或 UI 实现 | `contracts/` 中的可执行合同 |
| HTTP 适配层 | 请求解析、路由、Feature Flag 和人工/费用闸门 | 实现领域规则或绕过状态机 | `http/` 路由模块、OpenAPI |
| 运行时适配层 | SQLite、文件、Provider 和平台 transport | 把未知外部效果当作成功或自动重试 | Storage / Provider / Platform Adapter |
| UI 工作台 | 呈现状态、收集精确选择并调用 API | 成为事实源、在浏览器复制服务端状态机 | `app.js`、`ui/` |

策略到内容的唯一通道是版本化快照和 Adapter。内容 Agent 不读取诊断对话内部状态；策略字段
变化优先由 Adapter 兼容，不向下游扩散内部结构。

### 2.1 运行时分层与依赖方向

```text
Browser UI
  → HTTP Routes
    → Application composition（server.mjs）
      → Strategy Agent / Content Agent
        → Contracts + Skills + LLM ports
          → SQLite / filesystem / Provider / platform adapters
```

依赖约束不是简单的“上层只能调用下一层”：`server.mjs` 作为组合根可以装配各领域与 Adapter，
但稳定内核不能反向引用交付层。当前自动检查强制执行三条底线：

1. `contracts/` 不依赖 Agent、HTTP 或 UI；
2. `strategy-agent/` 与 `content-agent/` 不直接互相导入；
3. 领域模块不得通过导入 `server.mjs` 获取运行时依赖。

HTTP 与 UI 只投影服务端状态。人工选择、费用批准、发布确认、未知效果对账仍由服务端合同和状态机裁决。

### 2.2 物理目录与职责

```text
server.mjs / app.js          组合入口与兼容装配
strategy-agent/             策略领域
content-agent/              内容生产、审阅、交付与反馈领域
contracts/                  稳定合同内核
skills/                     原子 AI 能力定义
llm/                        模型端口与 Provider Adapter
image-providers/            图片能力和执行计划 Adapter
http/                       后端路由适配
ui/                         前端领域工作台
storage.mjs + data/         本地持久化边界
scripts/                    离线测试、维护、演示和显式 live 操作
```

`server.mjs` 与 `app.js` 仍然偏大，是当前的组合根债务。后续拆分应按完整业务切片迁移，而不是按
文件行数机械切割：每次迁移一个路由族及其依赖装配，保留相同 URL、错误码、Feature Flag、幂等和
人工闸门；前端同样按页面工作台迁移，并让 `app.js` 最终只保留导航与模块初始化。

## 3. 数据所有权

```text
Workspace
  └─ Company
      ├─ StrategySnapshot
      ├─ AccountMatrix
      │   └─ SocialAccount
      │       └─ EffectiveAccountStrategy
      └─ PublishingCycle
          └─ ContentOpportunity / PlanSlot
              └─ Platform-scoped Staged Bootstrap
                  └─ Atomic Product Commit
                      └─ Review / Selection / Delivery
                          └─ PublicationRecord
                              └─ PerformanceSnapshot
```

公司、矩阵、账号、周期、机会、原子产品、发布和反馈必须使用同一组稳定 ID。每次生成冻结
当时的有效策略、事实、选题和来源版本；新策略或新周期不原地改写旧内容。

## 4. 内容编排

热点、爆款蓝图、知识库和临时素材是 `ContentOpportunity` 的可组合来源，不是四套平行流程。
所有新入口统一进入平台范围的 staged atomic 主链：

1. 锁定账号、目的、有效策略和来源；
2. 为小红书或公众号分别生成、校验并确认平台大纲；
3. 从确认的大纲生成对应平台正文与视觉；
4. 执行事实、标题承诺、平台完整性和必要视觉检查；
5. 完成人工审阅、精确版本选择并生成本地交付包；
6. 记录人工发布及后续表现，完成周期后生成下一周期的新选题。

未经确认的平台大纲不得直接生成正文。小红书与公众号可以共享上游选题，但不得复用对方的
大纲合同或把一端的恢复请求路由到另一端。历史 `ContentRun` 的详情、trace、execution-plan、来源选择、
大纲及旧写入路由已退役，返回 `410 / LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED`；历史数据保持不变，
不再作为当前只读 API。新主链入口和下游替代见 Phase 7 迁移记录。爆款蓝图不能成为业务事实。

## 5. 反馈机制

反馈采用两种速度：

- 单篇快反馈：用于标题、封面、开头、结构、互动设计等战术调整；
- 周期慢反馈：在足够样本、跨观察窗口且出现重复模式后，生成只读策略复核候选。

平台未提供的指标保存为 `null`，不能当作 0。72 小时、7 天和最终窗口分别保存修订快照，
不覆盖历史值。策略候选必须经策略 Agent 和用户确认后才可激活。

## 6. 模型与降级

前端只提交 Provider、Base URL、模型和密钥引用；密钥保存在本地配置中，不进入 Git。
每次模型调用记录 provider、model、状态、耗时、重试、错误分类和是否降级。规则降级是可见的
恢复路径，不等同于模型成功。

## 7. 兼容与变更规则

涉及合同、对象 ID、schemaVersion、状态机或数据库结构的修改必须同时提供：

1. 上下游影响说明；
2. Adapter 或迁移方案；
3. 合同测试；
4. 至少一条端到端场景；
5. 回退方式；
6. 历史快照只读兼容。

源码验证分为两层：`check-product-sources` 自动发现正式 JavaScript 源码并执行语法检查，
`check-architecture-boundaries` 校验稳定内核和领域之间的导入方向。`test:product` 必须先通过这两层，
再运行离线产品回归，防止新增文件因为未加入手工名单而逃逸检查。

工程状态与待确认输入分别写入 `docs/PROGRESS.md` 和 `docs/HANDOVER.md`；执行任务写入
`docs/NEXT_STEPS.md`，长期产品方向写入路线图。当前源码快照无 Git 历史，分支信息不能独立核验。

### 7.1 公众号分层修订与费用控制兼容层

统一公众号原子产品可显式初始化 `UnifiedProductionLifecycle@1.0` 控制状态。初始化只追加
authority、content、visual 三个基线 revision，不改写原子 Commit；正文小改只失效 content 与
delivery，视觉修改失效 visual 与 delivery，上游修改失效全部四层。修改要求先保存为不可变
`UnifiedProductionRevisionRequest@1.0`，在对应执行器真正产出新版本前保持
`awaiting_execution`，不得把请求描述成已经修改完成。

当前视觉 revision 确定性投影为 `UnifiedWechatPromptPlan@1.0`。费用合同只声明用户批准的
credits 上限；没有 Provider 报价时保持 `upper_bound_only`，不得伪造预计费用。人工批准同时
绑定 visual revision、prompt plan 和 cost plan 的精确 hash；visual 或 authority revision 变化后
旧批准自动 stale。生产控制已初始化的项目在批准缺失、有待执行修订或存在未知 effect 时，
服务端拒绝新的 preupload Artifact。尚未初始化的历史项目继续走原有只读/重放兼容路径，避免
原地迁移或改写历史 Artifact。

局部修订由 `UnifiedWechatRevisionExecution@1.0` 承接。正文修订必须提交并重新校验完整
`WechatArticle@2.0`；视觉修订只接受现有 `generated_raster` slot 的精确 Prompt 替换。两类执行
都追加新的 article/image-plan component 与版本引用，原 Commit、旧 Artifact、Review、Selection
保持不可变，并因候选引用不再是 current 而自动 stale。上游修订不允许在该局部执行器中完成，
必须创建新的上游 Run。当前 authority resolver 通过兼容 overlay 向预上传、Artifact Review 和
User Selection 暴露最新已完成版本；未执行的请求继续关闭 preupload gate。修订执行本身的
Provider 与平台调用计数固定为 0。

新增集合采用 lazy initialization：旧 store 无需回填即可读取；首次初始化或批准时才追加
`unifiedProductionRevisions`、`unifiedProductionRevisionRequests`、`unifiedWechatPromptPlans`、
`unifiedWechatCostPlans`、`unifiedPromptCostApprovals` 和 `unifiedWechatRevisionExecutions`。回退时可撤销生产控制路由与 UI；已写入
事实保留为只读审计数据，不删除、不降级为发布或平台效果。该控制层不调用 Provider、微信上传、
草稿或发布接口。

### 7.2 公众号 Materialize、Artifact Review 与精确 Selection UI

公众号生产入口的 `resume` 由服务端在同一受控 staged bootstrap 中完成正文、正文审阅和视觉计划
Materialize；浏览器不再发起第二次重复 materialize。生成 preupload Artifact 后，公众号页面必须依次
调用专用 `human-review-state`、`preupload-artifact-review`、`editorial-reviews` 和
`human-selections` 路由，不得回落到通用 Artifact Review/Content Review/Selection 写路径。

每个人工请求从当前专用投影绑定 `commitRef`、`materializedContentProjectRef`、`articleRef`、
`artifactStateHash` 和 `artifactAuthoritySetHash`；最终 Selection 还绑定当前 Artifact Review 与
服务端派生 Editorial Review。页面确认框同时列出文章和逐资源引用，因此 `selected` 只表示
`local ready-for-upload`，不授予上传、草稿或平台发布权限。产品策略 v5.0 另行开放本地人工发布/反馈
事实记录，这些记录仍要求精确版本与人工证据，不等于执行平台 API。网络响应未知时浏览器保留同一
请求载荷、时间与幂等键，先刷新对账，不创建新请求。

该专用 UI 只有在 production、artifact、atomic product、atomic WeChat product、atomic WeChat
artifact 和 atomic WeChat human selection 六个 Feature Flag 同时开启时才开放。关闭任一 Flag 即
禁用公众号人工动作；既有专用 Review/Selection 事实保持只读，XHS 通用审阅路径不受影响。回退可
撤销前端专用分支并关闭 human-selection Flag，不删除或改写任何历史事实。

### 7.3 公众号受控资源上传

当前本地产品策略默认关闭上传与草稿，以下说明已有代码能力，不代表已授权或完成真实调用。
历史 `WECHAT_40164` 及 IP 白名单未确认的边界仍有效。

服务器生产依赖现已将不可变上传执行器接到本地资产读取器和微信图片上传 transport。读取器只允许
访问 `data/wechat-live-assets/<contentProjectId>`，读取前解析规范路径，并把精确字节与图片 MIME
类型一并交给执行器。执行器向 transport 传递精确项目、账号、相对路径、哈希和 MIME；封面使用
永久素材接口，正文图片使用 `uploadimg`，持久化证据只接受 `mediaId` 或微信 HTTPS 图片地址。

浏览器仅在 Atomic WeChat 全部前置 Flag 与
`UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1` 同时开启时显示该入口。交互顺序固定为：
刷新 `delivery-state` 对账、零写入计划预览、用户批准精确计划、执行。网络响应未知时冻结新上传请求，
要求先按相同范围对账；部分成功会保留逐项 attempt，系统不自动重试。

资源上传的固定语义是 `wechat_resources_uploaded_content_not_published`：不会创建公众号草稿，也不会
发布文章。历史 `WECHAT_40164` 白名单失败仍是 live 前置条件，本次接线不授权真实重试。回退方式是关闭
上传 Feature Flag；新动作随即隐藏并被服务端拒绝，已有 plan、attempt 和 evidence 事实保持不变。

## 8. 既有架构调整记录（历史）

1. **合同内核去除反向依赖**：确定性内容哈希迁入 `contracts/content-hash.mjs`；
   `content-agent/unified-content-contracts.mjs` 保留原导出，因此下游调用方无需迁移。
2. **建立可执行边界检查**：新增架构检查，阻止合同层依赖领域/交付层，也阻止策略与内容领域直接耦合。
3. **源码检查改为自动发现**：正式源码检查覆盖顶层入口、`contracts/`、`http/`、`ui/`、领域、Provider
   和维护脚本，不再依赖 `package.json` 中容易过期的长文件清单。
4. **统一验证入口**：`check` 同时执行语法与架构检查；`test:product`、`test:refactor` 在回归前统一走
   `check`，避免不同测试入口使用不同的源码基线。
5. **补全目录所有权**：项目结构文档补入 HTTP、UI、图片 Provider 和 live script 的明确职责，并规定
   组合入口不再新增领域规则。

该次调整没有修改 URL、对象 ID、schemaVersion、数据库结构、状态机、Feature Flag 默认值或外部调用预算。
兼容方式是保留 `hashUnifiedContent` 的原导出；回退时可撤销新的边界检查和哈希导入位置，不需要迁移数据，
历史哈希值保持不变。

## 9. 当前本地运行边界

Node.js 原生 HTTP 只监听 `127.0.0.1`，默认端口 4273；前端是原生 JavaScript/CSS，没有独立构建工具链。
普通回归使用 Node 24.18.0 和 `test:offline` 的临时源码副本、纯合成空 seed 与隔离数据；`start:product:offline` 只跳过模型预检，
后续 UI 动作仍可能访问外部服务。系统未提供生产 Docker/Compose、多租户登录/RBAC 或公网部署方案。

`storage.mjs` 用 SQLite WAL 保存 app_state JSON 及错误记录；领域模块另有 SQL 表和增量列迁移。
进程内 mutationQueue 不提供多实例并发控制，轮询/日历模型不提供持久任务队列或平台 webhook。
迁移、备份及外置资产恢复需要整体核对，FLOWSOCIAL_DATA_DIR 不会自动迁移全部本地 artifacts/config。

当前本地策略 v5.0 开放人工发布事实、精确反馈事实和生命周期 UI，关闭平台发布、公众号资源上传与草稿。
受控付费链仍要求不可变计划、人工批准、调用/费用上限和未知效果对账。图片初次生成/regenerate 为
`gpt-image-2-text-to-image`，image_edit 为 `seedream/4.5-edit`；模型实际可用性未由离线回归证明。

静态 GET/HEAD 仅允许 11 个精确浏览器资源；其他文件、路径穿越和符号链接失败关闭。旧图片生成、
content-tasks 素材生成/单页重试/修订的付费接口在解析请求和读取状态前返回 410。现有主链 Provider
执行和 light revision 保留精确权威、人工审批、预算及未知效果对账；标题/正文/上游变更走不可变后继内容。
兼容、下游迁移和保留默认拒绝的回退见 `apps/flowsocial/docs/migrations/http-static-and-image-boundaries.md`，
代表性测试与完整回归结果见 PROGRESS。
这不替代认证/RBAC、Origin/CORS 和跨租户隔离设计；本地健康或全绿离线测试不能证明公网就绪。
