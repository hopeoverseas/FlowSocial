import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildWechatPlatformDeliveryBundle, validatePlatformDeliveryBundle } from "./platform-delivery-bundle.mjs";
import { adaptWechatImagePlanOutput } from "./wechat-image-plan-adapter.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { getUnifiedContentArtifactState } from "./unified-content-artifact-store.mjs";
import { listUnifiedAtomicWechatReviewState } from "./content-review-store.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";


const ATOMIC_HASH = /^[a-f0-9]{64}$/;
const clone = (value) => structuredClone(value);
const persistedClone = (value) => JSON.parse(JSON.stringify(value));
const withPersistedHash = (value, field) => { const base = persistedClone(value); return { ...base, [field]: hashUnifiedContent(base) }; };
function atomicFail(code, message = code, statusCode = 400) { throw Object.assign(new Error(message), { code, statusCode }); }
function text(value, code) { if (typeof value !== "string" || !value.trim()) atomicFail(code); return value.trim(); }
function sameRef(left, right) { return Boolean(left && right && left.id === right.id && left.hash === right.hash); }
function atomicFactRef(value) { return { id: value.id, hash: value.factHash }; }
function validSelfHash(value, field) { if (!value || !ATOMIC_HASH.test(value[field] || "")) return false; const copy = clone(value); delete copy[field]; return hashUnifiedContent(copy) === value[field]; }
function validAtomicRef(value) { return Boolean(value && Object.keys(value).sort().join(",") === "hash,id" && typeof value.id === "string" && value.id.trim() && ATOMIC_HASH.test(value.hash || "")); }
function exactKeys(value, keys) { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",")); }

const PURPOSES = new Set(["explain", "prove", "compare", "pace", "mood"]);
const STRATEGIES = new Set(["authorized_asset", "html_chart", "generated_raster", "no_image"]);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const clean = (value) => String(value || "").trim();
const portable = (value) => String(value || "").replace(/\\/g, "/");
const safeAssetId = (value) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(clean(value));
const publishableVisibility = new Set(["public", "publishable", "anonymized"]);
const publishableUsage = new Set(["usable", "allowed", "approved", "publishable", "allowed_with_anonymization"]);

function sourceIsAuthorized(source) {
  if (!source || !publishableVisibility.has(source.visibility)) return false;
  return source.usage == null && source.contentUsage == null || publishableUsage.has(source.usage || source.contentUsage);
}

function claimBindingForSlot(task, slot) {
  const claimIds = slot.claim_ids || [];
  if (!claimIds.length) return { passed: true, claimIds: [], sourceIds: [] };
  const claims = task.currentContent?.claim_map || [];
  const claimById = new Map(claims.map((claim) => [claim.claim_id, claim]).filter(([id]) => clean(id)));
  const section = (task.confirmedOutline?.sections || []).find((item) => item.section_id === slot.after_section_id);
  const sectionClaims = new Set(section?.claim_ids || []);
  const sources = task.currentContent?.source_list || task.contentMaster?.source_list || [];
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  const failures = [];
  const sourceIds = new Set();
  for (const claimId of claimIds) {
    const claim = claimById.get(claimId);
    if (!claim) { failures.push({ claimId, reason: "claim_not_in_current_claim_map" }); continue; }
    if (!sectionClaims.has(claimId)) failures.push({ claimId, reason: "claim_not_bound_to_target_section" });
    const ids = claim.source_ids || [];
    if (!ids.length) failures.push({ claimId, reason: "claim_has_no_source" });
    for (const sourceId of ids) {
      sourceIds.add(sourceId);
      if (!sourceIsAuthorized(sourceById.get(sourceId))) failures.push({ claimId, sourceId, reason: "source_not_publishable_or_not_authorized" });
    }
  }
  return { passed: failures.length === 0, claimIds, sourceIds: [...sourceIds], failures };
}

function authorizedRegistryRecord(task, assetId) {
  const registry = Array.isArray(task.wechatAssetRegistry) ? task.wechatAssetRegistry : task.wechatAssetRegistry?.assets || [];
  const asset = registry.find((item) => item.assetId === assetId);
  const valid = Boolean(asset
    && asset.status === "approved"
    && clean(asset.license?.id)
    && asset.license?.allowsPublication === true
    && clean(asset.source?.ref)
    && /^[a-f0-9]{64}$/i.test(String(asset.source?.sha256 || ""))
    && clean(asset.relativePath)
    && !isAbsolute(asset.relativePath)
    && !portable(asset.relativePath).split("/").includes(".."));
  return { asset, valid };
}

export function wechatIllustratedDeliveryEnabled() {
  return !["", "0", "false", "off", "disabled"].includes(String(process.env.WECHAT_ILLUSTRATED_DELIVERY_V1 || "").toLowerCase());
}

export function evaluateWechatIllustratedQualityGates(assetRecords = []) {
  const gates = {
    ocr: assetRecords.length && assetRecords.every((asset) => String(asset.quality?.ocr).startsWith("passed")) ? "passed" : "failed",
    fact: assetRecords.length && assetRecords.every((asset) => String(asset.quality?.fact).startsWith("passed") || asset.quality?.fact === "not_applicable") ? "passed" : "failed",
    license: assetRecords.length && assetRecords.every((asset) => String(asset.quality?.license).startsWith("passed")) ? "passed" : "failed",
    visual: assetRecords.length && assetRecords.every((asset) => asset.quality?.visual === "passed") ? "passed" : "failed",
    mobile: assetRecords.length && assetRecords.every((asset) => asset.quality?.mobile === "passed") ? "passed" : "failed"
  };
  return { gates, status: Object.values(gates).every((status) => status === "passed") ? "passed" : "blocked", blockers: Object.entries(gates).filter(([, status]) => status !== "passed").map(([gate]) => gate) };
}

