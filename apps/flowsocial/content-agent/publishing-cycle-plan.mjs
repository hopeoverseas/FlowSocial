import { createHash } from "node:crypto";

const PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const SLOT_STATES = new Set(["committed", "draft", "buffer"]);
const PLAN_STATES = new Set(["draft", "confirmed", "active", "reviewing", "completed", "superseded", "blocked"]);
const CAPACITY_KEYS = ["research", "copy", "visual", "review", "publishCommunity"];
const CONTENT_FUNCTIONS = ["discovery", "authority", "proof", "solution", "action"];
const PLAN_TRANSITIONS = Object.freeze({
  draft: new Set(["confirmed", "superseded"]),
  confirmed: new Set(["active", "superseded"]),
  active: new Set(["reviewing", "superseded"]),
  reviewing: new Set(["active", "completed", "superseded"]),
  completed: new Set(["superseded"]),
  superseded: new Set()
});

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const positiveInteger = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : null;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function deterministicId(prefix, value) {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex").slice(0, 12)}`;
}

function utcDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.valueOf())) throw cycleError("CYCLE_START_INVALID", "cycleStart must be a valid date");
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function cycleError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function blocker(code, message, details = {}) {
  return { code, message, ...details };
}

function strategyDocument(snapshot) {
  return snapshot?.document || snapshot?.payload || {};
}

function accountPortfolio(snapshot) {
  return object(strategyDocument(snapshot)?.strategyExtensions?.accountPortfolio);
}

function growthStrategies(snapshot) {
  const document = strategyDocument(snapshot);
  return list(document?.strategyExtensions?.accountGrowthStrategies || snapshot?.accountGrowthStrategies);
}

function selectedAccountIds(snapshot) {
  const portfolio = accountPortfolio(snapshot);
  const strategies = growthStrategies(snapshot);
  const selected = list(portfolio.selectedSocialAccountIds || portfolio.selectedAccountIds);
  if (portfolio.mode === "single_account") {
    const primary = portfolio.primarySocialAccountId || selected[0] || strategies[0]?.socialAccountId;
    return primary ? [primary] : [];
  }
  return selected.length ? selected : strategies.map((item) => item.socialAccountId).filter(Boolean);
}

function normalizeCadence(candidate, cycleDays) {
  const source = object(candidate);
  const sourceDays = Math.max(1, positiveInteger(source.windowDays) || cycleDays);
  const rawMin = positiveInteger(source.minItems ?? source.min ?? source.items);
  const rawMax = positiveInteger(source.maxItems ?? source.max ?? source.items);
  if (rawMin === null && rawMax === null) return null;
  const min = Math.max(0, Math.floor((rawMin ?? rawMax) * cycleDays / sourceDays));
  const max = Math.max(min, Math.ceil((rawMax ?? rawMin) * cycleDays / sourceDays));
  return { minItems: min, maxItems: max, windowDays: cycleDays };
}

function resolveCapacity(capacity) {
  const source = object(capacity);
  const missing = CAPACITY_KEYS.filter((key) => positiveInteger(source[key]?.items ?? source[key]) === null);
  if (missing.length) return { missing, limits: {} };
  return {
    missing: [],
    limits: Object.fromEntries(CAPACITY_KEYS.map((key) => [key, positiveInteger(source[key]?.items ?? source[key])]))
  };
}

function platformObservation(platform) {
  if (platform === "xiaohongshu") {
    return {
      checkpoints: [
        { offsetDays: 3, label: "T+72h", surfaces: ["targetAudienceInteractions", "saves", "profileVisits", "qualifiedInquiries"] },
        { offsetDays: 7, label: "T+7d", surfaces: ["searchTail", "saves", "profileVisits", "qualifiedInquiries"] },
        { offset: "cycle_end", label: "周期复盘", surfaces: ["targetAudienceShare", "contentFunctionBalance", "qualifiedInquiries"] }
      ],
      assetDefaults: ["cover", "body_visuals"],
      note: "观察面用于复盘，不代表平台算法规则或黄金发布时间。"
    };
  }
  return {
    checkpoints: [
      { offsetDays: 3, label: "T+72h", surfaces: ["opens", "readCompletion", "forwards", "qualifiedLeads"] },
      { offsetDays: 7, label: "T+7d", surfaces: ["readCompletion", "forwards", "newFollows", "qualifiedLeads"] },
      { offset: "cycle_end", label: "周期复盘", surfaces: ["returnReaders", "contentAssetReuse", "qualifiedLeads"] }
    ],
    assetDefaults: ["article_cover", "inline_visuals"],
    note: "观察面用于复盘，不代表平台算法规则或黄金发布时间。"
  };
}

