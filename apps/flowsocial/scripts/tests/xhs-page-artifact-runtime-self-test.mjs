import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { normalizePngCandidate, solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { adaptEvaluationCase } from "../../skills/design-xhs-integrated-pages/scripts/runtime-compiler.mjs";
import { buildXhsDesignRuntimeBindings, runPlannedXhsDesignRuntime, validateXhsDesignRuntimeEvidence } from "../../content-agent/xhs-design-runtime-adapter.mjs";
import {
  createXhsPageRevisionFact, createXhsProviderApproval, createXhsProviderAttemptFact, createXhsProviderBudget,
  validateXhsArtifactFactAppendOnly, validateXhsPageRevisionFact, validateXhsProviderAttemptFact
} from "../../content-agent/xhs-page-artifact-facts.mjs";
import { executeApprovedXhsPageArtifacts } from "../../content-agent/xhs-page-artifact-runtime.mjs";

const at = "2026-08-05T12:00:00.000Z";
const ref = (id, value = id) => ({ id, hash: stableHash(value) });
const contentProjectRef = ref("project:test");
const platformRunRef = ref("run:test");
const candidateRef = ref("candidate:test");
const designEvidenceRef = ref("design:test");
const planRef = ref("plan:test");
const pageRef = ref("plan:test:P1");
const providerRef = ref("fixture-provider:fixture-model");
const budget = createXhsProviderBudget({ currency: "CNY", maxTotal: 5, maxAttemptsPerPage: 2, createdBy: "human:test", createdAt: at });
const budgetRef = { id: "xhs-provider-budget", hash: budget.budgetHash };
const approval = createXhsProviderApproval({ contentProjectRef, platformRunRef, candidateRef, designEvidenceRef, planRef, providerRef, budgetRef, approvedBy: "human:test", approvedAt: at });
const approvalRef = { id: `xhs-provider-approval:${approval.approvalHash.slice(0, 20)}`, hash: approval.approvalHash };
const factExecutionRequestHash = stableHash({ idempotencyKey: "facts:test" });

const source = solidRgbaPng(1080, 1440, [20, 40, 60, 255]);
const normalization = normalizePngCandidate({
  id: "normalization:test:P1:a1", candidateRef: ref("page-candidate:test"), sourceBuffer: source,
  sourceRelativePath: "xhs/raw/test.png", outputRelativePath: "xhs/normalized/test.png", mode: "none",
  protectedRegions: [], createdAt: at
});
assert.equal(normalization.record.status, "succeeded");
assert.deepEqual(normalization.record.outputDimensions, { width: 1080, height: 1440 });

const common = {
  contentProjectRef, platformRunRef, candidateRef, designEvidenceRef, planRef, pageId: "P1", pageRef,
  approvalRef, providerRef, budgetRef, provider: "fixture-provider", model: "fixture-model",
  idempotencyKey: "facts:test", executionRequestHash: factExecutionRequestHash,
  transport: { kind: "injected", networked: false, context: { mode: "fixture", networked: false } }, selectionAuthority: false,
  finalBundleAuthority: false, publicationPerformed: false, recordedAt: at
};
const rawAsset = normalization.record.inputAsset;
const successfulAttempt = createXhsProviderAttemptFact({
  ...common, id: "attempt:test:P1:a1", attempt: 1, requestHash: stableHash({ request: 1 }), status: "succeeded", taskId: "fixture-task-1",
  rawAsset, normalization: { status: "succeeded", recordHash: normalization.record.recordHash, outputAsset: normalization.record.outputAsset, blockers: [] }, cost: 1, error: null
});
assert.equal(validateXhsProviderAttemptFact(successfulAttempt), true);
assert.equal(successfulAttempt.rawAsset.sha256, normalization.record.inputAsset.sha256);
assert.equal(successfulAttempt.normalization.outputAsset.sha256, normalization.record.outputAsset.sha256);

const revision = createXhsPageRevisionFact({
  ...common, id: "revision:test:P1:r1", revision: 1, sourceAttemptRef: { id: successfulAttempt.id, hash: successfulAttempt.attemptHash },
  rawAsset, normalizedAsset: normalization.record.outputAsset, normalizationRef: { id: normalization.record.id, hash: normalization.record.recordHash },
  status: "artifact_review_required", reviewable: true, selectable: false, finalBundleAuthority: false, publicationPerformed: false, createdAt: at
});
assert.equal(validateXhsPageRevisionFact(revision), true);
assert.equal(validateXhsArtifactFactAppendOnly({ attempts: [successfulAttempt], revisions: [revision] }), true);

const failedAttempt = createXhsProviderAttemptFact({
  ...common, id: "attempt:test:P2:a1", pageId: "P2", pageRef: ref("plan:test:P2"), attempt: 1, requestHash: stableHash({ request: 2 }),
  status: "failed", taskId: "fixture-task-2", rawAsset: null, normalization: null, cost: 0, error: { code: "PROVIDER_TRANSIENT_FAILURE", message: "fixture only" }
});
const retriedAttempt = createXhsProviderAttemptFact({
  ...common, id: "attempt:test:P2:a2", pageId: "P2", pageRef: ref("plan:test:P2"), attempt: 2, requestHash: stableHash({ request: 3 }),
  status: "failed", taskId: "fixture-task-3", rawAsset: null, normalization: null, cost: 0, error: { code: "PROVIDER_TRANSIENT_FAILURE", message: "fixture only" }
});
assert.equal(validateXhsArtifactFactAppendOnly({ attempts: [failedAttempt, retriedAttempt], revisions: [] }), true);
assert.throws(() => validateXhsArtifactFactAppendOnly({ attempts: [retriedAttempt, failedAttempt], revisions: [] }), /XHS_PROVIDER_ATTEMPT_NON_MONOTONIC/);

const tamperedAttempt = structuredClone(successfulAttempt);
tamperedAttempt.cost = 4;
assert.throws(() => validateXhsProviderAttemptFact(tamperedAttempt), /XHS_PROVIDER_ATTEMPT_FACT_HASH_MISMATCH/);
const crossCandidateRevision = structuredClone(revision);
crossCandidateRevision.candidateRef = ref("candidate:other");
delete crossCandidateRevision.revisionHash;
crossCandidateRevision.revisionHash = stableHash(crossCandidateRevision);
assert.throws(() => validateXhsArtifactFactAppendOnly({ attempts: [successfulAttempt], revisions: [crossCandidateRevision] }), /XHS_PAGE_REVISION_SCOPE_MISMATCH/);

let calls = 0;
await assert.rejects(() => executeApprovedXhsPageArtifacts({
  designEvidence: { contract: "tampered" }, contentProjectRef, platformRunRef, candidateRef, budget, approval,
  idempotencyKey: "invalid-evidence:test",
  transportContext: { mode: "fixture", networked: false },
  transport: async () => { calls += 1; throw new Error("must not be called"); }
}), /XHS_DESIGN_EVIDENCE_IDENTITY_INVALID/);
assert.equal(calls, 0);

let missingNetworkDeclarationCalls = 0;
await assert.rejects(() => executeApprovedXhsPageArtifacts({
  designEvidence: { contract: "tampered" }, contentProjectRef, platformRunRef, candidateRef, budget, approval,
  idempotencyKey: "missing-networked:test", transportContext: { mode: "fixture" },
  transport: async () => { missingNetworkDeclarationCalls += 1; }
}), /XHS_PAGE_ARTIFACT_TRANSPORT_NETWORKED_REQUIRED/);
assert.equal(missingNetworkDeclarationCalls, 0);

function providerPrompt(sections) {
  return [
    ["页面语义", sections.pageSemantics], ["视觉媒介", sections.visualMedium], ["构图与层级", sections.composition],
    ["材质空间光影", sections.materialSpaceLight], ["跨页统一", sections.crossPageRules], ["逐字真值", sections.verbatimText],
    ["负面约束", sections.negativeConstraints]
  ].map(([label, values]) => `${label}：\n${values.map((item) => `- ${item}`).join("\n")}`).join("\n\n");
}

function attachReadyFixturePlan(evidence) {
  const provider = { id: "fixture-provider", model: "fixture-model", adapter: { id: "fixture-adapter", version: "1.0", projectionKey: "fixture" }, lifecycle: "fixture", createEndpoint: "/fixture", requestFields: [] };
  const pages = evidence.outputs.skillInvocation.promptSet.pagePromptSpecs.map((spec) => {
    const promptSections = {
      pageSemantics: [spec.contentTruth.headline], visualMedium: ["fixture only"], composition: ["fixture only"],
      materialSpaceLight: ["fixture only"], crossPageRules: ["fixture only"], verbatimText: [...spec.promptBlocks.verbatimText], negativeConstraints: ["fixture only"]
    };
    const base = {
      pageId: spec.pageId, contentTruthRef: { id: `${spec.id}:truth`, hash: stableHash(spec.contentTruth) },
      assetBindings: { archetype: ref(spec.pageArchetypeId), stylePack: ref(spec.stylePackId || evidence.outputs.skillInvocation.promptSet.visualStyleSelection.stylePackId), patterns: [], referenceAssets: [] },
      legacyCompiler: { requestRef: ref(`${spec.id}:request`), traceRef: ref(`${spec.id}:trace`), originalBlockerCodes: [], reclassifiedBlockerCodes: [] },
      promptSections,
      providerRequest: { endpoint: "/fixture", method: "POST", body: { model: provider.model, input: { prompt: providerPrompt(promptSections) } }, requestFields: [] },
      nativeDimensionQualification: { dimensions: { width: 810, height: 1080 }, status: "non_exact_normalizable" },
      deliveryQualification: { target: { width: 1080, height: 1440 }, status: "pending_post_normalization_gates", normalizationMode: "resample" },
      estimatedCost: 1, blockers: []
    };
    return { ...base, pageHash: stableHash(base) };
  });
  const inputHash = stableHash({ fixture: evidence.evidenceHash });
  const base = {
    schemaVersion: "1.0", contract: "IntegratedPageExecutionPlan@1.0", id: `fixture-plan:${inputHash.slice(0, 16)}`, mode: "isolated_experimental",
    skillBinding: { invocationHash: evidence.outputs.skillInvocation.invocationHash, promptSetRef: { id: evidence.outputs.skillInvocation.promptSet.id, hash: evidence.outputs.skillInvocation.promptSetHash } },
    reviewBinding: ref("fixture-review"), capabilitySnapshotRef: ref("fixture-capability"), registrySnapshotRef: ref("fixture-registry"), provider,
    cost: { status: "confirmed", confirmationHash: stableHash("fixture-confirmation"), currency: "CNY", estimatedTotal: pages.length, approvedMaxTotal: 10 },
    pages, states: { provider: "not_called", userSelection: "not_selected", delivery: "not_delivered" }, productionEligible: false,
    execution: { status: "ready_for_isolated_provider_execution", networkCalls: 0, providerCalls: 0, retries: 0, actualCost: 0, databaseWrites: 0, featureFlag: "fixture_only" }, inputHash
  };
  const plan = { ...base, planHash: stableHash(base) };
  const ready = structuredClone(evidence);
  ready.outputs.integratedPageExecutionPlan = plan;
  ready.status = "ready_for_human_provider_approval";
  ready.productionEligible = true;
  ready.hashes.providerExecutionPlanHash = plan.planHash;
  ready.hashes.outputHash = stableHash(ready.outputs);
  delete ready.evidenceHash;
  ready.evidenceHash = stableHash(ready);
  assert.equal(validateXhsDesignRuntimeEvidence(ready), true);
  return ready;
}

const testDir = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(testDir, "..", "fixtures", "xhs-integrated-design", "evaluation-cases.json"), "utf8")).cases[0];
const runtimeInput = adaptEvaluationCase(sample);
const sharedContentMaster = { id: "content-master:page-artifacts", schemaVersion: "2.0", central_thesis: "fixture only" };
const sharedContentMasterRef = ref(sharedContentMaster.id, sharedContentMaster);
const fixtureRun = { id: "platform-run:page-artifacts", platform: "xiaohongshu", sharedContentMasterRef };
const fixtureCandidate = { id: "candidate:page-artifacts", platform: "xiaohongshu", platformRunRef: ref(fixtureRun.id, fixtureRun), xhsPostPackageRef: { id: "package:page-artifacts", hash: stableHash(runtimeInput.xhsPostPackage) } };
const fixtureBindings = buildXhsDesignRuntimeBindings({ runtimeInput, sharedContentMaster, platformRun: fixtureRun, candidate: fixtureCandidate });
const skillPlan = { kind: "UnifiedSkillExecutionPlan@1.0", platform: "xiaohongshu", authorization: { mode: "strict" }, steps: [{ id: "visual_design", kind: "skill", capability: "design-xhs-integrated-pages", enabled: true, state: "planned", decision: "enabled", inputContract: "DesignXhsIntegratedPagesRuntimeInput@1.0", outputContract: ["XhsIntegratedPagePromptSet@1.0"] }] };
const promptEvidence = runPlannedXhsDesignRuntime({ runtimeInput, sharedContentMaster, platformRun: fixtureRun, candidate: fixtureCandidate, bindings: fixtureBindings, skillExecutionPlan: skillPlan, expectedPlanHash: stableHash(skillPlan), featureFlags: { xhsIntegratedPageDesignSkill: true } });
const readyEvidence = attachReadyFixturePlan(promptEvidence);
const fixtureProjectRef = ref("project:page-artifacts");
const fixtureRunRef = readyEvidence.bindings.platformRunRef;
const fixtureCandidateRef = readyEvidence.bindings.candidateRef;
const fixtureProviderRef = { id: "fixture-provider:fixture-model", hash: stableHash(readyEvidence.outputs.integratedPageExecutionPlan.provider) };
const fixtureBudget = createXhsProviderBudget({ currency: "CNY", maxTotal: 5, maxAttemptsPerPage: 2, createdBy: "human:fixture", createdAt: at });
const fixtureApproval = createXhsProviderApproval({
  contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  designEvidenceRef: { id: readyEvidence.id, hash: readyEvidence.evidenceHash }, planRef: { id: readyEvidence.outputs.integratedPageExecutionPlan.id, hash: readyEvidence.outputs.integratedPageExecutionPlan.planHash },
  providerRef: fixtureProviderRef, budgetRef: { id: "xhs-provider-budget", hash: fixtureBudget.budgetHash }, approvedBy: "human:fixture", approvedAt: at
});
let fixtureCalls = 0;
const nativeFixture = solidRgbaPng(810, 1080, [70, 90, 110, 255]);
const runtimeResult = await executeApprovedXhsPageArtifacts({
  designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: fixtureBudget, approval: fixtureApproval, retryPolicy: { maxAttemptsPerPage: 2, retryableCodes: ["PROVIDER_TRANSIENT_FAILURE"] },
  idempotencyKey: "fixture:initial",
  transportContext: { mode: "injected_fixture", networked: false, productionResult: false },
  now: () => at,
  transport: async (_request, context) => {
    fixtureCalls += 1;
    if (context.pageId === "P1" && context.attempt === 1) return { status: "failed", provider: "fixture-provider", model: "fixture-model", taskId: "fixture-failed", cost: 0, error: { code: "PROVIDER_TRANSIENT_FAILURE", message: "fixture retry" } };
    return { status: "succeeded", provider: "fixture-provider", model: "fixture-model", taskId: `fixture-${context.pageId}-${context.attempt}`, cost: 0.5, bytes: nativeFixture };
  }
});
assert.equal(runtimeResult.status, "artifact_review_required");
assert.equal(fixtureCalls, 3);
assert.equal(runtimeResult.counters.networkCalls, 0);
assert.equal(runtimeResult.counters.providerCalls, 3);
assert.equal(runtimeResult.counters.retries, 1);
assert.equal(runtimeResult.attempts.length, 3);
assert.equal(runtimeResult.revisions.length, 2);
assert.equal(runtimeResult.bytePayloads.length, 2);
assert.ok(runtimeResult.bytePayloads.every((item) => Buffer.isBuffer(item.rawBytes) && Buffer.isBuffer(item.normalizedBytes)));
assert.ok(runtimeResult.revisions.every((item) => item.normalizedAsset.dimensions.width === 1080 && item.normalizedAsset.dimensions.height === 1440));
assert.equal(runtimeResult.reviewable, true);
assert.equal(runtimeResult.selectable, false);
assert.equal(runtimeResult.finalBundleAuthority, false);
assert.equal(runtimeResult.publicationPerformed, false);

