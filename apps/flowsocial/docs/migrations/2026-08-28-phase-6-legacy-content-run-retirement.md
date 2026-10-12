# Phase 6 legacy ContentRun retirement

## Decision

Legacy `ContentRun` is now a read-only compatibility model. New work must use the unified atomic content project, staged bootstrap, platform outline confirmation, materialization, artifact review and immutable delivery records.

## HTTP and client compatibility

- Historical `GET /content-agent/runs/:id`, `/execution-plan` and `/trace` remain available. Existing IDs, content-task attribution and feedback history are not rewritten or deleted.
- Legacy creation routes, explicit `entryMode=legacy`, source selection, outline generation/edit/confirmation and `POST /content-tasks/generate` return `410 LEGACY_CONTENT_RUN_WRITES_RETIRED` before persistence or provider execution.
- `/content-agent/runs` and `/content-agent/workflows` continue to accept only the unified bootstrap request shape. The workflows alias remains compatibility-only; `/content-agent/runs` is canonical.
- The browser client rejects retired methods locally before HTTP. The historical run workspace disables mutation controls and routes new work to content planning.

## Downstream impact

- Consumers that used legacy write APIs must migrate to unified prerequisite/adoption and staged bootstrap APIs.
- Consumers may continue reading historical objects. Additive historical fields remain unchanged.
- No Feature Flag default, schema, database row or historical snapshot is changed. Human outline confirmation, exact candidate selection, provider approval and publication confirmation remain required in the unified chain.

## Rollback

Rollback requires reverting the Phase 6 commit and restarting the server. No data rollback is needed because Phase 6 performs no migration. Do not delete unified prerequisites, bootstraps, confirmations, artifacts or historical ContentRuns. Before temporarily restoring any legacy writer, verify that no unified project already owns the same topic/account/version authority, otherwise the two chains will diverge again.