function distributeDates(start, cycleDays, count) {
  if (!count) return [];
  return Array.from({ length: count }, (_, index) => addDays(start, Math.min(cycleDays - 1, Math.floor(((index + 1) * cycleDays) / (count + 1)))));
}

function weightedSequence(targets = {}) {
  const entries = CONTENT_FUNCTIONS.map((name) => [name, Math.max(0, Number(targets[name] || 0))]).filter(([, weight]) => weight > 0);
  return entries.length ? entries.sort((a, b) => b[1] - a[1]).map(([name]) => name) : CONTENT_FUNCTIONS;
}

function accountInputs({ strategySnapshot, accounts, accountPlans, platformCapabilities, cycleDays }) {
  const accountMap = new Map(list(accounts).map((account) => [account.id, account]));
  const plans = new Map(list(accountPlans).map((entry) => [entry.socialAccountId || entry.account?.id, entry]));
  const strategies = new Map(growthStrategies(strategySnapshot).map((item) => [item.socialAccountId, item]));
  const selected = selectedAccountIds(strategySnapshot);
  return selected.map((socialAccountId) => {
    const account = accountMap.get(socialAccountId);
    const plan = plans.get(socialAccountId) || {};
    const strategy = strategies.get(socialAccountId) || {};
    const capability = object(plan.platformCapability || object(platformCapabilities)[account?.platform]);
    const playbookId = plan.growthPlaybookId || strategy.selectedPlaybookId;
    const playbookVersion = plan.playbookVersion || strategy.playbookVersion;
    const candidate = normalizeCadence(plan.cadenceRange || strategy.candidateCadenceRange || strategy.recommendedCadence, cycleDays);
    const capabilityRange = normalizeCadence(capability.cadenceRange || capability, cycleDays);
    return { socialAccountId, account, plan, strategy, capability, playbookId, playbookVersion, candidate, capabilityRange };
  });
}

function blockedPlan({ ownership, strategySnapshot, cycleStart, cycleDays, blockers, assumptions = [] }) {
  const start = utcDate(cycleStart);
  const identity = { companyId: ownership?.companyId || null, strategySnapshotId: strategySnapshot?.id || null, start: dateOnly(start), cycleDays };
  return {
    kind: "PublishingCyclePlan",
    schemaVersion: "1.0",
    cycleId: deterministicId("cycle", identity),
    status: "blocked",
    workspaceId: ownership?.workspaceId || null,
    companyId: ownership?.companyId || null,
    strategySnapshotId: strategySnapshot?.id || null,
    strategyVersion: strategySnapshot?.version || null,
    cycleStart: dateOnly(start),
    cycleEnd: dateOnly(addDays(start, cycleDays)),
    planningHorizon: { startDate: dateOnly(start), endDate: dateOnly(addDays(start, cycleDays)), committedUntil: null },
    cadenceRange: { minItems: 0, maxItems: 0, targetItems: 0, windowDays: cycleDays, byAccount: [] },
    cadenceByAccount: [],
    committedUntil: null,
    slots: [],
    feedbackCheckpoints: [],
    conflicts: [],
    assumptions,
    userDecisions: [],
    userDecisionsRequired: [],
    blockers
  };
}

