import { generateText, providerStatus } from "../../providers.mjs";
import { buildProductCapabilityPolicyReport } from "../../product-capability-policy.mjs";

const port=Number(process.env.PORT||4273);
const productCapabilityPolicy=buildProductCapabilityPolicyReport(process.env);
if(productCapabilityPolicy.missingBaseline.length){
  console.warn(`[FlowSocial] 产品基线存在关闭项：${productCapabilityPolicy.missingBaseline.map((item)=>item.env).join(", ")}`);
}
if(productCapabilityPolicy.unsafeDeviations.length){
  console.warn(`[FlowSocial] 检测到平台外部效果显式覆盖：${productCapabilityPolicy.unsafeDeviations.map((item)=>item.env).join(", ")}；执行仍需对应人工授权门。`);
}

async function runningHealth(){
  try{
    const response=await fetch(`http://127.0.0.1:${port}/api/v1/health`,{signal:AbortSignal.timeout(1500)});
    if(!response.ok)return null;
    return await response.json();
  }catch{return null;}
}

async function waitForStop(){
  for(let attempt=0;attempt<20;attempt+=1){
    if(!await runningHealth())return true;
    await new Promise((resolve)=>setTimeout(resolve,100));
  }
  return false;
}

const existing=await runningHealth();
if(existing?.service==="flowsocial"){
  if(!existing.restartRequired&&existing.buildId){
    console.log(`[FlowSocial] 后端已经运行且版本正常：http://127.0.0.1:${port}`);
    process.exit(0);
  }
  if(Number.isInteger(existing.processId)&&existing.processId!==process.pid){
    console.log(`[FlowSocial] 检测到代码已更新，正在停止旧后端 PID ${existing.processId}…`);
    try{process.kill(existing.processId,"SIGTERM");}catch(error){
      console.error(`[FlowSocial] 无法停止旧后端：${error.message}`);
      process.exit(1);
    }
    if(!await waitForStop()){
      console.error("[FlowSocial] 旧后端未在 2 秒内退出，请关闭原启动终端后重试。");
      process.exit(1);
    }
  }else{
    console.error("[FlowSocial] 检测到旧版后端占用端口，但它没有可验证的进程标识。请关闭原启动终端后重试一次。");
    process.exit(1);
  }
}

function guidance(code, message, provider) {
  if (code === "HTTP_402") return `${provider} 账户余额不足：请充值或在模型服务设置中更换一枚有余额的 API Key。`;
  if (["HTTP_401", "HTTP_403"].includes(code)) return `${provider} API Key 无效或没有权限：请重新填写 Key。`;
  if (String(code).includes("EACCES")) return "当前终端不允许访问外网：请在你自己的 PowerShell 中运行，不要从受限沙箱启动。";
  if (String(code).includes("TIMEOUT")) return "连接 DeepSeek 超时：请检查网络、防火墙或代理设置。";
  return `模型预检失败：${message || code || "未知错误"}`;
}

if (process.env.FLOWSOCIAL_OFFLINE_START === "1") {
  console.log("[FlowSocial] 离线产品启动：跳过模型预检；真实生成时仍按任务规则检查 Provider。");
} else {
  console.log("[FlowSocial] 正在检查模型服务…");
  const result = await generateText({
    task: "model_gateway_live_test",
    contract: "ConsultativeReply@2.0",
    instruction: "只返回JSON对象，assistantMessage填写模型连接正常。",
    outputSchema: { assistantMessage: "模型连接正常" }
  }, { assistantMessage: "模型连接降级" });

  if (result.mode !== "live") {
    const model = providerStatus().model;
    const code = result.telemetry?.errorCode || model.lastError?.code || "MODEL_PREFLIGHT_FAILED";
    console.error(`[FlowSocial] ${guidance(code, result.warning || model.lastError?.message, model.provider)}`);
    console.error(`[FlowSocial] provider=${model.provider} model=${model.model} code=${code}`);
    console.error("[FlowSocial] 后端未启动，避免页面在不知情的情况下使用降级结果。");
    process.exit(1);
  }

  console.log(`[FlowSocial] 模型连接正常：${providerStatus().model.provider}/${providerStatus().model.model}`);
}
await import("../../server.mjs");
