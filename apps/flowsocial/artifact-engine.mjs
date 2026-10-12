import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { chromium } from "playwright";
import { requireConfirmedXhsStoryboard, storyboardRenderPages, validateXhsVisualStoryboard } from "./content-agent/xhs-visual-storyboard.mjs";
import { getVisualCandidates, inspectNoTextVisualPrompt, requireConfirmedVisualDirection, requireVisualCandidatesReady, validateVisualDirectionSet, visualCandidateSummary } from "./content-agent/xhs-visual-director.mjs";
import { evaluateDeterministicPageQuality, selectDeterministicPreset, verifyDeterministicPageQualityArtifacts } from "./content-agent/visual-review-engine.mjs";
import { evaluateXhsPageFactClaims } from "./content-agent/patch-engine.mjs";
import { buildWechatIllustratedHtml, buildWechatUploadAdapter, evaluateWechatIllustratedQualityGates, materializeWechatAssets, validateWechatIllustratedOutput, wechatIllustratedDeliveryEnabled } from "./content-agent/wechat-illustrated-delivery.mjs";
import { adaptLegacyWechatImagePlanReadOnly, adaptWechatImagePlanOutput } from "./content-agent/wechat-image-plan-adapter.mjs";
import { featureFlags } from "./feature-flags.mjs";


const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const safeName = (value = "asset") => String(value).replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "asset";
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

