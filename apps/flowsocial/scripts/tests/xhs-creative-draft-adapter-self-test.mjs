import assert from "node:assert/strict";
import { adaptXhsContentToCreativeDraft } from "../../content-agent/xhs-creative-draft-adapter.mjs";

const input = { capability: "write-xhs-content", runtimeOutput: { status: "success", data: { platform: "xiaohongshu", content_promise: "Promise", post_copy: { title_candidates: [{ title: "Title", hook_type: "result", claim_ids: [], risk: "low" }], recommended_title: "Title", opening: "Open", body_sections: [{ text: "Body", role: "scene", claim_ids: [], knowledge_asset_ids: [] }], ending: "End", hashtags: [], cta: "" }, engagement_strategy: { mode: "auto", primary_action: "save", reason: "r", cta_placement: "ending", cta_text: "" } } }, confirmedOutline: { outline_id: "o", sections: [{ sectionId: "S1", outlineRole: "hook" }] } };
const mapped = adaptXhsContentToCreativeDraft(input);
assert.equal(mapped.capability, "write-xhs-post-copy");
assert.equal(mapped.draft.data.bodySections[0].sectionId, "S1");
assert.equal(mapped.draft.data.bodySections[0].outlineRole, "hook");
assert.equal(mapped.draft.data.bodySections[0].text, "Body");
assert.throws(() => adaptXhsContentToCreativeDraft({ ...input, capability: "write-wechat-article" }), (e) => e.code === "XHS_CREATIVE_DRAFT_ADAPTER_CAPABILITY_INVALID");
assert.throws(() => adaptXhsContentToCreativeDraft({ ...input, runtimeOutput: { ...input.runtimeOutput, data: { ...input.runtimeOutput.data, platform: "wechat" } } }), (e) => e.code === "XHS_CREATIVE_DRAFT_ADAPTER_PLATFORM_INVALID");
assert.throws(() => adaptXhsContentToCreativeDraft({ ...input, confirmedOutline: { sections: [] } }), (e) => e.code === "XHS_CREATIVE_DRAFT_ADAPTER_SECTION_COVERAGE_INVALID");
console.log(JSON.stringify({ status: "xhs-creative-draft-adapter-self-test passed", providerCalls: 0, externalEffects: 0 }, null, 2));
