# MiniMax visual analysis and default product start

## User-visible change

- `npm start` now starts FlowSocial in local product mode, so Content Production and the platform-separated production entries are enabled by default.
- Visual source upload remains local and does not call a provider automatically.
- A user must select exact source files and confirm the displayed provider-call count before MiniMax analysis starts.
- JPEG, PNG and WebP use MiniMax Coding Plan VLM (`/v1/coding_plan/vlm`). PDF, PPTX, DOCX and article files use locally extracted text with the configured MiniMax Anthropic-compatible text model.
- Analysis produces an editable draft. It does not become active Design DNA until the existing human confirmation step is completed.

## Compatibility and configuration

- Existing `npm run start:offline` keeps the fail-closed feature-flag behavior.
- Vision credentials are read from `MINIMAX_API_KEY`, falling back to `ANTHROPIC_API_KEY` so one MiniMax key can be used for both configured services.
- `MINIMAX_API_HOST` defaults to `https://api.minimaxi.com`. No key is stored in source control.
- PDF embedded imagery is not sent to the VLM. Users must export important pages to JPEG/PNG/WebP for visual analysis.

## Provider budget and effects

- Maximum eight selected sources per request.
- Exactly one provider call per selected source and no automatic retries.
- The response records the approved and used call count plus source-level analysis evidence.

## Rollback

- Restore the previous `package.json` start command to disable default product mode.
- Remove the `/accounts/:id/design-dna/analyze` route and its UI action. Existing confirmed Design DNA snapshots remain valid and immutable.
