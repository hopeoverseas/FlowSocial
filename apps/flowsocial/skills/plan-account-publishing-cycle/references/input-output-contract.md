# Input and output contract

## Required input

- `ownership`: workspace and company IDs.
- `strategySnapshot`: an active snapshot with `strategyExtensions.accountPortfolio` and one account growth strategy per selected account.
- `accounts`: existing Xiaohongshu or WeChat account records. IDs must match the selected portfolio.
- `accountPlans`: optional content pillars, recommendations, experiments, evidence and asset requirements keyed by `socialAccountId`.
- `platformCapabilities`: current, user- or system-confirmed cadence ranges by platform or account plan. These are current capabilities, not timeless platform rules.
- `capacity`: non-negative item limits for `research`, `copy`, `visual`, `review`, and `publishCommunity` within the requested cycle.
- `inventory`: optional topic and usable-evidence counts.
- `cycleStart`, `cycleDays`, `freezeDays`, and optional `userDecisions`. `freezeDays` counts calendar days including `cycleStart`; its default is seven days.

## Output handling

- `draft`: an executable cycle draft; if conflicts or pending decisions exist, resolve them before moving to `confirmed`.
- `confirmed`, `active`, `reviewing`, `completed`, and `superseded`: deterministic lifecycle states.
- `blocked`: one or more prerequisites are missing. Use `blockers[].code` as the stable programmatic key.

`slots[].state` is `committed`, `draft`, or `buffer`. A buffer has no scheduled date. Never turn a slot into a ContentRun inside this skill.

## Deterministic ownership

The code engine exclusively owns cycle and slot IDs, dates, cadence math, capacity caps, quota application, freeze boundaries, resource conflicts, feedback checkpoint dates, and legacy adaptation. Language models may explain results or help a user choose inputs, but must not overwrite engine output.

Every scheduled platform slot exposes separate `72h`, `7d`, and cycle checkpoints. Legacy adaptation must keep an unconfirmed cycle non-executable.
