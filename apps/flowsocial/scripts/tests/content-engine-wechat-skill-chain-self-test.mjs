import assert from "node:assert/strict";
import { buildPreparedSharedContentMaster, runContentPipeline } from "../../content-engine.mjs";

const intentProfile = {
  profile_id: "intent_strict_wechat",
  topic_id: "topic_strict_wechat",
  platform: "wechat",
  purpose: { id: "knowledge_howto", label: "knowledge" },
  promotion: { mode: "none", knowledge_snapshot_id: null },
  engagement_policy: { selected_primary_action: "share" }
};

const master = {
  content_master_id: "shared_master_strict_wechat",
  topic_id: "topic_strict_wechat",
  intent_profile_id: "intent_strict_wechat",
  central_thesis: "A formal Skill chain must keep authority and evidence explicit.",
  reader_value: "A repeatable review and planning workflow.",
  confirmed_facts: [{ fact_id: "F1", fact: "Every downstream stage is independently recorded.", source_ids: ["T1"] }],
  supported_interpretations: [], author_opinions: [], unknowns: [], examples: [], claims_to_avoid: [],
  source_list: [{ source_id: "T1", source_type: "user_temporary_material", excerpt: "Every downstream stage is independently recorded." }],
  engagement_policy: { selected_primary_action: "share" }, publish_time_checks: []
};

const articleMarkdown = [
  `## Authority\n${"The shared master remains the only authority for claims and boundaries. ".repeat(12)}`,
  `## Independent review\n${"An editor evaluates the complete article instead of trusting writer metadata. ".repeat(12)}`,
  `## Formal image planning\n${"A separate planner binds every visual declaration to the approved article. ".repeat(12)}`,
  `## Stop lines\n${"Fallback, mock, invalid schema, and blocked review stop before promotion. ".repeat(10)}`
].join("\n\n");

const writerOutput = {
  status: "success",
  data: {
    article_promise: "Explain a controlled WeChat Skill chain.",
    core_argument: "Independent stages prevent hidden fallback promotion.",
    information_gain: "Separates writer candidates from authoritative review and image planning outputs.",
    title_candidates: ["A controlled WeChat chain", "Why every Skill stage matters", "Stop hidden fallback promotion"],
    recommended_title: "A controlled WeChat chain",
    abstract: "A bounded execution chain.", opening: "A valid file is not yet a valid product result.",
    outline: [{ heading: "Authority" }, { heading: "Independent review" }, { heading: "Formal image planning" }, { heading: "Stop lines" }],
    article_markdown: articleMarkdown,
    pull_quotes: [], key_takeaways: ["one authority", "three formal stages"], share_summary: "Controlled chain", share_reason: "Useful for reviewers",
    engagement_strategy: { primary_action: "share", reason: "team review" }, cta: "Share with the reviewer.",
    claim_map: [{ claim: "Every downstream stage is independently recorded.", source_ids: ["T1"] }], used_knowledge_asset_ids: [],
    image_plan: { cover: { purpose: "writer-only candidate", strategy: "generated_raster", prompt: "candidate only" }, slots: [{ slot_purpose: "writer-only candidate", strategy: "html_chart" }] }
  }
};

const reviewOutput = { status: "success", data: { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] } };
const formalPlan = {
  plan_id: "formal_plan_strict_wechat",
  cover: { asset_id: "formal_cover", purpose: "mood", strategy: "generated_raster", prompt: "editorial workflow, no text, no logo, no watermark" },
  slots: [{ slot_id: "formal_slot_1", after_section_id: "W2", asset_id: "formal_chart", purpose: "explain", strategy: "html_chart", claim_ids: ["F1"], caption: "Formal chain" }]
};

const fullContext = {
  strategySnapshotId: "strategy_strict_wechat",
  directionCard: { matrixRole: "authority", contentFunction: "trust", creativeMechanism: "framework", journeyStage: "trust" }
};
const account = {
  visualStyle: { name: "editorial" }, effectiveStrategy: { voice: "evidence_first" },
  accountContext: { subjectType: "company", accountMode: "official" }, platformInfrastructure: { columns: ["methods"] }
};
const preparedContentMaster = buildPreparedSharedContentMaster(master);

