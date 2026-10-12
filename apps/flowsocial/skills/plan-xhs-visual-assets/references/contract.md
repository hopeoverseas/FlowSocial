# XhsVisualAssetPlanCreativeOutput@1.0

Gateway structural validation enforces the canonical envelope and exact nested keys. Runtime retains semantic coverage, strategy/spec, reference authorization, Design DNA, and no-text policy Gates; it never repairs a structurally accepted output.

This contract remains the storage and validation shape for `plan-xhs-visual-assets`. In the active integrated-page chain the Skill is a deterministic compatibility bridge: every page uses the `html_css` compatibility marker, `imageSpecs=[]`, every page appears in `skippedPages`, and every binding is empty. Historical outputs using the other branches remain read-only compatible. `design-xhs-integrated-pages` is the sole production Prompt authority.

## Input contract

The caller supplies `PlanXhsVisualAssetsInput@1.0` with exactly these root keys:

`schemaVersion,contract,carouselPlan,confirmedDesignDna,designDnaRef,pageTextTruth,authorizedReferenceAssets`

- `schemaVersion` is `1.0`; `contract` is `PlanXhsVisualAssetsInput@1.0`.
- `carouselPlan` is a previously validated, frozen `XhsCarouselPlan@1.0`.
- `confirmedDesignDna` is the exact confirmed snapshot. Its `id` and deterministic hash match `designDnaRef`, and its version matches `carouselPlan.designDnaVersion` through the caller's deterministic adapter.
- `pageTextTruth` has exactly one item per carousel page, in page order. Each item has exact keys `page,textLayers`; both values equal the corresponding frozen carousel page values.
- `authorizedReferenceAssets` is an array of caller-authorized assets. Each item has exact keys `id,hash,usageSummary,allowedUseCases,mustKeep,mustAvoid`; IDs and hashes are non-empty/valid, and text collections contain only non-empty strings.
- Missing, unconfirmed, stale, mismatched, or caller-injected authority blocks the invocation before Provider execution.

Reference assets may guide visual form only. They never authorize facts, claims, text, logos, trademarks, identities, or publication.

## Output envelope

The envelope has exactly these keys:

`status,data,warnings,blocked_reasons`

- `status`: `success | needs_review | blocked`
- `warnings`: array of non-empty safe strings
- `blocked_reasons`: array of non-empty safe strings
- `success` requires a valid complete `data` object and empty `blocked_reasons`.
- Non-success must not be promoted to a component or repaired by an Adapter.

The `data` object has exactly these keys:

`schemaVersion,contract,pageVisuals,imageSpecs,skippedPages,pageAssetBindings`

- `schemaVersion`: `1.0`
- `contract`: `XhsVisualAssetPlanCreativeOutput@1.0`

## Exact nested keys

`pageVisuals[]` exact keys:

`page,visualFunction,visualNeed,renderStrategy,mustKeep,mustAvoid`

- `page` is the matching positive carousel page number; items cover pages `1..n` exactly once and in order.
- `visualFunction`: `attention | explain | compare | demonstrate | pace | none`
- `visualNeed` is a string; empty is allowed only when the strategy is `no_visual_needed`.
- `renderStrategy`: `html_css | authorized_asset | generated_raster | no_visual_needed`
- `mustKeep` and `mustAvoid` are unique arrays of non-empty strings.

`imageSpecs[]` exact keys:

`plannedAssetId,page,useCase,assetType,scene,subject,styleAndMedium,composition,lighting,palette,materials,textSafeArea,prompt,negativePrompt,referenceAssetIds,size,mustKeep,mustAvoid,textPolicy`

- `plannedAssetId` is unique, non-empty, and deterministic for the page, such as `xhs-<deck>-p03-plan`.
- `page` is unique and points to a `generated_raster` page.
- `useCase`: `illustration-story | photorealistic-natural | stylized-concept | product-context | texture-background`
- `assetType`: `carousel-background | subject-cutout | scene-illustration`
- `scene`, `subject`, `styleAndMedium`, `composition`, `lighting`, `materials`, `textSafeArea`, `prompt`, and `negativePrompt` are non-empty strings.
- `palette`, `referenceAssetIds`, `mustKeep`, and `mustAvoid` are unique arrays of non-empty strings.
- Every `referenceAssetId` occurs in the exact authorized input set.
- `size` is `1024x1536`; `textPolicy` is `no_text_in_image`.
- The negative prompt explicitly excludes text, letters, numbers, watermark, logo, interface screenshot, and illegible symbols.
- ImageSpecs do not contain `designDnaVersion`; deterministic assembly injects the confirmed version into `XhsVisualAssetPlan@1.0`.

