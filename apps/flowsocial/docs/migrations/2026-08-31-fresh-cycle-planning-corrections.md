# Fresh cycle planning corrections

## Scope

This change corrects the next-cycle planning and review surface without changing publication, provider, content-generation, or active-strategy authority.

## Contract additions

- `PublishingCyclePlan` creation accepts an optional `existingPublishingCyclePlans` read model.
- New informational assumptions:
  - `ACCOUNT_CADENCE_NORMALIZED`
  - `ROLLING_CYCLE_WINDOW_OVERLAP`
- New hard scheduling conflict:
  - `ACCOUNT_DATE_COLLISION`
- Content recommendations and cycle slots may carry:
  - `motherTopicKey`
  - `platformTopicVariant`
  - `crossPlatformReusePolicy`
- Duplication assessments add matched topic/platform, dimension scores, and thresholds. Existing fields and decisions remain unchanged.

All additions are backward-compatible and optional. Existing stored plans can still be read. Confirmed and active historical plans are not rewritten.

## Behavior changes

1. Fresh-topic capacity is compared with the platform-normalized account target, not the unbounded playbook recommendation.
2. A platform cadence reduction is informational; it does not masquerade as a fresh-topic shortage.
3. Buffer slots remain topicless capacity reservations and render as such.
4. Shared mother topics receive distinct Xiaohongshu and WeChat platform angles and titles.
5. Same-account same-day commitments across cycles fail closed at confirmation time.
6. Overlapping rolling windows without a direct date collision remain allowed and visible.
7. The UI distinguishes cold-start planning from data-driven planning and exposes duplication evidence.

## Downstream impact

- Content production still starts only from a confirmed committed slot.
- Exact plan confirmation remains required for data-driven plans.
- Provider call budgets, platform upload/publication gates, strategy activation, immutable history, and unified atomic content products are unchanged.
- The plan header now describes the actual account matrix instead of displaying a disabled single-platform selector.

## Existing draft handling

Previously created unconfirmed drafts are preserved exactly as audit evidence. They are not silently recalculated. A corrected plan should use a new cycle start date, or be regenerated through an explicit future draft-replacement workflow.

## Rollback

Revert the implementing commit. No data migration reversal is required because stored additions are optional and readers ignore unknown fields. Plans created with the new fields remain readable by the previous code. Do not delete or rewrite confirmed plans during rollback.

## Verification

- `publishing-cycle-plan-self-test.mjs`
  - platform-normalized target does not emit a false fresh-topic conflict;
  - real fresh-topic shortage still emits a conflict;
  - rolling-window overlap is informational;
  - same-account same-day collision is detected.
- `cycle-workbench-self-test.mjs`
  - date collisions block confirmation;
  - buffer/cold-start/explainability UI markers exist.
- `strategy-feedback-cycle-self-test.mjs`
  - platform titles differ for a shared mother-topic policy;
  - duplication thresholds and fresh-body rules remain intact.