export function validatePublishingCyclePlan(plan) {
  const errors = [];
  if (plan?.kind !== "PublishingCyclePlan") errors.push({ path: "kind", message: "must equal PublishingCyclePlan" });
  if (plan?.schemaVersion !== "1.0") errors.push({ path: "schemaVersion", message: "must equal 1.0" });
  if (!PLAN_STATES.has(plan?.status)) errors.push({ path: "status", message: "is invalid" });
  for (const key of ["cycleId", "status", "strategySnapshotId", "strategyVersion", "planningHorizon", "cadenceRange", "cadenceByAccount", "slots", "feedbackCheckpoints", "conflicts", "assumptions", "userDecisionsRequired", "blockers"]) {
    if (!plan || !(key in plan)) errors.push({ path: key, message: "is required" });
  }
  if (plan?.status !== "blocked" && !plan?.strategySnapshotId) errors.push({ path: "strategySnapshotId", message: "is required for an executable plan" });
  if (plan?.status !== "blocked" && (plan?.strategyVersion === null || plan?.strategyVersion === undefined)) errors.push({ path: "strategyVersion", message: "is required for an executable plan" });
  const slotIds = new Set();
  for (const [index, slot] of list(plan?.slots).entries()) {
    if (!slot.slotId) errors.push({ path: `slots[${index}].slotId`, message: "is required" });
    if (slotIds.has(slot.slotId)) errors.push({ path: `slots[${index}].slotId`, message: "must be unique" });
    slotIds.add(slot.slotId);
    if (!SLOT_STATES.has(slot.state)) errors.push({ path: `slots[${index}].state`, message: "is invalid" });
    if (!slot.socialAccountId || !PLATFORMS.has(slot.platform)) errors.push({ path: `slots[${index}]`, message: "must bind a real supported social account" });
    for (const key of ["contentPillar", "contentFunction", "experiment", "evidenceRequirements", "assetRequirements"]) {
      if (slot[key] === null || slot[key] === undefined) errors.push({ path: `slots[${index}].${key}`, message: "is required" });
    }
  }
  return { name: "PublishingCyclePlan", version: "1.0", valid: errors.length === 0, errors };
}

