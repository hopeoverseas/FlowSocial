import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeliveryZip, renderContentDelivery, verifyDeliveryZipContents } from "../../artifact-engine.mjs";
import { applyWechatUploadResults } from "../../content-agent/wechat-illustrated-delivery.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixtureRoot = join(root, "scripts", "fixtures", "wechat-illustrated-delivery");
const source = JSON.parse(await readFile(join(fixtureRoot, "source-task.json"), "utf8"));
const article = (await readFile(join(fixtureRoot, "source-article.md"), "utf8")).replace(/\r?\n$/, "");
const articleSha256 = createHash("sha256").update(article).digest("hex");
const expectedArticleSha256 = "5814dda04f4b8e11957780f7288f79fef5e151777c136a68ca4e71c6c516d1c6";
if (articleSha256 !== expectedArticleSha256 || article.length !== 1879 || (article.match(/^##\s+/gm) || []).length !== 6) {
  throw Object.assign(new Error("权威公众号正文不可变校验失败"), { code: "WECHAT_HISTORICAL_ARTICLE_CHANGED" });
}

const task = structuredClone(source.task);
task.currentContent.article_markdown = article;
task.status = "succeeded";
task.qualityReview = { status: "passed", blockers: [] };
const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const runRoot = join(root, ".tmp", "fs-v1-wechat-content-12", runId);
const downloadRoot = join(runRoot, "downloads");
await mkdir(downloadRoot, { recursive: true });
process.env.WECHAT_ILLUSTRATED_DELIVERY_V1 = "1";

const evidence = {
  schemaVersion: "1.0",
  workItem: "FS-V1-WECHAT-CONTENT-12",
  mode: "isolated_offline_illustrated_delivery",
  featureFlag: { name: "WECHAT_ILLUSTRATED_DELIVERY_V1", enabledForRun: true, default: false },
  source: { ...source.provenance, articleSha256, articleCharacters: article.length, h2Count: 6 },
  providerCalls: 0,
  networkCalls: 0,
  automaticRetries: 0,
  productionDatabaseWrites: 0,
  platformDraftWrites: 0,
  automaticPublication: false
};

try {
  const delivery = await renderContentDelivery(task, { root: runRoot });
  if (delivery.status !== "ready" || delivery.validation?.status !== "passed") throw Object.assign(new Error("公众号图文交付 Gate 未通过"), { details: delivery.validation });
  const packaged = await createDeliveryZip(task, { root: runRoot });
  const zipBytes = await readFile(packaged.path);
  const zipSha256 = createHash("sha256").update(zipBytes).digest("hex");
  if (zipSha256 !== packaged.sha256 || zipBytes.length !== packaged.bytes) throw new Error("ZIP 字节与 SHA-256 校验失败");
  const downloadedPath = join(downloadRoot, packaged.fileName);
  await copyFile(packaged.path, downloadedPath);
  const downloaded = await readFile(downloadedPath);
  if (createHash("sha256").update(downloaded).digest("hex") !== packaged.sha256) throw new Error("下载副本 SHA-256 校验失败");
  const versionRoot = join(runRoot, task.delivery.rootPath);
  const manifest = JSON.parse(await readFile(join(versionRoot, "manifest.json"), "utf8"));
  const unpackedVerification = verifyDeliveryZipContents(downloaded, manifest);
  const localHtml = await readFile(join(versionRoot, "wechat-paste.html"), "utf8");
  const simulatedResults = task.wechatDraftUploadPlan.steps.map((step) => step.role === "cover"
    ? { assetId: step.assetId, role: "cover", kind: "permanent_material_image", media_id: "offline_cover_media_id" }
    : { assetId: step.assetId, role: "inline", kind: "uploadimg", url: `https://mmbiz.qpic.cn/offline-fixture/${step.assetId}.png` });
  const draftSimulation = applyWechatUploadResults(localHtml, task.wechatDraftUploadPlan, simulatedResults);
  if (/src=["']assets\//.test(draftSimulation.html) || draftSimulation.html.includes(draftSimulation.thumb_media_id)) throw new Error("上传 Adapter 模拟仍残留本地 src 或混入封面 media_id");
  await writeFile(`${downloadedPath}.sha256`, `${packaged.sha256}  ${basename(downloadedPath)}\n`, "utf8");
  Object.assign(evidence, {
    result: "passed",
    contentTaskId: task.id,
    sourceContentTaskId: task.sourceContentTaskId,
    contentVersion: task.version,
    imagePlan: { planId: task.currentContent.image_plan.plan_id, cover: 1, inline: task.currentContent.image_plan.slots.length, status: task.wechatImagePlanValidation.status },
    qualityGates: task.wechatIllustratedQualityReport.gates,
    htmlValidation: delivery.validation,
    draftUpload: { status: "offline_adapter_simulation_passed", adapterPlan: task.wechatDraftUploadPlan, simulatedInlineReplacements: draftSimulation.replacedInlineImages, localSrcRemaining: false, coverMediaIdInArticleHtml: false, simulatedDraftHtmlSha256: createHash("sha256").update(draftSimulation.html).digest("hex"), autoPublish: false },
    package: { path: packaged.path, downloadedPath, fileName: packaged.fileName, bytes: packaged.bytes, sha256: packaged.sha256, zipVerification: unpackedVerification },
    preview: join(runRoot, task.delivery.rootPath, "wechat-preview.html"),
    mobileScreenshot: join(runRoot, task.delivery.rootPath, "wechat-mobile-preview-390.png"),
    completedAt: new Date().toISOString()
  });
  await writeFile(join(runRoot, "delivery-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  Object.assign(evidence, { result: "failed", failure: { message: error.message, code: error.code || null, details: error.details || null }, completedAt: new Date().toISOString() });
  await writeFile(join(runRoot, "delivery-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  throw error;
}
