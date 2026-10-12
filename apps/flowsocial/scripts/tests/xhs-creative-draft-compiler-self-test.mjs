import assert from "node:assert/strict";
import { compileXhsCreativeDraft, listXhsCreativeDraftForbiddenKeys } from "../../content-agent/xhs-creative-draft-compiler.mjs";

const outline = { outline_id: "outline:fixture", sections: [{ sectionId: "S1", outlineRole: "hook" }] };
const master = { confirmed_facts: [{ fact_id: "F1" }], supported_interpretations: [] };
const draft = { status: "success", warnings: [], blocked_reasons: [], data: {
  schemaVersion: "1.0", contract: "XhsPostCopyCreativeOutput@1.0", contentPromise: "Deliver a bounded workflow.",
  engagementStrategy: { mode: "auto", primaryAction: "save", reason: "workflow", ctaPlacement: "ending", ctaText: "Save" },
  titleCandidates: [{ title: "A bounded workflow", hookType: "result", claimIds: [], risk: "low" }], recommendedTitle: "A bounded workflow",
  opening: "Start here.", bodySections: [{ sectionId: "S1", outlineRole: "hook", role: "scene", text: "The first step.", claimIds: ["F1"], knowledgeAssetIds: [] }],
  ending: "Finish the step.", pinnedComment: "", hashtags: ["workflow"], cta: "Save this.", promotionUse: { mode: "none", itemIds: [], disclosure: "" }
} };
const base = { capability: "write-xhs-post-copy", draft, contentMaster: master, confirmedOutline: outline, platformBrief: {}, writerContext: { authorizedKnowledgeAssetIds: [], authority_refs: {} }, mechanismDecision: {}, promotionPolicy: {} };
assert.throws(() => compileXhsCreativeDraft({ ...base, capability: "plan-xhs-carousel" }), (error) => error.code === "XHS_CREATIVE_DRAFT_CAPABILITY_INVALID");
assert.throws(() => compileXhsCreativeDraft({ ...base, draft: { ...draft, data: { ...draft.data, id: "provider-id" } } }), (error) => error.code === "XHS_CREATIVE_DRAFT_MACHINE_FIELDS_FORBIDDEN");
assert.equal(listXhsCreativeDraftForbiddenKeys().includes("authorityBinding"), true);
console.log(JSON.stringify({ status: "xhs-creative-draft-compiler-self-test passed", providerCalls: 0, retries: 0, externalEffects: 0 }, null, 2));
