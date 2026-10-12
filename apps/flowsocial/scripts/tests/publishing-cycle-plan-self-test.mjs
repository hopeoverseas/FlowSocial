import assert from "node:assert/strict";
import { adaptPublishingCyclePlanToRollingContentPlan, createPublishingCyclePlan, transitionPublishingCyclePlan, validatePublishingCyclePlan } from "../../content-agent/publishing-cycle-plan.mjs";
import { validateRollingContentPlan } from "../../content-agent/operating-plan.mjs";

const accounts = [
  { id: "xhs_main", companyId: "company_a", name: "小红书主账号", platform: "xiaohongshu", status: "active" },
  { id: "wx_authority", companyId: "company_a", name: "公众号权威账号", platform: "wechat", status: "active" }
];
const ownership = { workspaceId: "workspace_default", companyId: "company_a" };
const fullCapacity = { research: 8, copy: 8, visual: 8, review: 8, publishCommunity: 8 };
const platformCapabilities = {
  xiaohongshu: { cadenceRange: { windowDays: 14, minItems: 2, maxItems: 6 } },
  wechat: { cadenceRange: { windowDays: 14, minItems: 0, maxItems: 3 } }
};

function strategy(mode = "single_account") {
  const selected = mode === "role_matrix" ? ["xhs_main", "wx_authority"] : ["xhs_main"];
  return {
    id: `strategy_${mode}_v2`,
    version: 2,
    status: "active",
    document: {
      strategy: { contentSystem: { pillars: [{ id: "methods" }, { id: "cases" }] } },
      strategyExtensions: {
        accountPortfolio: { mode, primarySocialAccountId: "xhs_main", selectedSocialAccountIds: selected },
        accountGrowthStrategies: [
          { socialAccountId: "xhs_main", selectedPlaybookId: "xhs-hybrid-bridge", playbookVersion: "1.1", recommendedCadence: { windowDays: 14, minItems: 3, maxItems: 5 }, contentFunctionTargets: { discovery: 35, authority: 30, proof: 15, solution: 15, action: 5 }, experimentPlan: { id: "experiment_xhs" } },
          ...(mode === "role_matrix" ? [{ socialAccountId: "wx_authority", selectedPlaybookId: "wechat-stable-columns", playbookVersion: "1.1", recommendedCadence: { windowDays: 14, minItems: 1, maxItems: 3 }, contentFunctionTargets: { authority: 50, proof: 20, solution: 30 }, experimentPlan: { id: "experiment_wx" } }] : [])
        ]
      }
    }
  };
}

const xhsPlan = createPublishingCyclePlan({
  ownership,
  strategySnapshot: strategy(),
  accounts,
  platformCapabilities,
  capacity: fullCapacity,
  inventory: { topics: 8, evidence: 8 },
  cycleStart: "2026-08-03",
  cycleDays: 14,
  freezeDays: 3
});
assert.equal(validatePublishingCyclePlan(xhsPlan).valid, true);
assert.equal(xhsPlan.status, "draft");
assert.ok(xhsPlan.slots.some((slot) => slot.state === "committed"));
assert.ok(xhsPlan.slots.some((slot) => slot.state === "draft"));
assert.ok(xhsPlan.slots.some((slot) => slot.state === "buffer"));
assert.equal(xhsPlan.committedUntil, "2026-08-05", "freezeDays must include the start date without freezing an extra day");
assert.deepEqual(new Set(xhsPlan.feedbackCheckpoints.filter((item) => item.platform === "xiaohongshu").map((item) => item.checkpoint)), new Set(["72h", "7d", "cycle"]));
assert.equal(new Set(xhsPlan.slots.map((slot) => slot.slotId)).size, xhsPlan.slots.length);
assert.equal(transitionPublishingCyclePlan(xhsPlan, "confirmed").status, "confirmed");
assert.deepEqual(createPublishingCyclePlan({ ownership, strategySnapshot: strategy(), accounts, platformCapabilities, capacity: fullCapacity, inventory: { topics: 8, evidence: 8 }, cycleStart: "2026-08-03", cycleDays: 14, freezeDays: 3 }), xhsPlan);

