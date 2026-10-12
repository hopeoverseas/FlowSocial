import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { featureFlags } from "../../feature-flags.mjs";
import { build05ORuntimeInput, loadXhsPackage, loadXhsSourceRegistrySnapshot, validateObservedPageText, validateXhsPublishCompletePackage } from "../../content-agent/xhs-integrated-page-publish-complete.mjs";
import { createProviderCapabilitySnapshot } from "../../image-providers/xhs-integrated-page/capabilities.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { buildIntegratedPageExecutionPlan, createCostConfirmation, materializeProviderExecutionRequest } from "../../image-providers/xhs-integrated-page/execution-plan.mjs";
import { decodeRgbaPng, encodeRgbaPng, normalizePngCandidate, readPngDimensions } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { buildVisualAssetRegistrySnapshot } from "../../image-providers/xhs-integrated-page/registry.mjs";
import { createPromptReviewDecision, transitionPromptReviewDecision } from "../../image-providers/xhs-integrated-page/review-state-machine.mjs";
import { invokeDesignXhsIntegratedPages } from "../../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import { loadLibraries } from "../../skills/design-xhs-integrated-pages/scripts/validate-library.mjs";
import { defaultLiveOperations, loadApiKey, sanitizeEvidence } from "./xhs-integrated-page-skill-live.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../../../..");
export const packageV4Path = resolve(repoRoot, "apps/flowsocial/scripts/fixtures/xhs-publish-complete/xhs-post-package-v4.json");
export const packageV5Path = resolve(repoRoot, "apps/flowsocial/scripts/fixtures/xhs-publish-complete/xhs-post-package-v5.json");
export const packageV6Path = resolve(repoRoot, "apps/flowsocial/scripts/fixtures/xhs-publish-complete/xhs-post-package-v6.json");
export const packagePath = resolve(repoRoot, "apps/flowsocial/scripts/fixtures/xhs-publish-complete/xhs-post-package-v7.json");
export const sourceRegistryPath = resolve(repoRoot, "apps/flowsocial/scripts/fixtures/xhs-publish-complete/source-registry-snapshot.json");
export const outputDir = resolve(repoRoot, "apps/flowsocial/.tmp/fs-v1-xhs-visual-05o");
const PAGE_IDS = Object.freeze(["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
export const P7_V8_OVERLAY = Object.freeze({
  schemaVersion: "1.0",
  contract: "XhsProviderRasterExactTextOverlay@1.0",
  pageId: "P7",
  contentVersion: 8,
  renderStrategy: "provider_raster_with_exact_text_overlay",
  overlayText: "把三个准备度写成一张表",
  safeArea: { x: 90, y: 45, width: 900, height: 155 },
  font: { family: "Microsoft YaHei", file: "C:/Windows/Fonts/msyhbd.ttc", sizePx: 58, style: "bold", color: "#24352f" },
  baseProviderAssetSha: "b7cdeafccd3f5bb35e8a5a390d03214b93e90b377cbaf698f3dc288649e4f058",
  providerCalls: 0,
  automaticRetries: 0,
  productionWrites: 0,
  pureProvider: false
});
export const P6_V9_CLEANUP = Object.freeze({
  schemaVersion: "1.0",
  contract: "XhsProviderRasterArtifactCleanup@1.0",
  pageId: "P6",
  contentVersion: 9,
  renderStrategy: "provider_raster_with_artifact_cleanup",
  baseProviderAssetSha: "400c55564d106dbc3ac049cf0d02d34889eeb945bec1740c6d5b97c6aba3ac18",
  maskRegions: [
    { id: "left_blank_separator_band", x: 100, y: 704, width: 340, height: 24 },
    { id: "right_blank_separator_band", x: 635, y: 704, width: 350, height: 24 }
  ],
  cleanupMethod: "deterministic_vertical_paper_texture_interpolation",
  providerCalls: 0,
  automaticRetries: 0,
  productionWrites: 0,
  pureProvider: false
});
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const json = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");

let crcTable;
function crc32(buffer) {
  crcTable ||= Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipEntries(entries) {
  const localParts = []; const centralParts = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, "/")); const compressed = deflateRawSync(entry.data, { level: 6 }); const crc = crc32(entry.data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(entry.data.length, 22); local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(entry.data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    centralParts.push(central, name); offset += local.length + name.length + compressed.length;
  }
  const central = Buffer.concat(centralParts); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}

const providerProfile = Object.freeze({ provider: "kie.ai", model: "gpt-image-2-text-to-image", adapter: { id: "kie-jobs-image2", version: "1.0", projectionKey: "image2.text-to-image.v1" }, lifecycle: "experimental", createEndpoint: "/api/v1/jobs/createTask", requestFields: ["model", "input.prompt", "input.aspect_ratio", "input.resolution"], inputDefaults: { aspect_ratio: "3:4", resolution: "1K" }, nativeOutputDimensions: { width: 1086, height: 1448 }, normalization: { mode: "resample", target: { width: 1080, height: 1440 }, nonUniformStretchAllowed: false, protectedRegionCropAllowed: false }, estimatedCostPerCandidate: 6, currency: "credits" });
const capabilities = Object.freeze({ integratedChineseTypography: true, referenceImages: false, exactDimensions: false, supportedDimensions: [{ width: 1086, height: 1448 }], maxCandidateCount: 1, maskEditing: false, preserveRegions: false, seedControl: false, asyncJobs: true });
const directions = Object.freeze([
  { id: "direction-editorial", stylePackId: "editorial-metaphor", archetypePlan: ["cover.promise", "explanation.concept-map", "list.key-points", "process.vertical-steps", "summary.cta"], compositionModel: "single-metaphor-with-balanced-information-zones", hierarchyStrategy: "dominant-concept-then-readable-verbatim-text", imageRole: "frame-concept-without-replacing-facts", palette: ["burgundy", "paper", "charcoal"], source: "FlowSocial original FS-V1-XHS-VISUAL-05B", license: "FlowSocial-Proprietary-Original", risks: ["metaphor-may-overpower-text"], capabilityStatus: { snapshotRef: "capability-image2-05o", status: "available", blockers: [] } },
  { id: "direction-structured", stylePackId: "structured-infographic", archetypePlan: ["cover.promise", "list.key-points"], compositionModel: "stable-grid-and-grouped-information", hierarchyStrategy: "headline-then-equal-weight-details", imageRole: "explain-structure", palette: ["ink", "cream", "amber"], source: "FlowSocial original FS-V1-XHS-VISUAL-05B", license: "FlowSocial-Proprietary-Original", risks: ["template-feel"], capabilityStatus: { snapshotRef: "capability-image2-05o", status: "available", blockers: [] } }
]);

function normalizeArtifact(pageId, bytes, contentVersion = 7) {
  const suffix = `v${contentVersion}`;
  const nativePath = join(outputDir, "pages", `${pageId.toLowerCase()}-${suffix}.native.png`);
  const normalizedPath = join(outputDir, "pages", `${pageId.toLowerCase()}-${suffix}.png`);
  const nativeSha256 = sha256(bytes);
  writeFileSync(nativePath, bytes);
  const normalized = normalizePngCandidate({ id: `05o:${pageId}:${nativeSha256.slice(0, 16)}`, candidateRef: { id: `05o-candidate:${pageId}`, hash: nativeSha256 }, sourceBuffer: bytes, sourceRelativePath: relative(repoRoot, nativePath), declaredSourceSha256: nativeSha256, outputRelativePath: relative(repoRoot, normalizedPath), mode: "resample", protectedRegions: [], createdAt: new Date().toISOString() });
  if (normalized.record.status !== "succeeded" || !normalized.outputBuffer || normalized.finalCanvasStatus !== "passed") throw new Error(`NORMALIZATION_BLOCKED:${normalized.record.blockers.map((item) => item.code).join("|")}`);
  writeFileSync(normalizedPath, normalized.outputBuffer);
  return { nativePath: relative(repoRoot, nativePath).replace(/\\/g, "/"), nativeSha256, nativeDimensions: readPngDimensions(bytes), normalizedPath: relative(repoRoot, normalizedPath).replace(/\\/g, "/"), normalizedSha256: sha256(normalized.outputBuffer), normalizedDimensions: readPngDimensions(normalized.outputBuffer), normalizationRecordHash: normalized.record.recordHash };
}

export function build05OPreflight() {
  const loaded = loadXhsPackage(packagePath);
  const sourceRegistry = loadXhsSourceRegistrySnapshot(sourceRegistryPath, { gitCwd: repoRoot });
  if (sourceRegistry.validation.status !== "passed") throw new Error(`SOURCE_REGISTRY_BLOCKED:${sourceRegistry.validation.blockers.join("|")}`);
  const contentQuality = validateXhsPublishCompletePackage(loaded.packageValue, { sourceRegistry: sourceRegistry.snapshot });
  if (contentQuality.status !== "passed") throw new Error(`CONTENT_GATE_BLOCKED:${contentQuality.blockers.join("|")}`);
  const runtimeInput = build05ORuntimeInput(loaded.packageValue, { contentVersion: 7, sourceRegistry: sourceRegistry.snapshot });
  const invocation = invokeDesignXhsIntegratedPages(runtimeInput);
  if (invocation.promptSet.status !== "draft" || invocation.promptSet.blockers.length) throw new Error("SKILL_PROMPT_SET_BLOCKED");
  let review = createPromptReviewDecision({ id: `05o-review:${invocation.runtimeInputRef.id}`, promptSet: invocation.promptSet, directionCandidates: directions });
  const at = "2026-08-05T00:00:00.000Z";
  review = transitionPromptReviewDecision(review, { lane: "visualDirectionSelection", action: "select", directionId: "direction-editorial", actor: "user-confirmed-editorial-metaphor", at });
  review = transitionPromptReviewDecision(review, { lane: "promptReview", action: "approve", reviewedPromptSetHash: invocation.promptSetHash, actor: "content-asset-thread-05o-offline-review", at });
  const libraries = loadLibraries();
  const plan = buildIntegratedPageExecutionPlan({ skillInvocation: invocation, reviewDecision: review, capabilitySnapshot: createProviderCapabilitySnapshot({ id: "capability-image2-05o", capabilities }), registrySnapshot: buildVisualAssetRegistrySnapshot({ id: "registry-image2-05o", libraries, referenceAssets: [] }), libraries, directionCandidates: directions, providerProfile, compilerOptions: { canvas: { width: 1080, height: 1440 }, candidateCount: 1, requestedFeatures: { mask: null, preserveRegions: [], seed: null } }, costConfirmation: createCostConfirmation({ status: "confirmed", currency: "credits", approvedMaxTotal: 56, confirmedBy: "work-item-fs-v1-xhs-visual-05o", confirmedAt: at }), flags: { xhsIntegratedPageSkillExecutionPlan: true } });
  if (featureFlags().xhsIntegratedPageSkillExecutionPlan !== false) throw new Error("FEATURE_FLAG_DEFAULT_MUST_REMAIN_OFF");
  if (plan.execution.status !== "ready_for_isolated_provider_execution" || plan.pages.some((page) => page.blockers.length)) throw new Error(`EXECUTION_PLAN_BLOCKED:${plan.pages.flatMap((page) => page.blockers.map((item) => item.code)).join("|")}`);
  const requests = PAGE_IDS.map((pageId) => materializeProviderExecutionRequest({ plan, pageId, expectedPlanHash: plan.planHash, skillInvocation: invocation }));
  return { loaded, sourceRegistry, contentQuality, runtimeInput, invocation, review, plan, requests };
}

export function prepare05OOffline({ targetDir = outputDir } = {}) {
  mkdirSync(join(targetDir, "pages"), { recursive: true });
  const preflight = build05OPreflight();
  const evidence = { schemaVersion: "1.0", contract: "XhsPublishCompleteOfflinePreflight@1.0", createdAt: new Date().toISOString(), packagePath: relative(repoRoot, packagePath).replace(/\\/g, "/"), packageFileSha256: preflight.loaded.sha256, packageHash: preflight.contentQuality.packageHash, contentQuality: preflight.contentQuality, planHash: preflight.plan.planHash, invocationHash: preflight.invocation.invocationHash, promptSetHash: preflight.invocation.promptSetHash, pages: preflight.plan.pages.map((page) => ({ pageId: page.pageId, requestHash: stableHash(page.providerRequest), promptHash: stableHash(page.providerRequest.body.input.prompt), internalTokenGate: "passed", provider: "not_called", ocr: "not_run", fact: "not_run", visual: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered" })), boundaries: { providerCalls: 0, automaticRetries: 0, productionWrites: 0, featureFlagDefault: false }, approvedBudget: { maxProviderCalls: 7, candidatesPerCall: 1, automaticRetries: 0, maxCredits: 56 } };
  evidence.sourceRegistry = { id: preflight.sourceRegistry.snapshot.id, snapshotHash: preflight.sourceRegistry.validation.snapshotHash, fileSha256: preflight.sourceRegistry.sha256, authority: preflight.sourceRegistry.snapshot.authority };
  writeJson(join(targetDir, "offline-preflight.json"), evidence);
  writeJson(join(targetDir, "xhs-post-package-v7.json"), preflight.loaded.packageValue);
  return evidence;
}

function packageQuality(packageValue) {
  const sourceRegistry = loadXhsSourceRegistrySnapshot(sourceRegistryPath, { gitCwd: repoRoot });
  if (sourceRegistry.validation.status !== "passed") throw new Error(`SOURCE_REGISTRY_BLOCKED:${sourceRegistry.validation.blockers.join("|")}`);
  return validateXhsPublishCompletePackage(packageValue, { sourceRegistry: sourceRegistry.snapshot });
}

function pageTruthHash(packageValue, pageId) {
  const page = packageValue.data.deck.pages.find((item) => `P${item.page}` === pageId);
  return stableHash({ role: page.role, textLayers: page.text_layers, factIds: page.fact_ids, interpretationIds: page.interpretation_ids });
}

function outsideSafeAreaPixels(decoded, safeArea) {
  const chunks = [];
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      if (x >= safeArea.x && x < safeArea.x + safeArea.width && y >= safeArea.y && y < safeArea.y + safeArea.height) continue;
      const offset = (y * decoded.width + x) * 4;
      chunks.push(decoded.pixels.subarray(offset, offset + 4));
    }
  }
  return Buffer.concat(chunks);
}

function outsideMaskPixels(decoded, masks) {
  const chunks = [];
  for (let y = 0; y < decoded.height; y += 1) for (let x = 0; x < decoded.width; x += 1) {
    if (masks.some((mask) => x >= mask.x && x < mask.x + mask.width && y >= mask.y && y < mask.y + mask.height)) continue;
    const offset = (y * decoded.width + x) * 4;
    chunks.push(decoded.pixels.subarray(offset, offset + 4));
  }
  return Buffer.concat(chunks);
}

function validateCleanupMasks(masks, dimensions) {
  if (!Array.isArray(masks) || masks.length !== 2) throw new Error("P6_V9_MASK_COUNT_INVALID");
  for (const mask of masks) {
    if (!nonEmptyMaskId(mask.id) || mask.x < 0 || mask.y < 690 || mask.y + mask.height > 735 || mask.width <= 0 || mask.height <= 0 || mask.x + mask.width > dimensions.width) throw new Error(`P6_V9_MASK_INVALID:${mask.id || "missing"}`);
  }
  const [a, b] = masks;
  if (!(a.x + a.width <= b.x || b.x + b.width <= a.x)) throw new Error("P6_V9_MASKS_OVERLAP");
}

const nonEmptyMaskId = (value) => typeof value === "string" && /^[a-z0-9_]+$/.test(value);

function separatorArtifactMetrics(decoded, masks) {
  let darkPixels = 0;
  let longestDarkHorizontalRun = 0;
  for (const mask of masks) for (let y = mask.y; y < mask.y + mask.height; y += 1) {
    let run = 0;
    for (let x = mask.x; x < mask.x + mask.width; x += 1) {
      const offset = (y * decoded.width + x) * 4;
      const luminance = (decoded.pixels[offset] + decoded.pixels[offset + 1] + decoded.pixels[offset + 2]) / 3;
      if (luminance < 160) { darkPixels += 1; run += 1; longestDarkHorizontalRun = Math.max(longestDarkHorizontalRun, run); }
      else run = 0;
    }
  }
  return { darkPixels, longestDarkHorizontalRun };
}

export function create05OP6V9Cleanup({ basePath = join(outputDir, "pages", "p6-v6.png"), outputPath = join(outputDir, "pages", "p6-v9.png"), evidencePath = join(outputDir, "p6-v9-cleanup-evidence.json"), spec = P6_V9_CLEANUP } = {}) {
  if (spec.renderStrategy !== "provider_raster_with_artifact_cleanup" || spec.providerCalls !== 0 || spec.pureProvider !== false) throw new Error("P6_V9_CLEANUP_CONTRACT_INVALID");
  const base = readFileSync(basePath);
  if (sha256(base) !== spec.baseProviderAssetSha) throw new Error("P6_V9_BASE_PROVIDER_ASSET_SHA_MISMATCH");
  const dimensions = readPngDimensions(base);
  if (dimensions.width !== 1080 || dimensions.height !== 1440) throw new Error("P6_V9_BASE_DIMENSIONS_INVALID");
  validateCleanupMasks(spec.maskRegions, dimensions);
  const before = decodeRgbaPng(base);
  const afterPixels = Buffer.from(before.pixels);
  for (const mask of spec.maskRegions) {
    const topY = mask.y - 3;
    const bottomY = mask.y + mask.height + 3;
    for (let dy = 0; dy < mask.height; dy += 1) {
      const t = (dy + 1) / (mask.height + 1);
      for (let x = mask.x; x < mask.x + mask.width; x += 1) {
        const target = ((mask.y + dy) * before.width + x) * 4;
        const top = (topY * before.width + x) * 4;
        const bottom = (bottomY * before.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) afterPixels[target + channel] = Math.round(before.pixels[top + channel] * (1 - t) + before.pixels[bottom + channel] * t);
        afterPixels[target + 3] = 255;
      }
    }
  }
  const output = encodeRgbaPng(dimensions.width, dimensions.height, afterPixels);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
  const after = decodeRgbaPng(output);
  const outsideBefore = sha256(outsideMaskPixels(before, spec.maskRegions));
  const outsideAfter = sha256(outsideMaskPixels(after, spec.maskRegions));
  if (outsideBefore !== outsideAfter) throw new Error("P6_V9_OUTSIDE_MASK_CHANGED");
  const artifactMetricsBefore = separatorArtifactMetrics(before, spec.maskRegions);
  const artifactMetricsAfter = separatorArtifactMetrics(after, spec.maskRegions);
  if (artifactMetricsAfter.darkPixels !== 0 || artifactMetricsAfter.longestDarkHorizontalRun !== 0 || artifactMetricsBefore.darkPixels <= artifactMetricsAfter.darkPixels) throw new Error("P6_V9_PSEUDO_ARTIFACT_GATE_FAILED");
  let changedInside = 0;
  for (const mask of spec.maskRegions) for (let y = mask.y; y < mask.y + mask.height; y += 1) for (let x = mask.x; x < mask.x + mask.width; x += 1) {
    const offset = (y * before.width + x) * 4;
    if (!before.pixels.subarray(offset, offset + 4).equals(after.pixels.subarray(offset, offset + 4))) changedInside += 1;
  }
  if (changedInside < 1000) throw new Error("P6_V9_CLEANUP_NOT_APPLIED");
  if (sha256(readFileSync(basePath)) !== spec.baseProviderAssetSha) throw new Error("P6_V9_HISTORY_MUTATED");
  const record = {
    ...spec,
    maskRegionsHash: stableHash(spec.maskRegions),
    baseProviderPath: relative(repoRoot, basePath).replace(/\\/g, "/"),
    outputPath: relative(repoRoot, outputPath).replace(/\\/g, "/"),
    outputSha256: sha256(output),
    outputDimensions: readPngDimensions(output),
    outsideMaskPixelHashBefore: outsideBefore,
    outsideMaskPixelHashAfter: outsideAfter,
    changedPixelsInsideMasks: changedInside,
    pseudoArtifactGate: { status: "passed", before: artifactMetricsBefore, after: artifactMetricsAfter },
    status: "passed"
  };
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeJson(evidencePath, record);
  return record;
}

function renderOverlayWithSystemDrawing({ basePath, outputPath, spec }) {
  const config = Buffer.from(JSON.stringify({ basePath, outputPath, ...spec }), "utf8").toString("base64");
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${config}'))
$c = $json | ConvertFrom-Json
$source = [System.Drawing.Image]::FromFile($c.basePath)
try {
  $bitmap = New-Object System.Drawing.Bitmap($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $g.DrawImageUnscaled($source, 0, 0)
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
      $rect = New-Object System.Drawing.RectangleF([single]$c.safeArea.x, [single]$c.safeArea.y, [single]$c.safeArea.width, [single]$c.safeArea.height)
      $g.SetClip($rect)
      $font = New-Object System.Drawing.Font($c.font.family, [single]$c.font.sizePx, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($c.font.color))
      $format = New-Object System.Drawing.StringFormat
      try {
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
        $g.DrawString($c.overlayText, $font, $brush, $rect, $format)
      } finally { $format.Dispose(); $brush.Dispose(); $font.Dispose() }
    } finally { $g.Dispose() }
    $bitmap.Save($c.outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $bitmap.Dispose() }
} finally { $source.Dispose() }
`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`EXACT_TEXT_OVERLAY_RENDER_FAILED:${sanitizeEvidence(result.stderr || result.stdout || `exit ${result.status}`)}`);
}

export function create05OP7V8Overlay({ basePath = join(outputDir, "pages", "p7-v7.png"), outputPath = join(outputDir, "pages", "p7-v8.png"), evidencePath = join(outputDir, "p7-v8-overlay-evidence.json"), spec = P7_V8_OVERLAY } = {}) {
  if (spec.renderStrategy !== "provider_raster_with_exact_text_overlay" || spec.providerCalls !== 0 || spec.pureProvider !== false) throw new Error("P7_V8_OVERLAY_CONTRACT_INVALID");
  const base = readFileSync(basePath);
  if (sha256(base) !== spec.baseProviderAssetSha) throw new Error("P7_V8_BASE_PROVIDER_ASSET_SHA_MISMATCH");
  const dimensions = readPngDimensions(base);
  if (dimensions.width !== 1080 || dimensions.height !== 1440) throw new Error("P7_V8_BASE_DIMENSIONS_INVALID");
  const a = spec.safeArea;
  if (a.x < 0 || a.y < 0 || a.width <= 0 || a.height <= 0 || a.x + a.width > dimensions.width || a.y + a.height > 220) throw new Error("P7_V8_SAFE_AREA_INVALID");
  if (!existsSync(spec.font.file)) throw new Error("P7_V8_FONT_MISSING");
  mkdirSync(dirname(outputPath), { recursive: true });
  renderOverlayWithSystemDrawing({ basePath: resolve(basePath), outputPath: resolve(outputPath), spec });
  const output = readFileSync(outputPath);
  const outputDimensions = readPngDimensions(output);
  if (outputDimensions.width !== 1080 || outputDimensions.height !== 1440) throw new Error("P7_V8_OUTPUT_DIMENSIONS_INVALID");
  const before = decodeRgbaPng(base);
  const after = decodeRgbaPng(output);
  const outsideBefore = sha256(outsideSafeAreaPixels(before, a));
  const outsideAfter = sha256(outsideSafeAreaPixels(after, a));
  if (outsideBefore !== outsideAfter) throw new Error("P7_V8_OUTSIDE_SAFE_AREA_CHANGED");
  let changedInside = 0;
  for (let y = a.y; y < a.y + a.height; y += 1) for (let x = a.x; x < a.x + a.width; x += 1) {
    const offset = (y * before.width + x) * 4;
    if (!before.pixels.subarray(offset, offset + 4).equals(after.pixels.subarray(offset, offset + 4))) changedInside += 1;
  }
  if (changedInside < 500) throw new Error("P7_V8_OVERLAY_NOT_VISIBLE");
  if (sha256(readFileSync(basePath)) !== spec.baseProviderAssetSha) throw new Error("P7_V8_HISTORY_MUTATED");
  const record = {
    ...spec,
    overlayTextHash: sha256(Buffer.from(spec.overlayText, "utf8")),
    baseProviderPath: relative(repoRoot, basePath).replace(/\\/g, "/"),
    outputPath: relative(repoRoot, outputPath).replace(/\\/g, "/"),
    outputSha256: sha256(output),
    outputDimensions,
    outsideSafeAreaPixelHashBefore: outsideBefore,
    outsideSafeAreaPixelHashAfter: outsideAfter,
    changedPixelsInsideSafeArea: changedInside,
    status: "passed"
  };
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeJson(evidencePath, record);
  return record;
}

export function migrate05OP7V8Overlay() {
  const path = join(outputDir, "live-ledger.json");
  const state = json(path);
  if (state.contentVersion === 8) return state;
  if (state.contentVersion !== 7 || state.attemptedProviderRequests !== 11 || state.maxProviderRequestAttempts !== 11) throw new Error("P7_V8_LEDGER_BASE_INVALID");
  const failed = state.records.find((item) => item.pageId === "P7" && item.reviewStatus === "failed" && item.artifact?.normalizedSha256 === P7_V8_OVERLAY.baseProviderAssetSha);
  if (!failed) throw new Error("P7_V7_FAILURE_EVIDENCE_REQUIRED");
  const evidence = create05OP7V8Overlay();
  state.supersededRecords ||= [];
  state.supersededRecords.push({ ...failed, supersededBy: "P7@contentVersion8:exact-text-overlay", retainedAsFailureEvidence: true });
  state.records = state.records.filter((item) => item !== failed);
  state.records.push({
    pageId: "P7",
    requestHash: failed.requestHash,
    providerStatus: "reused_existing_provider_asset",
    providerCallCount: 0,
    providerRequestAttemptCount: 0,
    automaticRetries: 0,
    costStatus: "not_applicable_no_provider_call",
    actualCredits: 0,
    normalizationStatus: "passed",
    finalCanvasStatus: "passed",
    renderStrategy: evidence.renderStrategy,
    pureProvider: false,
    baseProviderAssetSha: evidence.baseProviderAssetSha,
    overlayTextHash: evidence.overlayTextHash,
    overlayEvidenceHash: stableHash(evidence),
    ocr: "not_run",
    fact: "not_run",
    visual: "not_run",
    manualAesthetic: "not_run",
    reviewStatus: "pending",
    userSelection: "not_selected",
    delivery: "not_delivered",
    blocker: null,
    artifact: { normalizedPath: evidence.outputPath, normalizedSha256: evidence.outputSha256, normalizedDimensions: evidence.outputDimensions }
  });
  state.contentVersion = 8;
  state.p7V8OverlayAdapter = {
    schemaVersion: "1.0",
    contract: "XhsP7V7ToV8ExactTextOverlayAdapter@1.0",
    fromContentVersion: 7,
    toContentVersion: 8,
    pageTruthUnchanged: true,
    baseProviderAssetSha: evidence.baseProviderAssetSha,
    overlayTextHash: evidence.overlayTextHash,
    renderStrategy: evidence.renderStrategy,
    pureProvider: false,
    providerCalls: 0,
    automaticRetries: 0,
    productionWrites: 0,
    rollback: "remove P7 V8 derived PNG and restore the retained P7 V7 failed record; never mutate the P7 V7 asset"
  };
  writeJson(path, state);
  return state;
}

export function migrate05OP6V9Cleanup() {
  const path = join(outputDir, "live-ledger.json");
  const state = json(path);
  if (state.contentVersion === 9) return state;
  if (state.contentVersion !== 8 || state.attemptedProviderRequests !== 11 || state.maxProviderRequestAttempts !== 11) throw new Error("P6_V9_LEDGER_BASE_INVALID");
  const prior = state.records.find((item) => item.pageId === "P6" && item.reviewStatus === "passed" && item.artifact?.normalizedSha256 === P6_V9_CLEANUP.baseProviderAssetSha);
  const p7 = state.records.find((item) => item.pageId === "P7" && item.reviewStatus === "passed" && item.renderStrategy === "provider_raster_with_exact_text_overlay");
  if (!prior || !p7) throw new Error("P6_V9_PRIOR_EVIDENCE_REQUIRED");
  const p7Evidence = create05OP7V8Overlay();
  if (p7.artifact.normalizedSha256 !== p7Evidence.outputSha256 || p7.baseProviderAssetSha !== p7Evidence.baseProviderAssetSha || p7.overlayTextHash !== p7Evidence.overlayTextHash) throw new Error("P7_V8_LEDGER_ARTIFACT_MISMATCH");
  p7.overlayEvidenceHash = stableHash(p7Evidence);
  p7.overlayEvidenceFileSha256 = sha256(readFileSync(join(outputDir, "p7-v8-overlay-evidence.json")));
  const evidence = create05OP6V9Cleanup();
  state.supersededRecords ||= [];
  state.supersededRecords.push({ ...prior, qualityWithdrawn: true, withdrawnReason: "controller review found pseudo-character horizontal artifacts in both blank separator bands", supersededBy: "P6@contentVersion9:artifact-cleanup", retainedAsFailureEvidence: true });
  const replacement = {
    pageId: "P6",
    requestHash: prior.requestHash,
    providerStatus: "reused_existing_provider_asset",
    providerCallCount: 0,
    providerRequestAttemptCount: 0,
    automaticRetries: 0,
    costStatus: "not_applicable_no_provider_call",
    actualCredits: 0,
    normalizationStatus: "passed",
    finalCanvasStatus: "passed",
    renderStrategy: evidence.renderStrategy,
    pureProvider: false,
    baseProviderAssetSha: evidence.baseProviderAssetSha,
    maskRegionsHash: evidence.maskRegionsHash,
    cleanupEvidenceHash: stableHash(evidence),
    cleanupEvidenceFileSha256: sha256(readFileSync(join(outputDir, "p6-v9-cleanup-evidence.json"))),
    ocr: "not_run",
    fact: "not_run",
    visual: "not_run",
    manualAesthetic: "not_run",
    reviewStatus: "pending",
    userSelection: "not_selected",
    delivery: "not_delivered",
    blocker: null,
    artifact: { normalizedPath: evidence.outputPath, normalizedSha256: evidence.outputSha256, normalizedDimensions: evidence.outputDimensions }
  };
  state.records = state.records.map((item) => item === prior ? replacement : item);
  state.contentVersion = 9;
  state.p6V9CleanupAdapter = {
    schemaVersion: "1.0",
    contract: "XhsP6V6ToV9ArtifactCleanupAdapter@1.0",
    fromContentVersion: 8,
    toContentVersion: 9,
    pageTruthUnchanged: true,
    baseProviderAssetSha: evidence.baseProviderAssetSha,
    maskRegionsHash: evidence.maskRegionsHash,
    renderStrategy: evidence.renderStrategy,
    pureProvider: false,
    providerCalls: 0,
    automaticRetries: 0,
    productionWrites: 0,
    rollback: "remove P6 V9 derived PNG and restore the retained, quality-withdrawn P6 V6 record; never mutate the P6 V6 Provider asset"
  };
  writeJson(path, state);
  return state;
}

export function migrate05OLedgerV4ToV5() {
  const path = join(outputDir, "live-ledger.json");
  if (!existsSync(path)) throw new Error("V4_LEDGER_MISSING");
  const state = json(path);
  if (state.contentVersion === 5) return state;
  const v4 = loadXhsPackage(packageV4Path).packageValue;
  const v5 = loadXhsPackage(packageV5Path).packageValue;
  const unchangedPageIds = PAGE_IDS.filter((pageId) => pageTruthHash(v4, pageId) === pageTruthHash(v5, pageId));
  const changedPageIds = PAGE_IDS.filter((pageId) => !unchangedPageIds.includes(pageId));
  if (stableHash(unchangedPageIds) !== stableHash(["P1", "P2", "P3", "P5", "P6", "P7"]) || stableHash(changedPageIds) !== stableHash(["P4"])) throw new Error("V5_COMPATIBILITY_SCOPE_INVALID");
  const kept = state.records.filter((item) => ["P1", "P2", "P3"].includes(item.pageId) && item.reviewStatus === "passed").map((item) => ({ ...item, reusedFromContentVersion: 4, additionalProviderCallsForV5: 0, v4PageTruthHash: pageTruthHash(v4, item.pageId), v5PageTruthHash: pageTruthHash(v5, item.pageId) }));
  if (kept.length !== 3) throw new Error("V5_PRIOR_PASSING_PAGES_REQUIRED");
  const failedP4 = state.records.find((item) => item.pageId === "P4" && item.reviewStatus === "failed");
  if (!failedP4) throw new Error("V4_P4_FAILURE_EVIDENCE_REQUIRED");
  const next = { ...state, contentVersion: 5, packageHash: packageQuality(v5).packageHash, compatibilityAdapter: { contract: "XhsPostPackageV4ToV5PageReuseAdapter@1.0", fromContentVersion: 4, toContentVersion: 5, unchangedPageIds, changedPageIds, priorPackageHash: packageQuality(v4).packageHash, currentPackageHash: packageQuality(v5).packageHash, pageTruthHashes: Object.fromEntries(PAGE_IDS.map((pageId) => [pageId, { v4: pageTruthHash(v4, pageId), v5: pageTruthHash(v5, pageId) }])) }, supersededRecords: [...(state.supersededRecords || []), { ...failedP4, supersededBy: "P4@contentVersion5", retainedAsFailureEvidence: true }], records: kept };
  writeJson(path, next);
  return next;
}

export function migrate05OP6PromptRevision2() {
  const path = join(outputDir, "live-ledger.json");
  const state = json(path);
  const failed = state.records.find((item) => item.pageId === "P6" && item.reviewStatus === "failed" && item.blocker?.includes("OCR_EXTRA_NUMBER"));
  if (!failed) throw new Error("P6_PROMPT_V1_FAILURE_EVIDENCE_REQUIRED");
  const v5 = loadXhsPackage(packageV5Path).packageValue;
  const v6 = loadXhsPackage(packageV6Path).packageValue;
  if (PAGE_IDS.some((pageId) => pageTruthHash(v5, pageId) !== pageTruthHash(v6, pageId))) throw new Error("V6_PAGE_TRUTH_CHANGED");
  const preflight = build05OPreflight();
  const nextHashes = Object.fromEntries(PAGE_IDS.map((pageId, index) => [pageId, stableHash(preflight.requests[index])]));
  const frozenUnchanged = { P1: "59bb2c542e9fc2acea696faab1ec832cfe603d8889693fe053a93da376be0984", P2: "242e2bb9f473e4c4bc50104e4114600d28b9b24d145c788bc8d274580c155245", P3: "621cf30abe914918477d187a195f65f1aa4d08bc90d5701dc65ce7795ee475f6", P4: "cfefae7b2417024352c2c2e2b8fe5be96518128d90fd76a98a7b388d193bbc66", P5: "3dad3bd9b85e09d507e92aebd19468691206e30f2a920e91d8874398ff0afd8c", P7: "8f41135cf40a2848208c4d2eb0e989902a8fd8e8460d8a2c73e98495a62e5bd6" };
  for (const [pageId, expected] of Object.entries(frozenUnchanged)) if (nextHashes[pageId] !== expected) throw new Error(`P6_PROMPT_RECOVERY_UNEXPECTED_PAGE_CHANGE:${pageId}`);
  if (nextHashes.P6 === failed.requestHash) throw new Error("P6_PROMPT_RECOVERY_REQUEST_UNCHANGED");
  state.contentVersion = 6;
  state.packageHash = packageQuality(v6).packageHash;
  state.promptPlanRevision = 2;
  state.promptRecoveryAdapter = { contract: "XhsPostPackageV5ToV6PromptRecoveryAdapter@1.0", fromContentVersion: 5, toContentVersion: 6, pageTruthUnchanged: true, changedPromptPageIds: ["P6"], unchangedPromptPageIds: ["P1", "P2", "P3", "P4", "P5", "P7"], priorPackageHash: packageQuality(v5).packageHash, currentPackageHash: packageQuality(v6).packageHash, priorRequestHash: failed.requestHash, replacementRequestHash: nextHashes.P6, priorPattern: "numbered process spine", replacementPattern: "equal-weight key points", reason: "prevent unbound structural numbering", additionalProviderCalls: 0 };
  state.supersededRecords ||= [];
  state.supersededRecords.push({ ...failed, supersededBy: "P6@promptPlanRevision2", retainedAsFailureEvidence: true });
  state.records = state.records.filter((item) => item !== failed);
  writeJson(path, state);
  return state;
}

export function authorize05OP6UnknownAttemptRecovery() {
  const path = join(outputDir, "live-ledger.json");
  const state = json(path);
  const unknown = state.records.find((item) => item.pageId === "P6" && item.providerStatus === "failed" && item.blocker === "fetch failed" && item.normalizationStatus === "not_run");
  if (!unknown) throw new Error("P6_UNKNOWN_ATTEMPT_EVIDENCE_REQUIRED");
  state.supersededRecords ||= [];
  state.supersededRecords.push({ ...unknown, providerStatus: "unknown_attempt", failureStage: "unknown_legacy_create_or_poll", retainedAsUnknownAttemptEvidence: true, supersededBy: "controller-authorized-p6-v6-checkpointed-recovery" });
  state.records = state.records.filter((item) => item !== unknown);
  state.attemptedProviderRequests = 8;
  state.maxProviderRequestAttempts = 10;
  state.unknownAttemptRecoveryAuthorization = { workItem: "FS-V1-XHS-VISUAL-05O", approvedBy: "controller-thread", maxAdditionalAttempts: 2, allowedPages: ["P6", "P7"], automaticRetries: 0, productionWrites: 0 };
  writeJson(path, state);
  return state;
}

export function migrate05OP7V7() {
  const path = join(outputDir, "live-ledger.json");
  const state = json(path);
  const v6 = loadXhsPackage(packageV6Path).packageValue;
  const v7 = loadXhsPackage(packagePath).packageValue;
  const unchangedPageIds = PAGE_IDS.filter((pageId) => pageTruthHash(v6, pageId) === pageTruthHash(v7, pageId));
  const changedPageIds = PAGE_IDS.filter((pageId) => !unchangedPageIds.includes(pageId));
  if (stableHash(unchangedPageIds) !== stableHash(["P1", "P2", "P3", "P4", "P5", "P6"]) || stableHash(changedPageIds) !== stableHash(["P7"])) throw new Error("V7_COMPATIBILITY_SCOPE_INVALID");
  const failed = state.records.find((item) => item.pageId === "P7" && item.reviewStatus === "failed" && item.blocker?.includes("OCR_EXPECTED_TEXT_MISSING"));
  if (!failed) throw new Error("P7_V6_FAILURE_EVIDENCE_REQUIRED");
  const preflight = build05OPreflight();
  const nextHashes = Object.fromEntries(PAGE_IDS.map((pageId, index) => [pageId, stableHash(preflight.requests[index])]));
  for (const record of state.records.filter((item) => item.pageId !== "P7")) if (record.requestHash !== nextHashes[record.pageId]) throw new Error(`V7_UNEXPECTED_REQUEST_CHANGE:${record.pageId}`);
  if (nextHashes.P7 === failed.requestHash) throw new Error("V7_P7_REQUEST_UNCHANGED");
  state.supersededRecords ||= [];
  state.supersededRecords.push({ ...failed, supersededBy: "P7@contentVersion7", retainedAsFailureEvidence: true });
  state.records = state.records.filter((item) => item !== failed);
  state.contentVersion = 7;
  state.packageHash = packageQuality(v7).packageHash;
  state.maxProviderRequestAttempts = 11;
  state.p7RecoveryAdapter = { contract: "XhsPostPackageV6ToV7PageRecoveryAdapter@1.0", fromContentVersion: 6, toContentVersion: 7, unchangedPageIds, changedPageIds, priorPackageHash: packageQuality(v6).packageHash, currentPackageHash: packageQuality(v7).packageHash, priorRequestHash: failed.requestHash, replacementRequestHash: nextHashes.P7, reason: "merge omitted headline into highest-priority visible text block", authorizedAdditionalAttempts: 1, automaticRetries: 0, productionWrites: 0 };
  writeJson(path, state);
  return state;
}

function ledger() {
  const path = join(outputDir, "live-ledger.json");
  return existsSync(path) ? json(path) : { schemaVersion: "1.0", contract: "XhsPublishCompleteLiveLedger@1.0", contentVersion: 5, packageHash: build05OPreflight().contentQuality.packageHash, automaticRetries: 0, productionWrites: 0, records: [] };
}

function liveCheckpointPath(pageId, checkpointDir = join(outputDir, "checkpoints")) {
  return join(checkpointDir, `${pageId.toLowerCase()}-v7.json`);
}

function readLedgerPath(path) {
  return existsSync(path) ? json(path) : { schemaVersion: "1.0", contract: "XhsPublishCompleteLiveLedger@1.0", contentVersion: 7, packageHash: build05OPreflight().contentQuality.packageHash, automaticRetries: 0, productionWrites: 0, attemptedProviderRequests: 0, maxProviderRequestAttempts: 11, records: [] };
}

export async function run05OPageLive(pageId, { operations = defaultLiveOperations, apiKey = null, statePath = join(outputDir, "live-ledger.json"), checkpointDir = join(outputDir, "checkpoints") } = {}) {
  if (!PAGE_IDS.includes(pageId)) throw new Error("PAGE_ID_INVALID");
  const preflight = build05OPreflight();
  mkdirSync(checkpointDir, { recursive: true });
  const state = readLedgerPath(statePath);
  if (state.packageHash !== preflight.contentQuality.packageHash) throw new Error("LIVE_LEDGER_PACKAGE_HASH_MISMATCH");
  const index = PAGE_IDS.indexOf(pageId);
  if (index > 0 && state.records.find((item) => item.pageId === PAGE_IDS[index - 1])?.reviewStatus !== "passed") throw new Error(`PRIOR_PAGE_REVIEW_REQUIRED:${PAGE_IDS[index - 1]}`);
  const request = preflight.requests[index];
  const requestHash = stableHash(request);
  const cpPath = liveCheckpointPath(pageId, checkpointDir);
  let checkpoint = existsSync(cpPath) ? json(cpPath) : null;
  let record = state.records.find((item) => item.pageId === pageId);
  if (record && (!checkpoint?.taskId || checkpoint.requestHash !== requestHash)) throw new Error("PAGE_ALREADY_CALLED_WITHOUT_RESUMABLE_TASK");
  if (!record && checkpoint) throw new Error("CHECKPOINT_WITHOUT_LEDGER_RECORD");
  if (record && checkpoint?.taskId) {
    record.resumeCount = (record.resumeCount || 0) + 1;
    record.resumedExistingTask = true;
    record.providerStatus = "pending";
    record.blocker = null;
  } else {
    if ((state.attemptedProviderRequests || 0) >= (state.maxProviderRequestAttempts || 10)) throw new Error("PROVIDER_ATTEMPT_BUDGET_EXHAUSTED");
    record = { pageId, requestHash, providerStatus: "pending", providerCallCount: 0, providerRequestAttemptCount: 0, resumeCount: 0, resumedExistingTask: false, automaticRetries: 0, costStatus: "pending", preCallCredits: null, postCallCredits: null, actualCredits: null, normalizationStatus: "not_run", ocr: "not_run", fact: "not_run", visual: "not_run", manualAesthetic: "not_run", reviewStatus: "pending", userSelection: "not_selected", delivery: "not_delivered", blocker: null, failureStage: null };
    state.records.push(record);
  }
  const persist = () => writeJson(statePath, state);
  const persistCheckpoint = (value) => { checkpoint = value; writeJson(cpPath, value); };
  const resolvedKey = apiKey || loadApiKey();
  let stage = checkpoint?.taskId ? "polling" : "preCredit";
  try {
    if (!checkpoint?.taskId) {
      persistCheckpoint({ schemaVersion: "1.0", contract: "XhsPublishCompleteTaskCheckpoint@1.0", pageId, contentVersion: 7, requestHash, stage: "preCredit", preCallCredits: null, taskId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const before = await operations.credits(resolvedKey);
      assert.ok(Number.isFinite(before) && before >= 8, "INSUFFICIENT_OR_UNKNOWN_CREDITS");
      record.preCallCredits = before;
      stage = "create_requested";
      record.providerRequestAttemptCount = 1; record.providerCallCount = 1;
      state.attemptedProviderRequests = (state.attemptedProviderRequests || 0) + 1;
      persistCheckpoint({ ...checkpoint, stage, preCallCredits: before, updatedAt: new Date().toISOString() });
      persist();
      const taskId = await operations.createTask(resolvedKey, request);
      stage = "task_created";
      persistCheckpoint({ ...checkpoint, stage, taskId, updatedAt: new Date().toISOString() });
    }
    stage = "polling";
    persistCheckpoint({ ...checkpoint, stage, updatedAt: new Date().toISOString() });
    const task = await operations.pollTask(resolvedKey, checkpoint.taskId, { maxPolls: 180, intervalMs: 3000 });
    stage = "artifact";
    const artifact = normalizeArtifact(pageId, await operations.downloadResult(task), 7);
    Object.assign(record, { providerStatus: "succeeded", normalizationStatus: "passed", finalCanvasStatus: "passed", artifact });
    persistCheckpoint({ ...checkpoint, stage, artifactSha256: artifact.normalizedSha256, updatedAt: new Date().toISOString() });
    stage = "postCredit";
    const after = await operations.credits(resolvedKey);
    record.postCallCredits = after;
    record.actualCredits = Math.max(0, record.preCallCredits - after);
    record.costStatus = record.actualCredits <= 8 ? "measured" : "failed";
    if (record.costStatus === "failed") record.blocker = "ACTUAL_CREDITS_PER_CALL_EXCEEDED";
    persistCheckpoint({ ...checkpoint, stage: "complete", postCallCredits: after, actualCredits: record.actualCredits, updatedAt: new Date().toISOString() });
  } catch (error) {
    record.providerStatus = checkpoint?.taskId ? "interrupted_recoverable" : stage === "create_requested" ? "unknown_attempt" : "failed";
    record.failureStage = stage;
    record.blocker = sanitizeEvidence(error.message);
  }
  persist();
  return record;
}

export function record05OPageReview(reviewInput) {
  const state = ledger();
  const record = state.records.find((item) => item.pageId === reviewInput.pageId);
  if (!record || !["succeeded", "reused_existing_provider_asset"].includes(record.providerStatus) || record.normalizationStatus !== "passed" || !["pending", "failed"].includes(record.reviewStatus)) throw new Error("REVIEW_TARGET_NOT_READY");
  if (record.reviewStatus === "failed") {
    record.priorReviewAttempts ||= [];
    record.priorReviewAttempts.push({ reviewStatus: record.reviewStatus, blocker: record.blocker, evidence: record.reviewEvidence, correctedWithoutProviderCall: true });
  }
  const pkg = loadXhsPackage(packagePath).packageValue;
  const page = pkg.data.deck.pages.find((item) => `P${item.page}` === reviewInput.pageId);
  const expectedTexts = page.text_layers.map((item) => item.text);
  const ocr = validateObservedPageText({ pageId: reviewInput.pageId, expectedTexts, observedTexts: reviewInput.observedTexts, pseudoText: reviewInput.pseudoText === true });
  record.ocr = ocr.status;
  record.fact = reviewInput.fact === "passed" ? "passed" : "failed";
  record.visual = reviewInput.visual === "passed" ? "passed" : "failed";
  record.manualAesthetic = reviewInput.manualAesthetic === "passed" ? "passed" : "failed";
  record.reviewEvidence = { method: "multimodal-manual-transcription-and-visual-review", ocr, notes: reviewInput.notes || "" };
  record.reviewStatus = [record.ocr, record.fact, record.visual, record.manualAesthetic].every((item) => item === "passed") ? "passed" : "failed";
  record.blocker = record.reviewStatus === "failed" ? [...ocr.blockers, ...(record.fact === "failed" ? ["FACT_GATE_FAILED"] : []), ...(record.visual === "failed" ? ["VISUAL_GATE_FAILED"] : []), ...(record.manualAesthetic === "failed" ? ["MANUAL_AESTHETIC_FAILED"] : [])].filter(Boolean).join("|") : null;
  writeJson(join(outputDir, "live-ledger.json"), state);
  return record;
}

function files(root, current = root) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const path = join(current, entry.name);
    return entry.isDirectory() ? files(root, path) : [{ path: relative(root, path).replace(/\\/g, "/"), bytes: statSync(path).size, sha256: sha256(readFileSync(path)) }];
  });
}

function expectedDeliveryFiles({ includeManifest = false } = {}) {
  return ["xhs-post-package.json", "quality-evidence.json", ...PAGE_IDS.map((pageId) => `pages/${pageId.toLowerCase()}.png`), ...(includeManifest ? ["manifest.json"] : [])].sort();
}

function assertExactFileSet(fileEntries, expected, code) {
  const actual = fileEntries.map((item) => item.path).sort();
  if (stableHash(actual) !== stableHash(expected)) throw new Error(`${code}:${actual.join(",")}`);
}

function verifyFinalRecordEvidence(record, evidenceRoot) {
  if (record.pageId === "P6") {
    if (record.renderStrategy !== "provider_raster_with_artifact_cleanup" || record.pureProvider !== false || record.providerStatus !== "reused_existing_provider_asset") throw new Error("DELIVERY_P6_CLEANUP_STRATEGY_REQUIRED");
    const bytes = readFileSync(join(evidenceRoot, "p6-v9-cleanup-evidence.json"));
    const evidence = JSON.parse(bytes.toString("utf8"));
    if (stableHash(evidence) !== record.cleanupEvidenceHash || sha256(bytes) !== record.cleanupEvidenceFileSha256 || evidence.status !== "passed" || evidence.pseudoArtifactGate?.status !== "passed" || evidence.outsideMaskPixelHashBefore !== evidence.outsideMaskPixelHashAfter) throw new Error("DELIVERY_P6_CLEANUP_EVIDENCE_MISMATCH");
  } else if (record.pageId === "P7") {
    if (record.renderStrategy !== "provider_raster_with_exact_text_overlay" || record.pureProvider !== false || record.providerStatus !== "reused_existing_provider_asset") throw new Error("DELIVERY_P7_OVERLAY_STRATEGY_REQUIRED");
    const bytes = readFileSync(join(evidenceRoot, "p7-v8-overlay-evidence.json"));
    const evidence = JSON.parse(bytes.toString("utf8"));
    if (stableHash(evidence) !== record.overlayEvidenceHash || sha256(bytes) !== record.overlayEvidenceFileSha256 || evidence.status !== "passed" || evidence.outsideSafeAreaPixelHashBefore !== evidence.outsideSafeAreaPixelHashAfter) throw new Error("DELIVERY_P7_OVERLAY_EVIDENCE_MISMATCH");
  } else if (record.providerStatus !== "succeeded" || (record.renderStrategy && record.renderStrategy !== "provider_raster") || record.pureProvider === false) throw new Error(`DELIVERY_PROVIDER_RECORD_INVALID:${record.pageId}`);
}

export function build05ODeliveryManifest({ packageValue, packageHash, records, fileEntries, evidenceRoot = outputDir, artifactRoot = repoRoot }) {
  const quality = packageQuality(packageValue);
  if (quality.status !== "passed") throw new Error("DELIVERY_PACKAGE_CONTENT_GATE_REQUIRED");
  if (packageHash !== quality.packageHash) throw new Error("DELIVERY_PACKAGE_HASH_MISMATCH");
  if (!Array.isArray(records) || records.length !== 7 || records.some((item) => [item.reviewStatus, item.ocr, item.fact, item.visual, item.manualAesthetic, item.normalizationStatus, item.finalCanvasStatus].some((status) => status !== "passed"))) throw new Error("DELIVERY_PAGE_REVIEWS_REQUIRED");
  const expectedPageIds = packageValue.data.deck.pages.map((page) => `P${page.page}`);
  if (stableHash(expectedPageIds) !== stableHash(PAGE_IDS) || stableHash(records.map((item) => item.pageId)) !== stableHash(PAGE_IDS)) throw new Error("DELIVERY_PAGE_SET_OR_ORDER_INVALID");
  if (!Array.isArray(fileEntries) || fileEntries.some((item) => !item.path || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isFinite(item.bytes))) throw new Error("DELIVERY_FILE_MANIFEST_INVALID");
  assertExactFileSet(fileEntries, expectedDeliveryFiles(), "DELIVERY_FILE_SET_INVALID");
  const byPath = new Map(fileEntries.map((item) => [item.path, item]));
  for (const record of records) {
    verifyFinalRecordEvidence(record, evidenceRoot);
    const dimensions = record.artifact?.normalizedDimensions;
    if (dimensions?.width !== 1080 || dimensions?.height !== 1440) throw new Error(`DELIVERY_PAGE_DIMENSIONS_INVALID:${record.pageId}`);
    const artifactPath = resolve(artifactRoot, record.artifact.normalizedPath);
    const bytes = readFileSync(artifactPath);
    if (sha256(bytes) !== record.artifact.normalizedSha256 || readPngDimensions(bytes).width !== 1080 || readPngDimensions(bytes).height !== 1440) throw new Error(`DELIVERY_LEDGER_ARTIFACT_MISMATCH:${record.pageId}`);
    const entry = byPath.get(`pages/${record.pageId.toLowerCase()}.png`);
    if (entry.sha256 !== record.artifact.normalizedSha256 || entry.bytes !== bytes.length) throw new Error(`DELIVERY_FILE_ARTIFACT_MISMATCH:${record.pageId}`);
  }
  const packageEntry = byPath.get("xhs-post-package.json");
  const packageBytes = Buffer.from(`${JSON.stringify(packageValue, null, 2)}\n`, "utf8");
  if (!packageEntry || packageEntry.sha256 !== sha256(packageBytes)) throw new Error("DELIVERY_PACKAGE_FILE_HASH_MISMATCH");
  const sourceRegistry = loadXhsSourceRegistrySnapshot(sourceRegistryPath, { gitCwd: repoRoot });
  return {
    schemaVersion: "1.0", contract: "XhsPublishCompleteDeliveryManifest@1.0", contentContract: "XhsPostPackage@2.0", contentVersion: 9, packageHash,
    sourceRegistry: { id: sourceRegistry.snapshot.id, snapshotHash: sourceRegistry.validation.snapshotHash, authority: sourceRegistry.snapshot.authority },
    pageCount: 7,
    postCopy: { titleCandidates: packageValue.data.post_copy.title_candidates.length, hashtags: packageValue.data.post_copy.hashtags.length, pinnedComment: Boolean(packageValue.data.post_copy.pinned_comment), singleCta: Boolean(packageValue.data.post_copy.cta) },
    states: records.map((item) => ({ pageId: item.pageId, provider: item.providerStatus, renderStrategy: item.renderStrategy || "provider_raster", pureProvider: item.pureProvider !== false, baseProviderAssetSha: item.baseProviderAssetSha || null, maskRegionsHash: item.maskRegionsHash || null, overlayTextHash: item.overlayTextHash || null, ocr: item.ocr, fact: item.fact, visual: item.visual, manualAesthetic: item.manualAesthetic, userSelection: item.userSelection, delivery: "included_in_review_package" })),
    productionWrites: 0, featureFlagDefault: false, files: fileEntries
  };
}

export function verify05OZipBuffer(zip, expectedEntries) {
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocd = zip.lastIndexOf(eocdSignature);
  if (eocd < 0 || eocd + 22 !== zip.length) throw new Error("ZIP_EOCD_INVALID");
  const entryCount = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  const local = new Map();
  let cursor = 0;
  while (cursor < centralOffset) {
    if (zip.readUInt32LE(cursor) !== 0x04034b50) throw new Error("ZIP_LOCAL_HEADER_INVALID");
    const method = zip.readUInt16LE(cursor + 8); const crc = zip.readUInt32LE(cursor + 14); const compressedSize = zip.readUInt32LE(cursor + 18); const size = zip.readUInt32LE(cursor + 22); const nameLength = zip.readUInt16LE(cursor + 26); const extraLength = zip.readUInt16LE(cursor + 28);
    if (method !== 8) throw new Error("ZIP_METHOD_INVALID");
    const name = zip.subarray(cursor + 30, cursor + 30 + nameLength).toString("utf8");
    const start = cursor + 30 + nameLength + extraLength; const end = start + compressedSize;
    let data;
    try { data = inflateRawSync(zip.subarray(start, end)); } catch { throw new Error(`ZIP_ENTRY_DEFLATE_INVALID:${name}`); }
    if (data.length !== size || crc32(data) !== crc) throw new Error(`ZIP_ENTRY_CRC_OR_SIZE_INVALID:${name}`);
    local.set(name, { data, size, crc, sha256: sha256(data) }); cursor = end;
  }
  if (cursor !== centralOffset || centralOffset + centralSize !== eocd || entryCount !== local.size) throw new Error("ZIP_CENTRAL_DIRECTORY_RANGE_INVALID");
  const centralNames = [];
  cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP_CENTRAL_HEADER_INVALID");
    const crc = zip.readUInt32LE(cursor + 16); const size = zip.readUInt32LE(cursor + 24); const nameLength = zip.readUInt16LE(cursor + 28); const extraLength = zip.readUInt16LE(cursor + 30); const commentLength = zip.readUInt16LE(cursor + 32);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (!local.has(name) || local.get(name).crc !== crc || local.get(name).size !== size) throw new Error(`ZIP_CENTRAL_ENTRY_MISMATCH:${name}`);
    centralNames.push(name); cursor += 46 + nameLength + extraLength + commentLength;
  }
  const expected = new Map(expectedEntries.map((item) => [item.path, item]));
  if (stableHash([...local.keys()].sort()) !== stableHash([...expected.keys()].sort()) || stableHash(centralNames.sort()) !== stableHash([...expected.keys()].sort())) throw new Error("ZIP_ENTRY_SET_INVALID");
  for (const [name, entry] of local) {
    const expectedEntry = expected.get(name);
    if (entry.size !== expectedEntry.bytes || entry.sha256 !== expectedEntry.sha256) throw new Error(`ZIP_ENTRY_BYTES_OR_SHA_INVALID:${name}`);
  }
  return { status: "passed", entries: local.size, sha256: sha256(zip) };
}

export function create05OReviewPackage({ statePath = join(outputDir, "live-ledger.json"), targetRoot = join(outputDir, "delivery", "xhs-post-package-v9"), zipPath = join(outputDir, "delivery", "FlowSocial_xiaohongshu_publish_complete_v9.zip") } = {}) {
  if (existsSync(targetRoot) || existsSync(zipPath) || existsSync(`${zipPath}.sha256`)) throw new Error("DELIVERY_TARGET_ALREADY_EXISTS");
  const state = json(statePath);
  if (state.contentVersion !== 9 || state.records.length !== 7) throw new Error("ALL_PAGE_REVIEWS_REQUIRED");
  mkdirSync(dirname(targetRoot), { recursive: true });
  mkdirSync(targetRoot);
  mkdirSync(join(targetRoot, "pages"));
  writeJson(join(targetRoot, "xhs-post-package.json"), loadXhsPackage(packagePath).packageValue);
  for (const record of state.records) copyFileSync(resolve(repoRoot, record.artifact.normalizedPath), join(targetRoot, "pages", `${record.pageId.toLowerCase()}.png`));
  copyFileSync(statePath, join(targetRoot, "quality-evidence.json"));
  const before = files(targetRoot);
  assertExactFileSet(before, expectedDeliveryFiles(), "DELIVERY_STALE_OR_MISSING_FILE");
  const manifest = build05ODeliveryManifest({ packageValue: loadXhsPackage(packagePath).packageValue, packageHash: state.packageHash, records: state.records, fileEntries: before });
  writeJson(join(targetRoot, "manifest.json"), manifest);
  const all = files(targetRoot);
  assertExactFileSet(all, expectedDeliveryFiles({ includeManifest: true }), "DELIVERY_FINAL_FILE_SET_INVALID");
  const zip = zipEntries(all.map((item) => ({ name: item.path, data: readFileSync(join(targetRoot, item.path)) })));
  const verification = verify05OZipBuffer(zip, all);
  writeFileSync(zipPath, zip);
  const persisted = readFileSync(zipPath);
  const persistedVerification = verify05OZipBuffer(persisted, all);
  if (persistedVerification.sha256 !== verification.sha256) throw new Error("ZIP_PERSISTED_SHA_MISMATCH");
  writeFileSync(`${zipPath}.sha256`, `${verification.sha256}  ${relative(outputDir, zipPath).replace(/\\/g, "/")}\n`, "utf8");
  return { zipPath, bytes: zip.length, sha256: verification.sha256, manifestPath: join(targetRoot, "manifest.json"), verification: persistedVerification };
}

async function main() {
  const [mode, value] = process.argv.slice(2);
  if (mode === "--offline") console.log(JSON.stringify(prepare05OOffline(), null, 2));
  else if (mode === "--migrate-v5") console.log(JSON.stringify(migrate05OLedgerV4ToV5(), null, 2));
  else if (mode === "--migrate-p6-prompt-v2") console.log(JSON.stringify(migrate05OP6PromptRevision2(), null, 2));
  else if (mode === "--authorize-p6-unknown-recovery") console.log(JSON.stringify(authorize05OP6UnknownAttemptRecovery(), null, 2));
  else if (mode === "--migrate-p7-v7") console.log(JSON.stringify(migrate05OP7V7(), null, 2));
  else if (mode === "--overlay-p7-v8") console.log(JSON.stringify(create05OP7V8Overlay(), null, 2));
  else if (mode === "--migrate-p7-v8") console.log(JSON.stringify(migrate05OP7V8Overlay(), null, 2));
  else if (mode === "--cleanup-p6-v9") console.log(JSON.stringify(create05OP6V9Cleanup(), null, 2));
  else if (mode === "--migrate-p6-v9") console.log(JSON.stringify(migrate05OP6V9Cleanup(), null, 2));
  else if (mode === "--live-page" && PAGE_IDS.includes(value)) console.log(JSON.stringify(await run05OPageLive(value), null, 2));
  else if (mode === "--record-review" && value) console.log(JSON.stringify(record05OPageReview(json(resolve(value))), null, 2));
  else if (mode === "--package") console.log(JSON.stringify(create05OReviewPackage(), null, 2));
  else throw new Error("USAGE: --offline | --live-page P1..P7 | --record-review <json> | --overlay-p7-v8 | --migrate-p7-v8 | --cleanup-p6-v9 | --migrate-p6-v9 | --package");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(sanitizeEvidence(error.stack || error.message)); process.exitCode = 1; });
