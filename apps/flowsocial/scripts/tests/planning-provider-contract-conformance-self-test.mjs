import assert from "node:assert/strict";
import { executeSkill } from "../../skill-runtime.mjs";
import { contractExample, validateContract } from "../../llm/contracts.mjs";
import { OpenAICompatibleAdapter } from "../../llm/provider-adapters.mjs";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  createContentOutlineStrictSequenceContract,
  validateUnifiedSkillDomainOutput
} from "../../content-agent/unified-skill-output-contracts.mjs";

const clone = structuredClone;
const unitIds = ["foundation", "diagnosis", "method", "boundary"];
const intentBase = {
  id: "intent:planning-provider-conformance",
  structureType: "ordered_framework",
  requiredUnits: unitIds.map((id) => ({ id, meaning: `Meaning ${id}`, boundary: `Boundary ${id}` })),
  optionalUnits: [],
  orderingPolicy: { mode: "strict", unitOrder: clone(unitIds) }
};
const structureIntent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
const masterEnvelope = {
  status: "success",
  data: {
    content_master_id: "master:planning-provider-conformance",
    confirmed_facts: [{ fact_id: "fact-1", fact: "A verified planning fact.", source_ids: ["source-1"] }],
    supported_interpretations: [],
    author_opinions: [],
    source_list: [{ source_id: "source-1" }],
    semanticUnitIds: clone(unitIds)
  },
  warnings: [],
  blocked_reasons: []
};

assert.equal(validateContract("ContentMaster@2.0", masterEnvelope).valid, true);

const capturedRequests = [];
let strictSequenceContract = null;
const adapter = new OpenAICompatibleAdapter({
  FLOW_MODEL_NAME: "offline-fixture",
  FLOW_MODEL_BASE_URL: "https://offline.invalid",
  FLOW_MODEL_API_KEY: "offline-fixture-key",
  FLOW_MODEL_PROTOCOL: "openai"
}, "OfflineFixture", async (_url, options) => {
  const body = JSON.parse(options.body);
  const payloadMessage = body.messages.find((message) => message.role === "user");
  const payload = JSON.parse(payloadMessage.content);
  capturedRequests.push({ body, payload });
  const output = payload.expected_contract === "ContentMaster@2.0"
    ? masterEnvelope
    : contractExample("ContentOutline@1.0", payload);
  return {
    id: `offline-response-${capturedRequests.length}`,
    choices: [{ message: { content: JSON.stringify(output) } }],
    usage: null
  };
});
const generateText = (payload) => adapter.invoke({ payload, contract: payload.expected_contract, attempt: 1 });

const masterResult = await executeSkill({
  skillName: "build-content-master",
  input: { structureIntent },
  generateText,
  expectedContract: "ContentMaster@2.0"
});
const verifiedMaster = validateUnifiedSkillDomainOutput({
  capability: "build-content-master",
  platform: "shared",
  outputContract: "ContentMaster@2.0",
  runtimeOutput: masterResult.data,
  sourceSkillInput: { structureIntent }
});
const contentMaster = verifiedMaster.contentMaster;
strictSequenceContract = createContentOutlineStrictSequenceContract(contentMaster);
assert.equal(strictSequenceContract.slots.length, 4);

const xhsInput = { platform: "xiaohongshu", strict_sequence_contract: strictSequenceContract, presentation_section_plan: [
  { kind: "core", slotIds: ["core-slot:1"] }, { kind: "core", slotIds: ["core-slot:2"] },
  { kind: "core", slotIds: ["core-slot:2"] }, { kind: "core", slotIds: ["core-slot:3"] },
  { kind: "core", slotIds: ["core-slot:4"] }, { kind: "supplemental", anchorId: "supplemental-anchor:4" }
] };
const wechatInput = { platform: "wechat_official_account", strict_sequence_contract: strictSequenceContract };
const xhsResult = await executeSkill({
  skillName: "generate-content-outline",
  input: xhsInput,
  generateText,
  expectedContract: "ContentOutline@1.0"
});
const wechatResult = await executeSkill({
  skillName: "generate-content-outline",
  input: wechatInput,
  generateText,
  expectedContract: "ContentOutline@1.0"
});

