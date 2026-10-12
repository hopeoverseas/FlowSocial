# Unified Content Production contracts

## Purpose and boundary

This additive contract family defines a shared editorial authority, independently adapted platform runs, explicit mechanism decisions, user selection, and controlled production promotion. It does not change `ContentMaster@2.0`, historical `ContentRun` objects, Manifest 2/3, or the immutable 05O evidence.

The authority direction is:

```text
ActiveStrategySnapshot
→ ContentProject
→ SharedContentMasterRef
   ├─ Xiaohongshu PlatformRunRef
   └─ WeChat PlatformRunRef
→ Editorial Review
→ UserSelection
→ PromotionRecord
```

A WeChat or Xiaohongshu package may never be the `SharedContentMasterRef` authority. Both platform runs bind the same master reference but retain their own account, brief, outline, Writer invocation, candidates, and final version.

### Canonical title boundary

`generate-platform-titles` runs after the platform Writer. Its canonical input contains the full immutable `ContentMaster`, that platform's completed Writer output, the Writer's preliminary titles, the full content task brief, and only same-account title signals covered by an explicit account-matched authorization. A master reference or platform brief reference alone is not a valid substitute for these values.

Caller-provided platform input may expose `sameAccountTitleSignals` only together with `sameAccountTitleSignalsAuthorization: {status: "authorized", accountId, signalIds}`. The account must equal the current platform-run account, and each forwarded signal ID must occur in `signalIds`; all other signals are omitted before the Skill invocation.

Only a `PlatformTitleList@1.0` envelope with `status: success` can produce a candidate. The `balanced` recommendation identifies the visible candidate title. New `UnifiedPlatformCandidate@1.0` records add a read-only `finalTitleBinding` containing the exact recommendation ID and title, all recommendation mappings, the title output fact/output references, and the completed-content fact/output references. The visible Xiaohongshu `postCopy.recommended_title` and WeChat `article.recommended_title` are projections of that binding; the immutable Writer output fact is not rewritten.

This binding is additive. Historical candidates without `finalTitleBinding` remain unchanged and cannot be relabelled as natively title-bound. Consumers must use the binding when present and retain their existing read-only legacy behavior when absent.

New candidate identity includes project scope, platform, Writer output hash, and title output hash. A title-only retry therefore creates a different candidate ID and hash even when the completed Writer output is unchanged. Historical candidate IDs are not recomputed.

## Contracts

### `ContentProject@1.0`

Belongs to one company, one content opportunity, and one active strategy snapshot. It owns one authoritative shared master reference and zero to two platform runs. A platform can occur only once, and every child run must bind the exact same master ID and hash.

### `ContentMechanismDecision@1.0`

Records evaluated hotspot, knowledge, blueprint, strategy-only, and user-material mechanisms. Rejected or unavailable mechanisms require a reason. Hotspot candidates always use `external_event_not_business_fact`; they cannot be promoted to company facts. If a required or preferred hotspot policy falls back to another mechanism, degradation and explicit user confirmation are required.

### `ContentMechanismDecision@2.0`

The additive v2 contract records source-planning truth without claiming Writer execution truth. It separates one `primary` source mechanism, zero or more `supporting` mechanisms, and `not_selected` mechanisms. Each mechanism declares `evaluated` or `not_evaluated`; a not-evaluated mechanism has no candidate records and cannot be disguised as an evaluated empty/unavailable result. Every known candidate has one exact `{id,hash}` source ref, a `selected|rejected|not_available` status, and a non-empty reason.

`selectedSourceRefs` is the deduplicated set equality of candidate records marked selected. The explicit v2 Source Planner builder additionally requires that set to equal the actual source refs frozen into the SourcePlan after filtering and per-source limits. A pre-limit candidate may remain rejected or unavailable, but it cannot be marked selected. Hotspot candidates retain `external_event_not_business_fact`; knowledge, strategy facts, user material, and approved blueprint sources use the same parseable ID/SHA-256 ref shape.

Source taxonomy and platform creative taxonomy are independent. v2 declares `content_source_mechanism` ownership and points creative-mechanism authority to `platform_writer_context`; it never stores or claims the Writer's eventual creative mechanism or actual source use. Actual-use evidence requires a later deterministic usage binding.

When `required` or `preferred` hotspot policy is not satisfied, `degraded` requires an immutable `ContentMechanismConfirmationEvent@1.0` user-event ref whose hash matches the full event. A status string, machine gate, missing event, stale hash, or mismatched event ID cannot authorize degradation; without valid confirmation the decision remains `blocked`.

