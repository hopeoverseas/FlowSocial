# Atomic review queue cutover

## Scope

The content review queue now reads materialized unified Atomic commits and immutable Atomic publication facts.
Atomic rows open the exact unified project and platform control surface. Legacy `ContentTask` / `ContentPublication`
rows remain visible, but become read-only when the Atomic publication UI cutover is enabled.

## Contract change

- `buildContentHistoryIndex` advances from schema `1.3` to `1.4`.
- Every item now declares `historyItemId`, `authority`, `immutableSource`, `unifiedProjectId`, and `exactRefs`.
- Atomic items use `authority: unified_atomic`; legacy items use `authority: legacy_content_task`.
- `sourceSummary` reports Atomic rows, published Atomic rows, visible legacy rows, and Atomic-over-legacy
  deduplication.
- A project with multiple immutable publication facts produces one history row per publication fact. An Atomic
  commit without a publication fact produces one `needs_completion` row and never claims that publication is ready.

## Compatibility and downstream impact

- Existing queue-stage fields and publication timeline fields remain available.
- Cluster membership now uses `historyItemId` because Atomic rows intentionally have no `contentTaskId`.
- Consumers that use `contentTaskId` as an unconditional primary key must migrate to `historyItemId`.
- When account, platform, and canonical platform content ID match, the Atomic publication is authoritative and
  the legacy shadow is omitted.
- Under the cutover flag, legacy rows cannot write publication or metric data from the review dialog. Flag-off
  behavior preserves the legacy editing path.
- Atomic queue actions do not infer a candidate, publication, or delivery. They only route by exact project and
  platform; the unified control surface continues to enforce candidate selection and human publication gates.

## Feature flags and effects

This change does not enable any feature flag and does not perform provider or platform calls. The read model may
show existing Atomic facts regardless of write flags. Mutations remain governed by the unified workbench flags,
exact-reference preflights, idempotency controls, and human confirmation gates.

## Representative tests

- Unified product API coverage verifies XHS and WeChat Atomic history rows, exact project/platform references,
  immutable publication timelines, read-only projection, multiple publication facts, and mixed-store deduplication.
- The queue cutover UI test verifies project/platform routing and confirms that the Atomic route does not call any
  legacy publication or metric client.
- The existing Atomic browser regression verifies that unified publication and feedback operations still use only
  Atomic endpoints.

## Rollback

Revert the history projection, server flag plumbing, and queue routing together to restore schema `1.3`. No stored
data migration is required: this phase adds no persisted fields and mutates no existing fact collections.
