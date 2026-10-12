import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { adaptEvaluationCase } from "../../skills/design-xhs-integrated-pages/scripts/runtime-compiler.mjs";
import { buildUnifiedPlatformSkillExecutionPlan } from "../../content-agent/skill-execution-plan.mjs";
import {
  adaptLegacyXhsDesignInvocationReadOnly,
  buildXhsDesignRuntimeBindings,
  runPlannedXhsDesignRuntime,
  validateXhsDesignRuntimeEvidence
} from "../../content-agent/xhs-design-runtime-adapter.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(testDir, "..", "fixtures", "xhs-integrated-design", "evaluation-cases.json");
const sample = JSON.parse(readFileSync(fixturePath, "utf8").replace(/^\uFEFF/, "")).cases[0];
const runtimeInput = adaptEvaluationCase(sample);
const sharedContentMaster = { id: "content-master:test", schemaVersion: "2.0", central_thesis: "稳定内容需要统一事实" };
const sharedContentMasterRef = { id: sharedContentMaster.id, hash: stableHash(sharedContentMaster) };
const platformRun = { id: "platform-run:xhs:test", platform: "xiaohongshu", sharedContentMasterRef };
const candidate = {
  id: "candidate:xhs:test",
  platform: "xiaohongshu",
  platformRunRef: { id: platformRun.id, hash: stableHash(platformRun) },
  xhsPostPackageRef: { id: "xhs-package:test", hash: stableHash(runtimeInput.xhsPostPackage) }
};
const bindings = buildXhsDesignRuntimeBindings({ runtimeInput, sharedContentMaster, platformRun, candidate });
const plan = buildUnifiedPlatformSkillExecutionPlan({
  platform: "xiaohongshu",
  sharedContentMasterRef,
  options: {
    enableXhsIntegratedPageDesign: true,
    xhsDesignBindingsReady: true,
    featureFlags: { xhsIntegratedPageDesignSkill: true }
  },
  createdAt: "2026-08-05T12:00:00.000Z"
});
const expectedPlanHash = stableHash(plan);
const evidence = runPlannedXhsDesignRuntime({
  runtimeInput,
  sharedContentMaster,
  platformRun,
  candidate,
  bindings,
  skillExecutionPlan: plan,
  expectedPlanHash,
  featureFlags: { xhsIntegratedPageDesignSkill: true }
});

assert.equal(validateXhsDesignRuntimeEvidence(evidence), true);
assert.equal(evidence.status, "prompt_set_ready");
assert.equal(evidence.executionMode, "deterministic_adapter");
assert.equal(evidence.authorization.mode, "strict");
assert.equal(evidence.hashes.planHash, expectedPlanHash);
assert.equal(evidence.hashes.libraryHashes.length, 3);
assert.match(evidence.hashes.bundleHash, /^[a-f0-9]{64}$/);
assert.match(evidence.hashes.inputHash, /^[a-f0-9]{64}$/);
assert.match(evidence.hashes.outputHash, /^[a-f0-9]{64}$/);
assert.equal(evidence.productionEligible, false);
assert.equal(evidence.nextGate, "HumanProviderExecutionApproval");
assert.equal(evidence.boundary.counters.providerCalls, 0);
assert.deepEqual(evidence.boundary.pageRevisionRefs, []);
assert.equal(evidence.boundary.selectionAuthority, false);
assert.equal(evidence.boundary.deliveryBundleCreated, false);
assert.equal(evidence.boundary.publicationPerformed, false);

