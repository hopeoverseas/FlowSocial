import assert from "node:assert/strict";
import { database } from "../../storage.mjs";
import { startDiagnostic } from "../../strategy-agent/agent-orchestrator.mjs";
import { enrichmentQuestionDefinitions, planNextEnrichmentQuestion } from "../../strategy-agent/enrichment-planner.mjs";
import { applyProfileFactOperation, getDiagnosticSessionContext, listHistoricalProfileFacts, listSessionProfileFacts, upsertProfileClaim } from "../../strategy-agent/strategy-store.mjs";

const stamp = Date.now();
const updateAccountId = `test_restart_update_${stamp}`;
const freshAccountId = `test_restart_fresh_${stamp}`;
const partialAccountId = `test_restart_partial_${stamp}`;
const sessionIds = [];

function seedSession(accountId) {
  const seeded = startDiagnostic({ accountId, restartMode: "fresh" });
  sessionIds.push(seeded.session.id);
  upsertProfileClaim({ sessionId: seeded.session.id, fieldPath: "business.primaryOffers", value: ["企业知识库"], sourceType: "user_statement", sourceRef: "seed_offer", confidence: 1, status: "confirmed" });
  upsertProfileClaim({ sessionId: seeded.session.id, fieldPath: "accountStrategy.growthStage", value: "launch", sourceType: "user_statement", sourceRef: "seed_stage", confidence: 1, status: "confirmed" });
  applyProfileFactOperation({ accountId, sessionId: seeded.session.id, factKey: "evidence.case_one", factType: "case_evidence", predicate: "has_case", value: "匿名客户案例", confidence: 1 });
  applyProfileFactOperation({ accountId, sessionId: seeded.session.id, factKey: "account.stage_note", factType: "growth_stage", predicate: "has_growth_stage", value: "起号阶段", confidence: 1 });
  return seeded;
}

try {
  seedSession(freshAccountId);
  const fresh = startDiagnostic({ accountId: freshAccountId, restartMode: "fresh" });
  sessionIds.push(fresh.session.id);
  assert.equal(fresh.claims.length, 0, "全新诊断不应继承旧策略字段");
  assert.equal(listSessionProfileFacts(freshAccountId, fresh.session.id).length, 0, "全新诊断不应把旧事实当成本轮事实");
  assert.equal(getDiagnosticSessionContext(fresh.session.id).restartMode, "fresh");

  seedSession(updateAccountId);
  const update = startDiagnostic({ accountId: updateAccountId, restartMode: "update" });
  sessionIds.push(update.session.id);
  assert.equal(update.claims.length, 0, "更新模式的历史结论也不能自动写成本轮结论");
  assert.ok(update.historicalClaims.some((claim) => claim.fieldPath === "business.primaryOffers"), "更新模式应暴露历史候选供重新确认");
  const historical = listHistoricalProfileFacts(updateAccountId, update.session.id);
  assert.ok(historical.some((fact) => fact.factKey === "evidence.case_one"), "稳定案例资料应保留为历史候选");
  assert.ok(!historical.some((fact) => fact.factKey === "account.stage_note"), "账号阶段等易变信息不得作为历史事实带入");

  seedSession(partialAccountId);
  const partial = startDiagnostic({ accountId: partialAccountId, restartMode: "partial", rediagnoseFields: ["accountStrategy.growthStage"] });
  sessionIds.push(partial.session.id);
  assert.ok(partial.claims.some((claim) => claim.fieldPath === "business.primaryOffers"), "局部重诊应继承未选中的已确认字段");
  assert.ok(!partial.claims.some((claim) => claim.fieldPath === "accountStrategy.growthStage"), "局部重诊应清空并重问选中的字段");

  const firstEnrichment = planNextEnrichmentQuestion({ facts: [], previousQuestions: [] });
  assert.equal(firstEnrichment.targetFactKey, "audience.pain_points", "账号身份与打法改为显式决策后，动态补充应优先确认受众洞察");
  assert.ok(!/海外仓|清关|物流/.test(firstEnrichment.content), "动态补充问题必须适用于不同公司");
  assert.ok(enrichmentQuestionDefinitions.length >= 7, "动态事实补充应覆盖至少七类高价值信息");

  console.log(JSON.stringify({ status: "passed", freshIsolation: true, updateUsesCandidates: true, partialRediagnosis: true, enrichmentCategories: enrichmentQuestionDefinitions.length }, null, 2));
} finally {
  for (const sessionId of sessionIds) database.prepare("DELETE FROM diagnostic_sessions WHERE id = ?").run(sessionId);
  for (const accountId of [updateAccountId, freshAccountId, partialAccountId]) {
    database.prepare("DELETE FROM profile_fact_events WHERE account_id = ?").run(accountId);
    database.prepare("DELETE FROM profile_current_facts WHERE account_id = ?").run(accountId);
  }
}

