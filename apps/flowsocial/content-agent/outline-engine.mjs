import { randomUUID } from "node:crypto";
import { runContentSkill } from "./skill-runner.mjs";
import { prepareContentMaster } from "../content-engine.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const fallbackUsed = (result) => result?.telemetry?.fallbackUsed === true || ["validated_fallback", "orchestrator_fallback", "demo_fallback"].includes(result?.mode);

function fallbackOutline({ platform, topicTitle, contentMaster }) {
  const facts = list(contentMaster.confirmed_facts);
  const base = platform === "wechat"
    ? [
        ["问题为什么值得现在讨论", "opening", "建立问题与目标读者的关系"],
        ["常见判断为什么失效", "diagnosis", "澄清误区与边界"],
        ["应该如何重新判断", "method", "给出可执行的方法"],
        ["落地时需要注意什么", "action", "形成行动清单和风险提醒"]
      ]
    : [
        ["先说结论", "hook", "快速兑现方向卡承诺"],
        ["用户真正卡住的地方", "problem", "建立具体场景共鸣"],
        ["三个关键判断", "method", "提供可保存的方法结构"],
        ["如何开始行动", "action", "给出低门槛下一步"]
      ];
  return {
    status: facts.length ? "ready" : "needs_review",
    data: {
      outline_id: `outline_${randomUUID().slice(0, 8)}`,
      schema_version: "1.0",
      platform,
      topic: topicTitle,
      content_promise: contentMaster.reader_value || contentMaster.central_thesis || topicTitle,
      opening_strategy: "从目标读者当前问题进入，不虚构个人经历",
      sections: base.map(([heading, role, objective], index) => ({
        section_id: `S${index + 1}`,
        heading,
        role,
        objective,
        key_points: index === 2 ? [contentMaster.central_thesis || topicTitle] : [],
        claim_ids: facts[index]?.fact_id ? [facts[index].fact_id] : [],
        boundary: list(contentMaster.claims_to_avoid)[0] || "不添加无证据事实"
      })),
      closing_strategy: "总结核心判断并给出与内容目的匹配的单一行动",
      unresolved_questions: list(contentMaster.unknowns),
      confirmation_required: true
    },
    warnings: [],
    blocked_reasons: []
  };
}

function unwrapOutline(raw, fallback) {
  if (Array.isArray(raw?.data?.sections)) return raw.data;
  if (Array.isArray(raw?.sections)) return raw;
  return fallback.data;
}

export function normalizeOutline(raw, fallback, contentMaster) {
  const candidate = unwrapOutline(raw, fallback);
  const knownClaims = new Set(list(contentMaster.confirmed_facts).map((item) => item.fact_id).filter(Boolean));
  const invalidClaimIds = [];
  const sections = list(candidate.sections).slice(0, 8).map((section, index) => {
    const claimIds = list(section.claim_ids);
    invalidClaimIds.push(...claimIds.filter((id) => !knownClaims.has(id)));
    return {
      section_id: text(section.section_id, `S${index + 1}`),
      heading: text(section.heading, `第 ${index + 1} 部分`),
      role: text(section.role, "explanation"),
      objective: text(section.objective),
      key_points: list(section.key_points).map((item) => text(item)).filter(Boolean).slice(0, 5),
      claim_ids: claimIds.filter((id) => knownClaims.has(id)),
      boundary: text(section.boundary)
    };
  }).filter((section) => section.heading);
  const structuralErrors = [sections.length < 3 ? "outline requires at least three sections" : null].filter(Boolean);
  const removedClaimIds = [...new Set(invalidClaimIds)];
  return {
    outline: {
      outline_id: text(candidate.outline_id, fallback.data.outline_id),
      schema_version: "1.0",
      platform: fallback.data.platform,
      topic: text(candidate.topic, fallback.data.topic),
      content_promise: text(candidate.content_promise, fallback.data.content_promise),
      opening_strategy: text(candidate.opening_strategy, fallback.data.opening_strategy),
      sections,
      closing_strategy: text(candidate.closing_strategy, fallback.data.closing_strategy),
      unresolved_questions: list(candidate.unresolved_questions).map((item) => text(item)).filter(Boolean),
      confirmation_required: true
    },
    validation: {
      valid: structuralErrors.length === 0,
      invalidClaimIds: [],
      removedClaimIds,
      warnings: removedClaimIds.length ? [`已移除未确认的事实引用：${removedClaimIds.join("、")}`] : [],
      errors: structuralErrors
    }
  };
}

export async function generateContentOutline(input, deps) {
  const preparation = await prepareContentMaster(input, deps);
  const fallback = fallbackOutline({ platform: preparation.platform, topicTitle: preparation.topicTitle, contentMaster: preparation.contentMaster });
  const result = await runContentSkill({
    capability: "generate-content-outline",
    platform: preparation.platform,
    input: {
      platform: preparation.platform,
      direction_card: input.directionCard,
      content_task_brief: input.contentTaskBrief,
      content_source_plan: input.contentSourcePlan,
      content_master: preparation.contentMaster,
      content_pattern_snapshot: input.payload?.contentPatternSnapshot || null,
      skill_pattern_packs: list(input.payload?.contentSkillPatternPacks)
    },
    generateText: deps.generateText,
    fallback,
    expectedContract: "ContentOutline@1.0",
    task: "generate_confirmable_content_outline",
    planStep: input.skillExecutionPlan?.steps?.find((step) => step.id === "outline") || null
  });
  const normalized = normalizeOutline(result.data, fallback, preparation.contentMaster);
  return {
    status: preparation.status === "blocked" ? "blocked" : fallbackUsed(result) ? "needs_review" : normalized.validation.valid ? "outline_ready" : "needs_review",
    contentMaster: preparation.contentMaster,
    outline: normalized.outline,
    validation: normalized.validation,
    skillTraces: [preparation.skillTrace, result.skillTrace].filter(Boolean)
  };
}
