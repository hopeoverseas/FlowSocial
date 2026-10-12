import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempRoot = mkdtempSync(join(tmpdir(), "flowsocial-cycle-workbench-"));
process.env.FLOWSOCIAL_DATA_DIR = tempRoot;
process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";

const workbench = await import("../../content-agent/cycle-workbench.mjs");
const serverCompatibility = await import("../../server.mjs");
const {
  adjustCycleWorkbenchSlot,
  confirmCycleWorkbenchPlan,
  listCycleWorkbenchPlans,
  saveCycleWorkbenchPlan,
  startCycleWorkbenchSlotRun
} = workbench;
for (const name of ["adjustCycleWorkbenchSlot", "confirmCycleWorkbenchPlan", "listCycleWorkbenchPlans", "saveCycleWorkbenchPlan", "startCycleWorkbenchSlotRun"]) {
  assert.equal(serverCompatibility[name], workbench[name], `server compatibility export must preserve ${name}`);
}
const { database } = await import("../../storage.mjs");

function slot({ slotId, zone, accountId, platform, topic }) {
  return {
    slotId,
    state: zone,
    zone,
    socialAccountId: accountId,
    accountId,
    accountName: accountId === "xhs_cycle" ? "周期小红书" : "周期公众号",
    platform,
    strategySnapshotId: "strategy_cycle_v7",
    strategyVersion: 7,
    growthPlaybookId: platform === "xiaohongshu" ? "xhs-hybrid-bridge" : "wechat-stable-columns",
    playbookVersion: "1.1",
    contentPillar: "专业方法",
    contentPillarId: "pillar_method",
    contentFunction: "authority",
    objective: "建立可信的专业认知",
    contentType: "howto",
    experiment: { id: `experiment_${slotId}`, hypothesis: "结构化内容提升理解" },
    experimentId: `experiment_${slotId}`,
    evidenceRequirements: ["公开、可核验来源"],
    requiredEvidenceIds: ["evidence_public_1"],
    assetRequirements: ["原创图形"],
    requiredAssetTypes: ["original_graphic"],
    targetWindow: { start: "2026-08-04", end: "2026-08-10" },
    scheduledFor: "2026-08-06",
    recommendationId: `recommendation_${slotId}`,
    topic,
    contentRunId: null
  };
}

const plan = {
  kind: "PublishingCyclePlan",
  schemaVersion: "1.0",
  cycleId: "cycle_workbench_01",
  status: "draft",
  workspaceId: "workspace_default",
  companyId: "company_cycle",
  strategySnapshotId: "strategy_cycle_v7",
  strategyVersion: 7,
  playbookVersions: [
    { socialAccountId: "xhs_cycle", growthPlaybookId: "xhs-hybrid-bridge", playbookVersion: "1.1" },
    { socialAccountId: "wechat_cycle", growthPlaybookId: "wechat-stable-columns", playbookVersion: "1.1" }
  ],
  objective: "在一周内验证双账号内容分工",
  cycleStart: "2026-08-04",
  cycleEnd: "2026-08-11",
  planningHorizon: { startDate: "2026-08-04", endDate: "2026-08-11", committedUntil: "2026-08-08" },
  cadenceRange: { minItems: 1, maxItems: 3, targetItems: 3, windowDays: 7, byAccount: [] },
  cadenceByAccount: [
    { accountId: "xhs_cycle", minimum: 1, target: 2, maximum: 2, rationale: ["当前产能"] },
    { accountId: "wechat_cycle", minimum: 0, target: 1, maximum: 1, rationale: ["当前产能"] }
  ],
  committedUntil: "2026-08-08",
  slots: [
    slot({ slotId: "slot_committed", zone: "committed", accountId: "xhs_cycle", platform: "xiaohongshu", topic: "承诺主题" }),
    slot({ slotId: "slot_wechat_committed", zone: "committed", accountId: "wechat_cycle", platform: "wechat", topic: "公众号承诺主题" }),
    slot({ slotId: "slot_draft", zone: "draft", accountId: "wechat_cycle", platform: "wechat", topic: "草稿主题" }),
    slot({ slotId: "slot_buffer", zone: "buffer", accountId: "xhs_cycle", platform: "xiaohongshu", topic: "缓冲主题" })
  ],
  feedbackCheckpoints: [],
  conflicts: [{ code: "CADENCE_REVIEW_REQUIRED", message: "确认本周产能" }],
  assumptions: [{ message: "账号素材可按时准备" }],
  userDecisions: [{ decisionId: "decision_cadence", status: "pending", type: "confirm_deliverable_cadence" }],
  userDecisionsRequired: [{ decisionId: "decision_cadence", status: "pending", type: "confirm_deliverable_cadence" }],
  blockers: []
};

