import assert from "node:assert/strict";
import { runContentSkill } from "../../content-agent/skill-runner.mjs";
import { sanitizeUnifiedSkillValidationFieldPaths } from "../../content-agent/unified-skill-output-contracts.mjs";

async function captureRunnerError(sourceError) {
  let calls = 0;
  let rejection = null;
  try {
    await runContentSkill({
      capability: "plan-xhs-carousel",
      platform: "xiaohongshu",
      input: { fixture: "safe-field-path-propagation" },
      maxAttempts: 1,
      generateText: async () => {
        calls += 1;
        throw sourceError;
      }
    });
  } catch (error) {
    rejection = error;
  }
  assert.equal(calls, 1, "runner must make one attempt with zero retry");
  assert(rejection);
  return rejection;
}

const sourcePaths = [
  "$.data.pages[0].text_layers",
  "$.system.secret",
  42,
  "x".repeat(241),
  ...Array.from({ length: 40 }, (_, index) => `$.data.pages[${index}].takeaway`)
];
const atomic = await captureRunnerError(Object.assign(new Error("raw provider message"), {
  code: "XHS_ATOMIC_SKILL_OUTPUT_INVALID",
  details: {
    fieldPaths: sourcePaths,
    raw: "raw provider output",
    candidateData: { secret: true },
    validationErrors: ["private"]
  },
  raw: "top-level raw",
  candidateData: { private: true }
}));

assert.equal(atomic.code, "XHS_ATOMIC_SKILL_OUTPUT_INVALID");
assert.equal(atomic.fieldPaths.length, 32);
assert.deepEqual(atomic.fieldPaths.slice(0, 2), ["$.data.pages[0].text_layers", "$.system.secret"]);
assert.notStrictEqual(atomic.fieldPaths, sourcePaths);
sourcePaths[0] = "mutated-after-projection";
assert.equal(atomic.fieldPaths[0], "$.data.pages[0].text_layers");
assert.deepEqual(sanitizeUnifiedSkillValidationFieldPaths(atomic.fieldPaths), [
  "data.deck.pages[].text_layers",
  "data.deck.pages[].takeaway"
]);

const serialized = JSON.stringify(atomic);
for (const unsafe of ["details", "raw provider", "candidateData", "validationErrors", "top-level raw", "private"]) {
  assert.equal(serialized.includes(unsafe), false, `sanitized runner error exposed ${unsafe}`);
}

const authority = await captureRunnerError(Object.assign(new Error("authority raw"), {
  code: "XHS_ATOMIC_SKILL_AUTHORITY_INVALID",
  details: { fieldPaths: ["$.data.pages", "$.input.prompt"] }
}));
assert.deepEqual(authority.fieldPaths, ["$.data.pages", "$.input.prompt"]);

const nonAtomic = await captureRunnerError(Object.assign(new Error("generic raw"), {
  code: "SOME_OTHER_ERROR",
  details: { fieldPaths: ["$.data.pages"] }
}));
assert.equal(Object.hasOwn(nonAtomic, "fieldPaths"), false);

console.log("Skill runner safe field-path propagation self-test passed");
