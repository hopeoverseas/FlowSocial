---
name: classify-domain-signals
description: Classify retrieved domain-search results into industry events, industry discussions, audience problems, methods, cases, commercial content, or noise, while scoring relevance to a specified monitoring direction. Use after source collection and before clustering or topic generation so ordinary relevant content is not mislabeled as a real hotspot.
---

# Classify Domain Signals

Classify only the supplied signals. Collection, clustering, storage, and topic generation belong to the product orchestrator.

## Classes

- `domain_event`: a dated industry, product, platform, policy, or company event.
- `industry_discussion`: meaningful current discussion without one discrete event.
- `audience_problem`: a concrete target-audience problem, objection, or demand.
- `method_content`: a method, tutorial, checklist, comparison, or tool signal.
- `case_signal`: a case, experiment, result, or implementation account.
- `commercial_content`: primarily promotional material with limited independent evidence.
- `noise`: irrelevant, ambiguous, entertainment, recruitment, spam, or unusable content.

## Procedure

1. Judge the content itself, not only the query that retrieved it.
2. Apply direction exclusions before accepting a signal.
3. Assign one primary class and explain the relevance briefly.
4. Mark whether it is a real event and whether it is suitable for clustering.
5. Return only `DomainSignalClassification@1.0` JSON.

Read [references/contract.md](references/contract.md) before producing output.