async function downloadImage(url, targetBase) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`下载生成图片失败：${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const extension = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 512) throw new Error("生成图片文件异常，文件过小");
  const path = `${targetBase}${extension}`;
  await writeFile(path, buffer);
  return { path, bytes: buffer.length, sha256: sha256(buffer), contentType };
}

function collectImageSpecs(task) {
  if (task.platform === "xiaohongshu") {
    if (task.visualDirectionSet) {
      const count = Number(task.visualDirectionSet.candidateCount || 1);
      return task.visualDirectionSet.pages.filter((page) => page.renderStrategy === "generated_raster").flatMap((page) => Array.from({ length: count }, (_, index) => ({
        assetId: `${page.pageId}_candidate_${index + 1}`,
        candidateId: `${page.pageId}_candidate_${index + 1}`,
        candidateIndex: index + 1,
        pageId: page.pageId,
        role: "deck_background",
        prompt: page.prompt,
        negativePrompt: page.negativePrompt,
        aspectRatio: "3:4",
        provider: task.visualDirectionSet.provider,
        model: task.visualDirectionSet.model,
        quality: task.visualDirectionSet.quality
      })));
    }
    const legacySpecs = task.currentContent?.image_specs || [];
    const pages = task.visualStoryboard?.pages || task.currentContent?.deck?.pages || [];
    return pages.filter((page) => (page.renderStrategy || page.render_strategy) === "generated_raster").map((page, index) => {
      const pageId = page.pageId || page.page_id || `P${index + 1}`;
      const legacy = legacySpecs.find((spec) => spec.page_id === pageId) || {};
      return {
      assetId: legacy.asset_id || pageId || `xhs_${index + 1}`,
      pageId,
      role: "deck_background",
      prompt: page.imagePrompt || page.image_prompt || legacy.prompt,
      negativePrompt: page.imageNegativePrompt || page.image_negative_prompt || legacy.negative_prompt || (legacy.prohibitions || []).join(", ") || "no text, no logo, no watermark",
      aspectRatio: "3:4"
    };
    });
  }
  if (!task.currentContent?.image_plan) return [];
  const plan = adaptWechatImagePlanOutput(task.currentContent.image_plan);
  return plan.declarations.filter((item) => item.strategy === "generated_raster").map((spec, index) => ({
    assetId: spec.assetId || spec.slotId || `wechat_${index + 1}`,
    pageId: spec.slotId || null,
    role: spec.role === "cover" ? "cover" : "article_image",
    prompt: spec.imageSpec?.prompt,
    negativePrompt: spec.imageSpec?.negative_prompt || spec.source.negative_prompt || "no text, no logo, no watermark",
    aspectRatio: spec.role === "cover" ? "16:9" : "3:2"
  }));
}

/** Explicit read-only compatibility entry. It cannot create unified Artifact facts. */
export function inspectLegacyWechatArtifactInput(task) {
  return adaptLegacyWechatImagePlanReadOnly(task?.currentContent?.image_plan || {});
}

export function syncContentImageTasks(task) {
  const specs = collectImageSpecs(task);
  const specByPage = new Map(specs.map((item) => [item.pageId || item.assetId, item]));
  const generated = task.visualDirectionSet ? getVisualCandidates(task) : (task.generatedAssets || []).filter((item) => item.version === task.version);
  const rendered = task.delivery?.version === task.version ? task.delivery.rendered || [] : [];
  const sources = task.platform === "xiaohongshu"
    ? (task.visualStoryboard?.pages || task.currentContent?.deck?.pages || []).map((page, index) => ({ pageId: page.pageId || page.page_id || `P${index + 1}`, pageNumber: index + 1, role: page.roleLabel || page.pageRole || page.page_role || "内容页", visualDirection: page.visualDescription || page.visual_direction || "" }))
    : specs.map((spec, index) => ({ pageId: spec.pageId || spec.assetId, pageNumber: index + 1, role: spec.role, visualDirection: spec.prompt || "" }));
  task.imageTasks = sources.map((source) => {
    const spec = specByPage.get(source.pageId) || null;
    const pageCandidates = generated.filter((item) => item.pageId === source.pageId);
    const asset = spec ? pageCandidates.find((item) => item.selected && item.providerStatus === "succeeded" && item.qualityStatus === "approved") || pageCandidates.find((item) => item.providerStatus === "succeeded") || pageCandidates.find((item) => item.providerStatus === "failed") || null : null;
    const output = rendered.find((item) => item.pageId === source.pageId) || null;
    return {
      id: `${task.id}_v${task.version}_${source.pageId}`,
      version: task.version,
      ...source,
      assetId: spec?.assetId || null,
      prompt: spec?.prompt || null,
      generationStatus: spec ? asset?.providerStatus || asset?.status || "pending" : "not_required",
      qualityStatus: spec ? asset?.qualityStatus || "pending_review" : "not_required",
      generationError: asset?.error || null,
      generationRetryable: Boolean(spec && (asset?.providerStatus || asset?.status) === "failed"),
      generatedAssetPath: (asset?.providerStatus || asset?.status) === "succeeded" ? asset.relativePath : null,
      candidates: pageCandidates,
      renderStatus: output?.status || "pending",
      renderError: output?.error || null,
      downloadPath: output?.status === "succeeded" ? output.pngPath || output.pasteHtmlPath || output.markdownPath : null,
      qualityReport: output?.qualityReport || null
    };
  });
  return task.imageTasks;
}

export async function generateContentAssets(task, deps, options = {}) {
  if (task.platform === "xiaohongshu") requireConfirmedXhsStoryboard(task);
  if (task.platform === "xiaohongshu" && task.visualDirectionSet) requireConfirmedVisualDirection(task);
  const specs = collectImageSpecs(task);
  const selected = options.assetIds?.length ? specs.filter((item) => options.assetIds.includes(item.assetId) || options.assetIds.includes(item.pageId)) : specs;
  const limited = Number(options.maxAssets) > 0 ? selected.slice(0, Number(options.maxAssets)) : selected;
  const promptBlockers = task.visualDirectionSet
    ? limited.map((spec) => ({ assetId: spec.assetId, ...inspectNoTextVisualPrompt(spec.prompt) })).filter((item) => !item.passed)
    : [];
  if (promptBlockers.length) {
    throw Object.assign(new Error("无字底图提示词包含高风险文字构图词，已在 Provider 调用前阻断"), { statusCode: 409, code: "XHS_NO_TEXT_PROMPT_BLOCKED", details: promptBlockers });
  }
  const candidateMode = task.platform === "xiaohongshu" && Boolean(task.visualDirectionSet);
  if (candidateMode && options.force && Number(options.approvedAdditionalCalls) !== limited.length) {
    throw Object.assign(new Error(`单页重试会新增 ${limited.length} 次图片调用，请明确批准相同调用数后再执行`), { statusCode: 409, code: "XHS_ADDITIONAL_IMAGE_CALL_APPROVAL_REQUIRED", details: { requiredCalls: limited.length, approvedCalls: Number(options.approvedAdditionalCalls) || 0 } });
  }
  const versionRoot = join(deps.root, "artifacts", task.id, `v${task.version}`);
  const assetDir = join(versionRoot, "assets");
  await mkdir(assetDir, { recursive: true });
  const previous = candidateMode ? getVisualCandidates(task) : task.generatedAssets || [];
  const results = [];
  for (const spec of limited) {
    const old = previous.find((item) => item.assetId === spec.assetId && item.version === task.version && item.status === "succeeded");
    const priorAttempt = previous.find((item) => item.assetId === spec.assetId && item.version === task.version)?.attempt || 0;
    if (old && !options.force && await exists(join(deps.root, old.relativePath))) {
      results.push(old);
      continue;
    }
    const startedAt = new Date().toISOString();
    try {
      if (!spec.prompt) throw new Error("ImageSpec 缺少 prompt");
      const provider = await deps.generateImage({ prompt: `${spec.prompt}. ${spec.negativePrompt || ""}`.trim(), aspectRatio: spec.aspectRatio, provider: spec.provider, model: spec.model, quality: spec.quality });
      if (provider.status !== "succeeded" || !provider.imageUrl) throw new Error(provider.status === "not_configured" ? "生图服务未配置" : provider.error || "生图供应商未返回可下载图片");
      const downloaded = await downloadImage(provider.imageUrl, join(assetDir, safeName(spec.assetId)));
      results.push({
        id: `asset_${randomUUID().slice(0, 8)}`, assetId: spec.assetId, candidateId: spec.candidateId || null, candidateIndex: spec.candidateIndex || 1, attempt: priorAttempt + 1, pageId: spec.pageId, role: spec.role,
        version: task.version, status: "succeeded", providerStatus: "succeeded", qualityStatus: candidateMode ? "pending_review" : null, rejectionReasons: [], prompt: spec.prompt, negativePrompt: spec.negativePrompt,
        provider: provider.provider || spec.provider || "Kie.ai", providerMode: provider.mode || null, billableCall: provider.mode === "live" && provider.provider === "Kie.ai", providerTaskId: provider.taskId || null, model: provider.model || spec.model || null, quality: spec.quality || null, selected: false,
        relativePath: relative(deps.root, downloaded.path).replace(/\\/g, "/"), bytes: downloaded.bytes, sha256: downloaded.sha256,
        startedAt, completedAt: new Date().toISOString(), error: null
      });
    } catch (error) {
      results.push({
        id: `asset_${randomUUID().slice(0, 8)}`, assetId: spec.assetId, candidateId: spec.candidateId || null, candidateIndex: spec.candidateIndex || 1, attempt: priorAttempt + 1, pageId: spec.pageId, role: spec.role,
        version: task.version, status: "failed", providerStatus: "failed", qualityStatus: candidateMode ? "pending_review" : null, rejectionReasons: [], prompt: spec.prompt, negativePrompt: spec.negativePrompt,
        provider: spec.provider || "Kie.ai", providerMode: null, billableCall: false, model: spec.model || null, quality: spec.quality || null, providerTaskId: null, relativePath: null, bytes: 0, sha256: null, selected: false,
        startedAt, completedAt: new Date().toISOString(), error: error.message, retryable: true
      });
    }
  }
  const touched = new Set(results.map((item) => item.assetId));
  const merged = [...previous.filter((item) => !(item.version === task.version && touched.has(item.assetId))), ...results];
  if (candidateMode) {
    task.visualCandidates = merged;
    task.visualWorkflowState = "candidate_selection";
  } else task.generatedAssets = merged;
  task.assetSummary = {
    requested: limited.length,
    succeeded: results.filter((item) => item.status === "succeeded").length,
    failed: results.filter((item) => item.status === "failed").length,
    pending: Math.max(0, specs.length - limited.length),
    totalSpecs: specs.length,
    updatedAt: new Date().toISOString()
  };
  syncContentImageTasks(task);
  return { items: results, candidates: candidateMode ? task.visualCandidates : null, summary: task.assetSummary, imageTasks: task.imageTasks };
}

function xhsBodyMarkup(page) {
  const stripListMarker = (item) => String(item || "").replace(/^\s*(?:[•·\-—]\s*|\d+\s*[.、)]\s*)/, "").trim();
  const items = (page.body_items || []).map(stripListMarker).filter(Boolean).map((item) => escapeHtml(item));
  const supporting = escapeHtml(page.supporting_text || "");
  if (page.layout_type === "process_flow") return `<div class="flow">${items.map((item, index) => `<div><i>${index + 1}</i><span>${item}</span></div>`).join("")}</div>`;
  if (page.layout_type === "permission_matrix") return `<div class="matrix">${items.map((item, index) => `<div><i>${["公开", "脱敏", "禁用", "确认"][index] || index + 1}</i><span>${item}</span></div>`).join("")}</div>`;
  if (["pain_list", "gate_mechanism"].includes(page.layout_type)) return `<div class="cards">${items.map((item, index) => `<div><i>0${index + 1}</i><span>${item}</span></div>`).join("")}</div>`;
  if (page.layout_type === "value_summary") return items.length ? `<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>` : supporting ? `<p>${supporting}</p>` : "";
  if (page.layout_type === "concept_definition") {
    const definition = items.length ? items.shift() : supporting;
    return `<div class="definition">${definition || ""}</div>${items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}`;
  }
  if (page.layout_type === "action_cta") return `<div class="cta">${items.length ? items.map((item) => `<div>${item}</div>`).join("") : supporting}</div>`;
  return items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : supporting ? `<p>${supporting}</p>` : "";
}

function xhsPageHtml(task, page, asset, pageCount, qualityPreset = null) {
  const style = task.accountStyleSnapshot || {};
  const dark = ["cover_hero", "gate_mechanism", "action_cta"].includes(page.layout_type);
  const background = asset?.relativePath ? pathToFileURL(join(task.rootPath, asset.relativePath)).href : null;
  const textColor = qualityPreset?.textColor || (dark ? "#fff" : "#18352d");
  const cardColor = qualityPreset?.cardColor || "transparent";
  const overlayColor = qualityPreset?.overlayColor || (background ? "rgba(10,22,18,.58)" : "transparent");
  const headline = escapeHtml(page.headline || (page.page_number === 1 ? task.currentContent?.post_copy?.recommended_title || task.ideaTitle : ""));
  const bodyMarkup = xhsBodyMarkup(page);
  const roleLabels = { cover: "封面", pain_list: "痛点清单", concept_definition: "概念定义", process_flow: "流程链路", permission_matrix: "权限矩阵", gate_mechanism: "门禁机制", value_summary: "价值总结", action_cta: "行动引导" };
  const role = escapeHtml(roleLabels[page.page_role] || page.page_role || "内容页");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,height=1440"><style>
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1440px;overflow:hidden;font-family:"Microsoft YaHei","PingFang SC",sans-serif}body{position:relative;background:${dark ? "#18352d" : "#f4f1e9"};color:${textColor}}
.bg{position:absolute;inset:0;background:${background ? `linear-gradient(${overlayColor},${overlayColor}),url('${background}') center/cover` : dark ? "radial-gradient(circle at 85% 15%,#6b9a83 0,transparent 34%),linear-gradient(145deg,#18352d,#294f42)" : "radial-gradient(circle at 90% 10%,#f2b09d 0,transparent 28%),linear-gradient(145deg,#fff,#ece7dc)"}}
.grid{position:absolute;inset:72px;border:2px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(24,53,45,.15)"};border-radius:32px}.role{position:absolute;top:108px;left:112px;padding:14px 26px;border-radius:99px;background:${cardColor};color:${textColor};font-size:24px;letter-spacing:2px}.copy{position:absolute;left:112px;right:112px;top:245px;bottom:150px;background:${cardColor};border-radius:24px}.copy h1{margin:0;max-width:870px;font-size:${qualityPreset?.density === "compact" ? 58 : headline.length > 28 ? 58 : 68}px;line-height:1.18;letter-spacing:-2px;text-wrap:balance}.content{margin-top:54px;font-size:${qualityPreset?.density === "compact" ? 28 : 31}px;line-height:1.48}.content p{margin:24px 0}.content ul,.content ol{margin:22px 0;padding-left:46px}.content li{margin:18px 0}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.cards div{min-height:360px;padding:30px 24px;border-radius:26px;background:${cardColor};box-shadow:0 12px 32px rgba(17,45,36,.1)}.cards i{display:block;color:${textColor};font-size:26px;font-style:normal;margin-bottom:34px}.cards span{font-size:29px}.flow{display:flex;align-items:stretch;gap:12px}.flow div{flex:1;padding:28px 16px;background:${cardColor};border-radius:22px;text-align:center}.flow i{display:block;margin:auto auto 24px;width:48px;height:48px;line-height:48px;border-radius:50%;background:${cardColor};color:${textColor};font-style:normal}.matrix{display:grid;gap:14px}.matrix div{display:grid;grid-template-columns:150px 1fr;align-items:center;min-height:92px;padding:16px 24px;background:${cardColor};border-radius:18px}.matrix i{font-style:normal;font-weight:700;color:${textColor}}.definition{padding:38px;border-left:10px solid #e9674e;background:${cardColor};border-radius:20px;font-size:38px;font-weight:700}.cta{margin-top:90px;padding:42px 36px;border-radius:28px;background:${cardColor};font-size:34px;font-weight:700;text-align:left}.cta div{padding:14px 0;border-bottom:1px solid currentColor}.cta div:last-child{border-bottom:0}.footer{position:absolute;right:112px;bottom:82px;left:112px;display:flex;justify-content:space-between;padding:6px 10px;border-radius:8px;background:${cardColor};color:${textColor};font-size:24px}.accent{position:absolute;top:215px;left:112px;width:120px;height:10px;border-radius:8px;background:#e9674e}
</style></head><body data-layout="${escapeHtml(page.layout_type)}"><div class="bg"></div><div class="grid"></div><div class="role">${role}</div><div class="accent"></div><main class="copy"><h1 data-quality-role="title">${headline}</h1><section class="content" data-quality-role="body">${bodyMarkup}</section></main><footer class="footer" data-quality-role="footer"><span>${escapeHtml(style.name || "FlowSocial 内容工作台")}</span><span>${page.page_number || 1} / ${pageCount}</span></footer></body></html>`;
}

