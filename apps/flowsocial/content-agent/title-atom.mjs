import { runContentSkill } from "./skill-runner.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const clean = (value) => typeof value === "string" ? value.trim() : "";

function packageTitles(platform, contentPackage) {
  return platform === "xiaohongshu"
    ? list(contentPackage?.post_copy?.title_candidates)
    : list(contentPackage?.title_candidates);
}

function currentTitle(platform, contentPackage) {
  return platform === "xiaohongshu"
    ? clean(contentPackage?.post_copy?.recommended_title)
    : clean(contentPackage?.recommended_title);
}

function fallbackEnvelope({ platform, contentMaster, contentPackage }) {
  const existing = [...new Set([...packageTitles(platform, contentPackage), currentTitle(platform, contentPackage)].map(clean).filter(Boolean))];
  const candidates = existing.map((title, index) => ({
    title_id: `P${String(index + 1).padStart(2, "0")}`,
    title,
    motivation: index === 0 ? "balanced" : "safe",
    method: "writer_preliminary",
    claim_ids: [],
    scores: { fulfillment: 3, relevance: 3, specificity: 3, curiosity: 3, clarity: 3, uniqueness: 3, overall: 3 },
    risk: "low",
    risk_reasons: []
  }));
  return {
    status: candidates.length ? "success" : "needs_review",
    data: {
      stage: "final_after_body",
      platform: platform === "wechat" ? "wechat_official_account" : platform,
      title_brief: {},
      candidates,
      recommendations: { balanced: candidates[0]?.title_id || "", safe: candidates[1]?.title_id || candidates[0]?.title_id || "", spread: "", search: "", experiment: "" },
      ab_tests: [],
      same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" }
    },
    warnings: [],
    blocked_reasons: []
  };
}

function titleData(raw, fallback) {
  if (Array.isArray(raw?.data?.candidates)) return raw.data;
  if (Array.isArray(raw?.candidates)) return raw;
  return fallback.data;
}

function recommendationCandidate(data, candidates) {
  const requested = data?.recommendations?.balanced;
  return candidates.find((item) => item.title_id === requested || item.title === requested)
    || [...candidates].sort((left, right) => Number(right.scores?.overall || 0) - Number(left.scores?.overall || 0))[0]
    || null;
}

export async function optimizeFinalTitles({ platform, contentMaster, contentPackage, contentTaskBrief = null, sameAccountTitleSignals = [], accountTone = null, contentPatternSnapshot = null, skillPatternPacks = [] }, deps) {
  const fallback = fallbackEnvelope({ platform, contentMaster, contentPackage });
  const result = await runContentSkill({
    capability: "generate-platform-titles",
    platform,
    input: {
      stage: "final_after_body",
      platform: platform === "wechat" ? "wechat_official_account" : platform,
      content_master: contentMaster,
      completed_content: contentPackage,
      preliminary_titles: packageTitles(platform, contentPackage),
      content_task_brief: contentTaskBrief,
      same_account_title_signals: list(sameAccountTitleSignals),
      account_tone: accountTone,
      content_pattern_snapshot: contentPatternSnapshot,
      skill_pattern_packs: list(skillPatternPacks)
    },
    generateText: deps.generateText,
    fallback,
    expectedContract: "PlatformTitleList@1.0",
    task: "generate_final_platform_titles",
    planStep: deps.planStep || null
  });

  const data = titleData(result.data, fallback);
  const knownClaims = new Set(list(contentMaster?.confirmed_facts).map((item) => item.fact_id).filter(Boolean));
  const candidates = list(data.candidates).map((item, index) => ({
    ...item,
    title_id: clean(item.title_id) || `T${String(index + 1).padStart(2, "0")}`,
    title: clean(item.title),
    claim_ids: list(item.claim_ids),
    risk: ["low", "medium", "high"].includes(item.risk) ? item.risk : "medium",
    risk_reasons: list(item.risk_reasons)
  })).filter((item) => item.title);
  const traceable = candidates.filter((item) => item.claim_ids.every((claimId) => knownClaims.has(claimId)));
  const eligible = traceable.filter((item) => item.risk !== "high");
  const selected = recommendationCandidate(data, eligible);
  const updated = structuredClone(contentPackage);
  const finalTitles = eligible.map((item) => item.title).slice(0, 8);

  if (selected) {
    if (platform === "xiaohongshu") {
      updated.post_copy = { ...updated.post_copy, title_candidates: finalTitles, recommended_title: selected.title };
    } else {
      updated.title_candidates = finalTitles;
      updated.recommended_title = selected.title;
    }
  }

  const checks = [
    { check: "final_title_selected", result: selected ? "pass" : "fail" },
    { check: "final_title_claims_traceable", result: candidates.length === traceable.length ? "pass" : "fail" },
    { check: "final_title_risk_gate", result: selected?.risk === "high" ? "fail" : "pass" }
  ];
  const usedFallback = result.telemetry?.fallbackUsed === true || ["validated_fallback", "orchestrator_fallback", "demo_fallback"].includes(result.mode);

  return {
    contentPackage: updated,
    titleStrategy: { ...data, candidates, selected_title_id: selected?.title_id || null, selected_title: selected?.title || currentTitle(platform, contentPackage) },
    checks,
    skillTrace: {
      ...result.skillTrace,
      status: usedFallback ? "completed_with_fallback" : "completed",
      providerTraceId: result.telemetry?.traceId || null,
      errorCode: result.telemetry?.errorCode || null,
      errorCategory: result.telemetry?.errorCategory || null,
      providerAttempts: Number(result.telemetry?.attempts || 0),
      providerAttemptFailures: structuredClone(result.telemetry?.attemptFailures || []),
      fallbackUsed: usedFallback
    },
    executionRecord: { ...result.executionRecord, providerFallbackUsed: usedFallback, productionEligibleOutput: !usedFallback && result.executionRecord?.productionEligibleOutput !== false, errorCode: result.telemetry?.errorCode || result.skillTrace?.errorCode || null, providerAttempts: Number(result.telemetry?.attempts || 0) }
  };
}
