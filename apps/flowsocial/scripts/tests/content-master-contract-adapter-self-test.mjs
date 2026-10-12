import assert from "node:assert/strict";
import { adaptCanonicalSkillEnvelope, validateContractSchema } from "../../llm/contracts.mjs";

const candidates = [
  {
    status: "ready",
    contentMasterId: "cm-camel",
    centralThesis: "先盘点流程再选择场景",
    confirmedFacts: [],
    supportedInterpretations: [],
    authorOpinions: [],
    sourceList: []
  },
  {
    status: "success",
    data: {
      content_master_id: "cm-envelope",
      confirmed_facts: [],
      supported_interpretations: [],
      author_opinions: [],
      source_list: []
    }
  }
];

for (const candidate of candidates) {
  const adapted = adaptCanonicalSkillEnvelope("ContentMaster@2.0", candidate);
  assert.equal(adapted.adapted, true);
  assert.equal(validateContractSchema("ContentMaster@2.0", adapted.value).valid, true);
  assert.ok(adapted.value.data.content_master_id);
  assert.ok(Array.isArray(adapted.value.data.confirmed_facts));
}

console.log("content-master-contract-adapter-self-test: ok");
