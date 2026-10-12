import { database, readStore, writeStore } from "../../storage.mjs";

const apply = process.argv.includes("--apply");
const preserveKnowledge = process.argv.includes("--preserve-knowledge");
const keptAccountIds = new Set(["account_damaishuzhi", "acc_xhs", "acc_wechat"]);
const knowledgeTables = new Set(["knowledge_chunks_fts", "knowledge_snapshots", "diagnostic_document_candidates", "diagnostic_knowledge_links", "knowledge_chunks", "knowledge_files", "knowledge_folders"]);
const businessTables = [
  "knowledge_chunks_fts",
  "knowledge_snapshots",
  "diagnostic_document_candidates",
  "diagnostic_knowledge_links",
  "knowledge_chunks",
  "knowledge_files",
  "knowledge_folders",
  "strategy_decision_records",
  "fact_snapshots",
  "strategy_direction_sets",
  "strategy_snapshot_meta",
  "strategy_snapshots",
  "strategy_draft_requests",
  "strategy_draft_revisions",
  "strategy_draft_cache",
  "agent_recommendation_decisions",
  "agent_recommendation_revisions",
  "agent_recommendations",
  "diagnostic_coverage_states",
  "diagnostic_enrichment_questions",
  "diagnostic_field_states",
  "diagnostic_questions",
  "profile_claims",
  "diagnostic_turns",
  "diagnostic_session_meta",
  "diagnostic_session_context",
  "diagnostic_sessions",
  "profile_current_facts",
  "profile_fact_events"
];

function tableCount(name) {
  try {
    return database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get().count;
  } catch {
    return null;
  }
}

function cleanAccount(account) {
  const common = {
    id: account.id,
    name: account.name,
    status: "active",
    platform: account.platform,
    workspaceId: account.workspaceId || "workspace_default",
    accountType: account.accountType,
    companyId: account.companyId
  };
  if (account.accountType === "social") common.socialAccountId = account.id;
  return common;
}

const store = readStore();
const clearedBusinessTables = preserveKnowledge ? businessTables.filter((name) => !knowledgeTables.has(name)) : businessTables;
const arraySummary = Object.fromEntries(Object.entries(store)
  .filter(([, value]) => Array.isArray(value) && value.length)
  .map(([key, value]) => [key, value.length]));
const tableSummary = Object.fromEntries(clearedBusinessTables.map((name) => [name, tableCount(name)]).filter(([, count]) => count !== null && count > 0));

if (!apply) {
  console.log(JSON.stringify({
    mode: "preview",
    message: "未修改数据；增加 --apply 才会执行。",
    keep: {
      accounts: (store.accounts || []).filter((item) => keptAccountIds.has(item.id)).map((item) => ({ id: item.id, name: item.name, platform: item.platform })),
      configuration: ["users", "workspaces", "workspaceMemberships", "sourceConfigs", ...(preserveKnowledge ? ["knowledge base"] : []), "API/environment configuration", "skills and playbooks"]
    },
    clearAppStateArrays: arraySummary,
    clearDatabaseRows: tableSummary
  }, null, 2));
  process.exit(0);
}

const preservedArrayKeys = new Set(["users", "workspaces", "workspaceMemberships", "sourceConfigs", ...(preserveKnowledge ? Object.keys(store).filter((key) => /^knowledge/i.test(key)) : [])]);
const nextStore = { ...store };
for (const [key, value] of Object.entries(nextStore)) {
  if (Array.isArray(value) && !preservedArrayKeys.has(key)) nextStore[key] = [];
}
nextStore.accounts = (store.accounts || []).filter((item) => keptAccountIds.has(item.id)).map(cleanAccount);

database.exec("PRAGMA foreign_keys = OFF");
try {
  database.exec("BEGIN IMMEDIATE");
  for (const table of clearedBusinessTables) {
    try {
      database.exec(`DELETE FROM ${table}`);
    } catch (error) {
      if (!/no such table/i.test(error.message)) throw error;
    }
  }
  writeStore(nextStore);
  database.exec("DELETE FROM api_errors");
  database.exec("COMMIT");
} catch (error) {
  try { database.exec("ROLLBACK"); } catch {}
  throw error;
} finally {
  database.exec("PRAGMA foreign_keys = ON");
}

console.log(JSON.stringify({
  mode: "applied",
  keptAccounts: nextStore.accounts.map((item) => ({ id: item.id, name: item.name, platform: item.platform })),
  clearedAppStateArrays: Object.keys(arraySummary).filter((key) => !preservedArrayKeys.has(key) && key !== "accounts"),
  preservedConfiguration: ["users", "workspaces", "workspaceMemberships", "sourceConfigs", ...(preserveKnowledge ? ["knowledge base"] : []), "API/environment configuration", "skills and playbooks"]
}, null, 2));
