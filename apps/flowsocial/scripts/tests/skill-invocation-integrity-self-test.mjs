import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { executeSkill, hashSkillEvidence, loadSkillDefinition, validateSkillBundleDeclaration } from "../../skill-runtime.mjs";
import { buildSkillExecutionPlan } from "../../content-agent/skill-execution-plan.mjs";
import { runContentSkill } from "../../content-agent/skill-runner.mjs";

assert.equal(hashSkillEvidence({ b: 2, a: 1 }), hashSkillEvidence({ a: 1, b: 2 }));

const xhsWriter = loadSkillDefinition("write-xhs-content");
assert.equal(xhsWriter.declared.lifecycle, "stable");
assert.deepEqual(xhsWriter.referenceBundle.map((item) => item.path), ["SKILL.md", "references/contract.md", "references/xhs-platform-playbook.md"]);
assert.match(xhsWriter.bundleHash, /^[a-f0-9]{64}$/);

const manifestPath = fileURLToPath(new URL("../../skills/skill-manifest.json", import.meta.url));
const registered = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf8"));
for (const skill of [...registered.p0, ...registered.p1]) {
  assert.ok(skill.lifecycle, `${skill.capability} must declare lifecycle`);
  assert.ok(skill.reference_bundle?.includes("SKILL.md"), `${skill.capability} must declare its bundle`);
  loadSkillDefinition(skill.capability);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "flowsocial-skill-bundle-"));
try {
  const skillFolder = join(temporaryRoot, "sample");
  mkdirSync(skillFolder);
  writeFileSync(join(skillFolder, "SKILL.md"), "test", "utf8");
  assert.throws(() => validateSkillBundleDeclaration({ skillName: "sample", folder: skillFolder, bundleFiles: ["SKILL.md", "missing.md"] }), /文件不存在/);
  assert.throws(() => validateSkillBundleDeclaration({ skillName: "sample", folder: skillFolder, bundleFiles: ["SKILL.md", "../outside.md"] }), /路径越界/);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const runtimeInput = { nested: { b: 2, a: 1 } };
const runtime = await executeSkill({
  skillName: "generate-platform-titles",
  input: runtimeInput,
  generateText: async (request) => {
    assert.ok(request.skill_reference_bundle.length >= 2);
    assert.equal(request.skill_runtime.bundle_hash, loadSkillDefinition("generate-platform-titles").bundleHash);
    return { mode: "fixture", data: { status: "success", candidates: [] } };
  }
});
assert.equal(runtime.skillTrace.inputHash, hashSkillEvidence(runtimeInput));
assert.equal(runtime.skillTrace.outputHash, hashSkillEvidence(runtime.data));

const plan = buildSkillExecutionPlan({ platform: "xiaohongshu", sourcePlan: { sources: [] } });
const titleStep = plan.steps.find((step) => step.id === "title");
await assert.rejects(() => runContentSkill({
  capability: "generate-platform-titles",
  platform: "xiaohongshu",
  input: {},
  generateText: async () => ({ mode: "fixture", data: {} }),
  planAuthorization: "strict"
}), (error) => error.code === "SKILL_STEP_NOT_PLANNED");

const legacy = await runContentSkill({
  capability: "generate-platform-titles",
  platform: "xiaohongshu",
  input: { content: "fixture" },
  generateText: async () => ({ mode: "mock", data: { status: "success", candidates: [] } })
});
assert.equal(legacy.skillTrace.planAuthorization, "legacy_unplanned");
assert.equal(legacy.executionRecord.planAuthorization, "legacy_unplanned");
assert.equal(legacy.executionRecord.executionMode, "mock_fixture");
assert.equal(legacy.executionRecord.productionEligibleOutput, false);
for (const field of ["bundleHash", "inputHash", "outputHash", "executionPlanHash"]) assert.match(legacy.executionRecord[field], /^[a-f0-9]{64}$/);

const planned = await runContentSkill({
  capability: "generate-platform-titles",
  platform: "xiaohongshu",
  input: { content: "real" },
  generateText: async () => ({ mode: "provider", data: { status: "success", candidates: [] } }),
  planStep: titleStep,
  executionPlan: plan,
  planAuthorization: "strict"
});
assert.equal(planned.executionRecord.planAuthorization, "planned");
assert.equal(planned.executionRecord.executionMode, "real");
assert.equal(planned.executionRecord.productionEligibleOutput, true);
assert.equal(planned.executionRecord.executionPlanHash, hashSkillEvidence(plan));

const recovery = await runContentSkill({
  capability: "write-xhs-content",
  platform: "xiaohongshu",
  input: { partial: true },
  expectedContract: "XhsPostBodyRecovery@1.0",
  generateText: async () => ({ mode: "provider", data: { status: "success", body: "recovered" } }),
  planStep: plan.steps.find((step) => step.id === "platform_writer")
});
assert.equal(recovery.skillTrace.expectedContract, "XhsPostBodyRecovery@1.0");
assert.equal(recovery.executionRecord.outputContract, "XhsPostBodyRecovery@1.0");

const fallback = await runContentSkill({
  capability: "generate-platform-titles",
  platform: "xiaohongshu",
  input: {},
  fallback: { candidates: [] },
  generateText: async () => { throw new Error("offline failure"); },
  planStep: titleStep
});
assert.equal(fallback.executionRecord.executionMode, "fallback");
assert.equal(fallback.executionRecord.productionEligibleOutput, false);

console.log(JSON.stringify({ status: "skill-invocation-integrity-self-test passed", registered: registered.p0.length + registered.p1.length }));
