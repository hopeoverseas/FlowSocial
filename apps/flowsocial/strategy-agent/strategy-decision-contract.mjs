import { SOCIAL_ACCOUNT_SPEAKER_TYPES, SOCIAL_ACCOUNT_TRUST_SOURCES, normalizeSocialAccountIdentity, projectSocialAccount } from "../workspace-context.mjs";

export const STRATEGY_DECISION_VERSION = "1.1";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const unique = (value) => [...new Set(list(value).map((item) => String(item || "").trim()).filter(Boolean))];

function canonicalPortfolio(portfolio = {}, availableIds = []) {
  const mode = ["single_account", "role_matrix"].includes(portfolio.mode) ? portfolio.mode : "single_account";
  const requested = unique(portfolio.selectedSocialAccountIds || portfolio.selectedAccountIds).filter((id) => availableIds.includes(id));
  const primarySocialAccountId = availableIds.includes(portfolio.primarySocialAccountId)
    ? portfolio.primarySocialAccountId
    : requested[0] || null;
  const selectedSocialAccountIds = mode === "single_account"
    ? (primarySocialAccountId ? [primarySocialAccountId] : [])
    : requested;
  const accountRoles = Object.fromEntries(selectedSocialAccountIds.map((id) => [id, String(portfolio.accountRoles?.[id] || "").trim() || (id === primarySocialAccountId ? "primary" : "supporting")]));
  const rationaleSelection = object(portfolio.rationaleSelection);
  return {
    ...object(portfolio),
    mode,
    primarySocialAccountId,
    selectedSocialAccountIds,
    accountRoles,
    rationaleSelection: {
      mode: rationaleSelection.mode || mode,
      selectedSocialAccountIds: unique(rationaleSelection.selectedSocialAccountIds).length ? unique(rationaleSelection.selectedSocialAccountIds) : selectedSocialAccountIds,
      accountRoles: Object.keys(object(rationaleSelection.accountRoles)).length ? object(rationaleSelection.accountRoles) : accountRoles
    },
    // Read-only compatibility alias for StrategyDecision@1.0 callers.
    selectedAccountIds: selectedSocialAccountIds
  };
}

export function adaptLegacyStrategyDecisionSelection(selection = {}) {
  const accountStrategies = list(selection.accountStrategies).map((item) => ({
    ...item,
    accountIdentity: normalizeSocialAccountIdentity({
      id: item.socialAccountId,
      socialAccountId: item.socialAccountId,
      companyId: item.companyId,
      accountIdentityId: item.accountIdentity?.id,
      accountIdentity: item.accountIdentity
    })
  }));
  const availableIds = accountStrategies.map((item) => item.socialAccountId).filter(Boolean);
  return {
    ...selection,
    schemaVersion: STRATEGY_DECISION_VERSION,
    portfolioDecision: canonicalPortfolio(selection.portfolioDecision, availableIds),
    accountStrategies
  };
}

export function normalizeStrategyDecisionSelection(candidate = {}, preview = {}, socialAccounts = []) {
  const catalog = list(socialAccounts).map((account) => account.configuration ? account : projectSocialAccount(account, account.company || null));
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const selectedByAccount = new Map(list(candidate.accountStrategies).map((item) => [item.socialAccountId, item]));
  const accountStrategies = list(preview.accountStrategies).map((base) => {
    const selected = object(selectedByAccount.get(base.socialAccountId));
    const account = catalogById.get(base.socialAccountId);
    const candidatePlaybooks = list(base.candidatePlaybooks);
    const chosenId = selected.selectedPlaybookId || base.selectedPlaybookId;
    const chosen = candidatePlaybooks.find((item) => item.playbookId === chosenId) || candidatePlaybooks[0] || {};
    const identityInput = candidate.schemaVersion === STRATEGY_DECISION_VERSION || base.compatibilityMigration
      ? { ...object(account?.accountIdentity), ...object(base.accountIdentity), ...object(selected.accountIdentity) }
      : object(account?.accountIdentity);
    const accountIdentity = normalizeSocialAccountIdentity({
      id: base.socialAccountId,
      socialAccountId: base.socialAccountId,
      companyId: account?.companyId || base.companyId,
      accountIdentityId: account?.accountIdentityId || identityInput.id,
      accountIdentity: identityInput
    });
    return {
      ...base,
      ...selected,
      companyId: account?.companyId || base.companyId || null,
      socialAccountId: base.socialAccountId,
      platform: account?.platform || base.platform,
      accountIdentity,
      accountIdentityId: accountIdentity.id,
      accountConfiguration: account?.configuration || base.accountConfiguration || null,
      matrixRole: selected.matrixRole || candidate.portfolioDecision?.accountRoles?.[base.socialAccountId] || base.matrixRole || null,
      selectedPlaybookId: chosen.playbookId || chosenId,
      growthMode: chosen.growthMode || selected.growthMode || base.growthMode,
      candidatePlaybooks,
      contentFunctionTargets: chosen.contentFunctionTargets || base.contentFunctionTargets,
      hotspotPolicy: { ...object(base.hotspotPolicy), ...object(chosen.hotspotPolicy), ...object(selected.hotspotPolicy), unrelatedAllowed: false, autoDeleteHistoricalContent: false },
      experimentPlan: { ...object(base.experimentPlan), ...object(chosen.experimentPlan), ...object(selected.experimentPlan) }
    };
  });
  const availableIds = accountStrategies.map((item) => item.socialAccountId);
  const portfolioDecision = canonicalPortfolio({ ...object(preview.portfolioDecision), ...object(candidate.portfolioDecision) }, availableIds);
  for (const strategy of accountStrategies) strategy.matrixRole = portfolioDecision.accountRoles[strategy.socialAccountId] || strategy.matrixRole || null;
  return {
    schemaVersion: STRATEGY_DECISION_VERSION,
    portfolioDecision,
    accountStrategies,
    selectedGrowthPlaybooks: accountStrategies.filter((item) => portfolioDecision.selectedSocialAccountIds.includes(item.socialAccountId)).map((item) => ({ socialAccountId: item.socialAccountId, playbookId: item.selectedPlaybookId, growthMode: item.growthMode })),
    unresolvedDecisions: [],
    source: "user_confirmed_strategy_decision"
  };
}

