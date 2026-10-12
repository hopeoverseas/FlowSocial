---
name: analyze-viral-content
description: Analyze one or more high-performing reference posts and produce an evidence-bounded ViralContentAnalysis plus a reviewable content blueprint candidate. Use when users ask to 拆解爆款、分析对标内容、比较多篇高赞收藏文章、总结爆款结构规律、提炼标题/开头/正文/视觉/互动机制，或把新投喂的案例沉淀为内容学习候选。 Do not use it to write the final new post; use platform writing skills only after a blueprint has been reviewed and snapshotted.
---

# Analyze Viral Content

## Purpose

Extract reusable content mechanics without copying source facts, wording, cases, identity, or visual assets. Treat performance as an observation, not proof of causality.

Read [references/contract.md](references/contract.md) before producing the result.

Read exactly one platform guide when applicable:

- Xiaohongshu: [references/xiaohongshu.md](references/xiaohongshu.md)
- WeChat Official Account: [references/wechat.md](references/wechat.md)

## Inputs

Accept either:

- `single_post`: one complete post with platform, title, body/transcript, optional images, visible metrics, comments, author/account context, and publication time.
- `batch_compare`: 3–10 comparable posts, preferably from the same platform, content category, time range, and audience.

If a link cannot be read, request pasted text, screenshots, or an exported file. Never invent missing source content or hidden metrics.

## Workflow

1. Normalize the source evidence. Separate observed fields, user-provided metadata, and missing fields.
2. Judge sample quality. Distinguish `verified_high_performer`, `high_quality_reference`, and `unknown`; note why.
3. Analyze each layer: audience need, title/cover, opening hook, information path, evidence mechanism, visual role, interaction/conversion, account influence, and target-account fit. Use the selected platform guide for platform-native fields.
4. For a single post, output hypotheses with low confidence and alternative explanations. For a batch, compare repeated and divergent mechanisms.
   - Compare only within the same platform, format, content function, and broadly comparable audience unless explicitly marking the mismatch.
   - Call a mechanism recurring only when it appears in at least two samples; reserve stable-commonality language for at least three samples from at least two independent authors.
   - Record one-off mechanisms separately. Do not force them into the shared blueprint.
5. Separate reusable mechanics from non-transferable account assets and facts.
6. Identify one primary `creativeMechanism`; keep content purpose and content function separate from it.
7. Propose a blueprint candidate. Keep its lifecycle at `candidate`, `productionReady: false`, and require human review. Record applicable subject types, account modes, matrix roles, and platform mechanics.
8. List fact risks, copyright/identity risks, prohibited uses, and what additional evidence would improve confidence.

## Boundaries

- Do not generate the final article, post, script, or image copy.
- Do not claim that one element caused performance.
- Do not treat source claims, cases, numbers, testimonials, or comments as the user's facts.
- Do not copy distinctive wording, narrative details, screenshots, people, images, or layouts.
- Do not write to a database or activate a blueprint. Return a candidate for the product review workflow.
- Do not modify this or another Skill from newly ingested examples. Only a validated blueprint with sufficient publication feedback may become a separately reviewed runtime pattern pack.
- Do not modify account strategy. Strategy-relevant observations may only be emitted as read-only candidates with evidence references.

## Output

Return exactly one `ViralContentAnalysis@1.0` object following the referenced contract. Put uncertain claims in `successHypotheses`, not `observations`. Preserve source reference IDs in every derived candidate.
