import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";

function step(capability = "build-content-master", id = "content_master") {
  return { id, kind: "skill", capability, inputContract: "Input@1.0", outputContract: "Output@1.0", enabled: true };
}

function resultFor(executionPlan, runtimeOutput = { ok: true }, attempt = 1) {
  const executionPlanHash = hashUnifiedContent(executionPlan);
  return {
    data: runtimeOutput,
    skillTrace: { invocationId: `invocation:${Math.random()}`, planAuthorization: "planned", executionPlanHash },
    executionRecord: {
      invocationId: `record:${Math.random()}`,
      planAuthorization: "planned",
      executionPlanHash,
      bundleHash: "bundle-hash",
      inputHash: "input-hash",
      outputHash: hashUnifiedContent(runtimeOutput),
      executionMode: "mock_fixture",
      status: "completed",
      attempt
    }
  };
}

function factFactory({ evidence, platform, step: planStep, runtimeOutput, verifiedDomainOutput }) {
  return {
    id: `fact:${evidence.id}`,
    platform: planStep.id === "content_master" ? "shared" : platform,
    capability: planStep.capability,
    runtimeOutput: structuredClone(runtimeOutput),
    verifiedDomainOutput: structuredClone(verifiedDomainOutput)
  };
}

async function expectCode(operation, code) {
  await assert.rejects(operation, (error) => error?.code === code);
}

async function runFailureTable() {
  const cases = [
    {
      name: "input validation blocks before runner",
      expected: "INPUT_REJECTED",
      inputValidator: () => { throw Object.assign(new Error("input"), { code: "INPUT_REJECTED" }); },
      expectedRunnerCalls: 0
    },
    {
      name: "runner failure is preserved",
      expected: "RUNNER_REJECTED",
      runner: async () => { throw Object.assign(new Error("runner"), { code: "RUNNER_REJECTED" }); },
      expectedRunnerCalls: 1
    },
    {
      name: "missing execution evidence fails before output validation",
      expected: "UNIFIED_CONTENT_EXECUTION_RECORD_REQUIRED",
      runner: async () => ({ data: { ok: true } }),
      expectedRunnerCalls: 1,
      expectedOutputCalls: 0
    },
    {
      name: "uncoded output validation failure is normalized",
      expected: "UNIFIED_SKILL_DOMAIN_VALIDATION_INTERNAL_ERROR",
      outputValidator: () => { throw new Error("validator internals"); },
      expectedRunnerCalls: 1,
      expectedOutputCalls: 1
    },
    {
      name: "uncoded fact creation failure is normalized",
      expected: "UNIFIED_SKILL_OUTPUT_FACT_CREATION_INTERNAL_ERROR",
      factFactory: () => { throw new Error("fact internals"); },
      expectedRunnerCalls: 1,
      expectedOutputCalls: 1
    }
  ];

  for (const testCase of cases) {
    const executionPlan = { id: `plan:${testCase.name}` };
    let runnerCalls = 0;
    let outputCalls = 0;
    const compiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: testCase.factFactory || factFactory });
    const outputValidator = testCase.outputValidator
      ? (...args) => { outputCalls += 1; return testCase.outputValidator(...args); }
      : ({ runtimeOutput }) => { outputCalls += 1; return runtimeOutput; };
    const execute = createUnifiedSkillActivityExecutor({
      generateText: async () => "unused",
      evidenceCompiler: compiler,
      runner: async (input) => {
        runnerCalls += 1;
        return testCase.runner ? testCase.runner(input) : resultFor(executionPlan);
      },
      domainInputValidator: testCase.inputValidator || (() => {}),
      domainOutputValidator: outputValidator
    });
    await expectCode(() => execute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: step(), executionPlan }), testCase.expected);
    assert.equal(runnerCalls, testCase.expectedRunnerCalls, testCase.name);
    assert.equal(outputCalls, testCase.expectedOutputCalls || 0, testCase.name);
    assert.equal(compiler.getActualInvocations().length, 0, `${testCase.name}: evidence must commit atomically with fact`);
    assert.equal(compiler.getSkillOutputFacts().length, 0, `${testCase.name}: failed activity must not expose facts`);
  }
}