Historical `ContentMechanismDecision@1.0` remains unchanged. `ContentMechanismDecisionV1CompatibilityView@1.0` exposes its known primary mechanism and selected refs while marking secondary mechanisms, candidate-level decisions, and actual use as `unknown`. It is a distinct view contract, not a projected v1 instance. Its exact provenance records `kind=derived_from_content_mechanism_decision_v1`, `readOnly=true`, `promotionEligible=false`, and `nativeV2=false`; neither the wrapper nor its inner view may validate or be promoted as v1 or native v2. The default Source Planner continues to build v1; v2 is available only through the explicit builder. No migration, orchestrator, server, database, UI, or Feature Flag change is included.

### `ContentMechanismUsageBinding@1.0`

The additive usage binding is an execution-after fact, not another planning decision. It binds exact refs and hashes for `ContentMechanismDecision@2.0`, the frozen SourcePlan, shared ContentMaster, platform run, Writer evidence, Writer Context, and zero or more deterministic trace evidence objects. It separately records `plannedSourceRefs`, `writerReceivedSourceRefs`, and `provenUsedSourceRefs`; received refs must be a subset of planned refs, and proven-used refs must be a subset of received refs.

Every planned source appears exactly once as `used`, `unused`, or `unknown_not_proven`. `used` requires a deterministic trace ref. `unused` requires either a deterministic trace that proves non-use or the Writer evidence proving that the source was never received. A received source without deterministic usage evidence remains `unknown_not_proven`; absence from generated prose, natural-language inspection, or a Provider/model self-report cannot silently convert it to unused or used.

The binding also separates the strategy-requested platform creative mechanism from the final immutable Writer Context value and binds both authority refs. A mismatch is `deviated` only with a non-empty reason and a full, user-confirmed `ContentMechanismConfirmationEvent@1.0` whose ID/hash matches the immutable event. A status string, stale ref, machine claim, or missing event cannot authorize the deviation.

`MechanismExplanation@1.0` is a deeply frozen, read-only, promotion-ineligible projection. Its planning section exposes only planned refs; its actual-use section exposes Writer-received/proven-used refs and per-source evidence status with the explicit boundary `deterministic_refs_only_no_natural_language_inference`. Structured provenance marks it as derived and `nativeUsageBinding=false`; it cannot masquerade as the authoritative usage binding.

This contract is additive and does not modify the v1/v2 decision builders or default SourcePlan. The trusted atomic flag-on Server path now compiles it in memory after the deterministic Fact Graph succeeds; database, UI, selection, delivery, publication, and Live flows remain disconnected.

### `UserSelection@1.0`

Records the exact selected title, body version, page revisions, selection events, and explicit user confirmation. Machine gates, Provider success, an operator visual check, package preparation, or download cannot substitute for user selection. Xiaohongshu selection requires at least one selected page revision.

### `PromotionRecord@1.0`

Requires a passed editorial review and confirmed user selection. It binds company/account, project, platform run, shared master, active strategy, source Manifest hash, delivery artifact hash, immutable promoted version, provenance, and idempotency key. Cross-object validation rejects company, account, strategy, master, run, or selection mismatches. `validatePromotionRecordSet` also rejects reuse of one idempotency key for different immutable records.

## State ordering

```text
planned
→ generating
→ candidate_ready
→ machine_reviewed
→ editorial_reviewed
→ user_selected
→ persisted
→ delivery_ready
→ publication_pending
→ published
→ feedback_pending
```

The deterministic validator accepts only the immediate next state. It rejects backward moves, repeated states, and skipped states. Generation, machine review, editorial review, user selection, persistence, delivery, publication, and feedback therefore remain independent facts.

## Legacy compatibility

`adaptLegacySinglePlatformRunReadOnly` and `adaptLegacyIsolatedPackageReadOnly` return deeply frozen `LegacyUnifiedContentProjection@1.0` objects. They preserve `legacy_single_platform` or `legacy_isolated` provenance, set shared-master authority to `null`, and remain promotion-ineligible. The adapters hash but never mutate their input. They do not relabel historical evidence as a native shared-master chain.

No bulk migration is required. Future orchestrator, UI, database, delivery, and promotion wiring must be delivered under separate Work Items and feature flags.

## Atomic WeChat immutable commit

