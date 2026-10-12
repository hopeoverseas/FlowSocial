import { createHash } from "node:crypto";
import { transitionPublishingCyclePlan, validatePublishingCyclePlan } from "./publishing-cycle-plan.mjs";
import { rebindContentLearningInstructionTopic } from "./next-cycle-content-portfolio.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

export function cycleConfirmationHash(plan) {
  const semantics = {
    cycleId: plan.cycleId,
    strategySnapshotId: plan.strategySnapshotId,
    strategyVersion: plan.strategyVersion,
    cycleStart: plan.cycleStart,
    cycleEnd: plan.cycleEnd,
    slots: (plan.slots || []).map((slot) => ({
      slotId: slot.slotId,
      zone: slot.zone,
      scheduledFor: slot.scheduledFor,
      socialAccountId: slot.socialAccountId,
      platform: slot.platform,
      topic: slot.topic,
      learningLane: slot.learningLane || null,
      nextCyclePortfolioRef: slot.nextCyclePortfolioRef || null,
      contentLearningInstructionHash: slot.contentLearningInstruction?.instructionHash || null
    })),
    userDecisions: plan.userDecisions || []
  };
  return createHash("sha256").update(JSON.stringify(canonical(semantics))).digest("hex");
}

function topicTokens(value, size = 2) {
  const text = String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  if (!text) return new Set();
  if (text.length <= size) return new Set([text]);
  return new Set(Array.from({ length: text.length - size + 1 }, (_, index) => text.slice(index, index + size)));
}

