import assert from "node:assert/strict";
import { adaptAuthoritativeWechatImagePlanOutput, adaptWechatImagePlanOutput } from "../../content-agent/wechat-image-plan-adapter.mjs";
import { buildLocalWechatImagePlan } from "../../content-agent/wechat-local-illustration-runtime.mjs";
import { projectWechatImageRuntimeCapability } from "../../content-agent/wechat-image-plan-adapter.mjs";

assert.deepEqual(projectWechatImageRuntimeCapability([]).allowed_strategies, ["html_chart", "no_image"]);
assert.equal(projectWechatImageRuntimeCapability([]).generated_raster_available, false);
assert.equal(projectWechatImageRuntimeCapability([]).illustrated_delivery_required, true);
assert.equal(projectWechatImageRuntimeCapability([]).minimum_inline_images, 1);
assert.deepEqual(projectWechatImageRuntimeCapability([{ asset_id: "approved" }]).allowed_strategies, ["authorized_asset", "html_chart", "no_image"]);
assert.deepEqual(projectWechatImageRuntimeCapability([], { generatedRasterAvailable: true }).allowed_strategies, ["html_chart", "generated_raster", "no_image"]);
assert.match(projectWechatImageRuntimeCapability([], { generatedRasterAvailable: true }).instruction, /优先使用 generated_raster/);
assert.doesNotMatch(projectWechatImageRuntimeCapability([], { generatedRasterAvailable: true }).instruction, /不得输出 generated_raster/);
assert.match(projectWechatImageRuntimeCapability([]).instruction, /不得输出 generated_raster/);

const generated = adaptWechatImagePlanOutput({
  status: "success",
  data: {
    plan_id: "wechat_plan_regression",
    cover: {
      purpose: "mood",
      strategy: "generated_raster",
      asset_id: "公众号封面图：四步流程",
      claim_ids: [],
      image_spec: { asset_id: "公众号封面图：四步流程", prompt: "no text, no logo, no watermark" }
    },
    slots: [{
      slot_id: "slot_1",
      after_section_id: "section_1",
      purpose: "explain",
      strategy: "generated_raster",
      asset_id: "正文插图 1",
      claim_ids: [],
      image_spec: { asset_id: "正文插图 1", prompt: "no text, no logo, no watermark" }
    }]
  },
  warnings: [],
  blocked_reasons: []
});

assert.equal(generated.cover.assetId, "wechat_cover");
assert.equal(generated.cover.imageSpec.asset_id, "wechat_cover");
assert.equal(generated.slots[0].assetId, "wechat_slots_0");
assert.equal(generated.slots[0].imageSpec.asset_id, "wechat_slots_0");

const chart = adaptWechatImagePlanOutput({
  plan_id: "wechat_chart_regression",
  cover: null,
  slots: [{ slot_id: "chart_1", purpose: "explain", strategy: "html_chart", asset_id: "四步流程图", claim_ids: [] }]
});
assert.equal(chart.slots[0].assetId, "wechat_slots_0");

const authoritative = adaptAuthoritativeWechatImagePlanOutput({
  status: "success",
  data: {
    plan_id: "wechat_authoritative_regression",
    cover: {
      purpose: "mood",
      strategy: "generated_raster",
      asset_id: "公众号封面图：四步流程",
      claim_ids: [],
      image_spec: {
        asset_id: "公众号封面图：四步流程",
        use_case: "stylized-concept",
        asset_type: "wechat-cover",
        prompt: "抽象流程节点，无文字",
        reference_asset_ids: [],
        design_dna_version: "v1",
        size: "1536x1024",
        must_avoid: ["文字", "水印", "logo"],
        text_policy: "no_text_in_image"
      }
    },
    slots: []
  },
  warnings: [],
  blocked_reasons: []
}, {
  article: { outline: [{ section_id: "section_1", claim_ids: [] }], claim_map: [], source_list: [] },
  contentMaster: { confirmed_facts: [], source_list: [] },
  authorizedAssets: []
});
assert.equal(authoritative.cover.assetId, "wechat_cover");
assert.equal(authoritative.cover.imageSpec.asset_id, "wechat_cover");

assert.throws(() => adaptAuthoritativeWechatImagePlanOutput({
  status: "success",
  data: { plan_id: "wechat_empty_illustrated_plan", cover: { purpose: "pace", strategy: "no_image", asset_id: null, claim_ids: [], image_spec: null }, slots: [] },
  warnings: [], blocked_reasons: []
}, {
  article: { outline: [{ section_id: "section_1", claim_ids: [] }], claim_map: [], source_list: [] },
  contentMaster: { confirmed_facts: [], source_list: [] }, authorizedAssets: [],
  imageRuntime: projectWechatImageRuntimeCapability([], { generatedRasterAvailable: true })
}), (error) => error?.code === "WECHAT_IMAGE_PLAN_COVER_REQUIRED");

