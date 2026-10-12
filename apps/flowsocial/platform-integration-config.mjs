import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const configPath = join(root, ".platform-integrations.local.json");

async function readConfig() {
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function publicWechatConfig(accountId, config = {}) {
  return {
    accountId,
    platform: "wechat",
    enabled: config.enabled !== false,
    appId: config.appId || "",
    appSecretConfigured: Boolean(config.appSecret),
    syncDays: Number(config.syncDays || 7),
    updatedAt: config.updatedAt || null
  };
}

export async function getWechatIntegration(accountId) {
  const config = await readConfig();
  return config.wechat?.[accountId] || null;
}

export async function listPublicPlatformIntegrations() {
  const config = await readConfig();
  return {
    wechat: Object.entries(config.wechat || {}).map(([accountId, item]) => publicWechatConfig(accountId, item))
  };
}

export async function saveWechatIntegration(accountId, input = {}) {
  const config = await readConfig();
  config.wechat ||= {};
  const current = config.wechat[accountId] || {};
  const appId = String(input.appId || current.appId || "").trim();
  const appSecret = String(input.appSecret || current.appSecret || "").trim();
  if (!appId) throw Object.assign(new Error("AppID 不能为空"), { statusCode: 400 });
  if (!appSecret) throw Object.assign(new Error("AppSecret 不能为空"), { statusCode: 400 });
  const next = {
    appId,
    appSecret,
    enabled: input.enabled !== false,
    syncDays: Math.min(Math.max(Number(input.syncDays || current.syncDays || 7), 1), 30),
    updatedAt: new Date().toISOString()
  };
  config.wechat[accountId] = next;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return publicWechatConfig(accountId, next);
}

export function toPublicWechatIntegration(accountId, config) {
  return publicWechatConfig(accountId, config || {});
}
