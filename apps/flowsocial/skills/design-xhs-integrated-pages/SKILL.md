---
name: design-xhs-integrated-pages
description: 将冻结的 XhsPostPackage@2.0、共享 ContentMaster、平台 run、候选、Design DNA、授权资产与显式视觉选择确定性编译为受治理的小红书整页 Prompt 和 hash 绑定的执行计划。该 stable_conditional Skill 仅在统一计划与默认关闭的 Flag 显式授权后运行；不调用 Provider、不生图、不产生选择或发布状态。
---

# 设计小红书整页图文提示合同

生产调用入口只接受 `DesignXhsIntegratedPagesRuntimeInput@1.0`，其中显式冻结 `XhsPostPackage@2.0`、contentVersion、Design DNA、授权资产、Provider 能力、页面密度和视觉选择。统一产品链还必须由 `visual_design` 严格计划步骤绑定共享 ContentMaster、平台 run 与候选。评测 `{id,input,selection}` 封装只能由离线验证 Adapter 转换，不得直接调用生产入口。

只在冻结内容真值之上做视觉编译。图片模型不得补写事实、数字、产品能力、专有名词或 CTA。

## 执行流程

1. 读取 [contract.md](references/contract.md)，将 `XhsPostPackage@2.0` 只读投影为逐页 `PageContentTruth@1.0`；任何必填字段缺失都返回 blocker，不回写旧包。
2. 按页面任务从 [page-archetypes.json](references/page-archetypes.json) 选择一个 Page Archetype；不得仅因视觉偏好改变页面信息任务。
3. 按 Design DNA 和整套节奏从 [style-packs.json](references/style-packs.json) 选择一个受控原创 Style Pack，并输出 `VisualStyleSelection@1.0`；必须把已确认的精确品牌色号、字体角色、版式、材质、插画方向和禁用元素写入 `constraints`，不得用 Style Pack 的通用默认值覆盖 VI；Prompt Set 自身保持 `productionEligible=false`。
4. 按页面密度和视觉功能从 [prompt-patterns.json](references/prompt-patterns.json) 选择 1–3 个结构型 Pattern。Pattern 只能组织已有真值，不得提供内容。
5. 按 [source-license-governance.md](references/source-license-governance.md) 校验来源、许可证、状态和授权资产。外部资产未达到 `approved` 或许可证不完整时一律阻断生产资格。
6. 为每页输出 `PagePromptSpec@1.0`，再汇总为 `XhsIntegratedPagePromptSet@1.0`。统一使用 `visualStyleSelection`、`pagePromptSpecs`、`sourcePackage`、`crossPageRules`、`visualSelectionGate`、`productionEligible`、`blockers` 和 `trace`；保留真值哈希、资产引用、选择理由、失败模式和确定性回退。
7. 运行 `node scripts/validate-library.mjs`，通过后也只表示确定性合同可用，不表示 Provider、视觉质量或生产链已通过。
8. 需要视觉方向审阅、Prompt 审阅、能力编译或 Registry 治理时，完整读取 [offline-control.md](references/offline-control.md)，保持费用待确认并使用唯一离线 Compiler。
9. 需要创建 Provider 执行计划时，完整读取 [provider-execution.md](references/provider-execution.md)，通过 `scripts/invoke-skill.mjs` 生成 Skill/资产 hash 证据，再创建 `IntegratedPageExecutionPlan@1.0`；不得从 Live 脚本注入独立 Prompt。

## 强制规则

- 原样锁定标题、正文、标签、数字、英文产品名、中文专有名词和 CTA；只允许换行与视觉强调，不允许同义改写。
- 本 Skill 是小红书整页生产唯一的 Prompt 权威；上游兼容步骤不得生成或传入另一套图片 Prompt。
- 外部 Pattern 只可提供抽象结构，不能提供事实、案例、数字、产品能力、原文表达或 CTA。
- 只引用输入中明确授权且许可证 Gate 通过的资产；参考图内容不能成为页面事实。
- 高密度、能力不匹配、真值缺失或授权失败时输出 blocker，并推荐 `deterministic_layout`；不得静默降级。
- 不调用网络、图片 Provider、OCR、数据库或其他 Skill，不产生费用，不读取密钥。
- 不生成或修改图片、HTML、页面版本、Manifest 版本和历史 `VisualDirectionSet`。
- Skill 生命周期为 `stable_conditional`，但 Archetype、Style Pack 和 Pattern 资产仍保持 `experimental`；Prompt Set 只能是 `draft` 或 `blocked`，并固定 `visualSelectionGate.status=pending_user_review`，不得自行批准或模拟用户选择。
- 不选择 Provider、不确认费用、不自动重试、不执行 Mask/锁区、不查询网络资产；Compiler 只生成不可执行的离线合同与 Trace。
- `xhsIntegratedPageDesignSkill` 与 Provider 执行计划 Flag 默认关闭；统一计划未显式授权时不得调用。Provider/model 和费用确认仍必须显式提供，本 Skill 永不执行请求。

## 输出

设计阶段输出符合 [contract.md](references/contract.md) 的 `XhsIntegratedPagePromptSet@1.0`。执行规划阶段额外输出 `IntegratedPageExecutionPlan@1.0` 与独立的 `IntegratedPageEligibilityDecision@1.0`；统一 Adapter 记录 exact plan authorization、Skill bundle/library/input/output/provider-plan hash 和全零调用计数。Adapter 的 `productionEligible=true` 仅表示计划可进入 `HumanProviderExecutionApproval`，不表示图片、Page Revision、用户选择、交付或发布已完成。
