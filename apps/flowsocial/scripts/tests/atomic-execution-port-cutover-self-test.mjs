import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { createUnifiedAtomicSkillActivityExecutionPort } from "../../content-agent/unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const capability = "write-xhs-post-copy";
const step = {
  id: "xhs_post_copy",
  kind: "skill",
  capability,
  inputContract: "XhsPostCopyInput@1.0",
  outputContract: "XhsPostCopyCreativeOutput@1.0",
  dependsOn: ["outline_confirmation"],
  required: true
};
const executionPlan = {
  schemaVersion: "1.0",
  kind: "UnifiedPlatformSkillExecutionPlan",
  platform: "xiaohongshu",
  graphMode: "atomic_v4",
  steps: [step]
};
const rawEnvelope = deepFreeze({ status: "success", data: { fixture: true }, warnings: [], blocked_reasons: [] });
const ref = (id, character) => ({ id, hash: character.repeat(64) });
const systemContext = {
  componentId: "component:fixture",
  authorityBinding: {
    companyId: "company:fixture", accountId: "account:fixture",
    activeStrategySnapshotRef: ref("strategy", "1"), contentOpportunityRef: ref("opportunity", "2"),
    mechanismDecisionRef: ref("decision", "3"), contentProjectRef: ref("project", "4"),
    platformRunRef: ref("run", "5"), sharedContentMasterRef: ref("master", "6"),
    platformBriefRef: ref("brief", "7"), confirmedOutlineRef: ref("outline", "8"),
    writerContextRef: ref("writer", "9"), designDnaRef: ref("dna", "a")
  }
};

function assemble({ capability: requestedCapability, envelope }) {
  return deepFreeze({
    id: "component:fixture",
    contract: "XhsPostCopy@1.0",
    capability: requestedCapability,
    sourceEnvelopeHash: hashUnifiedContent(envelope)
  });
}

function runtimeResult(plan, component = assemble({ capability, envelope: rawEnvelope }), attempt = 1) {
  const executionPlanHash = hashUnifiedContent(plan);
  return {
    data: structuredClone(rawEnvelope),
    component,
    skillTrace: {
      invocationId: "atomic-invocation:fixture",
      planAuthorization: "planned",
      executionPlanHash
    },
    executionRecord: {
      invocationId: "atomic-invocation:fixture",
      planAuthorization: "planned",
      executionPlanHash,
      bundleHash: "a".repeat(64),
      inputHash: "b".repeat(64),
      outputHash: hashUnifiedContent(rawEnvelope),
      executionMode: "mock_fixture",
      status: "completed",
      attempt
    }
  };
}

const liveInvocations = [];
let runnerCalls = 0;
let receivedFrozenBoundary = false;
const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
const port = createUnifiedAtomicSkillActivityExecutionPort({
  generateText: async (_request, options) => {
    liveInvocations.push(options.liveInvocation);
    return { mode: "offline_fixture", data: structuredClone(rawEnvelope) };
  },
  liveExecution: true,
  evidenceCompiler,
  componentAssembler: assemble,
  runner: async (request) => {
    runnerCalls += 1;
    receivedFrozenBoundary = Object.isFrozen(request.input)
      && Object.isFrozen(request.systemContext)
      && Object.isFrozen(request.planStep)
      && Object.isFrozen(request.executionPlan)
      && request.planAuthorization === "strict";
    await request.generateText({ fixture: true }, {});
    return runtimeResult(request.executionPlan);
  }
});

