import { createHash, randomUUID } from "node:crypto";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const object = (value) => isObject(value) ? value : {};

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value ?? {});
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function mergeObject(base, override) {
  const result = clone(object(base));
  for (const [key, value] of Object.entries(object(override))) {
    if (value === undefined || value === null) continue;
    result[key] = isObject(value) ? mergeObject(result[key], value) : clone(value);
  }
  return result;
}

export function ensureStrategyHierarchy(store) {
  store.matrixStrategySnapshots ||= [];
  store.accountStrategySnapshots ||= [];
  for (const matrix of store.accountMatrices || []) {
    if (store.matrixStrategySnapshots.some((item) => item.matrixId === matrix.id)) continue;
    const accounts = (store.accounts || []).filter((item) => item.accountType === "social" && item.companyId === matrix.companyId);
    store.matrixStrategySnapshots.push({
      id: `strategy_scope_${randomUUID().slice(0, 8)}`,
      schemaVersion: "1.0",
      scope: "matrix",
      workspaceId: matrix.workspaceId,
      companyId: matrix.companyId,
      matrixId: matrix.id,
      socialAccountId: null,
      version: 1,
      status: "active",
      source: "migration_default",
      payload: {
        defaultRole: "brand_consistency",
        accountRoles: Object.fromEntries(accounts.map((account) => [account.id, { role: account.platform === "wechat" ? "authority_and_retention" : "discovery_and_trust", platform: account.platform }])),
        crossAccountRules: ["共享事实和品牌边界", "同一主题按账号角色差异化表达", "避免同平台账号机械重复"]
      },
      createdAt: now(),
      activatedAt: now()
    });
  }
  for (const account of (store.accounts || []).filter((item) => item.accountType === "social")) {
    if (store.accountStrategySnapshots.some((item) => item.socialAccountId === account.id)) continue;
    const contentPillars = list(account.contentPillars).map((item, index) => typeof item === "string" ? { id: `account_pillar_${index + 1}`, name: item } : item);
    store.accountStrategySnapshots.push({
      id: `strategy_scope_${randomUUID().slice(0, 8)}`,
      schemaVersion: "1.0",
      scope: "social_account",
      workspaceId: account.workspaceId,
      companyId: account.companyId,
      matrixId: account.matrixId || null,
      socialAccountId: account.id,
      version: 1,
      status: "active",
      source: "migration_default",
      payload: {
        subjectType: "company_official",
        accountMode: account.businessMode || "brand_operation",
        matrixRole: account.platform === "wechat" ? "authority_and_retention" : "discovery_and_trust",
        growthPlaybook: "steady_vertical",
        ...(account.audience ? { audiences: [{ id: `audience_${account.id}`, name: account.audience, priority: 1 }] } : {}),
        ...(contentPillars.length ? { contentPillars } : {}),
        platformPlaybook: { role: account.platform === "wechat" ? "深度论证、关系沉淀与业务承接" : "场景触达、需求共鸣与专业信任", toneDefaults: list(account.tone) }
      },
      createdAt: now(),
      activatedAt: now()
    });
  }
  return store;
}

function saveVersion(collection, { scopeKey, scopeValue, workspaceId, companyId, matrixId = null, socialAccountId = null, payload, status = "active", source = "user_confirmed" }) {
  if (!scopeValue || !payload || typeof payload !== "object") throw new Error("策略作用域和策略内容不能为空");
  const scoped = collection.filter((item) => item[scopeKey] === scopeValue);
  const version = Math.max(0, ...scoped.map((item) => Number(item.version || 0))) + 1;
  if (status === "active") {
    for (const item of scoped) if (item.status === "active") item.status = "superseded";
  }
  const snapshot = {
    id: `strategy_scope_${randomUUID().slice(0, 8)}`,
    schemaVersion: "1.0",
    scope: scopeKey === "matrixId" ? "matrix" : "social_account",
    workspaceId,
    companyId,
    matrixId,
    socialAccountId,
    version,
    status,
    source,
    payload: clone(payload),
    createdAt: now(),
    activatedAt: status === "active" ? now() : null
  };
  collection.push(snapshot);
  return snapshot;
}

export function saveMatrixStrategySnapshot(store, input) {
  ensureStrategyHierarchy(store);
  return saveVersion(store.matrixStrategySnapshots, { ...input, scopeKey: "matrixId", scopeValue: input.matrixId });
}

