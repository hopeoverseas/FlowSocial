---
name: generate-keyword-topics
description: 从已聚合的关键词热点事件簇生成平台中立、可追溯的领域母选题。用于关键词热点选题分支；不处理无关键词热点结合、不做主编审核、平台标题或正文。
---

# 生成关键词母选题

围绕目标关键词、账号定位和受众问题，把关键词事件转化为“值得现在写”的母选题，而不是改写热点标题。

## 输入要求

要求输入包含 `target_keyword`、`account_strategy`、`content_goal`、`topic_count`、`keyword_event_clusters[]` 和快照版本。执行前读取 [contract.md](references/contract.md)。

## 工作流

1. 过滤不符合账号内容支柱、受众、地区和禁写规则的事件。
2. 从教程、误区、案例、趋势、比较、清单或观点中选择实质不同的角度。
3. 为每个候选明确核心问题、读者价值、为什么现在讲和证据边界。
4. 只用 `confirmed_facts` 支撑确定性主张。
5. 证据不足但方向合理时输出 `needs_research`，并给出待核事实和检索词。
6. 为候选逐维评分；不为满足数量制造弱选题。

## 输出规则

只输出 `KeywordTopicCandidateList@1.0` JSON。每个候选必须引用 `cluster_ids` 和 `evidence_ids`，并说明 `evidence_boundary`。

## 边界

- 不使用无关键词全网热点。
- 不生成小红书或公众号平台子选题。
- 不写标题、正文、大纲、配图或营销话术。
- 不引入输入以外的事实、产品、案例和个人经历。
