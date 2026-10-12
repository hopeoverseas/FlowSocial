import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const dataDir = mkdtempSync(join(tmpdir(), "flowsocial-feedback-ownership-"));
copyFileSync(join(appRoot, "data", "store.json"), join(dataDir, "store.json"));
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_TEST_MODE = "1";
process.env.PORT = "0";

const { database, readStore, writeStore } = await import("../../storage.mjs");
const { buildFeedbackWorkspace } = await import("../../content-agent/feedback-engine.mjs");
const { recordPublication, recordPublicationMetrics } = await import("../../content-agent/publishing-feedback.mjs");

const companyA = "company_feedback_owner_a";
const companyB = "company_feedback_owner_b";
const accountA = "social_feedback_owner_a";
const accountB = "social_feedback_owner_b";
const store = readStore();
store.accounts = [
  { id: companyA, companyId: companyA, workspaceId: "workspace_feedback", accountType: "company", name: "反馈公司 A", status: "active" },
  { id: companyB, companyId: companyB, workspaceId: "workspace_feedback", accountType: "company", name: "反馈公司 B", status: "active" },
  { id: accountA, socialAccountId: accountA, companyId: companyA, workspaceId: "workspace_feedback", accountType: "social", platform: "wechat", name: "反馈账号 A", status: "active" },
  { id: accountB, socialAccountId: accountB, companyId: companyB, workspaceId: "workspace_feedback", accountType: "social", platform: "wechat", name: "反馈账号 B", status: "active" }
];
store.contentTasks = [];
store.contentRuns = [];
store.contentWorkflows = [];
store.contentPublications = [];
store.feedbackActions = [];

for (let index = 0; index < 4; index += 1) {
  const task = {
    id: `feedback_owner_task_${index}`,
    contentRunId: `feedback_owner_run_${index}`,
    accountId: accountA,
    socialAccountId: accountA,
    companyId: companyA,
    workspaceId: "workspace_feedback",
    platform: "wechat",
    version: 1,
    ideaTitle: `账号归属测试 ${index}`,
    currentContent: { recommended_title: `账号归属测试 ${index}` },
    contentExecutionContext: {
      id: `feedback_owner_execution_${index}`,
      strategySnapshotId: "strategy_feedback_owner",
      effectiveStrategyId: "effective_feedback_owner",
      growthPlaybookId: "wechat_feedback_owner",
      directionCard: { id: `feedback_owner_direction_${index}`, contentFunction: "authority", pillarId: "pillar_feedback", topic: `账号归属测试 ${index}`, format: "article" },
      sourcePlan: { sources: [] }
    }
  };
  const run = {
    id: task.contentRunId,
    accountId: accountA,
    socialAccountId: accountA,
    companyId: companyA,
    workspaceId: "workspace_feedback",
    platform: "wechat",
    generationPayload: { ideaTitle: task.ideaTitle, platform: "wechat", contentTaskBrief: { contentPillar: "pillar_feedback", contentRole: "authority" }, contentExecutionContext: task.contentExecutionContext }
  };
  store.contentTasks.push(task);
  store.contentRuns.push(run);
  const publishedAt = `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`;
  const publication = recordPublication(store, task, { status: "published", platform: "wechat", platformContentId: `feedback_owner_article_${index}`, publishedAt });
  recordPublicationMetrics(publication, {
    views: index === 0 ? 50 : 400,
    platformMetrics: { delivered: 1000 },
    measurementWindow: "72h",
    cutoffAt: `2026-06-${String(index + 4).padStart(2, "0")}T00:00:00.000Z`,
    source: "manual"
  });
}
writeStore(store);

const diagnosis = buildFeedbackWorkspace(store, { accountId: accountA, now: "2026-08-04T00:00:00.000Z" }).diagnoses.find((item) => item.nextAction);
assert.ok(diagnosis, "fixture must produce an actionable diagnosis");

let server;
try {
  ({ server } = await import("../../server.mjs"));
  if (!server.listening) await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const call = async (path, method, payload) => {
    const response = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  };
  const acceptPath = `/content-agent/feedback/diagnoses/${diagnosis.id}/actions`;
  const counts = () => {
    const current = readStore();
    return { actions: current.feedbackActions?.length || 0, runs: current.contentRuns?.length || 0 };
  };
  const initialCounts = counts();

  const missing = await call(acceptPath, "POST", { acceptedBy: "test" });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, "FEEDBACK_ACCOUNT_CONTEXT_REQUIRED");
  assert.deepEqual(counts(), initialCounts, "missing account context must not write");

  const wrongAccount = await call(acceptPath, "POST", { accountId: accountB, acceptedBy: "test" });
  assert.equal(wrongAccount.status, 403);
  assert.equal(wrongAccount.body.code, "FEEDBACK_RESOURCE_OWNERSHIP_MISMATCH");
  assert.deepEqual(counts(), initialCounts, "cross-account diagnosis acceptance must not write");

  const wrongCompany = await call(acceptPath, "POST", { companyId: companyB, accountId: accountA, acceptedBy: "test" });
  assert.equal(wrongCompany.status, 403);
  assert.deepEqual(counts(), initialCounts, "cross-company diagnosis acceptance must not write");

  const accepted = await call(acceptPath, "POST", { companyId: companyA, accountId: accountA, acceptedBy: "test" });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.action.accountId, accountA);
  assert.equal(accepted.body.nextContentRun, null);
  assert.equal(accepted.body.followup?.status, "accepted_for_next_cycle");
  assert.equal(accepted.body.followup?.nextStep, "create_and_confirm_publishing_cycle");
  const acceptedActionId = accepted.body.action.id;

  const patchPath = `/content-agent/feedback-actions/${acceptedActionId}`;
  const beforeRejectedPatches = counts();
  const missingPatch = await call(patchPath, "PATCH", { status: "supported" });
  assert.equal(missingPatch.status, 400);
  assert.deepEqual(counts(), beforeRejectedPatches, "missing account context on PATCH must not write");
  const wrongPatch = await call(patchPath, "PATCH", { accountId: accountB, status: "supported" });
  assert.equal(wrongPatch.status, 403);
  assert.deepEqual(counts(), beforeRejectedPatches, "cross-account PATCH must not write");
  assert.equal(readStore().feedbackActions.find((item) => item.id === acceptedActionId).status, "accepted", "action must remain accepted until an exact next-cycle plan binds it");

  const patched = await call(patchPath, "PATCH", { companyId: companyA, accountId: accountA, status: "supported", note: "同账号验证通过" });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.status, "supported");
  assert.equal(patched.body.note, "同账号验证通过");

  console.log(JSON.stringify({ status: "feedback-api-ownership-self-test passed", diagnosisId: diagnosis.id, actionId: acceptedActionId, rejectedWrites: 5, acceptedWrites: 2, isolatedData: true }, null, 2));
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  database.close();
  rmSync(dataDir, { recursive: true, force: true });
}
