import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import {
  invokeDesignXhsIntegratedPages,
  validateDesignSkillInvocation
} from "../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import {
  buildIntegratedPageExecutionPlan,
  validateIntegratedPageExecutionPlan
} from "../image-providers/xhs-integrated-page/execution-plan.mjs";

export const XHS_DESIGN_RUNTIME_EVIDENCE = "XhsVisualDesignRuntimeEvidence@1.0";
export const XHS_DESIGN_LEGACY_ADAPTER = "XhsVisualDesignLegacyInvocationAdapter@1.0";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => structuredClone(value);

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

function assertHash(value, code) {
  if (!HASH.test(value || "")) fail(code);
}

function objectRef(value, label) {
  object(value, `${label}_OBJECT_REQUIRED`);
  if (!value.id) fail(`${label}_ID_REQUIRED`);
  return { id: value.id, hash: stableHash(value) };
}

function assertRef(ref, value, label) {
  object(ref, `${label}_REF_REQUIRED`);
  if (ref.id !== value.id || ref.hash !== stableHash(value)) fail(`${label}_REF_MISMATCH`);
}

function offlineCounters(value, label) {
  const expected = ["networkCalls", "providerCalls", "retries", "cost", "databaseWrites"];
  for (const key of expected) {
    if (value?.[key] !== 0) fail(`${label}_EXTERNAL_CALL_BOUNDARY`);
  }
}

function planAuthorization(skillExecutionPlan, expectedPlanHash) {
  object(skillExecutionPlan, "XHS_DESIGN_EXECUTION_PLAN_REQUIRED");
  if (skillExecutionPlan.platform !== "xiaohongshu" || skillExecutionPlan.authorization?.mode !== "strict") fail("XHS_DESIGN_STRICT_PLAN_REQUIRED");
  const calculated = stableHash(skillExecutionPlan);
  if (expectedPlanHash !== calculated) fail("XHS_DESIGN_PLAN_HASH_MISMATCH");
  const step = skillExecutionPlan.steps?.find((item) => item.id === "visual_design");
  if (!step || step.kind !== "skill" || step.capability !== "design-xhs-integrated-pages") fail("XHS_DESIGN_SKILL_STEP_NOT_PLANNED");
  if (step.enabled !== true || step.state !== "planned" || step.decision !== "enabled") fail("XHS_DESIGN_SKILL_STEP_NOT_ENABLED");
  if (step.inputContract !== "DesignXhsIntegratedPagesRuntimeInput@1.0" || !step.outputContract.includes("XhsIntegratedPagePromptSet@1.0")) fail("XHS_DESIGN_PLAN_CONTRACT_MISMATCH");
  return {
    mode: "strict",
    planRef: { kind: skillExecutionPlan.kind, platform: skillExecutionPlan.platform, hash: calculated },
    stepRef: { id: step.id, capability: step.capability, hash: stableHash(step) }
  };
}

export function buildXhsDesignRuntimeBindings({ runtimeInput, sharedContentMaster, platformRun, candidate }) {
  object(runtimeInput, "XHS_DESIGN_RUNTIME_INPUT_REQUIRED");
  object(runtimeInput.xhsPostPackage, "XHS_DESIGN_XHS_POST_PACKAGE_REQUIRED");
  object(runtimeInput.visualSelection, "XHS_DESIGN_VISUAL_SELECTION_REQUIRED");
  return {
    xhsPostPackageRef: {
      id: runtimeInput.xhsPostPackage.id || runtimeInput.xhsPostPackage.data?.id || `${runtimeInput.id}:xhs-post-package`,
      hash: stableHash(runtimeInput.xhsPostPackage)
    },
    sharedContentMasterRef: objectRef(sharedContentMaster, "XHS_DESIGN_SHARED_MASTER"),
    platformRunRef: objectRef(platformRun, "XHS_DESIGN_PLATFORM_RUN"),
    candidateRef: objectRef(candidate, "XHS_DESIGN_CANDIDATE"),
    visualSelectionRef: {
      id: runtimeInput.visualSelection.id || `${runtimeInput.id}:visual-selection`,
      hash: stableHash(runtimeInput.visualSelection)
    }
  };
}

