# WeChat illustrated-plan requirement

## Behavior change

New authoritative WeChat image plans must contain a non-`no_image` cover and at least one non-`no_image` inline image. The number of additional inline images remains content-driven. When generated raster execution is available, the planning prompt continues to prefer content-derived, text-free generated raster artwork.

Historical immutable commits are not rewritten. Runtime validation accepts their older capability snapshot shape so they remain readable, but a historical `cover=no_image` / empty-slot plan cannot be treated as an illustrated delivery.

## Compatibility and downstream impact

- Gateway validation now rejects an all-no-image success envelope so its bounded structured-output retry can correct the result before the domain commit.
- The authoritative domain adapter independently enforces the requirement when the runtime declares illustrated delivery.
- Deterministic `html_chart` plans remain valid when a raster provider is unavailable.
- Image count is not fixed beyond one cover and one inline image.

## Rollback

Revert the gateway checks, remove `illustrated_delivery_required` / `minimum_inline_images` from the runtime capability, and remove the conditional domain checks. Existing historical data requires no migration in either direction.