function pipelineInput(overrides = {}) {
  return {
    payload: { platform: "wechat", ideaTitle: "Controlled chain", wechatStrictSkillChain: true, contentExecutionContext: fullContext, ...overrides.payload },
    selection: null,
    intentProfile,
    account: overrides.account || account,
    knowledgeAssets: overrides.knowledgeAssets || [],
    preparedContentMaster: overrides.preparedContentMaster === undefined ? preparedContentMaster : overrides.preparedContentMaster,
    confirmedOutline: null
  };
}

async function runScenario(responses = {}) {
  const calls = [];
  const requests = [];
  const result = await runContentPipeline(pipelineInput(responses.input || {}), {
    generateText: async (request) => {
      calls.push(request.task);
      requests.push(request);
      if (request.task === "write_wechat_article_v2") return responses.writer || { mode: "provider", data: writerOutput, telemetry: { attempts: 1, providerSucceeded: true } };
      if (request.task === "review_wechat_article_content") return responses.review || { mode: "provider", data: reviewOutput, telemetry: { attempts: 1, providerSucceeded: true } };
      if (request.task === "plan_wechat_images") return responses.plan || { mode: "provider", data: { status: "success", data: formalPlan }, telemetry: { attempts: 1, providerSucceeded: true } };
      throw new Error(`unexpected strict WeChat task: ${request.task}`);
    }
  });
  return { result, calls, requests };
}

const normal = await runScenario({ input: { knowledgeAssets: [{ id: "knowledge_doc", kind: "document", name: "Not an image asset" }] } });
assert.equal(normal.result.status, "succeeded");
assert.deepEqual(normal.calls, ["write_wechat_article_v2", "review_wechat_article_content", "plan_wechat_images"]);
assert.equal(normal.result.wechatSkillChain.maxProviderCalls, 3);
assert.equal(normal.result.wechatSkillChain.automaticRetries, 0);
assert.equal(normal.result.wechatSkillChain.stages.length, 3);
assert.equal(normal.result.wechatSkillChain.stages.every((stage) => stage.status === "completed" && stage.maxAttempts === 1), true);
assert.equal(normal.result.contentPackage.image_plan.plan_id, formalPlan.plan_id);
assert.notEqual(normal.result.contentPackage.image_plan.cover.purpose, writerOutput.data.image_plan.cover.purpose);
const planRequest = normal.requests.find((request) => request.task === "plan_wechat_images");
assert.deepEqual(planRequest.input.authorized_assets, [], "knowledge documents must not be passed as authorized images");
for (const request of normal.requests) {
  assert.match(request.skill_runtime.bundle_hash, /^[a-f0-9]{64}$/);
  assert.ok(request.skill_reference_bundle.length >= 2);
}

const missingAuthority = await runScenario({ input: { preparedContentMaster: { status: "ready", data: master } } });
assert.equal(missingAuthority.result.status, "blocked");
assert.equal(missingAuthority.result.qualityReview.blockers.includes("wechat_prepared_shared_master_authority_invalid"), true);
assert.equal(missingAuthority.calls.length, 0);

const incompleteBundle = await runScenario({ input: { account: { visualStyle: { name: "incomplete" } } } });
assert.equal(incompleteBundle.result.status, "blocked");
assert.equal(incompleteBundle.result.qualityReview.blockers.includes("wechat_skill_reference_bundle_incomplete"), true);
assert.equal(incompleteBundle.calls.length, 0);

const invalidImageRegistry = await runScenario({ input: { payload: { wechatAuthorizedImageAssets: [{ id: "doc_as_image", kind: "document", status: "approved" }] } } });
assert.equal(invalidImageRegistry.result.status, "blocked");
assert.equal(invalidImageRegistry.result.qualityReview.blockers.includes("wechat_authorized_image_registry_invalid"), true);
assert.equal(invalidImageRegistry.calls.length, 0);

