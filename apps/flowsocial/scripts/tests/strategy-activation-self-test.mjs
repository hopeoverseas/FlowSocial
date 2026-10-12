import assert from "node:assert/strict";
import { database } from "../../storage.mjs";
import { activateConfirmedStrategyDraft, rollbackStrategySnapshot } from "../../strategy-agent/agent-orchestrator.mjs";
import { assembleStrategyInputBundle } from "../../strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2 } from "../../strategy-agent/strategy-document.mjs";
import { createDiagnosticSession, getDiagnosticSessionMeta, getLatestStrategyDraftRevision, saveStrategyDraftRevision, upsertProfileClaim } from "../../strategy-agent/strategy-store.mjs";
import { validateActiveStrategySnapshotV2 } from "../../contracts/strategy-content-contracts.mjs";

const accountId = `test_activation_${Date.now()}`;
const session = createDiagnosticSession({ accountId, mode: "quick" });

try {
  const values = {
    "business.primaryOffers": ["企业知识库", "AI员工"],
    "business.businessModel": "企业AI应用服务",
    "audiences.primary": [{ name: "外贸工厂负责人", priority: 1 }],
    "business.conversionPath": { summary: "内容到咨询再到诊断", steps: ["阅读内容", "发起咨询", "需求诊断"] },
    "accountStrategy.primaryGoal": "建立专业信任并获得有效咨询",
    "accountStrategy.growthStage": "launch",
    "accountStrategy.platformRoles": { xiaohongshu: "场景触达", wechat: "深度信任" },
    "accountStrategy.contentResources": { summary: "产品资料、SOP和案例", publicUsage: "anonymized" },
    "accountStrategy.constraints": ["不虚构客户与数据"]
  };
  for (const [fieldPath, value] of Object.entries(values)) {
    upsertProfileClaim({ sessionId: session.id, fieldPath, value, sourceType: "test", sourceRef: fieldPath, confidence: 1, status: "confirmed" });
  }
  const claims = database.prepare("SELECT id, field_path AS fieldPath, value_json AS valueJson, status, confidence, source_type AS sourceType, source_ref AS sourceRef, updated_at AS updatedAt FROM profile_claims WHERE session_id = ?").all(session.id).map((row) => ({ ...row, value: JSON.parse(row.valueJson) }));
  const meta = getDiagnosticSessionMeta(session.id);
  const input = assembleStrategyInputBundle({ account: { id: accountId, name: "激活链路测试账号" }, claims, claimRevision: meta.claimRevision, factRevision: meta.factRevision });
  const document = createStrategyDocumentV2({ accountId, claims, strategyInputBundle: input, suggestion: {} });
  const revision = saveStrategyDraftRevision({ sessionId: session.id, accountId, draft: document, validation: { valid: true, contextHash: input.contextHash, contextVersion: input.contextVersion }, providerMode: "test" });
  const active = activateConfirmedStrategyDraft({ sessionId: session.id, draftRevisionId: revision.id });
  assert.deepEqual(active.document, document);
  assert.equal(active.sourceDraftRevisionId, revision.id);
  assert.equal(active.contextHash, input.contextHash);
  assert.equal(validateActiveStrategySnapshotV2(active).valid, true);
  const restored = rollbackStrategySnapshot({ accountId, targetSnapshotId: active.id });
  assert.equal(restored.version, active.version + 1);
  assert.equal(restored.supersedesSnapshotId, active.id);
  assert.equal(restored.activationReason, `rollback_from:${active.id}`);
  assert.deepEqual(restored.document, active.document);

  upsertProfileClaim({ sessionId: session.id, fieldPath: "accountStrategy.primaryGoal", value: "调整后的目标", sourceType: "test", sourceRef: "changed", confidence: 1, status: "confirmed" });
  assert.equal(getLatestStrategyDraftRevision(session.id).stale, true);
  assert.throws(() => activateConfirmedStrategyDraft({ sessionId: session.id, draftRevisionId: revision.id }), (error) => error.code === "DRAFT_STALE");

  console.log(JSON.stringify({ status: "strategy-activation-self-test passed", activatedSnapshotId: active.id, restoredSnapshotId: restored.id, sourceDraftRevisionId: revision.id, staleActivationBlocked: true, immutableRollback: true }, null, 2));
} finally {
  database.prepare("DELETE FROM strategy_snapshots WHERE account_id = ?").run(accountId);
  database.prepare("DELETE FROM diagnostic_sessions WHERE id = ?").run(session.id);
}

