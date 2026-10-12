import assert from "node:assert/strict";
import { DeepSeekAdapter, buildSecretSafeProviderRequestSnapshot } from "../../llm/provider-adapters.mjs";
import { resolveLlmProfile, resolveLlmTaskBudget } from "../../llm/task-registry.mjs";

const sections = ["hook", "problem", "diagnosis", "evidence", "method", "action"].map((outlineRole, index) => ({ sectionId: `S${index + 1}`, outlineRole }));
const payload = { input: { outline_cardinality: { sectionCount: 6, sectionOrder: sections }, confirmed_outline: { sections } }, contract: "XhsCarouselPlanCreativeOutput@1.0", task: "plan_xhs_carousel" };
const profile = resolveLlmProfile("xhs_carousel_creative_draft");
const budget = resolveLlmTaskBudget("plan_xhs_carousel");
assert.equal(profile.temperature, 0.4);
assert.equal(profile.reasoning.enabled, false);
assert.equal(profile.maxOutputTokens, 8192);
const snapshot = buildSecretSafeProviderRequestSnapshot({ payload, contract: payload.contract, profile, capabilities: { jsonObject: true, structuredOutput: "json_object", reasoningControl: "thinking_toggle", thinkingToggle: true }, taskBudget: budget });
assert.equal(snapshot.profile.structuredOutput, "json_object");
assert.equal(snapshot.profile.maxOutputTokens, 8192);
assert.equal(snapshot.profile.reasoning.applied, "disabled");
assert.match(snapshot.messages.find((m) => m.content.includes("CARDINALITY"))?.content || "", /exactly 6 creative section drafts/);

let captured = null;
const adapter = new DeepSeekAdapter({ FLOW_MODEL_PROVIDER: "DeepSeek", FLOW_MODEL_NAME: "deepseek-chat", FLOW_MODEL_BASE_URL: "https://example.invalid", FLOW_MODEL_API_KEY: "redacted" }, async (_url, options) => {
  captured = JSON.parse(options.body);
  return { id: "offline", choices: [{ message: { content: JSON.stringify({ status: "success", data: { sections } }) } }] };
});
const result = await adapter.invoke({ payload, contract: payload.contract, profile, taskBudget: budget });
assert.equal(result.data.status, "success");
assert.equal(captured.model, "deepseek-chat");
assert.equal(captured.temperature, 0.4);
assert.equal(captured.max_tokens, 8192);
assert.deepEqual(captured.response_format, { type: "json_object" });
assert.deepEqual(captured.thinking, { type: "disabled" });
assert.equal(JSON.stringify(captured).includes("redacted"), false);
console.log(JSON.stringify({ status: "xhs carousel provider empty-response fix self-test passed", providerCalls: 0, externalEffects: 0 }, null, 2));
