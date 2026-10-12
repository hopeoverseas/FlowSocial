import { readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { getWechatIntegration } from "../platform-integration-config.mjs";
import { createWechatDraft, uploadWechatImageResource } from "../wechat-analytics.mjs";

const clean = (value) => String(value || "").trim();
const imageTypes = Object.freeze({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" });

function fail(code, message = code, statusCode = 409) {
  throw Object.assign(new Error(message), { code, statusCode });
}

function safeRelativePath(value) {
  const relativePath = clean(value).replace(/\\/g, "/");
  if (!relativePath || isAbsolute(relativePath) || /^[a-z]:/i.test(relativePath)
    || relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("ATOMIC_WECHAT_UPLOAD_ASSET_PATH_INVALID", "Upload asset path must be a normalized relative path");
  }
  return relativePath;
}

function imageContentType(relativePath) {
  const contentType = imageTypes[extname(relativePath).toLowerCase()];
  if (!contentType) fail("ATOMIC_WECHAT_UPLOAD_ASSET_TYPE_INVALID", "WeChat upload supports PNG, JPEG, GIF, or WebP assets only");
  return contentType;
}

function inside(parent, child) {
  const path = relative(parent, child);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

export function createWechatUploadAssetReader({ dataRoot }) {
  if (!clean(dataRoot)) fail("ATOMIC_WECHAT_UPLOAD_DATA_ROOT_REQUIRED", "A FlowSocial data root is required");
  const assetsRoot = resolve(dataRoot, "wechat-live-assets");
  return async ({ kind, descriptor, context = {} }) => {
    if (kind !== "html" && kind !== "resource") fail("ATOMIC_WECHAT_UPLOAD_ASSET_KIND_INVALID");
    const projectId = clean(context.contentProjectId);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(projectId)) fail("ATOMIC_WECHAT_UPLOAD_PROJECT_ID_INVALID");
    const relativePath = safeRelativePath(descriptor?.relativePath);
    const projectRoot = resolve(assetsRoot, projectId);
    const absolutePath = resolve(projectRoot, relativePath);
    if (!inside(projectRoot, absolutePath)) fail("ATOMIC_WECHAT_UPLOAD_ASSET_PATH_ESCAPE");
    let canonicalProjectRoot;
    let canonicalPath;
    try {
      [canonicalProjectRoot, canonicalPath] = await Promise.all([realpath(projectRoot), realpath(absolutePath)]);
    } catch (error) {
      if (error?.code === "ENOENT") fail("ATOMIC_WECHAT_UPLOAD_ASSET_MISSING", "Exact upload asset is missing");
      throw error;
    }
    if (!inside(canonicalProjectRoot, canonicalPath)) fail("ATOMIC_WECHAT_UPLOAD_ASSET_PATH_ESCAPE");
    return { bytes: await readFile(canonicalPath), contentType: kind === "html" ? "text/html; charset=utf-8" : imageContentType(relativePath) };
  };
}

export function createWechatResourceUploadTransport({ integrationResolver = getWechatIntegration, uploader = uploadWechatImageResource } = {}) {
  return async ({ accountId, operation, bytes, contentType, relativePath }) => {
    const integration = await integrationResolver(clean(accountId));
    if (!integration?.enabled || !clean(integration.appId) || !clean(integration.appSecret)) {
      fail("ATOMIC_WECHAT_UPLOAD_INTEGRATION_UNAVAILABLE", "WeChat upload integration is unavailable");
    }
    return uploader(integration, {
      operation,
      bytes,
      contentType: contentType || imageContentType(relativePath),
      filename: relativePath?.split("/").at(-1) || "image"
    });
  };
}

export function createWechatDraftTransport({ integrationResolver = getWechatIntegration, creator = createWechatDraft } = {}) {
  return async ({ accountId, draft }) => {
    const integration = await integrationResolver(clean(accountId));
    if (!integration?.enabled || !clean(integration.appId) || !clean(integration.appSecret)) {
      fail("ATOMIC_WECHAT_DRAFT_INTEGRATION_UNAVAILABLE", "WeChat draft integration is unavailable");
    }
    return creator(integration, draft);
  };
}