export function createPublishingCyclePlan({
  ownership,
  strategySnapshot,
  accounts = [],
  accountPlans = [],
  platformCapabilities = {},
  capacity = {},
  inventory = {},
  cycleStart,
  cycleDays = 14,
  freezeDays = 7,
  userDecisions = [],
  existingPublishingCyclePlans = []
} = {}) {
  const days = Math.max(1, positiveInteger(cycleDays) || 14);
  const assumptions = [];
  const blockers = [];
  if (!strategySnapshot || strategySnapshot.status !== "active") blockers.push(blocker("STRATEGY_NOT_ACTIVE", "An active strategy snapshot is required."));
  const ids = strategySnapshot ? selectedAccountIds(strategySnapshot) : [];
  if (!ids.length) blockers.push(blocker("ACCOUNT_IDENTITY_UNCONFIRMED", "The active strategy does not select a social account."));
  const resolvedCapacity = resolveCapacity(capacity);
  if (resolvedCapacity.missing.length) blockers.push(blocker("CRITICAL_CAPACITY_MISSING", "Critical production capacity is incomplete.", { fields: resolvedCapacity.missing }));
  const inputs = strategySnapshot ? accountInputs({ strategySnapshot, accounts, accountPlans, platformCapabilities, cycleDays: days }) : [];
  for (const input of inputs) {
    if (!input.account || !PLATFORMS.has(input.account.platform) || input.account.status === "archived") {
      blockers.push(blocker("ACCOUNT_MAPPING_MISSING", "A selected social account cannot be resolved.", { socialAccountId: input.socialAccountId }));
      continue;
    }
    if (!input.playbookId) blockers.push(blocker("PLAYBOOK_NOT_SELECTED", "A growth playbook is required for the account.", { socialAccountId: input.socialAccountId }));
    if (!input.capabilityRange) blockers.push(blocker("PLATFORM_CAPABILITY_UNKNOWN", "Current platform capability must be confirmed.", { socialAccountId: input.socialAccountId, platform: input.account.platform }));
    if (!input.candidate) blockers.push(blocker("PLAYBOOK_CADENCE_MISSING", "The selected playbook must provide a candidate cadence range.", { socialAccountId: input.socialAccountId }));
  }
  if (blockers.length) return blockedPlan({ ownership, strategySnapshot, cycleStart, cycleDays: days, blockers, assumptions });

  const start = utcDate(cycleStart);
  const cycleId = deterministicId("cycle", { companyId: ownership?.companyId, strategySnapshotId: strategySnapshot.id, strategyVersion: strategySnapshot.version, start: dateOnly(start), days, accounts: ids });
  const topicLimit = positiveInteger(object(inventory).topics) ?? Number.MAX_SAFE_INTEGER;
  const evidenceLimit = positiveInteger(object(inventory).evidence) ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(Number(object(inventory).topics))) assumptions.push({ code: "TOPIC_INVENTORY_UNBOUNDED", message: "Topic inventory was not supplied and did not reduce cadence." });
  if (!Number.isFinite(Number(object(inventory).evidence))) assumptions.push({ code: "EVIDENCE_INVENTORY_UNBOUNDED", message: "Evidence inventory was not supplied and did not reduce cadence." });
  const sharedCapacityLimit = Math.min(...Object.values(resolvedCapacity.limits), topicLimit, evidenceLimit);
  const conflicts = [];
  const proposals = inputs.map((input) => {
    const requestedMax = input.candidate.maxItems;
    const freshRecommendations = list(input.plan.recommendations).filter((item) => !["block", "rework"].includes(item.duplication?.decision));
    const topicCapacity = input.plan.nextCycleContentPortfolio ? freshRecommendations.length : requestedMax;
    const normalizedTarget = Math.min(requestedMax, input.capabilityRange.maxItems);
    const accountCapacity = Math.min(normalizedTarget, topicCapacity);
    if (normalizedTarget < requestedMax) {
      assumptions.push({
        code: "ACCOUNT_CADENCE_NORMALIZED",
        message: `账号建议节奏 ${requestedMax} 条已按当前确认产能归一化为 ${normalizedTarget} 条。`,
        socialAccountId: input.account.id,
        requestedItems: requestedMax,
        normalizedItems: normalizedTarget
      });
    }
    if (topicCapacity < normalizedTarget) {
      conflicts.push({
        code: "FRESH_TOPIC_CAPACITY_CONFLICT",
        message: `本周期目标 ${normalizedTarget} 条，但只有 ${accountCapacity} 条选题通过历史去重门槛；未通过的槽位不会降级复用旧选题。`,
        socialAccountId: input.account.id,
        requestedItems: normalizedTarget,
        deliverableItems: accountCapacity
      });
    }
    return { ...input, requestedMin: Math.min(input.candidate.minItems, normalizedTarget), requestedMax: normalizedTarget, desired: Math.max(0, accountCapacity), allocated: 0 };
  });
  const requestedTotal = proposals.reduce((sum, item) => sum + item.desired, 0);
  let remaining = sharedCapacityLimit;
  while (remaining > 0 && proposals.some((proposal) => proposal.allocated < proposal.desired)) {
    for (const proposal of proposals) {
      if (remaining <= 0) break;
      if (proposal.allocated < proposal.desired) {
        proposal.allocated += 1;
        remaining -= 1;
      }
    }
  }
  const allocatedTotal = proposals.reduce((sum, item) => sum + item.allocated, 0);
  if (allocatedTotal < requestedTotal) {
    const limitingSteps = [
      ...Object.entries(resolvedCapacity.limits).filter(([, value]) => value === sharedCapacityLimit).map(([key]) => key),
      ...(topicLimit === sharedCapacityLimit ? ["topicInventory"] : []),
      ...(evidenceLimit === sharedCapacityLimit ? ["evidenceInventory"] : [])
    ];
    conflicts.push({
      code: proposals.length > 1 ? "MATRIX_RESOURCE_COLLISION" : "CADENCE_EXCEEDS_CAPACITY",
      message: "Candidate cadence was deterministically reduced to the shared deliverable capacity.",
      requestedItems: requestedTotal,
      deliverableItems: allocatedTotal,
      limitingSteps
    });
  }
  const freezeWindowDays = Math.min(days, Math.max(0, positiveInteger(freezeDays) ?? 7));
  const committedUntil = freezeWindowDays ? dateOnly(addDays(start, freezeWindowDays - 1)) : null;
  const slots = [];
  const feedbackCheckpoints = [];
  for (const proposal of proposals) {
    const observation = platformObservation(proposal.account.platform);
    const dates = distributeDates(start, days, proposal.allocated);
    const functions = weightedSequence(proposal.strategy.contentFunctionTargets);
    const pillars = list(proposal.plan.contentPillars || strategyDocument(strategySnapshot)?.strategy?.contentSystem?.pillars).map((item) => typeof item === "string" ? item : item.id || item.name);
    const recommendations = list(proposal.plan.recommendations);
    dates.forEach((scheduledDate, index) => {
      const recommendation = recommendations[index] || {};
      const state = freezeWindowDays && scheduledDate < addDays(start, freezeWindowDays) ? "committed" : "draft";
      const slotBase = { cycleId, socialAccountId: proposal.account.id, sequence: index + 1, state };
      const slot = {
        slotId: deterministicId("slot", slotBase),
        state,
        zone: state,
        scheduledFor: dateOnly(scheduledDate),
        targetWindow: { date: dateOnly(scheduledDate), allowedWindows: list(proposal.plan.allowedWindows), source: "deterministic_cycle_spacing" },
        accountId: proposal.account.id,
        socialAccountId: proposal.account.id,
        accountName: proposal.account.name || proposal.account.id,
        platform: proposal.account.platform,
        strategySnapshotId: strategySnapshot.id,
        strategyVersion: strategySnapshot.version,
        growthPlaybookId: proposal.playbookId,
        playbookVersion: proposal.playbookVersion || "1.0",
        contentPillar: recommendation.contentPillar || pillars[index % Math.max(1, pillars.length)] || "unassigned",
        contentPillarId: recommendation.contentPillar || pillars[index % Math.max(1, pillars.length)] || "unassigned",
        contentFunction: recommendation.contentFunction || functions[index % functions.length],
        objective: recommendation.contentFunction || functions[index % functions.length],
        contentType: recommendation.contentType || recommendation.format || (proposal.account.platform === "xiaohongshu" ? "image_text" : "article"),
        experiment: structuredClone(recommendation.experiment || proposal.plan.experiment || proposal.strategy.experimentPlan || {}),
        experimentId: recommendation.experiment?.id || proposal.plan.experiment?.id || proposal.strategy.experimentPlan?.id || null,
        evidenceRequirements: list(recommendation.evidenceRequirements || proposal.plan.evidenceRequirements),
        requiredEvidenceIds: list(recommendation.requiredEvidenceIds || proposal.plan.requiredEvidenceIds),
        assetRequirements: list(recommendation.assetRequirements || proposal.plan.assetRequirements || observation.assetDefaults),
        requiredAssetTypes: list(recommendation.assetRequirements || proposal.plan.assetRequirements || observation.assetDefaults),
        recommendationId: recommendation.id || null,
        topic: recommendation.topic || null,
        motherTopicKey: recommendation.motherTopicKey || null,
        platformTopicVariant: recommendation.platformTopicVariant || null,
        crossPlatformReusePolicy: recommendation.crossPlatformReusePolicy || null,
        learningLane: recommendation.learningLane || null,
        nextCyclePortfolioRef: structuredClone(recommendation.nextCyclePortfolioRef || null),
        contentLearningInstruction: structuredClone(recommendation.contentLearningInstruction || null),
        duplication: structuredClone(recommendation.duplication || null),
        contentRunId: null
      };
      slots.push(slot);
      feedbackCheckpoints.push(...observation.checkpoints.map((checkpoint) => ({
        checkpointId: deterministicId("checkpoint", { slotId: slot.slotId, checkpoint }),
        slotId: slot.slotId,
        socialAccountId: proposal.account.id,
        platform: proposal.account.platform,
        checkpoint: checkpoint.offset === "cycle_end" ? "cycle" : checkpoint.label === "T+72h" ? "72h" : "7d",
        dueAt: `${checkpoint.offset === "cycle_end" ? dateOnly(addDays(start, days)) : dateOnly(addDays(scheduledDate, checkpoint.offsetDays))}T00:00:00.000Z`,
        dueOn: checkpoint.offset === "cycle_end" ? dateOnly(addDays(start, days)) : dateOnly(addDays(scheduledDate, checkpoint.offsetDays)),
        label: checkpoint.label,
        observationSurfaces: checkpoint.surfaces,
        interpretationNote: observation.note
      })));
    });
    const bufferBase = { cycleId, socialAccountId: proposal.account.id, sequence: proposal.allocated + 1, state: "buffer" };
    slots.push({
      slotId: deterministicId("slot", bufferBase),
      state: "buffer",
      zone: "buffer",
      scheduledFor: null,
      targetWindow: { date: null, allowedWindows: [], source: "capacity_buffer" },
      accountId: proposal.account.id,
      socialAccountId: proposal.account.id,
      accountName: proposal.account.name || proposal.account.id,
      platform: proposal.account.platform,
      strategySnapshotId: strategySnapshot.id,
      strategyVersion: strategySnapshot.version,
      growthPlaybookId: proposal.playbookId,
      playbookVersion: proposal.playbookVersion || "1.0",
      contentPillar: "buffer",
      contentPillarId: "buffer",
      contentFunction: functions[0],
      objective: functions[0],
      contentType: proposal.account.platform === "xiaohongshu" ? "image_text" : "article",
      experiment: structuredClone(proposal.plan.experiment || proposal.strategy.experimentPlan || {}),
      experimentId: proposal.plan.experiment?.id || proposal.strategy.experimentPlan?.id || null,
      evidenceRequirements: [],
      requiredEvidenceIds: [],
      assetRequirements: observation.assetDefaults,
      requiredAssetTypes: observation.assetDefaults,
      recommendationId: null,
      topic: null,
      contentRunId: null
    });
  }
  const existingCycles = list(existingPublishingCyclePlans).filter((item) => item?.cycleId !== cycleId && !["completed", "superseded", "blocked"].includes(item?.status));
  for (const existing of existingCycles) {
    const overlaps = dateOnly(start) < String(existing.cycleEnd || "") && dateOnly(addDays(start, days)) > String(existing.cycleStart || "");
    if (!overlaps) continue;
    assumptions.push({
      code: "ROLLING_CYCLE_WINDOW_OVERLAP",
      message: `新周期与现有周期 ${existing.cycleStart} 至 ${existing.cycleEnd} 存在滚动窗口重叠；没有同账号同日撞期时可以继续。`,
      existingCycleId: existing.cycleId,
      existingCycleStart: existing.cycleStart,
      existingCycleEnd: existing.cycleEnd
    });
    const occupied = new Set(list(existing.slots).filter((slot) => slot?.scheduledFor && slot?.socialAccountId && slot?.zone !== "buffer").map((slot) => `${slot.socialAccountId}:${slot.scheduledFor}`));
    for (const slot of slots.filter((item) => item.scheduledFor && item.zone !== "buffer")) {
      if (!occupied.has(`${slot.socialAccountId}:${slot.scheduledFor}`)) continue;
      conflicts.push({
        code: "ACCOUNT_DATE_COLLISION",
        message: `${slot.accountName || slot.socialAccountId} 在 ${slot.scheduledFor} 已有其他周期的发布承诺，请调整日期后再确认。`,
        socialAccountId: slot.socialAccountId,
        scheduledFor: slot.scheduledFor,
        existingCycleId: existing.cycleId,
        slotId: slot.slotId
      });
    }
  }
  const byAccount = proposals.map((proposal) => ({
    socialAccountId: proposal.account.id,
    platform: proposal.account.platform,
    minItems: Math.min(proposal.requestedMin, proposal.allocated),
    maxItems: proposal.allocated,
    targetItems: proposal.allocated,
    source: "playbook_candidate_constrained_by_current_capability_and_capacity"
  }));
  const decisions = [
    ...structuredClone(list(userDecisions)),
    ...conflicts.map((item, index) => ({
      decisionId: deterministicId("decision", { cycleId, code: item.code, socialAccountId: item.socialAccountId || null, index }),
      status: "pending",
      type: "confirm_deliverable_cadence",
      conflictCode: item.code
    }))
  ];
  const plan = {
    kind: "PublishingCyclePlan",
    schemaVersion: "1.0",
    cycleId,
    status: "draft",
    workspaceId: ownership?.workspaceId || null,
    companyId: ownership?.companyId || null,
    strategySnapshotId: strategySnapshot.id,
    strategyVersion: strategySnapshot.version,
    playbookVersions: proposals.map((item) => ({ socialAccountId: item.account.id, growthPlaybookId: item.playbookId, playbookVersion: item.playbookVersion || "1.0" })),
    cycleStart: dateOnly(start),
    cycleEnd: dateOnly(addDays(start, days)),
    planningHorizon: { startDate: dateOnly(start), endDate: dateOnly(addDays(start, days)), committedUntil },
    cadenceRange: {
      minItems: byAccount.reduce((sum, item) => sum + item.minItems, 0),
      maxItems: allocatedTotal,
      targetItems: allocatedTotal,
      windowDays: days,
      byAccount
    },
    cadenceByAccount: byAccount.map((item) => ({
      accountId: item.socialAccountId,
      minimum: item.minItems,
      target: item.targetItems,
      maximum: item.maxItems,
      rationale: [item.source]
    })),
    committedUntil,
    slots,
    feedbackCheckpoints,
    conflicts,
    assumptions,
    userDecisions: decisions,
    userDecisionsRequired: structuredClone(decisions),
    nextCycleContentPortfolios: proposals.map((item) => item.plan.nextCycleContentPortfolio).filter(Boolean).map((item) => structuredClone(item)),
    blockers: []
  };
  const validation = validatePublishingCyclePlan(plan);
  if (!validation.valid) throw cycleError("PUBLISHING_CYCLE_PLAN_INVALID", "PublishingCyclePlan validation failed.", { details: validation.errors });
  return plan;
}

