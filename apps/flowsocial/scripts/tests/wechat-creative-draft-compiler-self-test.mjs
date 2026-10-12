import assert from "node:assert/strict";
import { createUnifiedWriterContext, hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { compileWechatCreativeDraft, materializeWechatCreativeDraft, validateWechatCreativeDraft } from "../../content-agent/wechat-creative-draft-compiler.mjs";

const source = { confirmed_facts: [{ fact_id: "F1", source_ids: ["S1"] }], supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "S1", title: "Fixture" }], knowledge_contract: { allowed_assets: [] } };
const authorityRefs = Object.fromEntries(["activeStrategySnapshotRef", "contentOpportunityRef", "mechanismDecisionRef", "accountRef", "accountStrategyRef", "sharedContentMasterRef", "platformBriefRef", "confirmedOutlineRef"].map((key) => [key, { id: key, hash: "a".repeat(64) }]));
const writer_context = createUnifiedWriterContext({ schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "wechat_official_account", account_id: "acct", topic_id: "topic", intent_profile_id: "intent", content_purpose_id: "purpose", account_context: { subject_type: "company", account_mode: "official", matrix_role: "primary", trust_source: "institution" }, creative_mechanism: "framework", journey_stage: "understand", coordination_mode: "standalone", matrix_coordination: { shared_campaign_topic_id: "", differentiation_angle: "direct", prohibited_overlap: [] }, authority_refs: authorityRefs });
const input = { platform: "wechat_official_account", content_master: source, platform_brief: { platform: "wechat" }, confirmed_outline: { platform: "wechat" }, writer_context };
const checks = ["title_body_alignment", "argument_continuity", "claim_traceability", "marketing_disclosure", "intent_and_promotion_alignment", "account_identity_alignment", "relationship_handoff_validity", "matrix_differentiation"].map((check) => ({ check, result: ["marketing_disclosure", "relationship_handoff_validity", "matrix_differentiation"].includes(check) ? "not_applicable" : "pass", detail: "fixture" }));
const draft = { article_promise: "Explain the workflow", core_argument: "Evidence must remain traceable", information_gain: "A deterministic review path", title_candidates: ["A", "B", "C"], recommended_title: "A", abstract: "A useful abstract", opening: { type: "question", text: "Why?", claim_ids: ["F1"] }, outline: [{ section_id: "W1", heading: "Start", purpose: "Frame", relation_to_previous: "start", claim_ids: ["F1"], boundary_to_cover: "scope" }, { section_id: "W2", heading: "Proof", purpose: "Support", relation_to_previous: "support", claim_ids: ["F1"], boundary_to_cover: "evidence" }, { section_id: "W3", heading: "End", purpose: "Close", relation_to_previous: "conclude", claim_ids: [], boundary_to_cover: "action" }], article_markdown: "## Start\nopening\n## Proof\nevidence\n## End\nclose", pull_quotes: [], key_takeaways: ["Trace claims"], share_summary: "Share", share_reason: "Useful", discovery_plan: { subscription_value: "value", search_keywords: [], recommendation_hook: "hook", social_sharing_context: "context" }, relationship_handoff: { column: "", related_content_ids: [], menu_path: "", keyword_reply: "", follow_reason: "reason", primary_next_step: "next" }, engagement_strategy: { mode: "auto", primary_action: "share", reason: "reason", cta_placement: "ending", cta_text: "" }, cta: "" };

assert.equal(validateWechatCreativeDraft(draft).recommended_title, "A");
assert.throws(() => validateWechatCreativeDraft({ ...draft, account_context: {} }), /runtime-owned/);
const result = compileWechatCreativeDraft({ draft, sourceContentMaster: source, sourceSkillInput: input, preflightChecks: checks });
assert.equal(result.outputContract, "WechatArticle@2.0");
assert.equal(result.data.source_list[0].source_id, "S1");
assert.equal(result.rawDraft.article_markdown, draft.article_markdown);
const inventedClaimDraft = structuredClone(draft);
inventedClaimDraft.opening.claim_ids.push("O_INVENTED");
inventedClaimDraft.outline[0].claim_ids.push("O_INVENTED");
const sanitizedClaims = compileWechatCreativeDraft({ draft: inventedClaimDraft, sourceContentMaster: source, sourceSkillInput: input, preflightChecks: checks });
assert.equal(JSON.stringify(sanitizedClaims.data).includes("O_INVENTED"), false);
const normalizedHeading = compileWechatCreativeDraft({ draft: { ...draft, outline: draft.outline.map((s, i) => i === 1 ? { ...s, heading: "Changed" } : s) }, sourceContentMaster: source, sourceSkillInput: input, preflightChecks: checks });
assert.match(normalizedHeading.data.article_markdown, /## Changed/);
const compact = materializeWechatCreativeDraft({
  article_markdown: draft.article_markdown,
  title_candidates: draft.title_candidates,
  outline: draft.outline.map(({ section_id, heading }) => ({ section_id, heading })),
  information_gain: draft.information_gain
}, { sourceSkillInput: input });
assert.equal(validateWechatCreativeDraft(compact).recommended_title, "A");
console.log("wechat creative draft compiler self-test passed");