`UnifiedAtomicWechatContentCommit@1.0` is an additive, independently validated commit family for WeChat. It materializes from the same immutable strategy, opportunity and shared `ContentMaster` authority as the Xiaohongshu atomic commit, but it never reads an XHS package, candidate, artifact, delivery bundle or legacy WeChat snapshot as upstream truth.

The commit binds the pre-execution project identity separately from the final materialized `ContentProject`, the exact WeChat platform run, platform brief, confirmed outline, Writer Context, mechanism decision and frozen SourcePlan. Its formal provider-authored chain is exactly:

```text
write-wechat-article
-> wechat_content_review (review-wechat-article)
-> plan-wechat-images
```

Each stage has one `SkillActivityInvocation@1.0` and one `UnifiedSkillOutputFact@1.0`. Invocation input hashes bind the full exact upstream values, every invocation shares one atomic authority and execution-plan hash, and the policy is capped at one Provider call with zero automatic retries. Only completed, production-eligible successful output facts may be committed; fallback, mock, non-success, missing, duplicate, stale, mixed-company/account/run/platform or cross-platform authority fails before append.

The explicit default-off `runUnifiedAtomicWechatCommitOrchestration` entry creates each formal Invocation before calling the existing controlled Skill executor. It then resolves the executor's first-party Output Fact, verifies that the exact returned domain output, input hash, plan hash and execution evidence agree, and only then bridges that fact into the Commit. A fixture may supply offline Provider-shaped results to the controlled executor, but it may not manufacture the Commit facts itself. Any failed Writer stops Review and Image Planning; any failed Review stops Image Planning.

The materialized components are `WechatAtomicArticle@1.0`, `WechatAtomicArticleReview@1.0`, and `WechatAtomicCanonicalImagePlan@1.0`. The review component binds the exact Article component; the image-plan component binds both the Article and passed Review and embeds the formally validated authoritative `WechatCanonicalImagePlan@1.0`. Traceability and preflight are separately typed `UnifiedAtomicWechatCompilerFact@1.0` deterministic compiler facts. They are never represented as Skill invocations.

The shared atomic Store dispatches the historical XHS v1, materialized XHS v2, and WeChat v1 contracts without weakening the exact historical validators. WeChat v1 deliberately grants no product projection, artifact, human review, promotion or publication authority. It is default-off and unwired: rollback is removal of the additive module and Store branch, with no snapshot rewrite or data migration.

## Xiaohongshu split component foundation

The additive Xiaohongshu component family separates Provider-authored creative work from deterministic authority, trace, and readiness decisions:

```text
XhsPostCopy@1.0
        │
        ├──→ XhsCarouselPlan@1.0
        │             │
        │             └──→ XhsVisualAssetPlan@1.0
        │
        └──→ deterministic XhsTraceability@1.0
                         └──→ deterministic XhsContentPreflightReport@1.0
                                      └──→ XhsPostPackage@3.0
```

`XhsPostCopy@1.0` owns only preliminary titles, post copy, interaction choices, and an explicit promotion-use declaration. `XhsCarouselPlan@1.0` owns page narrative, text layers, confirmed-outline binding, and page claim references. `XhsVisualAssetPlan@1.0` owns visual requirements, skipped pages, authorized reference-asset declarations, image specifications, and bindings to planned asset IDs. Planned IDs are not generated files, selected revisions, delivery artifacts, or publication evidence.

Every component has exact keys, a stable SHA-256 content hash, a deep-frozen constructor result, an independent total validator, and the same exact authority binding. The binding includes the company, account, active strategy, opportunity, mechanism decision, project, platform run, shared ContentMaster, platform brief, confirmed outline, Writer context, and Design DNA references. A valid component does not by itself prove integration, user selection, delivery, publication, or feedback.

`XhsTraceability@1.0` is compiled from actual fact, interpretation, knowledge, and authorized visual-reference use. Its `pageClaimMap` is derived from verified carousel page references; it is not accepted from a Provider. Compilation rejects dangling or opinion claims, page claims not present in the matching body section, unauthorized knowledge assets, and visual references whose ID/hash is outside the exact authorized set.

`XhsContentPreflightReport@1.0` is also deterministic. It verifies authority and component hashes, confirmed-outline/role binding, page order, exact repeated-page signals, cover-title intent, ContentMaster promotion policy, visual-reference authorization, and the deterministic trace hash. Provider output cannot supply, override, or self-report these results. `XhsPostPackage@3.0` contains only immutable component references and their hashes; assembly fails unless every component is valid, shares one authority binding, and preflight passed.

