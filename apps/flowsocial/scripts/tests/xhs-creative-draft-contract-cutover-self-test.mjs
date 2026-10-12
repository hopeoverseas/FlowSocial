import assert from "node:assert/strict";
import { compileXhsCreativeDraft, validateXhsCarouselCreativeDraft } from "../../content-agent/xhs-creative-draft-compiler.mjs";
import { buildSecretSafeProviderRequestSnapshot } from "../../llm/provider-adapters.mjs";
import { resolveLlmProfile, resolveLlmTaskBudget } from "../../llm/task-registry.mjs";

const sections = ["hook", "problem", "diagnosis", "evidence", "method", "action"].map((outlineRole, index) => ({ sectionId: `S${index + 1}`, outlineRole }));
const draft = {
  status: "success",
  data: {
    schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", reading_arc: "promise-action",
    section_drafts: sections.map((_, index) => ({ objective: `Objective ${index + 1}`, takeaway: `Takeaway ${index + 1}`, text_layers: [{ type: "headline", text: `Headline ${index + 1}`, max_lines: 2, priority: 1 }], layout_hint: `Layout ${index + 1}`, fact_ids: [], interpretation_ids: [], knowledge_asset_ids: [] }))
  },
  warnings: [], blocked_reasons: []
};

const compiled = compileXhsCreativeDraft({ capability: "plan-xhs-carousel", draft, confirmedOutline: { sections } });
assert.equal(compiled.data.pages.length, 6);
assert.equal(validateXhsCarouselCreativeDraft(draft).pages.length, 6);
for (const key of ["page", "page_number", "outline_section_id", "outline_role", "role", "authorityBinding", "hash"]) {
  const invalid = structuredClone(draft);
  invalid.data.section_drafts[0][key] = key === "hash" ? "a".repeat(64) : 1;
  assert.throws(() => validateXhsCarouselCreativeDraft(invalid), (error) => error.code === "XHS_CREATIVE_DRAFT_MACHINE_FIELDS_FORBIDDEN");
}

const profile = resolveLlmProfile("xhs_carousel_creative_draft");
const budget = resolveLlmTaskBudget("plan_xhs_carousel");
assert.equal(profile.temperature, 0.4);
assert.equal(profile.maxOutputTokens, 8192);
assert.equal(profile.structuredOutput, "json_object");
assert.equal(profile.reasoning.enabled, false);
const snapshot = buildSecretSafeProviderRequestSnapshot({
  payload: { input: { outline_cardinality: { sectionCount: 6, sectionOrder: sections }, apiKey: "super-secret" } },
  contract: "XhsCarouselPlanCreativeOutput@1.0", profile, capabilities: { jsonObject: true, reasoningControl: "thinking_toggle", thinkingToggle: true }, taskBudget: budget
});
assert.equal(snapshot.cardinality.sectionCount, 6);
assert.match(snapshot.messages.find((message) => message.content.includes("CARDINALITY"))?.content || "", /exactly 6 creative section drafts/);
assert.equal(JSON.stringify(snapshot).includes("super-secret"), false);
assert.equal(snapshot.profile.temperature, 0.4);
assert.equal(snapshot.profile.maxOutputTokens, 8192);
console.log(JSON.stringify({ status: "xhs creative draft contract cutover self-test passed", providerCalls: 0, retries: 0, externalEffects: 0 }, null, 2));
