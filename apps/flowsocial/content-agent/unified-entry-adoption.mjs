import { createHash } from "node:crypto";
import { createUnifiedContentPrerequisites, listUnifiedContentPrerequisites } from "./unified-content-prerequisite-store.mjs";

function fail(message, code, statusCode = 409, details = []) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

function strategySelectedAccountIds(strategy) {
  const document = strategy?.document || strategy?.payload || {};
  const portfolio = document?.strategyExtensions?.accountPortfolio || {};
  return new Set([
    ...(portfolio.selectedSocialAccountIds || []),
    ...(portfolio.selectedAccountIds || []),
    ...(document?.strategyExtensions?.accountGrowthStrategies || []).map((item) => item.socialAccountId)
  ].filter(Boolean));
}

function resolvePairedAccounts(accounts, strategy, selectedAccount) {
  const available = accounts.filter((item) => item.status !== "archived");
  const selectedIds = strategySelectedAccountIds(strategy);
  const eligible = available.filter((item) => !selectedIds.size || selectedIds.has(item.id));
  const resolvePlatform = (platform) => {
    if (selectedAccount.platform === platform) return selectedAccount;
    const matches = eligible.filter((item) => item.platform === platform);
    if (matches.length !== 1) {
      fail(`请先在策略中明确唯一的${platform === "wechat" ? "公众号" : "小红书"}账号`, "UNIFIED_CONTENT_PLATFORM_ACCOUNT_SELECTION_REQUIRED", 409,
        matches.map((item) => ({ id: item.id, name: item.name, platform: item.platform })));
    }
    return matches[0];
  };
  return { xiaohongshu: resolvePlatform("xiaohongshu"), wechat: resolvePlatform("wechat") };
}

export function adoptOpportunityToUnifiedProject(store, opportunity, {
  actor = "workspace_user",
  at = new Date().toISOString(),
  flags = {},
  getActiveStrategySnapshot,
  listCompanySocialAccounts
} = {}) {
  if (!flags.unifiedContentPrerequisitesV1 || !flags.unifiedContentStagedAtomicDualBootstrapV1) {
    fail("统一内容生产尚未启用", "UNIFIED_CONTENT_ADOPTION_DISABLED", 404);
  }
  if (!opportunity?.id) fail("内容机会不存在", "CONTENT_OPPORTUNITY_NOT_FOUND", 404);
  const activeStrategy = getActiveStrategySnapshot?.(opportunity.companyId);
  if (!activeStrategy?.id || activeStrategy.status !== "active") fail("当前公司尚未激活策略", "ACTIVE_STRATEGY_REQUIRED");
  const accounts = listCompanySocialAccounts?.(store, opportunity.companyId) || [];
  const selectedAccount = accounts.find((item) => item.id === opportunity.socialAccountId);
  if (!selectedAccount || selectedAccount.platform !== opportunity.platform) fail("内容机会绑定的账号已经不可用", "CONTENT_OPPORTUNITY_ACCOUNT_STALE");
  const paired = resolvePairedAccounts(accounts, activeStrategy, selectedAccount);
  const idempotencyKey = `opportunity-adoption:${opportunity.id}:${activeStrategy.id}`;
  const priorOptions = listUnifiedContentPrerequisites(store, { companyId: opportunity.companyId }).entryOptions || [];
  const exactExisting = priorOptions.filter((entry) => entry.prerequisiteRef?.id === idempotencyKey);
  if (exactExisting.length > 1) fail("该内容机会对应多个权威输入，请先对账", "UNIFIED_CONTENT_ADOPTION_AMBIGUOUS");
  let entry = exactExisting[0] || null;
  let prerequisite = null;
  const topic = String(opportunity.topic || "").trim();
  const contentObjective = String(opportunity.angle || opportunity.contentPurposeId || "完成本次内容目标").trim();
  if (!entry) {
    const semanticExisting = priorOptions.filter((item) => item.topicIntent?.topic === topic
      && (item.topicIntent?.contentObjective || item.topicIntent?.objective) === contentObjective
      && item.activeStrategySnapshotRef?.id === activeStrategy.id
      && (item.accounts?.xiaohongshu?.id || item.accounts?.xiaohongshu) === paired.xiaohongshu.id
      && (item.accounts?.wechat?.id || item.accounts?.wechat) === paired.wechat.id);
    if (semanticExisting.length > 1) fail("同一内容方向存在多个权威输入，请先对账", "UNIFIED_CONTENT_ADOPTION_SEMANTIC_AMBIGUOUS");
    entry = semanticExisting[0] || null;
  }
  if (!entry) {
    try {
      prerequisite = createUnifiedContentPrerequisites(store, {
        companyId: opportunity.companyId,
        xiaohongshuAccountId: paired.xiaohongshu.id,
        wechatAccountId: paired.wechat.id,
        topic,
        contentObjective,
        hotspotEvaluation: { status: "not_available", candidateRefs: [], reason: "opportunity_is_topic_input_not_business_fact", factPolicy: "external_event_not_business_fact" },
        idempotencyKey
      }, { canonicalActiveStrategy: activeStrategy, nativeMechanismDecisionV2: true, now: at });
    } catch (error) {
      if (["UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED", "UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_NOT_FOUND", "UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED"].includes(error.code || error.message)) {
        fail("小红书账号还没有已确认的视觉规范，请先到“账号与设置”完成视觉规范确认", "UNIFIED_CONTENT_DESIGN_DNA_REQUIRED");
      }
      throw error;
    }
    entry = (listUnifiedContentPrerequisites(store, { companyId: opportunity.companyId }).entryOptions || [])
      .find((item) => item.prerequisiteRef?.id === idempotencyKey) || null;
  }
  if (!entry) fail("已建立权威输入，但无法定位内容项目入口", "UNIFIED_CONTENT_ADOPTION_ENTRY_MISSING", 500);
  const projectId = opportunity.unifiedProjectId || `unified_project_${createHash("sha256").update(`${opportunity.id}:${activeStrategy.id}`).digest("hex").slice(0, 24)}`;
  const changed = opportunity.unifiedProjectId !== projectId || opportunity.unifiedProductionEntryId !== entry.id;
  opportunity.unifiedProjectId = projectId;
  opportunity.unifiedProductionEntryId = entry.id;
  opportunity.status = "in_progress";
  opportunity.adoptedAt ||= at;
  opportunity.adoptedBy ||= actor;
  opportunity.updatedAt = at;
  return { created: Boolean(prerequisite?.created), changed, projectId, entry, opportunity };
}