export async function renderHtmlToPngWithMeasurements(htmlPath, pngPath, { safeArea, subjectBounds } = {}) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.fonts?.ready);
    const domMeasurements = await page.evaluate(({ safeArea, subjectBounds }) => {
      const roundedRect = (value) => ({ x: Number(value.x.toFixed(3)), y: Number(value.y.toFixed(3)), width: Number(value.width.toFixed(3)), height: Number(value.height.toFixed(3)) });
      const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
      const intersects = (a, b) => Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
      const opaqueBackground = (node) => {
        let current = node;
        while (current) {
          const color = getComputedStyle(current).backgroundColor;
          const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
          if (match && Number(match[4] ?? 1) > 0.99) return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
          current = current.parentElement;
        }
        return null;
      };
      const foreground = (node) => {
        const match = getComputedStyle(node).color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return match ? `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}` : null;
      };
      const union = (rects) => {
        const left = Math.min(...rects.map((item) => item.left)); const top = Math.min(...rects.map((item) => item.top));
        const right = Math.max(...rects.map((item) => item.right)); const bottom = Math.max(...rects.map((item) => item.bottom));
        return { x: left, y: top, width: right - left, height: bottom - top };
      };
      const measure = (role, selector, containerSelector) => {
        const nodes = [...document.querySelectorAll(selector)];
        if (!nodes.length) return null;
        const bounds = roundedRect(union(nodes.map((node) => node.getBoundingClientRect())));
        const container = document.querySelector(containerSelector);
        const containerBounds = container ? roundedRect(container.getBoundingClientRect()) : { x: 0, y: 0, width: 1080, height: 1440 };
        const descendantOutside = nodes.some((node) => [...node.children].some((child) => !contains(roundedRect(node.getBoundingClientRect()), roundedRect(child.getBoundingClientRect()))));
        const clippedScroll = nodes.some((node) => {
          const style = getComputedStyle(node);
          const clippedX = style.overflowX !== "visible" && node.scrollWidth > node.clientWidth + 1;
          const clippedY = style.overflowY !== "visible" && node.scrollHeight > node.clientHeight + 1;
          return clippedX || clippedY;
        });
        const overflow = clippedScroll || !contains(containerBounds, bounds) || (role === "footer" && descendantOutside);
        return { role, text: nodes.map((node) => node.textContent || "").join(" "), bounds, scrollWidth: Math.max(...nodes.map((node) => node.scrollWidth)), clientWidth: Math.max(...nodes.map((node) => node.clientWidth)), scrollHeight: Math.max(...nodes.map((node) => node.scrollHeight)), clientHeight: Math.max(...nodes.map((node) => node.clientHeight)), foreground: foreground(nodes[0]), background: opaqueBackground(nodes[0]), overflow, insideSafeArea: contains(safeArea, bounds), intersectsSubject: intersects(subjectBounds, bounds) };
      };
      const root = document.documentElement;
      const canvasRect = roundedRect(root.getBoundingClientRect());
      return {
        canvas: { ...canvasRect, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight },
        safeArea, subjectBounds: subjectBounds || null,
        layers: [measure("title", '[data-quality-role="title"]', ".copy"), measure("body", '[data-quality-role="body"]', ".copy"), measure("number_card", '.cards i,.flow i,.matrix i,[data-quality-role="number_card"]', ".copy"), measure("footer", '[data-quality-role="footer"]', "body")].filter(Boolean)
      };
    }, { safeArea, subjectBounds });
    await page.screenshot({ path: pngPath, type: "png", fullPage: false, animations: "disabled" });
    const buffer = await readFile(pngPath);
    if (buffer.readUInt32BE(16) !== 1080 || buffer.readUInt32BE(20) !== 1440) throw new Error(`PNG 尺寸错误：${buffer.readUInt32BE(16)}×${buffer.readUInt32BE(20)}`);
    return { bytes: buffer.length, sha256: sha256(buffer), width: 1080, height: 1440, domMeasurements };
  } finally {
    await browser.close();
  }
}

