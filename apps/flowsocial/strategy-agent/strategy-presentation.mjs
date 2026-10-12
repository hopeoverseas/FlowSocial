import { coreFieldSpecs, getTargetSpec } from "./profile-coverage-registry.mjs";
import { resolveDiagnosticState } from "./diagnostic-state-resolver.mjs";

const labels = Object.fromEntries(Object.entries(coreFieldSpecs).map(([key, value]) => [key, value.label]));
const stageLabels = { account_setup:"起号阶段",content_market_fit:"内容验证阶段",growth:"增长阶段",monetization:"转化变现阶段",scaling:"规模化阶段",stable_operation:"稳定运营阶段",transformation:"转型阶段",exploration:"探索阶段" };
const keyLabels = {
  primaryOutcome:"核心目标",priority:"优先级",timeHorizon:"目标周期",targetAudience:"目标客户",successSignals:"验证指标",baseline:"当前基线",resourceConstraints:"资源约束",tradeoffs:"取舍",
  currentStage:"当前阶段",stageEvidence:"判断依据",bottleneck:"当前瓶颈",nextMilestone:"下一里程碑",
  summary:"概述",steps:"执行步骤",offerNames:"产品或服务",priorityOffers:"优先推广",problemsSolved:"解决的问题",targetCustomers:"适用客户",deliverables:"交付内容",applicableScenarios:"适用场景",
  xiaohongshuRole:"小红书角色",wechatRole:"公众号角色",crossPlatformRelationship:"双平台协同"
};

const clean = (value) => String(value ?? "").trim();
function scalar(value) {
  const raw = clean(value);
  return stageLabels[raw] || raw;
}

export function humanizeStrategyValue(value, { fieldPath = "", fallback = "尚未提供" } = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return scalar(value) || fallback;
  if (Array.isArray(value)) return value.map((item) => humanizeStrategyValue(item, { fieldPath, fallback:"" })).filter(Boolean).join("、") || fallback;
  if (typeof value !== "object") return fallback;
  if (value.none === true) return clean(value.summary) || "用户确认目前暂无";
  const preferred = ["summary","primaryOutcome","currentStage","offerNames","name","description"];
  const headline = preferred.map((key) => value[key]).find((item) => item != null && item !== "");
  const details = Object.entries(value)
    .filter(([key, item]) => !["summary","name","description"].includes(key) && item != null && item !== "" && (!Array.isArray(item) || item.length))
    .slice(0, 6)
    .map(([key, item]) => `${keyLabels[key] || getTargetSpec("core_field", fieldPath)?.slots?.find((slot) => slot.id === key)?.label || key}：${humanizeStrategyValue(item, { fieldPath, fallback:"" })}`)
    .filter((item) => !item.endsWith("："));
  const title = headline == null ? "" : humanizeStrategyValue(headline, { fieldPath, fallback:"" });
  return [title, ...details.filter((item) => !title || !item.endsWith(`：${title}`))].filter(Boolean).join("；") || fallback;
}

export function buildDiagnosticSummary({ claims = [], fieldStates = [], coverageStates = [] } = {}) {
  const claimMap = new Map(claims.map((item) => [item.fieldPath, item]));
  const canonical = resolveDiagnosticState(claims,fieldStates,coverageStates);
  const fields = canonical.fields.map((resolved) => {
    const fieldPath=resolved.fieldPath;
    const claim = claimMap.get(fieldPath) || null;
    const state = resolved.effective && ["unasked","asked","partial","partially_answered"].includes(resolved.state) ? "confirmed" : resolved.state;
    const inProgress = !resolved.processed && (state !== "unasked" || Boolean(claim) || Boolean(resolved.coverage));
    return { fieldPath, label: labels[fieldPath] || fieldPath, status: state, processed:resolved.processed, inProgress, strategyReady:resolved.effective, usable:Boolean(resolved.effective && (claim || resolved.state==="explicit_none")), minimumDraftReady:resolved.minimumDraftReady, qualityComplete:resolved.qualityComplete, requiredForDraft:resolved.requiredForDraft, displaySummary: humanizeStrategyValue(claim?.value, { fieldPath }), value: claim?.value ?? null, sourceType: claim?.sourceType || null, capturedSlots: resolved.coverage?.capturedSlots || [], skippedSlots: resolved.coverage?.skippedSlots || [], missingRequiredSlots: resolved.coverage?.missingRequiredSlots || [] };
  });
  const processed = fields.filter((item)=>item.processed).length;
  return { schemaVersion:"1.2", processed, completed:processed, inProgress:fields.filter((item)=>item.inProgress).length, unstarted:fields.filter((item)=>!item.processed&&!item.inProgress).length, strategyReady:fields.filter((item)=>item.strategyReady).length, usable:fields.filter((item)=>item.usable).length, minimumDraftReady:canonical.minimumDraftReady, qualityComplete:canonical.qualityComplete, minimumMissingFields:canonical.minimumMissingFields, total:fields.length, fields };
}

export function naturalRecommendationAcceptedMessage({ fieldPath, value, nextMessage = "" } = {}) {
  const label = labels[fieldPath] || "这项策略信息";
  const summary = humanizeStrategyValue(value, { fieldPath, fallback:"已采纳当前方案" });
  return [`已将${label}更新为：${summary}。`, nextMessage].filter(Boolean).join("\n\n");
}