const approvedImage = { id: "approved_image", kind: "image", mediaType: "image/png", status: "approved", license: { id: "license_1", allowsPublication: true }, source: { ref: "asset_registry:approved_image", sha256: "a".repeat(64) } };
const authorizedImage = await runScenario({ input: { payload: { wechatAuthorizedImageAssets: [approvedImage] }, knowledgeAssets: [{ id: "knowledge_doc", kind: "document" }] } });
assert.equal(authorizedImage.result.status, "succeeded");
assert.deepEqual(authorizedImage.requests.find((request) => request.task === "plan_wechat_images").input.authorized_assets, [approvedImage]);

const mockWriter = await runScenario({ writer: { mode: "mock", data: writerOutput, telemetry: { attempts: 1, providerSucceeded: true } } });
assert.equal(mockWriter.result.status, "blocked");
assert.equal(mockWriter.result.qualityReview.blockers.includes("wechat_writer_real_invocation_required"), true);
assert.deepEqual(mockWriter.calls, ["write_wechat_article_v2"]);

const fallbackWriter = await runScenario({ writer: { mode: "validated_fallback", data: writerOutput, telemetry: { attempts: 1, providerSucceeded: false, fallbackUsed: true } } });
assert.equal(fallbackWriter.result.status, "blocked");
assert.equal(fallbackWriter.result.qualityReview.blockers.includes("wechat_writer_fallback_forbidden"), true);
assert.deepEqual(fallbackWriter.calls, ["write_wechat_article_v2"]);

const fallbackReview = await runScenario({ review: { mode: "validated_fallback", data: reviewOutput, telemetry: { attempts: 1, providerSucceeded: false, fallbackUsed: true } } });
assert.equal(fallbackReview.result.status, "blocked");
assert.equal(fallbackReview.result.qualityReview.blockers.includes("wechat_review_fallback_forbidden"), true);
assert.deepEqual(fallbackReview.calls, ["write_wechat_article_v2", "review_wechat_article_content"]);

const reviewBlock = await runScenario({ review: { mode: "provider", data: { status: "success", data: { ...reviewOutput.data, decision: "block", findings: [{ severity: "blocker", issue: "fixture" }] } }, telemetry: { attempts: 1, providerSucceeded: true } } });
assert.equal(reviewBlock.result.status, "blocked");
assert.deepEqual(reviewBlock.calls, ["write_wechat_article_v2", "review_wechat_article_content"]);

const nonSuccessPlan = await runScenario({ plan: { mode: "provider", data: { status: "needs_review", data: formalPlan }, telemetry: { attempts: 1, providerSucceeded: true } } });
assert.equal(nonSuccessPlan.result.status, "blocked");
assert.equal(nonSuccessPlan.result.qualityReview.blockers.includes("wechat_image_plan_non_success"), true);
assert.deepEqual(nonSuccessPlan.calls, ["write_wechat_article_v2", "review_wechat_article_content", "plan_wechat_images"]);

const mockPlan = await runScenario({ plan: { mode: "mock", data: { status: "success", data: formalPlan }, telemetry: { attempts: 1, providerSucceeded: true } } });
assert.equal(mockPlan.result.status, "blocked");
assert.equal(mockPlan.result.qualityReview.blockers.includes("wechat_image_plan_real_invocation_required"), true);

const invalidPlanSchema = await runScenario({ plan: { mode: "provider", data: { status: "success", data: { ...formalPlan, plan_id: "" } }, telemetry: { attempts: 1, providerSucceeded: true } } });
assert.equal(invalidPlanSchema.result.status, "blocked");
assert.equal(invalidPlanSchema.result.qualityReview.blockers.includes("wechat_image_plan_schema_invalid"), true);

console.log(JSON.stringify({
  status: "content-engine-wechat-skill-chain-self-test passed",
  normalCalls: normal.calls.length,
  maxNormalCalls: normal.result.wechatSkillChain.maxProviderCalls,
  realProviderCalls: 0,
  networkCalls: 0,
  platformCalls: 0,
  productionDatabaseCalls: 0
}, null, 2));