const disabledPlan = buildUnifiedPlatformSkillExecutionPlan({ platform: "xiaohongshu", sharedContentMasterRef, createdAt: "2026-08-05T12:00:00.000Z" });
assert.equal(disabledPlan.steps.find((step) => step.id === "visual_design").state, "skipped");
const waitingPlan = buildUnifiedPlatformSkillExecutionPlan({
  platform: "xiaohongshu",
  sharedContentMasterRef,
  options: { enableXhsIntegratedPageDesign: true, featureFlags: { xhsIntegratedPageDesignSkill: true } },
  createdAt: "2026-08-05T12:00:00.000Z"
});
assert.equal(waitingPlan.steps.find((step) => step.id === "visual_design").executionClass, "deterministic");
assert.equal(waitingPlan.steps.find((step) => step.id === "visual_design").state, "waiting_condition");
assert.equal(waitingPlan.steps.find((step) => step.id === "visual_design").reason, "awaiting_master_run_candidate_and_visual_selection_bindings");
assert.throws(() => runPlannedXhsDesignRuntime({ runtimeInput, sharedContentMaster, platformRun, candidate, bindings, skillExecutionPlan: disabledPlan, expectedPlanHash: stableHash(disabledPlan), featureFlags: { xhsIntegratedPageDesignSkill: true } }), /XHS_DESIGN_SKILL_STEP_NOT_ENABLED/);
assert.throws(() => runPlannedXhsDesignRuntime({ runtimeInput, sharedContentMaster, platformRun, candidate, bindings, skillExecutionPlan: plan, expectedPlanHash, featureFlags: { xhsIntegratedPageDesignSkill: false } }), /XHS_DESIGN_FEATURE_FLAG_DISABLED/);

const unplanned = structuredClone(plan);
unplanned.steps = unplanned.steps.filter((step) => step.id !== "visual_design");
assert.throws(() => runPlannedXhsDesignRuntime({ runtimeInput, sharedContentMaster, platformRun, candidate, bindings, skillExecutionPlan: unplanned, expectedPlanHash: stableHash(unplanned), featureFlags: { xhsIntegratedPageDesignSkill: true } }), /XHS_DESIGN_SKILL_STEP_NOT_PLANNED/);
assert.throws(() => runPlannedXhsDesignRuntime({ runtimeInput, sharedContentMaster, platformRun, candidate, bindings, skillExecutionPlan: plan, expectedPlanHash: "0".repeat(64), featureFlags: { xhsIntegratedPageDesignSkill: true } }), /XHS_DESIGN_PLAN_HASH_MISMATCH/);

const tamperedBindings = structuredClone(bindings);
tamperedBindings.visualSelectionRef.hash = "0".repeat(64);
assert.throws(() => runPlannedXhsDesignRuntime({ runtimeInput, sharedContentMaster, platformRun, candidate, bindings: tamperedBindings, skillExecutionPlan: plan, expectedPlanHash, featureFlags: { xhsIntegratedPageDesignSkill: true } }), /XHS_DESIGN_VISUAL_SELECTION_REF_MISMATCH/);
const tamperedEvidence = structuredClone(evidence);
tamperedEvidence.outputs.promptSetHash = "0".repeat(64);
assert.throws(() => validateXhsDesignRuntimeEvidence(tamperedEvidence), /XHS_DESIGN_PROMPT_SET_HASH_MISMATCH/);
const falseProductionEligibility = structuredClone(evidence);
falseProductionEligibility.productionEligible = true;
assert.throws(() => validateXhsDesignRuntimeEvidence(falseProductionEligibility), /XHS_DESIGN_PRODUCTION_ELIGIBILITY_INVALID/);
const fabricatedRevision = structuredClone(evidence);
fabricatedRevision.boundary.pageRevisionRefs.push({ id: "page-revision:fake", hash: "a".repeat(64) });
assert.throws(() => validateXhsDesignRuntimeEvidence(fabricatedRevision), /XHS_DESIGN_EVIDENCE_STATE_BOUNDARY/);

const legacySource = structuredClone(evidence.outputs.skillInvocation);
const legacyBefore = JSON.stringify(legacySource);
const legacy = adaptLegacyXhsDesignInvocationReadOnly(legacySource);
assert.equal(JSON.stringify(legacySource), legacyBefore);
assert.equal(legacy.mode, "read_only");
assert.equal(legacy.authorization, "legacy_unplanned");
assert.equal(legacy.productionEligible, false);
assert.equal(legacy.boundary.providerCalls, 0);

console.log(JSON.stringify({
  status: "xhs-design-runtime-adapter-self-test passed",
  planStep: "visual_design",
  executionMode: evidence.executionMode,
  providerCalls: evidence.boundary.counters.providerCalls,
  productionEligible: evidence.productionEligible,
  legacyMode: legacy.mode
}, null, 2));
