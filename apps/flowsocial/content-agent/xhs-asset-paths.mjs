import { createHash } from "node:crypto";

const clean = (value) => String(value ?? "").trim();
const digest = (value, length = 20) => createHash("sha256").update(clean(value)).digest("hex").slice(0, length);
const segment = (value, fallback) => clean(value).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 16) || fallback;
const extension = (value) => {
  const normalized = clean(value).toLowerCase().replace(/^\.+/, "");
  return /^[a-z0-9]{1,8}$/.test(normalized) ? normalized : "bin";
};

export const XHS_COMPACT_PATH_SCHEME = "compact-v1";
export const XHS_COMPACT_PATH_PREFIX = `xhs/${XHS_COMPACT_PATH_SCHEME}`;

export function compactXhsAssetPaths({ candidateRef, pageId, attempt, operationKey, rawExtension = "bin" } = {}) {
  if (!candidateRef?.id && !candidateRef?.hash) throw new Error("XHS_COMPACT_PATH_CANDIDATE_REF_REQUIRED");
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("XHS_COMPACT_PATH_ATTEMPT_REQUIRED");
  const candidateToken = digest(candidateRef.hash || candidateRef.id);
  const pageToken = `${segment(pageId, "page")}-${digest(pageId, 6)}`;
  const operationToken = digest(operationKey || `${candidateRef.id}:${pageId}:${attempt}`, 12);
  const base = `${XHS_COMPACT_PATH_PREFIX}/c-${candidateToken}/p-${pageToken}/a-${attempt}-${operationToken}`;
  const ext = extension(rawExtension);
  return {
    pathScheme: XHS_COMPACT_PATH_SCHEME,
    raw: `${base}/raw.${ext}`,
    decoded: `${base}/decoded.png`,
    normalized: `${base}/normalized.png`
  };
}

export function compactXhsFallbackBase(attemptRef) {
  return `provider/compact-v1/a-${digest(JSON.stringify(attemptRef || {}), 24)}`;
}

export function isCompactXhsAssetPath(value) {
  return clean(value).replace(/\\/g, "/").startsWith(`${XHS_COMPACT_PATH_PREFIX}/`);
}
