import { runContentSkill } from "./skill-runner.mjs";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

export async function proposeNaturalization(task, payload = {}, { generateText, planStep = null }) {
  const mode = payload.mode === "rewrite_copy_only" ? "rewrite_copy_only" : "audit_only";
  const editableRanges = list(payload.editableRanges || payload.editable_ranges);
  if (!String(payload.text || "").trim()) throw Object.assign(new Error("text is required"), { statusCode: 400 });
  if (mode === "rewrite_copy_only" && payload.authorized !== true) throw Object.assign(new Error("Explicit user authorization is required for rewriting"), { statusCode: 409, code: "NATURALIZATION_AUTHORIZATION_REQUIRED" });
  if (mode === "rewrite_copy_only" && !editableRanges.length) throw Object.assign(new Error("editableRanges is required for rewriting"), { statusCode: 400 });
  const input = {
    mode,
    platform: task.platform,
    text: payload.text,
    account_tone: payload.accountTone || task.accountStyleSnapshot?.tone || null,
    protected_spans: list(payload.protectedSpans || payload.protected_spans),
    protected_claims: list(payload.protectedClaims || task.contentMaster?.confirmed_facts),
    editable_ranges: editableRanges,
    locked_structure: payload.lockedStructure !== false,
    authorization: { confirmed: payload.authorized === true, confirmed_at: payload.authorizedAt || null }
  };
  const fallback = {
    status: "success",
    data: { mode, findings: [], revised_text: null, changes: [], protected_field_check: { passed: true, violations: [] }, requires_fact_recheck: false },
    warnings: [mode === "rewrite_copy_only" ? "Provider unavailable; original copy was kept." : "Provider unavailable; audit returned no model findings."],
    blocked_reasons: []
  };
  const result = await runContentSkill({ capability: "naturalize-copy", platform: task.platform, input, generateText, fallback, expectedContract: "NaturalizationResult@1.0", task: "naturalize_copy", planStep });
  const proposal = result?.data?.data || result?.data || fallback.data;
  if (mode === "audit_only") proposal.revised_text = null;
  return {
    status: result?.data?.status || (proposal.protected_field_check?.passed === false ? "needs_review" : "success"),
    data: proposal,
    warnings: result?.data?.warnings || fallback.warnings,
    blocked_reasons: result?.data?.blocked_reasons || [],
    applied: false,
    requiresHumanConfirmation: mode === "rewrite_copy_only",
    skillTrace: result.skillTrace,
    executionRecord: result.executionRecord,
    providerMode: result.mode || "unknown"
  };
}
