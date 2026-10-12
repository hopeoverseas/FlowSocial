import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((item) => {
  const [key, ...rest] = item.replace(/^--/, "").split("=");
  return [key, rest.length ? rest.join("=") : true];
}));
const dataRoot = resolve(String(args["data-dir"] || process.env.FLOWSOCIAL_DATA_DIR || ""));
const isolatedRoot = `${resolve(".tmp")}${process.platform === "win32" ? "\\" : "/"}`.toLowerCase();
if (!dataRoot.toLowerCase().startsWith(isolatedRoot)) throw new Error("Live recovery data must use an isolated .tmp directory");

const configModulePath = process.env.FLOWSOCIAL_PROVIDER_CONFIG_MODULE
  || join(process.env.USERPROFILE || "", "Documents", "社媒", "apps", "flowsocial", "provider-config.mjs");
const { getProviderConfig } = await import(pathToFileURL(resolve(configModulePath)).href);
const config = getProviderConfig();
const childEnvironment = { ...process.env, FLOWSOCIAL_DATA_DIR: dataRoot, PORT: String(args.port || process.env.PORT || 4347), WECHAT_RECOVERY_LIVE: "1" };
for (const name of [
  "FLOW_MODEL_PROVIDER", "FLOW_MODEL_BASE_URL", "FLOW_MODEL_NAME", "FLOW_MODEL_PROTOCOL",
  "FLOW_LLM_PROFILE_MODE", "FLOW_MODEL_REASONING_CAPABILITY", "FLOW_MODEL_STRUCTURED_RECOVERY",
  "FLOW_MODEL_TASK_BUDGETS", "FLOW_MODEL_LONG_JSON_GUARDS", "FLOW_MODEL_API_KEY"
]) {
  if (config[name]) childEnvironment[name] = config[name];
}
if (!childEnvironment.FLOW_MODEL_API_KEY) throw new Error("Configured model credential is unavailable");

if (args.detach) {
  const evidenceRoot = resolve(dataRoot, "..");
  const stdout = openSync(join(evidenceRoot, "compact-v2-server.stdout.log"), "a");
  const stderr = openSync(join(evidenceRoot, "compact-v2-server.stderr.log"), "a");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), `--data-dir=${dataRoot}`, `--port=${childEnvironment.PORT}`, "--child"], {
    cwd: resolve("."), env: childEnvironment, detached: true, windowsHide: true, stdio: ["ignore", stdout, stderr]
  });
  child.unref();
  console.log(JSON.stringify({ processId: child.pid, isolatedData: true, provider: config.FLOW_MODEL_PROVIDER, model: config.FLOW_MODEL_NAME }));
} else if (args.child && process.env.WECHAT_RECOVERY_LIVE === "1") {
  console.log(`[wechat-recovery-live] isolatedData=true provider=${config.FLOW_MODEL_PROVIDER} model=${config.FLOW_MODEL_NAME}`);
  await import("../../server.mjs");
} else {
  throw new Error("Use --detach for the explicitly approved isolated live recovery run");
}