const generatedWithInventedClaim = adaptAuthoritativeWechatImagePlanOutput({
  status: "success",
  data: {
    plan_id: "wechat_generated_invented_claim",
    cover: {
      purpose: "mood", strategy: "generated_raster", asset_id: "cover_scene", claim_ids: ["INVENTED"],
      image_spec: { asset_id: "cover_scene", use_case: "stylized-concept", asset_type: "wechat-cover", prompt: "与正文主题相关的抽象经营场景，无文字", reference_asset_ids: [], design_dna_version: "v1", size: "1536x1024", must_avoid: ["文字", "水印", "logo"], text_policy: "no_text_in_image" }
    },
    slots: []
  },
  warnings: [], blocked_reasons: []
}, {
  article: { outline: [{ section_id: "section_1", claim_ids: [] }], claim_map: [], source_list: [] },
  contentMaster: { confirmed_facts: [], source_list: [] }, authorizedAssets: []
});
assert.deepEqual(generatedWithInventedClaim.cover.claimIds, [], "generated editorial art must not retain invented evidence refs");

const chartWithInventedClaim = adaptAuthoritativeWechatImagePlanOutput({
  status: "success",
  data: {
    plan_id: "wechat_chart_invented_claim",
    cover: { purpose: "explain", strategy: "html_chart", asset_id: "cover_chart", claim_ids: ["INVENTED"], image_spec: null },
    slots: []
  },
  warnings: [], blocked_reasons: []
}, {
  article: { outline: [{ section_id: "section_1", claim_ids: [] }], claim_map: [], source_list: [] },
  contentMaster: { confirmed_facts: [], source_list: [] }, authorizedAssets: []
});
assert.deepEqual(chartWithInventedClaim.cover.claimIds, [], "article-derived charts must not retain invented evidence refs");

assert.throws(() => adaptAuthoritativeWechatImagePlanOutput({
  status: "success",
  data: {
    plan_id: "wechat_section_remap",
    cover: { purpose: "pace", strategy: "no_image", asset_id: null, claim_ids: [], image_spec: null },
    slots: [{ slot_id: "scene_1", after_section_id: "outline-section-unknown", purpose: "mood", strategy: "generated_raster", asset_id: "scene_1", claim_ids: [], image_spec: { asset_id: "scene_1", use_case: "stylized-concept", asset_type: "wechat-inline", prompt: "根据正文表现团队梳理业务场景，无文字", reference_asset_ids: [], design_dna_version: "v1", size: "1536x1024", must_avoid: ["文字", "水印", "logo"], text_policy: "no_text_in_image" } }]
  },
  warnings: [], blocked_reasons: []
}, {
  article: { outline: [{ section_id: "article-section-1", claim_ids: [] }], claim_map: [], source_list: [] },
  contentMaster: { confirmed_facts: [], source_list: [] }, authorizedAssets: []
}), (error) => error?.code === "WECHAT_IMAGE_PLAN_SECTION_REF_INVALID",
"unknown insertion anchors must not be guessed by slot order");

const ordinalAlias = adaptAuthoritativeWechatImagePlanOutput({
  status: "success",
  data: {
    plan_id: "wechat_section_ordinal_alias",
    cover: { purpose: "pace", strategy: "no_image", asset_id: null, claim_ids: [], image_spec: null },
    slots: [{ slot_id: "scene_1", after_section_id: "section_1", purpose: "mood", strategy: "generated_raster", asset_id: "scene_1", claim_ids: [], image_spec: { asset_id: "scene_1", use_case: "stylized-concept", asset_type: "wechat-inline", prompt: "根据正文表现团队梳理业务场景，无文字", reference_asset_ids: [], design_dna_version: "v1", size: "1536x1024", must_avoid: ["文字", "水印", "logo"], text_policy: "no_text_in_image" } }]
  },
  warnings: [], blocked_reasons: []
}, {
  article: { outline: [{ section_id: "W1", claim_ids: [] }], claim_map: [], source_list: [] },
  contentMaster: { confirmed_facts: [], source_list: [] }, authorizedAssets: []
});
assert.equal(ordinalAlias.slots[0].afterSectionId, "W1");
assert.equal(ordinalAlias.slots[0].source.after_section_id, "W1");

const localArticle = { recommended_title: "四步法", outline: [{ section_id: "section_1", heading: "诊断场景", claim_ids: [] }], claim_map: [], source_list: [] };
const localAuthority = adaptAuthoritativeWechatImagePlanOutput(buildLocalWechatImagePlan(localArticle, { planId: "wechat_local_cards" }), {
  article: localArticle,
  contentMaster: { confirmed_facts: [], source_list: [] },
  authorizedAssets: []
});
assert.equal(localAuthority.cover.strategy, "html_chart");
assert.equal(localAuthority.slots[0].strategy, "html_chart");
assert.equal(localAuthority.resourceRequirements.length, 2);

assert.throws(() => adaptWechatImagePlanOutput({
  plan_id: "authorized_invalid",
  cover: { purpose: "mood", strategy: "authorized_asset", asset_id: "无效 资产", claim_ids: [] },
  slots: []
}), (error) => error.code === "WECHAT_IMAGE_PLAN_ASSET_ID_INVALID");

console.log("wechat-image-plan-adapter-self-test: ok");
