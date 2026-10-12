# Strategy feedback to next-cycle closure

## Scope

Mature cross-cycle feedback can now become a user-reviewed strategy adjustment decision and, when explicitly
approved, an exact input to the next publishing cycle. This phase does not create, activate, replace, or mutate a
strategy snapshot. Long-term strategy changes still require the Strategy Agent draft and activation workflow.

## New contracts

- `StrategyAdjustmentCandidateProjection@1.0` derives a stable, read-only candidate from an eligible
  `StrategyReviewCandidate`. It includes the repeated bottleneck, evidence summary, and one next-cycle experiment.
- `StrategyAdjustmentDecision@1.0` is an immutable user decision. Its fact hash binds the candidate hash,
  resolution, actor, evidence, experiment, and idempotency semantics.
- `StrategyAdjustmentCycleBinding@1.0` immutably binds one approved decision to one publishing cycle.
- `StrategyAdjustmentWorkspace@1.0` projects candidates, decisions, bindings, and the authority boundary for the UI.

## Human gates and authority

- A candidate is never applied automatically.
- Only `actorType: user` with `userConfirmed: true` may approve or reject the exact candidate hash.
- Approval authorizes a next-cycle experiment only. It explicitly records `activeStrategyMutated: false`.
- Rejected decisions cannot enter planning.
- Approved decisions must still match the currently active strategy snapshot when a new cycle is generated.
- The publishing cycle itself retains its existing human confirmation gate before any committed slot can start.

## Planning behavior

- The UI sends the exact IDs of approved, unbound decisions when generating the next cycle.
- The cycle stores each decision reference under `userDecisions` and applies its single-variable experiment only to
  the matching social account.
- A successful cycle creation appends a separate binding fact. A decision cannot be silently reused by another
  cycle.
- If an idempotent cycle already exists but does not contain the requested decisions, creation fails closed and asks
  for a new cycle start date.

## Compatibility and downstream impact

- Existing feedback, strategy snapshots, publishing cycles, and legacy records are not rewritten.
- Cycle creation without strategy adjustment decisions preserves its previous behavior and store shape.
- The strategy-adjustment panel is isolated from the publication queue: if the new read model is unavailable, the
  queue still loads and the panel reports a scoped error.
- Consumers of publishing cycles may observe additional `userDecisions` entries with type
  `apply_confirmed_feedback_experiment`. Existing consumers that ignore unknown decision fields remain compatible.

## Data and external effects

This phase adds two optional JSON-store collections: `strategyAdjustmentDecisions` and
`strategyAdjustmentCycleBindings`. No SQL schema migration is required. The workflow performs no provider calls,
platform uploads, drafts, publications, or strategy activation effects.

## Representative tests

- Read-only candidate projection and stable candidate hashes.
- Explicit user authority, immutable decision facts, idempotent replay, conflicting replay rejection, and stale
  strategy rejection.
- Active strategy snapshot equality before and after confirmation.
- Exact next-cycle experiment injection, immutable decision-to-cycle binding, and cross-cycle reuse rejection.
- Server, API client, and UI cutover wiring without a strategy activation bypass.

## Rollback

Revert the strategy-feedback module, routes, UI controls, and cycle-input plumbing together. Existing decision and
binding facts can remain inert in the JSON store; older code ignores the optional collections. No active strategy or
publishing cycle needs to be rewritten.
