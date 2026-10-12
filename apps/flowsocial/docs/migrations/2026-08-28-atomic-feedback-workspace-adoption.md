# Atomic feedback workspace adoption

## Scope

The feedback workspace now projects immutable `ControlledManualPublication@1.0` facts and their exact
`PublicationMetricSnapshot@3.0` snapshots into the existing analysis model. This is a read-only adoption;
it does not create publications, feedback actions, strategy drafts, or strategy snapshots.

## Contract change

- `buildFeedbackWorkspace` response schema advances from `2.1` to `2.2`.
- A new `sourceSummary` object reports Atomic, legacy, and deduplicated legacy publication counts.
- Atomic outcomes use the existing outcome shape. `contentTaskId` and `contentRunId` are `null`; immutable
  Atomic references are available under `attribution.exactRefs`.
- WeChat Atomic metric names are projected without changing the stored snapshot:
  `reads -> views`, `favorites -> saves`, and `newFollowers -> follows`.

## Compatibility and downstream impact

- Existing legacy publications remain readable.
- When an Atomic and legacy record have the same account, platform, and canonical platform content ID,
  the Atomic record is authoritative and the legacy shadow is excluded from analysis.
- Existing consumers that ignore unknown response fields remain compatible. Consumers must not require
  `contentTaskId` or `contentRunId` for Atomic outcomes.
- Cycle, growth-playbook, content-function, and pillar attribution is recovered only when the Atomic project
  came from a confirmed publishing-cycle slot. Unbound projects remain visible but are withheld from cycle
  or strategy conclusions by existing data-quality gates.
- Current Atomic metric contracts do not carry qualified leads or won deals. Strategy-review eligibility
  therefore remains withheld until exact business-outcome evidence is added under a separate reviewed contract.

## Feature flags and effects

This change does not enable publication or feedback feature flags. It only reads facts already present in the
store. Atomic publication, feedback confirmation, lifecycle mutation, provider calls, and platform calls remain
governed by their existing flags and human gates.

## Representative tests

- Legacy feedback analysis and maturity tests remain unchanged.
- Unified product API coverage verifies XHS and WeChat Atomic outcomes, exact snapshot identity, read-only
  behavior, and Atomic-over-legacy deduplication.

## Rollback

Revert the adapter import and the `buildFeedbackWorkspace` merge to restore schema `2.1`. No database or stored
fact migration is required because this adoption writes no data and does not alter stored contracts.