function markdownToSections(markdown = "") {
  const lines = String(markdown).replace(/\r/g, "").split("\n");
  const blocks = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) { blocks.push(`<p>${escapeHtml(paragraph.join(" "))}</p>`); paragraph = []; } };
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) { flush(); const level = Math.min(3, line.match(/^#+/)[0].length); blocks.push(`<h${level}>${escapeHtml(line.replace(/^#{1,3}\s*/, ""))}</h${level}>`); }
    else if (/^[-*]\s+/.test(line)) { flush(); blocks.push(`<p>• ${escapeHtml(line.replace(/^[-*]\s+/, ""))}</p>`); }
    else if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return blocks.join("\n");
}

function wechatPasteHtml(task) {
  const article = task.currentContent || {};
  const body = markdownToSections(article.article_markdown);
  return `<section style="max-width:677px;margin:0 auto;color:#252a26;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;font-size:16px;line-height:1.85;word-break:break-word"><h1 style="margin:0 0 24px;font-size:28px;line-height:1.35;color:#18352d">${escapeHtml(article.recommended_title || task.ideaTitle)}</h1><p style="margin:0 0 28px;padding:16px 18px;background:#f3f6f4;color:#53625a;border-left:4px solid #5b8f77">${escapeHtml(article.abstract || article.article_promise || "")}</p>${body}<p style="margin-top:36px;padding-top:20px;border-top:1px solid #dfe5e1;color:#5b6b62">${escapeHtml(article.cta || "")}</p></section>`;
}

function validateWechatHtml(html, task) {
  const checks = [
    { check: "no_script_or_style_tag", result: !/<(?:script|style)\b/i.test(html) ? "pass" : "fail" },
    { check: "no_class_or_id", result: !/\s(?:class|id)=/i.test(html) ? "pass" : "fail" },
    { check: "no_external_dependency", result: !/(?:src|href)=["']https?:/i.test(html) ? "pass" : "fail" },
    { check: "title_matches_package", result: html.includes(escapeHtml(task.currentContent?.recommended_title || task.ideaTitle)) ? "pass" : "fail" },
    { check: "article_length", result: String(task.currentContent?.article_markdown || "").length >= 1200 ? "pass" : "fail" }
  ];
  return { status: checks.every((item) => item.result === "pass") ? "passed" : "needs_review", checks, blockers: checks.filter((item) => item.result === "fail").map((item) => item.check) };
}

async function fileManifest(rootPath) {
  const rows = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (!entry.name.endsWith(".zip")) {
        const buffer = await readFile(path);
        rows.push({ path: relative(rootPath, path).replace(/\\/g, "/"), bytes: buffer.length, sha256: sha256(buffer) });
      }
    }
  }
  await walk(rootPath);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

export async function renderContentDelivery(task, deps) {
  if (task.platform === "xiaohongshu") requireConfirmedXhsStoryboard(task);
  if (task.platform === "xiaohongshu" && task.visualDirectionSet) requireVisualCandidatesReady(task);
  const versionRoot = join(deps.root, "artifacts", task.id, `v${task.version}`);
  const sourceDir = join(versionRoot, "html");
  const outputDir = join(versionRoot, "output");
  const currentAssetDir = join(versionRoot, "assets");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(currentAssetDir, { recursive: true });
  const candidateAssets = task.visualDirectionSet ? getVisualCandidates(task) : [];
  for (const asset of [...(task.generatedAssets || []), ...candidateAssets].filter((item) => item.version === task.version && (item.providerStatus || item.status) === "succeeded" && item.relativePath)) {
    const sourcePath = join(deps.root, asset.relativePath);
    if (!sourcePath.startsWith(versionRoot)) {
      const targetPath = join(currentAssetDir, `${safeName(asset.assetId)}${extname(sourcePath) || ".jpg"}`);
      await copyFile(sourcePath, targetPath);
      const buffer = await readFile(targetPath);
      asset.relativePath = relative(deps.root, targetPath).replace(/\\/g, "/");
      asset.bytes = buffer.length;
      asset.sha256 = sha256(buffer);
    }
  }
  task.rootPath = deps.root;
  const rendered = [];
  let platformValidation;
  if (task.platform === "xiaohongshu") {
    const pages = storyboardRenderPages(task);
    const deterministicQualityFlag = featureFlags().xhsDeterministicVisualQualityGate;
    for (const [index, page] of pages.entries()) {
      const pageId = page.page_id || `P${index + 1}`;
      const asset = page.render_strategy === "generated_raster"
        ? (task.visualDirectionSet ? getVisualCandidates(task).find((item) => item.pageId === pageId && item.selected && item.providerStatus === "succeeded" && item.qualityStatus === "approved") : (task.generatedAssets || []).find((item) => item.version === task.version && item.pageId === pageId && item.status === "succeeded"))
        : null;
      const htmlPath = join(sourceDir, `${String(index + 1).padStart(2, "0")}_${safeName(pageId)}.html`);
      const pngPath = join(outputDir, `${String(index + 1).padStart(2, "0")}_${safeName(pageId)}.png`);
      const backgroundSource = page.render_strategy === "generated_raster" ? "selected_ai_candidate" : task.visualDirectionSet?.pages?.find((item) => item.pageId === pageId)?.fallback ? "explicit_deterministic_fallback" : "deterministic_layout";
      const darkLayout = ["cover_hero", "gate_mechanism", "action_cta"].includes(page.layout_type);
      const backgroundRegions = [{ x: 0, y: 0, width: 1080, height: 1440, color: darkLayout ? "#18352d" : "#f4f1e9" }];
      let backgroundAsset = null;
      if (asset?.relativePath) {
        const assetBuffer = await readFile(join(deps.root, asset.relativePath));
        backgroundAsset = { assetId: asset.assetId || asset.candidateId || pageId, path: asset.relativePath, sha256: sha256(assetBuffer), declaredSha256: asset.sha256 || null };
      }
      const subjectBounds = backgroundAsset && asset?.qualityEvidenceAssetSha256 === backgroundAsset.sha256 ? asset.qualitySubjectBounds || null : null;
      const safeArea = page.quality_safe_area || { x: 72, y: 72, width: 936, height: 1296 };
      const qualityInput = { page, contentTaskId: task.id, contentVersion: task.version, pageId, canvas: { width: 1080, height: 1440 }, safeArea, backgroundRegions, subjectBounds, cropDetected: page.quality_crop_detected === true, renderSource: backgroundSource, featureFlagEnabled: deterministicQualityFlag, allowedPresetIndexes: [2, 3, 6, 7], backgroundAsset };
      const qualityPreflight = selectDeterministicPreset(qualityInput);
      await writeFile(htmlPath, xhsPageHtml(task, { ...page, page_number: index + 1 }, asset, pages.length, qualityPreflight.preset), "utf8");
      try {
        const image = await renderHtmlToPngWithMeasurements(htmlPath, pngPath, { safeArea, subjectBounds });
        const outputPng = { path: relative(deps.root, pngPath).replace(/\\/g, "/"), bytes: image.bytes, sha256: image.sha256 };
        const qualityReport = evaluateDeterministicPageQuality({ ...qualityInput, canvas: { width: image.width, height: image.height }, domMeasurements: image.domMeasurements, outputPng });
        rendered.push({ pageId, status: "succeeded", htmlPath: relative(deps.root, htmlPath).replace(/\\/g, "/"), pngPath: relative(deps.root, pngPath).replace(/\\/g, "/"), backgroundAssetId: asset?.assetId || null, backgroundCandidateId: asset?.candidateId || null, backgroundSource, layoutType: page.layout_type, renderInput: { contentObjective: page.content_objective, headline: page.headline, bodyItems: page.body_items, supportingText: page.supporting_text, visualDescription: page.visual_description, renderStrategy: page.render_strategy }, qualityReport, ...image });
      } catch (error) {
        rendered.push({ pageId, status: "failed", htmlPath: relative(deps.root, htmlPath).replace(/\\/g, "/"), pngPath: null, error: error.message });
      }
    }
    const storyboardValidation = validateXhsVisualStoryboard(task.visualStoryboard, { requireConfirmation: true });
    const directionValidation = task.visualDirectionSet ? validateVisualDirectionSet(task.visualDirectionSet, { requireConfirmation: true }) : { checks: [] };
    const rasterPages = pages.filter((page) => page.render_strategy === "generated_raster");
    const rasterSpecs = collectImageSpecs(task);
    const expectedPerPage = task.visualDirectionSet ? Number(task.visualDirectionSet.candidateCount || 1) : 1;
    const rasterSpecsMapped = rasterPages.length * expectedPerPage === rasterSpecs.length && rasterPages.every((page) => rasterSpecs.filter((spec) => spec.pageId === page.page_id && spec.prompt).length === expectedPerPage);
    const candidateSummary = task.visualDirectionSet ? visualCandidateSummary(task) : null;
    const deterministicReports = rendered.map((item) => item.qualityReport).filter(Boolean);
    task.deterministicPageQualityReports = deterministicReports;
    const deterministicQualityBlocked = deterministicReports.length !== pages.length || deterministicReports.some((report) => report.blockers.length || report.deliveryEligibility === "blocked");
    const pageFactGateEnabled = featureFlags().xhsDeterministicVisualQualityGate;
    const pageFactGate = pageFactGateEnabled ? evaluateXhsPageFactClaims({ deck: { pages } }, task.contentMaster) : { status: "disabled", failures: [] };
    const postRenderConfirmed = task.visualQualityConfirmation?.version === task.version && task.visualQualityConfirmation?.decision === "approved" && task.visualQualityConfirmation?.pixelAndSemanticReviewed === true;
    const expectedTextsPresent = rendered.every((item) => {
      const input = item.renderInput || {};
      return Boolean(input.headline && (item.pageId === pages[0]?.page_id || input.bodyItems?.length || input.supportingText));
    });
    const checks = [
      ...storyboardValidation.checks,
      ...directionValidation.checks,
      { check: "page_count_6_to_10", result: pages.length >= 6 && pages.length <= 10 ? "pass" : "fail" },
      { check: "all_png_1080x1440", result: rendered.length === pages.length && rendered.every((item) => item.status === "succeeded" && item.width === 1080 && item.height === 1440) ? "pass" : "fail" },
      { check: "deterministic_page_quality", result: deterministicQualityBlocked ? "fail" : "pass", detail: deterministicReports.map((report) => ({ pageId: report.pageId, canvasStatus: report.canvasStatus, contrastStatus: report.contrastStatus, overflowStatus: report.overflowStatus, safeAreaStatus: report.safeAreaStatus, subjectOcclusionStatus: report.subjectOcclusionStatus, capacityStatus: report.capacityStatus, deliveryEligibility: report.deliveryEligibility, blockers: report.blockers })) },
      { check: "page_claims_semantically_traceable", result: pageFactGate.status === "blocked" ? "fail" : "pass", detail: { enabled: pageFactGateEnabled, status: pageFactGate.status, failures: pageFactGate.failures } },
      { check: "expected_page_text_mapped", result: expectedTextsPresent ? "pass" : "fail" },
      { check: "generated_raster_image_spec_one_to_one", result: rasterSpecsMapped ? "pass" : "fail", detail: { rasterPages: rasterPages.map((page) => page.page_id), imageSpecPages: rasterSpecs.map((spec) => spec.pageId) } },
      { check: "approved_candidate_or_explicit_fallback", result: !candidateSummary || candidateSummary.ready ? "pass" : "fail", detail: candidateSummary },
      { check: "post_render_pixel_semantics", result: postRenderConfirmed ? "pass" : "pending_human_confirmation", detail: postRenderConfirmed ? task.visualQualityConfirmation : "当前自动检查不能读取真实像素裁切与图片语义，必须人工确认" },
      { check: "failed_generated_assets_declared", result: (task.visualDirectionSet ? getVisualCandidates(task) : (task.generatedAssets || []).filter((item) => item.version === task.version)).filter((item) => (item.providerStatus || item.status) === "failed").every((item) => Boolean(item.error)) ? "pass" : "fail" }
    ];
    platformValidation = { status: checks.some((item) => item.result === "fail") ? "needs_review" : postRenderConfirmed ? "passed" : "waiting_human_confirmation", checks, blockers: checks.filter((item) => item.result === "fail").map((item) => item.check), pending: checks.filter((item) => item.result === "pending_human_confirmation").map((item) => item.check), deterministicQualityFlag };
    await writeFile(join(versionRoot, "post-copy.json"), JSON.stringify(task.currentContent?.post_copy || {}, null, 2), "utf8");
    await writeFile(join(versionRoot, "deck-spec.json"), JSON.stringify(task.currentContent?.deck || {}, null, 2), "utf8");
  } else {
    const markdownPath = join(versionRoot, "article.md");
    const pastePath = join(versionRoot, "wechat-paste.html");
    const previewPath = join(versionRoot, "wechat-preview.html");
    const illustrated = wechatIllustratedDeliveryEnabled();
    let paste;
    let preview;
    let wechatAssets = [];
    let uploadPlan = null;
    let planValidation = null;
    if (illustrated) {
      await rm(join(versionRoot, "manifest.json"), { force: true });
      await rm(join(versionRoot, `FlowSocial_${safeName(task.platform)}_${safeName(task.id)}_v${task.version}.zip`), { force: true });
      const materialized = await materializeWechatAssets(task, { root: deps.root, versionRoot });
      wechatAssets = materialized.records;
      planValidation = materialized.validation;
      paste = buildWechatIllustratedHtml(task, wechatAssets);
      uploadPlan = buildWechatUploadAdapter(task, wechatAssets);
      preview = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(task.currentContent?.recommended_title || task.ideaTitle)}</title><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{padding:24px 12px;background:#eef1ee}body>section{background:#fff;padding:28px 18px;box-shadow:0 10px 40px rgba(0,0,0,.08)}figure,img{max-width:100%}@media(max-width:430px){body{padding:0;background:#fff}body>section{padding:22px 16px;box-shadow:none}h1{font-size:25px!important}h2{font-size:20px!important}}</style></head><body>${paste}</body></html>`;
      await writeFile(join(versionRoot, "wechat-image-plan.json"), JSON.stringify(task.currentContent.image_plan, null, 2), "utf8");
      await writeFile(join(versionRoot, "wechat-draft-upload-plan.json"), JSON.stringify(uploadPlan, null, 2), "utf8");
    } else {
      paste = wechatPasteHtml(task);
      preview = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(task.currentContent?.recommended_title || task.ideaTitle)}</title><style>body{margin:0;padding:32px 16px;background:#f1f3f1}section{background:#fff;padding:36px 28px;box-shadow:0 10px 40px rgba(0,0,0,.08)}h2{margin-top:40px;color:#18352d}p{margin:16px 0}</style></head><body>${paste}</body></html>`;
    }
    await writeFile(markdownPath, task.currentContent?.article_markdown || "", "utf8");
    await writeFile(pastePath, paste, "utf8");
    await writeFile(previewPath, preview, "utf8");
    platformValidation = illustrated
      ? await validateWechatIllustratedOutput({ html: paste, task, assetRecords: wechatAssets, versionRoot, previewPath })
      : validateWechatHtml(paste, task);
    if (illustrated) {
      task.wechatIllustratedAssets = wechatAssets;
      task.wechatImagePlanValidation = planValidation;
      task.wechatDraftUploadPlan = uploadPlan;
      const evaluatedQuality = evaluateWechatIllustratedQualityGates(wechatAssets);
      const qualityReport = {
        schemaVersion: "1.0",
        kind: "WechatIllustratedDeliveryQualityReport",
        contentTaskId: task.id,
        contentVersion: task.version,
        imagePlanStatus: planValidation.status,
        imagePlanChecks: planValidation.checks,
        htmlAndMobileStatus: platformValidation.status,
        htmlAndMobileChecks: platformValidation.checks,
        assets: wechatAssets,
        gates: { ...evaluatedQuality.gates, upload: "not_executed_offline_adapter_only" },
        deliveryGateStatus: evaluatedQuality.status,
        deliveryGateBlockers: evaluatedQuality.blockers,
        autoPublished: false,
        productionWrites: 0
      };
      task.wechatIllustratedQualityReport = qualityReport;
      const hardGateChecks = ["ocr", "fact", "license", "visual", "mobile"].map((gate) => ({ check: `wechat_${gate}_gate`, result: qualityReport.gates[gate] === "passed" ? "pass" : "fail", detail: qualityReport.gates[gate] }));
      platformValidation = {
        ...platformValidation,
        status: [...platformValidation.checks, ...hardGateChecks].every((item) => item.result === "pass") ? "passed" : "needs_review",
        checks: [...platformValidation.checks, ...hardGateChecks],
        blockers: [...new Set([...(platformValidation.blockers || []), ...hardGateChecks.filter((item) => item.result === "fail").map((item) => item.check)])]
      };
      qualityReport.htmlAndMobileStatus = platformValidation.status;
      qualityReport.htmlAndMobileChecks = platformValidation.checks;
      await writeFile(join(versionRoot, "wechat-quality-report.json"), JSON.stringify(qualityReport, null, 2), "utf8");
    }
    rendered.push({ status: "succeeded", markdownPath: relative(deps.root, markdownPath).replace(/\\/g, "/"), pasteHtmlPath: relative(deps.root, pastePath).replace(/\\/g, "/"), previewHtmlPath: relative(deps.root, previewPath).replace(/\\/g, "/"), imageAssets: wechatAssets, imagePlanValidation: planValidation, draftUploadPlan: uploadPlan });
  }
  const expectedImageSpecs = collectImageSpecs(task);
  const versionAssets = task.visualDirectionSet ? getVisualCandidates(task) : (task.generatedAssets || []).filter((item) => item.version === task.version);
  const completedAssetIds = new Set(versionAssets.map((item) => item.assetId));
  const pendingAssetIds = expectedImageSpecs.map((item) => item.assetId).filter((assetId) => !completedAssetIds.has(assetId));
  const failedAssets = versionAssets.filter((item) => (item.providerStatus || item.status) === "failed");
  const degradationNotes = [];
  if (pendingAssetIds.length) degradationNotes.push(`${pendingAssetIds.length} 个生成式图片槽位尚未执行，渲染器已使用品牌化无图背景。`);
  if (failedAssets.length) degradationNotes.push(`${failedAssets.length} 个生成图片失败，错误详情见 assets。`);
  const degradation = degradationNotes.join(" ") || null;
  const auditAssets = task.platform === "wechat" && task.wechatIllustratedAssets?.length ? task.wechatIllustratedAssets : versionAssets;
  const auditAssetCoverage = task.platform === "wechat" && task.wechatIllustratedAssets?.length
    ? { expected: task.wechatIllustratedAssets.length, completed: task.wechatIllustratedAssets.length, pendingAssetIds: [], failed: 0 }
    : { expected: expectedImageSpecs.length, completed: completedAssetIds.size, pendingAssetIds, failed: failedAssets.length };
  const audit = {
    contentTaskId: task.id, version: task.version, platform: task.platform, generatedAt: new Date().toISOString(),
    source: { topicId: task.topicId, topicSelectionId: task.topicSelectionId, intentProfileId: task.contentIntentProfile?.profile_id, contentMasterId: task.contentMaster?.content_master_id, knowledgeSnapshotId: task.knowledgeSnapshotId },
    assets: auditAssets, assetCoverage: auditAssetCoverage, rendered, validation: platformValidation, deterministicPageQualityReports: task.platform === "xiaohongshu" ? task.deterministicPageQualityReports || [] : [], wechatImagePlan: task.wechatImagePlanValidation || null, wechatIllustratedQualityReport: task.wechatIllustratedQualityReport || null, wechatDraftUploadPlan: task.wechatDraftUploadPlan || null,
    degradation,
    security: { secretsIncluded: false, cookiesIncluded: false, localProviderConfigIncluded: false },
    humanConfirmationRequired: true
  };
  await writeFile(join(versionRoot, "audit.json"), JSON.stringify(audit, null, 2), "utf8");
  const filesBeforeManifest = (await fileManifest(versionRoot)).filter((item) => item.path !== "manifest.json");
  const manifest = { schema: "FlowSocialDeliveryManifest@2.0", contentTaskId: task.id, version: task.version, platform: task.platform, createdAt: new Date().toISOString(), storyboard: task.platform === "xiaohongshu" ? { id: task.visualStoryboard?.id, storyboardVersion: task.visualStoryboard?.storyboardVersion, status: task.visualStoryboard?.status, confirmation: task.visualStoryboard?.confirmation, pages: task.visualStoryboard?.pages } : null, visualDirection: task.visualDirectionSet ? { ...task.visualDirectionSet, candidateSummary: visualCandidateSummary(task), candidates: getVisualCandidates(task).map((item) => ({ candidateId: item.candidateId, pageId: item.pageId, candidateIndex: item.candidateIndex, provider: item.provider, providerMode: item.providerMode || null, billableCall: item.billableCall === true, model: item.model, quality: item.quality, prompt: item.prompt, providerStatus: item.providerStatus, qualityStatus: item.qualityStatus, rejectionReasons: item.rejectionReasons || [], path: item.relativePath, selected: item.selected, qualityReview: item.qualityReview || null, compatibilityProjection: item.compatibilityProjection || null, error: item.error || null })), referenceInputDisclosure: task.visualDirectionSet.designDnaUsage?.disclosure || null } : null, renderInputs: rendered.map((item) => ({ pageId: item.pageId, layoutType: item.layoutType, backgroundCandidateId: item.backgroundCandidateId, backgroundSource: item.backgroundSource, renderInput: item.renderInput })), deterministicPageQualityReports: task.platform === "xiaohongshu" ? task.deterministicPageQualityReports || [] : [], wechatIllustratedDelivery: task.platform === "wechat" && task.wechatIllustratedAssets?.length ? { imagePlan: task.currentContent?.image_plan, assets: task.wechatIllustratedAssets, qualityReport: task.wechatIllustratedQualityReport, draftUploadPlan: task.wechatDraftUploadPlan } : null, validation: platformValidation, postRenderVisualConfirmation: task.visualQualityConfirmation?.version === task.version ? task.visualQualityConfirmation : null, assetCoverage: audit.assetCoverage, degradation: audit.degradation, files: filesBeforeManifest, excluded: ["API keys", "cookies", "provider config", "browser cache", "Design DNA source files"], humanConfirmationRequired: task.platform === "xiaohongshu" || Boolean(task.wechatIllustratedAssets?.length) };
  const hardQualityBlocked = task.platform === "xiaohongshu"
    ? ((task.deterministicPageQualityReports || []).some((report) => report.blockers.length || report.deliveryEligibility === "blocked") || platformValidation.checks?.some((item) => item.check === "page_claims_semantically_traceable" && item.result === "fail"))
    : Boolean(task.wechatIllustratedAssets?.length) && ["ocr", "fact", "license", "visual", "mobile"].some((gate) => task.wechatIllustratedQualityReport?.gates?.[gate] !== "passed");
  if (!hardQualityBlocked) await writeFile(join(versionRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  task.delivery = { version: task.version, status: task.platform === "xiaohongshu" ? platformValidation.status === "needs_review" ? "needs_review" : "visual_review" : platformValidation.status === "passed" ? "ready" : "needs_review", rootPath: relative(deps.root, versionRoot).replace(/\\/g, "/"), manifestPath: hardQualityBlocked ? null : relative(deps.root, join(versionRoot, "manifest.json")).replace(/\\/g, "/"), validation: platformValidation, rendered, deterministicPageQualityReports: task.platform === "xiaohongshu" ? task.deterministicPageQualityReports || [] : [], renderedAt: new Date().toISOString(), zipPath: null };
  syncContentImageTasks(task);
  delete task.rootPath;
  return task.delivery;
}

let crcTable;
function crc32(buffer) {
  crcTable ||= Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() };
}

function zipEntries(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, "/"));
    const compressed = deflateRawSync(entry.data, { level: 6 });
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(entry.data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(stamp.time, 12); central.writeUInt16LE(stamp.date, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(entry.data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralBuffer, end]);
}

export function verifyDeliveryZipContents(zipBuffer, manifest) {
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= zipBuffer.length && zipBuffer.readUInt32LE(offset) === 0x04034b50) {
    const method = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 22);
    const nameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraLength = zipBuffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBuffer.length) throw Object.assign(new Error("ZIP 本地成员越界"), { code: "DELIVERY_ZIP_MEMBER_INVALID" });
    const name = zipBuffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    if (!name || entries.has(name) || name.includes("..") || name.startsWith("/") || /^[a-z]:/i.test(name)) throw Object.assign(new Error(`ZIP 成员名无效：${name}`), { code: "DELIVERY_ZIP_MEMBER_INVALID" });
    const compressed = zipBuffer.subarray(dataStart, dataEnd);
    const data = method === 8 ? inflateRawSync(compressed) : method === 0 ? compressed : null;
    if (!data || data.length !== uncompressedSize) throw Object.assign(new Error(`ZIP 成员解压失败：${name}`), { code: "DELIVERY_ZIP_MEMBER_INVALID" });
    entries.set(name, data);
    offset = dataEnd;
  }
  const manifestEntry = entries.get("manifest.json");
  if (!manifestEntry) throw Object.assign(new Error("ZIP 缺少 manifest.json"), { code: "DELIVERY_ZIP_MANIFEST_MISSING" });
  const embeddedManifest = JSON.parse(manifestEntry.toString("utf8"));
  if (JSON.stringify(embeddedManifest) !== JSON.stringify(manifest)) throw Object.assign(new Error("ZIP Manifest 与交付 Manifest 不一致"), { code: "DELIVERY_ZIP_MANIFEST_MISMATCH" });
  const expected = new Map((manifest.files || []).map((item) => [item.path, item]));
  for (const [path, item] of expected) {
    const data = entries.get(path);
    if (!data || data.length !== item.bytes || sha256(data) !== item.sha256) throw Object.assign(new Error(`ZIP 成员与 Manifest 不一致：${path}`), { code: "DELIVERY_ZIP_MEMBER_SHA_MISMATCH", details: { path } });
  }
  const unexpected = [...entries.keys()].filter((name) => name !== "manifest.json" && !expected.has(name));
  const missing = [...expected.keys()].filter((name) => !entries.has(name));
  if (unexpected.length || missing.length || entries.size !== expected.size + 1) throw Object.assign(new Error("ZIP 成员清单与 Manifest 不一致"), { code: "DELIVERY_ZIP_MEMBER_LIST_MISMATCH", details: { unexpected, missing } });
  return { status: "passed", memberCount: entries.size, manifestTrackedMembers: expected.size, members: [...entries.keys()].sort() };
}