export function saveAccountStrategySnapshot(store, input) {
  ensureStrategyHierarchy(store);
  return saveVersion(store.accountStrategySnapshots, { ...input, scopeKey: "socialAccountId", scopeValue: input.socialAccountId });
}

export function getActiveMatrixStrategy(store, matrixId) {
  ensureStrategyHierarchy(store);
  return store.matrixStrategySnapshots.filter((item) => item.matrixId === matrixId && item.status === "active").sort((a, b) => Number(b.version) - Number(a.version))[0] || null;
}

export function getActiveAccountStrategy(store, socialAccountId) {
  ensureStrategyHierarchy(store);
  return store.accountStrategySnapshots.filter((item) => item.socialAccountId === socialAccountId && item.status === "active").sort((a, b) => Number(b.version) - Number(a.version))[0] || null;
}

export function listStrategyHierarchy(store, { companyId, matrixId = null, socialAccountId = null } = {}) {
  ensureStrategyHierarchy(store);
  return {
    matrixSnapshots: store.matrixStrategySnapshots.filter((item) => (!companyId || item.companyId === companyId) && (!matrixId || item.matrixId === matrixId)),
    accountSnapshots: store.accountStrategySnapshots.filter((item) => (!companyId || item.companyId === companyId) && (!socialAccountId || item.socialAccountId === socialAccountId))
  };
}

function applyMatrixPolicy(document, matrixPayload, socialAccountId) {
  const next = clone(document);
  const payload = object(matrixPayload);
  const accountRole = object(payload.accountRoles)[socialAccountId] || {};
  next.strategy ||= {};
  next.strategy.matrixPolicy = {
    matrixRole: accountRole.role || payload.defaultRole || null,
    sharedPillarIds: list(payload.sharedPillarIds),
    prohibitedOverlap: list(payload.prohibitedOverlap),
    crossAccountRules: list(payload.crossAccountRules),
    accountRole: clone(accountRole)
  };
  if (list(payload.sharedPillars).length) {
    const current = list(next.strategy.contentSystem?.pillars);
    next.strategy.contentSystem ||= {};
    next.strategy.contentSystem.pillars = [...current, ...payload.sharedPillars.filter((pillar) => !current.some((item) => item.id === pillar.id))];
  }
  return next;
}

function applyAccountPolicy(document, accountPayload, platform) {
  const next = clone(document);
  const payload = object(accountPayload);
  next.strategy ||= {};
  if (payload.growthStage) next.strategy.growthStage = payload.growthStage;
  if (payload.operatingMode) next.strategy.operatingMode = payload.operatingMode;
  if (list(payload.audiences).length) next.strategy.audiences = clone(payload.audiences);
  if (list(payload.contentPillars).length) {
    next.strategy.contentSystem ||= {};
    next.strategy.contentSystem.pillars = clone(payload.contentPillars);
  }
  if (payload.contentFunctionPortfolio) {
    next.strategy.contentSystem ||= {};
    next.strategy.contentSystem.portfolio = mergeObject(next.strategy.contentSystem.portfolio, payload.contentFunctionPortfolio);
  }
  if (payload.conversionSystem) next.strategy.conversionSystem = mergeObject(next.strategy.conversionSystem, payload.conversionSystem);
  if (payload.platformPlaybook && platform) {
    next.strategy.platformPlaybooks ||= {};
    next.strategy.platformPlaybooks[platform] = mergeObject(next.strategy.platformPlaybooks[platform], payload.platformPlaybook);
  }
  next.strategy.accountPolicy = {
    subjectType: payload.subjectType || payload.accountIdentity?.subjectType || "company_official",
    accountMode: payload.accountMode || payload.accountIdentity?.accountMode || "brand_operation",
    matrixRole: payload.matrixRole || next.strategy.matrixPolicy?.matrixRole || null,
    growthPlaybook: payload.growthPlaybook || payload.selectedPlaybookId || "steady_vertical",
    growthMode: payload.growthMode || "steady_vertical",
    trustSources: list(payload.trustSources || payload.accountIdentity?.trustSources),
    speaker: payload.speaker || payload.accountIdentity?.speaker || null,
    hotspotPolicy: clone(payload.hotspotPolicy),
    experimentPlan: clone(payload.experimentPlan),
    playbookVersion: payload.playbookVersion || "1.0",
    recommendedCadence: clone(payload.recommendedCadence),
    roleLabel: payload.roleLabel || null,
    conversionResponsibility: payload.conversionResponsibility || null,
    voiceIdentity: clone(payload.voiceIdentity),
    openHypotheses: list(payload.openHypotheses)
  };
  return next;
}

