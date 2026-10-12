---
name: generate-monitoring-directions
description: Convert one confirmed StrategySnapshot into three to six distinct social-media monitoring directions with audience and content-pillar bindings, grouped search queries, exclusion terms, source preferences, freshness windows, and priorities. Use before collecting domain dynamics and content signals; do not collect data or generate topics.
---

# Generate Monitoring Directions

Generate a bounded DirectionSet from one confirmed strategy snapshot.

## Procedure

1. Identify the primary audience, business outcome, platform roles, and content pillars.
2. Create complementary directions across industry events, audience problems, scenarios, buying triggers, cases, competitors, and policy change.
3. Bind every direction to at least one audience or content pillar.
4. Produce grouped queries rather than one flat keyword list.
5. Add exclusions for ambiguity, recruitment, entertainment, part-time work, and unrelated content where appropriate.
6. Set source preferences, freshness window, and priority.
7. Return only `StrategyDirectionSet@1.0` JSON.

## Boundaries

- Do not search the web or call source adapters.
- Do not label every retrieved item a hotspot.
- Do not generate topics or content.
- Do not start another Skill or workflow.

Read [references/contract.md](references/contract.md) before producing output.