function validateBindings(bindings, values) {
  object(bindings, "XHS_DESIGN_BINDINGS_REQUIRED");
  const packageRef = bindings.xhsPostPackageRef;
  if (packageRef?.hash !== stableHash(values.runtimeInput.xhsPostPackage)) fail("XHS_DESIGN_XHS_POST_PACKAGE_REF_MISMATCH");
  const visualRef = bindings.visualSelectionRef;
  if (visualRef?.hash !== stableHash(values.runtimeInput.visualSelection)) fail("XHS_DESIGN_VISUAL_SELECTION_REF_MISMATCH");
  assertRef(bindings.sharedContentMasterRef, values.sharedContentMaster, "XHS_DESIGN_SHARED_MASTER");
  assertRef(bindings.platformRunRef, values.platformRun, "XHS_DESIGN_PLATFORM_RUN");
  assertRef(bindings.candidateRef, values.candidate, "XHS_DESIGN_CANDIDATE");
  if (values.platformRun.platform !== "xiaohongshu" || values.candidate.platform !== "xiaohongshu") fail("XHS_DESIGN_PLATFORM_BINDING_INVALID");
  const candidatePackageHash = values.candidate.xhsPostPackageRef?.hash || values.candidate.writerOutputRef?.hash || null;
  if (candidatePackageHash && candidatePackageHash !== packageRef.hash) fail("XHS_DESIGN_CANDIDATE_PACKAGE_MISMATCH");
  const candidateRunHash = values.candidate.platformRunRef?.hash || null;
  if (candidateRunHash && candidateRunHash !== bindings.platformRunRef.hash) fail("XHS_DESIGN_CANDIDATE_RUN_MISMATCH");
  const runMasterHash = values.platformRun.sharedContentMasterRef?.hash || null;
  if (runMasterHash && runMasterHash !== bindings.sharedContentMasterRef.hash) fail("XHS_DESIGN_RUN_MASTER_MISMATCH");
  return clone(bindings);
}

function bundleProjection(invocation) {
  return {
    skill: clone(invocation.skill),
    libraryRefs: clone(invocation.libraryRefs),
    referenceDocs: clone(invocation.referenceDocs)
  };
}

export function validateXhsDesignRuntimeEvidence(value) {
  object(value, "XHS_DESIGN_EVIDENCE_REQUIRED");
  if (value.schemaVersion !== "1.0" || value.contract !== XHS_DESIGN_RUNTIME_EVIDENCE || value.capability !== "design-xhs-integrated-pages" || value.stage !== "visual_design" || value.platform !== "xiaohongshu") fail("XHS_DESIGN_EVIDENCE_IDENTITY_INVALID");
  if (value.executionMode !== "deterministic_adapter" || value.authorization?.mode !== "strict") fail("XHS_DESIGN_EVIDENCE_AUTHORIZATION_INVALID");
  assertHash(value.authorization.planRef?.hash, "XHS_DESIGN_EVIDENCE_PLAN_HASH_REQUIRED");
  assertHash(value.authorization.stepRef?.hash, "XHS_DESIGN_EVIDENCE_STEP_HASH_REQUIRED");
  validateDesignSkillInvocation(value.outputs?.skillInvocation);
  if (value.outputs.promptSetHash !== value.outputs.skillInvocation.promptSetHash || value.outputs.promptSetHash !== stableHash(value.outputs.skillInvocation.promptSet)) fail("XHS_DESIGN_PROMPT_SET_HASH_MISMATCH");
  if (value.outputs.integratedPageExecutionPlan) {
    validateIntegratedPageExecutionPlan(value.outputs.integratedPageExecutionPlan);
    if (value.hashes.providerExecutionPlanHash !== value.outputs.integratedPageExecutionPlan.planHash) fail("XHS_DESIGN_PROVIDER_PLAN_HASH_MISMATCH");
  } else if (value.hashes.providerExecutionPlanHash !== null) fail("XHS_DESIGN_PROVIDER_PLAN_HASH_UNEXPECTED");
  const expectedBundle = bundleProjection(value.outputs.skillInvocation);
  if (value.hashes.bundleHash !== stableHash(expectedBundle)) fail("XHS_DESIGN_BUNDLE_HASH_MISMATCH");
  if (stableHash(value.hashes.libraryHashes) !== stableHash(value.outputs.skillInvocation.libraryRefs)) fail("XHS_DESIGN_LIBRARY_HASH_MISMATCH");
  if (value.hashes.inputHash !== stableHash({ bindings: value.bindings, runtimeInputRef: value.outputs.skillInvocation.runtimeInputRef })) fail("XHS_DESIGN_INPUT_HASH_MISMATCH");
  if (value.hashes.outputHash !== stableHash(value.outputs)) fail("XHS_DESIGN_OUTPUT_HASH_MISMATCH");
  if (value.hashes.planHash !== value.authorization.planRef.hash) fail("XHS_DESIGN_AUTHORIZED_PLAN_HASH_MISMATCH");
  offlineCounters(value.boundary?.counters, "XHS_DESIGN_EVIDENCE");
  if (value.boundary.pageRevisionRefs?.length !== 0 || value.boundary.selectionAuthority !== false || value.boundary.publicationPerformed !== false || value.boundary.deliveryBundleCreated !== false) fail("XHS_DESIGN_EVIDENCE_STATE_BOUNDARY");
  const ready = value.outputs.integratedPageExecutionPlan?.execution?.status === "ready_for_isolated_provider_execution";
  if (value.productionEligible !== ready || (ready && value.nextGate !== "HumanProviderExecutionApproval")) fail("XHS_DESIGN_PRODUCTION_ELIGIBILITY_INVALID");
  const copy = clone(value);
  delete copy.evidenceHash;
  if (stableHash(copy) !== value.evidenceHash) fail("XHS_DESIGN_EVIDENCE_HASH_MISMATCH");
  return true;
}