### v2 compatibility and migration

Historical `XhsPostPackage@2.0` snapshots remain unchanged. The only compatibility path from v3 is the explicit, deeply frozen `XhsPostPackageV2ReadOnlyProjection@1.0` wrapper. It labels its inner v2-shaped value as `derived_from_xhs_post_package_v3`, `readOnly: true`, `promotionEligible: false`, and `nativeV2ProviderOutput: false`. Consumers must not persist that projection over a historical v2 snapshot or describe it as a native Writer output.

This foundation does not modify the Skill manifest, orchestrator execution plan, feature flags, database, UI, or delivery adapters. A later integration Work Item must introduce versioned atomic Skill invocations, persist their immutable facts, update one end-to-end feature path behind a default-off flag, and retain the existing v2 path until explicit cutover. Upstream impact is limited to future atomic Skill inputs; downstream consumers may continue reading native v2 or explicitly opt into the marked read-only projection. No bulk data migration is required.

### Final-title-bound Xiaohongshu components

The additive final-title path resolves the split between immutable preliminary Writer titles and the later balanced platform-title selection:

```text
XhsPostCopy@1.0 + verified PlatformTitleList@1.0 balanced selection
        └──→ XhsFinalTitleBinding@1.0
                    └──→ XhsCarouselPlan@2.0
                                └──→ XhsVisualAssetPlan@1.0
                    └──→ XhsTraceability@2.0
                                └──→ XhsContentPreflightReport@2.0
                                            └──→ XhsPostPackage@4.0
```

`XhsFinalTitleBinding@1.0` is deterministic system authority, not Provider output. It binds the unchanged `XhsPostCopy@1.0` ID/hash, the verified title-output ID/hash, the balanced recommendation ID, exact selected title, and authorized title claim IDs, then receives its own stable hash. A title retry creates a new binding and downstream identity; it never mutates the PostCopy or its preliminary `recommendedTitle`.

`XhsCarouselPlan@2.0` retains the PostCopy ref and adds the final-title-binding ref. Its canonical cover headline must equal the bound final title byte for byte. `plan-xhs-carousel` receives that binding as immutable read-only input and cannot select, score, shorten, rewrite, or fall back to the preliminary title.

`XhsTraceability@2.0` adds the final-title-binding component ref and explicit title claim IDs. `XhsContentPreflightReport@2.0` validates the final-title/PostCopy/cover relationship, every component ref/hash, title-claim authorization, and the deterministic v2 trace. `XhsPostPackage@4.0` contains only refs to PostCopy, final-title binding, title-bound carousel, visual plan, v2 trace, and v2 preflight. It does not copy mutable Provider data.

All versions are additive. Existing `XhsCarouselPlan@1.0`, `XhsTraceability@1.0`, `XhsContentPreflightReport@1.0`, and `XhsPostPackage@3.0` remain independently valid read-only history and are never relabelled as title-bound versions. There is no database migration. The atomic runtime assembles v2 only when an explicit, valid final-title system context is supplied; missing, stale, hash-mismatched, or unauthorized context fails closed before Provider invocation or component assembly. Main-graph cutover, flags, persistence, UI, and delivery remain separate work.

## Unified atomic execution foundation

The additive `unified-execution-contracts.mjs` module defines five platform-neutral contracts. It is an offline contract foundation and is not wired into the Server, Orchestrator, feature flags, persistence, UI, delivery, Provider, or Live paths.

`SkillActivityInvocation@1.0` identifies one bounded Skill activity policy. Its deterministic idempotency key contains only the Skill name/version, exact input ref/hash, authority refs sorted by an explicit Unicode code-point comparator and authority family, plan hash, and attempt policy. It never depends on process locale. Invocation IDs, timestamps, Provider envelopes, random values, and response text are excluded. The default atomic policy is one attempt, zero automatic retries, a bounded timeout, and at most one Provider call; an optional positive micro-unit cost budget is explicit.

`ValidatedComponentFact@1.0` can be constructed only from a deeply frozen component that passes its formal validator, has a valid component hash, matches the Invocation's atomic authority binding, and names the validator version. It stores only the component ref/hash. A raw Provider envelope may appear only as a distinct audit ref with `rawEnvelopeAuthoritative=false`; failed, extra-shaped, mutable, unvalidated, hash-mismatched, or cross-authority output cannot become a component fact.

