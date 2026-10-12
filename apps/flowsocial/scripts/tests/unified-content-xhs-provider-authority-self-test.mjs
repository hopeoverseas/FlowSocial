import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";
import {
  buildUnifiedContentXhsProviderAuthority,
  providerPlanningAuthorityFromSnapshot,
  validateUnifiedContentXhsProviderAuthoritySnapshot
} from "../../content-agent/unified-content-xhs-provider-authority.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { buildIntegratedPageExecutionPlan, createCostConfirmation, validateIntegratedPageExecutionPlan } from "../../image-providers/xhs-integrated-page/execution-plan.mjs";
import { createPromptReviewDecision, transitionPromptReviewDecision } from "../../image-providers/xhs-integrated-page/review-state-machine.mjs";
import { invokeDesignXhsIntegratedPages } from "../../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import { adaptEvaluationCase } from "../../skills/design-xhs-integrated-pages/scripts/runtime-compiler.mjs";

const flagName = "UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1";
const priorFlag = process.env[flagName];
const priorProvider = process.env.FLOW_IMAGE_PROVIDER;
const priorModel = process.env.KIE_IMAGE_MODEL;
const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testDir, "..", "..");

try {
  delete process.env[flagName];
  assert.equal(featureFlags().unifiedContentXhsProviderAuthorityV1, false);
  assert.throws(() => buildUnifiedContentXhsProviderAuthority({ stylePackId: "editorial-metaphor" }), /AUTHORITY_DISABLED/);

  process.env[flagName] = "1";
  process.env.FLOW_IMAGE_PROVIDER = "Kie.ai";
  process.env.KIE_IMAGE_MODEL = "seedream/4.5-text-to-image";
  const seedreamAuthority = buildUnifiedContentXhsProviderAuthority({ stylePackId: "editorial-metaphor" });
  assert.equal(seedreamAuthority.providerProfile.model, "seedream/4.5-text-to-image");
  assert.equal(seedreamAuthority.providerProfile.adapter.id, "kie-jobs-seedream45");
  process.env.KIE_IMAGE_MODEL = "unknown-image-model";
  assert.throws(() => buildUnifiedContentXhsProviderAuthority({ stylePackId: "editorial-metaphor" }), /AUTHORITY_CONFIG_UNSUPPORTED/);
  process.env.KIE_IMAGE_MODEL = "gpt-image-2-text-to-image";

  const fixtureSet = JSON.parse(readFileSync(join(appRoot, "scripts", "fixtures", "xhs-integrated-design", "evaluation-cases.json"), "utf8").replace(/^\uFEFF/, ""));
  const sample = fixtureSet.cases.find((item) => item.selection?.pages?.every((page) => (page.referenceAssetIds || []).length === 0));
  assert.ok(sample, "an offline no-reference design case is required");
  const invocation = invokeDesignXhsIntegratedPages(adaptEvaluationCase(sample));
  const stylePackId = invocation.promptSet.visualStyleSelection.stylePackId;
  const snapshot = buildUnifiedContentXhsProviderAuthority({ stylePackId });
  const repeated = buildUnifiedContentXhsProviderAuthority({ stylePackId });
  assert.equal(validateUnifiedContentXhsProviderAuthoritySnapshot(snapshot), true);
  assert.equal(repeated.snapshotHash, snapshot.snapshotHash);
  assert.equal(snapshot.directionCandidates.length, 2);
  assert.ok(snapshot.directionCandidates.every((candidate) => candidate.stylePackId === stylePackId));
  assert.notEqual(stableHash(snapshot.directionCandidates[0].archetypePlan), stableHash(snapshot.directionCandidates[1].archetypePlan));
  assert.equal(snapshot.providerProfile.lifecycle, "experimental");
  assert.equal(snapshot.providerProfile.provider, "kie.ai");
  assert.equal(snapshot.providerProfile.model, "gpt-image-2-text-to-image");
  assert.deepEqual(snapshot.providerProfile.adapter, { id: "kie-jobs-image2", version: "1.0", projectionKey: "image2.text-to-image.v1" });
  assert.deepEqual(snapshot.providerProfile.requestFields, ["model", "input.prompt", "input.aspect_ratio", "input.resolution"]);
  assert.deepEqual(snapshot.providerProfile.nativeOutputDimensions, { width: 1086, height: 1448 });
  assert.deepEqual(snapshot.providerProfile.normalization, { mode: "resample", target: { width: 1080, height: 1440 }, nonUniformStretchAllowed: false, protectedRegionCropAllowed: false });
  assert.equal(snapshot.providerProfile.estimatedCostPerCandidate, 6);
  assert.equal(snapshot.providerProfile.currency, "credits");
  assert.equal(snapshot.capabilitySnapshot.source, "offline_fixture");
  assert.equal(snapshot.capabilitySnapshot.productionVerified, false);
  assert.ok(snapshot.registrySnapshot.entries.every((entry) => entry.status !== "approved"));
  assert.equal(snapshot.registrySnapshot.productionQuery.status, "blocked_no_approved_assets");
  assert.deepEqual(snapshot.claims, { providerCalls: 0, networkCalls: 0, databaseWrites: 0, productionEligible: false });
  const supportedStylePackIds = snapshot.libraries.styles.entries.map((style) => style.id).sort();
  for (const supportedStylePackId of supportedStylePackIds) {
    const supported = buildUnifiedContentXhsProviderAuthority({ stylePackId: supportedStylePackId });
    assert.equal(supported.directionCandidates.length, 2, `${supportedStylePackId} must expose two directions`);
    assert.ok(supported.directionCandidates.every((candidate) => candidate.stylePackId === supportedStylePackId));
    assert.notEqual(stableHash(supported.directionCandidates[0].archetypePlan), stableHash(supported.directionCandidates[1].archetypePlan));
  }

  let decision = createPromptReviewDecision({ id: `review:${invocation.promptSet.id}:authority-test`, promptSet: invocation.promptSet, directionCandidates: snapshot.directionCandidates });
  decision = transitionPromptReviewDecision(decision, { lane: "visualDirectionSelection", action: "select", directionId: snapshot.directionCandidates[0].id, actor: "human:test", at: "2026-08-06T12:00:00.000Z" });
  decision = transitionPromptReviewDecision(decision, { lane: "promptReview", action: "approve", reviewedPromptSetHash: invocation.promptSetHash, actor: "human:test", at: "2026-08-06T12:01:00.000Z" });
  const cost = createCostConfirmation({ status: "confirmed", currency: snapshot.providerProfile.currency, approvedMaxTotal: 100, confirmedBy: "human:test", confirmedAt: "2026-08-06T12:02:00.000Z" });
  const authority = providerPlanningAuthorityFromSnapshot(snapshot);
  const plan = buildIntegratedPageExecutionPlan({ skillInvocation: invocation, reviewDecision: decision, ...authority, costConfirmation: cost, flags: { xhsIntegratedPageSkillExecutionPlan: true } });
  assert.equal(validateIntegratedPageExecutionPlan(plan), true);
  assert.equal(plan.execution.status, "ready_for_isolated_provider_execution");
  assert.equal(plan.productionEligible, false);
  assert.equal(plan.states.provider, "not_called");
  assert.equal(plan.execution.providerCalls, 0);
  assert.equal(plan.execution.networkCalls, 0);
  assert.equal(plan.execution.databaseWrites, 0);

  const tampered = structuredClone(snapshot);
  tampered.providerProfile.model = "caller-forged-model";
  tampered.providerProfileRef.hash = stableHash(tampered.providerProfile);
  const tamperedBase = structuredClone(tampered);
  delete tamperedBase.snapshotHash;
  tampered.snapshotHash = stableHash(tamperedBase);
  assert.throws(() => validateUnifiedContentXhsProviderAuthoritySnapshot(tampered), /AUTHORITY_TAMPERED/);
  assert.throws(() => buildUnifiedContentXhsProviderAuthority({ stylePackId: "unsupported-style" }), /STYLE_UNSUPPORTED/);
  assert.throws(() => buildUnifiedContentXhsProviderAuthority({ stylePackId, providerProfile: snapshot.providerProfile }), /buildUnifiedContentXhsProviderAuthority\.input:FIELDS/);
  assert.throws(() => buildUnifiedContentXhsProviderAuthority({ stylePackId, model: "caller-forged-model" }), /buildUnifiedContentXhsProviderAuthority\.input:FIELDS/);
  assert.throws(() => buildUnifiedContentXhsProviderAuthority({ stylePackId, estimatedCostPerCandidate: 1 }), /buildUnifiedContentXhsProviderAuthority\.input:FIELDS/);

  console.log(JSON.stringify({
    status: "unified-content-xhs-provider-authority-self-test passed",
    snapshotHash: snapshot.snapshotHash,
    stylePackId,
    supportedStylePacks: supportedStylePackIds.length,
    directionCandidates: snapshot.directionCandidates.length,
    planStatus: plan.execution.status,
    providerCalls: 0,
    networkCalls: 0,
    databaseWrites: 0,
    productionEligible: false
  }, null, 2));
} finally {
  if (priorFlag === undefined) delete process.env[flagName]; else process.env[flagName] = priorFlag;
  if (priorProvider === undefined) delete process.env.FLOW_IMAGE_PROVIDER; else process.env.FLOW_IMAGE_PROVIDER = priorProvider;
  if (priorModel === undefined) delete process.env.KIE_IMAGE_MODEL; else process.env.KIE_IMAGE_MODEL = priorModel;
}
