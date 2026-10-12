---
name: plan-account-publishing-cycle
description: Convert an activated FlowSocial strategy and selected growth playbooks into a capacity-aware PublishingCyclePlan for real Xiaohongshu or WeChat accounts. Use when planning a first or rolling publishing cycle, coordinating a multi-account matrix, resolving cadence versus production capacity, or preparing traceable slots for the cycle workspace and later ContentRun creation.
---

# Plan Account Publishing Cycle

Create a confirmable cycle plan from activated strategy decisions. Treat the deterministic engine as the authority for dates, IDs, capacity limits, slot states, and conflicts; never ask an LLM to calculate or repair those values.

Read [references/input-output-contract.md](references/input-output-contract.md) before assembling inputs or interpreting blockers.

## Workflow

1. Require an active strategy snapshot produced by strategy activation.
2. Require the account portfolio and account growth decisions produced with `select-growth-playbook`.
3. Resolve only social accounts that already exist and are selected by the strategy. Never create or infer a missing account.
4. Collect current platform capability, topic and evidence inventory, and research, copy, visual, review, publishing/community capacity.
5. Pass these inputs to `createPublishingCyclePlan` in `content-agent/publishing-cycle-plan.mjs`.
6. If `status` is `blocked`, present every blocker and request only the missing decision or input.
7. If the engine reports conflicts, explain the deterministic reduction and ask the user to confirm the deliverable range or change capacity.
8. Present committed, draft, and buffer slots separately. Keep platform observation surfaces distinct.
9. After user confirmation, hand the plan to the cycle workspace. Create a `ContentRun` only downstream and bind it to a concrete `slotId`.
10. Use `adaptPublishingCyclePlanToRollingContentPlan` only for legacy consumers that still require `RollingContentPlan@1.0`.

## Failure Conditions

- Stop on inactive strategy, unconfirmed account identity, missing real-account mapping, absent playbook, unknown platform capability, or incomplete critical capacity.
- Do not replace missing values with platform folklore, an assumed daily cadence, a golden posting time, or a fabricated account.
- Do not mutate strategy snapshots, historical plans, publishing queues, feedback records, or ContentRuns.

## Call Boundaries

- Upstream: strategy activation and `select-growth-playbook`.
- This skill: deterministic cycle planning and legacy-plan adaptation.
- Downstream: cycle workspace confirmation, then ContentRun creation for an explicitly selected slot.
- Out of scope: content generation, automatic publishing, performance diagnosis, or strategy revision.
