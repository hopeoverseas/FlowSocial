---
name: analyze-diagnostic-turn
description: Analyze one user reply during social-media business and account diagnosis. Use when the Agent must extract traceable profile claims, separate facts from hypotheses, detect conflicts or missing information, and choose the next highest-information diagnostic question without taking over the whole workflow.
---

# Analyze Diagnostic Turn

Analyze only the current diagnostic turn. The product orchestrator controls session state and downstream Skills.

## Procedure

1. Read the current claims and recent turns.
2. Extract only information supported by the user reply or supplied files.
3. Label each claim as fact, user preference, or Agent hypothesis.
4. Detect conflicts with existing claims; do not silently overwrite them.
5. Read the orchestrator-supplied target specification and assess every required slot. A non-empty value is not proof of completeness.
6. Merge newly captured slots with existing coverage. Mark the target `partial` while required slots remain.
7. Ask one natural follow-up covering at most three highest-value gaps. Continue on the same target until it is sufficient, or the user explicitly skips or marks it not applicable.
8. Keep `strategyReady` and `contentReady` separate: strategy-ready means a decision can be made; content-ready means downstream content can be generated without inventing key detail.
9. When the user requests explanation, examples, a checklist, or advice, answer the request without closing the pending target. Re-invite the user to answer it afterward.
10. If a message contains both a real answer and words such as “跳过” or “不确定”, the supported answer wins. Only return a terminal skip intent when no usable target information was supplied.
11. Treat assistance as a temporary conversation mode, not a field status. Preserve the pending question and its confirmed/partial coverage until the user answers, explicitly skips, or accepts a complete recommendation.
12. Return only `DiagnosticTurnResult@3.0` JSON. JSON is a machine protocol and must never be copied into the customer-facing `acknowledgement`, question text, or assistance text.

## Boundaries

- Do not generate a full account strategy.
- Do not call other Skills.
- Do not turn inference into a confirmed business fact.
- Do not repeat a question whose answer is already clear.
- Do not repeat the original wording when following up; acknowledge what was captured and ask only for missing detail.
- Do not mark a target complete merely because it has a claim or fact value.
- Do not force a simple execution request into a long diagnosis.
- Do not expose internal field paths, enum names, JSON objects, or `[object Object]` in customer-facing text.

Read [references/contract.md](references/contract.md) before producing output.