const xhsExample = contractExample("ContentOutline@1.0", capturedRequests[1].payload);
const wechatExample = contractExample("ContentOutline@1.0", capturedRequests[2].payload);
for (const [platform, example] of [["xiaohongshu", xhsExample], ["wechat", wechatExample]]) {
  assert.equal(example.data.platform, platform);
  assert.ok(example.data.sections.length >= 4);
  assert.equal(validateContract("ContentOutline@1.0", example).valid, true);
  assert.ok(example.data.sections.every((section) => section.sequencePlacement));
  assert.ok(example.data.sections.every((section) => !Object.hasOwn(section, "masterUnitIds")));
  assert.ok(example.data.sections.every((section) => !Object.hasOwn(section, "masterUnitRefs")));
  assert.ok(example.data.sections.every((section) => !Object.hasOwn(section, "adaptationType")));
  assert.ok(!JSON.stringify(example).includes("unitHash"));
}
assert.ok(capturedRequests[1].body.messages[0].content.includes(JSON.stringify(xhsExample)));
assert.ok(capturedRequests[1].body.messages.some((message) => message.content.includes("XHS CARDINALITY HARD CONSTRAINT")));
assert.ok(capturedRequests[1].body.messages.some((message) => message.content.includes("exactly 6 data.sections")));
assert.ok(capturedRequests[2].body.messages[0].content.includes(JSON.stringify(wechatExample)));
assert.equal(capturedRequests[1].body.messages[0].content.includes(JSON.stringify(wechatExample)), false);

const nonStrictExample = contractExample("ContentOutline@1.0", { input: { platform: "xiaohongshu" } });
assert.ok(nonStrictExample.data.sections.every((section) => Array.isArray(section.masterUnitIds)));
assert.ok(nonStrictExample.data.sections.every((section) => !Object.hasOwn(section, "sequencePlacement")));

function assertOutlineInvalid(label, mutate) {
  const candidate = clone(nonStrictExample);
  mutate(candidate);
  const validation = validateContract("ContentOutline@1.0", candidate);
  assert.equal(validation.valid, false, label);
  assert.ok(validation.errors.length > 0, `${label}: validation must explain the failure`);
}

assert.equal(validateContract("ContentOutline@1.0", {}).valid, false, "empty object must fail");
assertOutlineInvalid("wrong status", (value) => { value.status = "success"; });
assertOutlineInvalid("wrong platform", (value) => { value.data.platform = "wechat_official_account"; });
assertOutlineInvalid("too few sections", (value) => { value.data.sections = value.data.sections.slice(0, 2); });
assertOutlineInvalid("empty key field", (value) => { value.data.topic = " "; });
assertOutlineInvalid("bad section shape", (value) => { value.data.sections[0].key_points = null; });
assertOutlineInvalid("confirmation not true", (value) => { value.data.confirmation_required = false; });

for (const request of capturedRequests) {
  assert.ok(request.payload.skill_instructions.trim());
  assert.ok(request.payload.skill_contract.trim());
  assert.ok(Array.isArray(request.payload.skill_reference_bundle));
  assert.ok(request.payload.skill_reference_bundle.length > 0);
}
assert.equal(capturedRequests[1].payload.input.platform, "xiaohongshu");
assert.equal(capturedRequests[2].payload.input.platform, "wechat_official_account");

assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "generate-content-outline",
  platform: "xiaohongshu",
  outputContract: "ContentOutline@1.0",
  runtimeOutput: xhsResult.data,
  sourceSkillInput: xhsInput,
  sourceContentMaster: contentMaster
}));
assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "generate-content-outline",
  platform: "wechat",
  outputContract: "ContentOutline@1.0",
  runtimeOutput: wechatResult.data,
  sourceSkillInput: wechatInput,
  sourceContentMaster: contentMaster
}));

assert.equal(capturedRequests.length, 3, "planning closure must use exactly three offline transports");
console.log(JSON.stringify({
  status: "planning-provider-contract-conformance-self-test passed",
  validatedPlanningCalls: ["content-master", "xiaohongshu-outline", "wechat-outline"],
  invalidOutlineFixtures: 7,
  offlineTransportInvocations: capturedRequests.length,
  realProviderCalls: 0,
  retries: 0,
  networkCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0,
  publicationWrites: 0,
  feedbackWrites: 0
}, null, 2));
