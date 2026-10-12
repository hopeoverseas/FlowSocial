# Data-driven fresh-content cycle

## Scope

The next publishing cycle now uses mature feedback to propose a sustain/repair/explore content portfolio. Every
planned slot must contain a fresh topic and a fresh body. Historical performance may preserve a pillar, audience,
content function, format, or operating pattern; it must not clone a historical topic, outline, or body.

## New contracts

- `NextCycleContentPortfolio@1.0` is a read-only, evidence-linked portfolio projection with deterministic allocation,
  sustain/repair/explore signals, and explicit authority boundaries.
- `ContentLearningInstruction@1.0` binds a planned topic to its portfolio, learning lane, novelty requirements,
  experiment, and evidence references.
- `CycleLearningEvaluation@1.0` compares a completed repair lane with its historical baseline and reports
  `supported`, `partially_supported`, `rejected`, or `insufficient`.
- Publishing-cycle plans may contain `nextCycleContentPortfolios`, per-slot `learningLane`,
  `nextCyclePortfolioRef`, `contentLearningInstruction`, and `duplication`.

## Planning and novelty behavior

- The default evidence-backed target allocation is 60% sustain, 30% repair, and 10% explore. Counts are rounded
  deterministically; repair receives at least one slot when a repair signal exists and the cycle has at least two
  slots, while exploration receives at least one slot when five or more slots and sufficient evidence exist.
- Insufficient evidence falls back to 80% sustain and 20% bounded exploration, without inventing a repair claim.
- The planner tries bounded alternative angles. Only `allow` and `warn` candidates can enter a data-driven cycle.
  `rework` and `block` candidates reduce deliverable topic capacity rather than silently reusing old content.
- Manual topic edits are checked against historical topics and the current batch. Similarity at or above the hard
  threshold fails closed.
- Two platform versions inside the same unified content project remain valid siblings; the historical gate applies
  to prior projects and other current-cycle slots, not to the coordinated platform materialization itself.

## Human authority and downstream impact

- A data-driven publishing cycle carries a stable confirmation preview hash. The UI must send that exact hash when
  the user confirms the batch. A changed topic or schedule invalidates the previous preview.
- Confirmation freezes the exact topic/version set only. It performs no provider call, content generation, upload,
  draft creation, or publication.
- The learning instruction is carried into the unified content objective so downstream writers receive the fresh
  topic/body rule and the selected repair variable.
- Cycle evaluation remains directional across different topics and must not be presented as strict causal A/B
  evidence. It cannot activate or mutate a strategy.

## Compatibility

- Existing publishing cycles without `nextCycleContentPortfolios` retain the previous confirmation behavior.
- Existing tasks, publications, strategies, and cycles are not rewritten.
- The retired `createFeedbackFollowupRun` compatibility helper now returns
  `FEEDBACK_FOLLOWUP_CLONE_RETIRED` (HTTP semantics 410). The production API had already stopped calling this helper;
  accepted feedback actions now wait for a fresh next-cycle plan.
- The cutover is controlled by `DATA_DRIVEN_NEXT_CYCLE_V1`. Read-only portfolio projection remains available even
  when planning cutover is disabled.

## Rollback

Disable `DATA_DRIVEN_NEXT_CYCLE_V1` to return new cycle generation to the prior planner. New optional plan fields and
read-only evaluation projections can remain stored; older readers ignore them. Reverting the planner integration,
exact confirmation, and UI labels does not require rewriting existing strategy snapshots or historical content.

## Representative tests

- Six mature simulated publications across two cycles produce a 3/2/1 sustain/repair/explore projection.
- Five planned slots use unique topics, fresh-body instructions, and no `block` or `rework` candidate.
- Direct legacy feedback cloning is rejected with zero new runs.
- Manual duplicate topics are rejected and exact plan-hash confirmation is required.
- Repair-lane results produce a directional cycle learning evaluation while strategy mutations remain zero.
