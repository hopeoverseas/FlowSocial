import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { createUnifiedSkillOutputFact } from "./unified-skill-output-contracts.mjs";

function fail(code, message, statusCode = 409, details = null) {
  throw Object.assign(new Error(message || code), { code, statusCode, details });
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function runSafePostProviderPhase(code, operation) {
  try {
    return operation();
  } catch (error) {
    if (typeof error?.code === "string" && error.code) throw error;
    throw Object.assign(new Error(code), { code, statusCode: 500, details: null });
  }
}

function compileActualExecutionEvidence(result, { platform, step, executionPlan }) {
  const record = result?.executionRecord;
  const trace = result?.skillTrace;
  if (!record || !trace?.invocationId) fail("UNIFIED_CONTENT_EXECUTION_RECORD_REQUIRED", `Skill ${step.capability} did not return Runtime execution evidence`);
  if (record.planAuthorization !== "planned" || trace.planAuthorization !== "planned") {
    fail("UNIFIED_CONTENT_STRICT_AUTHORIZATION_REQUIRED", `Skill ${step.capability} was not strictly authorized`);
  }
  const expectedPlanHash = hashUnifiedContent(executionPlan);
  if (record.executionPlanHash !== expectedPlanHash || trace.executionPlanHash !== expectedPlanHash) {
    fail("UNIFIED_CONTENT_EXECUTION_PLAN_HASH_MISMATCH", `Skill ${step.capability} execution evidence is not bound to the exact plan`);
  }
  for (const key of ["bundleHash", "inputHash", "outputHash", "executionPlanHash"]) {
    if (typeof record[key] !== "string" || !record[key]) fail("UNIFIED_CONTENT_EXECUTION_HASH_REQUIRED", `${step.capability}.${key} is required`);
  }
  const invocation = {
    id: trace.invocationId,
    platform,
    stepId: step.id,
    capability: step.capability,
    executionMode: record.executionMode,
    status: record.status,
    bundleHash: record.bundleHash,
    inputHash: record.inputHash,
    outputHash: record.outputHash,
    executionPlanHash: record.executionPlanHash,
    executionRecord: clone(record)
  };
  return { ...invocation, executionRecordHash: hashUnifiedContent(record), invocationHash: hashUnifiedContent(invocation) };
}

export function createUnifiedSkillEvidenceCompiler({ outputFactFactory = createUnifiedSkillOutputFact } = {}) {
  const actualInvocations = [];
  const skillOutputFacts = [];
  const atomicActivityBundles = [];
  const atomicCompilerContexts = [];

  return Object.freeze({
    compileExecutionEvidence(result, context) {
      return runSafePostProviderPhase("UNIFIED_SKILL_EXECUTION_EVIDENCE_INTERNAL_ERROR", () => compileActualExecutionEvidence(result, context));
    },

    commitCompletedInvocation({ evidence, platform, step, executionPlan, runtimeOutput, verifiedDomainOutput }) {
      const fact = runSafePostProviderPhase("UNIFIED_SKILL_OUTPUT_FACT_CREATION_INTERNAL_ERROR", () => outputFactFactory({
        evidence,
        platform,
        step,
        executionPlan,
        runtimeOutput,
        verifiedDomainOutput
      }));
      actualInvocations.push(clone(evidence));
      skillOutputFacts.push(clone(fact));
      return clone(fact);
    },

    restoreCompletedInvocation({ invocation, outputFact }) {
      if (!invocation?.id || !outputFact?.id || outputFact.invocationRef?.id !== invocation.id
        || outputFact.invocationRef?.hash !== invocation.invocationHash
        || actualInvocations.some((item) => item.id === invocation.id)
        || skillOutputFacts.some((item) => item.id === outputFact.id)) {
        fail("UNIFIED_SKILL_CHECKPOINT_INVALID");
      }
      actualInvocations.push(clone(invocation));
      skillOutputFacts.push(clone(outputFact));
      return clone(outputFact);
    },

    commitAtomicActivityBundle({ bundle, compilerContext }) {
      if (!bundle || !compilerContext) fail("UNIFIED_ATOMIC_ACTIVITY_BUNDLE_REQUIRED");
      if (atomicActivityBundles.some((item) => item.capability === bundle.capability)) {
        fail("UNIFIED_ATOMIC_ACTIVITY_DUPLICATE", `Atomic activity ${bundle.capability} was already committed`);
      }
      atomicActivityBundles.push(clone(bundle));
      atomicCompilerContexts.push(clone(compilerContext));
      return clone(bundle);
    },

    resolveUniqueOutputFact({ capability, platform = null }) {
      const matches = skillOutputFacts.filter((item) => item.capability === capability && (platform == null || item.platform === platform));
      if (matches.length > 1) fail("UNIFIED_SKILL_UPSTREAM_FACT_AUTHORITY_REQUIRED", `Expected at most one ${capability} output fact`);
      return matches.length === 1 ? clone(matches[0]) : null;
    },

    getActualInvocations() {
      return clone(actualInvocations);
    },

    getSkillOutputFacts() {
      return clone(skillOutputFacts);
    },

    getAtomicActivityBundles() {
      return clone(atomicActivityBundles);
    },

    getAtomicCompilerContexts() {
      return clone(atomicCompilerContexts);
    }
  });
}
