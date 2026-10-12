# FlowSocial 应用

这是仓库唯一正式应用，包含策略诊断、周期规划、平台范围原子内容、人工审阅、精确选择、本地交付和发布/反馈事实。完整接手说明见仓库 [HANDOVER.md](../../docs/HANDOVER.md)，长期架构见[系统架构](../../docs/architecture/system-architecture.md)。

## 启动与测试

推荐 Node.js **24.18.0**，包声明最低 `22.5.0`；在本目录执行：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:offline
npm run start:product:offline
```

Windows PowerShell 使用 `npm.cmd` / `npx.cmd`。工作台地址为 `http://127.0.0.1:4273/`，健康接口为 `/api/v1/health`。`start:product:offline` 只跳过启动付费模型预检，不会阻止页面后续访问外部服务。`test:offline` 才是隔离存储并阻断外网的回归入口。原 `test:product` 不应直接用于活动工作区。

`npm start` 与 `start:product` 都装配同一产品策略并进行真实模型预检；使用前确认授权和预算。`start:offline` 直接启动 server，不能替代产品开关入口。启动器可能停止占用同端口的旧 FlowSocial；不要用活动实例做接手测试。完整产品回归包含浏览器渲染，应在测试前运行 `npx --no-install playwright install --with-deps chromium`；安装需要网络，与离线测试分开执行。

当前没有独立 build/lint 命令。2026-10-12 Node 24.18.0 的 `test:offline` 退出 0，218 个正式源文件/架构检查、独立外网 guard 自测及 45/45 产品测试通过。范围与云端 CI 实测状态见 [PROGRESS.md](../../docs/PROGRESS.md)，真实业务验收仍依[输入清单](../../docs/operations/business-acceptance.md)另行确认；本地通过不等于云端 CI 或真实平台通过。

## 运行与数据边界

| 对象 | 位置与约束 |
| --- | --- |
| 应用入口 | 原生 Node HTTP + 原生 JS/CSS；监听 `127.0.0.1:4273` |
| 业务数据 | 默认 `data/flowsocial.db`；`FLOWSOCIAL_DATA_DIR` 可指定绝对路径 |
| 公开空种子 | `defaults/store.json`；本机 `data/` 全部忽略，不恢复原机器业务历史 |
| Skills / Contracts | 本目录 `skills/` / `contracts/`，各自仅有一套源 |
| 本机配置 | `.env.local` 和本地平台集成配置；不读出、不回显、不提交密钥 |
| 运行产物 | `artifacts/`、上传、知识文件及图片目录；不提交 Git |

`FLOWSOCIAL_DATA_DIR` 控制数据库和部分资产目录，不会自动迁移全部 artifacts 或本地配置。业务数据交接须另行授权并走私有渠道，普通测试只使用合成夹具与隔离数据副本。

## 主链与产品策略

新内容走平台范围 staged atomic：冻结账号/策略/来源 → 目标平台大纲及人工确认 → 正文与视觉 → 不可变版本 → 人工审阅/选择 → 本地包 → 人工发布事实 → 精确反馈 → 下一周期。小红书与公众号的大纲、正文和页面版本互相隔离。

`product-capability-policy.mjs` v5.0 的 local-package 模式开放：

- 本地统一生产、双平台原子内容、公众号本地物化及人工选择；
- 本地人工发布记录、精确反馈记录和发布生命周期 UI，这些记录须有精确引用与人工证据；
- 受控小红书图片计划、人工批准、执行及单页轻结构改单，付费动作要求调用/credits 上限，自动重试固定为 0。

真实平台发布、公众号资源上传和公众号草稿默认关闭。上述本地记录不会自动调用平台。已有公众号图文包只是本地交付，未上传、草稿、发布或回收微信反馈；历史 `WECHAT_40164` 不得在 IP 白名单独立确认前重试。

旧 `ContentRun` 详情、trace、execution-plan、来源选择、大纲及旧写入接口已退役并返回 `410 / LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED`。旧事实保留，不恢复旧路由或新建旧链写入；参见 [Phase 7 迁移](docs/migrations/2026-08-28-phase-7-content-run-compatibility-removal.md)。

静态入口只开放 11 个明确浏览器资源，不开放 data、源码、上传或交付目录。旧 images/generate 返回 `UNGOVERNED_IMAGE_GENERATION_REMOVED`；旧 assets/generate、visual-candidates/retry 和 revise 返回 `LEGACY_PAID_CONTENT_GENERATION_REMOVED`（均 HTTP 410）。纯文本旧 revise 也确有付费调用，不能作为离线编辑保留。主链替代、下游影响及保留默认拒绝的回退方式见[迁移说明](docs/migrations/http-static-and-image-boundaries.md)。

## 小红书图片与局部修订

初次生成与 `regenerate` 使用 `gpt-image-2-text-to-image`；纯视觉修改使用 `image_edit`，把目标页当前 revision 图片作为参考传给 `seedream/4.5-edit`。计划绑定目标页、基础 revision、锁定文字哈希、精确 Prompt、模型与费用状态；不添加伪坐标或图层。

成功修改追加 `XhsPageArtifactRevisionFact`，历史 revision 保持不变。整套图片使用人工视觉确认：确认只接受当前完整 page revision set，任何后续改单使旧确认 stale。Artifact Review、Selection 和本地交付仍要求当前版本、技术 Gate 和人工确认；未知外部效果进入 reconciliation checkpoint，不自动重试。

兼容与回退：旧 Provider Attempt、revision、视觉审阅事实保留；缺少精确原图时阻断编辑。关闭轻结构改单和人工确认开关可停止新动作，但不能直接放行旧视觉路径；重新启用旧路径需独立审查其开关、版本与审批合同。回退不删除图片、不改历史选择、不触发 Provider 或平台调用。

## 配置与排障

代码文本缺省为 DeepSeek / `deepseek-chat` / OpenAI 兼容协议；`.env.example` 是 MiniMax / Anthropic 兼容模板。两者是不同配置来源，实际模型看本地设置与健康接口的非敏感摘要。图片缺省为 `gpt-image-2-text-to-image`，RedFox 为关键词来源搜索。

本机配置由操作者自行填写，普通回归不读取 `.env.local`、平台授权、Cookie 或数据库。`HTTP_401/403` 表示权限或授权需核查，`HTTP_402` 表示余额需核查，超时/网络错误需先查效果是否未知；不能自动换请求重试付费操作。真实连接测试属于 live 验收，只有输入、授权、调用预算和费用预算确认后才能执行。

## 开发规则

遵守根 [AGENTS.md](../../AGENTS.md)。领域规则落到对应模块，路由落到 `http/`、工作台落到 `ui/`；保持唯一应用、Skills 和 Contracts。合同、状态、schema 或外部行为变化必须写兼容/迁移、下游影响、代表性测试和回退说明。长期任务优先级见 [NEXT_STEPS.md](../../docs/NEXT_STEPS.md)。
