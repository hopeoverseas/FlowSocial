import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const configPath = join(root, ".env.local");

const defaults = {
  FLOW_MODEL_PROVIDER: "DeepSeek",
  FLOW_MODEL_BASE_URL: "https://api.deepseek.com",
  FLOW_MODEL_NAME: "deepseek-chat",
  FLOW_MODEL_PROTOCOL: "openai",
  FLOW_LLM_PROFILE_MODE: "profiled",
  FLOW_MODEL_REASONING_CAPABILITY: "auto",
  FLOW_MODEL_STRUCTURED_RECOVERY: "enabled",
  FLOW_MODEL_TASK_BUDGETS: "enabled",
  FLOW_MODEL_LONG_JSON_GUARDS: "enabled",
  ANTHROPIC_BASE_URL: "",
  MINIMAX_API_HOST: "https://api.minimaxi.com",
  FLOW_SEARCH_PROVIDER: "RedFox",
  REDFOX_BASE_URL: "https://redfox.hk",
  REDFOX_DOUYIN_SEARCH_PATH: "/story/api/dyData/searchArticle",
  REDFOX_XHS_SEARCH_PATH: "/story/api/xhsUser/searchArticle",
  REDFOX_WECHAT_SEARCH_PATH: "/story/api/gzhData/searchArticle",
  FLOW_IMAGE_PROVIDER: "Kie.ai",
  KIE_BASE_URL: "https://api.kie.ai",
  KIE_IMAGE_MODEL: "gpt-image-2-text-to-image",
  KIE_IMAGE_QUALITY: "basic"
};

const editableKeys = new Set([
  ...Object.keys(defaults),
  "FLOW_MODEL_API_KEY",
  "ANTHROPIC_API_KEY",
  "MINIMAX_API_KEY",
  "REDFOX_API_KEY",
  "KIE_API_KEY"
]);

function parseEnv(text = "") {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value.replace(/\\n/g, "\n");
  }
  return result;
}

