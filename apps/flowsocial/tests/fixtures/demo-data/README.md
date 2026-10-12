# 大卖数智 Agent Demo 最小数据包

本目录同时保留空白模板和一套可运行演示的数据。演示数据用于验证：

```text
Agent 诊断
→ StrategySnapshot
→ 领域监测方向
→ 热点与选题
→ 小红书 / 微信公众号内容
```

## 可直接使用的文件

| 文件 | 用途 | 当前状态 |
|---|---|---|
| `business-profile.md` | 企业、服务和转化资料 | 已填入用户确认事实 |
| `audience-profile.md` | 目标受众与问题 | 部分为策略假设，需业务确认 |
| `account-goal-and-strategy.md` | 双平台账号目标与内容策略 | Demo 假设 |
| `diagnostic-cases.jsonl` | 训练/测试 Agent 如何追问 | 可用于 Demo |
| `gold-diagnostic-conversation.md` | 一段标准诊断对话 | 可用于 Demo |
| `expected-strategy-snapshot.json` | 预期策略快照 | 可导入或用于回归测试 |
| `monitoring-directions.json` | 领域方向和搜索词组 | 可驱动热点搜索 |
| `reference-accounts.json` | 参考账号入口 | 暂无真实账号，等待补充 |
| `reference-posts.jsonl` | 爆款拆解样例 | 仅含合成样例，不作为真实证据 |
| `content-patterns.json` | 可迁移的内容结构 | 可用于内容生成 |
| `knowledge-facts.jsonl` | 轻量知识库事实 | 仅包含已确认信息 |
| `evaluation-cases.jsonl` | Agent 行为评测 | 可用于回归测试 |

## 数据可信度约定

- `confirmed`：来自用户本次明确提供的信息，可作为事实使用。
- `hypothesis`：为了跑通 Demo 提出的策略假设，进入正式生产前必须确认。
- `synthetic_demo`：合成的演示素材，只验证流程，不得描述为真实案例或真实爆款。
- `unknown`：暂无资料，模型必须询问或留空，不得补写。

## 下一批最值得补充的真实资料

1. 1–3 个可公开客户案例，以及可公开的前后变化或交付成果。
2. 标准咨询和成交路径、服务周期、报价方式。
3. 两个平台的账号现状、历史内容和数据。
4. 5–10 篇认可的同行或跨行业参考内容链接。
5. 产品介绍、交付 SOP、常见异议和销售问答原文。
