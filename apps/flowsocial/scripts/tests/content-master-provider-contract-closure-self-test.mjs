import assert from "node:assert/strict";
import { loadSkillDefinition } from "../../skill-runtime.mjs";
import { contractExample, validateContract } from "../../llm/contracts.mjs";
import { OpenAICompatibleAdapter } from "../../llm/provider-adapters.mjs";

const clone = structuredClone;
const contract = "ContentMaster@2.0";
const example = contractExample(contract);

assert.deepEqual(Object.keys(example), ["status", "data", "warnings", "blocked_reasons"]);
assert.equal(example.status, "success");
assert.ok(example.data && typeof example.data === "object" && !Array.isArray(example.data));
assert.equal(example.data.confirmed_facts.length, 1);
assert.equal(example.data.confirmed_facts[0].fact_id, "F001");
assert.equal(typeof example.data.confirmed_facts[0].fact, "string");
assert.ok(example.data.confirmed_facts[0].fact.trim());
assert.deepEqual(example.data.confirmed_facts[0].source_ids, ["SRC001"]);
assert.deepEqual(example.data.source_list, [{ source_id: "SRC001" }]);
assert.deepEqual(example.data.semanticUnitIds, ["unit-id"]);
assert.deepEqual(example.warnings, []);
assert.deepEqual(example.blocked_reasons, []);
assert.equal(Object.hasOwn(example.data, "structureIntent"), false);
assert.equal(Object.hasOwn(example.data, "semanticSpine"), false);
assert.equal(Object.hasOwn(example.data, "contentMasterHash"), false);
assert.equal(validateContract(contract, example).valid, true, "Provider example must satisfy its basic contract");

function assertInvalid(label, mutate) {
  const candidate = clone(example);
  mutate(candidate);
  const validation = validateContract(contract, candidate);
  assert.equal(validation.valid, false, label);
  assert.ok(validation.errors.length > 0, `${label}: validation must explain the contract failure`);
}

assert.equal(validateContract(contract, {}).valid, false, "empty object must not remain schema-valid");
assertInvalid("missing fact id", (value) => { delete value.data.confirmed_facts[0].fact_id; });
assertInvalid("empty fact id", (value) => { value.data.confirmed_facts[0].fact_id = ""; });
assertInvalid("empty fact text", (value) => { value.data.confirmed_facts[0].fact = " "; });
assertInvalid("empty source bindings", (value) => { value.data.confirmed_facts[0].source_ids = []; });
assertInvalid("non-string source binding", (value) => { value.data.confirmed_facts[0].source_ids = [null]; });
assertInvalid("malformed semantic unit ids", (value) => { value.data.semanticUnitIds = "unit-id"; });
assertInvalid("non-string semantic unit id", (value) => { value.data.semanticUnitIds = [null]; });

const historical = clone(example);
delete historical.data.semanticUnitIds;
assert.equal(
  validateContract(contract, historical).valid,
  true,
  "basic Provider contract must preserve historical no-intent compatibility"
);

const skill = loadSkillDefinition("build-content-master");
assert.ok(skill.instructions.includes("稳定且非空"), "concise Skill instructions must state business-ID ownership");
assert.ok(skill.contract.includes('"source_ids": ["SRC001"]'), "reference example must use a non-empty source binding");
assert.equal(skill.contract.includes('"source_ids": []'), false, "reference must not retain the contradictory empty-source example");

let capturedRequest = null;
const adapter = new OpenAICompatibleAdapter({
  FLOW_MODEL_NAME: "offline-fixture",
  FLOW_MODEL_BASE_URL: "https://offline.invalid",
  FLOW_MODEL_API_KEY: "offline-fixture-key",
  FLOW_MODEL_PROTOCOL: "openai"
}, "OfflineFixture", async (_url, options) => {
  capturedRequest = JSON.parse(options.body);
  return {
    id: "offline-response",
    choices: [{ message: { content: JSON.stringify(example) } }],
    usage: null
  };
});
const parsed = await adapter.invoke({ payload: { fixture: true }, contract, attempt: 1 });
assert.deepEqual(parsed.data, example, "Provider parser must preserve business IDs and source bindings without materialization");
assert.ok(
  capturedRequest.messages[0].content.includes(JSON.stringify(example)),
  "Provider-facing system prompt must receive the complete ContentMaster example"
);

console.log(JSON.stringify({
  status: "content-master-provider-contract-closure-self-test passed",
  validProviderExamples: 1,
  invalidContractFixtures: 8,
  historicalNoIntentFixtures: 1,
  businessIdentityMaterializations: 0,
  offlineTransportInvocations: 1,
  realProviderCalls: 0,
  retries: 0,
  networkCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
