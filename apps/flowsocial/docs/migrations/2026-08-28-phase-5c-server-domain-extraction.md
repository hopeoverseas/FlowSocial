# Phase 5C server domain extraction

## Change

`server.mjs` remains the HTTP composition root. `GET /health` is owned by `http/system-routes.mjs`; legacy content-task, promotion and publication compatibility endpoints are owned by `http/legacy-content-routes.mjs`.

## Compatibility and downstream impact

- No route path, HTTP method, success/error status, response field, schema or persisted record changes.
- No Feature Flag default changes. `contentPromotionV1` still gates legacy promotion writes, and `atomicPublicationFeedbackUiCutoverV1` still rejects legacy publication, metric and update writes with `409 ATOMIC_PUBLICATION_UI_CUTOVER_REQUIRED`.
- Persistence happens at the same successful mutation boundaries. Read-only endpoints and rejected writes do not persist.
- Unified atomic content production routes remain authoritative and unchanged. This extraction does not add a legacy fallback.
- Health output retains build identity, restart detection, storage, workspace counts, provider/skill readiness and product capability policy fields.

## Representative validation

`phase5-server-domain-routes-self-test.mjs` covers health response compatibility, route fall-through, task reads, promotion flag gating, successful promotion persistence, and Atomic UI cutover fail-closed behavior. The full product suite remains offline and key-free.

## Rollback

Revert the Phase 5C commit or restore the two handler bodies to `server.mjs`, remove the two handler imports/runtime-source entries, and restart the server. No data migration or data rollback is required because this phase changes module ownership only.
