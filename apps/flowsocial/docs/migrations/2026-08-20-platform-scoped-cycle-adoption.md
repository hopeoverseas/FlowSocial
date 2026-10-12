# Platform-scoped cycle adoption compatibility note

## Behavior change

- A confirmed WeChat publishing-cycle slot now defaults to the existing single-platform `ContentRun` path.
- The WeChat default path does not create a unified dual-platform prerequisite and therefore does not require a confirmed Xiaohongshu Design DNA snapshot.
- The unified shared-master/two-outline bootstrap remains available only through the explicit “同时制作双平台” action.
- Xiaohongshu integrated-page production continues to use the existing unified bootstrap. Its button now states that it enters dual-platform production so the side effect is no longer implicit.
- The Xiaohongshu design stage now exposes the three style packs shipped by `design-xhs-integrated-pages`; the exact selected style pack is recorded in the immutable visual-direction request.

## Compatibility and downstream impact

- No stored cycle, prerequisite, project, ContentRun, outline, or Design DNA schema changes.
- Historical slots with `contentRunId` or `unifiedProjectId` remain readable and idempotent.
- Existing API clients calling `adopt-to-unified-project` retain the previous dual-platform behavior.
- Existing API clients calling `slots/:slotId/runs` retain the previous platform-scoped behavior.
- UI automation that expected every cycle action to call `adopt-to-unified-project` must select the explicit dual-platform action instead.

## Rollback

- Revert the UI routing in `startV2Run` and the cycle card actions. No data migration or record rewrite is required.
- Removing the style selector falls back to the existing `editorial-metaphor` default and does not invalidate prior design evidence.