let revisionRetryCalls = 0;
const revisionRetry = await executeApprovedXhsPageArtifacts({
  designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: fixtureBudget, approval: fixtureApproval, existingAttempts: runtimeResult.attempts, existingRevisions: runtimeResult.revisions,
  targetPageIds: ["P1"], idempotencyKey: "fixture:revision-2", retryPolicy: { maxAttemptsPerPage: 1 }, now: () => at,
  transportContext: { mode: "injected_fixture", networked: false, productionResult: false, purpose: "revision_retry" },
  transport: async (_request, context) => {
    revisionRetryCalls += 1;
    return { status: "succeeded", provider: "fixture-provider", model: "fixture-model", taskId: `fixture-revision-${context.attempt}`, cost: 0.5, bytes: nativeFixture };
  }
});
assert.equal(revisionRetryCalls, 1);
assert.equal(revisionRetry.newAttemptRefs.length, 1);
assert.equal(revisionRetry.attempts.at(-1).attempt, 3);
assert.equal(revisionRetry.newRevisionRefs.length, 1);
assert.equal(revisionRetry.revisions.filter((item) => item.pageId === "P1").at(-1).revision, 2);

let idempotentCalls = 0;
const idempotentReplay = await executeApprovedXhsPageArtifacts({
  designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: fixtureBudget, approval: fixtureApproval, existingAttempts: runtimeResult.attempts, existingRevisions: runtimeResult.revisions,
  idempotencyKey: "fixture:initial", retryPolicy: { maxAttemptsPerPage: 2, retryableCodes: ["PROVIDER_TRANSIENT_FAILURE"] },
  transportContext: { mode: "injected_fixture", networked: false, productionResult: false },
  transport: async () => { idempotentCalls += 1; }
});
assert.equal(idempotentCalls, 0);
assert.equal(idempotentReplay.idempotent, true);
assert.equal(idempotentReplay.counters.networkCalls, 0);
assert.deepEqual(idempotentReplay.newAttemptRefs, []);

