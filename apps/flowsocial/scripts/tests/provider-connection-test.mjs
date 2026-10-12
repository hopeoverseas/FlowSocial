import { collectSearchSignals, generateImage, generateText, providerStatus } from "../../providers.mjs";

const startedAt = new Date().toISOString();
const tests = {
  model: () => generateText({
    task: "provider_connection_test",
    instruction: "只返回连接测试结果，不生成内容。",
    output_schema: { ok: true, message: "string" }
  }),
  search: () => collectSearchSignals({ keywords: ["企业AI"], platforms: ["wechat"], pageSize: 10, pages: 1 }),
  image: () => generateImage({
    prompt: "minimal editorial illustration of an enterprise AI workflow, dark green and warm ivory palette, simple geometric nodes connected in a clear process, clean background, no text, no logo, no watermark",
    aspectRatio: "1:1",
    quality: "basic"
  })
};

const entries = await Promise.all(Object.entries(tests).map(async ([name, run]) => {
  const started = Date.now();
  try {
    const result = await run();
    return [name, {
      ok: true,
      mode: result.mode,
      durationMs: Date.now() - started,
      ...(name === "model" ? { responseValidated: result.data != null && typeof result.data === "object", responseKeys: Object.keys(result.data || {}).slice(0, 10) } : {}),
      ...(name === "search" ? { itemCount: result.items?.length || 0, warningCount: result.warnings?.length || 0, sampleTitles: (result.items || []).slice(0, 3).map((item) => item.title) } : {}),
      ...(name === "image" ? { status: result.status, taskId: result.taskId, imageUrl: result.imageUrl || null, model: result.model } : {})
    }];
  } catch (error) {
    return [name, { ok: false, durationMs: Date.now() - started, error: error.message }];
  }
}));

const results = Object.fromEntries(entries);
console.log(JSON.stringify({ startedAt, completedAt: new Date().toISOString(), configured: providerStatus(), allPassed: Object.values(results).every((item) => item.ok), results }, null, 2));
if (!Object.values(results).every((item) => item.ok)) process.exitCode = 1;