`DeterministicAssemblyFact@1.0` binds an exact, complete, role-unique set of validated atomic component facts to one validated, deeply frozen assembly output ref/hash. The formal assembly validator must return the exact assembly object or literal `true`; `false`, `null`, `undefined`, or another object fails closed. All inputs must share one `atomic_v2` authority. Missing roles, duplicate roles, cross-authority facts, component hash tampering, or monolithic `write-xhs-content`/`XhsPostPackage@2.0` authority are rejected. Component payloads are not copied into the fact, so the assembly fact does not create a second content authority.

`UnifiedContentCandidate@2.0` has mutually exclusive exact authority shapes. `atomic_v2` references only a valid deterministic assembly fact. `monolithic_v1` references one legacy `UnifiedSkillOutputFact@1.0` through an explicit compatibility adapter whose provenance is read-only, promotion-ineligible, and not a native Candidate@2. The legacy fact must be a completed `write-xhs-content` or `write-wechat-article` fact on the matching platform, contain an exact successful runtime envelope with no blocked reasons, and have valid output and fact hashes; an arbitrary self-hashed object is not legacy authority. No mixed authority object validates, and the compatibility view does not rewrite historical Candidate@1 or Writer facts.

`UnifiedContentRunState@1.0` covers only pre-commit execution: `planned → components_running → components_validated → assembly_validated → candidate_ready → user_review`, with stage-specific terminal failure states. Each transition binds the previous state hash and an immutable event ref. The deterministic transition function rejects repeated, backward, skipped, failure-recovery, or prerequisite-bypassing moves. This state machine does not claim durable checkpoints, user selection, publication, or feedback Saga behavior.

### Compatibility, migration, testing, and rollback

Upstream atomic Skill integration must create an Invocation before execution and compile a Component Fact only after formal validation. Downstream Candidate assembly may opt into `atomic_v2`; existing consumers stay on their unchanged monolithic path through the explicit read-only adapter until a separate default-off cutover Work Item is tested. There is no bulk or database migration, and no historical snapshot is rewritten.

The focused table-driven self-test covers exact root shapes, null/primitive inputs, stable hashes, deep freezing, deterministic idempotency, retry/cost policy, mutable or failed component input, authority mismatch, missing/duplicate roles, raw-envelope separation, mixed candidate authority, monolithic roles in atomic assembly, hash tampering, and legal/illegal Run State transitions. Rollback is removal or revert of the additive module, test, and this documentation section; production behavior and stored data are unaffected.

## Deterministic component Fact Graph

`DeterministicComponentFact@1.0` and `DeterministicAssemblyFact@2.0` add the missing non-Provider nodes for an atomic Package Fact Graph without changing the v1 execution contracts or Candidate@2.

`DeterministicComponentFact@1.0` is produced only by its factory. The caller supplies a deeply frozen canonical compiler input, an exact input ref whose hash also covers the sorted upstream Fact refs, a controlled compiler identity/function, and a formal component validator. The factory validates and classifies every upstream authority before executing the compiler itself. Supported upstream classes are `ValidatedComponentFact@1.0` as `provider_component`, another `DeterministicComponentFact@1.0` as `deterministic_component`, and a completed, successful, hash-valid `UnifiedSkillOutputFact@1.0` for `generate-platform-titles` as `validated_skill_output`. Every deterministic component requires at least one Provider or deterministic authority-bound upstream, and every such upstream must have the exact same validated `authorityHash` as the producer. Title Skill output has no authority binding and can only supplement—not replace—that chain. Authority mismatch fails before the compiler is called, so facts from one account cannot be laundered into another account's deterministic Fact. An arbitrary self-hashed object cannot enter the graph.

The resulting deterministic Fact binds producer name/version with `kind=deterministic_compiler`, canonical input ref/hash, locale-independent code-point-sorted upstream Fact refs, component role/contract/ref/hash, atomic authority, and formal validator identity. Its exact shape intentionally has no `invocationRef`, Provider envelope, execution mode, attempt, token, cost, or other Provider execution metadata. Compiler exceptions, false/null/primitive/non-frozen output, invalid component hash/authority, and validator results other than the exact component or literal `true` fail closed.

`DeterministicAssemblyFact@2.0` is also factory-only. It accepts a controlled assembly spec, the complete role set, and actual immutable component+Fact pairs. Provider-authored components must be backed by `ValidatedComponentFact@1.0`; deterministic components must be backed by `DeterministicComponentFact@1.0`. `UnifiedSkillOutputFact@1.0`, monolithic Writer Facts, `write-xhs-content`, and `XhsPostPackage@2.0` cannot be Package components. All Fact refs, component refs/hashes, roles, and authority bindings are revalidated before assembly.

