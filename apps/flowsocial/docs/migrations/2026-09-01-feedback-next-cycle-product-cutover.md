# Feedback-to-next-cycle product cutover

## Scope

- The local product now enables controlled manual publication facts, exact feedback facts, publication lifecycle facts, the Atomic feedback UI cutover, and human-confirmed strategy feedback.
- These capabilities write only local immutable facts. They do not upload, draft, publish, retry, or call a platform/provider.
- Real platform publication still requires a human to publish outside FlowSocial and then confirm the exact platform content ID/URL and time.

## Compatibility

- Legacy `contentPublications` remain readable and continue to accept legacy metric imports when an exact legacy identity is supplied.
- Metric import now prefers an exact `unifiedAtomicManualPublications` identity and writes a `PublicationMetricSnapshot@3.0`; title-only matches still require review.
- Qualified leads, sales-accepted leads, proposals, won deals, and revenue from the same confirmed import row are stored as a separate immutable `AtomicBusinessOutcomeSnapshot@1.0` bound to the exact Publication and metric snapshot. This lets strategy review count real business outcomes without widening the platform-metric contract.
- Historical imports remain on the legacy compatibility path. They are never synthesized as Atomic publication facts.
- Existing Atomic publications that did not originate from a publishing-cycle slot remain intentionally cycle-unbound and cannot be used as cycle evidence.

## State and contract notes

- Accepted tactical feedback actions are projected into the next-cycle portfolio and receive a repair lane without changing the active strategy.
- When a publishing cycle is saved, the exact action is advanced from `accepted` to `injected_into_plan` and is bound to the cycle and repair slot IDs.
- The plan UI reloads approved unbound strategy decisions before every create request and submits an explicit `cycleStart`.
- Strategy feedback routes are now governed by `STRATEGY_FEEDBACK_V1`.

## Rollback

1. Set `ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1=0`, `ATOMIC_MANUAL_PUBLICATION_V1=0`, `ATOMIC_EXACT_FEEDBACK_V1=0`, `ATOMIC_PUBLICATION_LIFECYCLE_V1=0`, and `STRATEGY_FEEDBACK_V1=0`.
2. Restart the local product server.
3. Existing immutable Atomic facts remain readable; no data deletion or conversion is required.
4. Do not re-enable legacy platform-effect flags such as `PLATFORM_PUBLISHING_V1` or `ATOMIC_WECHAT_DRAFT_CREATION_V1` as part of this rollback.

## Downstream impact

- Content Plan: displays and submits an explicit next-cycle date and preserves approved decisions across refreshes.
- Publish & Learn: Atomic imports enter the same feedback workspace used by cycle learning.
- Strategy Agent: feedback candidates can be carried into a discussion prompt, but no strategy changes until a new exact draft is reviewed and activated.
