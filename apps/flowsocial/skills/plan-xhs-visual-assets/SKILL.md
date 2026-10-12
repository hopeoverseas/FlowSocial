---
name: plan-xhs-visual-assets
description: Preserve compatibility between the atomic Xiaohongshu content package and the integrated full-page design workflow. In the current integrated-page chain this deterministic Skill emits no independent image prompts; design-xhs-integrated-pages is the sole authority for VI-bound full-page prompts. Historical no-text asset plans remain read-only compatible.
---

# Bridge XHS content into integrated full-page design

Treat all page text, claims, authority references, Design DNA, and asset authorization as immutable input. In the active integrated-page production chain this Skill is a deterministic compatibility bridge, not a second visual director.

## Current integrated-page mode

- Emit one `pageVisuals` and `pageAssetBindings` item per carousel page.
- Use `renderStrategy=html_css` only as a compatibility marker for the atomic package contract.
- Emit `imageSpecs=[]`; do not author no-text background prompts.
- Put every page in `skippedPages` with `reason=html_css`.
- Do not call a text or image Provider.
- Do not choose a Style Pack, page archetype, Pattern, composition, palette, typography, or image direction. Those decisions belong only to `design-xhs-integrated-pages`.
- Preserve historical `XhsVisualAssetPlan@1.0` records read-only; never rewrite them into the new mode.

## Required reference

Read [references/contract.md](references/contract.md) completely before producing output. It defines the exact input and creative-output keys, coverage rules, and system-owned assembly boundary.

## Historical compatibility

The detailed no-text ImageSpec shape in [references/contract.md](references/contract.md) remains valid only for reading and validating historical records. New integrated-page production must follow the current mode above.

1. Verify the input binds the exact carousel, page text, confirmed Design DNA snapshot/ref, and authorized references.
2. Preserve every page number and text layer. Do not rewrite, add, remove, summarize, translate, or correct page text.
3. Emit only the deterministic compatibility projection described above.
4. Allow `design-xhs-integrated-pages` to compile the only production Prompt Set from frozen text and confirmed Design DNA.
7. Use only reference asset IDs present in `authorizedReferenceAssets`. A reference can guide a generated spec but cannot provide facts or page text.
8. Recheck the exact-key inventories, page coverage, unique page/spec/asset IDs, no-text policy, fixed size, and Design DNA constraints before returning JSON.

## Boundaries

- Never create a competing Prompt, visual direction, or Design DNA interpretation.
- Never downgrade the integrated full-page workflow to HTML/CSS rendering; `html_css` here is only a legacy contract marker consumed before the dedicated design stage.
- Never claim Provider execution, image generation, rendering, selection, delivery, or publication.

## System-owned boundary

Return only `XhsVisualAssetPlanCreativeOutput@1.0`. Do not output component IDs, authority bindings, component hashes, Design DNA versions inside ImageSpecs, traceability, preflight results, user-selection state, Provider/model/cost, generated URLs, file paths, or publication state.

After validation, deterministic system code may add the verified authority binding, component ID/hash, carousel ref, confirmed Design DNA version, and exact authorized reference refs to create `XhsVisualAssetPlan@1.0`. This Skill must never synthesize or override those fields.

## Failure behavior

Return `needs_review` or `blocked` with safe reasons when input truth, Design DNA confirmation, authorization, or exact coverage cannot be satisfied. Do not repair malformed authority, silently drop pages, invent assets, call another Skill, invoke a Provider, access the network, read credentials, write a database, generate/edit images, or render output.

## Output

Return the exact JSON envelope from [references/contract.md](references/contract.md), with no Markdown or commentary.

The Provider Gateway checks only the canonical envelope and exact nested shape. Runtime retains page coverage, strategy/spec consistency, authorized-reference, Design DNA, no-text, and component authority Gates; structural acceptance never authorizes assets or repairs content.