The v2 factory executes the controlled assembler internally and does not accept a preconstructed Package parameter. The returned Package must be deeply frozen, use the specified versioned output contract, expose a `componentRefs` key set exactly equal to `requiredRoles`, bind every ref role by role, preserve the common authority, pass its formal validator, and—when a preflight role exists—bind a passed preflight component. The exact key-set check is owned by the factory and still applies when the injected formal validator returns literal `true`. Assembler/validator throws, false/null/other-object results, failed preflight, stale refs, missing/extra/duplicate roles, and cross-authority input all fail closed.

For Xiaohongshu Package@4 the intended graph is three Provider component facts (`postCopy`, `carouselPlan`, `visualAssetPlan`) plus three deterministic component facts (`finalTitleBinding`, `traceability`, `preflightReport`). The Title `UnifiedSkillOutputFact@1.0` is validated upstream evidence for FinalTitle compilation only; it is not a Package component or Candidate authority. `DeterministicAssemblyFact@1.0`, `UnifiedContentCandidate@2.0`, current flag-off behavior, Server, Orchestrator, Executor, persistence, and historical snapshots remain unchanged. A separate default-off cutover Work Item is required before production use.

There is no data migration. Focused tests exercise the Package@4-shaped six-role graph, internal compiler/assembler execution, upstream classifications, exact/total validators, hash/ref tampering, failed preflight, invalid callback results, input immutability, and cross-locale deterministic ordering. Rollback is a revert of this additive contract/test/documentation change; v1 Facts, Candidate@2, stored data, and the production path are unaffected.

## Unified Skill activity execution port

The Server's existing monolithic Skill execution sequence is exposed through `unified-skill-activity-executor.mjs`. This is a behavior-preserving application port: it validates domain input, invokes the injected Skill runner exactly once, enforces the existing Live single-attempt identity when Live mode is explicitly enabled, validates Runtime evidence and domain output, enforces the Xiaohongshu Design DNA binding, and only then commits compatibility evidence. It does not own Candidate assembly, product state, persistence, Provider configuration, feature flags, or orchestration policy.

`unified-skill-evidence-compiler.mjs` is the compatibility evidence adapter for that port. It compiles the current actual-invocation evidence and `UnifiedSkillOutputFact@1.0`, commits them atomically after all validations pass, resolves exact upstream ContentMaster and WeChat article facts, and returns defensive snapshots rather than mutable internal arrays. Existing Candidate derivation therefore receives the same v1 facts and hashes as before extraction.

This port is not connected to `SkillActivityInvocation@1.0`, `ValidatedComponentFact@1.0`, `DeterministicAssemblyFact@1.0`, `UnifiedContentCandidate@2.0`, or the atomic Run State. A later default-off integration Work Item may replace the runner/evidence adapters behind this port without moving orchestration, Candidate, store, or product-state responsibilities into the Executor. That integration must preserve the current v1 path as an explicit rollback until its contract and end-to-end tests pass. The present rollback is a code revert to the former inline Server sequence; it requires no database migration and rewrites no historical snapshot.

### Atomic Provider activity cutover

When the trusted server dependency `unifiedContentXhsAtomicGraphV1` is exactly `true`, the Server creates one atomic Skill Activity Execution Port and injects it into the Orchestrator. Request payload flags are ignored. The Orchestrator owns the frozen execution request and sequencing only; it neither imports the Xiaohongshu atomic Runtime nor holds Provider transport. PostCopy, Carousel, and VisualAssetPlan execute through that one Port in order, while platform Title generation remains on the existing general Skill Executor. With the flag absent or false, no atomic Port call occurs and the existing nine-invocation `UnifiedSkillOutputFact@1.0`/Candidate@1 product path is unchanged.

The Port owns one Runtime call per activity, strict plan-step binding, a deeply frozen execution plan/input/system context, Live invocation identity when enabled, and the zero-retry attempt boundary. Before the Provider call it creates one formal `SkillActivityInvocation@1.0` binding the exact capability/output-contract version, canonical input+system-context ref/hash, atomic authority, execution-plan hash, and one-attempt policy. After Runtime assembly and validation it commits exactly one deeply frozen `UnifiedAtomicActivityBundle@1.0`: the Invocation, a raw Provider envelope ref/hash (never the raw payload), execution evidence, and the independently verified component. The Evidence Compiler keeps the canonical compiler context in a separate private defensive store; neither the public Bundle nor the Fact Graph treats the raw envelope as component authority.

