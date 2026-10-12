import assert from "node:assert/strict";
import { invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import { buildProviderMessages } from "../../llm/provider-adapters.mjs";
import { adaptCanonicalSkillEnvelope, validateContractSchema } from "../../llm/contracts.mjs";

const identity = { configured: true, provider: "offline-test", model: "offline-test", baseUrl: "https://provider.invalid" };
const draft = {
  article_markdown: "## 起点\n正文\n## 方法\n正文\n## 下一步\n正文",
  title_candidates: ["标题一", "标题二", "标题三"],
  outline: [{ heading: "起点" }, { heading: "方法" }, { heading: "下一步" }],
  information_gain: "把已确认的大纲转换为一篇可以进入独立审稿环节的完整草稿"
};

const narrativeMessages = buildProviderMessages({
  payload: { task: "write_wechat_narrative_creative_draft", input: {} },
  contract: "WechatArticle@2.0",
  attempt: 1
});
assert.match(narrativeMessages.map((item) => item.content).join("\n"), /return one JSON INSTANCE/);
assert.match(narrativeMessages.map((item) => item.content).join("\n"), /root must contain exactly status, data, warnings, blocked_reasons/);

const projectedReview = adaptCanonicalSkillEnvelope("WechatArticleReview@1.0", {
  status: "success",
  data: {
    decision: "revise",
    findings: [{ finding_id: "F1", category: "voice", location: "opening", severity: "suggestion", issue: "偏长", required_action: "压缩", claim_ids: [], model_note: "remove me" }],
    patches: [], changes: [], fact_recheck_required: false, publish_time_checks: []
  },
  warnings: ["editorial_suggestion"],
  blocked_reasons: []
});
assert.equal(projectedReview.value.status, "success");
assert.deepEqual(projectedReview.value.warnings, []);
assert.equal(Object.hasOwn(projectedReview.value.data.findings[0], "model_note"), false);
assert.equal(validateContractSchema("WechatArticleReview@1.0", projectedReview.value).valid, true);

function adapterFor(value) {
  return () => ({
    async invoke() {
      return { data: structuredClone(value), usage: { total_tokens: 1 }, responseId: "offline-response" };
    }
  });
}

async function invoke(value) {
  resetLlmRuntimeForTests();
  return invokeLlm({
    task: "write_wechat_narrative_creative_draft",
    payload: { contract: "WechatArticle@2.0" },
    fallback: { status: "failed", data: {}, warnings: [], blocked_reasons: ["fallback"] },
    contract: "WechatArticle@2.0",
    maxAttempts: 1,
    adapterFactory: adapterFor(value),
    modelIdentity: identity,
    retryDelay: async () => {},
    traceId: "wechat-review-routing-test"
  });
}

const reviewable = await invoke({ status: "needs_review", data: draft, warnings: ["editorial_review"], blocked_reasons: [] });
assert.equal(reviewable.mode, "live");
assert.equal(reviewable.data.status, "success");
assert.ok(reviewable.data.warnings.includes("provider_draft_requires_independent_review"));
assert.deepEqual(reviewable.data.data, draft);

const blocked = await invoke({ status: "needs_review", data: draft, warnings: [], blocked_reasons: ["factual_blocker"] });
assert.equal(blocked.data.status, "needs_review");
assert.deepEqual(blocked.data.blocked_reasons, ["factual_blocker"]);

console.log("wechat narrative review routing self-test passed");
