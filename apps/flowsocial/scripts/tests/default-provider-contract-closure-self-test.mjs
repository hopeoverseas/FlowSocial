import assert from "node:assert/strict";
import { contractExample, validateContract, validateContractSchema } from "../../llm/contracts.mjs";
import { getLlmRuntimeStatus, invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import { validateUnifiedSkillDomainOutput } from "../../content-agent/unified-skill-output-contracts.mjs";

const contracts = [
  "XhsPostCopyCreativeOutput@1.0",
  "PlatformTitleList@1.0",
  "XhsVisualAssetPlanCreativeOutput@1.0",
  "WechatArticle@2.0",
  "WechatArticleReview@1.0",
  "WechatImagePlan@1.0"
];

for (const contract of contracts) {
  const example = contractExample(contract);
  assert.notDeepEqual(example, {}, `${contract} canonical example must be non-empty`);
  const validation = validateContractSchema(contract, example);
  assert.equal(validation.valid, true, `${contract}: ${validation.errors?.join("; ")}`);
}

for (const contract of contracts.filter((item) => item !== "WechatArticle@2.0")) {
  const example = contractExample(contract);
  const extra = structuredClone(example); extra.data.unexpected = true;
  const extraValidation = validateContract(contract, extra);
  assert.equal(extraValidation.valid, false);
  assert(extraValidation.validationFieldPaths.includes("$.data"));
  const missing = structuredClone(example); delete missing.warnings;
  const missingValidation = validateContract(contract, missing);
  assert.equal(missingValidation.valid, false);
  assert(missingValidation.validationFieldPaths.includes("$"));
  const wrapperValidation = validateContract(contract, { result: example });
  assert.equal(wrapperValidation.valid, false);
  assert(wrapperValidation.validationFieldPaths.includes("$"));
  const malformedValidation = validateContract(contract, "raw-provider-content");
  assert.equal(malformedValidation.valid, false);
  assert.deepEqual(malformedValidation.validationFieldPaths, ["$"]);
}

for (const contract of contracts.filter((item) => item !== "WechatArticle@2.0")) {
  const blocked = { status: "blocked", data: null, warnings: [], blocked_reasons: ["authority unavailable"] };
  const validation = validateContract(contract, blocked);
  if (["PlatformTitleList@1.0", "WechatArticleReview@1.0"].includes(contract)) assert.equal(validation.valid, false);
  else assert.equal(validation.valid, true, `${contract} must preserve legal blocked envelope`);
}
for (const contract of ["PlatformTitleList@1.0", "WechatArticleReview@1.0"]) {
  assert.equal(validateContract(contract, { status: "needs_review", data: null, warnings: ["review"], blocked_reasons: ["review required"] }).valid, true);
}

const master = { confirmed_facts: [], supported_interpretations: [], author_opinions: [] };
const titleInput = {
  stage: "final_after_body", platform: "xiaohongshu", content_master: master,
  completed_content: { body: "locked" }, preliminary_titles: [{ title: "初拟标题" }],
  content_task_brief: { purpose: "guide" }, same_account_title_signals: []
};
const titleEnvelope = contractExample("PlatformTitleList@1.0");
assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "generate-platform-titles", platform: "xiaohongshu", outputContract: "PlatformTitleList@1.0",
  runtimeOutput: titleEnvelope, sourceContentMaster: master, sourceTitleInput: titleInput, sourceSkillInput: titleInput
}));
const domainOnly = structuredClone(titleEnvelope);
domainOnly.data.candidates[0].scores.overall = 0;
assert.equal(validateContract("PlatformTitleList@1.0", domainOnly).valid, true, "Gateway must remain structural");
assert.throws(() => validateUnifiedSkillDomainOutput({
  capability: "generate-platform-titles", platform: "xiaohongshu", outputContract: "PlatformTitleList@1.0",
  runtimeOutput: domainOnly, sourceContentMaster: master, sourceTitleInput: titleInput, sourceSkillInput: titleInput
}), (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
  && error.details.fieldPaths.includes("data.candidates[].scores.overall"));

resetLlmRuntimeForTests();
const providerExample = contractExample("PlatformTitleList@1.0");
await invokeLlm({
  task: "unclassified",
  payload: { liveInvocation: { platform: "xiaohongshu", stepId: "title", capability: "generate-platform-titles" } },
  contract: "PlatformTitleList@1.0",
  maxAttempts: 1,
  modelIdentity: { configured: true, provider: "fixture", model: "fixture", profileMode: "default", capabilities: {} },
  adapterFactory: () => ({
    planProfile: () => null,
    invoke: async () => ({ data: providerExample, responseId: "fixture-response", usage: null, structuredParse: { mode: "json", topLevelShape: { type: "object", keys: ["status", "data", "warnings", "blocked_reasons"], unknownKeyCount: 0 } } })
  })
});
const telemetry = getLlmRuntimeStatus({ configured: true }).recentCalls[0];
assert.deepEqual(telemetry.correlation, {
  strategyTurnId: null, skillExecutionRecordId: null, contentRunId: null,
  platform: "xiaohongshu", stepId: "title", capability: "generate-platform-titles"
});
assert.equal(JSON.stringify(telemetry).includes("双平台原子内容流程"), false, "telemetry must not expose generated content");

console.log("default Provider contract closure self-test passed");
