import assert from "node:assert/strict";
import { executeSkill, getSkillRuntimeStatus, loadSkillDefinition } from "../../skill-runtime.mjs";

const status = getSkillRuntimeStatus();
assert.ok(status.registered.includes("generate-keyword-topics"));
assert.ok(status.registered.includes("write-xhs-content"));
const definition = loadSkillDefinition("rank-and-gate-topics");
assert.match(definition.instructions, /独立主编审核节点/);
assert.match(definition.contract, /TopicGateReview@1.0/);
assert.equal(definition.declared.lifecycle, "stable");
assert.deepEqual(definition.referenceBundle.map((item) => item.path), ["SKILL.md", "references/contract.md"]);
assert.match(definition.bundleHash, /^[a-f0-9]{64}$/);

let received;
const result = await executeSkill({
  skillName: "generate-keyword-topics",
  input: { keyword_event_clusters: [] },
  expectedContract: "KeywordTopicCandidateList@1.0",
  task: "test_skill_runtime",
  generateText: async (request) => {
    received = request;
    return { mode: "test", data: { status: "success", data: { topics: [] } } };
  }
});
assert.equal(received.skill_runtime.skill_name, "generate-keyword-topics");
assert.match(received.skill_instructions, /生成关键词母选题/);
assert.match(received.skill_contract, /KeywordTopicCandidateList@1.0/);
assert.deepEqual(received.skill_reference_bundle.map((item) => item.path), ["SKILL.md", "references/contract.md"]);
assert.equal(result.skillTrace.skillName, "generate-keyword-topics");
assert.match(result.skillTrace.inputHash, /^[a-f0-9]{64}$/);
assert.match(result.skillTrace.outputHash, /^[a-f0-9]{64}$/);
console.log(JSON.stringify({ status: "passed", registered: status.registered.length, version: result.skillTrace.skillVersion }));