const wechatOnly = strategy();
wechatOnly.id = "strategy_wechat_v1";
wechatOnly.document.strategyExtensions.accountPortfolio = { mode: "single_account", primarySocialAccountId: "wx_authority", selectedSocialAccountIds: ["wx_authority"] };
wechatOnly.document.strategyExtensions.accountGrowthStrategies = [{ socialAccountId: "wx_authority", selectedPlaybookId: "wechat-stable-columns", playbookVersion: "1.1", recommendedCadence: { windowDays: 14, minItems: 1, maxItems: 14 } }];
const lowCapacityWechat = createPublishingCyclePlan({ ownership, strategySnapshot: wechatOnly, accounts, platformCapabilities: { wechat: { cadenceRange: { windowDays: 14, minItems: 0, maxItems: 14 } } }, capacity: { research: 1, copy: 1, visual: 1, review: 1, publishCommunity: 1 }, inventory: { topics: 10, evidence: 10 }, cycleStart: "2026-08-03" });
assert.equal(lowCapacityWechat.cadenceRange.targetItems, 1);
assert.equal(lowCapacityWechat.slots.filter((slot) => slot.state !== "buffer").length, 1);
assert.equal(lowCapacityWechat.conflicts[0].code, "CADENCE_EXCEEDS_CAPACITY");

const matrixPlan = createPublishingCyclePlan({ ownership, strategySnapshot: strategy("role_matrix"), accounts, platformCapabilities, capacity: { research: 8, copy: 8, visual: 3, review: 8, publishCommunity: 8 }, inventory: { topics: 8, evidence: 8 }, cycleStart: "2026-08-03" });
assert.equal(matrixPlan.status, "draft");
assert.equal(matrixPlan.conflicts[0].code, "MATRIX_RESOURCE_COLLISION");
assert.ok(matrixPlan.conflicts[0].limitingSteps.includes("visual"));
assert.deepEqual(new Set(matrixPlan.slots.map((slot) => slot.platform)), new Set(["xiaohongshu", "wechat"]));
assert.ok(matrixPlan.slots.filter((slot) => slot.state !== "buffer").every((slot) => slot.socialAccountId));

const normalizedStrategy = strategy();
normalizedStrategy.id = "strategy_normalized_target";
normalizedStrategy.document.strategyExtensions.accountGrowthStrategies[0].recommendedCadence = { windowDays: 7, minItems: 3, maxItems: 4 };
const freshItems = [1, 2, 3].map((index) => ({ id: `fresh_${index}`, topic: `全新选题 ${index}`, contentPillar: "methods", contentFunction: "authority", duplication: { decision: "allow", score: 0 }, nextCyclePortfolioRef: { id: "portfolio_normalized" } }));
const normalizedAccountPlan = [{
  socialAccountId: "xhs_main",
  account: accounts[0],
  growthPlaybookId: "xhs-hybrid-bridge",
  playbookVersion: "1.1",
  cadenceRange: { windowDays: 7, minItems: 3, maxItems: 4 },
  platformCapability: { cadenceRange: { windowDays: 7, minItems: 0, maxItems: 3 } },
  recommendations: freshItems,
  nextCycleContentPortfolio: { id: "portfolio_normalized", evidenceWindow: { confidence: "insufficient" } }
}];
const normalizedFreshPlan = createPublishingCyclePlan({
  ownership,
  strategySnapshot: normalizedStrategy,
  accounts,
  accountPlans: normalizedAccountPlan,
  platformCapabilities: { xiaohongshu: normalizedAccountPlan[0].platformCapability },
  capacity: fullCapacity,
  inventory: { topics: 3, evidence: 8 },
  cycleStart: "2026-09-01",
  cycleDays: 7
});
assert.equal(normalizedFreshPlan.slots.filter((item) => item.zone !== "buffer").length, 3);
assert.ok(normalizedFreshPlan.assumptions.some((item) => item.code === "ACCOUNT_CADENCE_NORMALIZED"));
assert.ok(!normalizedFreshPlan.conflicts.some((item) => item.code === "FRESH_TOPIC_CAPACITY_CONFLICT"), "three fresh topics must satisfy a platform-normalized target of three");

