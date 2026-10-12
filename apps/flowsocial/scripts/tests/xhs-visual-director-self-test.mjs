import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateContentAssets, renderContentDelivery } from "../../artifact-engine.mjs";
import { confirmXhsVisualStoryboard, createXhsVisualStoryboard } from "../../content-agent/xhs-visual-storyboard.mjs";
import {
  confirmExactDesignDnaSnapshot,
  confirmDesignDnaSnapshot,
  confirmVisualDirectionSet,
  createAuthoredDesignDnaSnapshot,
  createDesignDnaSnapshot,
  createDesignDnaSnapshotRef,
  createVisualDirectionSet,
  fallbackVisualPage,
  getVisualCandidates,
  inspectNoTextVisualPrompt,
  projectVisualDirectionCompatibility,
  reviewVisualCandidate,
  selectVisualCandidate,
  validateVisualDirectionSet,
  visualCandidateSummary
} from "../../content-agent/xhs-visual-director.mjs";

const root = await mkdtemp(join(tmpdir(), "flowsocial-xhs-director-"));
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const paddedPng = Buffer.concat([Buffer.from(tinyPng, "base64"), Buffer.alloc(900)]).toString("base64");
const roles = ["cover", "pain", "definition", "process", "permission", "gate", "summary", "cta"];
let knowledgeDatabase;
let localServer;

function makeTask(id = "content_visual_director") {
  const task = {
    id,
    version: 1,
    platform: "xiaohongshu",
    ideaTitle: "企业社媒 ContentRun 全链路",
    accountStyleSnapshot: { name: "品牌编辑视觉", description: "深绿、暖白、克制的企业编辑视觉", mood: "可信、清晰" },
    currentContent: {
      post_copy: { recommended_title: "企业社媒 ContentRun 全链路", hashtags: ["内容运营"] },
      deck: {
        pages: roles.map((role, index) => ({
          page_id: `P${index + 1}`,
          page_number: index + 1,
          page_role: role,
          headline: index ? `第 ${index + 1} 页独立结论` : "企业社媒 ContentRun 全链路",
          body_items: [`本页证据 ${index + 1}`, `本页行动 ${index + 1}`],
          visual_direction: `第 ${index + 1} 页独立视觉任务`
        }))
      }
    },
    qualityReview: { status: "passed", blockers: [] }
  };
  task.visualStoryboard = createXhsVisualStoryboard(task);
  return task;
}