function loadLocalConfigSync() {
  try {
    return parseEnv(readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

let localConfig = loadLocalConfigSync();

function getRawProviderConfig() {
  const environment = Object.fromEntries([...editableKeys].map((key) => [key, process.env[key]]).filter(([, value]) => value));
  return { ...defaults, ...localConfig, ...environment };
}

export function getProviderConfig() {
  const config = getRawProviderConfig();
  if (String(config.FLOW_MODEL_PROTOCOL).toLowerCase() === "anthropic") {
    config.FLOW_MODEL_BASE_URL = config.ANTHROPIC_BASE_URL || config.FLOW_MODEL_BASE_URL;
    config.FLOW_MODEL_API_KEY = config.ANTHROPIC_API_KEY || "";
  }
  return config;
}

function configuredSecret(value) {
  return Boolean(value && value.trim());
}

export function getPublicProviderConfig() {
  const config = getProviderConfig();
  return {
    model: {
      provider: config.FLOW_MODEL_PROVIDER,
      baseUrl: config.FLOW_MODEL_BASE_URL,
      model: config.FLOW_MODEL_NAME,
      protocol: config.FLOW_MODEL_PROTOCOL,
      profileMode: config.FLOW_LLM_PROFILE_MODE,
      reasoningCapability: config.FLOW_MODEL_REASONING_CAPABILITY,
      structuredRecovery: config.FLOW_MODEL_STRUCTURED_RECOVERY,
      taskBudgets: config.FLOW_MODEL_TASK_BUDGETS,
      longJsonGuards: config.FLOW_MODEL_LONG_JSON_GUARDS,
      keyConfigured: configuredSecret(config.FLOW_MODEL_API_KEY)
    },
    vision: {
      provider: "MiniMax Coding Plan VLM",
      baseUrl: config.MINIMAX_API_HOST,
      endpoint: "/v1/coding_plan/vlm",
      capabilities: { imageUnderstanding: true, documentInput: false, formats: ["jpeg", "png", "webp"], maxBytes: 20 * 1024 * 1024 },
      keyConfigured: configuredSecret(config.MINIMAX_API_KEY || config.ANTHROPIC_API_KEY)
    },
    search: {
      provider: config.FLOW_SEARCH_PROVIDER,
      baseUrl: config.REDFOX_BASE_URL,
      platforms: ["douyin", "xiaohongshu", "wechat"],
      keyConfigured: configuredSecret(config.REDFOX_API_KEY)
    },
    image: {
      provider: config.FLOW_IMAGE_PROVIDER,
      baseUrl: config.KIE_BASE_URL,
      model: config.KIE_IMAGE_MODEL,
      quality: config.KIE_IMAGE_QUALITY,
      capabilities: { textToImage: true, referenceImages: false },
      keyConfigured: configuredSecret(config.KIE_API_KEY)
    }
  };
}

function validateUrl(value, key) {
  if (!value) return;
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error(`${key} must use HTTPS`);
  }
}

function serializeEnv(config) {
  const sections = [
    ["Text model", ["FLOW_MODEL_PROVIDER", "FLOW_MODEL_BASE_URL", "FLOW_MODEL_NAME", "FLOW_MODEL_PROTOCOL", "FLOW_LLM_PROFILE_MODE", "FLOW_MODEL_REASONING_CAPABILITY", "FLOW_MODEL_STRUCTURED_RECOVERY", "FLOW_MODEL_TASK_BUDGETS", "FLOW_MODEL_LONG_JSON_GUARDS", "FLOW_MODEL_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY"]],
    ["MiniMax visual understanding", ["MINIMAX_API_HOST", "MINIMAX_API_KEY"]],
    ["RedFox hotspot search", ["FLOW_SEARCH_PROVIDER", "REDFOX_BASE_URL", "REDFOX_API_KEY", "REDFOX_DOUYIN_SEARCH_PATH", "REDFOX_XHS_SEARCH_PATH", "REDFOX_WECHAT_SEARCH_PATH"]],
    ["Kie.ai image generation", ["FLOW_IMAGE_PROVIDER", "KIE_BASE_URL", "KIE_API_KEY", "KIE_IMAGE_MODEL", "KIE_IMAGE_QUALITY"]]
  ];
  return `${sections.map(([title, keys]) => `# ${title}\n${keys.map((key) => `${key}=${String(config[key] || "").replace(/[\r\n]/g, "")}`).join("\n")}`).join("\n\n")}\n`;
}

export async function saveProviderConfig(input = {}) {
  const current = getRawProviderConfig();
  const mapping = {
    modelProvider: "FLOW_MODEL_PROVIDER",
    modelName: "FLOW_MODEL_NAME",
    modelProtocol: "FLOW_MODEL_PROTOCOL",
    modelProfileMode: "FLOW_LLM_PROFILE_MODE",
    modelReasoningCapability: "FLOW_MODEL_REASONING_CAPABILITY",
    modelStructuredRecovery: "FLOW_MODEL_STRUCTURED_RECOVERY",
    modelTaskBudgets: "FLOW_MODEL_TASK_BUDGETS",
    modelLongJsonGuards: "FLOW_MODEL_LONG_JSON_GUARDS",
    searchProvider: "FLOW_SEARCH_PROVIDER",
    redfoxBaseUrl: "REDFOX_BASE_URL",
    redfoxApiKey: "REDFOX_API_KEY",
    imageProvider: "FLOW_IMAGE_PROVIDER",
    kieBaseUrl: "KIE_BASE_URL",
    kieApiKey: "KIE_API_KEY",
    kieImageModel: "KIE_IMAGE_MODEL",
    kieImageQuality: "KIE_IMAGE_QUALITY"
  };
  for (const [inputKey, configKey] of Object.entries(mapping)) {
    const value = typeof input[inputKey] === "string" ? input[inputKey].trim() : "";
    if (value) current[configKey] = value;
  }
  const modelApiKey = typeof input.modelApiKey === "string" ? input.modelApiKey.trim() : "";
  const modelProtocol = String(input.modelProtocol || current.FLOW_MODEL_PROTOCOL || "openai").toLowerCase();
  const modelBaseUrl = typeof input.modelBaseUrl === "string" ? input.modelBaseUrl.trim() : "";
  if (modelBaseUrl) {
    current.FLOW_MODEL_BASE_URL = modelBaseUrl;
    if (modelProtocol === "anthropic") current.ANTHROPIC_BASE_URL = modelBaseUrl;
  }
  if (modelApiKey) {
    current[modelProtocol === "anthropic" ? "ANTHROPIC_API_KEY" : "FLOW_MODEL_API_KEY"] = modelApiKey;
    if (modelProtocol === "anthropic" && String(input.modelProvider || current.FLOW_MODEL_PROVIDER || "").toLowerCase().includes("minimax")) {
      current.MINIMAX_API_KEY = modelApiKey;
    }
  }
  validateUrl(current.FLOW_MODEL_BASE_URL, "Model base URL");
  if (!["profiled", "legacy_structured"].includes(String(current.FLOW_LLM_PROFILE_MODE))) throw new Error("Model profile mode must be profiled or legacy_structured");
  if (!["auto", "unsupported", "thinking_toggle", "always_on", "reasoning_effort", "anthropic_budget"].includes(String(current.FLOW_MODEL_REASONING_CAPABILITY))) throw new Error("Unsupported model reasoning capability");
  if (!["enabled", "disabled"].includes(String(current.FLOW_MODEL_STRUCTURED_RECOVERY))) throw new Error("Model structured recovery must be enabled or disabled");
  if (!["enabled", "disabled"].includes(String(current.FLOW_MODEL_TASK_BUDGETS))) throw new Error("Model task budgets must be enabled or disabled");
  if (!["enabled", "disabled"].includes(String(current.FLOW_MODEL_LONG_JSON_GUARDS))) throw new Error("Model long JSON guards must be enabled or disabled");
  validateUrl(current.REDFOX_BASE_URL, "RedFox base URL");
  validateUrl(current.KIE_BASE_URL, "Kie.ai base URL");
  localConfig = Object.fromEntries([...editableKeys].map((key) => [key, current[key] || ""]));
  await writeFile(configPath, serializeEnv(localConfig), { encoding: "utf8", mode: 0o600 });
  return getPublicProviderConfig();
}
