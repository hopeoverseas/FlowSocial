import assert from "node:assert/strict";
import { buildProviderMessages } from "../../llm/provider-adapters.mjs";
import { createUnifiedAtomicSkillActivityExecutionPort } from "../../content-agent/unified-skill-activity-executor.mjs";

const sections = [
  { sectionId: "s1", outlineRole: "hook" },
  { sectionId: "s2", outlineRole: "problem" },
  { sectionId: "s3", outlineRole: "action" }
];
const payload = { input: { confirmed_outline: { sections }, outline_cardinality: { sectionCount: 3, sectionOrder: sections } } };
const messages = buildProviderMessages({ payload, contract: "XhsCarouselPlanCreativeOutput@1.0", attempt: 1 });
assert.ok(messages.some((item) => item.content.includes("exactly 3 creative pages")));
assert.ok(messages.some((item) => item.content.includes("1:s1/hook, 2:s2/problem, 3:s3/action")));
assert.ok(messages.some((item) => item.content.includes("Runtime owns page IDs")));

let providerCalled = false;
const executor = createUnifiedAtomicSkillActivityExecutionPort({
  generateText: async () => { providerCalled = true; },
  evidenceCompiler: {}
});
await assert.rejects(
  () => executor({
    capability: "plan-xhs-carousel",
    input: { confirmed_outline: { sections }, outline_cardinality: { sectionCount: 2, sectionOrder: sections.slice(0, 2) } },
    systemContext: {},
    step: { id: "carousel", kind: "skill", capability: "plan-xhs-carousel" },
    executionPlan: {}
  }),
  (error) => error.code === "UNIFIED_XHS_OUTLINE_CARDINALITY_DRIFT"
);
assert.equal(providerCalled, false);
console.log("xhs carousel Provider cardinality binding self-test passed");