export function runPlannedXhsDesignRuntime({
  runtimeInput,
  sharedContentMaster,
  platformRun,
  candidate,
  bindings,
  skillExecutionPlan,
  expectedPlanHash,
  featureFlags,
  providerPlanningInput = null
}) {
  if (featureFlags?.xhsIntegratedPageDesignSkill !== true) fail("XHS_DESIGN_FEATURE_FLAG_DISABLED");
  const authorization = planAuthorization(skillExecutionPlan, expectedPlanHash);
  const validatedBindings = validateBindings(bindings, { runtimeInput, sharedContentMaster, platformRun, candidate });
  const skillInvocation = invokeDesignXhsIntegratedPages(runtimeInput);
  let integratedPageExecutionPlan = null;
  if (providerPlanningInput) {
    integratedPageExecutionPlan = buildIntegratedPageExecutionPlan({ ...clone(providerPlanningInput), skillInvocation });
  }
  const outputs = {
    skillInvocation,
    promptSetHash: skillInvocation.promptSetHash,
    integratedPageExecutionPlan
  };
  const readyForApproval = integratedPageExecutionPlan?.execution?.status === "ready_for_isolated_provider_execution";
  const base = {
    schemaVersion: "1.0",
    contract: XHS_DESIGN_RUNTIME_EVIDENCE,
    id: `xhs-design-evidence:${platformRun.id}:${candidate.id}:${skillInvocation.invocationHash.slice(0, 16)}`,
    capability: "design-xhs-integrated-pages",
    stage: "visual_design",
    platform: "xiaohongshu",
    status: readyForApproval ? "ready_for_human_provider_approval" : integratedPageExecutionPlan ? "blocked" : "prompt_set_ready",
    executionMode: "deterministic_adapter",
    authorization,
    bindings: validatedBindings,
    outputs,
    hashes: {
      bundleHash: stableHash(bundleProjection(skillInvocation)),
      libraryHashes: clone(skillInvocation.libraryRefs),
      inputHash: stableHash({ bindings: validatedBindings, runtimeInputRef: skillInvocation.runtimeInputRef }),
      outputHash: stableHash(outputs),
      planHash: authorization.planRef.hash,
      providerExecutionPlanHash: integratedPageExecutionPlan?.planHash || null
    },
    boundary: {
      counters: { networkCalls: 0, providerCalls: 0, retries: 0, cost: 0, databaseWrites: 0 },
      pageRevisionRefs: [],
      selectionAuthority: false,
      deliveryBundleCreated: false,
      publicationPerformed: false
    },
    productionEligible: Boolean(readyForApproval),
    nextGate: "HumanProviderExecutionApproval"
  };
  const evidence = { ...base, evidenceHash: stableHash(base) };
  validateXhsDesignRuntimeEvidence(evidence);
  return evidence;
}

export function adaptLegacyXhsDesignInvocationReadOnly(invocation) {
  object(invocation, "XHS_DESIGN_LEGACY_INVOCATION_REQUIRED");
  if (invocation.kind !== "design-xhs-integrated-pages/skill-invocation@1.0") fail("XHS_DESIGN_LEGACY_INVOCATION_KIND_INVALID");
  offlineCounters(invocation.counters, "XHS_DESIGN_LEGACY_INVOCATION");
  const sourceHash = invocation.invocationHash || stableHash(invocation);
  assertHash(sourceHash, "XHS_DESIGN_LEGACY_INVOCATION_HASH_REQUIRED");
  const before = stableHash(invocation);
  const result = {
    schemaVersion: "1.0",
    contract: XHS_DESIGN_LEGACY_ADAPTER,
    mode: "read_only",
    authorization: "legacy_unplanned",
    sourceInvocationRef: { id: invocation.promptSet?.id || null, hash: sourceHash },
    sourceEvidenceHash: before,
    productionEligible: false,
    nextGate: "ReplanWithStrictVisualDesignStep",
    boundary: {
      providerCalls: 0,
      pageRevisionRefs: [],
      selectionAuthority: false,
      deliveryBundleCreated: false,
      publicationPerformed: false
    }
  };
  if (stableHash(invocation) !== before) fail("XHS_DESIGN_LEGACY_INVOCATION_MUTATED");
  return result;
}
