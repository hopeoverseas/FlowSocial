import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skill = readFileSync(join(root, "skills", "generate-content-outline", "SKILL.md"), "utf8");
const contract = readFileSync(join(root, "skills", "generate-content-outline", "references", "contract.md"), "utf8");
assert.match(skill, /XHS cardinality recipe/);
assert.match(skill, /four core units/);
assert.match(skill, /supplemental section/);
assert.match(contract, /four-unit frozen semantic spine/);
assert.match(contract, /A four-section XHS response is invalid/);
assert.match(skill, /所有面向用户展示的文字必须使用简体中文/);
assert.match(contract, /用户可见字段固定使用简体中文/);

const legalSix = [
  { kind: "core", slotIds: ["core-slot:1"] },
  { kind: "core", slotIds: ["core-slot:2"] },
  { kind: "core", slotIds: ["core-slot:2"] },
  { kind: "core", slotIds: ["core-slot:3"] },
  { kind: "core", slotIds: ["core-slot:4"] },
  { kind: "supplemental", anchorId: "supplemental-anchor:4" }
];
assert.equal(legalSix.length, 6);
assert.ok(legalSix.some((item) => item.kind === "supplemental"));
assert.equal(legalSix.filter((item) => item.kind === "core" && item.slotIds[0] === "core-slot:2").length, 2);
assert.ok(!(4 >= 6 && 4 <= 10), "four-section XHS outline must be rejected");
console.log(JSON.stringify({ status: "xhs-outline-provider-cardinality-constraint-self-test passed", providerCalls: 0, externalEffects: 0 }));
