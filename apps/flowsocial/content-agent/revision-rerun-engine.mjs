import { optimizeFinalTitles } from "./title-atom.mjs";
import { runContentGates } from "./gate-engine.mjs";
import { runContentSkill } from "./skill-runner.mjs";
import { evaluateXhsPageFactClaims } from "./patch-engine.mjs";
import { featureFlags } from "../feature-flags.mjs";
import { extractExplicitWechatCopyEdits } from "./explicit-copy-edits.mjs";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

function isTitlePath(path) {
  return /\/(recommended_title|title_candidates)(?:\/|$)/.test(String(path || ""));
}

function appendHumanVisualDirection(item, instruction) {
  if (!item || typeof item !== "object") return item;
  const suffix = `Human-approved visual direction (concept only; render no literal text): ${String(instruction || "").trim()}`;
  const currentPrompt = String(item.image_spec?.prompt || item.prompt || "").trim();
  if (!currentPrompt || currentPrompt.includes(suffix)) return item;
  const prompt = `${currentPrompt}\n${suffix}`;
  return { ...item, prompt, ...(item.image_spec && typeof item.image_spec === "object" ? { image_spec: { ...item.image_spec, prompt } } : {}) };
}

function applyWechatHumanVisualDirection(imagePlan, instruction) {
  const value = String(instruction || "");
  const plan = structuredClone(imagePlan || {});
  if (/封面/.test(value)) plan.cover = appendHumanVisualDirection(plan.cover, value);
  if (/(?:正文.{0,8}(?:第一|第\s*1|1).{0,4}(?:张图|配图|图片)|第一张图)/.test(value) && list(plan.slots).length) {
    plan.slots[0] = appendHumanVisualDirection(plan.slots[0], value);
  }
  return plan;
}