const result = await port({ capability, input: { fixture: true }, systemContext, step, executionPlan });
assert.equal(runnerCalls, 1, "one atomic activity must call its Runtime runner exactly once");
assert.equal(receivedFrozenBoundary, true, "Port must freeze the plan, step, input, and system context before Runtime execution");
assert.deepEqual(liveInvocations.map((item) => item.ordinal), [1]);
assert.deepEqual(liveInvocations[0], { ordinal: 1, capability, platform: "xiaohongshu", stepId: step.id });
assert.equal(result.contract, "UnifiedAtomicActivityBundle@1.0");
assert.equal(result.invocation.contract, "SkillActivityInvocation@1.0");
assert.equal(result.invocation.skill.name, capability);
assert.equal(result.invocation.skill.version, step.outputContract);
assert.equal(result.invocation.planHash, hashUnifiedContent(executionPlan));
assert.deepEqual(result.invocation.attemptPolicy, { maxAttempts: 1, automaticRetries: 0, timeoutMs: 60000, maxProviderCalls: 1, costBudget: null });
assert.equal(Object.hasOwn(result, "rawProviderEnvelope"), false, "Activity Bundle must retain only the immutable raw envelope ref");
assert.equal(Object.hasOwn(result.verifiedComponent, "executionRecord"), false);
assert.equal(Object.hasOwn(result.executionEvidence, "data"), false);
assert.deepEqual(result.executionEvidence.executionRecord.attempt, 1);
assert.equal(result.executionEvidence.outputHash, result.rawProviderEnvelopeRef.hash);
assert.equal(result.rawProviderEnvelopeRef.hash, hashUnifiedContent(rawEnvelope));
assert.equal(Object.isFrozen(result), true);
assert.equal(Object.isFrozen(result.invocation), true);
assert.equal(Object.isFrozen(result.rawProviderEnvelopeRef), true);
assert.equal(Object.isFrozen(result.executionEvidence), true);
assert.equal(Object.isFrozen(result.verifiedComponent), true);
assert.throws(() => { result.rawProviderEnvelopeRef.hash = "f".repeat(64); }, TypeError);
const stored = evidenceCompiler.getAtomicActivityBundles();
assert.equal(stored.length, 1);
assert.deepEqual(stored[0], result);
stored[0].capability = "tampered";
assert.equal(evidenceCompiler.getAtomicActivityBundles()[0].capability, capability, "EvidenceCompiler must return defensive bundle copies");

let mismatchRunnerCalls = 0;
const mismatchPort = createUnifiedAtomicSkillActivityExecutionPort({
  generateText: async () => null,
  evidenceCompiler: createUnifiedSkillEvidenceCompiler(),
  componentAssembler: assemble,
  runner: async (request) => {
    mismatchRunnerCalls += 1;
    return runtimeResult(request.executionPlan, deepFreeze({ id: "wrong-component", contract: "Wrong@1.0" }));
  }
});
await assert.rejects(
  () => mismatchPort({ capability, input: {}, systemContext, step, executionPlan }),
  (error) => error.code === "UNIFIED_XHS_ATOMIC_VERIFIED_COMPONENT_MISMATCH"
);
assert.equal(mismatchRunnerCalls, 1);

const retryPort = createUnifiedAtomicSkillActivityExecutionPort({
  generateText: async () => null,
  evidenceCompiler: createUnifiedSkillEvidenceCompiler(),
  componentAssembler: assemble,
  runner: async (request) => runtimeResult(request.executionPlan, assemble({ capability, envelope: rawEnvelope }), 2)
});
await assert.rejects(
  () => retryPort({ capability, input: {}, systemContext, step, executionPlan }),
  (error) => error.code === "UNIFIED_XHS_ATOMIC_ZERO_RETRY_REQUIRED"
);

let unauthorizedRunnerCalls = 0;
const unauthorizedPort = createUnifiedAtomicSkillActivityExecutionPort({
  generateText: async () => null,
  evidenceCompiler: createUnifiedSkillEvidenceCompiler(),
  componentAssembler: assemble,
  runner: async () => { unauthorizedRunnerCalls += 1; return null; }
});
await assert.rejects(
  () => unauthorizedPort({ capability, input: {}, systemContext, step: { ...step, capability: "write-xhs-content" }, executionPlan }),
  (error) => error.code === "UNIFIED_XHS_ATOMIC_PLAN_STEP_MISMATCH"
);
assert.equal(unauthorizedRunnerCalls, 0, "plan mismatch must fail before Runtime execution");

const orchestratorPath = fileURLToPath(new URL("../../content-agent/unified-content-orchestrator.mjs", import.meta.url));
const serverAdapterPath = fileURLToPath(new URL("../../content-agent/unified-content-server-adapter.mjs", import.meta.url));
const orchestratorSource = await readFile(orchestratorPath, "utf8");
const serverAdapterSource = await readFile(serverAdapterPath, "utf8");
assert.equal(orchestratorSource.includes("runXhsAtomicSkill"), false, "Orchestrator must not import or call the atomic Runtime");
assert.equal(orchestratorSource.includes("dependencies.generateText"), false, "Orchestrator atomic path must not own Provider transport");
assert.equal((serverAdapterSource.match(/createUnifiedAtomicSkillActivityExecutionPort\s*\(\s*\{/g) || []).length, 1, "Server must create exactly one atomic execution Port per product request");
assert.ok(serverAdapterSource.includes("executeAtomicSkillActivity,"), "Server must inject the atomic Port into Orchestrator");

console.log(JSON.stringify({
  status: "atomic-execution-port-cutover-self-test passed",
  runnerCalls,
  liveInvocations: liveInvocations.length,
  rawEnvelopeAuthoritative: false
}, null, 2));