function topicSimilarity(left, right) {
  const a = topicTokens(left); const b = topicTokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function assertFreshTopic(store, plan, slot, topic) {
  if (!(plan.nextCycleContentPortfolios || []).length) return;
  if (!String(topic || "").trim()) throw Object.assign(new Error("数据驱动周期的每个正式槽位都必须保留明确的新选题"), { code: "PUBLISHING_CYCLE_FRESH_TOPIC_REQUIRED", statusCode: 409 });
  const historical = [
    ...(store.contentTasks || []).map((item) => item.contentIdentity?.topic || item.ideaTitle),
    ...(store.unifiedContentOpportunities || []).map((item) => item.topic),
    ...(plan.slots || []).filter((item) => item.slotId !== slot.slotId).map((item) => item.topic)
  ].filter(Boolean);
  const matched = historical.map((value) => ({ topic: value, score: topicSimilarity(topic, value) })).sort((left, right) => right.score - left.score)[0];
  if (matched?.score >= 0.72) throw Object.assign(new Error("调整后的选题与历史内容或本批选题过于接近，请更换问题或角度"), {
    code: "PUBLISHING_CYCLE_TOPIC_DUPLICATE",
    statusCode: 409,
    details: { matchedTopic: matched.topic, similarity: Number(matched.score.toFixed(3)) }
  });
}

function currentAccountDateCollisions(store, plan) {
  const otherPlans = (store.publishingCyclePlans || []).filter((item) => item.cycleId !== plan.cycleId && !["completed", "superseded", "blocked"].includes(item.status));
  const occupied = new Map();
  for (const other of otherPlans) {
    for (const slot of other.slots || []) {
      if (!slot.socialAccountId || !slot.scheduledFor || slot.zone === "buffer") continue;
      occupied.set(`${slot.socialAccountId}:${slot.scheduledFor}`, { cycleId: other.cycleId, slot });
    }
  }
  return (plan.slots || []).filter((slot) => slot.socialAccountId && slot.scheduledFor && slot.zone !== "buffer").flatMap((slot) => {
    const matched = occupied.get(`${slot.socialAccountId}:${slot.scheduledFor}`);
    return matched ? [{
      code: "ACCOUNT_DATE_COLLISION",
      message: `${slot.accountName || slot.socialAccountId} 在 ${slot.scheduledFor} 已有其他周期的发布承诺，请调整日期后再确认。`,
      socialAccountId: slot.socialAccountId,
      scheduledFor: slot.scheduledFor,
      existingCycleId: matched.cycleId,
      slotId: slot.slotId
    }] : [];
  });
}

function reconcileAccountDateCollisions(store, plan) {
  const collisions = currentAccountDateCollisions(store, plan);
  plan.conflicts = [...(plan.conflicts || []).filter((item) => item.code !== "ACCOUNT_DATE_COLLISION"), ...collisions];
  if (!collisions.length) {
    plan.userDecisions = (plan.userDecisions || []).filter((item) => item.conflictCode !== "ACCOUNT_DATE_COLLISION");
    plan.userDecisionsRequired = (plan.userDecisionsRequired || []).filter((item) => item.conflictCode !== "ACCOUNT_DATE_COLLISION");
  }
  return collisions;
}

export function ensureCycleWorkbenchPlans(store) {
  store.publishingCyclePlans ||= [];
  return store.publishingCyclePlans;
}

export function saveCycleWorkbenchPlan(store, input, { now = new Date().toISOString() } = {}) {
  const validation = validatePublishingCyclePlan(input);
  if (!validation.valid) throw Object.assign(new Error("周期计划合同无效"), { code: "PUBLISHING_CYCLE_PLAN_INVALID", statusCode: 400, details: validation.errors });
  const plans = ensureCycleWorkbenchPlans(store);
  const existing = plans.find((item) => item.cycleId === input.cycleId);
  if (existing) return { plan: existing, created: false };
  const plan = {
    ...structuredClone(input),
    workbenchStatus: input.status === "blocked" ? "draft" : "awaiting_confirmation",
    confirmation: null,
    slotEvents: [],
    createdAt: now,
    updatedAt: now
  };
  plan.confirmationPreviewHash = cycleConfirmationHash(plan);
  plans.push(plan);
  return { plan, created: true };
}

export function listCycleWorkbenchPlans(store, { companyId = null, socialAccountId = null } = {}) {
  return ensureCycleWorkbenchPlans(store).filter((plan) => (!companyId || plan.companyId === companyId) && (!socialAccountId || plan.slots?.some((slot) => slot.socialAccountId === socialAccountId)));
}

export function confirmCycleWorkbenchPlan(store, cycleId, { confirmedBy, expectedPlanHash = null, confirmedAt = new Date().toISOString() } = {}) {
  const plan = ensureCycleWorkbenchPlans(store).find((item) => item.cycleId === cycleId);
  if (!plan) throw Object.assign(new Error("周期计划不存在"), { code: "PUBLISHING_CYCLE_NOT_FOUND", statusCode: 404 });
  if (plan.blockers?.length) throw Object.assign(new Error("周期仍有阻断项，处理后才能确认"), { code: "PUBLISHING_CYCLE_BLOCKED", statusCode: 409, details: plan.blockers });
  if (plan.workbenchStatus === "active") return { plan, changed: false };
  if (plan.workbenchStatus !== "awaiting_confirmation" || plan.status !== "draft") throw Object.assign(new Error("当前周期状态不能确认"), { code: "PUBLISHING_CYCLE_CONFIRMATION_INVALID", statusCode: 409 });
  const dateCollisions = reconcileAccountDateCollisions(store, plan);
  if (dateCollisions.length) throw Object.assign(new Error("当前排期与其他周期存在同账号同日撞期，请先调整日期"), { code: "PUBLISHING_CYCLE_ACCOUNT_DATE_COLLISION", statusCode: 409, details: dateCollisions });
  const currentPlanHash = cycleConfirmationHash(plan);
  if ((plan.nextCycleContentPortfolios || []).length && (!expectedPlanHash || expectedPlanHash !== currentPlanHash)) {
    throw Object.assign(new Error("周期计划已变化，请重新查看并确认当前选题版本"), { code: "PUBLISHING_CYCLE_EXACT_CONFIRMATION_REQUIRED", statusCode: 409, details: { currentPlanHash } });
  }
  const confirmed = transitionPublishingCyclePlan(plan, "confirmed");
  const active = transitionPublishingCyclePlan(confirmed, "active");
  Object.assign(plan, active, {
    workbenchStatus: "active",
    confirmation: { confirmedBy: confirmedBy || "workspace_user", confirmedAt, planHash: currentPlanHash },
    userDecisions: (plan.userDecisions || []).map((item) => ({ ...item, status: "confirmed", confirmedAt })),
    userDecisionsRequired: (plan.userDecisionsRequired || []).map((item) => ({ ...item, status: "confirmed", confirmedAt })),
    updatedAt: confirmedAt
  });
  plan.slotEvents ||= [];
  plan.slotEvents.push({ type: "cycle_confirmed", at: confirmedAt, actor: confirmedBy || "workspace_user" });
  return { plan, changed: true };
}

export function adjustCycleWorkbenchSlot(store, cycleId, slotId, patch = {}, { actor = "workspace_user", at = new Date().toISOString() } = {}) {
  const plan = ensureCycleWorkbenchPlans(store).find((item) => item.cycleId === cycleId);
  const slot = plan?.slots?.find((item) => item.slotId === slotId);
  if (!plan || !slot) throw Object.assign(new Error("周期槽位不存在"), { code: "PUBLISHING_CYCLE_SLOT_NOT_FOUND", statusCode: 404 });
  if (slot.contentRunId) throw Object.assign(new Error("槽位已经启动，不能再修改计划输入"), { code: "PUBLISHING_CYCLE_SLOT_ALREADY_STARTED", statusCode: 409, contentRunId: slot.contentRunId });
  const committed = slot.zone === "committed";
  if (committed && (patch.confirmCommittedChange !== true || !String(patch.reason || "").trim())) throw Object.assign(new Error("承诺槽位变更需要二次确认并填写原因"), { code: "COMMITTED_SLOT_CHANGE_CONFIRMATION_REQUIRED", statusCode: 409 });
  const previous = { targetWindow: structuredClone(slot.targetWindow), scheduledFor: slot.scheduledFor, topic: slot.topic };
  const hasTopicPatch = Object.hasOwn(patch, "topic");
  const nextTopic = hasTopicPatch && patch.topic ? String(patch.topic).trim() : null;
  if (hasTopicPatch) assertFreshTopic(store, plan, slot, nextTopic);
  if (patch.targetWindow) { slot.targetWindow = structuredClone(patch.targetWindow); slot.scheduledFor = patch.targetWindow.date || null; }
  if (hasTopicPatch) {
    slot.topic = nextTopic;
    if (slot.contentLearningInstruction) slot.contentLearningInstruction = rebindContentLearningInstructionTopic(slot.contentLearningInstruction, nextTopic);
  }
  reconcileAccountDateCollisions(store, plan);
  plan.confirmationPreviewHash = cycleConfirmationHash(plan);
  plan.slotEvents ||= [];
  plan.slotEvents.push({ type: committed ? "committed_slot_changed" : "flexible_slot_changed", slotId, actor, at, reason: committed ? String(patch.reason).trim() : null, previous, current: { targetWindow: structuredClone(slot.targetWindow), scheduledFor: slot.scheduledFor, topic: slot.topic } });
  plan.updatedAt = at;
  return { plan, slot };
}

export async function startCycleWorkbenchSlotRun(store, cycleId, slotId, createRun, { actor = "workspace_user", at = new Date().toISOString() } = {}) {
  const plan = ensureCycleWorkbenchPlans(store).find((item) => item.cycleId === cycleId);
  const slot = plan?.slots?.find((item) => item.slotId === slotId);
  if (!plan || !slot) throw Object.assign(new Error("周期槽位不存在"), { code: "PUBLISHING_CYCLE_SLOT_NOT_FOUND", statusCode: 404 });
  if (plan.workbenchStatus !== "active" || plan.status !== "active") throw Object.assign(new Error("请先确认本周期，再启动承诺槽位"), { code: "PUBLISHING_CYCLE_CONFIRMATION_REQUIRED", statusCode: 409 });
  if (slot.zone !== "committed") throw Object.assign(new Error("草案区和缓冲位仍可调整，只有承诺槽位可以启动"), { code: "PUBLISHING_CYCLE_SLOT_NOT_COMMITTED", statusCode: 409 });
  if (slot.contentRunId) {
    const existing = (store.contentRuns || store.contentWorkflows || []).find((item) => item.id === slot.contentRunId);
    if (!existing) throw Object.assign(new Error("槽位已登记运行，但对应 ContentRun 缺失"), { code: "PUBLISHING_CYCLE_RUN_REFERENCE_MISSING", statusCode: 409, contentRunId: slot.contentRunId });
    return { workflow: existing, created: false };
  }
  const workflow = await createRun({ plan, slot });
  if (!workflow?.id) throw Object.assign(new Error("内容主链未返回 ContentRun"), { code: "PUBLISHING_CYCLE_RUN_CREATE_FAILED", statusCode: 500 });
  const attribution = {
    cycleId: plan.cycleId,
    slotId: slot.slotId,
    strategyVersionId: slot.strategySnapshotId,
    strategySnapshotId: slot.strategySnapshotId,
    strategyVersion: slot.strategyVersion,
    growthPlaybookVersionId: `${slot.growthPlaybookId}@${slot.playbookVersion}`,
    growthPlaybookId: slot.growthPlaybookId,
    playbookVersion: slot.playbookVersion,
    experimentId: slot.experimentId || slot.experiment?.id || null,
    experiment: structuredClone(slot.experiment || {})
  };
  Object.assign(workflow, attribution, { cycleAttribution: structuredClone(attribution) });
  workflow.generationPayload ||= {};
  Object.assign(workflow.generationPayload, attribution, { cycleAttribution: structuredClone(attribution) });
  slot.contentRunId = workflow.id;
  plan.slotEvents ||= [];
  plan.slotEvents.push({ type: "content_run_started", slotId, contentRunId: workflow.id, actor, at });
  plan.updatedAt = at;
  return { workflow, created: true };
}
