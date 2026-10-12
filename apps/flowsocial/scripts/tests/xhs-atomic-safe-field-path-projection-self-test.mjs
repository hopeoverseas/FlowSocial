import assert from "node:assert/strict";
import {
  projectUnifiedOrchestrationRecovery,
  sanitizeUnifiedSkillValidationFieldPaths
} from "../../content-agent/unified-skill-output-contracts.mjs";

const projected = sanitizeUnifiedSkillValidationFieldPaths([
  "$.data.pages",
  "$.data.pages[].takeaway",
  "$.data.pages[0].text_layers",
  "data.deck.pages[].takeaway",
  "data.deck.pages[12].text_layers",
  "$",
  "$.system.authority",
  "$.input.prompt",
  "$.data.pages.length",
  "$.data.pages[0].unknown",
  "$.data.pages[0].text_layers.sk-live-secret"
]);

assert.deepEqual(projected, [
  "data.deck.pages",
  "data.deck.pages[].takeaway",
  "data.deck.pages[].text_layers",
  "data",
  "system.authority",
  "data.deck.pages.length"
]);

assert.deepEqual(sanitizeUnifiedSkillValidationFieldPaths(projected), projected, "native safe paths remain idempotent");

const recovery = projectUnifiedOrchestrationRecovery(Object.assign(new Error("raw provider content"), {
  name: "UnifiedOrchestrationStageError",
  recoverable: true,
  stage: "review_render",
  platform: "xiaohongshu",
  stepId: "xhs_carousel",
  capability: "plan-xhs-carousel",
  recoverableFrom: "xhs_carousel",
  causeCode: "XHS_ATOMIC_SKILL_OUTPUT_INVALID",
  fieldPaths: ["$.data.pages[0].text_layers", "$.system.secret", "raw provider content"]
}));

assert.deepEqual(recovery, {
  stage: "review_render",
  platform: "xiaohongshu",
  stepId: "xhs_carousel",
  capability: "plan-xhs-carousel",
  recoverableFrom: "xhs_carousel",
  causeCode: "XHS_ATOMIC_SKILL_OUTPUT_INVALID",
  fieldPaths: ["data.deck.pages[].text_layers"]
});
assert.equal(JSON.stringify(recovery).includes("raw provider content"), false);
assert.equal(JSON.stringify(recovery).includes("secret"), false);

console.log("XHS atomic safe field-path projection self-test passed");