export async function rerunRevisionDownstream({ task, contentPackage, revisionImpact, instruction = "" }, { generateText }) {
  const platform = task.platform;
  let current = structuredClone(contentPackage);
  const skillTraces = [];
  const executionRecords = [];
  const checks = [];
  const changedPaths = list(revisionImpact?.changedPaths);
  const titleOnly = changedPaths.length > 0 && changedPaths.every(isTitlePath);
  const explicitWechatEdits = platform === "wechat" ? extractExplicitWechatCopyEdits(instruction) : { title: null, opening: null };
  const planStep = (id) => task.skillExecutionPlan?.steps?.find((step) => step.id === id) || null;

  if (revisionImpact?.affectedSteps?.includes("wechat_content_review") && platform === "wechat") {
    const review = await runContentSkill({
      capability: "review-wechat-article",
      platform,
      input: { mode: "report_only", review_stage: "revision_content_review", wechat_article: current, content_intent_profile: task.contentIntentProfile, content_master: task.contentMaster, account_strategy: task.accountStyleSnapshot || {}, current_version: Number(task.version || 1) + 1, locked_ranges: ["confirmed_facts", "source_list"], publish_rules: {}, user_instruction: instruction },
      generateText,
      fallback: { status: "needs_review", data: { decision: "block", findings: [{ code: "WECHAT_REVISION_REVIEW_UNAVAILABLE", severity: "fail", field: "article_markdown" }], patches: [], changes: [], fact_recheck_required: true, publish_time_checks: [] } },
      expectedContract: "WechatArticleReview@1.0",
      task: "review_revised_wechat_article",
      planStep: planStep("wechat_content_review")
    });
    const data = review.data?.data || review.data || {};
    checks.push({ check: "wechat_revision_review", result: data.decision === "block" ? "fail" : data.decision === "revise" ? "warning" : "pass", detail: data.findings || [] });
    skillTraces.push(review.skillTrace);
    executionRecords.push(review.executionRecord);
    if (data.decision === "block") {
      return {
        schemaVersion: "1.0",
        contentPackage: current,
        qualityReview: { status: "needs_review", decision: "block", checks, blockers: ["wechat_revision_review"], issues: [{ gate: "WechatRevisionReviewGate", severity: "fail", detail: data.findings || [] }], repairPlan: [{ gate: "WechatRevisionReviewGate", rerunFrom: "wechat_content_review" }] },
        skillTraces: skillTraces.filter(Boolean),
        executionRecords: executionRecords.filter(Boolean),
        executedSteps: ["wechat_content_review"],
        deferredSteps: list(revisionImpact?.affectedSteps).filter((step) => step !== "wechat_content_review")
      };
    }
  }

  if (revisionImpact?.affectedSteps?.includes("title") && explicitWechatEdits.title) {
    const titleId = `T_USER_V${Number(task.version || 1) + 1}`;
    const previousCandidates = list(current.title_strategy?.candidates).filter((item) => item?.title !== explicitWechatEdits.title);
    const selected = { title_id: titleId, title: explicitWechatEdits.title, claim_ids: [], risk: "low", risk_reasons: [], source: "user_explicit_selection" };
    current.recommended_title = explicitWechatEdits.title;
    current.title_candidates = [explicitWechatEdits.title, ...list(current.title_candidates).filter((item) => (typeof item === "string" ? item : item?.title) !== explicitWechatEdits.title)].slice(0, 5);
    current.title_strategy = { ...(current.title_strategy || {}), candidates: [selected, ...previousCandidates].slice(0, 8), selected_title_id: titleId, selected_title: explicitWechatEdits.title, selection_source: "user_explicit_selection" };
    checks.push(
      { check: "final_title_selected", result: "pass", detail: "user_explicit_selection" },
      { check: "final_title_claims_traceable", result: "pass", detail: "no_new_claim_detected_by_revision_router" },
      { check: "final_title_risk_gate", result: "pass", detail: "user_explicit_selection" }
    );
  } else if (revisionImpact?.affectedSteps?.includes("title") && !titleOnly) {
    const title = await optimizeFinalTitles({
      platform,
      contentMaster: task.contentMaster,
      contentPackage: current,
      contentTaskBrief: task.contentTaskBrief,
      sameAccountTitleSignals: task.titlePerformanceSignals || [],
      accountTone: task.accountStyleSnapshot?.tone || null,
      contentPatternSnapshot: task.contentPatternSnapshot || null,
      skillPatternPacks: task.contentSkillPatternPacks || []
    }, { generateText, planStep: planStep("title") });
    current = title.contentPackage;
    current.title_strategy = title.titleStrategy;
    checks.push(...title.checks);
    skillTraces.push(title.skillTrace);
    executionRecords.push(title.executionRecord);
  }

  if (revisionImpact?.affectedSteps?.includes("image_plan") && platform === "wechat") {
    const imagePlan = await runContentSkill({
      capability: "plan-wechat-images",
      platform,
      input: { wechat_article: current, content_master: task.contentMaster, design_dna: task.accountStyleSnapshot || null, authorized_assets: [], image_count_range: { min: 1, max: 5 }, provider_capability: "generated_raster_without_text", revision_instruction: instruction },
      generateText,
      fallback: { status: "success", data: current.image_plan || { cover: null, slots: [] } },
      expectedContract: "WechatImagePlan@1.0",
      task: "plan_revised_wechat_images",
      planStep: planStep("image_plan")
    });
    const planned = imagePlan.data?.data || imagePlan.data || {};
    if (planned.cover || planned.slots) current.image_plan = { ...(current.image_plan || {}), ...planned };
    current.image_plan = applyWechatHumanVisualDirection(current.image_plan, instruction);
    skillTraces.push(imagePlan.skillTrace);
    executionRecords.push(imagePlan.executionRecord);
  }

  const gateReview = runContentGates({ platform, contentMaster: task.contentMaster, confirmedOutline: task.confirmedOutline, contentPackage: current, requireConfirmedOutline: Boolean(task.contentRunId) });
  checks.push(...gateReview.checks.map((item) => ({ check: item.gate, result: item.result, detail: item.detail })));
  if (platform === "xiaohongshu" && featureFlags().xhsDeterministicVisualQualityGate) {
    const pageFactGate = evaluateXhsPageFactClaims(current, task.contentMaster);
    checks.push({ check: "page_claims_semantically_traceable", result: pageFactGate.status === "blocked" ? "fail" : "pass", detail: { enabled: true, status: pageFactGate.status, failures: pageFactGate.failures } });
  }
  const blockers = checks.filter((item) => item.result === "fail").map((item) => item.check);
  return {
    schemaVersion: "1.0",
    contentPackage: current,
    qualityReview: { status: blockers.length ? "needs_review" : gateReview.decision === "pass" && checks.every((item) => item.result === "pass") ? "passed" : "needs_review", decision: blockers.length ? "block" : gateReview.decision, checks, blockers, issues: gateReview.issues, repairPlan: gateReview.repairPlan },
    skillTraces: skillTraces.filter(Boolean),
    executionRecords: executionRecords.filter(Boolean),
    executedSteps: [platform === "wechat" && revisionImpact?.affectedSteps?.includes("wechat_content_review") ? "wechat_content_review" : null, revisionImpact?.affectedSteps?.includes("title") && (!titleOnly || explicitWechatEdits.title) ? "title" : null, platform === "wechat" && revisionImpact?.affectedSteps?.includes("image_plan") ? "image_plan" : null, "quality"].filter(Boolean),
    deferredSteps: list(revisionImpact?.affectedSteps).filter((step) => ["render", "visual_review", "format", "format_validation"].includes(step))
  };
}
