import sharp from "sharp";
import { PDFParse } from "pdf-parse";

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const PDF_PAGES_PER_SHEET = 8;
const MAX_PDF_PROVIDER_CALLS = 6;
const MAX_PDF_PAGES = PDF_PAGES_PER_SHEET * MAX_PDF_PROVIDER_CALLS;

function visionError(code, message, statusCode = 400, details = null) {
  return Object.assign(new Error(message), { code, statusCode, details });
}

function normalizeMimeType(mimeType = "", name = "") {
  const value = String(mimeType).toLowerCase();
  if (SUPPORTED_MIME_TYPES.has(value)) return value;
  const extension = String(name).toLowerCase().split(".").pop();
  if (["jpg", "jpeg"].includes(extension)) return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "";
}

function scalarText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const name = String(value.name || value.label || value.title || "").trim();
  const detail = String(value.value || value.description || value.rule || value.text || value.content || "").trim();
  return name && detail && name !== detail ? `${name}：${detail}` : detail || name;
}

function cleanList(value, limit = 8) {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(items.map(scalarText).filter(Boolean))].slice(0, limit);
}

function cleanColors(value, limit = 10) {
  const source = cleanList(value, 20);
  const hex = source.flatMap((item) => item.match(/#[0-9a-f]{6}\b/gi) || []).map((item) => item.toUpperCase());
  return [...new Set(hex.length ? hex : source)].slice(0, limit);
}

export function prioritizeEvidenceColors(analysis = {}, ...evidenceSources) {
  const evidenceText = evidenceSources.flat(Infinity).map(scalarText).filter(Boolean).join(" ");
  const explicit = [...evidenceText.matchAll(/(?:#|\b)([0-9a-f]{6})\b/gi)].map((match) => `#${match[1].toUpperCase()}`);
  return { ...analysis, colors: [...new Set([...explicit, ...cleanColors(analysis.colors)])].slice(0, 10) };
}

function extractJson(text = "") {
  const source = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(source); } catch {}
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(source.slice(start, end + 1)); } catch {}
  }
  throw visionError("MINIMAX_VISION_RESPONSE_INVALID", "MiniMax 视觉分析没有返回可解析的结构化结果", 502);
}

function normalizeAnalysis(value = {}) {
  const mediaDescription = cleanList(value.photographyOrIllustrationDirection, 8).join(" ").toLowerCase();
  const mediaDirection = ["editorial_photography", "isometric_illustration"].includes(value.photographyOrIllustrationDirection)
    ? value.photographyOrIllustrationDirection
    : /illustration|graphic|vector|插画|图形|no photography|无摄影/.test(mediaDescription) ? "isometric_illustration" : "editorial_photography";
  const confidenceNumber = Number(value.confidence);
  const confidence = ["high", "medium", "low"].includes(value.confidence)
    ? value.confidence
    : Number.isFinite(confidenceNumber) ? confidenceNumber >= 0.8 ? "high" : confidenceNumber >= 0.5 ? "medium" : "low" : "medium";
  return {
    colors: cleanColors(value.colors),
    fontPreferences: cleanList(value.fontPreferences),
    layoutPreferences: cleanList(value.layoutPreferences),
    materials: cleanList(value.materials),
    photographyOrIllustrationDirection: mediaDirection,
    forbiddenMotifs: cleanList(value.forbiddenMotifs),
    referenceNotes: cleanList(value.referenceNotes, 12).join("；").slice(0, 1600),
    evidence: cleanList(value.evidence, 12),
    confidence
  };
}

function hasUsefulVisualSignals(analysis = {}) {
  return [analysis.colors, analysis.fontPreferences, analysis.layoutPreferences, analysis.materials, analysis.forbiddenMotifs]
    .some((items) => Array.isArray(items) && items.some((item) => String(item || "").trim()));
}

function samplePageNumbers(total, limit = MAX_PDF_PAGES) {
  if (total <= limit) return Array.from({ length: total }, (_, index) => index + 1);
  const selected = new Set([1, total]);
  for (let index = 0; selected.size < limit; index += 1) {
    selected.add(Math.max(1, Math.min(total, Math.round(1 + (index * (total - 1)) / (limit - 1)))));
  }
  return [...selected].sort((left, right) => left - right).slice(0, limit);
}

async function createPdfContactSheet(pages) {
  const columns = 4;
  const gap = 18;
  const cellWidth = 480;
  const cellHeight = Math.max(...pages.map((page) => Math.round(page.height * (cellWidth / page.width))));
  const rows = Math.ceil(pages.length / columns);
  const composites = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const resized = await sharp(Buffer.from(page.data)).resize({ width: cellWidth, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    composites.push({ input: resized, left: (index % columns) * (cellWidth + gap), top: Math.floor(index / columns) * (cellHeight + gap) });
  }
  return sharp({
    create: {
      width: columns * cellWidth + (columns - 1) * gap,
      height: rows * cellHeight + Math.max(0, rows - 1) * gap,
      channels: 3,
      background: "#F4F1EA"
    }
  }).composite(composites).png({ compressionLevel: 8 }).toBuffer();
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export async function extractDeterministicImageSignals(buffer) {
  const image = sharp(buffer, { failOn: "error" });
  const metadata = await image.metadata();
  const { data, info } = await image.clone().resize({ width: 96, height: 96, fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let index = 0; index < data.length; index += info.channels) {
    const red = Math.min(255, Math.round(data[index] / 32) * 32);
    const green = Math.min(255, Math.round(data[index + 1] / 32) * 32);
    const blue = Math.min(255, Math.round(data[index + 2] / 32) * 32);
    const key = `${red},${green},${blue}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const colors = [...buckets.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([key]) => rgbToHex(...key.split(",").map(Number)));
  const ratio = metadata.width && metadata.height ? metadata.width / metadata.height : 1;
  return {
    width: metadata.width || null,
    height: metadata.height || null,
    aspectRatio: ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square",
    colors
  };
}

export async function analyzeImageWithMiniMax({ buffer, mimeType, name, prompt, apiHost, apiKey, transport = fetch }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw visionError("MINIMAX_VISION_IMAGE_MISSING", "视觉分析缺少图片内容");
  if (buffer.length > MAX_IMAGE_BYTES) throw visionError("MINIMAX_VISION_IMAGE_TOO_LARGE", "MiniMax 单张视觉分析图片不能超过 20MB", 413);
  const resolvedMimeType = normalizeMimeType(mimeType, name);
  if (!resolvedMimeType) throw visionError("MINIMAX_VISION_FORMAT_UNSUPPORTED", "MiniMax 视觉分析只支持 JPEG、PNG 和 WebP");
  if (!apiKey) throw visionError("MINIMAX_VISION_KEY_MISSING", "尚未配置 MiniMax API Key", 409);
  const localSignals = await extractDeterministicImageSignals(buffer);
  const baseUrl = String(apiHost || "https://api.minimaxi.com").replace(/\/$/, "");
  const response = await transport(`${baseUrl}/v1/coding_plan/vlm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "MM-API-Source": "Minimax-MCP" },
    body: JSON.stringify({
      prompt: prompt || "分析这张品牌视觉参考图。只返回JSON对象，字段为 colors、fontPreferences、layoutPreferences、materials、photographyOrIllustrationDirection、forbiddenMotifs、referenceNotes、evidence、confidence。photographyOrIllustrationDirection只能是editorial_photography或isometric_illustration。不要猜测无法看清的品牌规范。",
      image_url: `data:${resolvedMimeType};base64,${buffer.toString("base64")}`
    }),
    signal: AbortSignal.timeout(90_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.base_resp?.status_code) {
    throw visionError("MINIMAX_VISION_REQUEST_FAILED", payload.base_resp?.status_msg || payload.error?.message || `MiniMax 视觉分析失败：HTTP ${response.status}`, 502, { httpStatus: response.status, providerStatus: payload.base_resp?.status_code || null, traceId: response.headers.get("trace-id") || response.headers.get("x-trace-id") || null });
  }
  const analysis = normalizeAnalysis(extractJson(payload.content || ""));
  analysis.colors = cleanList([...localSignals.colors, ...analysis.colors]);
  return { provider: "MiniMax Coding Plan VLM", endpoint: "/v1/coding_plan/vlm", analysis, localSignals };
}

export async function analyzeVisualTextWithMiniMax({ text, name, baseUrl, apiKey, model = "MiniMax-M3", transport = fetch }) {
  const source = String(text || "").trim().slice(0, 18_000);
  if (!source) throw visionError("MINIMAX_VISUAL_TEXT_MISSING", "VI 文件没有可供分析的文字内容");
  if (!apiKey) throw visionError("MINIMAX_VISION_KEY_MISSING", "尚未配置 MiniMax API Key", 409);
  const response = await transport(`${String(baseUrl || "https://api.minimaxi.com/anthropic").replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "Anthropic-Version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 1,
      system: "你是品牌视觉规范分析师。只基于输入资料提取可证实的设计规律，不补造资料未说明的规则。所有说明必须使用简体中文，保留必要的品牌名和十六进制色值。只返回JSON对象，所有列表字段必须是字符串数组。",
      messages: [{ role: "user", content: `资料名称：${name || "VI资料"}\n\n${source}\n\n返回字段：colors、fontPreferences、layoutPreferences、materials、photographyOrIllustrationDirection、forbiddenMotifs、referenceNotes、evidence、confidence。photographyOrIllustrationDirection只能是editorial_photography或isometric_illustration。` }]
    }),
    signal: AbortSignal.timeout(90_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw visionError("MINIMAX_VISUAL_TEXT_REQUEST_FAILED", payload.error?.message || `MiniMax VI 文字分析失败：HTTP ${response.status}`, 502, { httpStatus: response.status });
  const content = Array.isArray(payload.content) ? payload.content.filter((item) => item.type === "text").map((item) => item.text).join("\n") : "";
  return { provider: "MiniMax Anthropic compatible text", endpoint: "/anthropic/v1/messages", analysis: normalizeAnalysis(extractJson(content)) };
}

export async function analyzePdfWithMiniMax({ buffer, name, apiHost, apiKey, transport = fetch, maxProviderCalls = MAX_PDF_PROVIDER_CALLS }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw visionError("MINIMAX_VISION_PDF_MISSING", "视觉分析缺少 PDF 内容");
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    const pageNumbers = samplePageNumbers(info.total, Math.max(1, Math.min(MAX_PDF_PAGES, Number(maxProviderCalls) * PDF_PAGES_PER_SHEET)));
    const groups = [];
    for (let index = 0; index < pageNumbers.length; index += PDF_PAGES_PER_SHEET) groups.push(pageNumbers.slice(index, index + PDF_PAGES_PER_SHEET));
    const sheetInputs = [];
    for (const group of groups) {
      const screenshots = await parser.getScreenshot({ partial: group, desiredWidth: 480, imageBuffer: true, imageDataUrl: false });
      if (!screenshots.pages.length) continue;
      const sheet = await createPdfContactSheet(screenshots.pages);
      const ordering = group.join("、");
      sheetInputs.push({ sheet, group, ordering });
    }
    const sourceAnalyses = [];
    for (let offset = 0; offset < sheetInputs.length; offset += 3) {
      const batch = sheetInputs.slice(offset, offset + 3);
      const results = await Promise.all(batch.map(async ({ sheet, group, ordering }) => {
        const result = await analyzeImageWithMiniMax({
          buffer: sheet,
          mimeType: "image/png",
          name: `${name || "VI手册"}（第${ordering}页）`,
          apiHost,
          apiKey,
          transport,
          prompt: `这是一份品牌 VI 手册的页面总览，页面按从左到右、从上到下排列，对应原 PDF 第 ${ordering} 页。请只依据清晰可见的内容提取品牌色、字体倾向、版式结构、图形或摄影风格、材质感和明确禁用项。所有说明使用简体中文；evidence 必须标注对应原 PDF 页码；看不清的文字不要猜。只返回 JSON 对象，字段为 colors、fontPreferences、layoutPreferences、materials、photographyOrIllustrationDirection、forbiddenMotifs、referenceNotes、evidence、confidence。除 photographyOrIllustrationDirection 与 confidence 外，其他列表字段必须是字符串数组；photographyOrIllustrationDirection只能是editorial_photography或isometric_illustration。`
        });
        return { ...result, pages: group };
      }));
      sourceAnalyses.push(...results);
    }
    const analysis = mergeVisualAnalyses(sourceAnalyses);
    if (!sourceAnalyses.length || !hasUsefulVisualSignals(analysis)) {
      throw visionError("MINIMAX_PDF_VISUAL_SIGNALS_MISSING", "没有从这份 PDF 中识别到可用的品牌视觉规律，请确认页面可以正常预览后重试", 422, { pagesTotal: info.total, pagesAnalyzed: pageNumbers.length });
    }
    return {
      provider: "MiniMax Coding Plan VLM",
      endpoint: "/v1/coding_plan/vlm",
      analysis,
      providerCalls: sourceAnalyses.length,
      coverage: {
        analysisMode: "page_vision",
        pagesTotal: info.total,
        pagesRendered: pageNumbers.length,
        pagesAnalyzed: pageNumbers.length,
        sampled: pageNumbers.length < info.total,
        analyzedPageNumbers: pageNumbers
      },
      sourceAnalyses
    };
  } finally {
    await parser.destroy();
  }
}

export function mergeVisualAnalyses(items = []) {
  const analyses = items.map((item) => item.analysis).filter(Boolean);
  const collect = (key, limit = 10) => cleanList(analyses.flatMap((item) => item[key] || []), limit);
  return {
    colors: collect("colors", 10),
    fontPreferences: collect("fontPreferences"),
    layoutPreferences: collect("layoutPreferences"),
    materials: collect("materials"),
    photographyOrIllustrationDirection: analyses.find((item) => item.photographyOrIllustrationDirection)?.photographyOrIllustrationDirection || "editorial_photography",
    forbiddenMotifs: collect("forbiddenMotifs"),
    referenceNotes: analyses.map((item) => item.referenceNotes).filter(Boolean).join("；").slice(0, 1600),
    evidence: collect("evidence", 16),
    confidence: analyses.some((item) => item.confidence === "low") ? "low" : analyses.some((item) => item.confidence === "medium") ? "medium" : "high"
  };
}
