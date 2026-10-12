import assert from "node:assert/strict";
import { validateContract, validateContractSchema } from "../../llm/contracts.mjs";

const section = (index, mapping = { masterUnitIds: [`u${index}`] }) => ({
  section_id: `s${index}`, heading: `Heading ${index}`, role: index === 1 ? "hook" : "method",
  objective: `Objective ${index}`, key_points: [`Point ${index}`], claim_ids: [`claim-${index}`],
  boundary: `Boundary ${index}`, ...mapping
});
const outline = (platform, count = platform === "xiaohongshu" ? 6 : 3) => ({
  status: "ready", data: {
    outline_id: `outline:${platform}`, schema_version: "1.0", platform, topic: "Topic",
    content_promise: "Promise", content_function: "discovery", content_purpose_id: "purpose",
    conversion_stage_id: "stage", opening_strategy: "Open", sections: Array.from({ length: count }, (_, i) => section(i + 1)),
    closing_strategy: "Close", unresolved_questions: [], confirmation_required: true
  }, warnings: [], blocked_reasons: []
});

for (const platform of ["xiaohongshu", "wechat"]) {
  const result = validateContract("ContentOutline@1.0", outline(platform));
  assert.equal(result.valid, true);
  assert.deepEqual(result.validationFieldPaths, []);
  assert.deepEqual(validateContractSchema("ContentOutline@1.0", outline(platform)).validationFieldPaths, []);
}

for (const count of [4, 5, 11]) {
  const result = validateContract("ContentOutline@1.0", outline("xiaohongshu", count));
  assert.equal(result.valid, false);
  assert(result.validationFieldPaths.includes("data.sections.length"));
}

const missing = outline("wechat");
delete missing.data.topic; delete missing.warnings; delete missing.data.sections[0].claim_ids;
const missingResult = validateContract("ContentOutline@1.0", missing);
assert(missingResult.validationFieldPaths.includes("data.topic"));
assert(missingResult.validationFieldPaths.includes("warnings"));
assert(missingResult.validationFieldPaths.includes("data.sections[0].claim_ids"));
assert.equal(new Set(missingResult.validationFieldPaths).size, missingResult.validationFieldPaths.length);

const badRole = outline("wechat");
badRole.data.sections[1].role = "invalid-role";
badRole.data.sections[1].heading = 42;
const badRoleResult = validateContract("ContentOutline@1.0", badRole);
assert(badRoleResult.validationFieldPaths.includes("data.sections[1].role"));
assert(badRoleResult.validationFieldPaths.includes("data.sections[1].heading"));

const rootResult = validateContract("ContentOutline@1.0", null);
assert.deepEqual(rootResult.validationFieldPaths, ["$"]);
console.log(JSON.stringify({ status: "content-outline-gateway-field-paths-self-test passed", providerCalls: 0, externalEffects: 0 }, null, 2));
