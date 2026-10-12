import assert from "node:assert/strict";
import { validateContract, validateXhsCarouselCreativeDraftGateway } from "../../llm/contracts.mjs";
import { compileXhsCreativeDraft } from "../../content-agent/xhs-creative-draft-compiler.mjs";

const sections = ["hook", "problem", "diagnosis", "evidence", "method", "action"].map((role, i) => ({ sectionId: `s${i + 1}`, outlineRole: role }));
const draft = { status: "success", data: { schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", reading_arc: "promise-action", section_drafts: sections.map((_, i) => ({ objective: `objective-${i}`, takeaway: `takeaway-${i}`, text_layers: [{ type: "headline", text: `headline-${i}`, max_lines: 2, priority: 1 }], layout_hint: "text-first", fact_ids: [], interpretation_ids: [], knowledge_asset_ids: [] })) }, warnings: [], blocked_reasons: [] };

assert.equal(validateXhsCarouselCreativeDraftGateway(draft).errors.length, 0);
assert.equal(validateContract("XhsCarouselPlanCreativeOutput@1.0", draft).valid, true);
const compiled = compileXhsCreativeDraft({ capability: "plan-xhs-carousel", draft, confirmedOutline: { sections } });
assert.equal(compiled.data.contract, "XhsCarouselPlanCreativeOutput@1.0");
assert.equal(compiled.data.pages.length, 6);

const mechanical = structuredClone(draft);
mechanical.data.section_drafts[0].page = 1;
assert(validateXhsCarouselCreativeDraftGateway(mechanical).errors.some((error) => error.includes("Runtime-owned")));

const historical = { status: "success", data: { schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", deck_id: "legacy", reading_arc: "arc", pages: draft.data.section_drafts.map((page) => ({ ...page, page: 1, role: "cover" })) }, warnings: [], blocked_reasons: [] };
assert(validateXhsCarouselCreativeDraftGateway(historical).errors.length > 0);
console.log(JSON.stringify({ status: "xhs creative draft gateway contract self-test passed", providerCalls: 0, retries: 0, externalEffects: 0 }, null, 2));