let simulatedNetworkCalls = 0;
const simulatedNetwork = await executeApprovedXhsPageArtifacts({
  designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: fixtureBudget, approval: fixtureApproval, existingAttempts: revisionRetry.attempts, existingRevisions: revisionRetry.revisions,
  targetPageIds: ["P2"], idempotencyKey: "fixture:simulated-network", retryPolicy: { maxAttemptsPerPage: 1 }, now: () => at,
  transportContext: { mode: "local_network_simulation", networked: true, productionResult: false },
  transport: async (_request, context) => {
    simulatedNetworkCalls += 1;
    return { status: "succeeded", provider: "fixture-provider", model: "fixture-model", taskId: `local-simulation-${context.attempt}`, cost: 0.5, bytes: nativeFixture };
  }
});
assert.equal(simulatedNetworkCalls, 1);
assert.equal(simulatedNetwork.counters.providerCalls, 1);
assert.equal(simulatedNetwork.counters.networkCalls, 1);
assert.equal(simulatedNetwork.attempts.at(-1).transport.networked, true);
assert.equal(simulatedNetwork.attempts.at(-1).transport.context.networked, true);

let networkReplayCalls = 0;
const simulatedNetworkReplay = await executeApprovedXhsPageArtifacts({
  designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: fixtureBudget, approval: fixtureApproval, existingAttempts: simulatedNetwork.attempts, existingRevisions: simulatedNetwork.revisions,
  targetPageIds: ["P2"], idempotencyKey: "fixture:simulated-network", retryPolicy: { maxAttemptsPerPage: 1 },
  transportContext: { mode: "local_network_simulation", networked: true, productionResult: false },
  transport: async () => { networkReplayCalls += 1; }
});
assert.equal(networkReplayCalls, 0);
assert.equal(simulatedNetworkReplay.idempotent, true);
assert.equal(simulatedNetworkReplay.counters.networkCalls, 0);

