import assert from "node:assert/strict";
import {
  projectUnifiedOrchestrationRecovery,
  projectUnifiedStagedBootstrapError
} from "../../content-agent/unified-skill-output-contracts.mjs";

function stageError(overrides = {}) {
  return Object.assign(new Error("provider text sk-live-do-not-project"), {
    name: "UnifiedOrchestrationStageError",
    code: "UNIFIED_ORCHESTRATION_STAGE_FAILED",
    recoverable: true,
    stage: "outline",
    platform: "xiaohongshu",
    stepId: "outline",
    capability: "generate-outline",
    recoverableFrom: "outline",
    causeCode: "OUTLINE_ADAPTATION_SUPPLEMENTAL_INVALID",
    fieldPaths: [
      "$.data.pages",
      "$.data.pages[].takeaway",
      "$.data.pages[0].text_layers",
      "data.sections[].masterUnitRefs",
      "data.structureIntent.orderingPolicy",
      "data.sections[].adaptationType",
      "data.sections[].masterUnitRefs",
      "provider.raw_json",
      "input.prompt"
    ],
    details: {
      prompt: "private prompt",
      input: { apiKey: "sk-live-do-not-project" },
      rawProviderJson: { completion: "private model output" },
      stack: "private provider stack"
    },
    ...overrides
  });
}

const xhs = projectUnifiedStagedBootstrapError(stageError(), "CREATE_FALLBACK");
assert.deepEqual(xhs, {
  error: "Unified content planning stage failed",
  code: "UNIFIED_ORCHESTRATION_STAGE_FAILED",
  recovery: {
    stage: "outline",
    platform: "xiaohongshu",
    stepId: "outline",
    capability: "generate-outline",
    recoverableFrom: "outline",
    causeCode: "OUTLINE_ADAPTATION_SUPPLEMENTAL_INVALID",
    fieldPaths: [
      "data.deck.pages",
      "data.deck.pages[].takeaway",
      "data.deck.pages[].text_layers",
      "data.sections[].masterUnitRefs",
      "data.structureIntent.orderingPolicy",
      "data.sections[].adaptationType"
    ]
  }
});

const serialized = JSON.stringify(xhs);
for (const unsafe of ["details", "prompt", "input", "rawProviderJson", "completion", "stack", "sk-live-do-not-project", "provider.raw_json"]) {
  assert.equal(serialized.includes(unsafe), false, `recoverable response exposed ${unsafe}`);
}

for (const causeCode of [
  "OUTLINE_ADAPTATION_MAPPING_INVALID",
  "OUTLINE_ADAPTATION_SUPPLEMENTAL_INVALID",
  "OUTLINE_ADAPTATION_CARDINALITY_INVALID",
  "OUTLINE_ADAPTATION_REPEATED_SINGLE_REF_INVALID",
  "OUTLINE_ADAPTATION_LONE_SPLIT_INVALID"
]) {
  assert.equal(projectUnifiedOrchestrationRecovery(stageError({ causeCode })).causeCode, causeCode);
}

const wechat = projectUnifiedOrchestrationRecovery(stageError({ platform: "wechat" }));
assert.equal(wechat.platform, "wechat");

const master = projectUnifiedOrchestrationRecovery(stageError({
  stage: "master",
  platform: null,
  stepId: "content_master",
  capability: "build-content-master",
  recoverableFrom: "content_master"
}));
assert.equal(master.platform, null);

const unsafeCause = projectUnifiedOrchestrationRecovery(stageError({
  causeCode: "sk-live-do-not-project",
  fieldPaths: ["data.semanticUnitIds", "secret.apiKey"]
}));
assert.equal(unsafeCause.causeCode, "DEPENDENCY_FAILED");
assert.deepEqual(unsafeCause.fieldPaths, ["data.semanticUnitIds"]);
assert.equal(JSON.stringify(unsafeCause).includes("sk-live"), false);

const validationError = Object.assign(new Error("legacy validation message"), {
  code: "LEGACY_VALIDATION_CODE",
  details: { field: "companyId" }
});
assert.deepEqual(projectUnifiedStagedBootstrapError(validationError, "ACTION_FALLBACK"), {
  error: "legacy validation message",
  code: "LEGACY_VALIDATION_CODE",
  details: { field: "companyId" }
});
assert.equal(projectUnifiedOrchestrationRecovery(validationError), null);

console.log("staged bootstrap safe error projection self-test passed");
