# Atomic WeChat Draft Creation V1

`AtomicWechatDraftCreation@1.0` adds a controlled WeChat `draft/add` step after the exact resource-upload and final-delivery closure. It creates a draft only; it never publishes the article.

## Human decision and external-effect boundary

- The feature is default-off behind `ATOMIC_WECHAT_DRAFT_CREATION_V1=1`.
- A read-only preview binds the exact delivery, promoted version, title, final post-upload HTML hash, and cover `media_id`.
- Every call requires `actorType=user`, an actor ID, a timestamp, the current preview token, an idempotency key, and a one-time UI confirmation. There is no persistent or future default approval.
- One exact delivery can have at most one external draft attempt. An idempotent replay performs zero provider calls; a new key is rejected after any prior success or unknown-result attempt.
- A successful response records both `AtomicWechatDraftCreationExecution@1.0` and `WechatDraftArtifactFact@1.0` with `wechat_draft_created_not_published` semantics.
- A network/transport response that cannot prove success or failure records `result_unknown`, freezes further attempts, and requires manual reconciliation in the WeChat admin console.

## Compatibility and downstream impact

There is no database migration. The JSON store lazily adds `unifiedAtomicWechatDraftExecutions`; successful draft facts append to the existing `unifiedContentWechatLifecycleFacts` collection. Existing clients and existing delivery/publication records remain readable. Draft routes return 404 while the feature flag is disabled.

Manual publication confirmation remains a separate human gate. Draft creation does not authorize or trigger publication, feedback collection, or any Xiaohongshu operation.

## Rollback

Disable `ATOMIC_WECHAT_DRAFT_CREATION_V1` and restart the server. Historical execution and lifecycle facts remain immutable audit evidence. Disabling the feature does not remove a draft already created in WeChat; if removal is required, reconcile and delete it manually in the WeChat admin console. Never automatically retry or delete a draft whose result is unknown.