try {
  const dna = createDesignDnaSnapshot({
    accountId: "account_visual",
    sourceFiles: [
      { id: "approved_vi", name: "VI.pdf", kind: "document", parseStatus: "ready", parseMode: "pdf", description: "深绿色、暖白留白", tags: ["品牌 VI"], extractedTextSummary: "克制的企业编辑版式" },
      { id: "private_reference", name: "private.png", kind: "image", parseStatus: "ready", parseMode: "image_metadata", description: "不得外发的参考图", tags: ["私有"] }
    ],
    authorizedFileIds: ["approved_vi"],
    styleInput: { colors: ["#244F43", "#F6F1E9"], materials: ["纸张", "磨砂玻璃"], layoutPreferences: ["大留白"], forbiddenMotifs: ["霓虹科技光"], description: "可信、克制、编辑感" },
    providerCapabilities: { referenceImages: false }
  });
  assert.deepEqual(dna.authorization.approvedFileIds, ["approved_vi"]);
  assert.deepEqual(dna.authorization.excludedFileIds, ["private_reference"]);
  assert.doesNotMatch(dna.approvedTextSummary, /不得外发/);
  assert.equal(dna.sources.find((item) => item.fileId === "private_reference")?.extractedSummary, "");
  assert.equal(dna.authorization.referenceImagesTransmitted, false);
  const confirmedDna = confirmDesignDnaSnapshot(dna, { confirmedBy: "self_test" });
  const authoredRules = {
    colors: ["#244F43", "#F6F1E9"],
    fontPreferences: ["无衬线", "标题粗体"],
    layoutPreferences: ["大留白", "编辑版式"],
    materials: ["纸张", "磨砂玻璃"],
    photographyOrIllustrationDirection: "editorial_photography",
    forbiddenMotifs: ["伪文字", "水印", "第三方 Logo"],
    referenceNotes: "用户明确选择的原创编辑视觉"
  };
  const userAuthoredDna = createAuthoredDesignDnaSnapshot({
    accountId: "account_user_authored", version: 1, styleRules: authoredRules, mode: "user_authored",
    userAuthoredRulesAuthorized: true, sourceFiles: [], authorizedFileIds: [], providerCapabilities: { referenceImages: false }
  });
  assert.equal(userAuthoredDna.status, "ready_for_confirmation");
  assert.equal(userAuthoredDna.sources.length, 0);
  assert.equal(userAuthoredDna.authorization.externalInputMode, "user_authored_style_rules");
  assert.equal(userAuthoredDna.authorization.userAuthoredRulesAuthorized, true);
  assert.equal(userAuthoredDna.authorization.referenceImagesTransmitted, false);
  assert.equal(userAuthoredDna.authorization.brandReplicationClaimed, false);
  assert.match(userAuthoredDna.authorization.disclosure, /不声称品牌视觉复刻/);
  assert.throws(() => createAuthoredDesignDnaSnapshot({
    accountId: "account_user_authored", version: 2, styleRules: authoredRules, mode: "user_authored", userAuthoredRulesAuthorized: false
  }), (error) => error.code === "DESIGN_DNA_USER_AUTHORIZATION_REQUIRED");
  assert.throws(() => createAuthoredDesignDnaSnapshot({
    accountId: "account_user_authored", version: 2, styleRules: { ...authoredRules, colors: [] }, mode: "user_authored", userAuthoredRulesAuthorized: true
  }), (error) => error.code === "DESIGN_DNA_RULES_INCOMPLETE");
  const accountSources = [
    { id: "ready_source", name: "ready.pdf", kind: "document", parseStatus: "ready", parseMode: "pdf", description: "approved description", tags: ["品牌 VI"], extractedTextSummary: "批准来源摘要" },
    { id: "private_source", name: "private.pdf", kind: "document", parseStatus: "ready", parseMode: "pdf", description: "private description", tags: ["私有"], extractedTextSummary: "不得进入批准摘要" },
    { id: "pending_source", name: "pending.pdf", kind: "document", parseStatus: "processing", parseMode: "pdf", description: "pending", tags: [], extractedTextSummary: "未解析内容" }
  ];
  const sourcedDna = createAuthoredDesignDnaSnapshot({
    accountId: "account_sources", version: 4, styleRules: authoredRules, mode: "approved_sources",
    sourceFiles: accountSources, authorizedFileIds: ["ready_source"], providerCapabilities: { referenceImages: false }
  });
  assert.deepEqual(sourcedDna.authorization.approvedFileIds, ["ready_source"]);
  assert.deepEqual(new Set(sourcedDna.authorization.excludedFileIds), new Set(["private_source", "pending_source"]));
  assert.equal(sourcedDna.authorization.externalInputMode, "approved_text_summary_only");
  assert.match(sourcedDna.approvedTextSummary, /批准来源摘要/);
  assert.doesNotMatch(sourcedDna.approvedTextSummary, /不得进入批准摘要|未解析内容/);
  assert.equal(sourcedDna.sources.find((item) => item.fileId === "private_source")?.extractedSummary, "");
  assert.equal(sourcedDna.sources.find((item) => item.fileId === "pending_source")?.extractedSummary, "");
  assert.throws(() => createAuthoredDesignDnaSnapshot({
    accountId: "account_sources", version: 5, styleRules: authoredRules, mode: "approved_sources", sourceFiles: accountSources, authorizedFileIds: ["cross_account_file"]
  }), (error) => error.code === "DESIGN_DNA_SOURCE_ACCOUNT_MISMATCH");
  assert.throws(() => createAuthoredDesignDnaSnapshot({
    accountId: "account_sources", version: 5, styleRules: authoredRules, mode: "approved_sources", sourceFiles: accountSources, authorizedFileIds: ["pending_source"]
  }), (error) => error.code === "DESIGN_DNA_SOURCE_NOT_READY");
  const historicalSnapshot = structuredClone(confirmedDna);
  const historicalSnapshotRef = createDesignDnaSnapshotRef(historicalSnapshot);
  createAuthoredDesignDnaSnapshot({ accountId: "account_sources", version: 5, styleRules: authoredRules, mode: "approved_sources", sourceFiles: accountSources, authorizedFileIds: ["ready_source"] });
  assert.deepEqual(createDesignDnaSnapshotRef(historicalSnapshot), historicalSnapshotRef, "authoring a new version must not rewrite historical ready/confirmed snapshots");
  const exactDna = createDesignDnaSnapshot({
    accountId: "account_exact",
    sourceFiles: [{ id: "exact_vi", name: "exact.pdf", kind: "document", parseStatus: "ready", parseMode: "pdf", description: "approved exact source", tags: [], extractedTextSummary: "深绿 大留白" }],
    authorizedFileIds: ["exact_vi"],
    styleInput: { description: "深绿、大留白、编辑摄影", version: 2 },
    providerCapabilities: { referenceImages: false }
  });
  const exactAccount = { id: "account_exact", accountType: "social", visualStyle: { designDnaSnapshotId: exactDna.id, designDnaVersion: exactDna.version } };
  const exactRef = createDesignDnaSnapshotRef(exactDna);
  assert.deepEqual(createDesignDnaSnapshotRef(structuredClone(exactDna)), exactRef, "snapshot ref must be stable for the full reviewed snapshot");
  const exactResult = confirmExactDesignDnaSnapshot({ account: exactAccount, snapshots: [exactDna], snapshotRef: exactRef, confirmedBy: "self_test" });
  assert.equal(exactResult.confirmed.status, "confirmed");
  assert.equal(exactResult.snapshotRef.hash, createDesignDnaSnapshotRef(exactResult.confirmed).hash, "confirmed authority hash must cover the full confirmed snapshot");
  assert.notEqual(exactResult.snapshotRef.hash, exactRef.hash, "confirmation state and evidence must produce a new authority hash");
  assert.equal(exactDna.status, "ready_for_confirmation", "exact confirmation gate must not mutate the reviewed snapshot object");
  const expectExactFailure = (snapshotRef, snapshots, account, code) => assert.throws(
    () => confirmExactDesignDnaSnapshot({ account, snapshots, snapshotRef, confirmedBy: "self_test" }),
    (error) => error.code === code
  );
  expectExactFailure(null, [exactDna], exactAccount, "DESIGN_DNA_SNAPSHOT_REF_REQUIRED");
  expectExactFailure({ id: "missing", hash: exactRef.hash }, [exactDna], exactAccount, "DESIGN_DNA_SNAPSHOT_NOT_FOUND");
  expectExactFailure({ ...exactRef, hash: "f".repeat(64) }, [exactDna], exactAccount, "DESIGN_DNA_SNAPSHOT_HASH_MISMATCH");
  const otherDna = { ...structuredClone(exactDna), id: "design_dna_other", accountId: "account_other" };
  expectExactFailure(createDesignDnaSnapshotRef(otherDna), [otherDna], exactAccount, "DESIGN_DNA_SNAPSHOT_ACCOUNT_MISMATCH");
  const newerDna = { ...structuredClone(exactDna), id: "design_dna_account_exact_newer", version: 3 };
  expectExactFailure(exactRef, [exactDna, newerDna], exactAccount, "DESIGN_DNA_SNAPSHOT_STALE");
  const stalePointerAccount = { ...exactAccount, visualStyle: { designDnaSnapshotId: newerDna.id, designDnaVersion: newerDna.version } };
  expectExactFailure(exactRef, [exactDna], stalePointerAccount, "DESIGN_DNA_SNAPSHOT_POINTER_STALE");
  const confirmedHistory = structuredClone(exactResult.confirmed);
  const confirmedHistoryHash = createDesignDnaSnapshotRef(confirmedHistory).hash;
  expectExactFailure(exactRef, [confirmedHistory], exactAccount, "DESIGN_DNA_ALREADY_CONFIRMED");
  assert.equal(createDesignDnaSnapshotRef(confirmedHistory).hash, confirmedHistoryHash, "duplicate confirmation must not rewrite confirmed history");

  const task = makeTask();
  const direction = createVisualDirectionSet(task, {
    mode: "all_ai_backgrounds",
    candidateCount: 2,
    designDnaSnapshot: confirmedDna,
    providerConfig: { image: { provider: "Kie.ai", model: "fixture-model", quality: "high", capabilities: { referenceImages: false } } }
  });
  assert.equal(direction.pages.length, 8);
  assert.deepEqual(direction.pages.map((page) => page.roleLabel), ["封面", "痛点清单", "概念定义", "流程链路", "权限矩阵", "门禁机制", "价值总结", "行动引导"]);
  assert.equal(direction.pages.every((page) => page.renderStrategy === "generated_raster"), true);
  assert.equal(direction.estimatedCalls, 16);
  assert.equal(new Set(direction.pages.map((page) => page.prompt)).size, 8);
  assert.equal(direction.pages.every((page) => inspectNoTextVisualPrompt(page.prompt).passed), true);
  assert.equal(direction.pages.every((page) => /text.*letters.*logo.*watermark.*safe area.*brand-neutral/i.test(page.negativePrompt)), true);
  assert.equal(direction.mediaDirection, "editorial_photography");
  assert.equal(direction.stylePreset.source, "approved_design_dna_projection");
  assert.equal(direction.stylePreset.brandReplicationClaimed, false);
  assert.doesNotMatch(direction.photographyOrIllustrationDirection, /\bor\b|或|混合/i);
  assert.equal(direction.designDnaSnapshotId, confirmedDna.id);
  assert.equal(validateVisualDirectionSet(direction).status, "passed");
  const unsafeDirection = structuredClone(direction);
  unsafeDirection.pages[0].prompt += ". headline and interface";
  assert.equal(validateVisualDirectionSet(unsafeDirection).blockers.includes("no_text_prompt_contract"), true);

  let providerCalls = 0;
  await assert.rejects(
    () => generateContentAssets(task, { root, generateImage: async () => { providerCalls += 1; return {}; } }),
    (error) => error.code === "XHS_STORYBOARD_CONFIRMATION_REQUIRED"
  );
  assert.equal(providerCalls, 0);
  confirmXhsVisualStoryboard(task, { confirmedBy: "self_test" });
  await assert.rejects(
    () => generateContentAssets(task, { root, generateImage: async () => { providerCalls += 1; return {}; } }),
    (error) => error.code === "XHS_VISUAL_DIRECTION_CONFIRMATION_REQUIRED"
  );
  assert.equal(providerCalls, 0);
  await assert.rejects(
    async () => confirmVisualDirectionSet(task, { provider: "Kie.ai" }),
    (error) => error.code === "XHS_VISUAL_DIRECTION_INVALID"
  );
  confirmVisualDirectionSet(task, {
    provider: direction.provider,
    model: direction.model,
    quality: direction.quality,
    candidateCount: direction.candidateCount,
    estimatedCalls: direction.estimatedCalls,
    confirmedBy: "self_test"
  });

  const generation = await generateContentAssets(task, {
    root,
    generateImage: async ({ prompt, model, quality }) => {
      providerCalls += 1;
      assert.match(prompt, /no text/i);
      assert.equal(model, "fixture-model");
      assert.equal(quality, "high");
      return { status: "succeeded", imageUrl: `data:image/png;base64,${paddedPng}`, provider: "fake-provider", model, taskId: `fake_${providerCalls}` };
    }
  });
  assert.equal(providerCalls, 16);
  assert.equal(generation.candidates.length, 16);
  assert.equal(generation.candidates.every((item) => item.providerStatus === "succeeded" && item.qualityStatus === "pending_review" && item.selected === false), true);
  assert.equal(visualCandidateSummary(task).estimatedCalls, visualCandidateSummary(task).actualCalls);
  assert.equal(visualCandidateSummary(task).providerSucceeded, 16);
  assert.equal(visualCandidateSummary(task).qualityPendingReview, 16);
  await assert.rejects(() => renderContentDelivery(task, { root }), (error) => error.code === "XHS_CANDIDATE_QUALITY_APPROVAL_REQUIRED");

  for (let page = 1; page <= 8; page += 1) {
    selectVisualCandidate(task, { pageId: `P${page}`, candidateId: `P${page}_candidate_2`, selectedBy: "self_test" });
  }
  assert.equal(visualCandidateSummary(task).selected, 8);
  assert.equal(visualCandidateSummary(task).qualityApproved, 8);
  assert.equal(visualCandidateSummary(task).ready, true);

  reviewVisualCandidate(task, { pageId: "P2", candidateId: "P2_candidate_2", decision: "reject", rejectionReasons: ["text_or_gibberish"], reviewedBy: "self_test" });
  assert.equal(providerCalls, 16, "拒绝候选不得触发额外 Provider 调用");
  assert.deepEqual(getVisualCandidates(task).find((item) => item.candidateId === "P2_candidate_2").rejectionReasons, ["text_or_gibberish"]);
  assert.equal(visualCandidateSummary(task).qualityRejected, 1);
  assert.equal(visualCandidateSummary(task).ready, false);
  selectVisualCandidate(task, { pageId: "P2", candidateId: "P2_candidate_1", selectedBy: "self_test" });

  await assert.rejects(
    () => generateContentAssets(task, { root, generateImage: async () => { providerCalls += 1; return {}; } }, { assetIds: ["P2"], force: true }),
    (error) => error.code === "XHS_ADDITIONAL_IMAGE_CALL_APPROVAL_REQUIRED"
  );
  assert.equal(providerCalls, 16);
  await generateContentAssets(task, {
    root,
    generateImage: async ({ model }) => {
      providerCalls += 1;
      return { status: "succeeded", imageUrl: `data:image/png;base64,${paddedPng}`, provider: "fake-provider", model, taskId: `retry_${providerCalls}` };
    }
  }, { assetIds: ["P2"], force: true, approvedAdditionalCalls: 2 });
  assert.equal(providerCalls, 18);
  assert.equal(visualCandidateSummary(task).actualCalls, 18);
  assert.equal(visualCandidateSummary(task).actualProviderCalls, 18);
  assert.equal(visualCandidateSummary(task).actualPaidCalls, 0, "假 Provider 不得记为真实付费调用");
  assert.equal(getVisualCandidates(task).filter((item) => item.pageId === "P2").every((item) => !item.selected), true);
  selectVisualCandidate(task, { pageId: "P2", candidateId: "P2_candidate_1", selectedBy: "self_test" });

  fallbackVisualPage(task, { pageId: "P8", reason: "行动页需要纯品牌色确定性版式", confirmedBy: "self_test" });
  assert.equal(task.visualDirectionSet.pages.find((page) => page.pageId === "P8").renderStrategy, "html_css");
  assert.equal(task.visualDirectionSet.pages.find((page) => page.pageId === "P8").fallback.reason, "行动页需要纯品牌色确定性版式");
  assert.equal(visualCandidateSummary(task).ready, true);

  const delivery = await renderContentDelivery(task, { root });
  assert.equal(delivery.rendered.length, 8);
  assert.equal(delivery.rendered.find((item) => item.pageId === "P8").backgroundSource, "explicit_deterministic_fallback");
  assert.equal(delivery.rendered.filter((item) => item.pageId !== "P8").every((item) => item.backgroundCandidateId), true);
  const manifest = JSON.parse(await readFile(join(root, delivery.manifestPath), "utf8"));
  assert.equal(manifest.schema, "FlowSocialDeliveryManifest@2.0");
  assert.equal(manifest.visualDirection.provider, "Kie.ai");
  assert.equal(manifest.visualDirection.model, "fixture-model");
  assert.equal(manifest.visualDirection.quality, "high");
  assert.equal(manifest.visualDirection.referenceInputDisclosure.includes("不支持参考图"), true);
  assert.equal(manifest.visualDirection.candidateSummary.fallback, 1);
  assert.equal(manifest.visualDirection.candidateSummary.providerSucceeded, 16);
  assert.equal(manifest.visualDirection.candidateSummary.qualityApproved, 8);
  assert.equal(manifest.visualDirection.candidates.every((item) => item.providerStatus && item.qualityStatus), true);
  assert.equal(manifest.renderInputs.find((item) => item.pageId === "P8").backgroundSource, "explicit_deterministic_fallback");

  const failureTask = makeTask("content_visual_failure");
  const failureDirection = createVisualDirectionSet(failureTask, {
    mode: "all_ai_backgrounds",
    candidateCount: 1,
    providerConfig: { image: { provider: "fake-failure", model: "fixture", quality: "basic", capabilities: { referenceImages: false } } }
  });
  assert.equal(failureDirection.stylePreset.source, "built_in_stable_preset");
  assert.equal(failureDirection.designDnaUsage.disclosure.includes("不声称复刻品牌视觉"), true);
  confirmXhsVisualStoryboard(failureTask, { confirmedBy: "self_test" });
  confirmVisualDirectionSet(failureTask, { provider: failureDirection.provider, model: failureDirection.model, quality: failureDirection.quality, candidateCount: 1, estimatedCalls: 8, confirmedBy: "self_test" });
  const failed = await generateContentAssets(failureTask, { root, generateImage: async () => ({ status: "failed", error: "fixture provider failure" }) });
  assert.equal(failed.summary.failed, 8);
  assert.equal(failureTask.visualDirectionSet.pages.every((page) => page.renderStrategy === "generated_raster"), true);
  await assert.rejects(() => renderContentDelivery(failureTask, { root }), (error) => error.code === "XHS_CANDIDATE_QUALITY_APPROVAL_REQUIRED");

  const legacyTask = {
    version: 3,
    visualDirectionSet: { schemaVersion: "1.0", pages: [{ pageId: "P1", pageRole: "cover" }] },
    generatedAssets: [{ id: "legacy_asset", assetId: "P1", pageId: "P1", version: 3, status: "succeeded", provider: "legacy", relativePath: "artifacts/legacy/P1.png" }]
  };
  const legacyCandidates = getVisualCandidates(legacyTask);
  assert.equal(legacyCandidates.length, 1);
  assert.equal(legacyCandidates[0].selected, false);
  assert.equal(legacyCandidates[0].providerStatus, "succeeded");
  assert.equal(legacyCandidates[0].qualityStatus, "pending_review");
  assert.equal(legacyCandidates[0].compatibilitySource, "legacy_single_asset");
  assert.equal(legacyCandidates[0].compatibilityProjection.projectedAtRead, true);
  const legacyDirectionProjection = projectVisualDirectionCompatibility(legacyTask);
  assert.equal(legacyDirectionProjection.historicalSnapshotMutated, false);
  assert.equal(legacyDirectionProjection.action, "regenerate_visual_direction_for_current_content_version");
  assert.equal(legacyDirectionProjection.issues.includes("eight_page_capacity_missing"), true);
  const legacyManifest = { schema: "FlowSocialDeliveryManifest@2.0", contentTaskId: "legacy", files: [] };
  assert.equal(legacyManifest.schema, "FlowSocialDeliveryManifest@2.0");

  const dataDir = join(root, "isolated-data");
  const uploadDir = join(root, "isolated-uploads");
  await mkdir(dataDir, { recursive: true });
  process.env.FLOWSOCIAL_DATA_DIR = dataDir;
  process.env.FLOWSOCIAL_KNOWLEDGE_UPLOAD_DIR = uploadDir;
  const knowledge = await import("../../knowledge-base.mjs");
  const storage = await import("../../storage.mjs");
  ({ database: knowledgeDatabase } = storage);
  const JSZip = (await import("jszip")).default;
  const pptx = new JSZip();
  pptx.file("[Content_Types].xml", "<Types></Types>");
  pptx.file("ppt/slides/slide1.xml", "<p:sld><a:t>品牌主色深绿与暖白</a:t><a:t>大留白、纸张材质、禁止霓虹科技光</a:t></p:sld>");
  const visualFolder = knowledge.createKnowledgeFolder({ workspaceId: "workspace_visual", companyId: "company_visual", name: "账号视觉资料" });
  const uploadedPptx = await knowledge.saveKnowledgeFile({
    folderId: visualFolder.id,
    workspaceId: "workspace_visual",
    companyId: "company_visual",
    name: "品牌视觉规范.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    tags: ["品牌 VI"],
    description: "已授权提取文字化 Design DNA",
    buffer: await pptx.generateAsync({ type: "nodebuffer" })
  });
  assert.equal(uploadedPptx.parseStatus, "ready");
  assert.equal(uploadedPptx.parseMode, "pptx_text");
  assert.equal((await readdir(uploadDir)).length, 1);
  const persistedSources = knowledge.buildDesignDnaSourceFiles([uploadedPptx.id]);
  assert.equal(persistedSources.length, 1);
  assert.match(persistedSources[0].extractedTextSummary, /深绿/);
  const persistedDna = createDesignDnaSnapshot({
    accountId: "account_persisted",
    sourceFiles: persistedSources,
    authorizedFileIds: [uploadedPptx.id],
    styleInput: {},
    providerCapabilities: { referenceImages: false }
  });
  assert.equal(persistedDna.colors.includes("深绿"), true);
  assert.equal(persistedDna.layoutPreferences.includes("大留白"), true);
  assert.equal(persistedDna.authorization.referenceImagesTransmitted, false);

  process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
  const apiStore = storage.readStore();
  apiStore.accounts ||= [];
  apiStore.designDnaSnapshots = [];
  apiStore.accounts.push(
    { id: "company_visual", accountType: "company", workspaceId: "workspace_visual", companyId: "company_visual", name: "fixture company" },
    {
      id: "account_authoring_api", accountType: "social", workspaceId: "workspace_visual", companyId: "company_visual", platform: "xiaohongshu", name: "fixture xhs",
      visualStyle: { name: "账号视觉系统", description: "", assetRefs: [{ fileId: uploadedPptx.id, folderId: visualFolder.id, name: uploadedPptx.name, kind: uploadedPptx.kind, parseStatus: uploadedPptx.parseStatus, parseMode: uploadedPptx.parseMode, externalUseApproved: false, assetType: "vi" }] }
    }
  );
  storage.writeStore(apiStore);
  ({ server: localServer } = await import("../../server.mjs"));
  await new Promise((resolve) => localServer.listen(0, "127.0.0.1", resolve));
  const apiBase = `http://127.0.0.1:${localServer.address().port}/api/v1`;
  const authorUrl = `${apiBase}/accounts/account_authoring_api/design-dna`;
  const sourceAuthoringResponse = await fetch(authorUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "approved_sources", userAuthoredRulesAuthorized: false, sourceAuthorizations: [{ fileId: uploadedPptx.id, externalUseApproved: true }], styleRules: authoredRules })
  });
  const sourceAuthoring = await sourceAuthoringResponse.json();
  assert.equal(sourceAuthoringResponse.status, 201, JSON.stringify(sourceAuthoring));
  assert.equal(sourceAuthoring.item.status, "ready_for_confirmation");
  assert.deepEqual(sourceAuthoring.item.authorization.approvedFileIds, [uploadedPptx.id]);
  assert.equal(sourceAuthoring.item.authorization.externalInputMode, "approved_text_summary_only");
  assert.equal(sourceAuthoring.item.authorization.referenceImagesTransmitted, false);
  const firstApiSnapshotHash = createDesignDnaSnapshotRef(sourceAuthoring.item).hash;
  const rejectedAuthoring = async (payload, code) => {
    const before = storage.readStore().designDnaSnapshots.length;
    const response = await fetch(authorUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    assert.equal(response.status, 409, JSON.stringify(body));
    assert.equal(body.code, code);
    assert.equal(storage.readStore().designDnaSnapshots.length, before, `${code} must not append a snapshot`);
  };
  await rejectedAuthoring({ mode: "approved_sources", sourceAuthorizations: [], styleRules: authoredRules }, "DESIGN_DNA_SOURCE_AUTHORIZATION_INCOMPLETE");
  await rejectedAuthoring({ mode: "approved_sources", sourceAuthorizations: [{ fileId: "cross_account_file", externalUseApproved: true }], styleRules: authoredRules }, "DESIGN_DNA_SOURCE_ACCOUNT_MISMATCH");
  await rejectedAuthoring({ mode: "user_authored", userAuthoredRulesAuthorized: true, sourceAuthorizations: [{ fileId: uploadedPptx.id, externalUseApproved: true }], styleRules: authoredRules }, "DESIGN_DNA_USER_AUTHORED_SOURCES_FORBIDDEN");
  await rejectedAuthoring({ mode: "user_authored", userAuthoredRulesAuthorized: true, sourceAuthorizations: [{ fileId: uploadedPptx.id, externalUseApproved: false }], styleRules: { ...authoredRules, colors: [] } }, "DESIGN_DNA_RULES_INCOMPLETE");
  const pureAuthoringResponse = await fetch(authorUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "user_authored", userAuthoredRulesAuthorized: true, sourceAuthorizations: [{ fileId: uploadedPptx.id, externalUseApproved: false }], styleRules: authoredRules })
  });
  const pureAuthoring = await pureAuthoringResponse.json();
  assert.equal(pureAuthoringResponse.status, 201, JSON.stringify(pureAuthoring));
  assert.equal(pureAuthoring.item.version, 2);
  assert.equal(pureAuthoring.item.sources.length, 0);
  assert.equal(pureAuthoring.item.authorization.externalInputMode, "user_authored_style_rules");
  assert.equal(pureAuthoring.item.authorization.brandReplicationClaimed, false);
  const afterPure = storage.readStore();
  assert.equal(afterPure.designDnaSnapshots.length, 2);
  assert.equal(createDesignDnaSnapshotRef(afterPure.designDnaSnapshots[0]).hash, firstApiSnapshotHash, "append-only authoring must preserve the prior ready snapshot");
  const reviewedResponse = await fetch(authorUrl);
  const reviewed = await reviewedResponse.json();
  assert.equal(reviewedResponse.status, 200);
  assert.deepEqual(reviewed.snapshotRef, pureAuthoring.snapshotRef);
  assert.equal(reviewed.availableSources[0].externalUseApproved, false, "explicit source revocation must become the next default without expanding authorization");
  const confirmResponse = await fetch(`${authorUrl}/confirm`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ snapshotRef: reviewed.snapshotRef, confirmedBy: "self_test", note: "reviewed exact authored rules" })
  });
  const confirmedAuthored = await confirmResponse.json();
  assert.equal(confirmResponse.status, 201, JSON.stringify(confirmedAuthored));
  assert.equal(confirmedAuthored.item.status, "confirmed");
  assert.notEqual(confirmedAuthored.snapshotRef.hash, reviewed.snapshotRef.hash);
  assert.equal(createDesignDnaSnapshotRef(storage.readStore().designDnaSnapshots[0]).hash, firstApiSnapshotHash, "exact confirmation must not rewrite earlier history");

  const appSource = await readFrontendSource();
  const apiSource = await readFile(new URL("../../api-client.js", import.meta.url), "utf8");
  const serverSource = await readFile(new URL("../../server.mjs", import.meta.url), "utf8");
  assert.match(appSource, /接口成功 ≠ 质量通过/);
  assert.match(appSource, /已批准 \/ 待审 \/ 已拒绝 \/ 回退/);
  assert.match(appSource, /approvedAdditionalCalls/);
  assert.match(apiSource, /visual-candidates\/review/);
  assert.match(serverSource, /reviewVisualCandidate/);
  assert.match(serverSource, /approvedAdditionalCalls/);
  assert.match(serverSource, /createDesignDnaSnapshotRef\(item\)/, "GET must return the exact reviewed snapshot ref");
  assert.match(serverSource, /confirmExactDesignDnaSnapshot/, "server confirmation must use the exact-confirm gate");
  assert.match(apiSource, /JSON\.stringify\(\{ \.\.\.payload, snapshotRef \}\)/, "API client must transmit the reviewed snapshot ref");
  assert.match(appSource, /confirmDesignDna\(accountId, \{ id: reviewedRef\.id, hash: reviewedRef\.hash \}/, "front end must submit the exact ref that it rendered");
  assert.match(apiSource, /createDesignDna: \(id, payload\).*method: "POST"/, "API client must expose controlled Design DNA authoring");
  assert.match(serverSource, /DESIGN_DNA_SOURCE_ACCOUNT_MISMATCH/, "server must reject cross-account visual source IDs");
  assert.match(serverSource, /store\.designDnaSnapshots\.push\(snapshot\)/, "authoring must append a new snapshot");
  for (const fieldId of ["accountDnaColors", "accountDnaFonts", "accountDnaLayouts", "accountDnaMaterials", "accountDnaMediaDirection", "accountDnaForbidden", "accountDnaNotes", "accountDnaSourceList", "generateAccountDesignDna"]) {
    assert.match(appSource, new RegExp(fieldId), `front end must wire ${fieldId}`);
  }
  assert.match(appSource, /await loadAccountDesignDna\(accountId\)/, "front end must reload the exact ref after authoring");

  console.log(JSON.stringify({ status: "passed", pages: 8, initialCalls: 16, callsAfterRetry: providerCalls, candidates: 16, explicitFallbacks: 1, persistedVisualAsset: uploadedPptx.parseStatus, manifest: manifest.schema }));
} finally {
  if (localServer?.listening) await new Promise((resolve) => localServer.close(resolve));
  knowledgeDatabase?.close();
  await rm(root, { recursive: true, force: true });
}
