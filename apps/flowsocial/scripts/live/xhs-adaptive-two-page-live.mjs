import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildSkillDrivenPreflight, defaultLiveOperations, loadApiKey } from "./xhs-integrated-page-skill-live.mjs";

const appRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

export function buildAdaptiveTwoPagePreflight() {
  const reviewedAt = "2026-08-24T09:00:00.000Z";
  const draft = buildSkillDrivenPreflight({ now: reviewedAt });
  const preflight = buildSkillDrivenPreflight({
    now: reviewedAt,
    promptApproval: { schemaVersion: "1.0", decision: "approved", promptSetHash: draft.invocation.promptSetHash, reviewedBy: "controller-workspace-user-two-page-regression", reviewedAt }
  });
  const pages = preflight.requests.slice(0, 2).map((item, index) => ({
    pageId: preflight.evidence.pages[index]?.pageId || `P${index + 1}`,
    request: item.request,
    requestHash: sha256(JSON.stringify(item.request))
  }));
  assert.equal(pages.length, 2);
  assert.ok(pages.every((page) => page.request.body.model === "gpt-image-2-text-to-image"));
  assert.ok(pages.every((page) => !/#[0-9a-f]{6}\b/i.test(page.request.body.input.prompt)));
  assert.ok(pages.every((page) => /只使用简体中文/.test(page.request.body.input.prompt)));
  assert.ok(pages.every((page) => /道路、路牌、建筑、服装、屏幕、包装、图标和背景纹理不得出现真值之外/.test(page.request.body.input.prompt)));
  assert.ok(pages.every((page) => /禁止默认使用信息卡、宫格、中心圆节点图/.test(page.request.body.input.prompt)));
  assert.ok(pages.every((page) => !/保持纸面编辑设计与单一隐喻/.test(page.request.body.input.prompt)));
  return { planHash: preflight.plan.planHash, promptSetHash: preflight.invocation.promptSetHash, pages };
}

export async function executeAdaptiveTwoPageLive({ operations = defaultLiveOperations, apiKey = loadApiKey(), outputRoot = resolve(appRoot, ".tmp", `xhs-adaptive-two-page-${stamp()}`) } = {}) {
  const preflight = buildAdaptiveTwoPagePreflight();
  await mkdir(outputRoot, { recursive: true });
  const summary = { schemaVersion: "1.0", mode: "isolated-two-page-live", model: "gpt-image-2-text-to-image", approvedPaidCalls: 2, automaticRetries: 0, planHash: preflight.planHash, promptSetHash: preflight.promptSetHash, outputRoot, records: [], stoppedBy: null };
  await writeFile(resolve(outputRoot, "preflight.json"), `${JSON.stringify({ ...preflight, pages: preflight.pages.map((page) => ({ ...page, request: { ...page.request, body: { ...page.request.body, input: { ...page.request.body.input } } } })) }, null, 2)}\n`);
  for (const page of preflight.pages) {
    if (summary.records.length >= summary.approvedPaidCalls) break;
    const record = { pageId: page.pageId, requestHash: page.requestHash, taskId: null, status: "submitting", creditsBefore: null, creditsAfter: null, measuredCredits: null, asset: null, error: null };
    try {
      record.creditsBefore = await operations.credits(apiKey);
      record.taskId = await operations.createTask(apiKey, page.request);
      record.status = "provider_task_created";
      summary.records.push(record);
      await writeFile(resolve(outputRoot, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify({ event: "provider_task_created", pageId: page.pageId, taskId: record.taskId })}\n`);
      const task = await operations.pollTask(apiKey, record.taskId, { maxPolls: 180, intervalMs: 3000 });
      const bytes = await operations.downloadResult(task);
      const metadata = await sharp(bytes).metadata();
      const format = metadata.format === "jpeg" ? "jpg" : metadata.format === "webp" ? "webp" : "png";
      const nativePath = resolve(outputRoot, `${page.pageId.toLowerCase()}.native.${format}`);
      const previewPath = resolve(outputRoot, `${page.pageId.toLowerCase()}.preview.png`);
      await writeFile(nativePath, bytes);
      await sharp(bytes).png().toFile(previewPath);
      record.asset = { nativePath, previewPath, sha256: sha256(bytes), width: metadata.width, height: metadata.height, format: metadata.format };
      record.creditsAfter = await operations.credits(apiKey);
      record.measuredCredits = Math.max(0, record.creditsBefore - record.creditsAfter);
      record.status = "succeeded";
    } catch (error) {
      record.status = record.taskId ? "result_unknown_or_failed" : "submission_failed";
      record.error = { code: error.code || "LIVE_TWO_PAGE_FAILED", message: String(error.message || error) };
      if (!summary.records.includes(record)) summary.records.push(record);
      summary.stoppedBy = record.error.code;
    }
    await writeFile(resolve(outputRoot, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    if (summary.stoppedBy) break;
  }
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  try {
    const result = args.length === 0
      ? buildAdaptiveTwoPagePreflight()
      : args.length === 3 && args[0] === "--live" && args[1] === "--approved-paid-calls" && args[2] === "2"
        ? await executeAdaptiveTwoPageLive()
        : (() => { throw new Error("USAGE: node scripts/live/xhs-adaptive-two-page-live.mjs [--live --approved-paid-calls 2]"); })();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.code || "LIVE_TWO_PAGE_ERROR"}:${error.message}\n`);
    process.exitCode = 1;
  }
}
