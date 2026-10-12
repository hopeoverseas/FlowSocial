import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveLlmTaskBudget, getLlmTaskDefinition } from "../../llm/task-registry.mjs";
import { adaptCanonicalSkillEnvelope, adaptPlatformTitleCandidate, adaptWechatArticleCandidate, contractExample } from "../../llm/contracts.mjs";

const executor = await readFile(new URL("../../content-agent/unified-skill-activity-executor.mjs", import.meta.url), "utf8");
const app = await readFrontendSource();
const api = await readFile(new URL("../../api-client.js", import.meta.url), "utf8");
const server = await readFile(new URL("../../server.mjs", import.meta.url), "utf8");
const serverAdapter = await readFile(new URL("../../content-agent/unified-content-server-adapter.mjs", import.meta.url), "utf8");

assert.match(executor, /"build-content-master": "build_content_master_v2"/);
assert.match(executor, /"generate-content-outline": "generate_confirmable_content_outline"/);
assert.match(executor, /"write-xhs-content": "write_xhs_content_v2"/);
assert.match(executor, /"write-xhs-post-copy": "write_xhs_post_copy"/);
assert.match(executor, /"generate-platform-titles": "generate_platform_titles"/);
assert.match(executor, /"plan-xhs-visual-assets": "plan_xhs_visual_assets"/);
assert.match(executor, /"review-wechat-article": "review_wechat_article"/);
assert.match(executor, /"plan-wechat-images": "plan_wechat_images"/);
assert.doesNotMatch(serverAdapter, /skill_name\s*===\s*["']plan-wechat-images["']/,
  "staged WeChat materialization must not replace the real image-planning Skill with a local title-card plan");
assert.doesNotMatch(serverAdapter, /buildLocalWechatImagePlan/,
  "server adapter must not synthesize the authoritative WeChat image plan");
assert.match(executor, /task: taskForCapability\(capability\)/);
assert.equal(getLlmTaskDefinition("build_content_master_v2").budget, "content_master");
assert.equal(getLlmTaskDefinition("generate_confirmable_content_outline").budget, "content_outline");
assert.ok(resolveLlmTaskBudget("build_content_master_v2").connectionTimeoutMs >= 30_000);
assert.equal(resolveLlmTaskBudget("build_content_master_v2").maxAttempts, 2,
  "content master must have one bounded structured repair attempt");
assert.ok(resolveLlmTaskBudget("generate_confirmable_content_outline").connectionTimeoutMs >= 20_000);
assert.ok(resolveLlmTaskBudget("write_xhs_content_v2").connectionTimeoutMs >= 30_000);
assert.ok(resolveLlmTaskBudget("write_xhs_content_v2").connectionTimeoutMs >= 120_000);
assert.ok(resolveLlmTaskBudget("write_xhs_post_copy").connectionTimeoutMs >= 120_000);
assert.ok(resolveLlmTaskBudget("plan_xhs_carousel").connectionTimeoutMs >= 120_000);
assert.ok(resolveLlmTaskBudget("review_wechat_article").connectionTimeoutMs >= 120_000);
assert.ok(resolveLlmTaskBudget("plan_wechat_images").connectionTimeoutMs >= 120_000);

const titleEnvelope = contractExample("PlatformTitleList@1.0");
const adaptedTitle = adaptPlatformTitleCandidate(titleEnvelope.data);
assert.equal(adaptedTitle.adapted, true);
assert.equal(adaptedTitle.wrapperPath, "bare_title_data");
assert.deepEqual(adaptedTitle.value, titleEnvelope);
assert.equal(adaptPlatformTitleCandidate(titleEnvelope).adapted, false);
const partialTitleEnvelope = adaptCanonicalSkillEnvelope("PlatformTitleList@1.0", { status: "success", data: titleEnvelope.data });
assert.equal(partialTitleEnvelope.wrapperPath, "partial_success_envelope");
assert.deepEqual(partialTitleEnvelope.value, titleEnvelope);
const nestedTitleEnvelope = adaptCanonicalSkillEnvelope("PlatformTitleList@1.0", {
  status: "success",
  data: { ...titleEnvelope.data, warnings: [], blocked_reasons: [] }
});
assert.equal(nestedTitleEnvelope.wrapperPath, "nested_success_envelope_fields");
assert.deepEqual(nestedTitleEnvelope.value, titleEnvelope);
const titleWithoutOverall = structuredClone(titleEnvelope);
delete titleWithoutOverall.data.candidates[0].scores.overall;
const derivedTitleScore = adaptCanonicalSkillEnvelope("PlatformTitleList@1.0", titleWithoutOverall);
assert.equal(derivedTitleScore.value.data.candidates[0].scores.overall >= 1, true);
const titleWithEvergreenRecommendation = structuredClone(titleEnvelope);
titleWithEvergreenRecommendation.data.recommendations.evergreen = titleWithEvergreenRecommendation.data.recommendations.experiment;
delete titleWithEvergreenRecommendation.data.recommendations.experiment;
const normalizedRecommendations = adaptCanonicalSkillEnvelope("PlatformTitleList@1.0", titleWithEvergreenRecommendation);
assert.equal(normalizedRecommendations.value.data.recommendations.experiment, titleEnvelope.data.recommendations.experiment);
const postEnvelope = contractExample("XhsPostCopyCreativeOutput@1.0");
assert.deepEqual(adaptCanonicalSkillEnvelope("XhsPostCopyCreativeOutput@1.0", postEnvelope.data).value, postEnvelope);
assert.equal(adaptCanonicalSkillEnvelope("XhsPostCopyCreativeOutput@1.0", { ...postEnvelope.data, extra: true }).adapted, false);
const wechatEnvelope = contractExample("WechatArticle@2.0");
const partialWechatEnvelope = adaptWechatArticleCandidate({ status: "success", data: wechatEnvelope.data });
assert.equal(partialWechatEnvelope.value.warnings.length, 0);
assert.equal(partialWechatEnvelope.value.blocked_reasons.length, 0);
const visualEnvelope = contractExample("XhsVisualAssetPlanCreativeOutput@1.0");
const visualSnake = {
  schema_version: visualEnvelope.data.schemaVersion,
  contract: visualEnvelope.data.contract,
  page_visuals: visualEnvelope.data.pageVisuals.map(({ visualFunction, visualNeed, renderStrategy, mustKeep, mustAvoid, ...rest }) => ({ ...rest, visual_function: visualFunction, visual_need: visualNeed, render_strategy: renderStrategy, must_keep: mustKeep, must_avoid: mustAvoid })),
  image_specs: [],
  skipped_pages: visualEnvelope.data.skippedPages,
  page_asset_bindings: visualEnvelope.data.pageAssetBindings.map(({ plannedAssetIds, ...rest }) => ({ ...rest, planned_asset_ids: plannedAssetIds }))
};
assert.equal(adaptCanonicalSkillEnvelope("XhsVisualAssetPlanCreativeOutput@1.0", visualSnake).wrapperPath, "snake_case_visual_data");
const visualWithMachineVersion = structuredClone(visualEnvelope);
if (visualWithMachineVersion.data.imageSpecs[0]) {
  visualWithMachineVersion.data.imageSpecs[0].designDnaVersion = "provider-must-not-own";
  const adaptedVisualMachineVersion = adaptCanonicalSkillEnvelope("XhsVisualAssetPlanCreativeOutput@1.0", visualWithMachineVersion);
  assert.equal(adaptedVisualMachineVersion.value.data.imageSpecs[0].designDnaVersion, undefined);
}
const carouselEnvelope = contractExample("XhsCarouselPlanCreativeOutput@1.0");
const carouselWithMachineId = { status: "success", data: { ...carouselEnvelope.data, deck_id: "provider-owned-id" } };
const adaptedCarousel = adaptCanonicalSkillEnvelope("XhsCarouselPlanCreativeOutput@1.0", carouselWithMachineId);
assert.equal(adaptedCarousel.value.data.deck_id, undefined);

assert.match(app, /const canResumePriorRequest/);
assert.match(app, /\? priorRequest\.idempotencyKey/);
assert.match(app, /targetPlatform,/);
assert.match(app, /priorRequest\.targetPlatform === platform/);
assert.match(app, /!item\.targetPlatform \|\| item\.targetPlatform === currentPlatform/);
assert.match(app, /else delete recoveredRequest\.targetPlatform/,
  "legacy dual failures must stay identifiable until a fresh platform-scoped request is created");
assert.match(app, /使用原请求键继续生成/);
assert.match(app, /按\$\{platformName\}重新规划/);
assert.match(app, /已使用原请求键恢复/);
assert.match(app, /listUnifiedContentPlanningAttempts/);
assert.match(api, /listUnifiedContentPlanningAttempts:/);
assert.match(server, /\/unified-content-projects\/planning-attempts/);
assert.match(server, /UNIFIED_PLANNING_REQUEST_IN_PROGRESS/);
assert.match(server, /planningCheckpoint: getUnifiedContentPlanningAttemptCheckpoints/);
assert.doesNotMatch(server, /confirmations\.xiaohongshu\.actor\.id\}\+\$\{confirmations\.wechat\.actor\.id/,
  "platform-scoped confirmation must not require the other platform's actor");

console.log("planning-provider-recovery-self-test: ok");
