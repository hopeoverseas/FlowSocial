# XhsCarouselPlanCreativeOutput@1.0

This is the exact Provider-owned creative output consumed before the system constructs title-bound `XhsCarouselPlan@2.0`. All objects use exact keys. Missing, extra, `null`, primitive, duplicate, unauthorized, or incorrectly typed values are invalid. The default Gateway requires `data.section_drafts`; historical `data.pages`/`data.deck` shapes are read-only compatibility inputs and are not accepted by the default Provider contract.

## Inputs

Require all of the following exact upstream values:

- approved `XhsPostCopy@1.0`;
- immutable, system-created `XhsFinalTitleBinding@1.0` whose `postCopyRef` exactly matches that PostCopy and whose title-output ref/hash has already been verified;
- confirmed outline whose `outline_id` and hash match the post authority binding;
- shared ContentMaster that authorizes every referenced fact, interpretation, and knowledge asset;
- Xiaohongshu platform brief;
- confirmed Design DNA reference and snapshot.

Treat all inputs as immutable. The post supplies approved copy; the final-title binding supplies the only canonical cover title; the outline supplies section order and roles; ContentMaster supplies claim and knowledge authority; the platform brief and Design DNA constrain style without becoming output authority fields. A WeChat article is never an input or master.

## Exact Output

`ENVELOPE_KEYS_EXACT: status,data,warnings,blocked_reasons`

`SUCCESS_DATA_KEYS_EXACT: schemaVersion,contract,deck_id,reading_arc,pages`

`PAGE_KEYS_EXACT: objective,takeaway,text_layers,layout_hint,fact_ids,interpretation_ids,knowledge_asset_ids`

`TEXT_LAYER_KEYS_EXACT: type,text,max_lines,priority`

```json
{
  "status": "success",
  "data": {
    "schemaVersion": "1.0",
    "contract": "XhsCarouselPlanCreativeOutput@1.0",
    "deck_id": "DECK001",
    "reading_arc": "承诺 → 问题 → 判断 → 方法 → 证据 → 行动",
    "pages": [
      {
        "objective": "建立阅读承诺",
        "takeaway": "读者将获得一套可执行方法",
        "text_layers": [
          {"type": "headline", "text": "与 XhsFinalTitleBinding.title 完全一致", "max_lines": 3, "priority": 1}
        ],
        "layout_hint": "标题优先，保留稳定留白",
        "fact_ids": [],
        "interpretation_ids": [],
        "knowledge_asset_ids": []
      }
    ]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

The JSON above shows field shape. A successful instance must contain 6–10 pages and one page for every confirmed outline section.

## Deterministic Rules

- Allow exactly three statuses: `success`, `needs_review`, and `blocked`. Successful data must declare `schemaVersion="1.0"` and `contract="XhsCarouselPlanCreativeOutput@1.0"`; missing, extra, `null`, primitive, or mismatched discriminators are invalid.
- For `success`, require the exact success-data keys above, `warnings=[]`, and `blocked_reasons=[]`.
- For `needs_review` or `blocked`, require `data:null`, string-array `warnings`, and a non-empty string-array `blocked_reasons`. Non-success is not a completed Skill Invocation and is never assembly-eligible; the Adapter must stop without defaulting, repairing, or extracting partial pages.
- Require `deck_id` and `reading_arc` to be non-empty strings. Provider output must not contain canvas.
- Require page count and confirmed outline section count to be equal and between 6 and 10.
- Preserve creative-page array order so index `n` corresponds to confirmed outline section index `n`. Do not output page number, outline section ID, outline role, or page role.
- Require every objective, takeaway, layout hint, and text-layer text to be non-empty. Allow 1–4 text layers per page. Allow layer type only `headline`, `body`, `label`, or `footer`; require positive integer `max_lines` and `priority`.
- Reader-visible structural labels must use natural Simplified Chinese. Internal routing markers such as `HOOK`, `JUDGE`, `METHOD 1/4`, `ACTION`, `cover`, `problem`, `method` and `cta` are forbidden in `text_layers[].text`; ordinary content terms such as `AI`, `SaaS` and `SOP` remain allowed when they belong to the approved copy.
- Require the first-page canonical headline to equal `XhsFinalTitleBinding.title` byte for byte. Never select, score, rewrite, shorten, beautify, or fall back to `XhsPostCopy.recommendedTitle`; the preliminary title may legitimately differ. Reuse or condense other verified post copy; never generate a replacement full article inside page layers.
- Require every page takeaway and every normalized full-page text to be unique. Do not add pages merely to reach a count.
- Permit only unique non-empty IDs. `fact_ids`, `interpretation_ids`, and `knowledge_asset_ids` must be subsets of the corresponding ContentMaster authorities. Do not reference author opinion IDs.

## System-Owned Assembly

After validation, the deterministic Runtime maps creative fields to `XhsCarouselPlan@2.0` and injects only system-owned values:

- component `schemaVersion` and `contract`, component `id`, `authorityBinding`, `postCopyRef`, immutable `finalTitleBindingRef`, confirmed `designDnaVersion`, fixed canvas `{width:1080,height:1440,ratio:"3:4"}`, per-page authority-derived `mustAvoid`, and `componentHash`;
- consecutive page numbers from 1; confirmed outline section IDs and outline roles by array index; and the fixed role mapping `hook→cover`, `problem→problem`, `diagnosis→conclusion`, `evidence→evidence`, `method→method`, `example→case`, `action→cta`, `boundary→warning`;
- camelCase projection of creative snake_case fields.

The creative output's `schemaVersion` and `contract` are machine-readable discriminators for the creative-output contract; they do not become the component's discriminators. The Runtime must reject a missing/stale binding, mismatched PostCopy/title-output ref or hash, unauthorized title claim, cover mismatch, or page-count mismatch before assembly. It must not rewrite page text, objectives, takeaways, layout hints, title, or claim and knowledge references. The creative output must not contain any system-owned field.

The Gateway invokes the Provider only after `validateXhsCarouselCreativeDraftGateway` accepts this section-only shape. `projectXhsCarouselCreativeDraftToCompiled` is the explicit compatibility projection for historical compiled plans.

## Forbidden Keys and Work

Reject `canvas`, `page`, `outline_section_id`, `outline_role`, `role`, `content_promise`, `engagement_strategy`, `post_copy`, full article fields, `visual_need`, `visual_function`, `render_strategy`, `asset_ids`, `image_specs`, image prompts, `traceability`, `page_claim_map`, `preflight_checks`, gate results, render output, selection, Promotion, delivery, and publication fields anywhere in the creative output.
