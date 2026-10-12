import assert from "node:assert/strict";
const contract = { slots: [1, 2, 3, 4] };
assert.equal(contract.slots.length, 4);
const plan = [
  { kind: "core", slotIds: ["core-slot:1"] },
  { kind: "core", slotIds: ["core-slot:2"] },
  { kind: "core", slotIds: ["core-slot:2"] },
  { kind: "core", slotIds: ["core-slot:3"] },
  { kind: "core", slotIds: ["core-slot:4"] },
  { kind: "supplemental", anchorId: "supplemental-anchor:4" }
];
assert.equal(plan.length, 6);
assert.equal(plan[5].kind, "supplemental");
assert.deepEqual(Object.keys(plan[5]), ["kind", "anchorId"]);
assert.ok(!JSON.stringify(plan).includes("claim"));
console.log(JSON.stringify({ status: "xhs-outline-presentation-plan-input-self-test passed", providerCalls: 0, externalEffects: 0 }));
