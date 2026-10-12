import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { materializeContentMasterSemanticAuthority, materializeContentOutlineSemanticAuthority, validateUnifiedSkillDomainOutput } from "../../content-agent/unified-skill-output-contracts.mjs";
import { validateContract } from "../../llm/contracts.mjs";

const unit = (id, meaning) => ({ id, meaning, boundary: `${id} boundary` });
const intentBase = { id: "intent:xhs-cardinality", structureType: "four_step", requiredUnits: [unit("u1", "Hook"), unit("u2", "Problem"), unit("u3", "Method"), unit("u4", "Action")], optionalUnits: [], orderingPolicy: { mode: "strict", unitOrder: ["u1", "u2", "u3", "u4"] } };
const intent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
const master = materializeContentMasterSemanticAuthority({ content_master_id: "master:xhs-cardinality", semanticUnitIds: intent.orderingPolicy.unitOrder }, intent);
const section = (index, masterUnitIds) => ({ section_id: `S${index}`, heading: `Heading ${index}`, role: index === 1 ? "hook" : index === 6 ? "action" : "method", objective: `Objective ${index}`, key_points: [`Point ${index}`], claim_ids: [], boundary: `Boundary ${index}`, masterUnitIds });
const outline = (platform, mappings) => ({ outline_id: `outline:${platform}`, schema_version: "1.0", platform, topic: "Topic", content_promise: "Promise", content_function: "discovery", content_purpose_id: "purpose", conversion_stage_id: "stage", opening_strategy: "Open", sections: mappings.map((ids, index) => section(index + 1, ids)), closing_strategy: "Close", unresolved_questions: [], confirmation_required: true });
const envelope = (data) => ({ status: "ready", data, warnings: [], blocked_reasons: [] });
const validMappings = [["u1"], ["u1"], ["u2"], ["u3"], ["u3"], ["u4"]];

const gatewayValid = envelope(outline("xiaohongshu", validMappings));
assert.equal(validateContract("ContentOutline@1.0", gatewayValid).valid, true);
for (const count of [5, 11]) {
  const invalid = structuredClone(gatewayValid);
  invalid.data.sections = Array.from({ length: count }, (_, index) => section(index + 1, [intent.orderingPolicy.unitOrder[Math.min(3, Math.floor(index * 4 / count))]]));
  const result = validateContract("ContentOutline@1.0", invalid);
  assert.equal(result.valid, false); assert(result.errors.some((error) => error.includes("6 to 10")));
}

const canonical = materializeContentOutlineSemanticAuthority(gatewayValid.data, master);
assert.deepEqual(canonical.sections.map((item) => item.adaptationType), ["split", "split", "direct", "split", "split", "direct"]);
assert.deepEqual(canonical.sections.flatMap((item) => item.masterUnitRefs.map((ref) => ref.id)), ["u1", "u1", "u2", "u3", "u3", "u4"]);
const verified = validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: gatewayValid, sourceContentMaster: master });
assert.equal(verified.sections.length, 6);
for (const count of [5, 11]) {
  const mappings = count === 5
    ? [["u1"], ["u2"], ["u3"], ["u3"], ["u4"]]
    : [["u1"], ["u1"], ["u1"], ["u2"], ["u2"], ["u3"], ["u3"], ["u3"], ["u4"], ["u4"], ["u4"]];
  const bad = envelope(outline("xiaohongshu", mappings));
  assert.throws(() => validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: bad, sourceContentMaster: master }), (error) => error.details.fieldPaths.includes("data.sections.length"));
}
for (const field of ["section_id", "objective"]) {
  const duplicate = structuredClone(gatewayValid); duplicate.data.sections[1][field] = duplicate.data.sections[0][field];
  assert.equal(validateContract("ContentOutline@1.0", duplicate).valid, false);
  assert.throws(() => validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: duplicate, sourceContentMaster: master }));
}
const duplicateContent = structuredClone(gatewayValid); for (const field of ["heading", "key_points", "boundary"]) duplicateContent.data.sections[1][field] = structuredClone(duplicateContent.data.sections[0][field]);
assert.equal(validateContract("ContentOutline@1.0", duplicateContent).valid, false);
assert.throws(() => validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: duplicateContent, sourceContentMaster: master }));

const wechat = envelope(outline("wechat", [["u1"], ["u2"], ["u3", "u4"]]));
assert.equal(validateContract("ContentOutline@1.0", wechat).valid, true, "WeChat retains the three-section minimum");
assert.equal(validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "wechat", outputContract: "ContentOutline@1.0", runtimeOutput: wechat, sourceContentMaster: master }).sections.length, 3);
const historical = envelope(outline("xiaohongshu", validMappings));
assert.equal(validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: historical, sourceContentMaster: null }).sections.length, 6);

console.log(JSON.stringify({ status: "xhs-outline-presentation-cardinality-self-test passed", xhsSectionBand: [6, 10], providerCalls: 0, retries: 0, activeDatabaseWrites: 0, browserCalls: 0, imageCalls: 0, platformWrites: 0 }, null, 2));