export async function createDeliveryZip(task, deps) {
  if (task.platform === "xiaohongshu") {
    requireConfirmedXhsStoryboard(task);
    const reports = task.delivery?.deterministicPageQualityReports || task.deterministicPageQualityReports || [];
    if (!reports.length) throw Object.assign(new Error("当前版本缺少确定性页面质量报告"), { statusCode: 409, code: "XHS_DETERMINISTIC_QUALITY_REQUIRED" });
    for (const report of reports) await verifyDeterministicPageQualityArtifacts(report, { root: deps.root });
    if (task.visualQualityConfirmation?.version !== task.version || task.visualQualityConfirmation?.decision !== "approved") {
      const error = new Error("渲染后视觉质量等待人工确认，暂不能生成最终交付包");
      error.statusCode = 409;
      error.code = "XHS_POST_RENDER_CONFIRMATION_REQUIRED";
      throw error;
    }
  }
  if (!task.delivery || task.delivery.version !== task.version) await renderContentDelivery(task, deps);
  if (task.delivery.validation?.status === "needs_review") {
    const error = new Error(`交付质量门禁未通过：${(task.delivery.validation.blockers || []).join("、")}`);
    error.statusCode = 409;
    error.code = task.platform === "xiaohongshu" ? "XHS_DELIVERY_QUALITY_GATE_BLOCKED" : "DELIVERY_QUALITY_GATE_BLOCKED";
    error.details = task.delivery.validation.checks?.filter((item) => item.result === "fail") || [];
    throw error;
  }
  const versionRoot = join(deps.root, task.delivery.rootPath);
  const files = await fileManifest(versionRoot);
  const entries = await Promise.all(files.map(async (item) => ({ name: item.path, data: await readFile(join(versionRoot, item.path)) })));
  const zip = zipEntries(entries);
  const deliveryManifest = JSON.parse(await readFile(join(versionRoot, "manifest.json"), "utf8"));
  const zipVerification = verifyDeliveryZipContents(zip, deliveryManifest);
  const zipPath = join(versionRoot, `FlowSocial_${safeName(task.platform)}_${safeName(task.id)}_v${task.version}.zip`);
  await writeFile(zipPath, zip);
  const zipInfo = await stat(zipPath);
  if (!zipInfo.isFile() || zipInfo.size !== zip.length || zip.length === 0) throw new Error("交付包写入校验失败，请重试");
  task.delivery.zipPath = relative(deps.root, zipPath).replace(/\\/g, "/");
  task.delivery.zipBytes = zip.length;
  task.delivery.zipSha256 = sha256(zip);
  task.delivery.zipVersion = task.version;
  task.delivery.zipCreatedAt = new Date().toISOString();
  return { path: zipPath, fileName: basename(zipPath), bytes: zip.length, sha256: task.delivery.zipSha256, version: task.version, verification: zipVerification };
}
