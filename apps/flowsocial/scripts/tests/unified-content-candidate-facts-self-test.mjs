import assert from "node:assert/strict";
import {
  createUnifiedSkillOutputFact,
  deriveUnifiedPlatformCandidate,
  validateUnifiedSkillDomainOutput
} from "../../content-agent/unified-skill-output-contracts.mjs";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";

const hash = (letter) => letter.repeat(64);

function evidence(capability, platform, outputHash, index) {
  return {
    id: `invocation_${index}`,
    invocationHash: hash("a"),
    executionRecordHash: hash("b"),
    executionPlanHash: hash("c"),
    bundleHash: hash("d"),
    inputHash: hash("e"),
    outputHash,
    executionMode: "mock_fixture",
    status: "completed",
    platform,
    executionRecord: { invocationId: `invocation_${index}` }
  };
}

function fact({ capability, platform, outputContract, data, index }) {
  const runtimeOutput = { status: "success", data, warnings: [], blocked_reasons: [] };
  const step = { id: capability === "build-content-master" ? "content_master" : capability, capability, inputContract: "FixtureInput@1.0", outputContract };
  const outputHash = hashUnifiedContent(runtimeOutput);
  validateUnifiedSkillDomainOutput({ capability, platform, outputContract, runtimeOutput });
  return createUnifiedSkillOutputFact({ evidence: evidence(capability, platform, outputHash, index), platform, step, executionPlan: { steps: [step] }, runtimeOutput });
}

