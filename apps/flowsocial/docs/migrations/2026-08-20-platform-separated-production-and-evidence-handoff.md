# Platform-separated production and exact evidence handoff

## User-visible changes

- Content-plan slots expose one action for their own platform. The UI no longer offers a dual-platform production action.
- The content-production project list projects platform-specific task cards and opens the selected platform workspace directly.
- Cycle capacity conflicts are shown on the affected account's cards instead of as a global blocker.
- A valid outline created after a model fallback remains reviewable. The UI shows the connection failure and lets a user review, regenerate, or confirm the retained outline.
- Visual uploads no longer create one Design DNA snapshot per file. Files are uploaded first and are summarized into one explicitly requested, reviewable snapshot.
- Image uploads explicitly report that OCR or multimodal visual understanding has not run.

## Data and compatibility

- Existing `PublishingCyclePlan.unifiedProjectId` and unified project records are preserved. They are treated as internal implementation references and no longer define the user-facing platform scope.
- Existing blocked ContentRuns with a retained outline can be recovered by saving the displayed outline; this transitions the run back to `outline_ready` before human confirmation.
- The outline route now resolves user-selected knowledge-file IDs directly from the knowledge database and freezes their chunks into the knowledge snapshot. Query-based retrieval is still merged for compatibility.
- `POST /accounts/:id/visual-assets` still returns the uploaded file and now returns an `extraction` disclosure. `designDnaSnapshot` is `null`; clients must use the existing explicit Design DNA authoring endpoint after all uploads.

## Downstream impact

- Consumers that assumed every visual upload immediately created a Design DNA snapshot must switch to the explicit authoring action.
- Content history and run detail remain compatible; platform cards are a frontend projection only.
- No publication, provider call, upload to a social platform, or irreversible effect is introduced.

## Rollback

- Revert the frontend platform projection and restore the former slot actions if needed.
- Revert exact-file evidence merging to the previous query-only retrieval behavior.
- Restore per-upload Design DNA snapshot creation only if clients cannot adopt the explicit batch authoring action; doing so may create multiple unwanted pending versions.