const legacyPlan = { id: "legacy_rolling_1", items: [{ id: "legacy_item_1" }] };
const store = { rollingContentPlans: [structuredClone(legacyPlan)], contentWorkflows: [] };

try {
  const saved = saveCycleWorkbenchPlan(store, plan, { now: "2026-08-04T09:00:00.000Z" });
  assert.equal(saved.created, true);
  assert.equal(saved.plan.workbenchStatus, "awaiting_confirmation");
  assert.equal(new Set(saved.plan.slots.map((item) => item.socialAccountId)).size, 2);
  assert.equal(new Set(saved.plan.slots.map((item) => item.platform)).size, 2);
  assert.deepEqual(store.rollingContentPlans, [legacyPlan], "new workbench must not rewrite legacy plans");
  assert.equal(listCycleWorkbenchPlans(store, { companyId: "company_cycle" }).length, 1);
  assert.equal(saveCycleWorkbenchPlan(store, plan).created, false, "cycle creation must be idempotent by cycleId");

  let createCalls = 0;
  const createRun = async ({ slot: selectedSlot }) => {
    createCalls += 1;
    const workflow = { id: `content_run_${selectedSlot.slotId}`, state: "direction_selected", platform: selectedSlot.platform, socialAccountId: selectedSlot.socialAccountId, generationPayload: {} };
    store.contentWorkflows.push(workflow);
    return workflow;
  };
  await assert.rejects(
    startCycleWorkbenchSlotRun(store, plan.cycleId, "slot_committed", createRun),
    (error) => error.code === "PUBLISHING_CYCLE_CONFIRMATION_REQUIRED"
  );
  assert.equal(createCalls, 0, "no committed slot may start before cycle confirmation");

  const draftChange = adjustCycleWorkbenchSlot(store, plan.cycleId, "slot_draft", { topic: "可调整的草稿主题" }, { actor: "tester", at: "2026-08-04T09:05:00.000Z" });
  assert.equal(draftChange.slot.topic, "可调整的草稿主题");
  await assert.rejects(
    async () => adjustCycleWorkbenchSlot(store, plan.cycleId, "slot_committed", { topic: "未确认变更" }),
    (error) => error.code === "COMMITTED_SLOT_CHANGE_CONFIRMATION_REQUIRED"
  );
  const committedChange = adjustCycleWorkbenchSlot(store, plan.cycleId, "slot_committed", {
    topic: "二次确认后的承诺主题",
    reason: "公开事件改变了内容优先级",
    confirmCommittedChange: true
  }, { actor: "tester", at: "2026-08-04T09:06:00.000Z" });
  assert.equal(committedChange.plan.slotEvents.at(-1).type, "committed_slot_changed");
  assert.equal(committedChange.plan.slotEvents.at(-1).reason, "公开事件改变了内容优先级");

  const confirmed = confirmCycleWorkbenchPlan(store, plan.cycleId, { confirmedBy: "tester", confirmedAt: "2026-08-04T09:10:00.000Z" });
  assert.equal(confirmed.changed, true);
  assert.equal(confirmed.plan.status, "active");
  assert.equal(confirmed.plan.workbenchStatus, "active");
  assert.ok(confirmed.plan.userDecisions.every((item) => item.status === "confirmed"));
  assert.equal(confirmCycleWorkbenchPlan(store, plan.cycleId, { confirmedBy: "tester" }).changed, false);
  await assert.rejects(
    startCycleWorkbenchSlotRun(store, plan.cycleId, "slot_draft", createRun),
    (error) => error.code === "PUBLISHING_CYCLE_SLOT_NOT_COMMITTED"
  );

  const first = await startCycleWorkbenchSlotRun(store, plan.cycleId, "slot_committed", createRun, { actor: "tester", at: "2026-08-04T09:11:00.000Z" });
  assert.equal(first.created, true);
  assert.equal(first.workflow.cycleId, plan.cycleId);
  assert.equal(first.workflow.slotId, "slot_committed");
  assert.equal(first.workflow.strategySnapshotId, "strategy_cycle_v7");
  assert.equal(first.workflow.strategyVersion, 7);
  assert.equal(first.workflow.growthPlaybookId, "xhs-hybrid-bridge");
  assert.equal(first.workflow.playbookVersion, "1.1");
  assert.equal(first.workflow.experimentId, "experiment_slot_committed");
  assert.deepEqual(first.workflow.generationPayload.cycleAttribution, first.workflow.cycleAttribution);
  const replay = await startCycleWorkbenchSlotRun(store, plan.cycleId, "slot_committed", createRun);
  assert.equal(replay.created, false);
  assert.equal(replay.workflow.id, first.workflow.id);
  assert.equal(createCalls, 1, "idempotent replay must not create a second ContentRun");
  const wechatOnly = await startCycleWorkbenchSlotRun(store, plan.cycleId, "slot_wechat_committed", createRun, { actor: "tester" });
  assert.equal(wechatOnly.created, true);
  assert.equal(wechatOnly.workflow.platform, "wechat");
  assert.equal(wechatOnly.workflow.socialAccountId, "wechat_cycle");
  assert.equal(createCalls, 2, "a platform-scoped WeChat slot creates exactly one additional ContentRun");
  assert.equal(store.contentWorkflows.length, 2);

  const collisionStore = { publishingCyclePlans: [], contentWorkflows: [] };
  const collisionPlanA = structuredClone(plan);
  collisionPlanA.cycleId = "cycle_collision_a";
  collisionPlanA.slots = [slot({ slotId: "slot_collision_a", zone: "committed", accountId: "xhs_cycle", platform: "xiaohongshu", topic: "周期 A 主题" })];
  collisionPlanA.slots[0].scheduledFor = "2026-08-06";
  collisionPlanA.slots[0].targetWindow = { date: "2026-08-06" };
  collisionPlanA.userDecisions = [];
  collisionPlanA.userDecisionsRequired = [];
  const collisionPlanB = structuredClone(collisionPlanA);
  collisionPlanB.cycleId = "cycle_collision_b";
  collisionPlanB.slots[0].slotId = "slot_collision_b";
  saveCycleWorkbenchPlan(collisionStore, collisionPlanA);
  saveCycleWorkbenchPlan(collisionStore, collisionPlanB);
  assert.throws(
    () => confirmCycleWorkbenchPlan(collisionStore, collisionPlanA.cycleId, { confirmedBy: "tester" }),
    (error) => error.code === "PUBLISHING_CYCLE_ACCOUNT_DATE_COLLISION",
    "same-account same-day commitments across cycles must block confirmation"
  );

  const appSource = readFrontendSourceSync();
  const apiSource = readFileSync(new URL("../../api-client.js", import.meta.url), "utf8");
  const cssSource = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
  const serverSource = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
  const workbenchSource = readFileSync(new URL("../../content-agent/cycle-workbench.mjs", import.meta.url), "utf8");
  for (const marker of ["待发布计划", "备选内容", "临时空位", "突发选题预留位", "容量预留", "冷启动规划", "数据驱动规划", "最相近历史内容", "当前策略", "账号打法", "高级详情", "历史滚动计划 · 只读兼容"]) assert.ok(appSource.includes(marker), `missing workbench copy: ${marker}`);
  for (const hiddenTechnicalMarker of ["strategySnapshotId", "growthPlaybookId", "playbookId"]) assert.ok(appSource.includes(hiddenTechnicalMarker), `missing advanced version detail: ${hiddenTechnicalMarker}`);
  assert.ok(appSource.includes("confirmPublishingCycle"));
assert.ok(appSource.includes("adoptPublishingCycleSlot"));
assert.ok(!appSource.includes("FlowAPI.startPublishingCycleSlot("), "current workbench UI must not create legacy ContentRun writes");
  assert.ok(appSource.includes('productionMode === "xiaohongshu"'), "the integrated image pipeline must be scoped to the XHS UI entry");
  assert.ok(appSource.includes("制作公众号文章") && appSource.includes("制作小红书图文"), "each committed slot must expose one platform-specific action");
  assert.ok(!appSource.includes("同时制作双平台") && !appSource.includes("进入双平台生产"), "the publishing plan must not expose a dual-platform production concept");
  assert.ok(apiSource.includes("getPublishingCycles") && apiSource.includes("updatePublishingCycleSlot"));
  assert.ok(cssSource.includes(".cycle-zone-committed") && cssSource.includes(".cycle-confirmation"));
assert.ok(serverSource.includes("/content-agent/publishing-cycles"));
assert.ok(serverSource.includes("adopt-to-unified-project"));
  assert.ok(workbenchSource.includes("PUBLISHING_CYCLE_CONFIRMATION_REQUIRED"));
  assert.ok(workbenchSource.includes("PUBLISHING_CYCLE_ACCOUNT_DATE_COLLISION"));
  assert.ok(serverSource.includes("sendJson(res, 200, result.plan)"), "slot update API must return the complete cycle expected by the workbench UI");
  assert.ok(serverSource.includes("payload.changedBy || payload.actor"), "slot change audit must preserve the UI actor field");
  console.log("cycle-workbench-self-test passed");
} finally {
  database.close();
  rmSync(tempRoot, { recursive: true, force: true });
}
