# IntegratedPagePilotEvaluation@1.0

## Purpose and boundary

This contract records one isolated `nano-banana-2` pilot candidate. It is evidence for an experimental, bounded validation only. It is not a page version, Manifest, selection, delivery, production registration, or a claim that Provider success proves text, fact, visual, reference-isolation, or final-canvas quality.

Upstream inputs are the frozen 05G pilot fixture, one fixed page truth, the Kie.ai official capability/pricing snapshot, and (for one case) the authorized FlowSocial-original reference recipe. Downstream consumers may inspect the evaluation and its files read-only. They must not use it as production eligibility or synthesize `candidate_selected`/delivery events.

## Exact object

The implementation rejects unknown or missing top-level and `evidence` fields. Every object contains:

- Identity: `schemaVersion="1.0"`, `contract="IntegratedPagePilotEvaluation@1.0"`, `evaluationId`, `runMode`, `provider="kie.ai"`, `model="nano-banana-2"`, `caseId`, `pageType`, `candidateCount=1`.
- Independent state: `providerStatus`, `providerNativeDimensionStatus`, `normalizationStatus`, `finalCanvasStatus`, `textStatus`, `factStatus`, `visualStatus`, `referenceIsolationStatus`, `costStatus`, `selectionStatus="not_selected"`, `deliveryStatus="not_delivered"`, `productionStatus="disabled"`, and `productionWrites=false`.
- Evidence: `officialSnapshotHash`, `requestHash`, nullable `reference`, nullable `nativeAsset`, nullable `normalization`, nullable `gateReview`, `expectedCredits`, and nullable `actualCreditsDelta`.
- Integrity: `blockers`, `createdAt`, and deterministic `evaluationHash`. The hash is SHA-256 over the complete canonical object excluding only `evaluationHash`.

`nativeAsset` binds relative path, byte length, exact dimensions, and PNG SHA-256. `normalization` independently binds its relative path, byte length, exact 1080×1440 dimensions, PNG SHA-256, 05F normalization record hash, and explicit mode. Artifact verification rereads bytes and dimensions; replacing either native or normalized PNG invalidates the evaluation.

The reference evidence binds the registry ID, source, license, authorized use, frozen source PNG SHA-256, upload status, a one-way hash of the temporary request URL, and manual similarity review. Temporary URLs, task IDs, balances, raw Provider responses, and credentials are never persisted.

`gateReview` binds the reviewed native and normalized SHA-256 values and separately records observed/extra text, fact observations, visual observations, reference-isolation status, and notes. Provider success cannot mutate any Gate to passed. Normalization cannot overwrite the native dimension result. Selection, delivery, and production states are invariant.

`costStatus=measured` is valid only when `actualCreditsDelta` is finite, non-negative, and at most 8. A larger real delta is retained verbatim with `costStatus=blocked` and `ACTUAL_CREDITS_PER_REQUEST_EXCEEDED`; execution stops before another Provider request. If the Provider task and downloaded PNG have succeeded but the post-call credits query fails, Provider/native/normalization/hash evidence remains successful and intact while only cost becomes blocked with `actualCreditsDelta=null` and a `POST_CALL_CREDITS_QUERY_FAILED_*` blocker; execution likewise stops before another request.

## State and hard blockers

- Only explicit `--live` may issue network calls. Default execution is dry-run with zero calls.
- The frozen price must be at most 8 credits per request, at most four paid requests, one candidate each, zero automatic retries, and at most 32 credits projected/observed.
- Missing credentials, uncertain model/price/reference capability, unauthorized or hash-mismatched reference bytes, unsafe output path, budget exhaustion, Provider failure, unsupported PNG normalization, or artifact/hash mismatch blocks the affected step.
- A final canvas passes only when the 05F deterministic normalizer emits a byte-verified 1080×1440 PNG. Native dimensions remain separate.
- Text, fact, visual, and reference isolation pass only through explicit post-output review; Provider status and local file existence are insufficient.

## 05E read-only Adapter

`adapt05EReadOnly` deep-clones `ProviderCapabilityEvaluation@1.0`, maps the historical independent states, and labels cost as `historical_observation`. Because 05E has no 05F normalization/Gate chain, it adds `05E_READ_ONLY_BASELINE_NO_NORMALIZATION_OR_05F_GATES`, leaves `finalCanvasStatus=pending`, and never rewrites the source object. The Adapter does not upgrade `dimensionStatus`, reference isolation, selection, or delivery.

## Rollback

Delete the 05G contract/script/fixtures and discard the Git-ignored `.tmp/xhs-integrated-page-pilot/` directory. No database, historical contract, Manifest, page version, Feature Flag, production runtime, or Provider configuration needs migration or reversal. Failed Live evidence remains isolated for controller inspection until intentionally removed.
