import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument, rgb } from "pdf-lib";
import { analyzeImageWithMiniMax, analyzePdfWithMiniMax, analyzeVisualTextWithMiniMax, mergeVisualAnalyses, prioritizeEvidenceColors } from "../../content-agent/minimax-vision-adapter.mjs";

const image = await sharp({ create: { width: 120, height: 160, channels: 3, background: "#245044" } }).png().toBuffer();
let imageCalls = 0;
const imageResult = await analyzeImageWithMiniMax({
  buffer: image,
  mimeType: "image/png",
  name: "brand.png",
  apiKey: "test-key",
  apiHost: "https://api.minimaxi.com",
  transport: async (url, request) => {
    imageCalls += 1;
    assert.equal(url, "https://api.minimaxi.com/v1/coding_plan/vlm");
    assert.equal(request.headers["MM-API-Source"], "Minimax-MCP");
    const body = JSON.parse(request.body);
    assert.match(body.image_url, /^data:image\/png;base64,/);
    return new Response(JSON.stringify({ base_resp: { status_code: 0 }, content: JSON.stringify({ colors: ["#245044"], fontPreferences: ["无衬线粗体"], layoutPreferences: ["顶部标题区"], materials: ["纸张"], photographyOrIllustrationDirection: "editorial_photography", forbiddenMotifs: ["高饱和霓虹"], referenceNotes: "留白克制", evidence: ["深绿色大面积背景"], confidence: "high" }) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
assert.equal(imageCalls, 1);
assert.equal(imageResult.localSignals.aspectRatio, "portrait");
assert.ok(imageResult.analysis.colors.length);

let textCalls = 0;
const textResult = await analyzeVisualTextWithMiniMax({
  text: "品牌主色为深绿色，标题使用粗体无衬线，页面保持大面积留白。",
  name: "VI.pdf",
  apiKey: "test-key",
  transport: async (url) => {
    textCalls += 1;
    assert.equal(url, "https://api.minimaxi.com/anthropic/v1/messages");
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ colors: ["深绿色"], fontPreferences: ["粗体无衬线"], layoutPreferences: ["大面积留白"], materials: ["纸张"], photographyOrIllustrationDirection: "editorial_photography", forbiddenMotifs: ["霓虹光效"], referenceNotes: "来自VI文字", evidence: ["品牌主色为深绿色"], confidence: "high" }) }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
assert.equal(textCalls, 1);
const merged = mergeVisualAnalyses([imageResult, textResult]);
assert.ok(merged.colors.includes("深绿色"));
assert.ok(merged.layoutPreferences.includes("大面积留白"));

const pdf = await PDFDocument.create();
for (const color of [rgb(0.82, 0.05, 0.08), rgb(0.04, 0.04, 0.04)]) {
  const page = pdf.addPage([842, 595]);
  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color });
}
let pdfCalls = 0;
const pdfResult = await analyzePdfWithMiniMax({
  buffer: Buffer.from(await pdf.save()),
  name: "brand-vi.pdf",
  apiKey: "test-key",
  apiHost: "https://api.minimaxi.com",
  transport: async (_url, request) => {
    pdfCalls += 1;
    const body = JSON.parse(request.body);
    assert.match(body.prompt, /原 PDF 第 1、2 页/);
    return new Response(JSON.stringify({ base_resp: { status_code: 0 }, content: JSON.stringify({ colors: [{ name: "品牌红", value: "#D10D14" }, { name: "黑色", value: "#111111" }], fontPreferences: [{ name: "标题", value: "粗体标题" }], layoutPreferences: ["高对比大标题"], materials: [{ description: "平面几何" }], photographyOrIllustrationDirection: ["无摄影，使用品牌图形插画"], forbiddenMotifs: [{ rule: "霓虹光效" }], referenceNotes: ["红黑高对比品牌系统"], evidence: ["第1页红色背景", "第2页黑色背景"], confidence: 0.92 }) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
assert.equal(pdfCalls, 1);
assert.deepEqual(pdfResult.coverage.analyzedPageNumbers, [1, 2]);
assert.equal(pdfResult.coverage.analysisMode, "page_vision");
assert.ok(pdfResult.analysis.colors.includes("#D10D14"));
assert.ok(pdfResult.analysis.fontPreferences.includes("标题：粗体标题"));
assert.equal(pdfResult.analysis.photographyOrIllustrationDirection, "isometric_illustration");
assert.equal(pdfResult.analysis.confidence, "high");
assert.ok(!JSON.stringify(pdfResult.analysis).includes("[object Object]"));
const prioritized = prioritizeEvidenceColors({ colors: ["#FFFFFF"] }, "第14页标准色 D71018、231815、DCDDDD");
assert.deepEqual(prioritized.colors.slice(0, 3), ["#D71018", "#231815", "#DCDDDD"]);
console.log("minimax-vision-adapter-self-test: ok");