let networkConflictCalls = 0;
await assert.rejects(() => executeApprovedXhsPageArtifacts({
  designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: fixtureBudget, approval: fixtureApproval, existingAttempts: simulatedNetwork.attempts, existingRevisions: simulatedNetwork.revisions,
  targetPageIds: ["P2"], idempotencyKey: "fixture:simulated-network", retryPolicy: { maxAttemptsPerPage: 1 },
  transportContext: { mode: "local_network_simulation", networked: false, productionResult: false },
  transport: async () => { networkConflictCalls += 1; }
}), /XHS_PAGE_ARTIFACT_IDEMPOTENCY_CONFLICT/);
assert.equal(networkConflictCalls, 0);

let tamperedCalls = 0;
const tamperedApproval = structuredClone(fixtureApproval);
tamperedApproval.planRef.hash = "0".repeat(64);
delete tamperedApproval.approvalHash;
tamperedApproval.approvalHash = stableHash(tamperedApproval);
await assert.rejects(() => executeApprovedXhsPageArtifacts({ designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef, budget: fixtureBudget, approval: tamperedApproval, idempotencyKey: "fixture:tampered", transportContext: { mode: "fixture", networked: false }, transport: async () => { tamperedCalls += 1; } }), /XHS_PAGE_ARTIFACT_PLAN_APPROVAL_MISMATCH/);
assert.equal(tamperedCalls, 0);

