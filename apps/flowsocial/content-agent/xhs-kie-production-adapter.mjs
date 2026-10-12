function fail(code, message = code) {
  throw Object.assign(new Error(message), { code });
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; }, async arrayBuffer() { return Buffer.from(body); } };
}

export function createXhsKieProviderTransport({ baseUrl, apiKey, fetchImpl = fetch, maxPolls = 180, pollIntervalMs = 3000, downloadTimeoutMs = 60000, measureCredits = false } = {}) {
  if (typeof baseUrl !== "string" || !/^https:\/\//i.test(baseUrl)) fail("XHS_KIE_BASE_URL_INVALID");
  if (typeof apiKey !== "string" || !apiKey.trim()) fail("XHS_KIE_API_KEY_REQUIRED");
  if (typeof fetchImpl !== "function") fail("XHS_KIE_FETCH_REQUIRED");
  if (!Number.isInteger(maxPolls) || maxPolls < 1 || maxPolls > 300) fail("XHS_KIE_MAX_POLLS_INVALID");
  const root = baseUrl.replace(/\/$/, "");
  const requestJson = async (path, options = {}) => {
    const response = await fetchImpl(`${root}${path}`, { ...options, headers: { Authorization: `Bearer ${apiKey}`, ...(options.body != null ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    const providerCode = body?.code;
    const providerSuccess = providerCode === undefined || providerCode === 0 || providerCode === 200 || providerCode === "0" || providerCode === "200";
    if (!response.ok || !providerSuccess || body.success === false) {
      const detail = body?.msg || body?.message || body?.error || (providerCode !== undefined ? `code=${providerCode}` : "unknown provider response");
      fail(`XHS_KIE_HTTP_${response.status}`, `KIE request failed (${response.status}): ${String(detail).slice(0, 240)}`);
    }
    return body;
  };
  const readCredits = async () => {
    if (!measureCredits) return null;
    const balance = await requestJson("/api/v1/chat/credit");
    const value = Number(balance?.data);
    if (!Number.isFinite(value) || value < 0) fail("XHS_KIE_CREDIT_BALANCE_INVALID");
    return value;
  };
  const submit = async (request) => {
    if (!request || request.endpoint !== "/api/v1/jobs/createTask" || request.method !== "POST" || !request.body) fail("XHS_KIE_REQUEST_CONTRACT_INVALID");
    const creditsBefore = await readCredits();
    // Kie's Seedream 4.5 endpoint accepts prompt/aspect_ratio/quality/
    // nsfw_checker, but rejects the legacy image2 `resolution` field with a
    // generic “This field is required” validation response. Keep the frozen
    // plan trace intact and normalize only the wire payload at the adapter
    // boundary.
    const body = structuredClone(request.body);
    if (body.model === "seedream/4.5-text-to-image" || body.model === "seedream/4.5-edit") {
      delete body.input?.resolution;
      if (body.input && body.input.quality === undefined) body.input.quality = "basic";
      if (body.input && body.input.nsfw_checker === undefined) body.input.nsfw_checker = true;
    }
    const created = await requestJson("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(body) });
    const taskId = created?.data?.taskId || created?.data?.task_id;
    if (typeof taskId !== "string" || !taskId) fail("XHS_KIE_TASK_ID_MISSING");
    return { status: "provider_task_created", provider: "kie.ai", model: request.body.model, taskId, creditsBefore, paidTaskCreated: true };
  };
  const readResult = async ({ taskId, model, creditsBefore = null } = {}) => {
    if (typeof taskId !== "string" || !taskId.trim()) fail("XHS_KIE_TASK_ID_REQUIRED");
    try {
      const body = await requestJson(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
      const task = body?.data; const state = task?.state;
      if (["waiting", "queuing", "generating"].includes(state)) return { status: "processing", provider: "kie.ai", model: model || task?.model || null, taskId, providerState: state, paidTaskCreated: true };
      const reportedCost = Number(task?.creditsConsumed ?? task?.cost ?? task?.credits ?? task?.usage?.credits);
      if (state === "fail") return { status: "failed", provider: "kie.ai", model: model || task?.model || null, taskId, paidTaskCreated: true, cost: Number.isFinite(reportedCost) ? reportedCost : null, costStatus: Number.isFinite(reportedCost) ? "provider_reported" : "unknown", error: { code: `XHS_KIE_TASK_FAILED_${task?.failCode || "UNKNOWN"}`, message: task?.failMsg || "KIE task failed" } };
      if (state !== "success") fail("XHS_KIE_TASK_STATE_UNKNOWN");
      const parsed = typeof task.resultJson === "string" ? JSON.parse(task.resultJson) : task.resultJson;
      if (!Array.isArray(parsed?.resultUrls) || parsed.resultUrls.length !== 1) fail("XHS_KIE_RESULT_URL_INVALID");
      const resultUrl = new URL(parsed.resultUrls[0]);
      if (resultUrl.protocol !== "https:") fail("XHS_KIE_RESULT_URL_PROTOCOL_INVALID");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);
      let downloaded;
      try { downloaded = await fetchImpl(resultUrl, { signal: controller.signal }); }
      finally { clearTimeout(timeout); }
      if (!downloaded.ok) fail(`XHS_KIE_RESULT_DOWNLOAD_${downloaded.status}`);
      const bytes = Buffer.from(await downloaded.arrayBuffer());
      let measuredCost = null;
      if (measureCredits && Number.isFinite(Number(creditsBefore))) {
        try { measuredCost = Math.max(0, Number(creditsBefore) - await readCredits()); }
        catch { measuredCost = null; }
      }
      const numericCost = Number.isFinite(reportedCost) ? reportedCost : measuredCost;
      return {
        status: "succeeded", provider: "kie.ai", model: model || task?.model || null, taskId, bytes, resultUrl: resultUrl.toString(), mediaType: downloaded.headers?.get?.("content-type") || null,
        cost: Number.isFinite(numericCost) && numericCost >= 0 ? numericCost : 0,
        paidTaskCreated: true,
        ...(Number.isFinite(numericCost) && numericCost >= 0 ? { costStatus: Number.isFinite(reportedCost) ? "provider_reported" : "measured" } : { costStatus: "unknown", checkpoint: { taskId, state: "success", resultUrl: resultUrl.toString() } })
      };
    } catch (error) {
      error.taskId = taskId; error.paidTaskCreated = true; throw error;
    }
  };
  const transport = async (request) => {
    const submission = await submit(request);
    for (let count = 0; count < maxPolls; count += 1) {
      const result = await readResult(submission);
      if (result.status === "succeeded") return result;
      if (result.status === "failed") throw Object.assign(new Error(result.error.message), { code: result.error.code, taskId: submission.taskId, paidTaskCreated: true });
      if (count + 1 < maxPolls) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    const error = Object.assign(new Error("XHS_KIE_POLL_LIMIT_REACHED"), { code: "XHS_KIE_POLL_LIMIT_REACHED", taskId: submission.taskId, paidTaskCreated: true });
    throw error;
  };
  transport.submit = submit;
  transport.readResult = readResult;
  return transport;
}

export const xhsKieAdapterContract = "XhsKieProviderTransport@1.0";

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function physicalRelativePath(value) {
  const parts = String(value).replace(/\\/g, "/").split("/");
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) fail("XHS_ASSET_PATH_OUTSIDE_ISOLATED_DIR");
  return parts.map((part) => part.replace(/[<>:"|?*\u0000-\u001f]/g, "_")).join(sep);
}
function safePath(rootDir, value) {
  if (typeof value !== "string" || !value.trim()) fail("XHS_ASSET_PATH_REQUIRED");
  const root = resolve(rootDir); const target = resolve(root, physicalRelativePath(value));
  if (target !== root && !target.startsWith(`${root}${sep}`)) fail("XHS_ASSET_PATH_OUTSIDE_ISOLATED_DIR");
  return target;
}

export function createXhsFileByteSink({ isolatedDataDir } = {}) {
  if (typeof isolatedDataDir !== "string" || !isolatedDataDir.trim()) fail("XHS_FILE_SINK_ISOLATED_DIR_REQUIRED");
  const root = resolve(isolatedDataDir);
  return async (payloads) => {
    const receipts = [];
    for (const payload of payloads || []) {
      const base = compactXhsFallbackBase(payload.attemptRef);
      const rawPath = safePath(root, payload.rawRelativePath || `${base}/raw.png`);
      await mkdir(dirname(rawPath), { recursive: true });
      await writeFile(rawPath, payload.rawBytes);
      let normalizedSha256 = null;
      if (payload.normalizedBytes) {
        const normalizedPath = safePath(root, payload.normalizedRelativePath || `${base}/normalized.png`);
        await mkdir(dirname(normalizedPath), { recursive: true });
        await writeFile(normalizedPath, payload.normalizedBytes);
        normalizedSha256 = sha256(payload.normalizedBytes);
      }
      receipts.push({ attemptRef: payload.attemptRef, rawSha256: sha256(payload.rawBytes), normalizedSha256 });
    }
    return { status: "staged_and_hash_verified", receipts };
  };
}

export function createXhsFileAssetReader({ isolatedDataDir } = {}) {
  if (typeof isolatedDataDir !== "string" || !isolatedDataDir.trim()) fail("XHS_FILE_READER_ISOLATED_DIR_REQUIRED");
  const root = resolve(isolatedDataDir);
  return async (asset) => {
    const path = safePath(root, asset?.relativePath || asset?.path || asset?.relativePathname);
    const bytes = await readFile(path);
    return { bytes, mediaType: "image/png", relativePath: relative(root, path) };
  };
}

export function createXhsFileAssetWriter({ isolatedDataDir } = {}) {
  if (typeof isolatedDataDir !== "string" || !isolatedDataDir.trim()) fail("XHS_FILE_WRITER_ISOLATED_DIR_REQUIRED");
  const root = resolve(isolatedDataDir);
  return async ({ relativePath, bytes }) => {
    if (!Buffer.isBuffer(bytes) || !bytes.length) fail("XHS_FILE_WRITER_BYTES_REQUIRED");
    const target = safePath(root, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return { relativePath, sha256: sha256(bytes), bytes: bytes.length };
  };
}

export function createXhsKieBase64UploadTransport({ apiKey, baseUrl = "https://kieai.redpandaai.co", fetchImpl = fetch, timeoutMs = 60000 } = {}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) fail("XHS_KIE_UPLOAD_API_KEY_REQUIRED");
  if (typeof baseUrl !== "string" || !/^https:\/\//i.test(baseUrl)) fail("XHS_KIE_UPLOAD_BASE_URL_INVALID");
  return async ({ bytes, mediaType = "image/png", fileName }) => {
    if (!Buffer.isBuffer(bytes) || !bytes.length) fail("XHS_KIE_UPLOAD_BYTES_REQUIRED");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response; let body;
    try {
      response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/file-base64-upload`, {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data: `data:${mediaType};base64,${bytes.toString("base64")}`, uploadPath: "images/flowsocial-xhs-edits", fileName })
      });
      body = await response.json().catch(() => ({}));
    } finally { clearTimeout(timer); }
    if (!response?.ok || body?.success !== true || !body?.data?.downloadUrl) fail(`XHS_KIE_UPLOAD_HTTP_${response?.status || "UNKNOWN"}`);
    return { status: "uploaded", url: body.data.downloadUrl, fileId: body.data.fileId || null, expiresAt: body.data.expiresAt || null };
  };
}
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { compactXhsFallbackBase } from "./xhs-asset-paths.mjs";
