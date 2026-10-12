# Phase 7 ContentRun compatibility removal

## Decision and migration evidence

The production database was audited at revision `1230` before implementation. `contentRuns`, `contentWorkflows`, `contentTasks` and `contentPublications` were all empty, so there was no historical content object to migrate, export or delete. Strategy snapshots, strategy decisions, publishing-cycle plans, rolling plans and content opportunities were outside the removal set and were not modified.

Run `npm run audit:phase7-content-run-removal` before applying this change to another data directory. A non-zero legacy count blocks the rollout; export and reconcile those records before retrying. The audit is read-only.

## Contract change

- `POST /content-agent/runs` remains the only canonical content entry and accepts unified staged atomic bootstrap requests.
- The `/content-agent/workflows` alias, legacy run detail/trace/execution-plan endpoints, source selection, outline mutation, legacy task generation and upstream-run creation are removed.
- Removed endpoints return `410 LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED` from one side-effect-free HTTP module. They do not read request bodies, write storage or call providers.
- The browser no longer exposes the historical ContentRun workspace, deep links or client methods. Content planning opens the unified platform production workbench.

## Downstream impact

Consumers must stop reading or writing legacy ContentRun endpoints. Use unified prerequisites, opportunity/cycle adoption, staged bootstrap, platform outline confirmation, materialization, review and immutable delivery records. A caller receiving the new 410 code must not retry the old endpoint.

## Rollback

Revert the Phase 7 commit and restart the service. This restores the Phase 6 read-only surface but does not restore legacy writes. No database rollback is required because Phase 7 performs no data migration. If a different deployment reports non-zero legacy records, do not apply Phase 7 until those records have been exported and reconciled.