const tightBudget = createXhsProviderBudget({ currency: "CNY", maxTotal: 0.4, maxAttemptsPerPage: 2, createdBy: "human:fixture", createdAt: at });
const tightApproval = createXhsProviderApproval({ ...fixtureApproval, budgetRef: { id: "xhs-provider-budget", hash: tightBudget.budgetHash } });
let budgetCalls = 0;
const budgetResult = await executeApprovedXhsPageArtifacts({ designEvidence: readyEvidence, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef, budget: tightBudget, approval: tightApproval, idempotencyKey: "fixture:tight-budget", transportContext: { mode: "fixture", networked: false }, transport: async () => { budgetCalls += 1; } });
assert.equal(budgetCalls, 0);
assert.equal(budgetResult.status, "blocked");
assert.deepEqual(budgetResult.blockers, ["budget_exhausted_before_call"]);

const separatePlanEvidence = structuredClone(readyEvidence);
const separatePlan = separatePlanEvidence.outputs.integratedPageExecutionPlan;
separatePlanEvidence.outputs.integratedPageExecutionPlan = null;
separatePlanEvidence.productionEligible = false;
separatePlanEvidence.hashes.providerExecutionPlanHash = null;
separatePlanEvidence.hashes.outputHash = stableHash(separatePlanEvidence.outputs);
delete separatePlanEvidence.evidenceHash;
separatePlanEvidence.evidenceHash = stableHash(separatePlanEvidence);
assert.equal(validateXhsDesignRuntimeEvidence(separatePlanEvidence), true);
const separatePlanBase = {
  schemaVersion: "1.0", contract: "UnifiedXhsProviderPlanFact@1.0", id: "provider-plan-fact:fixture", contentProjectRef: fixtureProjectRef,
  platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef, designEvidenceRef: { id: separatePlanEvidence.id, hash: separatePlanEvidence.evidenceHash },
  promptSetRef: { id: separatePlanEvidence.outputs.skillInvocation.promptSet.id, hash: separatePlanEvidence.outputs.skillInvocation.promptSetHash }, plan: separatePlan
};
const separatePlanFact = { ...separatePlanBase, factHash: stableHash(separatePlanBase) };
const oneTryBudget = createXhsProviderBudget({ currency: "CNY", maxTotal: 5, maxAttemptsPerPage: 1, createdBy: "human:fixture", createdAt: at });
const oneTryApproval = createXhsProviderApproval({
  contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  designEvidenceRef: separatePlanBase.designEvidenceRef, planRef: { id: separatePlan.id, hash: separatePlan.planHash }, providerRef: fixtureProviderRef,
  budgetRef: { id: "xhs-provider-budget", hash: oneTryBudget.budgetHash }, approvedBy: "human:fixture", approvedAt: at
});
let pageLocalCalls = 0;
const pageLocalResult = await executeApprovedXhsPageArtifacts({
  designEvidence: separatePlanEvidence, providerPlanFact: separatePlanFact, approvalFactRef: ref("approval-fact:fixture"),
  contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef, budget: oneTryBudget, approval: oneTryApproval,
  targetPageIds: ["P1", "P2"], idempotencyKey: "fixture:separate-plan-page-local", maxProviderCalls: 2,
  retryPolicy: { maxAttemptsPerPage: 1, retryableCodes: [], stopOnPageFailure: false }, transportContext: { mode: "fixture", networked: false }, now: () => at,
  transport: async (_request, context) => {
    pageLocalCalls += 1;
    if (context.pageId === "P1") return { status: "failed", provider: "fixture-provider", model: "fixture-model", taskId: "page-local-failure", cost: 0, error: { code: "FIXTURE_PAGE_FAILURE", message: "page-local" } };
    return { status: "succeeded", provider: "fixture-provider", model: "fixture-model", taskId: "page-local-success", cost: 0.5, bytes: nativeFixture };
  }
});
assert.equal(pageLocalCalls, 2);
assert.equal(pageLocalResult.counters.retries, 0);
assert.equal(pageLocalResult.attempts.length, 2);
assert.equal(pageLocalResult.revisions.length, 1);
assert.equal(pageLocalResult.revisions[0].pageId, "P2");
assert.deepEqual(pageLocalResult.providerPlanFactRef, { id: separatePlanFact.id, hash: separatePlanFact.factHash });

