# Production breakpoint recovery

## Compatibility contract

- Existing content projects, page revisions, asset paths, review facts and promotion facts are not rewritten.
- Legacy `AtomicXhsFinalDeliveryRecord@1.0` facts without a `platform` field remain readable when their exact XHS contract and project/run/candidate references match. New records persist `platform: xiaohongshu`.
- XHS preview URLs are a derived HTTP read projection. Stored `relativePath` values remain immutable.
- Historical `design-xhs-integrated-pages` invocations are validated against a frozen definition-bundle registry. Frozen bundles are read-only; only the current definition can create a new invocation.
- `CONTENT_PROMOTION_V1` remains a one-cycle compatibility fallback. New local product configuration uses `LOCAL_CONTENT_PROMOTION_V1` and `LOCAL_PACKAGE_DELIVERY_V1`.
- WeChat local immutable promotion now follows `LOCAL_CONTENT_PROMOTION_V1`; its resource upload, final post-upload delivery and draft routes still require `UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1` and their existing exact approvals.
- The WeChat delivery-state read projection adds backward-compatible `localPackageReady` and `promotedVersionRef` fields so the UI can recover the exact local package after reload without enabling upload.

## Downstream impact

- Frontends must consume the server-projected XHS `previewUrl`; constructing a static path from `relativePath` is deprecated.
- Local promotion and package creation do not authorize resource upload, draft creation, manual publication or platform publication.
- The content-production UI hides publication, feedback and lifecycle forms unless the complete Atomic publication UI flag set is enabled. Existing facts and the separate “发布与复盘” view are unchanged.
- When local package delivery is enabled and platform publishing is disabled, the XHS production projection terminates at `local_delivery_complete` instead of presenting publication as a production blocker.
- The human-only XHS review policy projects `human_visual_confirmation_required` before Artifact review. It does not require or invoke multimodal visual review.

## Rollback

1. Disable `LOCAL_CONTENT_PROMOTION_V1` and `LOCAL_PACKAGE_DELIVERY_V1` to close local version/package actions without changing data.
2. Revert the read projection/UI changes if required; stored asset and historical invocation facts need no migration rollback.
3. Keep `UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1`, `ATOMIC_WECHAT_DRAFT_CREATION_V1`, `ATOMIC_MANUAL_PUBLICATION_V1` and `PLATFORM_PUBLISHING_V1` disabled unless their separate controlled workflows are explicitly approved.

## Verification

- Offline contract tests cover exact XHS preview revision/hash binding, historical invocation validation, human-only review projection, platform task deduplication and zero external calls.
- Browser regression must cover XHS and WeChat independently, reload/restart, and rapid platform/project switching.

## 2026-08-24 visual-copy and delivery simplification

### Compatibility

- Existing XHS images, prompt facts, page revisions, human confirmations and version tags are immutable and are not regenerated. The production-safe VI projection applies only to newly compiled Provider plans.
- Existing text-only WeChat packages remain readable and are labelled as historical packages without illustrations. New staged WeChat materializations create one deterministic local cover and up to three inline information cards.
- `html_chart` is now treated as an original deterministic article derivative. `authorized_asset` retains its registry, source and licence checks; `generated_raster` retains its Provider-attempt evidence checks.
- The one-button UI does not remove review, selection or promotion facts. It invokes the existing exact-reference APIs in order and keeps every stored state transition append-only.
- A newly materialized dual-platform run gives both commits the same revision-scoped content-project identity. Completed bootstrap replay follows that persisted revision identity; legacy completed records whose product id equals the logical project id remain valid.

### Downstream impact

- XHS Provider prompts keep palette and production typography guidance but drop VI-manual page headers, footers, directory labels, measurements, bilingual examples and logo placeholder copy.
- New XHS prompts require visible copy to come only from the per-page verbatim truth. An uploaded VI file no longer authorizes its manual examples as content copy.
- New WeChat pre-upload previews include local PNG resources. Upload and publication flags remain disabled; local illustration generation makes zero external Provider and platform calls.
- The customer UI exposes one “确认当前版本并生成内容包” action. Internal IDs, hashes and recovery operations remain available under “高级详情”.

### Rollback

1. Revert `wechat-local-illustration-runtime.mjs`, restore the former `no_image` staged adapter and text-only formatter; existing illustrated facts remain immutable historical data.
2. Revert the production VI constraint filter to restore the prior prompt projection. Do not mutate or reuse already-approved prompt facts; create a new plan version after rollback.
3. Revert only the UI orchestration to expose the individual review/selection/promotion controls again. Stored facts require no data migration.
4. If the revision identity change is rolled back, restore the legacy project id in both platform materializers together. Rolling back only one side recreates an orphan WeChat commit and a 409 during resume.