`unified-atomic-fact-graph-compiler.mjs` is a server-owned, controlled registry for the exact ordered capability set `write-xhs-post-copy`, `plan-xhs-carousel`, and `plan-xhs-visual-assets`. It rejects missing, extra, duplicate, reordered, stale-plan, stale-input, stale-output, component-hash, cross-authority, and monolithic inputs. Only the built-in formal validators can create the three `ValidatedComponentFact@1.0` nodes. The existing successful Xiaohongshu Title `UnifiedSkillOutputFact@1.0` is accepted only as FinalTitle upstream evidence. FinalTitle, Traceability, Preflight, and Package@4 are recompiled through the deterministic Fact/Assembly factories and their hashes must equal the Orchestrator artifacts.

The resulting `UnifiedAtomicFactGraph@1.0` is exact-shaped and deeply frozen. It contains only Activity Bundle refs, component Fact/component refs, the Title Fact ref, atomic authority, and the Assembly Fact ref; it contains no raw Provider payload or copied component content. On the trusted flag-on Server path the graph must compile successfully before the Candidate v3/Usage Binding stage described below. Flag-off remains the unchanged nine-invocation Candidate@1 path. Rollback is disabling the trusted flag or reverting this cutover; there is no schema migration or historical snapshot rewrite.

### Atomic Candidate v3 and Usage Binding cutover

`UnifiedContentCandidate@3.0` is an additive, exact-shaped, deeply frozen atomic candidate. Its only authority family is `atomic_v2`, and its authority contains exactly one `DeterministicAssemblyFact@2.0` ref and one `ContentMechanismUsageBinding@1.0` ref. The factory revalidates both full immutable inputs, the read-only `MechanismExplanation@1.0`, platform-run/company/account identity, and the exact overlapping decision, ContentMaster, platform-run, and Writer Context `{id,hash}` refs. Atomic orchestration uses the canonical `writerContextHash` (the hash of Writer Context fields excluding its own hash field) throughout Invocation authority, Fact Graph, Usage Binding, and Candidate validation; the former hash of the self-hashed whole object is not compatible authority. Candidate@1/2 compatibility authority, AssemblyFact v1, monolithic Writer facts, mixed families, stale hashes, same-ID/different-hash refs, and raw Provider data cannot enter Candidate v3.

`unified-atomic-candidate-compiler.mjs` is controlled code and accepts no validator, compiler, usage conclusion, Provider self-report, or request-level confirmation callback. Planned refs come from the frozen `ContentMechanismDecision@2.0`; Writer-received refs come only from identifiers and exact refs in the frozen SourcePlan actually passed to PostCopy. Proven-used refs require an unambiguous deterministic Trace ID ownership mapping inside that SourcePlan. Missing mappings remain `unknown_not_proven`; title/body/prose inspection is outside the evidence boundary. Ambiguous ownership fails closed.

The strategy-requested creative mechanism is resolved from the exact persisted account-strategy snapshot bound by Writer Context, while the final creative mechanism comes from Writer Context itself. A mismatch requires the strategy snapshot to reference an already stored, hash-valid user confirmation event and a reason. Request payloads cannot inject either the event or an actual-use result.

After Fact Graph, Usage Binding, Explanation, and Candidate v3 compile successfully in memory, the trusted flag-on Server path stops with `UNIFIED_ATOMIC_PERSISTENCE_CUTOVER_PENDING`. It performs no Candidate, Usage Binding, Selection, Delivery, or product-snapshot persistence. The flag-off path still produces the historical nine fixture invocations, Candidate@1, and v1 Facts without hidden Candidate v3 or Usage Binding objects. Disabling the trusted flag is the rollback; there is no schema migration or historical rewrite.

### Atomic immutable Content Commit Store

`UnifiedAtomicContentCommit@1.0` is the additive, immutable transaction aggregate for a future persistence cutover. It contains the exact content-project and platform-run refs, company/account/platform identity, the complete `UnifiedAtomicFactGraph@1.0`, the ordered six Provider/deterministic Component Facts, `DeterministicAssemblyFact@2.0`, `ContentMechanismUsageBinding@1.0`, its read-only `MechanismExplanation@1.0`, `UnifiedContentCandidate@3.0`, and an explicit idempotency key. The factory and total validator re-run every formal nested validator and then close every overlapping Fact, component, assembly, decision, ContentMaster, Writer Context, platform-run, company, account, Candidate, Binding, and Explanation ID/hash/authority reference. Missing, extra, stale, mixed-family, or same-ID/different-hash data fails before a Commit can exist.