async function runLiveBoundaryChecks() {
  const badPlan = { id: "plan:live-bad" };
  let badCalls = 0;
  const badCompiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: factFactory });
  const badExecute = createUnifiedSkillActivityExecutor({
    generateText: async () => "unused",
    liveExecution: true,
    evidenceCompiler: badCompiler,
    runner: async () => { badCalls += 1; return resultFor(badPlan, { ok: true }, 2); },
    domainInputValidator: () => {},
    domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
  });
  await expectCode(() => badExecute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: step(), executionPlan: badPlan }), "UNIFIED_CONTENT_LIVE_ZERO_RETRY_REQUIRED");
  assert.equal(badCalls, 1);

  const livePlan = { id: "plan:live-ordinals" };
  const identities = [];
  const maxAttempts = [];
  const compiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: factFactory });
  const execute = createUnifiedSkillActivityExecutor({
    generateText: async (_request, options) => { identities.push(options.liveInvocation); return "ok"; },
    liveExecution: true,
    evidenceCompiler: compiler,
    runner: async (input) => {
      maxAttempts.push(input.maxAttempts);
      await input.generateText({ skill_runtime: { skill_name: input.capability } }, null);
      return resultFor(livePlan);
    },
    domainInputValidator: () => {},
    domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
  });
  const sourceStep = step("analyze-sources", "source_analysis");
  await execute({ capability: sourceStep.capability, platform: "xiaohongshu", input: {}, step: sourceStep, executionPlan: livePlan });
  await execute({ capability: sourceStep.capability, platform: "wechat", input: {}, step: sourceStep, executionPlan: livePlan });
  assert.deepEqual(identities, [
    { ordinal: 1, capability: "analyze-sources", platform: "xiaohongshu", stepId: "source_analysis" },
    { ordinal: 2, capability: "analyze-sources", platform: "wechat", stepId: "source_analysis" }
  ]);
  assert.deepEqual(maxAttempts, [1, 1]);

  const outlinePlan = { id: "plan:live-outline-recovery" };
  const outlineCompiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: factFactory });
  let outlineRunnerInput = null;
  const outlineExecute = createUnifiedSkillActivityExecutor({
    generateText: async () => "unused",
    liveExecution: true,
    evidenceCompiler: outlineCompiler,
    runner: async (input) => { outlineRunnerInput = input; return resultFor(outlinePlan, { ok: true }, 2); },
    domainInputValidator: () => {},
    domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
  });
  const outlineStep = step("generate-content-outline", "outline");
  await outlineExecute({ capability: outlineStep.capability, platform: "xiaohongshu", input: {}, step: outlineStep, executionPlan: outlinePlan });
  assert.equal(outlineRunnerInput.maxAttempts, 2);
  assert.deepEqual(outlineRunnerInput.retryErrorCodes, ["MODEL_CONNECT_TIMEOUT"]);

  const failClosedCompiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: factFactory });
  let providerCalls = 0;
  const failClosed = createUnifiedSkillActivityExecutor({
    generateText: async () => { providerCalls += 1; return "must-not-run"; },
    liveExecution: true,
    evidenceCompiler: failClosedCompiler,
    runner: async (input) => {
      await input.generateText({ skill_runtime: { skill_name: "wrong-capability" } }, null);
      return resultFor(livePlan);
    },
    domainInputValidator: () => {},
    domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
  });
  await expectCode(() => failClosed({ capability: sourceStep.capability, platform: "xiaohongshu", input: {}, step: sourceStep, executionPlan: livePlan }), "UNIFIED_CONTENT_LIVE_INVOCATION_IDENTITY_MISMATCH");
  assert.equal(providerCalls, 0, "mismatched Live identity must fail before the Provider");

  const fallbackCompiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: factFactory });
  const fallbackExecute = createUnifiedSkillActivityExecutor({
    generateText: async () => { providerCalls += 1; return "must-not-run"; },
    liveExecution: true,
    evidenceCompiler: fallbackCompiler,
    runner: async (input) => {
      await input.generateText({ skill_runtime: { skill_name: sourceStep.capability } }, { forgedBusinessFallback: true });
      return resultFor(livePlan);
    },
    domainInputValidator: () => {},
    domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
  });
  await expectCode(() => fallbackExecute({ capability: sourceStep.capability, platform: "xiaohongshu", input: {}, step: sourceStep, executionPlan: livePlan }), "UNIFIED_CONTENT_LIVE_FALLBACK_FORBIDDEN");
  assert.equal(providerCalls, 0, "formal Live fallback must fail before the Provider");
}

async function runUpstreamAndSnapshotChecks() {
  const executionPlan = { id: "plan:upstream" };
  const compiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: factFactory });
  const seenSources = [];
  const execute = createUnifiedSkillActivityExecutor({
    generateText: async () => "unused",
    evidenceCompiler: compiler,
    runner: async ({ capability }) => resultFor(executionPlan, capability === "build-content-master" ? { data: { master: "canonical" } } : { data: { article: "derived" } }),
    domainInputValidator: ({ capability, sourceContentMaster }) => { if (capability === "write-wechat-article") seenSources.push(sourceContentMaster); },
    domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
  });
  await execute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: step(), executionPlan });
  await execute({ capability: "write-wechat-article", platform: "wechat", input: {}, step: step("write-wechat-article", "platform_writer"), executionPlan });
  assert.deepEqual(seenSources, [{ master: "canonical" }]);
  const facts = compiler.getSkillOutputFacts();
  const invocations = compiler.getActualInvocations();
  facts[0].runtimeOutput.data.master = "mutated";
  invocations[0].executionRecord.status = "mutated";
  assert.equal(compiler.getSkillOutputFacts()[0].runtimeOutput.data.master, "canonical");
  assert.equal(compiler.getActualInvocations()[0].executionRecord.status, "completed");
}

async function runXhsDesignDnaCheck() {
  const executionPlan = { id: "plan:dna" };
  const compiler = createUnifiedSkillEvidenceCompiler({ outputFactFactory: factFactory });
  const masterStep = step();
  const writerStep = step("write-xhs-content", "platform_writer");
  const execute = createUnifiedSkillActivityExecutor({
    generateText: async () => "unused",
    evidenceCompiler: compiler,
    runner: async ({ capability }) => resultFor(executionPlan, capability === "build-content-master"
      ? { data: { master: true } }
      : { deck: { design_dna_version: "wrong" }, image_specs: [] }),
    domainInputValidator: () => {},
    domainOutputValidator: ({ runtimeOutput }) => runtimeOutput
  });
  await execute({ capability: "build-content-master", platform: "xiaohongshu", input: {}, step: masterStep, executionPlan });
  await expectCode(() => execute({
    capability: "write-xhs-content",
    platform: "xiaohongshu",
    input: { design_dna_ref: { id: "confirmed-dna" } },
    step: writerStep,
    executionPlan
  }), "UNIFIED_XHS_WRITER_DESIGN_DNA_BINDING_MISMATCH");
  assert.equal(compiler.getActualInvocations().length, 1);
}

await runFailureTable();
await runLiveBoundaryChecks();
await runUpstreamAndSnapshotChecks();
await runXhsDesignDnaCheck();

console.log("unified-skill-activity-executor-self-test: ok");
