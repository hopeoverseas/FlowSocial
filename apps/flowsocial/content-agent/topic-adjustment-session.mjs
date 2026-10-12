import { createHash, randomUUID } from "node:crypto";
import { adjustCycleWorkbenchSlot, cycleConfirmationHash, ensureCycleWorkbenchPlans } from "./cycle-workbench.mjs";

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const clean = (value, max = 240) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

function tokens(value, size = 2) {
  const text = clean(value, 500).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  if (!text) return new Set();
  if (text.length <= size) return new Set([text]);
  return new Set(Array.from({ length: text.length - size + 1 }, (_, index) => text.slice(index, index + size)));
}

function similarity(left, right) {
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function findPlanSlot(store, cycleId, slotId) {
  const plan = ensureCycleWorkbenchPlans(store).find((item) => item.cycleId === cycleId);
  const slot = plan?.slots?.find((item) => item.slotId === slotId);
  if (!plan || !slot) throw Object.assign(new Error("周期槽位不存在"), { code: "PUBLISHING_CYCLE_SLOT_NOT_FOUND", statusCode: 404 });
  if (slot.zone === "buffer") throw Object.assign(new Error("容量预留位尚未绑定正式选题，不能进入选题调整对话"), { code: "TOPIC_ADJUSTMENT_BUFFER_UNSUPPORTED", statusCode: 409 });
  if (slot.contentRunId || slot.unifiedProjectId) throw Object.assign(new Error("该选题已经进入内容生产，不能再调整计划输入"), { code: "PUBLISHING_CYCLE_SLOT_ALREADY_STARTED", statusCode: 409 });
  return { plan, slot };
}

function strategyContext(store, plan, slot) {
  const snapshot = (store.strategySnapshots || []).find((item) => [item.id, item.snapshotId, item.strategySnapshotId].includes(plan.strategySnapshotId)) || null;
  const document = snapshot?.document || snapshot?.payload || {};
  return {
    strategySnapshotId: plan.strategySnapshotId || slot.strategySnapshotId || null,
    strategyVersion: plan.strategyVersion || slot.strategyVersion || null,
    growthPlaybook: { id: slot.growthPlaybookId || null, version: slot.playbookVersion || null },
    platformRole: document?.strategy?.platformPlaybooks?.[slot.platform] || document?.strategyExtensions?.platformPlaybooks?.[slot.platform] || null,
    positioning: document?.strategy?.positioning || document?.positioning || null,
    audiences: document?.strategy?.audiences || document?.audiences || [],
    evidencePolicy: document?.strategy?.evidencePolicy || document?.evidencePolicy || null,
    riskPolicy: document?.strategy?.riskPolicy || document?.riskPolicy || null
  };
}

function historyFor(store, plan, slot) {
  return [
    ...(store.contentTasks || []).map((item) => item.contentIdentity?.topic || item.ideaTitle),
    ...(store.unifiedContentOpportunities || []).map((item) => item.topic),
    ...(plan.slots || []).filter((item) => item.slotId !== slot.slotId).map((item) => item.topic)
  ].map((item) => clean(item)).filter(Boolean);
}

function unavailableReply() {
  return {
    conversationMode: "provider_unavailable",
    assistantMessage: "模型连接暂时不可用，本轮没有把你的表达当成题目，也没有生成候选。你刚才的讨论内容已保留，请稍后重试；计划没有发生变化。",
    candidates: []
  };
}

function normalizeReply(raw, fallback) {
  const source = raw && typeof raw === "object" ? raw : fallback;
  const assistantMessage = clean(source.assistantMessage, 500) || fallback.assistantMessage;
  const supplied = (Array.isArray(source.candidates) ? source.candidates : []).map((item) => ({
    topic: clean(item?.topic, 120), angle: clean(item?.angle, 120), difference: clean(item?.difference, 180), reason: clean(item?.reason, 180)
  })).filter((item) => item.topic.length >= 6).filter((item, index, items) => items.findIndex((candidate) => candidate.topic === item.topic) === index).slice(0, 3);
  const candidates = supplied.length === 3 ? supplied : [];
  const conversationMode = candidates.length === 3 ? "candidates" : ["discussion", "provider_unavailable"].includes(source.conversationMode) ? source.conversationMode : "discussion";
  return { conversationMode, assistantMessage, candidates };
}

function enrichCandidates(store, plan, slot, session, candidates, now) {
  const historical = historyFor(store, plan, slot);
  return candidates.map((item, index) => {
    const matched = historical.map((topic) => ({ topic, score: similarity(item.topic, topic) })).sort((a, b) => b.score - a.score)[0] || null;
    const duplication = { score: Number((matched?.score || 0).toFixed(3)), decision: (matched?.score || 0) >= 0.72 ? "block" : (matched?.score || 0) >= 0.5 ? "warn" : "allow", matchedTopic: matched?.topic || null };
    const candidate = { candidateId: `topic_candidate_${randomUUID().slice(0, 12)}`, version: session.turns.length + 1, ...item, duplication, createdAt: now, ordinal: index + 1 };
    candidate.candidateHash = hash({ sessionId: session.sessionId, topic: candidate.topic, version: candidate.version, ordinal: candidate.ordinal });
    return candidate;
  });
}

export function ensureTopicAdjustmentSessions(store) {
  store.topicAdjustmentSessions ||= [];
  return store.topicAdjustmentSessions;
}

export function startTopicAdjustmentSession(store, { cycleId, slotId, actor = "workspace_user" }, { now = new Date().toISOString() } = {}) {
  const { plan, slot } = findPlanSlot(store, cycleId, slotId);
  const session = {
    schemaVersion: "1.0", sessionId: `topic_adjustment_${randomUUID().slice(0, 12)}`, status: "open", cycleId, slotId,
    actor, openedAt: now, updatedAt: now, adoptedCandidateId: null, turns: [], candidates: [],
    context: {
      originalTopic: slot.topic, platform: slot.platform, socialAccountId: slot.socialAccountId, accountName: slot.accountName || null,
      contentFunction: slot.contentFunction || null, contentPillar: slot.contentPillar || null, learningLane: slot.learningLane || null,
      contentLearningInstruction: structuredClone(slot.contentLearningInstruction || null), strategy: strategyContext(store, plan, slot),
      planHashAtOpen: cycleConfirmationHash(plan), immutableFields: ["scheduledFor", "targetWindow", "socialAccountId", "platform", "strategySnapshotId", "learningLane"]
    }
  };
  ensureTopicAdjustmentSessions(store).push(session);
  return session;
}

export async function continueTopicAdjustmentSession(store, sessionId, { message, actor = "workspace_user" }, { invokeModel, now = new Date().toISOString() } = {}) {
  const session = ensureTopicAdjustmentSessions(store).find((item) => item.sessionId === sessionId);
  if (!session || session.status !== "open") throw Object.assign(new Error("选题调整会话不存在或已结束"), { code: "TOPIC_ADJUSTMENT_SESSION_NOT_OPEN", statusCode: 409 });
  const userMessage = clean(message, 600);
  if (!userMessage) throw Object.assign(new Error("请输入希望调整的选题方向"), { code: "TOPIC_ADJUSTMENT_MESSAGE_REQUIRED", statusCode: 400 });
  const { plan, slot } = findPlanSlot(store, session.cycleId, session.slotId);
  const fallback = unavailableReply();
  const request = {
    task: "adjust_content_plan_topic", contract: "UnstructuredResult@1.0", requestId: `topic_turn_${randomUUID().slice(0, 12)}`,
    instruction: "You are discussing the direction of exactly one content-plan topic with the user. Return JSON with conversationMode, assistantMessage, and candidates. Use conversationMode=discussion and candidates=[] when the user is exploring, asking why, giving context, disagreeing, or has not explicitly asked to create topics. Discuss their thinking and ask at most one useful follow-up question. Use conversationMode=candidates and return exactly 3 candidates only after the user explicitly asks to generate/show/propose/select topic candidates. Each candidate has topic, angle, difference, reason. Never turn the user's full sentence into a title. Never change date, account, platform, strategy, cadence, body, images, or publication state.",
    context: session.context, currentPlanHash: cycleConfirmationHash(plan), recentTurns: session.turns.slice(-6), userMessage
  };
  const invocation = typeof invokeModel === "function" ? await invokeModel(request, fallback) : { mode: "demo", data: fallback, telemetry: { attempts: 0, retryCount: 0 } };
  const normalized = normalizeReply(invocation?.data, fallback);
  const candidates = normalized.candidates.length ? enrichCandidates(store, plan, slot, session, normalized.candidates, now) : [];
  const turn = {
    turnId: request.requestId, actor, message: userMessage, assistantMessage: normalized.assistantMessage, conversationMode: normalized.conversationMode, candidateIds: candidates.map((item) => item.candidateId),
    model: { mode: invocation?.mode || "unknown", traceId: invocation?.telemetry?.traceId || null, attempts: Number(invocation?.telemetry?.attempts || 0), retryCount: Number(invocation?.telemetry?.retryCount || 0) }, createdAt: now
  };
  session.turns.push(turn); session.candidates.push(...candidates); session.updatedAt = now;
  return { session, turn, candidates };
}

export function adoptTopicAdjustmentCandidate(store, sessionId, candidateId, input = {}, { now = new Date().toISOString() } = {}) {
  const session = ensureTopicAdjustmentSessions(store).find((item) => item.sessionId === sessionId);
  if (!session || session.status !== "open") throw Object.assign(new Error("选题调整会话不存在或已结束"), { code: "TOPIC_ADJUSTMENT_SESSION_NOT_OPEN", statusCode: 409 });
  const candidate = session.candidates.find((item) => item.candidateId === candidateId);
  if (!candidate) throw Object.assign(new Error("候选选题不存在"), { code: "TOPIC_ADJUSTMENT_CANDIDATE_NOT_FOUND", statusCode: 404 });
  if (input.userConfirmed !== true || input.candidateHash !== candidate.candidateHash) throw Object.assign(new Error("必须明确确认当前候选版本"), { code: "TOPIC_ADJUSTMENT_EXACT_SELECTION_REQUIRED", statusCode: 409 });
  if (candidate.duplication.decision === "block") throw Object.assign(new Error("该候选与历史内容或本批选题过于接近，不能采用"), { code: "PUBLISHING_CYCLE_TOPIC_DUPLICATE", statusCode: 409, details: candidate.duplication });
  const { plan, slot } = findPlanSlot(store, session.cycleId, session.slotId);
  const currentHash = cycleConfirmationHash(plan);
  if (!input.expectedPlanHash || input.expectedPlanHash !== currentHash) throw Object.assign(new Error("计划已变化，请重新打开选题调整对话"), { code: "TOPIC_ADJUSTMENT_STALE_PLAN", statusCode: 409, details: { currentPlanHash: currentHash } });
  const previousImmutable = Object.fromEntries(session.context.immutableFields.map((key) => [key, structuredClone(slot[key])]));
  const result = adjustCycleWorkbenchSlot(store, session.cycleId, session.slotId, {
    topic: candidate.topic, reason: clean(input.reason, 240) || `采用 AI 选题候选：${candidate.difference || candidate.angle}`, confirmCommittedChange: true
  }, { actor: input.actor || session.actor, at: now });
  for (const [key, value] of Object.entries(previousImmutable)) if (JSON.stringify(result.slot[key]) !== JSON.stringify(value)) throw new Error(`Topic adjustment changed immutable field: ${key}`);
  Object.assign(result.plan, { status: "draft", workbenchStatus: "awaiting_confirmation", confirmation: null, updatedAt: now });
  result.plan.confirmationPreviewHash = cycleConfirmationHash(result.plan);
  result.plan.slotEvents.push({ type: "topic_adjustment_candidate_adopted", slotId: session.slotId, sessionId, candidateId, candidateHash: candidate.candidateHash, actor: input.actor || session.actor, at: now });
  session.status = "adopted"; session.adoptedCandidateId = candidateId; session.updatedAt = now;
  return { plan: result.plan, slot: result.slot, session, candidate };
}
