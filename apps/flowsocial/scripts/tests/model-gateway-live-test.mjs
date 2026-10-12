import { generateText, providerStatus } from "../../providers.mjs";

const started = Date.now();
const result = await generateText({
  task: "model_gateway_live_test",
  contract: "ConsultativeReply@2.0",
  instruction: "只返回JSON对象，assistantMessage填写模型连接正常。",
  outputSchema: { assistantMessage: "模型连接正常" }
}, { assistantMessage: "模型连接降级" });

const output = { ok: result.mode === "live", mode: result.mode, durationMs: Date.now() - started, responseValidated: typeof result.data?.assistantMessage === "string" && Boolean(result.data.assistantMessage.trim()), warning: result.warning || null, telemetry: result.telemetry || null, model: providerStatus().model };
console.log(JSON.stringify(output, null, 2));
if (!output.ok) process.exitCode = 1;

