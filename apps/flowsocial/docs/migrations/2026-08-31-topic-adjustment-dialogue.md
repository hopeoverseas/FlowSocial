# Topic adjustment dialogue

## Change

The Content Plan slot action no longer edits a topic through a browser prompt. It opens a slot-scoped AI dialogue. Dialogue turns create reviewable candidates and never mutate the publishing cycle. The plan changes only after the user selects an exact candidate version.

Adoption preserves the slot date, account, platform, strategy reference, learning lane and production state. It reruns deterministic current-batch/history duplication checks, writes an audit event, invalidates the previous cycle confirmation and returns the cycle to `draft / awaiting_confirmation`.

## Compatibility and downstream impact

- The existing slot PATCH endpoint remains available for compatibility; the Content Plan UI no longer calls it directly.
- Existing publishing cycles require no data migration. `topicAdjustmentSessions` is additive and initialized lazily.
- Content production inputs are unchanged until candidate adoption. A started slot cannot open or adopt an adjustment.
- Buffer capacity is not treated as an existing topic and stays outside this dialogue.
- One user message has a one-attempt model budget. A provider failure reports that no candidate was generated and does not retry automatically or synthesize a topic from the user's message.
- Exploratory turns remain discussion-only. Three candidates appear only after the user explicitly requests candidate generation.

## Rollback

Remove the topic-adjustment route registration and UI script, then restore the prior slot PATCH call in `adjustV2CycleSlot`. Existing session records are inert and can remain in storage. Do not delete or rewrite publishing cycles during rollback.