export function transitionPublishingCyclePlan(plan, nextStatus) {
  const validation = validatePublishingCyclePlan(plan);
  if (!validation.valid) throw cycleError("PUBLISHING_CYCLE_PLAN_INVALID", "Cannot transition an invalid PublishingCyclePlan.", { details: validation.errors });
  if (!PLAN_TRANSITIONS[plan.status]?.has(nextStatus)) {
    throw cycleError("PUBLISHING_CYCLE_TRANSITION_INVALID", `Cannot transition PublishingCyclePlan from ${plan.status} to ${nextStatus}.`, { from: plan.status, to: nextStatus });
  }
  return { ...structuredClone(plan), status: nextStatus };
}

export function adaptPublishingCyclePlanToRollingContentPlan(plan) {
  const validation = validatePublishingCyclePlan(plan);
  if (!validation.valid) throw cycleError("PUBLISHING_CYCLE_PLAN_INVALID", "Cannot adapt an invalid PublishingCyclePlan.", { details: validation.errors });
  const items = list(plan.slots).filter((slot) => slot.state !== "buffer").map((slot) => ({
    id: `plan_item_${slot.slotId.replace(/^slot_/, "")}`,
    socialAccountId: slot.socialAccountId,
    accountName: slot.accountName,
    platform: slot.platform,
    strategySnapshotId: slot.strategySnapshotId,
    strategyVersion: slot.strategyVersion,
    growthPlaybookId: slot.growthPlaybookId,
    playbookVersion: slot.playbookVersion,
    experimentId: slot.experiment?.id || deterministicId("experiment", { cycleId: plan.cycleId, socialAccountId: slot.socialAccountId }),
    scheduledFor: slot.scheduledFor,
    status: slot.state === "committed" ? "planned" : "draft",
    contentFunction: slot.contentFunction,
    contentPillar: slot.contentPillar,
    topic: slot.topic,
    recommendationId: slot.recommendationId,
    sourcePublishingCycleId: plan.cycleId,
    sourcePublishingSlotId: slot.slotId,
    contentRunId: slot.contentRunId || null
  }));
  return {
    kind: "RollingContentPlan",
    schemaVersion: "1.0",
    id: deterministicId("rolling_plan", { cycleId: plan.cycleId }),
    workspaceId: plan.workspaceId,
    companyId: plan.companyId,
    strategySnapshotId: plan.strategySnapshotId,
    strategyVersion: plan.strategyVersion,
    traceabilityVersion: "1.0",
    windowDays: [7, 14, 30].includes(plan.cadenceRange.windowDays) ? plan.cadenceRange.windowDays : 14,
    status: ["confirmed", "active", "reviewing"].includes(plan.status) ? "active" : plan.status === "blocked" ? "blocked" : plan.status === "completed" ? "completed" : "draft",
    startsAt: `${plan.cycleStart}T00:00:00.000Z`,
    endsAt: `${plan.cycleEnd}T00:00:00.000Z`,
    items: items.map((item) => ({
      ...item,
      status: ["confirmed", "active", "reviewing"].includes(plan.status) && item.status === "planned" ? "planned" : "draft"
    })),
    sourcePublishingCycleId: plan.cycleId,
    createdAt: `${plan.cycleStart}T00:00:00.000Z`,
    updatedAt: `${plan.cycleStart}T00:00:00.000Z`
  };
}
