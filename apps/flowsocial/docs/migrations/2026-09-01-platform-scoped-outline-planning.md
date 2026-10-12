# Platform-scoped outline planning cutover

## Problem

The content-production UI exposed separate Xiaohongshu and WeChat workspaces, but a create request still planned a shared master plus both platform outlines. A WeChat outline failure could therefore block a Xiaohongshu-only user action, and retrying the request repeated already completed planning stages.

## Contract change

- New create requests may include `targetPlatform: "xiaohongshu" | "wechat"`.
- A scoped `UnifiedStagedAtomicDualBootstrap@1.0` contains the shared master and exactly one platform outline. Its public `targetPlatform`, `outlines`, `outlineRefs`, planning runs, confirmation refs, and receipt stages all have the same scope.
- Existing records without `targetPlatform` remain dual-platform records and retain the old two-outline validation and read behavior.
- The existing authority envelope still binds both configured account references. Platform scope limits generation and materialization; it does not weaken authority or account validation.

This is an additive discriminator on the persisted `1.0` record. No active-data backfill is required. Historical dual records are read as dual records and are not rewritten.

## Recovery behavior

- Planning receipts retain an internal, hash-verified checkpoint for a completed shared master.
- Public receipt projection exposes only checkpoint stage names, never the stored model input/output payload.
- A failed scoped request can reuse its exact request key. If the master checkpoint matches the regenerated input and execution-plan hashes, only the selected platform outline is called again.
- A checkpoint mismatch fails closed with `UNIFIED_PLANNING_MASTER_CHECKPOINT_INVALID`; it is never silently reused.
- Legacy dual failures are not resumed from a platform workspace. The UI creates a new platform-scoped request instead.

## Downstream impact

- Platform outline confirmation treats the selected platform as the complete confirmation set.
- Scoped records must use platform-specific materialization. The legacy global dual-materialization entry point rejects them.
- Superseding revisions must retain the predecessor's platform scope.
- No publication, draft creation, upload, feedback, or active content data is changed by this migration.

## Rollout and rollback

Before the first scoped record is written, the commit can be reverted normally. After scoped records exist, do not roll back the compatibility reader/validator: older code cannot validate one-outline records. To roll back generation safely, stop emitting `targetPlatform` in new requests while keeping this reader and platform-specific resume path deployed. Existing scoped records remain readable and resumable; new requests return to the legacy dual shape.

Rollback must not delete or rewrite scoped records. If a full code rollback is unavoidable, export/quarantine scoped records first and restore this compatibility reader before serving the unified bootstrap collection.

## Verification

- Offline planner tests prove XHS scope makes zero WeChat outline calls and WeChat scope can be tested symmetrically.
- Atomic bootstrap tests prove scoped output/reference closure and legacy dual compatibility.
- Receipt tests prove checkpoint redaction and scoped completion.
- Composition tests prove checkpoint recovery makes no second Provider call for the shared master.
- Product regression and browser smoke tests must pass before rollout.
