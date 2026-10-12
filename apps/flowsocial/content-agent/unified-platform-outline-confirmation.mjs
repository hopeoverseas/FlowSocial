import { hashUnifiedContent } from "./unified-content-contracts.mjs";

const COLLECTION = "unifiedContentPlatformOutlineConfirmations";
const PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const HASH = /^[a-f0-9]{64}$/;

function fail(code, message, statusCode = 400) {
  throw Object.assign(new Error(message), { code, statusCode });
}

function ensureCollection(store) {
  store[COLLECTION] ||= [];
  return store[COLLECTION];
}

function sameRef(left, right) {
  return Boolean(left?.id && right?.id && left.id === right.id && left.hash === right.hash);
}

function publicFact(fact) {
  return structuredClone(fact);
}

export function listUnifiedPlatformOutlineConfirmations(store, bootstrap) {
  if (!bootstrap?.id) fail("UNIFIED_PLATFORM_OUTLINE_BOOTSTRAP_REQUIRED", "内容项目大纲任务不存在", 404);
  const current = ensureCollection(store)
    .filter((fact) => fact.bootstrapId === bootstrap.id)
    .filter((fact) => sameRef(fact.outlineRef, bootstrap.outlineRefs?.[fact.platform]));
  const requiredPlatforms = PLATFORMS.has(bootstrap.targetPlatform) ? [bootstrap.targetPlatform] : [...PLATFORMS];
  return {
    bootstrapId: bootstrap.id,
    state: bootstrap.state,
    confirmations: Object.fromEntries(current.map((fact) => [fact.platform, publicFact(fact)])),
    allConfirmed: requiredPlatforms.every((platform) => current.some((fact) => fact.platform === platform))
  };
}

export function confirmUnifiedPlatformOutline(store, bootstrap, platform, input = {}) {
  if (!bootstrap?.id) fail("UNIFIED_PLATFORM_OUTLINE_BOOTSTRAP_REQUIRED", "内容项目大纲任务不存在", 404);
  if (!PLATFORMS.has(platform)) fail("UNIFIED_PLATFORM_OUTLINE_PLATFORM_INVALID", "不支持的平台", 404);
  if (bootstrap.state !== "awaiting_outline_confirmation") {
    fail("UNIFIED_PLATFORM_OUTLINE_STATE_INVALID", "当前大纲状态不能再次确认", 409);
  }
  const expectedRef = bootstrap.outlineRefs?.[platform];
  if (!expectedRef?.id || !HASH.test(expectedRef.hash || "") || !sameRef(input.outlineRef, expectedRef)) {
    fail("UNIFIED_PLATFORM_OUTLINE_STALE", "页面上的大纲版本已经变化，请刷新后重新核对", 409);
  }
  if (input.actor?.type !== "user" || !String(input.actor?.id || "").trim()) {
    fail("UNIFIED_PLATFORM_OUTLINE_ACTOR_REQUIRED", "需要明确记录确认人");
  }
  if (!String(input.idempotencyKey || "").trim()) {
    fail("UNIFIED_PLATFORM_OUTLINE_IDEMPOTENCY_REQUIRED", "确认请求缺少幂等键");
  }
  const confirmedAt = String(input.confirmedAt || "");
  if (!Number.isFinite(Date.parse(confirmedAt))) fail("UNIFIED_PLATFORM_OUTLINE_TIME_INVALID", "确认时间无效");
  const collection = ensureCollection(store);
  const semantic = {
    bootstrapId: bootstrap.id,
    platform,
    outlineRef: structuredClone(expectedRef),
    actor: { type: "user", id: String(input.actor.id).trim() },
    confirmedAt
  };
  // Confirmation timestamps are audit metadata, not request identity. A browser
  // retry naturally gets a new timestamp but must still replay the same
  // idempotency key; hashing it would incorrectly turn a safe retry into a
  // conflict.
  const semanticHash = hashUnifiedContent({
    bootstrapId: semantic.bootstrapId,
    platform: semantic.platform,
    outlineRef: semantic.outlineRef,
    actor: semantic.actor
  });
  const replay = collection.find((fact) => fact.idempotencyKey === input.idempotencyKey);
  if (replay) {
    if (replay.semanticHash !== semanticHash) fail("UNIFIED_PLATFORM_OUTLINE_IDEMPOTENCY_CONFLICT", "该确认请求已用于其他版本", 409);
    return { created: false, fact: publicFact(replay), ...listUnifiedPlatformOutlineConfirmations(store, bootstrap) };
  }
  const existing = collection.find((fact) => fact.bootstrapId === bootstrap.id && fact.platform === platform && sameRef(fact.outlineRef, expectedRef));
  if (existing) return { created: false, fact: publicFact(existing), ...listUnifiedPlatformOutlineConfirmations(store, bootstrap) };
  const base = {
    schemaVersion: "1.0",
    contract: "UnifiedPlatformOutlineConfirmation@1.0",
    id: `platform-outline-confirmation:${semanticHash.slice(0, 32)}`,
    idempotencyKey: String(input.idempotencyKey).trim(),
    semanticHash,
    ...semantic
  };
  const fact = { ...base, factHash: hashUnifiedContent(base) };
  collection.push(fact);
  return { created: true, fact: publicFact(fact), ...listUnifiedPlatformOutlineConfirmations(store, bootstrap) };
}