const insufficientFreshPlan = createPublishingCyclePlan({
  ownership,
  strategySnapshot: normalizedStrategy,
  accounts,
  accountPlans: [{ ...normalizedAccountPlan[0], recommendations: freshItems.slice(0, 2) }],
  platformCapabilities: { xiaohongshu: normalizedAccountPlan[0].platformCapability },
  capacity: fullCapacity,
  inventory: { topics: 2, evidence: 8 },
  cycleStart: "2026-09-08",
  cycleDays: 7
});
const freshConflict = insufficientFreshPlan.conflicts.find((item) => item.code === "FRESH_TOPIC_CAPACITY_CONFLICT");
assert.deepEqual({ requested: freshConflict.requestedItems, deliverable: freshConflict.deliverableItems }, { requested: 3, deliverable: 2 });

const overlappingPlan = createPublishingCyclePlan({
  ownership,
  strategySnapshot: normalizedStrategy,
  accounts,
  accountPlans: normalizedAccountPlan,
  platformCapabilities: { xiaohongshu: normalizedAccountPlan[0].platformCapability },
  capacity: fullCapacity,
  inventory: { topics: 3, evidence: 8 },
  cycleStart: "2026-09-01",
  cycleDays: 7,
  existingPublishingCyclePlans: [{ cycleId: "cycle_existing", status: "active", cycleStart: "2026-08-30", cycleEnd: "2026-09-05", slots: [{ socialAccountId: "xhs_main", scheduledFor: "2026-09-02", zone: "committed" }] }]
});
assert.ok(overlappingPlan.assumptions.some((item) => item.code === "ROLLING_CYCLE_WINDOW_OVERLAP"));
assert.ok(overlappingPlan.conflicts.some((item) => item.code === "ACCOUNT_DATE_COLLISION"));

const missingStrategy = createPublishingCyclePlan({ ownership, accounts, platformCapabilities, capacity: fullCapacity, cycleStart: "2026-08-03" });
assert.ok(missingStrategy.blockers.some((item) => item.code === "STRATEGY_NOT_ACTIVE"));
assert.equal(validatePublishingCyclePlan(missingStrategy).valid, true);
const missingAccount = createPublishingCyclePlan({ ownership, strategySnapshot: strategy(), accounts: accounts.filter((item) => item.id !== "xhs_main"), platformCapabilities, capacity: fullCapacity, cycleStart: "2026-08-03" });
assert.ok(missingAccount.blockers.some((item) => item.code === "ACCOUNT_MAPPING_MISSING"));

const before = structuredClone(xhsPlan);
const rolling = adaptPublishingCyclePlanToRollingContentPlan(xhsPlan);
assert.deepEqual(xhsPlan, before);
assert.equal(validateRollingContentPlan(rolling).valid, true);
assert.equal(rolling.status, "draft", "an unconfirmed cycle must not become an active legacy plan");
assert.ok(rolling.items.every((item) => item.status === "draft"), "unconfirmed cycle slots must remain non-executable");
assert.equal(rolling.sourcePublishingCycleId, xhsPlan.cycleId);
assert.ok(rolling.items.every((item) => item.sourcePublishingSlotId));
const confirmedRolling = adaptPublishingCyclePlanToRollingContentPlan(transitionPublishingCyclePlan(xhsPlan, "confirmed"));
assert.equal(confirmedRolling.status, "active");
assert.ok(confirmedRolling.items.some((item) => item.status === "planned"));

const wechatCheckpoints = createPublishingCyclePlan({ ownership, strategySnapshot: wechatOnly, accounts, platformCapabilities, capacity: fullCapacity, inventory: { topics: 8, evidence: 8 }, cycleStart: "2026-08-03" });
assert.deepEqual(new Set(wechatCheckpoints.feedbackCheckpoints.map((item) => item.checkpoint)), new Set(["72h", "7d", "cycle"]));

const invalidStatus = structuredClone(xhsPlan);
invalidStatus.status = "invented";
assert.equal(validatePublishingCyclePlan(invalidStatus).valid, false);

console.log(JSON.stringify({ status: "publishing-cycle-plan-self-test passed", xhsSlots: xhsPlan.slots.length, matrixConflicts: matrixPlan.conflicts.length, rollingCompatibility: true }, null, 2));
