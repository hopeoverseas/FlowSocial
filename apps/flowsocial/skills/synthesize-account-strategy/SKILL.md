---
name: synthesize-account-strategy
description: 综合 StrategyInputBundle 中已确认的策略骨架、动态事实、定向检索的知识证据、历史候选、表现信号和参考模式，生成可追溯、可审核、面向未来30—90天的 StrategyDocument@2.0 兼容草案及 strategyExtensions。用于诊断信息达到草案门槛后、用户审核与激活之前；不激活策略、不生成具体发布日历、热点、选题或正文。
---

# 生成账号策略文档

## 输入

完整读取 `StrategyInputBundle@1.0`。区分：

- `account` 与运行时归属：本草案只能服务当前 `workspaceId/companyId`，不得混入其他公司的策略、知识或历史内容；

- `coreClaims`：用户已确认的九项骨架结论；
- `dynamicFacts.strategy/platform/risk`：会影响长期策略、平台或风险边界的事实；
- `dynamicFacts.topic/content_only`：可帮助理解内容，但不得擅自升级为长期策略事实；
- `knowledgeEvidence`：用户已确认的资料提取结果；
- `knowledgeEvidenceRequest` 与 `retrievedKnowledgeEvidence`：围绕策略缺口定向检索的支持证据，只能补证、发现缺口或形成冲突，不能覆盖本轮对话结论；
- `historicalContext`：仅作候选参考，不得覆盖本轮结论；
- `inferredClaims`：只能进入假设；
- `conflicts`：不得自行裁决；
- `performanceSignals` 和 `referencePatterns`：只形成策略建议，不表述为平台因果规律。
- `strategyDecisions`：经过 `select-growth-playbook` 与方法库约束的账号组合、账号身份、增长打法、热点政策、观察指标和退出条件；只能在这些候选范围内组织策略，不能自行创造平台规律。

## 工作流程

1. 先总结业务目标、受众、产品服务、转化链路和账号阶段。
2. 给出真正的策略判断：核心机会、主要限制、优先选择和暂不优先方向。
3. 区分公司共享策略、账号组合和单账号策略。确认单账号还是角色协同矩阵，并保留每个账号的身份、信任来源、矩阵角色与平台模式。
4. 从 `strategyDecisions` 继承各账号选择的增长方法：垂直专业、热点桥接混合、受控热点实验、公众号关系/IP、搜索资产或稳定经营。保留适用条件、风险、实验窗口和退出条件。
5. 定义 `discovery / authority / proof / solution / action` 五类内容职能。兼容比例总和必须为100；同时在 `strategyExtensions.contentFunctionPolicy` 中给出目标区间、判断依据和复盘周期。
6. 分别定义小红书与公众号的平台角色、优先受众、目标、语气默认值和边界；不复制平台写作 Skill 的卡片、篇幅或排版规则。
7. 定义完整业务转化系统，并在 `strategyExtensions.conversionLadder` 中拆成轻互动、内容承接、线索获取和商业推进；单篇内容只应选择一个主要阶段。
8. 输出内容目的适用范围、运营能力边界、平台承接设施和知识证据计划；这些是长期指导，不是具体发文日历。
9. 所有推断写入 `governance.hypotheses`，所有冲突写入 `governance.conflicts`，所有缺口写入 `governance.missingInformation`。
10. 保留输入中的 Claim、Fact、Knowledge ID 和 `sourceContextHash`。
11. 为每条动态事实给出明确的 `governance.factApplications`，不得只保存 ID 却不参与策略判断。
12. 输出是待审核草案；只返回含兼容扩展的 `StrategyDocument@2.0` JSON。

## 边界

- 不编造产品、案例、客户、数据、团队经历或业绩。
- 不承诺涨粉、阅读、线索或收入结果。
- 不激活策略、不修改事实库、不调用其他 Skill。
- 不生成监控词、热点、选题、大纲、正文、图片或发布计划。
- 不替用户决定单篇内容目的和推广强度。
- 不推荐完全无关热点、自动删除历史内容、刷量、伪装素人或矩阵批量重复发布。

执行前完整读取 [references/contract.md](references/contract.md)。