`skippedPages[]` exact keys:

`page,reason`

- `reason`: `html_css | authorized_asset | no_visual_needed`
- Every non-generated page occurs exactly once; generated pages never occur.
- The reason exactly equals that page's `renderStrategy`.

`pageAssetBindings[]` exact keys:

`page,plannedAssetIds`

- The array covers every page exactly once and in order.
- A generated page contains exactly the one planned asset ID belonging to its ImageSpec.
- Every non-generated page contains `[]`.
- A planned asset ID cannot be duplicated, dangling, or bound across pages.

## Coverage invariant

For each carousel page, exactly one branch is valid:

```text
generated_raster
  → one ImageSpec
  → one unique plannedAssetId
  → one page binding containing that ID
  → no skipped entry

html_css | authorized_asset | no_visual_needed
  → no ImageSpec
  → one empty page binding
  → one skipped entry whose reason equals renderStrategy
```

`imageSpecs` may be empty when every page is non-generated. Empty arrays remain explicit.

## Valid compact example

This example assumes a verified six-page carousel and one authorized reference asset `REF001`:

```json
{
  "status": "success",
  "data": {
    "schemaVersion": "1.0",
    "contract": "XhsVisualAssetPlanCreativeOutput@1.0",
    "pageVisuals": [
      {"page":1,"visualFunction":"attention","visualNeed":"stable cover hierarchy","renderStrategy":"html_css","mustKeep":[],"mustAvoid":[]},
      {"page":2,"visualFunction":"explain","visualNeed":"structured explanation","renderStrategy":"html_css","mustKeep":[],"mustAvoid":[]},
      {"page":3,"visualFunction":"demonstrate","visualNeed":"one no-text scenario illustration","renderStrategy":"generated_raster","mustKeep":[],"mustAvoid":["text"]},
      {"page":4,"visualFunction":"compare","visualNeed":"deterministic comparison","renderStrategy":"html_css","mustKeep":[],"mustAvoid":[]},
      {"page":5,"visualFunction":"pace","visualNeed":"","renderStrategy":"no_visual_needed","mustKeep":[],"mustAvoid":[]},
      {"page":6,"visualFunction":"explain","visualNeed":"deterministic action summary","renderStrategy":"html_css","mustKeep":[],"mustAvoid":[]}
    ],
    "imageSpecs": [
      {
        "plannedAssetId":"xhs-deck-p03-plan","page":3,"useCase":"stylized-concept","assetType":"scene-illustration",
        "scene":"quiet work setting","subject":"one person organizing neutral cards","styleAndMedium":"restrained editorial illustration",
        "composition":"subject on right with clean center text-safe area","lighting":"soft natural light","palette":["warm white","dark green"],
        "materials":"paper and subtle grain","textSafeArea":"center-left remains empty","prompt":"no-text editorial scene matching the confirmed visual system",
        "negativePrompt":"text, letters, numbers, watermark, logo, interface screenshot, illegible symbols",
        "referenceAssetIds":["REF001"],"size":"1024x1536","mustKeep":["empty text-safe area"],"mustAvoid":["brand logo"],"textPolicy":"no_text_in_image"
      }
    ],
    "skippedPages":[
      {"page":1,"reason":"html_css"},{"page":2,"reason":"html_css"},{"page":4,"reason":"html_css"},
      {"page":5,"reason":"no_visual_needed"},{"page":6,"reason":"html_css"}
    ],
    "pageAssetBindings":[
      {"page":1,"plannedAssetIds":[]},{"page":2,"plannedAssetIds":[]},{"page":3,"plannedAssetIds":["xhs-deck-p03-plan"]},
      {"page":4,"plannedAssetIds":[]},{"page":5,"plannedAssetIds":[]},{"page":6,"plannedAssetIds":[]}
    ]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

## Deterministic assembly boundary

After this creative output passes exact validation, system code—not the Skill or Provider—may:

1. copy the verified authority binding and carousel component ref;
2. inject the verified Design DNA version into each ImageSpec;
3. reduce used reference IDs to exact `{id,hash}` refs from the authorized input;
4. assign the component ID and stable hash; and
5. call `createXhsVisualAssetPlan` to produce immutable `XhsVisualAssetPlan@1.0`.

The Adapter must not rename creative fields, coerce types, invent missing values, repair coverage, or convert a non-success output. A planned asset remains non-executable until separate governed design and Provider-execution stages approve and produce real immutable artifacts.