assert.throws(() => validateUnifiedSkillDomainOutput({
  capability: "write-xhs-content",
  platform: "xiaohongshu",
  outputContract: "XhsPostPackage@2.0",
  runtimeOutput: { status: "success", data: { id: "old_fixture", candidates: [] }, warnings: [], blocked_reasons: [] }
}), (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details.fieldPaths.includes("data.platform"));

assert.throws(() => validateUnifiedSkillDomainOutput({
  capability: "write-xhs-content",
  platform: "xiaohongshu",
  outputContract: "XhsPostPackage@2.0",
  runtimeOutput: { status: "success", data: { platform: "xiaohongshu", post_copy: { title_candidates: Array.from({ length: 6 }, (_, index) => ({ title: `T${index}` })), recommended_title: "T0", body_sections: [{}] }, deck: { pages: [{}] } }, warnings: [], blocked_reasons: [] }
}), (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details.fieldPaths.includes("data.post_copy.title_candidates"));

assert.throws(() => validateUnifiedSkillDomainOutput({
  capability: "generate-platform-titles",
  platform: "xiaohongshu",
  outputContract: "PlatformTitleList@1.0",
  runtimeOutput: { status: "success", data: { stage: "final_after_body", platform: "xiaohongshu", title_brief: {}, candidates: Array.from({ length: 9 }, (_, index) => ({ title_id: `T${index}`, title: `Title ${index}` })), recommendations: {} }, warnings: [], blocked_reasons: [] }
}), (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details.fieldPaths.includes("data.candidates"));

assert.throws(() => validateUnifiedSkillDomainOutput({
  capability: "build-content-master",
  platform: "xiaohongshu",
  outputContract: "ContentMaster@2.0",
  runtimeOutput: { status: "success", data: { id: "synthetic_master", contract: "SharedContentMaster@1.0", facts: [] }, warnings: [], blocked_reasons: [] }
}), (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details.fieldPaths.includes("data.content_master_id"));

const sourceMasterOutput = {
  status: "success",
  data: {
    content_master_id: "CM001",
    confirmed_facts: [{ fact_id: "F001", fact: "fixture", source_ids: ["SRC001"] }],
    supported_interpretations: [],
    author_opinions: [],
    source_list: [{ source_id: "SRC001" }]
  },
  warnings: [],
  blocked_reasons: []
};
const normalizedMaster = validateUnifiedSkillDomainOutput({ capability: "build-content-master", platform: "xiaohongshu", outputContract: "ContentMaster@2.0", runtimeOutput: sourceMasterOutput });
assert.equal(normalizedMaster.id, "CM001");
assert.equal(normalizedMaster.contract, "SharedContentMaster@1.0");
assert.equal(normalizedMaster.sourceOutputContract, "ContentMaster@2.0");
assert.equal(normalizedMaster.sourceOutputHash, hashUnifiedContent(sourceMasterOutput));
assert.deepEqual(normalizedMaster.contentMaster, sourceMasterOutput.data);

const tamperedRuntimeOutput = { status: "success", data: { ...sourceMasterOutput.data, central_thesis: "tampered" }, warnings: [], blocked_reasons: [] };
assert.throws(() => createUnifiedSkillOutputFact({
  evidence: evidence("build-content-master", "xiaohongshu", hashUnifiedContent(sourceMasterOutput), 0),
  platform: "xiaohongshu",
  step: { id: "content_master", capability: "build-content-master", inputContract: "FixtureInput@1.0", outputContract: "ContentMaster@2.0" },
  executionPlan: { steps: [] },
  runtimeOutput: tamperedRuntimeOutput
}), { code: "UNIFIED_SKILL_OUTPUT_HASH_MISMATCH" });

const platformRunRef = { id: "platform_run_fixture", hash: hash("f"), candidateRefs: [], sharedContentMasterRef: { id: "master", hash: hash("0") } };
const xhsFacts = [
  fact({
    capability: "write-xhs-content",
    platform: "xiaohongshu",
    outputContract: "XhsPostPackage@2.0",
    index: 1,
    data: {
      platform: "xiaohongshu",
      post_copy: { title_candidates: [{ title: "A" }, { title: "B" }, { title: "C" }], recommended_title: "A", body_sections: [{ section_id: "S1", text: "fixture" }] },
      deck: { pages: [{ page: 1, role: "cover", objective: "fixture", render_strategy: "html_css" }] }
    }
  }),
  fact({
    capability: "generate-platform-titles",
    platform: "xiaohongshu",
    outputContract: "PlatformTitleList@1.0",
    index: 2,
    data: { stage: "final_after_body", platform: "xiaohongshu", title_brief: {}, candidates: Array.from({ length: 5 }, (_, index) => ({ title_id: `T${index}`, title: `Title ${index}` })), recommendations: {} }
  })
];
const xhs = deriveUnifiedPlatformCandidate({ contentProjectId: "project_fixture", platform: "xiaohongshu", platformRunRef, outputFacts: xhsFacts });
assert.equal(xhsFacts[0].invocationRef.hash, hash("a"));
assert.equal(xhsFacts[0].executionRecordRef.hash, hash("b"));
assert.equal(xhsFacts[0].planRef.hash, hash("c"));
assert.equal(xhsFacts[0].bundleHash, hash("d"));
assert.equal(xhsFacts[0].inputHash, hash("e"));
assert.equal(xhsFacts[0].outputHash, hashUnifiedContent(xhsFacts[0].runtimeOutput));
assert.match(xhsFacts[0].factHash, /^[a-f0-9]{64}$/);
assert.equal(xhs.candidate.artifactState, "visual_artifacts_required");
assert.equal(xhs.candidate.deckPageSpecs.length, 1);
assert.deepEqual(xhs.candidate.renderedPageRevisionRefs, []);
assert.deepEqual(xhs.candidateSet.pageRevisionRefs, []);
assert.equal(xhs.candidateSet.bodyVersionRef.hash, xhsFacts[0].outputHash);
assert.equal(xhs.candidateSet.titleRef.hash, xhsFacts[1].outputHash);

const wechatFacts = [
  fact({
    capability: "write-wechat-article",
    platform: "wechat",
    outputContract: "WechatArticle@2.0",
    index: 3,
    data: { platform: "wechat_official_account", title_candidates: [{ title: "A" }], recommended_title: "A", outline: [{ section_id: "W1", heading: "Fixture" }], article_markdown: "## Fixture", preflight_checks: [] }
  }),
  fact({
    capability: "generate-platform-titles",
    platform: "wechat",
    outputContract: "PlatformTitleList@1.0",
    index: 4,
    data: { stage: "final_after_body", platform: "wechat_official_account", title_brief: {}, candidates: Array.from({ length: 5 }, (_, index) => ({ title_id: `T${index}`, title: `Title ${index}` })), recommendations: {} }
  }),
  fact({ capability: "review-wechat-article", platform: "wechat", outputContract: "WechatArticleReview@1.0", index: 5, data: { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] } }),
  fact({ capability: "plan-wechat-images", platform: "wechat", outputContract: "WechatImagePlan@1.0", index: 6, data: { plan_id: "WIP1", cover: { purpose: "fixture", strategy: "generated_raster", asset_id: null, image_spec_id: "spec1" }, slots: [] } })
];
const wechat = deriveUnifiedPlatformCandidate({ contentProjectId: "project_fixture", platform: "wechat", platformRunRef, outputFacts: wechatFacts });
assert.equal(wechat.candidate.artifactState, "pre_upload_resource_required");
assert.equal(wechat.candidate.deliverySemantics, "pre_upload_only");
assert.equal(wechat.candidate.postUploadArtifactRef, null);
assert.deepEqual(wechat.candidate.resourceArtifactRefs, []);
assert.ok(wechat.candidate.blockers.includes("image_resources_required"));

console.log(JSON.stringify({
  status: "unified-content-candidate-facts-self-test passed",
  xhsArtifactState: xhs.candidate.artifactState,
  wechatArtifactState: wechat.candidate.artifactState
}, null, 2));
