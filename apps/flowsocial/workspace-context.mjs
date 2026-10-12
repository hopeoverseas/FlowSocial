export const DEFAULT_WORKSPACE_ID = "workspace_default";

export const SOCIAL_ACCOUNT_SPEAKER_TYPES = Object.freeze(["brand_official", "founder", "expert_advisor", "operations_team", "other"]);
export const SOCIAL_ACCOUNT_TRUST_SOURCES = Object.freeze(["professional_knowledge", "real_cases", "founder_experience", "product_capability", "customer_reputation", "industry_data", "other"]);
export const SUPPORTED_STRATEGY_PLATFORMS = Object.freeze(["xiaohongshu", "wechat"]);

const isCompanyAccount = (account) => account?.accountType === "company" || account?.id === "account_damaishuzhi";
const clean = (value) => typeof value === "string" ? value.trim() : "";
const unique = (value) => [...new Set((Array.isArray(value) ? value : []).map(clean).filter(Boolean))];

export function socialAccountIdentityId(socialAccountId) {
  return `identity_${String(socialAccountId || "unknown").replace(/[^a-z0-9_-]+/gi, "_")}`;
}

export function normalizeSocialAccountIdentity(account = {}, identityPatch = null) {
  const legacy = account.accountIdentity && typeof account.accountIdentity === "object" ? account.accountIdentity : {};
  const patch = identityPatch && typeof identityPatch === "object" ? identityPatch : {};
  const socialAccountId = account.socialAccountId || account.id || patch.socialAccountId || legacy.socialAccountId || null;
  const companyId = account.companyId || patch.companyId || legacy.companyId || null;
  const speakerType = clean(patch.speakerType || legacy.speakerType || account.speakerType);
  const trustSources = unique(patch.trustSources ?? legacy.trustSources ?? account.trustSources);
  return {
    id: account.accountIdentityId || patch.id || legacy.id || socialAccountIdentityId(socialAccountId),
    companyId,
    socialAccountId,
    subjectType: clean(patch.subjectType || legacy.subjectType || account.subjectType),
    publicIdentity: clean(patch.publicIdentity || legacy.publicIdentity || account.publicIdentity),
    speakerType: SOCIAL_ACCOUNT_SPEAKER_TYPES.includes(speakerType) ? speakerType : "",
    speakerDetail: clean(patch.speakerDetail || legacy.speakerDetail || account.speakerDetail || legacy.speaker),
    trustSources: trustSources.filter((item) => SOCIAL_ACCOUNT_TRUST_SOURCES.includes(item)),
    version: Math.max(1, Number(patch.version || legacy.version || account.accountIdentityVersion || 1)),
    updatedAt: patch.updatedAt || legacy.updatedAt || account.updatedAt || account.createdAt || null
  };
}

export function evaluateSocialAccountConfiguration(account = {}, company = null) {
  const identity = normalizeSocialAccountIdentity(account);
  const missingBaseFields = [];
  if (!clean(account.name)) missingBaseFields.push("name");
  if (!SUPPORTED_STRATEGY_PLATFORMS.includes(account.platform)) missingBaseFields.push("platform");
  if (!clean(account.companyId) || !company) missingBaseFields.push("companyId");
  const missingIdentityFields = [];
  if (!identity.subjectType) missingIdentityFields.push("subjectType");
  if (!identity.speakerType) missingIdentityFields.push("speakerType");
  if (!identity.trustSources.length) missingIdentityFields.push("trustSources");
  const enabled = ["active", "setup_required"].includes(account.status);
  return {
    status: !enabled ? "disabled" : missingBaseFields.length || missingIdentityFields.length ? "setup_required" : "configured",
    enabled,
    baseComplete: missingBaseFields.length === 0,
    identityComplete: missingIdentityFields.length === 0,
    complete: enabled && missingBaseFields.length === 0 && missingIdentityFields.length === 0,
    selectionEligible: enabled && missingBaseFields.length === 0,
    planningEligible: enabled && missingBaseFields.length === 0 && missingIdentityFields.length === 0,
    missingFields: [...missingBaseFields, ...missingIdentityFields]
  };
}

export function projectSocialAccount(account = {}, company = null) {
  const accountIdentity = normalizeSocialAccountIdentity(account);
  const configuration = evaluateSocialAccountConfiguration({ ...account, accountIdentity }, company);
  return {
    ...account,
    companyName: company?.name || null,
    operatorName: clean(account.operatorName) || company?.name || "",
    socialAccountId: account.socialAccountId || account.id,
    accountIdentityId: accountIdentity.id,
    accountIdentity,
    configurationStatus: configuration.status,
    configuration
  };
}