export function articleSectionIndex(task) {
  const outline = task.confirmedOutline?.sections || [];
  const byHeading = new Map(outline.map((item) => [clean(item.heading), item]));
  const headings = [...String(task.currentContent?.article_markdown || "").matchAll(/^##\s+(.+)$/gm)].map((match) => clean(match[1]));
  return headings.map((heading) => ({ heading, sectionId: byHeading.get(heading)?.section_id || null }));
}

export function validateWechatImagePlan(task) {
  const plan = task.currentContent?.image_plan;
  const checks = [];
  const fail = (check, detail) => checks.push({ check, result: "fail", detail });
  const pass = (check, detail) => checks.push({ check, result: "pass", detail });
  let canonicalPlan = null;
  try {
    canonicalPlan = adaptWechatImagePlanOutput(plan);
    pass("wechat_image_plan_contract", canonicalPlan.planId);
  } catch (error) {
    fail("wechat_image_plan_contract", { code: error.code || "WECHAT_IMAGE_PLAN_INVALID", details: error.details || null });
    const compatibilityChecks = {
      WECHAT_IMAGE_PLAN_SLOT_ID_DUPLICATE: "unique_slot_id",
      WECHAT_IMAGE_PLAN_SLOT_ID_REQUIRED: "unique_slot_id",
      WECHAT_IMAGE_PLAN_PURPOSE_INVALID: "slot_purpose",
      WECHAT_IMAGE_PLAN_STRATEGY_INVALID: "slot_strategy",
      WECHAT_IMAGE_PLAN_ASSET_ID_INVALID: "slot_asset_id",
      WECHAT_IMAGE_PLAN_ASSET_ID_CONFLICT: "slot_asset_id",
      WECHAT_IMAGE_PLAN_GENERATED_PROMPT_REQUIRED: "slot_prompt"
    };
    if (compatibilityChecks[error.code]) fail(compatibilityChecks[error.code], error.details || null);
  }
  const sections = articleSectionIndex(task);
  const knownSections = new Set(sections.map((item) => item.sectionId).filter(Boolean));
  const noAuthoritativeClaims = !(task.currentContent?.claim_map || []).length
    && (task.confirmedOutline?.sections || []).every((section) => !(section.claim_ids || []).length);
  const slots = canonicalPlan?.slots.filter((slot) => slot.strategy !== "no_image") || [];
  for (const slot of slots) {
    const legacyAnchor = clean(slot.afterSectionId).match(/^W(\d+)$/i);
    const projectedSectionId = legacyAnchor ? sections[Number(legacyAnchor[1]) - 1]?.sectionId : null;
    if (!knownSections.has(slot.afterSectionId) && projectedSectionId) {
      const previous = slot.afterSectionId;
      slot.afterSectionId = projectedSectionId;
      slot.source = { ...slot.source, after_section_id: projectedSectionId };
      pass("legacy_section_anchor_projection", { slotId: slot.slotId, from: previous, to: projectedSectionId });
    }
    if (noAuthoritativeClaims && slot.claimIds.length && slot.claimIds.every((claimId) => /^O\d+$/i.test(claimId))) {
      const ignored = [...slot.claimIds];
      slot.claimIds = [];
      slot.source = { ...slot.source, claim_ids: [] };
      pass("legacy_non_authoritative_claim_projection", { slotId: slot.slotId, ignored });
    }
  }
  if (!slots.length || sections.length && sections.every((item) => item.sectionId)) pass("section_heading_to_id_mapping", sections);
  else fail("section_heading_to_id_mapping", sections);
  const cover = canonicalPlan?.cover;
  if (!cover || cover.strategy === "no_image") pass("functional_cover_optional", "no_image");
  else if (STRATEGIES.has(cover.strategy) && safeAssetId(cover.assetId)) pass("functional_cover_declared", cover.assetId);
  else fail("functional_cover_declared", cover || null);
  pass("inline_image_count_contract_driven", slots.length);
  const ids = new Set();
  for (const slot of slots) {
    if (!clean(slot.slotId) || ids.has(slot.slotId)) fail("unique_slot_id", slot.slotId || null);
    else { ids.add(slot.slotId); pass("unique_slot_id", slot.slotId); }
    if (!knownSections.has(slot.afterSectionId)) fail("slot_section_anchor", { slotId: slot.slotId, afterSectionId: slot.afterSectionId });
    else pass("slot_section_anchor", { slotId: slot.slotId, afterSectionId: slot.afterSectionId });
    if (!PURPOSES.has(slot.purpose)) fail("slot_purpose", { slotId: slot.slotId, purpose: slot.purpose });
    else pass("slot_purpose", { slotId: slot.slotId, purpose: slot.purpose });
    if (!STRATEGIES.has(slot.strategy) || slot.strategy === "no_image") fail("slot_strategy", { slotId: slot.slotId, strategy: slot.strategy });
    else pass("slot_strategy", { slotId: slot.slotId, strategy: slot.strategy });
    if (!Array.isArray(slot.claimIds)) fail("slot_claim_ids", { slotId: slot.slotId });
    else pass("slot_claim_ids", { slotId: slot.slotId, claimIds: slot.claimIds });
    const legacySlot = { ...slot.source, slot_id: slot.slotId, after_section_id: slot.afterSectionId, asset_id: slot.assetId, claim_ids: slot.claimIds };
    const claimBinding = claimBindingForSlot(task, legacySlot);
    if (!claimBinding.passed) fail("slot_claim_binding", { slotId: slot.slotId, ...claimBinding });
    else pass("slot_claim_binding", { slotId: slot.slotId, claimIds: claimBinding.claimIds, sourceIds: claimBinding.sourceIds });
    if (!safeAssetId(slot.assetId)) fail("slot_asset_id", { slotId: slot.slotId, assetId: slot.assetId || null });
    else pass("slot_asset_id", { slotId: slot.slotId, assetId: slot.assetId });
  }
  const blockers = checks.filter((item) => item.result === "fail").map((item) => item.check);
  return { status: blockers.length ? "needs_review" : "passed", checks, blockers: [...new Set(blockers)], sectionIndex: sections, canonicalPlan };
}

function infographicHtml(spec, { width, height }) {
  const palette = spec.palette || { ink: "#17352d", paper: "#f5f1e8", accent: "#ef6a4c", mint: "#7fa991", gold: "#d8a84e" };
  const items = (spec.items || []).slice(0, 6);
  const cards = items.map((item, index) => `<article><b>${escapeHtml(item.label || String(index + 1).padStart(2, "0"))}</b><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail || "")}</p></article>`).join("");
  const kindClass = escapeHtml(spec.kind || "grid");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:"Microsoft YaHei","PingFang SC",sans-serif}body{background:${palette.paper};color:${palette.ink};position:relative}.noise{position:absolute;inset:0;background:radial-gradient(circle at 86% 14%,${palette.gold}55 0,transparent 28%),radial-gradient(circle at 12% 84%,${palette.mint}55 0,transparent 34%)}main{position:absolute;inset:54px 64px;border:2px solid ${palette.ink}22;border-radius:30px;padding:48px 54px;background:#ffffffd9;box-shadow:0 20px 70px #17352d1a}.kicker{font-size:20px;letter-spacing:4px;color:${palette.accent};font-weight:800}.title{margin:18px 0 12px;max-width:930px;font-size:${spec.kind === "cover" ? 56 : 42}px;line-height:1.2;letter-spacing:-1px}.subtitle{margin:0;max-width:920px;color:#52655e;font-size:24px;line-height:1.55}.cards{display:grid;grid-template-columns:repeat(${items.length === 3 ? 3 : 2},1fr);gap:20px;margin-top:36px}.cards article{min-height:${items.length <= 3 ? 220 : 150}px;padding:24px;border-radius:20px;background:${palette.paper};border:1px solid ${palette.ink}18}.cards b{display:inline-block;color:${palette.accent};font-size:18px;letter-spacing:2px}.cards h3{margin:12px 0 8px;font-size:27px;line-height:1.25}.cards p{margin:0;color:#53665e;font-size:19px;line-height:1.5}.cover .cards{margin-top:42px;grid-template-columns:repeat(3,1fr)}.cover .cards article{min-height:150px}.cover main:after{content:"";position:absolute;right:46px;top:42px;width:82px;height:82px;border-radius:50%;border:16px solid ${palette.accent};border-left-color:transparent}.footer{position:absolute;left:54px;bottom:28px;color:#6f7d77;font-size:17px;letter-spacing:2px}
</style></head><body class="${kindClass}"><div class="noise"></div><main><div class="kicker">${escapeHtml(spec.kicker || "FLOWSOCIAL · 方法图解")}</div><h1 class="title">${escapeHtml(spec.title)}</h1><p class="subtitle">${escapeHtml(spec.subtitle || "")}</p><section class="cards">${cards}</section><div class="footer">${escapeHtml(spec.footer || "大卖数智 · AI 数智官")}</div></main></body></html>`;
}

async function renderInfographic(sourcePath, targetPath, spec, dimensions) {
  await writeFile(sourcePath, infographicHtml(spec, dimensions), "utf8");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: dimensions, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(sourcePath).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts?.ready);
    const measurement = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      overflows: [
        ...[...document.querySelectorAll("main,article")].filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1),
        ...[...document.querySelectorAll("h1,h3,p")].filter((node) => node.scrollWidth > node.clientWidth + 1)
      ].map((node) => node.tagName)
    }));
    await page.screenshot({ path: targetPath, type: "png" });
    return measurement;
  } finally {
    await browser.close();
  }
}

function compileSectionInfographic(task, item) {
  const section = (task.confirmedOutline?.sections || []).find((candidate) => candidate.section_id === item.after_section_id);
  const points = Array.isArray(section?.key_points) ? section.key_points.map(clean).filter(Boolean) : [];
  if (!section || points.length < 2) return null;
  return {
    kind: "grid",
    kicker: "内容图解",
    title: clean(section.heading),
    subtitle: clean(section.objective),
    items: points.slice(0, 6).map((point, index) => {
      const [title, ...detail] = point.split(/[：:]/);
      return { label: String(index + 1).padStart(2, "0"), title: clean(title) || point, detail: clean(detail.join("：")) };
    }),
    footer: "验收标准 · 业务评估"
  };
}

export async function materializeWechatAssets(task, { root, versionRoot }) {
  const validation = validateWechatImagePlan(task);
  if (validation.status !== "passed") throw Object.assign(new Error(`公众号插图计划未通过：${validation.blockers.join("、")}`), { code: "WECHAT_IMAGE_PLAN_INVALID", statusCode: 409, details: validation });
  const declarations = validation.canonicalPlan.declarations.filter((item) => item.strategy !== "no_image").map((item) => ({ ...item.source, slot_id: item.slotId, role: item.role, after_section_id: item.afterSectionId, asset_id: item.assetId, claim_ids: item.claimIds, prompt: item.imageSpec?.prompt || item.source.prompt }));
  const sourceDir = join(versionRoot, "wechat-visual-sources");
  const assetDir = join(versionRoot, "assets");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(assetDir, { recursive: true });
  const records = [];
  for (const item of declarations) {
    const assetId = item.asset_id;
    let outputPath;
    let measurement = null;
    let strategyEvidence;
    let registryEvidence = null;
    let sourceAsset = null;
    if (item.strategy === "html_chart") {
      const spec = task.wechatDeterministicAssets?.[assetId] || compileSectionInfographic(task, item);
      if (!spec) throw Object.assign(new Error(`确定性图片缺少资产定义：${assetId}`), { code: "WECHAT_DETERMINISTIC_ASSET_MISSING", statusCode: 409 });
      const dimensions = item.slot_id === "cover" || item.role === "cover" ? { width: 1200, height: 628 } : { width: 1200, height: 800 };
      const sourcePath = join(sourceDir, `${assetId}.html`);
      outputPath = join(assetDir, `${assetId}.png`);
      measurement = await renderInfographic(sourcePath, outputPath, spec, dimensions);
      strategyEvidence = "deterministic_html_to_png";
    } else {
      if (item.strategy === "authorized_asset") {
        const resolved = authorizedRegistryRecord(task, assetId);
        if (!resolved.valid) throw Object.assign(new Error(`授权图片 Registry、approved、license 或 source 不完整：${assetId}`), { code: "WECHAT_AUTHORIZED_ASSET_INELIGIBLE", statusCode: 409, details: { assetId, registryEntry: resolved.asset || null } });
        sourceAsset = resolved.asset;
        registryEvidence = { status: sourceAsset.status, licenseId: sourceAsset.license.id, sourceRef: sourceAsset.source.ref, declaredSha256: sourceAsset.source.sha256 };
      } else {
        sourceAsset = (task.generatedAssets || []).find((candidate) => candidate.version === task.version && candidate.assetId === assetId && candidate.status === "succeeded" && candidate.relativePath);
        if (!sourceAsset) throw Object.assign(new Error(`图片资产尚未就绪：${assetId}`), { code: "WECHAT_IMAGE_ASSET_NOT_READY", statusCode: 409 });
      }
      const sourcePath = join(root, sourceAsset.relativePath);
      const extension = [".png", ".jpg", ".jpeg", ".webp"].includes(extname(sourcePath).toLowerCase()) ? extname(sourcePath).toLowerCase() : ".png";
      outputPath = join(assetDir, `${assetId}${extension}`);
      if (sourcePath !== outputPath) await copyFile(sourcePath, outputPath);
      strategyEvidence = item.strategy;
    }
    const bytes = await readFile(outputPath);
    const info = await stat(outputPath);
    if (!info.isFile() || bytes.length < 1024) throw Object.assign(new Error(`图片资产异常：${assetId}`), { code: "WECHAT_IMAGE_ASSET_INVALID", statusCode: 409 });
    if (registryEvidence && sha256(bytes) !== registryEvidence.declaredSha256) throw Object.assign(new Error(`授权图片 source SHA-256 不匹配：${assetId}`), { code: "WECHAT_AUTHORIZED_ASSET_SOURCE_MISMATCH", statusCode: 409, details: { assetId, expected: registryEvidence.declaredSha256, actual: sha256(bytes) } });
    const claimBinding = item.after_section_id ? claimBindingForSlot(task, item) : { passed: true, claimIds: [], sourceIds: [] };
    const reviewedQuality = sourceAsset?.qualityReview || sourceAsset?.quality || {};
    const nonDeterministicOcr = reviewedQuality.ocr === "passed" || reviewedQuality.ocrStatus === "passed" ? "passed_reviewed_asset" : "needs_review";
    const nonDeterministicFact = (item.claim_ids || []).length ? reviewedQuality.fact === "passed" || reviewedQuality.factStatus === "passed" ? "passed_reviewed_asset_and_claim_binding" : "needs_review" : "not_applicable";
    const nonDeterministicVisual = reviewedQuality.visual === "passed" || reviewedQuality.visualStatus === "passed" ? "passed" : "needs_review";
    const generatedLicense = sourceAsset?.license?.allowsPublication === true && clean(sourceAsset?.license?.id) ? "passed_generated_asset_license" : "needs_review";
    records.push({
      assetId,
      slotId: item.slot_id || "cover",
      role: item.slot_id === "cover" || item.role === "cover" ? "cover" : "inline",
      afterSectionId: item.after_section_id || null,
      purpose: item.purpose,
      strategy: item.strategy,
      strategyEvidence,
      registryEvidence,
      claimIds: item.claim_ids || [],
      caption: item.caption || "",
      path: portable(relative(versionRoot, outputPath)),
      bytes: bytes.length,
      sha256: sha256(bytes),
      measurement,
      quality: {
        ocr: item.strategy === "html_chart" ? "passed_deterministic_text_source" : nonDeterministicOcr,
        fact: item.strategy === "html_chart" ? (item.claim_ids || []).length && claimBinding.passed ? "passed_claim_binding" : "not_applicable" : nonDeterministicFact,
        license: item.strategy === "html_chart" ? "passed_original_deterministic" : item.strategy === "authorized_asset" ? "passed_registry_license_and_source" : generatedLicense,
        visual: item.strategy === "html_chart" ? measurement?.overflows?.length ? "failed" : "passed" : nonDeterministicVisual,
        mobile: "pending_preview_measurement"
      }
    });
  }
  return { records, validation };
}

function markdownBlocks(task, assetRecords) {
  const outlineByHeading = new Map((task.confirmedOutline?.sections || []).map((item) => [clean(item.heading), item.section_id]));
  const slotBySection = new Map(assetRecords.filter((item) => item.role === "inline").map((item) => [item.afterSectionId, item]));
  const lines = String(task.currentContent?.article_markdown || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let paragraph = [];
  let activeSectionId = null;
  const flush = () => { if (paragraph.length) { blocks.push(`<p style="margin:16px 0;line-height:1.9;color:#29332f">${escapeHtml(paragraph.join(" "))}</p>`); paragraph = []; } };
  const closeSection = () => {
    flush();
    const asset = slotBySection.get(activeSectionId);
    if (asset) blocks.push(`<figure data-slot-id="${escapeHtml(asset.slotId)}" data-after-section-id="${escapeHtml(activeSectionId)}" style="margin:28px 0 34px"><img src="${escapeHtml(asset.path)}" alt="${escapeHtml(asset.caption)}" style="display:block;width:100%;height:auto;border-radius:12px"/><figcaption style="margin-top:9px;color:#76827c;font-size:13px;line-height:1.55;text-align:center">${escapeHtml(asset.caption)}</figcaption></figure>`);
  };
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (activeSectionId) closeSection(); else flush();
      const title = clean(heading[1]);
      activeSectionId = outlineByHeading.get(title) || null;
      blocks.push(`<h2 data-section-id="${escapeHtml(activeSectionId || "")}" style="margin:38px 0 16px;font-size:22px;line-height:1.45;color:#17352d">${escapeHtml(title)}</h2>`);
    } else if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  closeSection();
  return blocks.join("\n");
}

export function buildWechatIllustratedHtml(task, assetRecords) {
  const article = task.currentContent || {};
  const cover = assetRecords.find((item) => item.role === "cover");
  const coverMarkup = cover ? `<figure data-slot-id="cover" style="margin:0 0 28px"><img src="${escapeHtml(cover.path)}" alt="${escapeHtml(cover.caption)}" style="display:block;width:100%;height:auto;border-radius:12px"/><figcaption style="margin-top:9px;color:#76827c;font-size:13px;line-height:1.55;text-align:center">${escapeHtml(cover.caption)}</figcaption></figure>` : "";
  return `<section style="max-width:677px;margin:0 auto;color:#252a26;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;font-size:16px;line-height:1.85;word-break:break-word"><h1 style="margin:0 0 24px;font-size:28px;line-height:1.35;color:#18352d">${escapeHtml(article.recommended_title || task.ideaTitle)}</h1>${coverMarkup}<p style="margin:0 0 28px;padding:16px 18px;background:#f3f6f4;color:#53625a;border-left:4px solid #5b8f77">${escapeHtml(article.abstract || article.article_promise || "")}</p>${markdownBlocks(task, assetRecords)}<p style="margin-top:36px;padding-top:20px;border-top:1px solid #dfe5e1;color:#5b6b62">${escapeHtml(article.cta || "")}</p></section>`;
}

export function buildWechatUploadAdapter(task, assetRecords) {
  return {
    schemaVersion: "1.0",
    kind: "WechatDraftImageUploadPlan",
    contentTaskId: task.id,
    contentVersion: task.version,
    autoPublish: false,
    productionWrite: false,
    steps: assetRecords.map((asset) => asset.role === "cover"
      ? { assetId: asset.assetId, role: "cover", localPath: asset.path, endpointRole: "permanent_material_image", requiredResultField: "media_id", draftField: "thumb_media_id" }
      : { assetId: asset.assetId, role: "inline", localPath: asset.path, endpointRole: "uploadimg", requiredResultField: "url", replaceHtmlSrc: asset.path, rejectIfUrlMissing: true }),
    invariants: ["封面只使用 media_id 写入草稿 thumb_media_id", "正文图片必须先 uploadimg 并用返回 URL 替换本地 src", "禁止把本地相对路径或任意外链写入真实草稿", "本计划不执行上传、不创建草稿、不发布"]
  };
}

export function applyWechatUploadResults(html, uploadPlan, results) {
  const fail = (message, details) => { throw Object.assign(new Error(message), { code: "WECHAT_UPLOAD_ADAPTER_INVALID", statusCode: 409, details }); };
  if (uploadPlan?.kind !== "WechatDraftImageUploadPlan" || uploadPlan.autoPublish !== false || uploadPlan.productionWrite !== false) fail("公众号上传计划合同无效", uploadPlan);
  const byAsset = new Map();
  for (const result of results || []) {
    if (!clean(result.assetId) || byAsset.has(result.assetId)) fail("上传结果 assetId 缺失或重复", result);
    byAsset.set(result.assetId, result);
  }
  if (byAsset.size !== uploadPlan.steps.length) fail("上传结果数量与计划不一致", { expected: uploadPlan.steps.length, actual: byAsset.size });
  let draftHtml = String(html || "");
  let thumbMediaId = null;
  for (const step of uploadPlan.steps) {
    const result = byAsset.get(step.assetId);
    if (!result || result.role !== step.role) fail("上传结果角色与计划不一致", { step, result: result || null });
    if (step.role === "cover") {
      if (result.kind !== "permanent_material_image" || !clean(result.media_id) || result.url != null) fail("封面必须且只能返回永久图片素材 media_id", result);
      thumbMediaId = clean(result.media_id);
      draftHtml = draftHtml.replace(/<figure\b[^>]*data-slot-id=["']cover["'][\s\S]*?<\/figure>/i, "");
    } else {
      let uploadUrl = null;
      try { uploadUrl = new URL(String(result.url || "")); } catch {}
      const uploadHostAllowed = uploadUrl?.protocol === "https:" && ["mmbiz.qpic.cn", "mmbiz.qlogo.cn"].includes(uploadUrl.hostname.toLowerCase());
      if (result.kind !== "uploadimg" || result.media_id != null || !uploadHostAllowed) fail("正文图片必须且只能返回微信 uploadimg HTTPS URL", result);
      const localSrc = `src="${step.replaceHtmlSrc}"`;
      if (!draftHtml.includes(localSrc)) fail("正文 HTML 缺少待替换的本地图片引用", step);
      draftHtml = draftHtml.split(localSrc).join(`src="${escapeHtml(result.url)}"`);
    }
  }
  if (!thumbMediaId) fail("封面 media_id 缺失", null);
  if (/\bsrc=["'](?:assets\/|\.\.?\/|file:|data:)/i.test(draftHtml)) fail("上传替换后正文仍残留本地或不可发布 src", null);
  if (draftHtml.includes(thumbMediaId)) fail("封面 media_id 不得混入正文 HTML", null);
  return { schemaVersion: "1.0", status: "ready_for_draft_create", thumb_media_id: thumbMediaId, html: draftHtml, autoPublish: false, productionWrite: false, replacedInlineImages: uploadPlan.steps.filter((item) => item.role === "inline").length };
}

export async function validateWechatIllustratedOutput({ html, task, assetRecords, versionRoot, previewPath }) {
  const checks = [];
  const add = (check, ok, detail = null) => checks.push({ check, result: ok ? "pass" : "fail", detail });
  add("no_script_or_style_tag", !/<(?:script|style)\b/i.test(html));
  add("no_class_or_id", !/\s(?:class|id)=/i.test(html));
  add("no_external_dependency", !/(?:src|href)=["']https?:/i.test(html));
  add("title_matches_package", html.includes(escapeHtml(task.currentContent?.recommended_title || task.ideaTitle)));
  add("article_length", String(task.currentContent?.article_markdown || "").length >= 1200);
  add("h2_count", (String(task.currentContent?.article_markdown || "").match(/^##\s+/gm) || []).length >= 3);
  add("figure_img_figcaption", (html.match(/<figure\b/g) || []).length === assetRecords.length && (html.match(/<img\b/g) || []).length === assetRecords.length && (html.match(/<figcaption\b/g) || []).length === assetRecords.length);
  for (const asset of assetRecords) {
    const path = join(versionRoot, asset.path);
    const bytes = await readFile(path).catch(() => null);
    add("packaged_image_resolves", Boolean(bytes && sha256(bytes) === asset.sha256), { assetId: asset.assetId, path: asset.path });
    if (asset.role === "inline") {
      const headingPosition = html.indexOf(`data-section-id="${asset.afterSectionId}"`);
      const figurePosition = html.indexOf(`data-slot-id="${asset.slotId}"`);
      add("figure_after_exact_section", headingPosition >= 0 && figurePosition > headingPosition, { slotId: asset.slotId, sectionId: asset.afterSectionId });
    }
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const measurements = [];
    for (const width of [320, 375, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(previewPath).href, { waitUntil: "load" });
      await page.evaluate(() => document.fonts?.ready);
      const mobile = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute("src")),
        overflowingElements: [...document.querySelectorAll("section,h1,h2,p,figure,img,figcaption")].filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.tagName)
      }));
      measurements.push({ width, ...mobile });
      if (width === 390) {
        const screenshotPath = join(versionRoot, "wechat-mobile-preview-390.png");
        await page.screenshot({ path: screenshotPath, type: "png", fullPage: true });
        add("mobile_preview_screenshot", true, portable(relative(versionRoot, screenshotPath)));
      }
      await page.close();
    }
    const brokenImages = [...new Set(measurements.flatMap((item) => item.brokenImages))];
    add("mobile_no_horizontal_overflow", measurements.every((item) => item.documentWidth <= item.viewportWidth && item.overflowingElements.length === 0), measurements);
    add("mobile_no_broken_images", brokenImages.length === 0, brokenImages);
    for (const asset of assetRecords) asset.quality.mobile = brokenImages.includes(asset.path) ? "failed" : brokenImages.length ? "needs_review" : "passed";
  } finally {
    await browser.close();
  }
  const blockers = checks.filter((item) => item.result === "fail").map((item) => item.check);
  return { status: blockers.length ? "needs_review" : "passed", checks, blockers: [...new Set(blockers)] };
}

export async function verifyHistoricalArticle(articlePath, expectedSha256) {
  const bytes = await readFile(articlePath);
  const actual = sha256(bytes);
  if (actual !== expectedSha256) throw Object.assign(new Error("冻结公众号正文 SHA-256 不匹配"), { code: "WECHAT_HISTORICAL_ARTICLE_CHANGED", statusCode: 409, details: { expectedSha256, actualSha256: actual, file: basename(articlePath) } });
  return { path: articlePath, sha256: actual, bytes: bytes.length };
}

export function buildWechatUserFriendlyDelivery(input) {
  return buildWechatPlatformDeliveryBundle(input);
}

// Atomic WeChat deliberately keeps resource upload separate from draft creation and publication.
function requireAtomicWechatDeliveryFlags(flags, { promotionOnly = false } = {}) {
  const enabled = promotionOnly
    ? flags.localContentPromotionV1 === true
    : flags.unifiedContentAtomicWechatPromotionUploadDeliveryV1 === true;
  if (!enabled) atomicFail(
    promotionOnly ? "ATOMIC_WECHAT_LOCAL_PROMOTION_DISABLED" : "ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_DISABLED",
    promotionOnly ? "Atomic WeChat local promotion is disabled" : "Atomic WeChat promotion/upload/delivery is disabled",
    404
  );
  if (flags.unifiedContentAtomicProductV1 !== true || flags.unifiedContentAtomicWechatProductV1 !== true
    || flags.unifiedContentAtomicWechatArtifactV1 !== true || flags.unifiedContentAtomicWechatHumanSelectionV1 !== true) {
    atomicFail("ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_PREREQUISITES_REQUIRED", "Atomic WeChat prerequisites are disabled", 409);
  }
}

function validAtomicWechatFact(value, contract) {
  return value?.contract === contract && validSelfHash(value, "factHash");
}

function validateAtomicWechatVersion(value) {
  if (!validSelfHash(value, "versionHash") || value.contract !== "AtomicWechatImmutableContentVersion@1.0" || value.immutable !== true) atomicFail("ATOMIC_WECHAT_PROMOTED_VERSION_INVALID", "Promoted version is invalid", 409);
  const request = clone(value);
  for (const key of ["id", "immutable", "preflightInputHash", "idempotencyKey", "promotedAt", "versionHash"]) delete request[key];
  request.contract = "AtomicWechatContentPromotionRequest@1.0";
  if (hashUnifiedContent(request) !== value.preflightInputHash) atomicFail("ATOMIC_WECHAT_PROMOTED_VERSION_CLOSURE_INVALID", "Promoted version does not close over its preflight", 409);
  return value;
}

function validateAtomicWechatPromotion(value) {
  if (!validSelfHash(value, "promotionHash") || value.contract !== "AtomicWechatPromotionRecord@1.0"
    || !validAtomicRef(value.promotedVersionRef) || value.resourceUploadPerformed !== false
    || value.draftCreated !== false || value.platformPublicationPerformed !== false) atomicFail("ATOMIC_WECHAT_PROMOTION_RECORD_INVALID", "Stored promotion is invalid", 409);
  return value;
}

function validWechatUploadUrl(value) {
  try { const parsed = new URL(value); return parsed.protocol === "https:" && ["mmbiz.qpic.cn", "mmbiz.qlogo.cn"].includes(parsed.hostname.toLowerCase()); }
  catch { return false; }
}

function validateAtomicWechatUploadPlan(value) {
  const keys = ["schemaVersion", "contract", "id", "workspaceId", "companyId", "accountId", "platform", "contentProjectRef", "materializedContentProjectRef", "commitRef", "platformRunRef", "articleRef", "article", "promotionRef", "promotedVersionRef", "planFactRef", "formatFactRef", "preUploadRef", "sourceHtml", "steps", "claims", "inputHash", "actorId", "actorType", "approved", "occurredAt", "requestHash", "idempotencyKey", "recordedAt", "draftCreationAuthorized", "publicationAuthorized", "planHash"];
  if (!exactKeys(value, keys) || !validSelfHash(value, "planHash") || value.schemaVersion !== "1.0" || value.contract !== "AtomicWechatApprovedResourceUploadPlan@1.0") atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_HASH_INVALID", "Stored approved upload plan is invalid", 409);
  if (value.approved !== true || value.actorType !== "user" || value.draftCreationAuthorized !== false || value.publicationAuthorized !== false) atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_APPROVAL_INVALID", "Stored upload approval is invalid", 409);
  if (!validAtomicRef(value.promotionRef) || !validAtomicRef(value.promotedVersionRef) || !ATOMIC_HASH.test(value.inputHash || "")) atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_REFS_INVALID", "Stored upload plan refs are invalid", 409);
  if (value.requestHash !== hashUnifiedContent({ inputHash: value.inputHash, actorId: value.actorId, actorType: "user", approved: true, occurredAt: value.occurredAt })) atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_REQUEST_INVALID", "Stored upload plan request is invalid", 409);
  if (!Array.isArray(value.steps) || value.steps.some((step, index) => step.ordinal !== index + 1 || !["cover", "inline"].includes(step.role)
    || step.operation !== (step.role === "cover" ? "wechat_permanent_material_upload_for_thumb_media_id" : "wechat_uploadimg_for_https_body_url")
    || !ATOMIC_HASH.test(step.sha256 || "") || !validAtomicRef(step.sourceAttemptRef))) atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_STEPS_INVALID", "Stored upload plan steps are invalid", 409);
  return value;
}

function executionRequestHash(plan) {
  return hashUnifiedContent({ uploadPlanRef: { id: plan.id, hash: plan.planHash }, promotionRef: plan.promotionRef, promotedVersionRef: plan.promotedVersionRef, steps: plan.steps });
}

function validateAttempt(attempt, step, expectedStatus) {
  const baseKeys = ["ordinal", "assetId", "role", "relativePath", "bytes", "sha256", "sourceAttemptRef", "operation"];
  const keys = expectedStatus === "succeeded" ? [...baseKeys, "status", "response", "responseHash"] : [...baseKeys, "status", "failure"];
  if (!exactKeys(attempt, keys) || attempt.status !== expectedStatus
    || baseKeys.some((key) => hashUnifiedContent(attempt[key]) !== hashUnifiedContent(step[key]))) atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_ATTEMPT_INVALID", "Stored upload attempt is invalid", 409);
  if (expectedStatus === "failed") {
    if (!exactKeys(attempt.failure, ["code"]) || typeof attempt.failure.code !== "string" || !attempt.failure.code.trim()) atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_FAILURE_INVALID", "Stored upload failure is invalid", 409);
  } else if (attempt.role === "cover") {
    if (!exactKeys(attempt.response, ["mediaId"]) || typeof attempt.response.mediaId !== "string" || !attempt.response.mediaId.trim()
      || attempt.responseHash !== hashUnifiedContent({ mediaId: attempt.response.mediaId })) atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_RESPONSE_INVALID", "Stored cover response is invalid", 409);
  } else if (!exactKeys(attempt.response, ["url"]) || !validWechatUploadUrl(attempt.response.url)
    || attempt.responseHash !== hashUnifiedContent({ url: attempt.response.url })) atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_RESPONSE_INVALID", "Stored inline response is invalid", 409);
  return attempt;
}

function validateAtomicWechatUploadExecution(value, plan) {
  validateAtomicWechatUploadPlan(plan);
  const hasFailure = value?.status === "postprocess_failure";
  const keys = ["schemaVersion", "contract", "id", "uploadPlanRef", "promotionRef", "promotedVersionRef", "requestHash", "idempotencyKey", "status", "attempts", "resourceUploadPerformed", "draftCreated", "platformPublicationPerformed", "recordedAt", ...(hasFailure ? ["failure"] : []), "factHash"];
  const requestHash = executionRequestHash(plan);
  if (!exactKeys(value, keys) || !validAtomicWechatFact(value, "AtomicWechatResourceUploadExecution@1.0")
    || !sameRef(value.uploadPlanRef, { id: plan.id, hash: plan.planHash }) || !sameRef(value.promotionRef, plan.promotionRef)
    || !sameRef(value.promotedVersionRef, plan.promotedVersionRef) || value.requestHash !== requestHash
    || value.id !== `atomic-wechat-upload-execution:${hashUnifiedContent({ requestHash, idempotencyKey: value.idempotencyKey }).slice(0, 24)}`
    || !["succeeded", "partial_failure", "postprocess_failure"].includes(value.status) || !Array.isArray(value.attempts)
    || value.resourceUploadPerformed !== (value.attempts.length > 0) || value.draftCreated !== false || value.platformPublicationPerformed !== false) {
    atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_INVALID", "Stored upload execution is invalid", 409);
  }
  if (value.status === "succeeded" || value.status === "postprocess_failure") {
    if (value.attempts.length !== plan.steps.length) atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_ATTEMPT_SET_INVALID", "Successful transport attempts must cover the plan", 409);
    value.attempts.forEach((attempt, index) => validateAttempt(attempt, plan.steps[index], "succeeded"));
  } else {
    if (!value.attempts.length || value.attempts.length > plan.steps.length) atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_ATTEMPT_SET_INVALID", "Partial attempts must be an ordered plan prefix", 409);
    value.attempts.forEach((attempt, index) => validateAttempt(attempt, plan.steps[index], index === value.attempts.length - 1 ? "failed" : "succeeded"));
  }
  if (hasFailure && (!exactKeys(value.failure, ["code"]) || typeof value.failure.code !== "string" || !value.failure.code.trim())) atomicFail("ATOMIC_WECHAT_UPLOAD_POSTPROCESS_FAILURE_INVALID", "Postprocess failure evidence is invalid", 409);
  return value;
}

function validateAtomicWechatUploadEvidence(value, plan, execution) {
  validateAtomicWechatUploadExecution(execution, plan);
  const keys = ["schemaVersion", "contract", "id", "uploadPlanRef", "executionRef", "promotionRef", "promotedVersionRef", "resources", "sourceHtmlSha256", "finalHtmlSha256", "finalHtmlBytes", "semantics", "draftCreated", "platformPublicationPerformed", "recordedAt", "factHash"];
  if (!exactKeys(value, keys) || !validAtomicWechatFact(value, "AtomicWechatResourceUploadEvidence@1.0") || execution.status !== "succeeded"
    || value.id !== `atomic-wechat-upload-evidence:${execution.factHash.slice(0, 24)}` || !sameRef(value.uploadPlanRef, { id: plan.id, hash: plan.planHash })
    || !sameRef(value.executionRef, atomicFactRef(execution)) || !sameRef(value.promotionRef, plan.promotionRef) || !sameRef(value.promotedVersionRef, plan.promotedVersionRef)
    || hashUnifiedContent(value.resources) !== hashUnifiedContent(execution.attempts) || value.sourceHtmlSha256 !== plan.sourceHtml.sha256
    || !ATOMIC_HASH.test(value.finalHtmlSha256 || "") || !Number.isInteger(value.finalHtmlBytes) || value.finalHtmlBytes < 1
    || value.semantics !== "wechat_resources_uploaded_content_not_published" || value.draftCreated !== false || value.platformPublicationPerformed !== false) {
    atomicFail("ATOMIC_WECHAT_UPLOAD_EVIDENCE_INVALID", "Stored upload evidence is invalid", 409);
  }
  return value;
}

function validateAtomicWechatPostUpload(value, plan, execution, evidence) {
  validateAtomicWechatUploadEvidence(evidence, plan, execution);
  const keys = ["schemaVersion", "contract", "id", "workspaceId", "companyId", "accountId", "platform", "contentProjectRef", "materializedContentProjectRef", "platformRunRef", "candidateRef", "articleRef", "commitRef", "imagePlanRef", "kind", "semantics", "predecessorRef", "evidenceRef", "promotionRef", "promotedVersionRef", "html", "htmlSha256", "htmlBytes", "finalBundleAuthority", "draftCreated", "platformPublicationPerformed", "idempotencyKey", "recordedAt", "factHash"];
  if (!exactKeys(value, keys) || !validAtomicWechatFact(value, "WechatPostUploadArtifactFact@1.0")
    || value.id !== `wechat-post-upload:${evidence.factHash.slice(0, 24)}` || value.kind !== "post_upload"
    || value.workspaceId !== plan.workspaceId || value.companyId !== plan.companyId || value.accountId !== plan.accountId || value.platform !== "wechat"
    || !sameRef(value.contentProjectRef, plan.contentProjectRef) || !sameRef(value.materializedContentProjectRef, plan.materializedContentProjectRef)
    || !sameRef(value.platformRunRef, plan.platformRunRef) || !sameRef(value.candidateRef, plan.articleRef) || !sameRef(value.articleRef, plan.articleRef)
    || !sameRef(value.commitRef, plan.commitRef) || !sameRef(value.imagePlanRef, plan.planFactRef) || !sameRef(value.predecessorRef, plan.formatFactRef)
    || !sameRef(value.evidenceRef, atomicFactRef(evidence)) || !sameRef(value.promotionRef, plan.promotionRef) || !sameRef(value.promotedVersionRef, plan.promotedVersionRef)
    || value.semantics !== "wechat_resources_uploaded_content_not_published" || typeof value.html !== "string" || !value.html.length
    || value.htmlSha256 !== evidence.finalHtmlSha256 || value.htmlBytes !== evidence.finalHtmlBytes
    || createHash("sha256").update(value.html).digest("hex") !== value.htmlSha256 || Buffer.byteLength(value.html) !== value.htmlBytes
    || localWechatRefs(value.html).length || /\bsrc=["'](?:file:|data:)/i.test(value.html)
    || evidence.resources.some((item) => item.role === "cover" && value.html.includes(item.response.mediaId))
    || value.finalBundleAuthority !== false || value.draftCreated !== false || value.platformPublicationPerformed !== false) {
    atomicFail("ATOMIC_WECHAT_POSTUPLOAD_INVALID", "Stored post-upload fact is invalid", 409);
  }
  return value;
}

function validateAtomicWechatFinalDelivery(value, closure = null) {
  const keys = ["schemaVersion", "contract", "id", "workspaceId", "companyId", "accountId", "platform", "contentProjectRef", "materializedContentProjectRef", "commitRef", "platformRunRef", "articleRef", "promotionRef", "promotedVersionRef", "uploadEvidenceRef", "postUploadRef", "requestHash", "idempotencyKey", "bundle", "manifestRef", "bundleHash", "deliveryReady", "draftCreated", "published", "semantics", "createdAt", "factHash"];
  if (!exactKeys(value, keys) || !validSelfHash(value, "factHash") || value.schemaVersion !== "1.0" || value.contract !== "AtomicWechatFinalDeliveryRecord@1.0"
    || value.deliveryReady !== true || value.draftCreated !== false || value.published !== false
    || value.semantics !== "ready_for_manual_wechat_draft_or_publication_not_created_not_published"
    || value.bundle?.manifest?.claims?.platformUploadPerformed !== true
    || value.bundle?.manifest?.claims?.platformPublicationPerformed !== false
    || value.bundle?.manifest?.claims?.published !== false) {
    atomicFail("ATOMIC_WECHAT_FINAL_DELIVERY_INVALID", "Stored final delivery is invalid", 409);
  }
  validatePlatformDeliveryBundle(value.bundle);
  if (closure) {
    const { promotion, version, plan, execution, evidence, postUpload } = closure;
    validateAtomicWechatPromotion(promotion); validateAtomicWechatVersion(version); validateAtomicWechatPostUpload(postUpload, plan, execution, evidence);
    const requestHash = hashUnifiedContent({ promotionRef: { id: promotion.id, hash: promotion.promotionHash }, promotedVersionRef: promotion.promotedVersionRef, uploadEvidenceRef: atomicFactRef(evidence), postUploadRef: atomicFactRef(postUpload) });
    if (value.id !== `atomic-wechat-delivery:${hashUnifiedContent({ requestHash, idempotencyKey: value.idempotencyKey }).slice(0, 24)}` || value.requestHash !== requestHash
      || !sameRef(value.promotionRef, { id: promotion.id, hash: promotion.promotionHash }) || !sameRef(value.promotedVersionRef, promotion.promotedVersionRef)
      || !sameRef(value.uploadEvidenceRef, atomicFactRef(evidence)) || !sameRef(value.postUploadRef, atomicFactRef(postUpload))
      || !sameRef(value.contentProjectRef, version.contentProjectRef) || !sameRef(value.materializedContentProjectRef, version.materializedContentProjectRef)
      || !sameRef(value.commitRef, version.commitRef) || !sameRef(value.platformRunRef, version.platformRunRef) || !sameRef(value.articleRef, version.articleRef)
      || value.bundleHash !== value.bundle.bundleHash || !sameRef(value.manifestRef, value.bundle.manifestRef)
      || !sameRef(value.bundle.platformVersionRef, promotion.promotedVersionRef)
      || !sameRef(value.bundle.manifest.lifecycleRefs?.promotionRef, value.promotionRef)
      || !sameRef(value.bundle.manifest.lifecycleRefs?.uploadEvidenceRef, value.uploadEvidenceRef)
      || !sameRef(value.bundle.manifest.lifecycleRefs?.postUploadRef, value.postUploadRef)) atomicFail("ATOMIC_WECHAT_FINAL_DELIVERY_CLOSURE_INVALID", "Final delivery closure is invalid", 409);
  }
  return value;
}

function wechatScopeMatches(value, authority) {
  return value?.workspaceId === authority.workspaceId && value.companyId === authority.companyId
    && value.accountId === authority.accountId && value.platform === "wechat"
    && sameRef(value.contentProjectRef, authority.executionProjectRef)
    && sameRef(value.materializedContentProjectRef, authority.materializedProjectRef)
    && sameRef(value.platformRunRef, authority.platformRunRef) && sameRef(value.articleRef || value.candidateRef, authority.candidateRef)
    && sameRef(value.commitRef, authority.payload.commitRef);
}

function wechatArtifactScopeMatches(value, authority) {
  return sameRef(value?.contentProjectRef, authority.executionProjectRef)
    && sameRef(value?.materializedContentProjectRef, authority.materializedProjectRef)
    && sameRef(value?.platformRunRef, authority.platformRunRef)
    && sameRef(value?.articleRef || value?.candidateRef, authority.candidateRef);
}

function resolveAtomicWechatPromotionContext(store, input, featureFlags = {}, { promotionOnly = false } = {}) {
  requireAtomicWechatDeliveryFlags(featureFlags, { promotionOnly });
  const authority = resolveUnifiedContentAuthority(store, { ...input, platform: "wechat" }, {
    atomicProductEnabled: true, atomicWechatProductEnabled: true
  });
  if (authority.authorityKind !== "atomic_wechat_v1") atomicFail("ATOMIC_WECHAT_PROMOTION_AUTHORITY_REQUIRED", "Atomic WeChat authority is required", 409);
  if (input?.candidateId && input.candidateId !== authority.candidateRef.id) atomicFail("ATOMIC_WECHAT_PROMOTION_ARTICLE_MISMATCH", "Article is not current", 409);
  if (input?.articleRef && !sameRef(input.articleRef, authority.candidateRef)) atomicFail("ATOMIC_WECHAT_PROMOTION_ARTICLE_MISMATCH", "Article is not current", 409);
  const artifactState = getUnifiedContentArtifactState(store, { ...input, platform: "wechat", candidateId: authority.candidateRef.id }, { featureFlags });
  const review = listUnifiedAtomicWechatReviewState(store, { ...input, platform: "wechat", candidateId: authority.candidateRef.id }, { featureFlags });
  if (!review.artifactApproved || !review.editorialReviewPassed || !review.selected || review.stale
    || !review.currentArtifactReviewFactRef || !review.currentEditorialReviewFactRef || !review.currentSelectionFactRef) {
    atomicFail("ATOMIC_WECHAT_PROMOTION_CURRENT_SELECTION_REQUIRED", "Exact current approved and selected WeChat article is required", 409);
  }
  if (review.artifactStateHash !== artifactState.artifactStateHash) atomicFail("ATOMIC_WECHAT_PROMOTION_ARTIFACT_STALE", "Artifact state is stale", 409);
  const formatRef = artifactState.stages?.preUpload;
  const formatFact = (store.unifiedContentWechatFormatFacts || []).filter((fact) => validAtomicWechatFact(fact, "WechatPreUploadFormatArtifactFact@1.0") && sameRef(atomicFactRef(fact), formatRef)).at(-1);
  if (!formatFact || formatFact.status !== "succeeded") atomicFail("ATOMIC_WECHAT_PROMOTION_FORMAT_REQUIRED", "Exact pre-upload format is required", 409);
  const planFact = (store.unifiedContentWechatPlanFacts || []).filter((fact) => validAtomicWechatFact(fact, "WechatImagePlanArtifactFact@1.0") && sameRef(atomicFactRef(fact), formatFact.planFactRef) && wechatArtifactScopeMatches(fact, authority)).at(-1);
  const preview = (store.unifiedContentWechatPreviewArtifacts || []).filter((fact) => validAtomicWechatFact(fact, "UnifiedWechatPreUploadPreviewArtifact@1.0")
    && sameRef(fact.formatFactRef, formatRef) && wechatArtifactScopeMatches(fact, authority)).at(-1);
  if (!planFact || !preview) atomicFail("ATOMIC_WECHAT_PROMOTION_PREUPLOAD_EVIDENCE_REQUIRED", "Exact pre-upload evidence is required", 409);
  return { authority, artifactState, review, formatFact, planFact, preview };
}

function atomicWechatPromotionRequest(context) {
  const { authority, artifactState, review, formatFact, planFact, preview } = context;
  return {
    schemaVersion: "1.0", contract: "AtomicWechatContentPromotionRequest@1.0",
    workspaceId: authority.workspaceId, companyId: authority.companyId, accountId: authority.accountId, platform: "wechat",
    contentProjectRef: clone(authority.executionProjectRef), materializedContentProjectRef: clone(authority.materializedProjectRef),
    commitRef: clone(authority.payload.commitRef), platformRunRef: clone(authority.platformRunRef), articleRef: clone(authority.candidateRef),
    artifactStateHash: artifactState.artifactStateHash, artifactAuthoritySetHash: review.artifactAuthoritySetHash,
    artifactReviewRef: clone(review.currentArtifactReviewFactRef), editorialReviewRef: clone(review.currentEditorialReviewFactRef), selectionRef: clone(review.currentSelectionFactRef),
    planFactRef: atomicFactRef(planFact), formatFactRef: atomicFactRef(formatFact), preUploadRef: clone(preview.preUploadRef),
    sourceHtml: clone(preview.sourceHtml), resources: clone(preview.resources), article: clone(authority.payload.article.article || authority.payload.article.component || authority.payload.article),
    claims: { resourceUploadPerformed: false, draftCreated: false, platformPublicationPerformed: false }
  };
}

export function previewAtomicWechatContentPromotion(store, input, { featureFlags = {} } = {}) {
  const request = atomicWechatPromotionRequest(resolveAtomicWechatPromotionContext(store, input, featureFlags, { promotionOnly: true }));
  const inputHash = hashUnifiedContent(request);
  return Object.freeze({ schemaVersion: "1.0", contract: "AtomicWechatContentPromotionPreflight@1.0", status: "validated_read_only",
    inputHash, previewToken: `atomic-wechat-promotion-preview:${inputHash}`, request,
    claims: Object.freeze({ writesPerformed: false, resourceUploadPerformed: false, draftCreated: false, platformPublicationPerformed: false }) });
}

export function confirmAtomicWechatContentPromotion(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_WECHAT_PROMOTION_IDEMPOTENCY_KEY_REQUIRED");
  const preflight = previewAtomicWechatContentPromotion(store, input?.request, { featureFlags });
  if (input?.previewToken !== preflight.previewToken) atomicFail("ATOMIC_WECHAT_PROMOTION_PREVIEW_TOKEN_MISMATCH", "Preview is stale", 409);
  const versions = Array.isArray(store.contentVersions) ? store.contentVersions : [];
  const promotions = Array.isArray(store.contentPromotions) ? store.contentPromotions : [];
  const existing = promotions.find((fact) => fact.contract === "AtomicWechatPromotionRecord@1.0" && fact.idempotencyKey === idempotencyKey);
  if (existing) {
    const version = versions.find((fact) => sameRef({ id: fact.id, hash: fact.versionHash }, existing.promotedVersionRef));
    validateAtomicWechatPromotion(existing); validateAtomicWechatVersion(version);
    if (existing.preflightInputHash !== preflight.inputHash) atomicFail("ATOMIC_WECHAT_PROMOTION_IDEMPOTENCY_CONFLICT", "Promotion semantics changed", 409);
    return { promotion: clone(existing), contentVersion: clone(version), created: false };
  }
  const promotedAt = new Date(now).toISOString();
  const identity = hashUnifiedContent({ preflightInputHash: preflight.inputHash, idempotencyKey });
  const versionBase = { schemaVersion: "1.0", contract: "AtomicWechatImmutableContentVersion@1.0", id: `atomic-wechat-version:${identity.slice(0, 24)}`,
    immutable: true, ...clone(preflight.request), preflightInputHash: preflight.inputHash, idempotencyKey, promotedAt };
  delete versionBase.schemaVersion; delete versionBase.contract;
  const normalizedVersionBase = { schemaVersion: "1.0", contract: "AtomicWechatImmutableContentVersion@1.0", ...versionBase };
  const persistedVersionBase = persistedClone(normalizedVersionBase);
  const contentVersion = { ...persistedVersionBase, versionHash: hashUnifiedContent(persistedVersionBase) };
  const promotedVersionRef = { id: contentVersion.id, hash: contentVersion.versionHash };
  const promotionBase = { schemaVersion: "1.0", contract: "AtomicWechatPromotionRecord@1.0", id: `atomic-wechat-promotion:${identity.slice(0, 24)}`,
    workspaceId: preflight.request.workspaceId, companyId: preflight.request.companyId, accountId: preflight.request.accountId, platform: "wechat",
    contentProjectRef: clone(preflight.request.contentProjectRef), materializedContentProjectRef: clone(preflight.request.materializedContentProjectRef), commitRef: clone(preflight.request.commitRef),
    platformRunRef: clone(preflight.request.platformRunRef), articleRef: clone(preflight.request.articleRef), artifactStateHash: preflight.request.artifactStateHash,
    artifactReviewRef: clone(preflight.request.artifactReviewRef), editorialReviewRef: clone(preflight.request.editorialReviewRef), selectionRef: clone(preflight.request.selectionRef),
    promotedVersionRef, preflightInputHash: preflight.inputHash, idempotencyKey, promotedAt, resourceUploadPerformed: false, draftCreated: false, platformPublicationPerformed: false };
  const promotion = withPersistedHash(promotionBase, "promotionHash");
  store.contentVersions = [...versions, contentVersion]; store.contentPromotions = [...promotions, promotion];
  return { promotion: clone(promotion), contentVersion: clone(contentVersion), created: true };


}

function resolveWechatPromotedVersion(store, input, featureFlags) {
  const context = resolveAtomicWechatPromotionContext(store, input, featureFlags);
  const promotion = (store.contentPromotions || []).find((fact) => fact.contract === "AtomicWechatPromotionRecord@1.0" && fact.id === input?.promotionRef?.id);
  if (!promotion || !sameRef({ id: promotion.id, hash: promotion.promotionHash }, input.promotionRef) || !wechatScopeMatches(validateAtomicWechatPromotion(promotion), context.authority)) atomicFail("ATOMIC_WECHAT_PROMOTION_REF_MISMATCH", "Exact promotion is required", 409);
  const version = (store.contentVersions || []).find((fact) => sameRef({ id: fact.id, hash: fact.versionHash }, promotion.promotedVersionRef));
  if (!version) atomicFail("ATOMIC_WECHAT_PROMOTED_VERSION_INVALID", "Promoted version is invalid", 409);
  validateAtomicWechatVersion(version);
  if (version.preflightInputHash !== promotion.preflightInputHash) atomicFail("ATOMIC_WECHAT_PROMOTED_VERSION_PREFLIGHT_MISMATCH", "Promoted preflight binding is invalid", 409);
  if (version.artifactStateHash !== context.artifactState.artifactStateHash) atomicFail("ATOMIC_WECHAT_PROMOTED_VERSION_ARTIFACT_STALE", "Promoted artifact is stale", 409);
  if (!sameRef(version.selectionRef, context.review.currentSelectionFactRef)) atomicFail("ATOMIC_WECHAT_PROMOTED_VERSION_SELECTION_STALE", "Promoted selection is stale", 409);
  return { context, promotion, version };
}

function uploadSteps(version, store) {
  return version.resources.map((resource, index) => {
    const attempt = (store.unifiedContentWechatResourceAttempts || []).find((fact) => sameRef(atomicFactRef(fact), resource.attemptRef));
    if (!attempt || !validAtomicWechatFact(attempt, "WechatResourceResolutionAttempt@1.0") || attempt.status !== "succeeded" || attempt.assetId !== resource.assetId
      || attempt.relativePath !== resource.relativePath || attempt.bytes !== resource.bytes || attempt.sha256 !== resource.sha256) atomicFail("ATOMIC_WECHAT_UPLOAD_RESOURCE_CLOSURE_INVALID", "Resource descriptor is stale", 409);
    if (!['cover','inline'].includes(attempt.role)) atomicFail("ATOMIC_WECHAT_UPLOAD_RESOURCE_ROLE_INVALID", "Resource role must be cover or inline", 409);
    return { ordinal: index + 1, assetId: resource.assetId, role: attempt.role, relativePath: resource.relativePath, bytes: resource.bytes, sha256: resource.sha256,
      sourceAttemptRef: clone(resource.attemptRef), operation: attempt.role === "cover" ? "wechat_permanent_material_upload_for_thumb_media_id" : "wechat_uploadimg_for_https_body_url" };
  });
}

export function previewAtomicWechatResourceUploadPlan(store, input, { featureFlags = {} } = {}) {
  const { promotion, version } = resolveWechatPromotedVersion(store, input, featureFlags);
  const draft = { schemaVersion: "1.0", contract: "AtomicWechatResourceUploadPlanRequest@1.0",
    workspaceId: version.workspaceId, companyId: version.companyId, accountId: version.accountId, platform: "wechat",
    contentProjectRef: clone(version.contentProjectRef), materializedContentProjectRef: clone(version.materializedContentProjectRef), commitRef: clone(version.commitRef),
    platformRunRef: clone(version.platformRunRef), articleRef: clone(version.articleRef), article: clone(version.article), promotionRef: { id: promotion.id, hash: promotion.promotionHash },
    promotedVersionRef: clone(promotion.promotedVersionRef), planFactRef: clone(version.planFactRef), formatFactRef: clone(version.formatFactRef), preUploadRef: clone(version.preUploadRef), sourceHtml: clone(version.sourceHtml), steps: uploadSteps(version, store),
    claims: { requiresExplicitHumanApproval: true, draftCreationAuthorized: false, publicationAuthorized: false } };
  const inputHash = hashUnifiedContent(draft);
  return { schemaVersion: "1.0", contract: "AtomicWechatResourceUploadPlanPreflight@1.0", status: "validated_read_only", inputHash,
    previewToken: `atomic-wechat-upload-plan-preview:${inputHash}`, request: draft, claims: { writesPerformed: false, providerCalls: 0, draftCreated: false, platformPublicationPerformed: false } };
}

export function confirmAtomicWechatResourceUploadPlan(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_WECHAT_UPLOAD_PLAN_IDEMPOTENCY_REQUIRED");
  const actorId = text(input?.actorId, "ATOMIC_WECHAT_UPLOAD_PLAN_ACTOR_REQUIRED");
  if (input?.actorType !== "user" || input?.approved !== true) atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_EXPLICIT_APPROVAL_REQUIRED", "Explicit user approval is required", 400);
  const preflight = previewAtomicWechatResourceUploadPlan(store, input?.request, { featureFlags });
  if (input?.previewToken !== preflight.previewToken) atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_PREVIEW_TOKEN_MISMATCH", "Upload plan preview is stale", 409);
  const occurredAt = new Date(text(input?.occurredAt, "ATOMIC_WECHAT_UPLOAD_PLAN_OCCURRED_AT_REQUIRED")).toISOString();
  const requestHash = hashUnifiedContent({ inputHash: preflight.inputHash, actorId, actorType: "user", approved: true, occurredAt });
  const plans = Array.isArray(store.unifiedAtomicWechatUploadPlans) ? store.unifiedAtomicWechatUploadPlans : [];
  const existing = plans.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (existing) {
    if (validateAtomicWechatUploadPlan(existing).requestHash !== requestHash) atomicFail("ATOMIC_WECHAT_UPLOAD_PLAN_IDEMPOTENCY_CONFLICT", "Upload plan semantics changed", 409);
    return { uploadPlan: clone(existing), created: false };
  }
  const base = { ...clone(preflight.request), schemaVersion: "1.0", contract: "AtomicWechatApprovedResourceUploadPlan@1.0", id: `atomic-wechat-upload-plan:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    inputHash: preflight.inputHash, actorId, actorType: "user", approved: true, occurredAt, requestHash, idempotencyKey, recordedAt: new Date(now).toISOString(), draftCreationAuthorized: false, publicationAuthorized: false };
  const uploadPlan = withPersistedHash(base, "planHash"); store.unifiedAtomicWechatUploadPlans = [...plans, uploadPlan];
  return { uploadPlan: clone(uploadPlan), created: true };
}

function exactAssetBytes(value, descriptor, code) {
  const bytes = Buffer.isBuffer(value?.bytes) ? value.bytes : value?.bytes instanceof Uint8Array ? Buffer.from(value.bytes) : null;
  if (!bytes || bytes.length !== descriptor.bytes || createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) atomicFail(code, "Source bytes do not match immutable descriptor", 409);
  return bytes;
}

function localWechatRefs(html) {
  return [...String(html).matchAll(/\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]).filter((value) => !/^https:\/\//i.test(value));
}

function finalizeWechatUploadedHtml(html, attempts) {
  let finalHtml = String(html);
  for (const item of attempts.filter((entry) => entry.role === "inline")) {
    finalHtml = finalHtml.split(`src="${item.relativePath}"`).join(`src="${item.response.url}"`).split(`src='${item.relativePath}'`).join(`src='${item.response.url}'`);
  }
  for (const item of attempts.filter((entry) => entry.role === "cover")) {
    const path = entryEscape(item.relativePath);
    finalHtml = finalHtml.replace(new RegExp(`<figure\\b[^>]*>[\\s\\S]*?src=["']${path}["'][\\s\\S]*?<\\/figure>`, "gi"), "")
      .replace(new RegExp(`<img\\b[^>]*src=["']${path}["'][^>]*>`, "gi"), "");
  }
  return finalHtml;
}

export async function executeAtomicWechatResourceUpload(store, input, { featureFlags = {}, assetReader, transport, postprocess, now = new Date().toISOString() } = {}) {
  requireAtomicWechatDeliveryFlags(featureFlags);
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_WECHAT_UPLOAD_EXECUTION_IDEMPOTENCY_REQUIRED");
  const plan = (store.unifiedAtomicWechatUploadPlans || []).find((fact) => fact.id === input?.uploadPlanRef?.id);
  if (!plan || !sameRef({ id: plan.id, hash: plan.planHash }, input.uploadPlanRef)) atomicFail("ATOMIC_WECHAT_APPROVED_UPLOAD_PLAN_REQUIRED", "Exact approved upload plan is required", 409);
  validateAtomicWechatUploadPlan(plan);
  // Re-resolve current promotion before any byte read or provider call.
  resolveWechatPromotedVersion(store, { ...input, promotionRef: plan.promotionRef }, featureFlags);
  const requestHash = executionRequestHash(plan);
  const batches = Array.isArray(store.unifiedAtomicWechatUploadExecutions) ? store.unifiedAtomicWechatUploadExecutions : [];
  const existing = batches.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (existing) {
    if (validateAtomicWechatUploadExecution(existing, plan).requestHash !== requestHash) atomicFail("ATOMIC_WECHAT_UPLOAD_EXECUTION_IDEMPOTENCY_CONFLICT", "Upload semantics changed", 409);
    const storedEvidence = (store.unifiedAtomicWechatUploadEvidence || []).find((fact) => sameRef(fact.executionRef, atomicFactRef(existing))) || null;
    const uploadEvidence = storedEvidence ? clone(validateAtomicWechatUploadEvidence(storedEvidence, plan, existing)) : null;
    const storedPostUpload = uploadEvidence ? (store.unifiedContentWechatLifecycleFacts || []).find((fact) => sameRef(fact.evidenceRef, atomicFactRef(uploadEvidence))) || null : null;
    const postUpload = storedPostUpload ? clone(validateAtomicWechatPostUpload(storedPostUpload, plan, existing, uploadEvidence)) : null;
    if (existing.status === "succeeded" && (!uploadEvidence || !postUpload)) atomicFail("ATOMIC_WECHAT_UPLOAD_SUCCESS_CLOSURE_MISSING", "Succeeded execution requires exact evidence and post-upload facts", 409);
    if (existing.status !== "succeeded" && (uploadEvidence || postUpload)) atomicFail("ATOMIC_WECHAT_UPLOAD_FAILURE_AUTHORITY_FORBIDDEN", "Failed execution cannot own success evidence", 409);
    return { execution: clone(existing), uploadEvidence, postUpload, created: false, providerCalls: 0 };
  }
  if (typeof assetReader !== "function") atomicFail("ATOMIC_WECHAT_UPLOAD_ASSET_READER_REQUIRED", "Exact source bytes are unavailable", 409);
  if (plan.steps.length && typeof transport !== "function") atomicFail("ATOMIC_WECHAT_UPLOAD_TRANSPORT_REQUIRED", "Controlled upload transport is unavailable", 409);
  const readerContext = { contentProjectId: plan.contentProjectRef.id, accountId: plan.accountId };
  const htmlBytes = exactAssetBytes(await assetReader({ kind: "html", descriptor: clone(plan.sourceHtml), context: readerContext }), plan.sourceHtml, "ATOMIC_WECHAT_UPLOAD_HTML_BYTES_MISMATCH");
  const html = htmlBytes.toString("utf8");
  const resources = [];
  for (const step of plan.steps) {
    const resource = await assetReader({ kind: "resource", descriptor: clone(step), context: readerContext });
    resources.push({ step, bytes: exactAssetBytes(resource, step, "ATOMIC_WECHAT_UPLOAD_RESOURCE_BYTES_MISMATCH"), contentType: resource?.contentType });
  }
  const attemptResults = [];
  for (const { step, bytes, contentType } of resources) {
    try {
      const response = await transport({ accountId: plan.accountId, contentProjectId: plan.contentProjectRef.id, operation: step.operation, role: step.role,
        assetId: step.assetId, relativePath: step.relativePath, bytes: Buffer.from(bytes), sha256: step.sha256, contentType });
      if (step.role === "cover") {
        if (!response || Object.keys(response).sort().join(",") !== "mediaId") atomicFail("ATOMIC_WECHAT_UPLOAD_COVER_RESPONSE_INVALID", "Cover response must contain only mediaId", 409);
        const mediaId = text(response?.mediaId, "ATOMIC_WECHAT_UPLOAD_COVER_MEDIA_ID_REQUIRED");
        attemptResults.push({ ...clone(step), status: "succeeded", response: { mediaId }, responseHash: hashUnifiedContent({ mediaId }) });
      } else {
        if (!response || Object.keys(response).sort().join(",") !== "url") atomicFail("ATOMIC_WECHAT_UPLOAD_INLINE_RESPONSE_INVALID", "Inline response must contain only url", 409);
        const url = text(response?.url, "ATOMIC_WECHAT_UPLOAD_INLINE_URL_REQUIRED");
        if (!validWechatUploadUrl(url)) atomicFail("ATOMIC_WECHAT_UPLOAD_INLINE_HTTPS_REQUIRED", "uploadimg must return an approved WeChat HTTPS URL", 409);
        attemptResults.push({ ...clone(step), status: "succeeded", response: { url }, responseHash: hashUnifiedContent({ url }) });
      }
    } catch (error) {
      attemptResults.push({ ...clone(step), status: "failed", failure: { code: error?.code || "WECHAT_RESOURCE_UPLOAD_FAILED" } });
      break;
    }


  }
  const transportSucceeded = attemptResults.length === plan.steps.length && attemptResults.every((item) => item.status === "succeeded");
  let finalHtml = html;
  let postprocessFailure = null;
  if (transportSucceeded) {
    try {
      finalHtml = typeof postprocess === "function" ? await postprocess({ html, attempts: clone(attemptResults), plan: clone(plan) }) : finalizeWechatUploadedHtml(html, attemptResults);
      if (typeof finalHtml !== "string" || !finalHtml.length) atomicFail("ATOMIC_WECHAT_UPLOAD_FINAL_HTML_EMPTY", "Final HTML is empty", 409);
      if (attemptResults.some((entry) => entry.role === "cover" && (new RegExp(`src=["']${entryEscape(entry.relativePath)}["']`).test(finalHtml) || finalHtml.includes(entry.response.mediaId)))) atomicFail("ATOMIC_WECHAT_UPLOAD_COVER_MEDIA_ID_IN_BODY_FORBIDDEN", "Cover media_id cannot be used in body HTML", 409);
      if (localWechatRefs(finalHtml).length || /\bsrc=["'](?:file:|data:)/i.test(finalHtml)) atomicFail("ATOMIC_WECHAT_UPLOAD_FINAL_HTML_LOCAL_REF_FORBIDDEN", "Final HTML contains non-HTTPS resource refs", 409);
    } catch (error) {
      postprocessFailure = { code: error?.code || "ATOMIC_WECHAT_UPLOAD_POSTPROCESS_FAILED" };
    }
  }
  const succeeded = transportSucceeded && !postprocessFailure;
  const recordedAt = new Date(now).toISOString();
  const executionBase = { schemaVersion: "1.0", contract: "AtomicWechatResourceUploadExecution@1.0", id: `atomic-wechat-upload-execution:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    uploadPlanRef: clone(input.uploadPlanRef), promotionRef: clone(plan.promotionRef), promotedVersionRef: clone(plan.promotedVersionRef), requestHash, idempotencyKey,
    status: succeeded ? "succeeded" : postprocessFailure ? "postprocess_failure" : "partial_failure", attempts: attemptResults,
    ...(postprocessFailure ? { failure: postprocessFailure } : {}), resourceUploadPerformed: attemptResults.length > 0, draftCreated: false, platformPublicationPerformed: false, recordedAt };
  const execution = withPersistedHash(executionBase, "factHash");
  validateAtomicWechatUploadExecution(execution, plan);
  let uploadEvidence = null; let postUpload = null;
  if (succeeded) {
    const evidenceBase = { schemaVersion: "1.0", contract: "AtomicWechatResourceUploadEvidence@1.0", id: `atomic-wechat-upload-evidence:${execution.factHash.slice(0, 24)}`,
      uploadPlanRef: clone(input.uploadPlanRef), executionRef: atomicFactRef(execution), promotionRef: clone(plan.promotionRef), promotedVersionRef: clone(plan.promotedVersionRef),
      resources: attemptResults, sourceHtmlSha256: plan.sourceHtml.sha256, finalHtmlSha256: createHash("sha256").update(finalHtml).digest("hex"), finalHtmlBytes: Buffer.byteLength(finalHtml),
      semantics: "wechat_resources_uploaded_content_not_published", draftCreated: false, platformPublicationPerformed: false, recordedAt };
    uploadEvidence = withPersistedHash(evidenceBase, "factHash");
    validateAtomicWechatUploadEvidence(uploadEvidence, plan, execution);
    const postBase = { schemaVersion: "1.0", contract: "WechatPostUploadArtifactFact@1.0", id: `wechat-post-upload:${uploadEvidence.factHash.slice(0, 24)}`,
      workspaceId: plan.workspaceId, companyId: plan.companyId, accountId: plan.accountId, platform: "wechat", contentProjectRef: clone(plan.contentProjectRef), materializedContentProjectRef: clone(plan.materializedContentProjectRef),
      platformRunRef: clone(plan.platformRunRef), candidateRef: clone(plan.articleRef), articleRef: clone(plan.articleRef), commitRef: clone(plan.commitRef), imagePlanRef: clone(plan.planFactRef),
      kind: "post_upload", semantics: "wechat_resources_uploaded_content_not_published", predecessorRef: clone(plan.formatFactRef), evidenceRef: atomicFactRef(uploadEvidence),
      promotionRef: clone(plan.promotionRef), promotedVersionRef: clone(plan.promotedVersionRef), html: finalHtml, htmlSha256: uploadEvidence.finalHtmlSha256, htmlBytes: uploadEvidence.finalHtmlBytes,
      finalBundleAuthority: false, draftCreated: false, platformPublicationPerformed: false, idempotencyKey: `post-upload:${idempotencyKey}`, recordedAt };
    postUpload = withPersistedHash(postBase, "factHash");
    validateAtomicWechatPostUpload(postUpload, plan, execution, uploadEvidence);
  }
  store.unifiedAtomicWechatUploadExecutions = [...batches, execution];
  if (uploadEvidence) store.unifiedAtomicWechatUploadEvidence = [...(store.unifiedAtomicWechatUploadEvidence || []), uploadEvidence];
  if (postUpload) store.unifiedContentWechatLifecycleFacts = [...(store.unifiedContentWechatLifecycleFacts || []), postUpload];
  return { execution: clone(execution), uploadEvidence: clone(uploadEvidence), postUpload: clone(postUpload), created: true, providerCalls: attemptResults.length };
}

function entryEscape(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function appendAtomicWechatFinalDelivery(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  const { context, promotion, version } = resolveWechatPromotedVersion(store, input, featureFlags);
  const evidence = (store.unifiedAtomicWechatUploadEvidence || []).find((fact) => sameRef(atomicFactRef(fact), input?.uploadEvidenceRef));
  const postUpload = (store.unifiedContentWechatLifecycleFacts || []).find((fact) => sameRef(atomicFactRef(fact), input?.postUploadRef));
  const plan = evidence ? (store.unifiedAtomicWechatUploadPlans || []).find((fact) => sameRef({ id: fact.id, hash: fact.planHash }, evidence.uploadPlanRef)) : null;
  const execution = evidence ? (store.unifiedAtomicWechatUploadExecutions || []).find((fact) => sameRef(atomicFactRef(fact), evidence.executionRef)) : null;
  if (!evidence || !plan || !execution || !postUpload) atomicFail("ATOMIC_WECHAT_DELIVERY_POSTUPLOAD_EVIDENCE_INVALID", "Exact post-upload evidence is required", 409);
  validateAtomicWechatPostUpload(postUpload, plan, execution, evidence);
  if (!sameRef(plan.promotionRef, { id: promotion.id, hash: promotion.promotionHash }) || !sameRef(plan.promotedVersionRef, promotion.promotedVersionRef)) atomicFail("ATOMIC_WECHAT_DELIVERY_UPLOAD_PLAN_MISMATCH", "Upload plan is not bound to the promotion", 409);
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_WECHAT_DELIVERY_IDEMPOTENCY_REQUIRED");
  const requestHash = hashUnifiedContent({ promotionRef: input.promotionRef, promotedVersionRef: promotion.promotedVersionRef, uploadEvidenceRef: input.uploadEvidenceRef, postUploadRef: input.postUploadRef });
  const deliveries = Array.isArray(store.unifiedAtomicWechatDeliveries) ? store.unifiedAtomicWechatDeliveries : [];
  const existing = deliveries.find((fact) => fact.idempotencyKey === idempotencyKey);
  const closure = { promotion, version, plan, execution, evidence, postUpload };
  if (existing) { if (validateAtomicWechatFinalDelivery(existing, closure).requestHash !== requestHash) atomicFail("ATOMIC_WECHAT_DELIVERY_IDEMPOTENCY_CONFLICT", "Delivery semantics changed", 409); return { delivery: clone(existing), created: false }; }
  const article = version.article;
  const bundle = buildWechatPlatformDeliveryBundle({ schemaVersion: "1.0", platform: "wechat", platformVersionRef: clone(promotion.promotedVersionRef), promotedVersionRef: clone(promotion.promotedVersionRef),
    title: article.recommended_title || article.title, articleMarkdown: article.article_markdown || article.markdown || article.body, uploadTemplateHtml: postUpload.html,
    resources: [], uploadPlan: { steps: [] }, uploadedFinalHtml: postUpload.html, uploadEvidenceRef: atomicFactRef(evidence), postUploadOnly: true, resourceUploadPerformed: true,
    states: { machineReview: { status: "passed", ref: clone(version.editorialReviewRef) }, editorialReview: { status: "passed", ref: clone(version.editorialReviewRef) },
      userSelection: { status: "selected", ref: clone(version.selectionRef) }, promotion: { status: "promoted", ref: { id: promotion.id, hash: promotion.promotionHash } }, publication: { status: "not_published", ref: null } },
    lifecycleRefs: { artifactReviewRef: clone(version.artifactReviewRef), editorialReviewRef: clone(version.editorialReviewRef), selectionRef: clone(version.selectionRef), promotionRef: { id: promotion.id, hash: promotion.promotionHash }, uploadEvidenceRef: atomicFactRef(evidence), postUploadRef: atomicFactRef(postUpload) } });
  const base = { schemaVersion: "1.0", contract: "AtomicWechatFinalDeliveryRecord@1.0", id: `atomic-wechat-delivery:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    workspaceId: context.authority.workspaceId, companyId: context.authority.companyId, accountId: context.authority.accountId, platform: "wechat",
    contentProjectRef: clone(version.contentProjectRef), materializedContentProjectRef: clone(version.materializedContentProjectRef), commitRef: clone(version.commitRef), platformRunRef: clone(version.platformRunRef), articleRef: clone(version.articleRef),
    promotionRef: { id: promotion.id, hash: promotion.promotionHash }, promotedVersionRef: clone(promotion.promotedVersionRef), uploadEvidenceRef: atomicFactRef(evidence), postUploadRef: atomicFactRef(postUpload),
    requestHash, idempotencyKey, bundle, manifestRef: clone(bundle.manifestRef), bundleHash: bundle.bundleHash, deliveryReady: true, draftCreated: false, published: false,
    semantics: "ready_for_manual_wechat_draft_or_publication_not_created_not_published", createdAt: new Date(now).toISOString() };
  const delivery = withPersistedHash(base, "factHash"); validateAtomicWechatFinalDelivery(delivery, closure); store.unifiedAtomicWechatDeliveries = [...deliveries, delivery];
  return { delivery: clone(delivery), created: true };
}

function requireExactWechatPublicationRef(actual, expected, code) {
  if (!validAtomicRef(actual) || !sameRef(actual, expected)) atomicFail(code, "Exact Atomic WeChat publication reference is required", 409);
}

export function resolveAtomicWechatManualPublicationContext(store, input, { featureFlags = {}, requireCurrent = true } = {}) {
  let context; let promotion; let version;
  if (requireCurrent) ({ context, promotion, version } = resolveWechatPromotedVersion(store, input, featureFlags));
  else {
    requireAtomicWechatDeliveryFlags(featureFlags);
    const authority = resolveUnifiedContentAuthority(store, { ...input, platform: "wechat" }, { atomicProductEnabled: true, atomicWechatProductEnabled: true });
    if (authority.authorityKind !== "atomic_wechat_v1") atomicFail("ATOMIC_MANUAL_PUBLICATION_AUTHORITY_REQUIRED", "Atomic WeChat authority is required", 409);
    promotion = (store.contentPromotions || []).find((fact) => fact?.contract === "AtomicWechatPromotionRecord@1.0"
      && sameRef({ id: fact.id, hash: fact.promotionHash }, input?.promotionRef));
    if (!promotion || !wechatScopeMatches(validateAtomicWechatPromotion(promotion), authority)) atomicFail("ATOMIC_MANUAL_PUBLICATION_PROMOTION_MISMATCH", "Exact Atomic WeChat promotion is required", 409);
    version = (store.contentVersions || []).find((fact) => sameRef({ id: fact.id, hash: fact.versionHash }, promotion.promotedVersionRef));
    if (!version) atomicFail("ATOMIC_MANUAL_PUBLICATION_VERSION_MISMATCH", "Exact Atomic WeChat promoted version is required", 409);
    validateAtomicWechatVersion(version);
    if (!wechatScopeMatches(version, authority) || version.preflightInputHash !== promotion.preflightInputHash || !sameRef(input?.promotedVersionRef, promotion.promotedVersionRef)) {
      atomicFail("ATOMIC_MANUAL_PUBLICATION_VERSION_MISMATCH", "Atomic WeChat promoted version closure is invalid", 409);
    }
    context = { authority };
  }
  requireExactWechatPublicationRef(input.contentProjectRef, context.authority.executionProjectRef, "ATOMIC_MANUAL_PUBLICATION_PROJECT_MISMATCH");
  requireExactWechatPublicationRef(input.materializedContentProjectRef, context.authority.materializedProjectRef, "ATOMIC_MANUAL_PUBLICATION_MATERIALIZED_PROJECT_MISMATCH");
  requireExactWechatPublicationRef(input.commitRef, context.authority.payload.commitRef, "ATOMIC_MANUAL_PUBLICATION_COMMIT_MISMATCH");
  requireExactWechatPublicationRef(input.platformRunRef, context.authority.platformRunRef, "ATOMIC_MANUAL_PUBLICATION_RUN_MISMATCH");
  requireExactWechatPublicationRef(input.articleRef, context.authority.candidateRef, "ATOMIC_MANUAL_PUBLICATION_ARTICLE_MISMATCH");
  requireExactWechatPublicationRef(input.promotedVersionRef, promotion.promotedVersionRef, "ATOMIC_MANUAL_PUBLICATION_VERSION_MISMATCH");

  const deliveryRef = input.deliveryRef;
  if (!validAtomicRef(deliveryRef)) atomicFail("ATOMIC_MANUAL_PUBLICATION_DELIVERY_REF_REQUIRED", "Exact Atomic WeChat delivery reference is required", 400);
  const deliveries = (store.unifiedAtomicWechatDeliveries || []).filter((fact) => fact?.contract === "AtomicWechatFinalDeliveryRecord@1.0"
    && sameRef(atomicFactRef(fact), deliveryRef));
  if (deliveries.length !== 1) atomicFail("ATOMIC_MANUAL_PUBLICATION_DELIVERY_MISMATCH", "Exact Atomic WeChat delivery is required", 409);
  const delivery = deliveries[0];

  const evidenceRef = input.uploadEvidenceRef;
  const postUploadRef = input.postUploadRef;
  if (!validAtomicRef(evidenceRef) || !validAtomicRef(postUploadRef)) atomicFail("ATOMIC_MANUAL_PUBLICATION_WECHAT_UPLOAD_REFS_REQUIRED", "Exact Atomic WeChat upload refs are required", 400);
  const evidence = (store.unifiedAtomicWechatUploadEvidence || []).find((fact) => sameRef(atomicFactRef(fact), evidenceRef));
  const postUpload = (store.unifiedContentWechatLifecycleFacts || []).find((fact) => fact?.contract === "WechatPostUploadArtifactFact@1.0"
    && sameRef(atomicFactRef(fact), postUploadRef));
  const plan = evidence ? (store.unifiedAtomicWechatUploadPlans || []).find((fact) => sameRef({ id: fact.id, hash: fact.planHash }, evidence.uploadPlanRef)) : null;
  const execution = evidence ? (store.unifiedAtomicWechatUploadExecutions || []).find((fact) => sameRef(atomicFactRef(fact), evidence.executionRef)) : null;
  if (!plan || !execution || !evidence || !postUpload) atomicFail("ATOMIC_MANUAL_PUBLICATION_WECHAT_UPLOAD_CLOSURE_INVALID", "Atomic WeChat upload closure is incomplete", 409);
  validateAtomicWechatFinalDelivery(delivery, { promotion, version, plan, execution, evidence, postUpload });
  requireExactWechatPublicationRef(delivery.promotionRef, { id: promotion.id, hash: promotion.promotionHash }, "ATOMIC_MANUAL_PUBLICATION_PROMOTION_MISMATCH");
  requireExactWechatPublicationRef(delivery.promotedVersionRef, promotion.promotedVersionRef, "ATOMIC_MANUAL_PUBLICATION_VERSION_MISMATCH");
  requireExactWechatPublicationRef(delivery.uploadEvidenceRef, evidenceRef, "ATOMIC_MANUAL_PUBLICATION_WECHAT_UPLOAD_EVIDENCE_MISMATCH");
  requireExactWechatPublicationRef(delivery.postUploadRef, postUploadRef, "ATOMIC_MANUAL_PUBLICATION_WECHAT_POSTUPLOAD_MISMATCH");
  requireExactWechatPublicationRef(input.manifestRef, delivery.manifestRef, "ATOMIC_MANUAL_PUBLICATION_MANIFEST_MISMATCH");
  return { authority: context.authority, promotion, version, plan, execution, evidence, postUpload, delivery };
}

export function projectAtomicWechatPromotionUploadDelivery(store, input, { featureFlags = {} } = {}) {
  const context = resolveAtomicWechatPromotionContext(store, input, featureFlags, {
    promotionOnly: featureFlags.unifiedContentAtomicWechatPromotionUploadDeliveryV1 !== true
  });
  const promotions = (store.contentPromotions || []).filter((fact) => fact.contract === "AtomicWechatPromotionRecord@1.0").map(validateAtomicWechatPromotion).filter((fact) => wechatScopeMatches(fact, context.authority));
  const promotion = promotions.at(-1) || null;
  const validatedClosures = promotion ? (store.unifiedAtomicWechatUploadEvidence || []).map((evidence) => {
    const plan = (store.unifiedAtomicWechatUploadPlans || []).find((fact) => sameRef({ id: fact.id, hash: fact.planHash }, evidence.uploadPlanRef));
    const execution = (store.unifiedAtomicWechatUploadExecutions || []).find((fact) => sameRef(atomicFactRef(fact), evidence.executionRef));
    const postUpload = (store.unifiedContentWechatLifecycleFacts || []).find((fact) => fact.contract === "WechatPostUploadArtifactFact@1.0" && sameRef(fact.evidenceRef, atomicFactRef(evidence)));
    if (!plan || !execution || !postUpload) atomicFail("ATOMIC_WECHAT_UPLOAD_SUCCESS_CLOSURE_MISSING", "Upload success closure is incomplete", 409);
    validateAtomicWechatPostUpload(postUpload, plan, execution, evidence);
    return { plan, execution, evidence, postUpload };
  }).filter((item) => sameRef(item.evidence.promotionRef, { id: promotion.id, hash: promotion.promotionHash })) : [];
  const uploadClosure = validatedClosures.at(-1) || null;
  const evidence = uploadClosure?.evidence || null;
  const deliveries = evidence ? (store.unifiedAtomicWechatDeliveries || []).filter((fact) => sameRef(fact.uploadEvidenceRef, atomicFactRef(evidence))).map((fact) => validateAtomicWechatFinalDelivery(fact, { promotion,
    version: (store.contentVersions || []).find((item) => sameRef({ id: item.id, hash: item.versionHash }, promotion.promotedVersionRef)), ...uploadClosure })) : [];
  const delivery = deliveries.at(-1) || null;
  return { schemaVersion: "1.0", contract: "AtomicWechatPromotionUploadDeliveryProjection@1.0", platform: "wechat",
    articleRef: clone(context.authority.candidateRef), promoted: Boolean(promotion), uploaded: Boolean(evidence), deliveryReady: Boolean(delivery), draftCreated: false, published: false,
    localPackageReady: Boolean(promotion), promotionRef: promotion ? { id: promotion.id, hash: promotion.promotionHash } : null,
    promotedVersionRef: promotion ? clone(promotion.promotedVersionRef) : null,
    uploadEvidenceRef: evidence ? atomicFactRef(evidence) : null, deliveryRef: delivery ? atomicFactRef(delivery) : null,
    blockers: [...(!promotion ? ["wechat_promotion_required"] : []), ...(promotion && !evidence ? ["wechat_resource_upload_required"] : []), ...(evidence && !delivery ? ["wechat_final_delivery_required"] : []), "wechat_manual_draft_or_publication_required"] };
}