## 2026-08-24 XHS pre-generation review projection

### Compatibility

- `UnifiedXhsProductionState@1.0` adds an optional `preGenerationReview` read projection. Existing consumers may ignore it; no stored candidate, outline, prompt set, Provider plan, page revision or approval fact is changed.
- Historical English metadata such as a confirmed `contentPromise` remains immutable and is intentionally not surfaced as publishable copy. The review projection exposes the persisted title, opening, body, ending, hashtags, carousel text and safe prompt blocks.
- The outline Skill now explicitly requests Simplified Chinese for all user-visible fields. This changes only future Provider output; historical confirmed outlines are not translated or re-signed.

### Downstream impact

- The XHS UI can show publishable copy and page text before any image exists, and can show per-page required text, composition, style and exclusions after local prompt compilation.
- The existing approval sequence is unchanged: prompt/direction confirmation creates the Provider plan, cost approval authorizes the exact call budget, and image execution remains a separate user action.
- Provider request bodies, authority hashes and raw VI extraction remain in internal facts and are not exposed in the ordinary review UI.

### Rollback

1. Remove the `preGenerationReview` projection and its UI cards; existing production facts remain valid and require no data rollback.
2. Revert the added Simplified-Chinese Skill instruction to restore the previous prompt wording. Do not rewrite already-confirmed outline facts.

## 2026-08-24 VI and creative-responsibility boundary

### Compatibility

- Existing prompt sets, approved Provider plans, generated images, page revisions and delivery records remain immutable. The new projection applies only when a new XHS design invocation and Provider plan are created.
- The internal `editorial-metaphor` style ID is preserved so stored references and direction candidates remain readable. Its customer-facing meaning becomes “内容自适应（推荐）”.
- `XhsIntegratedPagePromptSet@1.0` keeps the same schema. For new invocations, `visualStyleSelection.constraints` contains at most one `品牌色锚点：#RRGGBB` item; no database migration is required.

### Downstream impact

- Uploaded VI files remain useful for account identity, but only the first valid confirmed hexadecimal colour is projected into new image prompts. VI typography, layout, materials, photography/illustration examples, headers, footers and manual motifs no longer constrain page creation.
- The brand colour is described as a small identity accent, never as a mandatory background or complete palette. The remaining palette, medium, materials, composition and first-page expression are chosen from the current content.
- The first page receives a cover function—clear topic and motivation to continue—but no fixed title proportion, picture type, material, palette or template. Its semantic content role is not rewritten.
- The ordinary UI adds customer-safe explanations for “品牌色怎么用”, “本次创意原则” and each page's “本页创意概念”. Provider bodies, hashes and raw VI extraction remain hidden.
- New prompt and plan hashes will differ. The existing prompt/direction and cost confirmations still bind the exact new plan; no additional human gate is introduced.

### Rollback

1. Revert the current Skill library, compiler projection, Provider prompt projection and UI labels together. Do not mutate any prompt set or plan already approved under this boundary.
2. If a newly compiled plan must be abandoned after rollback, create a new design invocation and reconfirm its exact direction and cost budget. Historical plans remain readable and must not be reused with altered prompts.

## 2026-08-24 XHS presentation-marker recovery

### Compatibility

- Stored carousel plans and existing design prompt sets remain immutable. When a new Provider plan is projected, narrowly recognized presentation prefixes (`HOOK`, `JUDGE`, `METHOD n/n`, `ACTION`) are removed or converted to a Chinese step label before reaching the image Provider.
- Approved content terms such as `AI`, `SaaS` and `SOP` remain verbatim. No facts, claims, titles, body copy or CTA text are rewritten.
- Future carousel creative drafts receive the same deterministic normalization before the component hash is created, and the Skill contract explicitly forbids internal routing markers in reader-visible layers.

### Downstream impact

- A candidate previously blocked by `PROVIDER_PROMPT_ASCII_TOKEN_NOT_ALLOWLISTED:HOOK` can create a fresh Provider plan without regenerating or mutating its approved article.
- The pre-generation review displays the exact normalized text that will be sent to the image Provider, rather than showing internal English markers that are absent from the Provider request.
- Prompt and plan hashes remain bound to their exact projections. Cost approval and paid execution are still separate human decisions.

### Rollback

1. Revert the narrow presentation-marker normalizer and ASCII content-term allowlist together.
2. Existing Provider plans created with normalized Chinese labels remain immutable. After rollback, abandon rather than mutate them and create a new plan only after resolving any reintroduced ASCII blocker.