function migrationCompatibleAccountPayload(accountPayload = {}) {
  const {
    audiences,
    contentPillars,
    contentFunctionPortfolio,
    conversionSystem,
    platformPlaybook,
    ...accountMetadata
  } = object(accountPayload);
  return accountMetadata;
}

export function isAccountActiveInStrategy(baseSnapshot, socialAccountId) {
  const document=baseSnapshot?.document || baseSnapshot?.payload || baseSnapshot || {};
  const portfolio=object(document?.strategyExtensions?.accountPortfolio);
  const strategies=list(document?.strategyExtensions?.accountGrowthStrategies);
  const selected=list(portfolio.selectedSocialAccountIds || portfolio.selectedAccountIds);
  if(!selected.length&&!strategies.length)return true;
  const activeIds=selected.length?selected:strategies.map((item)=>item.socialAccountId).filter(Boolean);
  const primary=portfolio.primarySocialAccountId || activeIds[0] || null;
  return portfolio.mode==="single_account" ? socialAccountId===primary : activeIds.includes(socialAccountId);
}

export function resolveEffectiveAccountStrategy({ baseSnapshot, matrixSnapshot = null, accountSnapshot = null, ownership }) {
  if (!baseSnapshot) throw new Error("公司活动策略不存在");
  if(ownership?.socialAccountId&&!isAccountActiveInStrategy(baseSnapshot,ownership.socialAccountId)){
    const error=new Error("该账号未纳入当前活动策略，需先在策略 Agent 中启用");
    error.code="ACCOUNT_NOT_ACTIVE_IN_STRATEGY";
    error.statusCode=409;
    throw error;
  }
  const baseDocument = baseSnapshot.document || baseSnapshot.payload || baseSnapshot;
  let document = clone(baseDocument);
  const embeddedAccountStrategy = list(baseDocument?.strategyExtensions?.accountGrowthStrategies).find((item) => item.socialAccountId === ownership.socialAccountId);
  const portfolioMode=baseDocument?.strategyExtensions?.accountPortfolio?.mode || "legacy";
  const compatibilityOnlyAccountSnapshot = ["migration_default", "account_settings_confirmed"].includes(accountSnapshot?.source);
  if (accountSnapshot?.payload&&compatibilityOnlyAccountSnapshot) {
    document = applyAccountPolicy(document, migrationCompatibleAccountPayload(accountSnapshot.payload), ownership.socialAccount?.platform);
  }
  if ((portfolioMode==="role_matrix"||portfolioMode==="legacy")&&matrixSnapshot?.payload) document = applyMatrixPolicy(document, matrixSnapshot.payload, ownership.socialAccountId);
  if (embeddedAccountStrategy) document = applyAccountPolicy(document, { ...embeddedAccountStrategy, contentFunctionPortfolio: embeddedAccountStrategy.contentFunctionTargets }, ownership.socialAccount?.platform);
  if (accountSnapshot?.payload&&!compatibilityOnlyAccountSnapshot) document = applyAccountPolicy(document, accountSnapshot.payload, ownership.socialAccount?.platform);
  const resolvedAccountPolicy=document.strategy?.accountPolicy || {};
  const resolution = {
    companyStrategySnapshotId: baseSnapshot.id,
    companyStrategyVersion:baseSnapshot.version||null,
    matrixStrategySnapshotId: matrixSnapshot?.id || null,
    matrixStrategyVersion:matrixSnapshot?.version||null,
    accountStrategySnapshotId: accountSnapshot?.id || null,
    accountStrategyVersion:accountSnapshot?.version||null,
    portfolioMode,
    growthPlaybookId:resolvedAccountPolicy.growthPlaybook||null,
    growthPlaybookVersion:resolvedAccountPolicy.playbookVersion||null,
    experimentId:resolvedAccountPolicy.experimentPlan?.id||null,
    priorityOrder: ["legal_fact_authorization", "user_current_instruction", "confirmed_account_strategy", "confirmed_matrix_strategy", "company_strategy", "migration_default", "rolling_plan", "platform_playbook", "planner", "skill_defaults"]
  };
  return {
    ...baseSnapshot,
    id: baseSnapshot.id,
    workspaceId: ownership.workspaceId,
    companyId: ownership.companyId,
    socialAccountId: ownership.socialAccountId,
    document,
    effectiveStrategyId: `effective_${hash({ resolution, document })}`,
    resolution
  };
}