let callCapCalls = 0;
const callCapResult = await executeApprovedXhsPageArtifacts({
  designEvidence: separatePlanEvidence, providerPlanFact: separatePlanFact, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: oneTryBudget, approval: oneTryApproval, targetPageIds: ["P1", "P2"], idempotencyKey: "fixture:call-cap", maxProviderCalls: 1,
  retryPolicy: { maxAttemptsPerPage: 1, retryableCodes: [], stopOnPageFailure: false }, transportContext: { mode: "fixture", networked: false }, now: () => at,
  transport: async (_request, context) => { callCapCalls += 1; return { status: "succeeded", provider: "fixture-provider", model: "fixture-model", taskId: `cap-${context.pageId}`, cost: 0.5, bytes: nativeFixture }; }
});
assert.equal(callCapCalls, 1);
assert.deepEqual(callCapResult.blockers, ["provider_call_limit_reached_before_call"]);

let unknownCostCalls = 0;
const unknownCostResult = await executeApprovedXhsPageArtifacts({
  designEvidence: separatePlanEvidence, providerPlanFact: separatePlanFact, contentProjectRef: fixtureProjectRef, platformRunRef: fixtureRunRef, candidateRef: fixtureCandidateRef,
  budget: oneTryBudget, approval: oneTryApproval, targetPageIds: ["P1", "P2"], idempotencyKey: "fixture:unknown-cost", maxProviderCalls: 2,
  retryPolicy: { maxAttemptsPerPage: 1, retryableCodes: [], stopOnPageFailure: false }, transportContext: { mode: "fixture", networked: false }, now: () => at,
  transport: async () => { unknownCostCalls += 1; return { status: "failed", provider: "fixture-provider", model: "fixture-model", paidTaskCreated: true, costStatus: "unknown", taskId: "unknown-paid-task", checkpoint: { taskId: "unknown-paid-task" } }; }
});
assert.equal(unknownCostCalls, 1);
assert.deepEqual(unknownCostResult.blockers, ["unknown_paid_task_cost_checkpoint_required"]);
assert.equal(unknownCostResult.attempts[0].error.code, "UNKNOWN_PAID_TASK_COST");
assert.equal(unknownCostResult.checkpoints.length, 1);

console.log(JSON.stringify({
  test: "xhs-page-artifact-runtime-self-test", status: "passed", fixtureProviderCalls: fixtureCalls + revisionRetryCalls, fixtureNetworkCalls: runtimeResult.counters.networkCalls,
  localSimulatedProviderCalls: simulatedNetworkCalls, localSimulatedNetworkCalls: simulatedNetwork.counters.networkCalls,
  facts: { attempts: simulatedNetwork.attempts.length, revisions: simulatedNetwork.revisions.length }, rawBytes: rawAsset.bytes, normalizedBytes: normalization.record.outputAsset.bytes,
  finalDimensions: normalization.record.outputAsset.dimensions, authority: { reviewable: true, selectable: false, finalBundleAuthority: false, publicationPerformed: false }
}, null, 2));