export function ensureWorkspaceContext(store) {
  store.workspaces ||= [{ id: DEFAULT_WORKSPACE_ID, name: "默认工作区", status: "active", createdAt: new Date().toISOString() }];
  if (!store.workspaces.some((item) => item.id === DEFAULT_WORKSPACE_ID)) store.workspaces.unshift({ id: DEFAULT_WORKSPACE_ID, name: "默认工作区", status: "active", createdAt: new Date().toISOString() });
  store.users ||= [{ id: "user_local_owner", name: "本地管理员", status: "active", createdAt: new Date().toISOString() }];
  store.workspaceMemberships ||= [{ workspaceId: DEFAULT_WORKSPACE_ID, userId: "user_local_owner", role: "owner", status: "active" }];
  store.currentUserId ||= "user_local_owner";
  store.accountMatrices ||= [];
  const companies = (store.accounts || []).filter(isCompanyAccount);
  const fallbackCompany = companies.find((item) => item.id === "account_damaishuzhi") || companies[0] || null;
  for (const account of store.accounts || []) {
    account.workspaceId ||= DEFAULT_WORKSPACE_ID;
    if (isCompanyAccount(account)) {
      account.accountType = "company";
      account.companyId = account.id;
    } else {
      account.accountType ||= "social";
      account.companyId ||= fallbackCompany?.id || null;
      account.socialAccountId ||= account.id;
      const identity = normalizeSocialAccountIdentity(account);
      account.accountIdentityId ||= identity.id;
      account.accountIdentity = identity;
      account.accountIdentityVersion ||= identity.version;
      const company = companies.find((item) => item.id === account.companyId) || null;
      account.configurationStatus = evaluateSocialAccountConfiguration(account, company).status;
    }
  }
  for (const company of companies) {
    if (!store.accountMatrices.some((item) => item.companyId === company.id)) {
      store.accountMatrices.push({
        id: `matrix_${company.id.replace(/[^a-z0-9]+/gi, "_")}`,
        workspaceId: company.workspaceId || DEFAULT_WORKSPACE_ID,
        companyId: company.id,
        name: `${company.name}账号矩阵`,
        status: "active",
        createdAt: company.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    company.matrixId ||= store.accountMatrices.find((item) => item.companyId === company.id)?.id || null;
  }
  for (const account of store.accounts || []) {
    if (isCompanyAccount(account)) continue;
    account.matrixId ||= store.accountMatrices.find((item) => item.companyId === account.companyId)?.id || null;
  }
  for (const collectionName of ["contentTasks", "contentPublications", "contentRuns"]) {
    for (const item of store[collectionName] || []) {
      const account = (store.accounts || []).find((candidate) => candidate.id === (item.socialAccountId || item.accountId));
      item.workspaceId ||= account?.workspaceId || DEFAULT_WORKSPACE_ID;
      item.companyId ||= isCompanyAccount(account) ? account.id : account?.companyId || fallbackCompany?.id || null;
      item.socialAccountId ||= account && !isCompanyAccount(account) ? account.id : null;
    }
  }
  for (const direction of store.contentDirections || []) {
    const strategyCompany=(store.accounts||[]).find((item)=>isCompanyAccount(item)&&item.strategySnapshotId===direction.strategySnapshotId);
    direction.workspaceId ||= strategyCompany?.workspaceId || DEFAULT_WORKSPACE_ID;
    direction.companyId ||= strategyCompany?.id || fallbackCompany?.id || null;
  }
  const directionCompany=(directionId)=>(store.contentDirections||[]).find((item)=>item.id===directionId)?.companyId||fallbackCompany?.id||null;
  for (const collectionName of ["hotspotLibrary","hotspotRuns","hotspotPreviews","topics","topicRuns","topicSelections"]) {
    for (const item of store[collectionName] || []) {
      const directionId=item.directionId||item.run?.directionId;
      item.workspaceId ||= DEFAULT_WORKSPACE_ID;
      item.companyId ||= directionId ? directionCompany(directionId) : fallbackCompany?.id || null;
      if (item.run) { item.run.workspaceId ||= item.workspaceId; item.run.companyId ||= item.companyId; }
    }
  }
  return store;
}

export function listCompanies(store, workspaceId = DEFAULT_WORKSPACE_ID) {
  ensureWorkspaceContext(store);
  return (store.accounts || []).filter((item) => isCompanyAccount(item) && item.workspaceId === workspaceId);
}

export function resolveOwnershipContext(store, { companyId = null, accountId = null, socialAccountId = null } = {}) {
  ensureWorkspaceContext(store);
  const requestedAccountId = socialAccountId || accountId;
  const account = (store.accounts || []).find((item) => item.id === requestedAccountId) || null;
  const resolvedCompanyId = companyId || (isCompanyAccount(account) ? account.id : account?.companyId) || null;
  const company = (store.accounts || []).find((item) => isCompanyAccount(item) && item.id === resolvedCompanyId) || null;
  const resolvedSocial = account && !isCompanyAccount(account) ? account : null;
  return {
    workspaceId: company?.workspaceId || account?.workspaceId || DEFAULT_WORKSPACE_ID,
    companyId: company?.id || null,
    company,
    socialAccountId: resolvedSocial?.id || null,
    socialAccount: resolvedSocial,
    requestedAccount: account
  };
}

export function assertOwnershipContext(context) {
  if (!context?.workspaceId || !context?.companyId || !context?.company) throw new Error("无法确定当前任务所属公司");
  return context;
}

export function companySocialAccounts(store, companyId) {
  ensureWorkspaceContext(store);
  return (store.accounts || []).filter((item) => !isCompanyAccount(item) && item.companyId === companyId);
}

export function getCompanyMatrix(store, companyId) {
  ensureWorkspaceContext(store);
  return (store.accountMatrices || []).find((item) => item.companyId === companyId && item.status !== "archived") || null;
}

export function assertSocialAccountOwnership(store, { companyId, socialAccountId }) {
  const context = assertOwnershipContext(resolveOwnershipContext(store, { companyId, socialAccountId }));
  if (!context.socialAccount || context.socialAccount.companyId !== context.companyId) {
    const error = new Error("所选社媒账号不属于当前公司");
    error.statusCode = 403;
    error.code = "SOCIAL_ACCOUNT_OWNERSHIP_MISMATCH";
    throw error;
  }
  return context;
}

export function resolveContentAccountContext(store, { companyId = null, socialAccountId = null, accountId = null, platform = null, strategySnapshot = null } = {}) {
  ensureWorkspaceContext(store);
  const requested = socialAccountId || accountId || null;
  const requestedRecord = (store.accounts || []).find((item) => item.id === requested) || null;
  const explicitSocialAccountId = requestedRecord && !isCompanyAccount(requestedRecord) ? requestedRecord.id : null;
  const resolvedCompanyId = companyId || (requestedRecord && isCompanyAccount(requestedRecord) ? requestedRecord.id : requestedRecord?.companyId) || strategySnapshot?.accountId || null;
  const company = (store.accounts || []).find((item) => isCompanyAccount(item) && item.id === resolvedCompanyId) || null;
  if (!company) throw Object.assign(new Error("无法确定内容任务所属公司"), { statusCode: 400, code: "COMPANY_CONTEXT_REQUIRED" });

  const document = strategySnapshot?.document || strategySnapshot?.payload || strategySnapshot || {};
  const portfolio = document?.strategyExtensions?.accountPortfolio || {};
  const growthStrategies = Array.isArray(document?.strategyExtensions?.accountGrowthStrategies) ? document.strategyExtensions.accountGrowthStrategies : [];
  const selectedIds = [...new Set((portfolio.selectedSocialAccountIds || portfolio.selectedAccountIds || growthStrategies.map((item) => item.socialAccountId)).filter(Boolean))];
  const eligible = companySocialAccounts(store, company.id).filter((item) => item.status !== "archived" && (!selectedIds.length || selectedIds.includes(item.id)));
  let selectedSocialAccountId = explicitSocialAccountId;
  let selectionSource = "user_confirmed";

  if (!selectedSocialAccountId) {
    const mode = portfolio.mode || (eligible.length === 1 ? "single_account" : "legacy");
    if (mode === "single_account") {
      selectedSocialAccountId = portfolio.primarySocialAccountId || selectedIds[0] || eligible[0]?.id || null;
      selectionSource = "single_account_default";
    } else {
      const error = new Error("矩阵模式下必须先选择一个具体社媒账号");
      error.statusCode = 409;
      error.code = "SOCIAL_ACCOUNT_SELECTION_REQUIRED";
      error.details = { portfolioMode: mode, selectableAccounts: eligible.map((item) => ({ socialAccountId: item.id, name: item.name, platform: item.platform })) };
      throw error;
    }
  }

  const ownership = assertSocialAccountOwnership(store, { companyId: company.id, socialAccountId: selectedSocialAccountId });
  if (platform && ownership.socialAccount.platform !== platform) {
    throw Object.assign(new Error("所选社媒账号与内容平台不一致"), { statusCode: 409, code: "SOCIAL_ACCOUNT_PLATFORM_MISMATCH" });
  }
  return { ...ownership, selectionSource };
}

export function buildContentAccountContext({ ownership, strategySnapshot, effectiveStrategy = null }) {
  if (!ownership?.socialAccountId) throw new Error("内容上下文必须包含具体社媒账号");
  return {
    workspaceId: ownership.workspaceId,
    companyId: ownership.companyId,
    socialAccountId: ownership.socialAccountId,
    platform: ownership.socialAccount?.platform,
    strategySnapshotId: strategySnapshot?.id || effectiveStrategy?.resolution?.companyStrategySnapshotId || null,
    accountStrategySnapshotId: effectiveStrategy?.resolution?.accountStrategySnapshotId || null,
    selectionSource: ownership.selectionSource || "user_confirmed"
  };
}