The Commit has an exact root shape, stable content hash, and deeply frozen output. It never contains a raw Provider envelope or payload, credentials, upload material, binary bytes, or a mutable projection. Raw-envelope audit refs inside formally validated Provider Component Facts remain refs only and are not content authority.

`unified-atomic-content-commit-store.mjs` exposes only append and defensive commit/candidate/project queries over the additive `unifiedAtomicContentCommits` collection. Append clones and validates the entire Commit before its single collection assignment. Failed validation or conflicts leave the backing store byte-for-byte unchanged. An identical idempotency-key/Commit-hash replay returns the original Commit without another write; key reuse with different semantics, Candidate reuse by another Commit, and platform-run authority conflicts fail closed. A legacy store without the collection is initialized only by the first successful append. Existing product snapshots, Candidate@1, Selection, Delivery, and historical data are never rewritten.

This Store is not connected to Server, feature flags, database schema, UI, Live Provider execution, browser flows, delivery, or publication. It is exercised only with offline fixture stores in this Work Item. Removal of the additive module and collection is the rollback; existing stores require no migration.

### Atomic materialized Content Commit v2

`UnifiedAtomicContentCommit@2.0` additively closes the reconstruction gap left by the ref-and-Fact-oriented v1 aggregate. In addition to the v1 Graph, ordered Component Facts, Assembly Fact, Usage Binding, Explanation, Candidate, identities, and idempotency evidence, v2 contains the exact pre-execution `contentProjectIdentity`, the complete formally validated final `ContentProject@1.0`, six exact ordered materialized entries (`role`, `kind`, `fact`, `component`, and the role's fixed hash-field name), and the complete formally validated `XhsPostPackage@4.0` assembly output. The Identity contains exactly project ID, company, content-opportunity ref, active-strategy ref, and their stable `identityHash`; the Commit `contentProjectRef` matches `{id, identityHash}` and therefore preserves the Graph/Invocation authority that existed before execution. The separate `materializedContentProjectRef` matches `{id: contentProject.id, hash: contentProject.projectHash}` for later product reads. These refs have different temporal semantics and must never be substituted for one another or retroactively rebound in signed Facts.

The v2 validator uses a closed role registry and cannot accept caller-supplied validators. It re-runs `validateXhsPostCopy`, `validateXhsFinalTitleBinding`, `validateXhsCarouselPlanV2`, `validateXhsVisualAssetPlan`, `validateXhsTraceabilityV2`, `validateXhsContentPreflightReportV2`, and `validateXhsPostPackageV4`; independently recomputes every declared component/package hash; and matches every role, kind, contract, Fact ref, component ref, Graph ref, Assembly Fact ref, and Package component ref. Final project ID/company/opportunity/strategy must match the pre-execution Identity, and its Xiaohongshu platform run must match the Commit's exact run/account/master authority. Product authority in the materialized components must agree with the Identity, final project's company, active strategy, opportunity, shared ContentMaster and platform run, while execution authority must agree on company/account/pre-execution project ref/run, mechanism decision, shared ContentMaster, and Writer Context. Raw Provider envelopes or payloads, unvalidated Provider metadata, credentials, upload material, binary data, temporary/signed URLs, and mutable projections are forbidden.

The same append-only Store accepts either formally validated v1 compatibility evidence or a v2 aggregate and preserves the existing single-assignment, lazy-initialization, idempotent-replay, collision, authority-conflict, and defensive-copy semantics. v1 remains readable compatibility evidence only and is not sufficient authority for a future reconstructed product projection. JSON serialization of v2 retains the full post copy, final title binding, carousel plan, visual plan, traceability, preflight report, and package. This additive contract is still not connected to Server, feature flags, database schema, UI, Live execution, selection, delivery, publication, or feedback; no existing or historical object is migrated or rewritten.

## Rollback

Consumers can stop importing `unified-content-contracts.mjs` or `xhs-content-components.mjs`; all historical objects remain untouched. Reverting the additive component implementation removes the foundation without a database, artifact, Skill, manifest, orchestrator, or feature-flag rollback.
