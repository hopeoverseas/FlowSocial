import { createHash } from "node:crypto";
import { database } from "../storage.mjs";
import { adaptLegacyStrategyDecisionSelection, validateStrategyDecisionSelection } from "./strategy-decision-contract.mjs";
import { projectSocialAccount } from "../workspace-context.mjs";

database.exec(`
  CREATE TABLE IF NOT EXISTS strategy_decision_records (
    session_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'preview',
    revision INTEGER NOT NULL DEFAULT 1,
    preview_json TEXT NOT NULL DEFAULT '{}',
    selection_json TEXT NOT NULL DEFAULT '{}',
    source_claim_revision INTEGER NOT NULL DEFAULT 0,
    source_fact_revision INTEGER NOT NULL DEFAULT 0,
    confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_strategy_decision_account ON strategy_decision_records(account_id, updated_at DESC);
`);

const selectRecord = database.prepare("SELECT * FROM strategy_decision_records WHERE session_id = ?");
const upsertRecord = database.prepare(`
  INSERT INTO strategy_decision_records
  (session_id, account_id, status, revision, preview_json, selection_json, source_claim_revision, source_fact_revision, confirmed_at, created_at, updated_at)
  VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    status = excluded.status,
    revision = strategy_decision_records.revision + 1,
    preview_json = excluded.preview_json,
    selection_json = excluded.selection_json,
    source_claim_revision = excluded.source_claim_revision,
    source_fact_revision = excluded.source_fact_revision,
    confirmed_at = excluded.confirmed_at,
    updated_at = excluded.updated_at
`);

const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const now = () => new Date().toISOString();
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function mapRecord(row) {
  if (!row) return null;
  return {
    sessionId: row.session_id,
    accountId: row.account_id,
    status: row.status,
    revision: row.revision,
    preview: parse(row.preview_json, {}),
    selection: parse(row.selection_json, {}),
    sourceClaimRevision: row.source_claim_revision,
    sourceFactRevision: row.source_fact_revision,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decisionHash: hash(parse(row.selection_json, {}))
  };
}

export function getStrategyDecisionRecord(sessionId) {
  return mapRecord(selectRecord.get(sessionId));
}

export function saveStrategyDecisionRecord({ sessionId, accountId, preview, selection = null, status = "preview", claimRevision = 0, factRevision = 0 }) {
  const previous = getStrategyDecisionRecord(sessionId);
  const timestamp = now();
  const resolvedSelection = selection || previous?.selection || preview;
  upsertRecord.run(sessionId, accountId, status, JSON.stringify(preview || previous?.preview || {}), JSON.stringify(resolvedSelection || {}), Number(claimRevision || 0), Number(factRevision || 0), status === "confirmed" ? timestamp : null, previous?.createdAt || timestamp, timestamp);
  return getStrategyDecisionRecord(sessionId);
}

export function strategyDecisionReadiness(record, sessionMeta = {}, { socialAccounts = [] } = {}) {
  const selection = adaptLegacyStrategyDecisionSelection(record?.selection || {});
  const selectedIds = selection.portfolioDecision?.selectedSocialAccountIds || [];
  const accountStrategies = Array.isArray(selection.accountStrategies) ? selection.accountStrategies.filter((item) => selectedIds.includes(item.socialAccountId)) : [];
  const currentById = new Map((socialAccounts || []).map((account) => [account.id || account.socialAccountId, account.configuration ? account : projectSocialAccount(account, account.company || null)]));
  const missingAccounts = accountStrategies.filter((item) => !item.socialAccountId || !item.selectedPlaybookId || !item.accountIdentity?.subjectType || !item.accountIdentity?.speakerType || !item.accountIdentity?.trustSources?.length).map((item) => item.socialAccountId || "unknown");
  const unavailableAccounts = selectedIds.filter((socialAccountId) => socialAccounts.length && !currentById.get(socialAccountId)?.configuration?.selectionEligible);
  const changedAccounts = accountStrategies.filter((item) => {
    const current = currentById.get(item.socialAccountId);
    return current && Number(current.accountIdentity?.version || 1) !== Number(item.accountIdentity?.version || 1);
  }).map((item) => item.socialAccountId);
  const stale = Boolean(record && (Number(record.sourceClaimRevision) !== Number(sessionMeta.claimRevision || 0) || Number(record.sourceFactRevision) !== Number(sessionMeta.factRevision || 0)));
  const semanticValidation = validateStrategyDecisionSelection(record?.selection || {}, socialAccounts);
  const blockers = [];
  if (!record) blockers.push({ code: "STRATEGY_DECISION_MISSING", message: "尚未生成账号与增长策略建议" });
  else if (record.status !== "confirmed") blockers.push({ code: "STRATEGY_DECISION_UNCONFIRMED", message: "账号身份、矩阵和增长打法尚未由用户确认" });
  if (missingAccounts.length) blockers.push({ code: "ACCOUNT_DECISION_INCOMPLETE", message: "仍有账号缺少身份或增长打法", socialAccountIds: missingAccounts });
  if (unavailableAccounts.length) blockers.push({ code: "SOCIAL_ACCOUNT_UNAVAILABLE", message: "所选账号已停用、不存在或需要先完成基础设置", socialAccountIds: unavailableAccounts, repairTarget: "accounts" });
  if (changedAccounts.length) blockers.push({ code: "ACCOUNT_IDENTITY_CHANGED", message: "账号设置中的身份信息已更新，请重新确认策略账号", socialAccountIds: changedAccounts });
  if (stale) blockers.push({ code: "STRATEGY_DECISION_STALE", message: "诊断信息已变化，请重新确认账号与增长策略" });
  if (record && !semanticValidation.valid) blockers.push({ code: "STRATEGY_DECISION_COMPATIBILITY_REQUIRED", message: "历史账号组合不符合当前规则，请重新确认；原历史记录保持不变", details: semanticValidation.errors });
  return { schemaVersion: "1.1", ready: Boolean(record?.status === "confirmed" && semanticValidation.valid && selectedIds.length && !missingAccounts.length && !unavailableAccounts.length && !changedAccounts.length && !stale), status: record?.status || "not_started", revision: record?.revision || 0, stale, compatibilityStatus: record && !semanticValidation.valid ? "compatibility_required" : "current", primarySocialAccountId: selection.portfolioDecision?.primarySocialAccountId || null, selectedSocialAccountIds: selectedIds, blockers };
}

export function deleteStrategyDecisionRecordsForAccount(accountId) {
  return database.prepare("DELETE FROM strategy_decision_records WHERE account_id = ?").run(accountId);
}
