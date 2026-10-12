const unique = (items, limit = 20) => [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit);

export function strategyToLegacyAccount(strategySnapshot, existingAccount = {}) {
  const strategy = strategySnapshot.payload || strategySnapshot;
  const isV2 = strategy.schemaVersion === "2.0";
  const strategyBody = isV2 ? strategy.strategy || {} : strategy.accountStrategy || {};
  const primaryAudience = (isV2 ? strategyBody.audiences : strategy.audiences)?.[0];
  const offers = isV2 ? (strategy.business?.offers || []).map((item) => item?.name).filter(Boolean) : strategy.business?.primaryOffers || [];
  const playbookTones = isV2
    ? [...(strategyBody.platformPlaybooks?.xiaohongshu?.toneDefaults || []), ...(strategyBody.platformPlaybooks?.wechat?.toneDefaults || [])]
    : strategyBody.tone || [];
  return {
    ...existingAccount,
    id: existingAccount.id || strategy.accountId,
    positioning: strategy.business?.valueProposition || existingAccount.positioning || "",
    audience: primaryAudience?.name || primaryAudience?.description || existingAccount.audience || "",
    primaryOffers: offers,
    contentPillars: isV2 ? (strategyBody.contentSystem?.pillars || []).map((item) => item.name) : strategyBody.contentPillars || existingAccount.contentPillars || [],
    tone: unique(playbookTones, 8).join("、") || existingAccount.tone || "",
    forbiddenTopics: isV2 ? strategyBody.riskPolicy?.forbiddenClaims || [] : strategyBody.forbiddenTopics || existingAccount.forbiddenTopics || [],
    strategySnapshotId: strategySnapshot.id || null,
    strategyVersion: strategySnapshot.version || null
  };
}

export function directionToLegacyContentDirection(direction, strategySnapshotId) {
  const groups = direction.queryGroups || {};
  const coreKeywords = unique(groups.core, 8);
  const scenarioKeywords = unique([...(groups.scenario || []), ...(groups.problem || []), ...(groups.case || [])], 8);
  const platformKeywords = unique([...(groups.event || []), ...(groups.policy || []), ...(groups.competitor || [])], 8);
  const searchKeywords = unique([...coreKeywords, ...scenarioKeywords, ...platformKeywords], 16);
  return {
    id: direction.id,
    name: direction.name,
    description: direction.purpose,
    enabled: true,
    refreshSchedule: "daily",
    coreKeywords,
    scenarioKeywords,
    platformKeywords,
    excludeKeywords: unique(groups.exclude, 12),
    searchKeywords,
    keywords: searchKeywords,
    strategySnapshotId,
    directionType: "domain_signal",
    directionSource: "strategy_managed",
    keywordGeneratedBy: "strategy_snapshot",
    userEdited: Boolean(direction.userEdited)
  };
}
