---
name: plan-xhs-carousel
description: Plan a 6–10 page Xiaohongshu carousel narrative from an approved XhsPostCopy@1.0, immutable XhsFinalTitleBinding@1.0, confirmed outline, shared ContentMaster, platform brief, and confirmed Design DNA. Use when a verified post needs page sequencing, a title-bound cover, concise text layers, outline bindings, and authorized claim or knowledge references before visual-asset planning; do not use for selecting or rewriting titles, writing the post, planning images, compiling traceability or preflight, rendering, delivery, or publication.
---

# Plan Xiaohongshu Carousel

Create only the creative portion of a carousel plan. Preserve the approved post and upstream authority; organize them into a concise, continuous page narrative.

The default Provider output uses `data.section_drafts`. Never return `data.pages` or a `data.deck` wrapper; Runtime owns page mechanics.

## Workflow

1. Read [references/contract.md](references/contract.md) completely before producing output.
2. Verify the input contains an approved `XhsPostCopy@1.0`, system-created `XhsFinalTitleBinding@1.0`, confirmed outline, shared ContentMaster, Xiaohongshu platform brief, and confirmed Design DNA reference and snapshot. The title binding must reference the exact PostCopy ID/hash and verified title-output ID/hash. Stop if any binding is missing, stale, hash-mismatched, or ambiguous. Never use a WeChat article as the master.
3. Create exactly one creative page for each confirmed outline section, preserving array order and page count. Use 6–10 pages; do not add filler pages. Do not echo page numbers, outline IDs, outline roles, page roles, or canvas: the Runtime derives them from the confirmed outline and fixed contract rules.
4. Make each page carry one distinct objective and takeaway. Keep text layers concise and use only claims and knowledge assets authorized by the ContentMaster. All reader-visible structural labels must be natural Simplified Chinese. Never emit internal role markers such as `HOOK`, `JUDGE`, `METHOD 1/4`, `ACTION`, `cover`, `problem`, `method` or `cta` inside `text_layers[].text`.
5. Copy the cover canonical headline exactly from `XhsFinalTitleBinding.title`. Recheck exact root, success-data, creative-page, and text-layer keys; page-count parity with the confirmed outline; unique takeaways and full-page text; and cover-title consistency.
6. Output only `XhsCarouselPlanCreativeOutput@1.0` JSON. Do not add Markdown.

## Ownership Boundary

- Own only deck metadata, reading arc, the ordered creative-page array, objective, takeaway, text layers, layout hint, and authorized fact, interpretation, and knowledge references.
- The Runtime owns fixed canvas, page numbers, outline section IDs, outline roles, and page roles. Preserve one creative page per confirmed outline section in the same array order, but never emit those mechanical identity fields.
- The final-title binding is read-only system authority. Do not select a title candidate, change the balanced selection, rewrite the title, or fall back to `recommendedTitle`; do not write or rewrite opening, body sections, ending, pinned comment, hashtags, CTA, or any full-post copy.
- Do not output visual need, visual function, render strategy, assets, image specifications, prompts, traceability, page-claim maps, preflight results, gates, previews, or rendered pages.
- Do not output component IDs, authority bindings, component references, Design DNA version, hashes, timestamps, Invocation facts, selection, Promotion, delivery, or publication state. The system owns those fields.
- Do not call another Skill, Provider, image service, network API, database, renderer, or publisher.

## Failure Behavior

Use exactly one status: `success`, `needs_review`, or `blocked`. A non-success output must carry `data:null` and a non-empty `blocked_reasons` array; it is not assembly-eligible and must never be repaired into success. A missing or stale final-title binding is non-success, never permission to use the preliminary title. Never invent missing authority, repair upstream content, add default assets, or self-report trace/preflight success.

## Gateway Boundary

The Provider Gateway validates `XhsCarouselPlanCreativeOutput@1.0` before invocation and rejects Runtime-owned mechanical keys. Historical page-shaped snapshots are compatibility inputs only; the Runtime projects them to the compiled plan and never sends them back to the Provider.
