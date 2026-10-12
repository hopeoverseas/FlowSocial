function fail(code, message = code) { throw Object.assign(new Error(message), { code }); }

export function createXhsOpenAiCompatibleMultimodalTransport({ baseUrl, apiKey, model, fetchImpl = fetch, timeoutMs = 120000, cost = null } = {}) {
  if (typeof baseUrl !== "string" || !/^https:\/\//i.test(baseUrl)) fail("XHS_MULTIMODAL_BASE_URL_INVALID");
  if (typeof apiKey !== "string" || !apiKey.trim()) fail("XHS_MULTIMODAL_API_KEY_REQUIRED");
  if (typeof model !== "string" || !model.trim()) fail("XHS_MULTIMODAL_MODEL_REQUIRED");
  if (typeof fetchImpl !== "function") fail("XHS_MULTIMODAL_FETCH_REQUIRED");
  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  return async function multimodalTransport(request) {
    if (request?.contract !== "UnifiedXhsVisualReviewMultimodalRequest@1.0" || !Array.isArray(request.attachments) || !request.attachments.length) fail("XHS_MULTIMODAL_REQUEST_CONTRACT_INVALID");
    const prompt = [
      "执行 XHS 视觉审阅。必须只返回 JSON，不要 Markdown 代码围栏。",
      "JSON 顶层字段必须为 status、data、warnings、blocked_reasons；data 必须包含 decision、page_findings、deck_findings、passed_checks、rerun_stages。",
      "必须真正检查所附 PNG 像素；如果无法读取像素，返回 failed 或 blocked，不得声称通过。",
      JSON.stringify({ expectedContract: request.expectedContract, input: request.input, attachmentManifest: request.attachments.map((item) => ({ pageId: item.pageId, sha256: item.sha256, dimensions: item.dimensions })) })
    ].join("\n");
    const content = [{ type: "text", text: prompt }, ...request.attachments.map((item) => ({ type: "image_url", image_url: { url: `data:${item.mediaType || "image/png"};base64,${Buffer.from(item.bytes).toString("base64")}` } }))];
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response; let body;
    try {
      response = await fetchImpl(endpoint, { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0, max_tokens: 4000, response_format: { type: "json_object" }, messages: [{ role: "user", content }] }) });
      body = await response.json().catch(() => ({}));
    } finally { clearTimeout(timer); }
    if (!response?.ok) fail(`XHS_MULTIMODAL_HTTP_${response?.status || "UNKNOWN"}`);
    const raw = body?.choices?.[0]?.message?.content;
    let output;
    try { output = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { fail("XHS_MULTIMODAL_OUTPUT_INVALID_JSON"); }
    if (!output || typeof output !== "object" || Array.isArray(output)) fail("XHS_MULTIMODAL_OUTPUT_INVALID");
    return { status: "succeeded", provider: "openai-compatible", model, mode: "registered_live_multimodal", productionResult: true, pixelInputConsumed: true, cost: Number.isFinite(Number(cost)) ? Number(cost) : 0, ...(cost == null ? { costStatus: "unknown", paidTaskCreated: true, usageStatus: "unknown" } : {}), output };
  };
}

export const xhsMultimodalAdapterContract = "XhsOpenAiCompatibleMultimodalTransport@1.0";
