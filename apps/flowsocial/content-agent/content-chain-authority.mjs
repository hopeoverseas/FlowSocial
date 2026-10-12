import { resolveContentEntryMode } from "../feature-flags.mjs";

export const CONTENT_CHAIN_AUTHORITY = Object.freeze({
  unified: Object.freeze({
    authority: "unified_atomic",
    canonicalEntryPath: "/content-agent/runs",
    compatibilityEntryPaths: Object.freeze([]),
    requiresExplicitOptIn: false,
    legacyContentRunWriteAllowed: false
  }),
  legacy: Object.freeze({
    authority: "legacy_content_run",
    canonicalEntryPath: null,
    compatibilityEntryPaths: Object.freeze([]),
    requiresExplicitOptIn: false,
    lifecycle: "removed",
    legacyContentRunWriteAllowed: false
  })
});

function fail(code, message, statusCode = 409) {
  throw Object.assign(new Error(message), { code, statusCode });
}

function legacyCompatibilityRemoved(path) {
  fail(
    "LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED",
    `Legacy ContentRun compatibility on ${path || "this route"} has been removed; use the unified atomic content project entry`,
    410
  );
}

export function resolveContentChainWriteAuthority({ path, requestedMode, flags }) {
  if (path !== "/content-agent/runs") fail("CONTENT_CHAIN_ENTRY_PATH_UNSUPPORTED", "Content chain write authority does not own this path");
  const entryMode = resolveContentEntryMode(requestedMode, flags);
  if (!entryMode) fail("UNIFIED_CONTENT_ENTRY_DISABLED", "Unified content entry is disabled");
  if (entryMode === "legacy") legacyCompatibilityRemoved(path);
  const policy = CONTENT_CHAIN_AUTHORITY[entryMode];
  return Object.freeze({
    entryMode,
    authority: policy.authority,
    path,
    canonical: path === policy.canonicalEntryPath,
    compatibilityAlias: policy.compatibilityEntryPaths.includes(path),
    requiresExplicitOptIn: policy.requiresExplicitOptIn,
    legacyContentRunWriteAllowed: policy.legacyContentRunWriteAllowed
  });
}

export function assertLegacyContentRunCompatibilityRemoved({ path } = {}) {
  return legacyCompatibilityRemoved(path);
}