export function validateStrategyDecisionSelection(selection = {}, socialAccounts = []) {
  const adapted = adaptLegacyStrategyDecisionSelection(selection);
  const errors = [];
  if (!list(["1.0", STRATEGY_DECISION_VERSION]).includes(selection.schemaVersion)) errors.push({ path: "schemaVersion", message: `must equal 1.0 or ${STRATEGY_DECISION_VERSION}` });
  if (!["single_account", "role_matrix"].includes(adapted.portfolioDecision?.mode)) errors.push({ path: "portfolioDecision.mode", message: "must be single_account or role_matrix" });
  if (!list(adapted.accountStrategies).length) errors.push({ path: "accountStrategies", message: "must contain at least one account" });
  const selectedIds = list(adapted.portfolioDecision?.selectedSocialAccountIds);
  const strategiesById = new Map(list(adapted.accountStrategies).map((item) => [item.socialAccountId, item]));
  const catalog = list(socialAccounts);
  const currentById = new Map(catalog.map((item) => [item.id || item.socialAccountId, item.configuration ? item : projectSocialAccount(item, item.company || null)]));
  if (!selectedIds.length) errors.push({ path: "portfolioDecision.selectedSocialAccountIds", message: "must select at least one account" });
  if (adapted.portfolioDecision?.mode === "single_account") {
    if (selectedIds.length !== 1) errors.push({ path: "portfolioDecision.selectedSocialAccountIds", message: "single_account must select exactly one account" });
    if (adapted.portfolioDecision.primarySocialAccountId !== selectedIds[0]) errors.push({ path: "portfolioDecision.primarySocialAccountId", message: "must reference the selected account" });
  }
  if (adapted.portfolioDecision?.mode === "role_matrix") {
    if (selectedIds.length < 2) errors.push({ path: "portfolioDecision.selectedSocialAccountIds", message: "role_matrix must select at least two accounts" });
    const roles = selectedIds.map((id) => adapted.portfolioDecision.accountRoles?.[id]).filter(Boolean);
    if (new Set(roles).size !== roles.length) errors.push({ path: "portfolioDecision.accountRoles", message: "role_matrix accounts must have distinct roles" });
  }
  const rationaleSelection = object(adapted.portfolioDecision?.rationaleSelection);
  if (rationaleSelection.mode !== adapted.portfolioDecision?.mode
    || JSON.stringify(unique(rationaleSelection.selectedSocialAccountIds).sort()) !== JSON.stringify([...selectedIds].sort())
    || selectedIds.some((id) => rationaleSelection.accountRoles?.[id] !== adapted.portfolioDecision.accountRoles?.[id])) {
    errors.push({ path: "portfolioDecision.rationaleSelection", message: "must match the confirmed account selection and roles" });
  }
  selectedIds.forEach((socialAccountId) => {
    const item = strategiesById.get(socialAccountId);
    const current = currentById.get(socialAccountId);
    if (!item) errors.push({ path: `accountStrategies.${socialAccountId}`, message: "must reference an available account" });
    if (catalog.length && (!current || !current.configuration?.selectionEligible)) errors.push({ path: `portfolioDecision.selectedSocialAccountIds.${socialAccountId}`, message: "account is disabled, missing, or requires base setup" });
    if (!item?.accountIdentity?.id) errors.push({ path: `accountStrategies.${socialAccountId}.accountIdentity.id`, message: "is required" });
    if (!item?.accountIdentity?.subjectType) errors.push({ path: `accountStrategies.${socialAccountId}.accountIdentity.subjectType`, message: "is required" });
    if (!SOCIAL_ACCOUNT_SPEAKER_TYPES.includes(item?.accountIdentity?.speakerType)) errors.push({ path: `accountStrategies.${socialAccountId}.accountIdentity.speakerType`, message: "must be a supported speaker type" });
    if (!list(item?.accountIdentity?.trustSources).length || list(item?.accountIdentity?.trustSources).some((value) => !SOCIAL_ACCOUNT_TRUST_SOURCES.includes(value))) errors.push({ path: `accountStrategies.${socialAccountId}.accountIdentity.trustSources`, message: "must contain supported trust sources" });
    if (!item?.selectedPlaybookId) errors.push({ path: `accountStrategies.${socialAccountId}.selectedPlaybookId`, message: "is required" });
    if (!adapted.portfolioDecision?.accountRoles?.[socialAccountId]) errors.push({ path: `portfolioDecision.accountRoles.${socialAccountId}`, message: "is required" });
    if (item?.hotspotPolicy?.unrelatedAllowed === true) errors.push({ path: `accountStrategies.${socialAccountId}.hotspotPolicy.unrelatedAllowed`, message: "must be false" });
    if (item?.hotspotPolicy?.autoDeleteHistoricalContent === true) errors.push({ path: `accountStrategies.${socialAccountId}.hotspotPolicy.autoDeleteHistoricalContent`, message: "must be false" });
  });
  return { name: "StrategyDecisionConfirmation", version: STRATEGY_DECISION_VERSION, valid: errors.length === 0, errors, value: adapted };
}
