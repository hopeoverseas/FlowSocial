import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CONTENT_CHAIN_AUTHORITY, resolveContentChainWriteAuthority } from "../../content-agent/content-chain-authority.mjs";
import { readFrontendSource } from "./helpers/frontend-source.mjs";

const flags = { unifiedContentPrerequisitesV1: true, unifiedContentStagedAtomicDualBootstrapV1: true };
const unified = resolveContentChainWriteAuthority({ path: "/content-agent/runs", requestedMode: undefined, flags });
assert.deepEqual(unified, { entryMode: "unified", authority: "unified_atomic", path: "/content-agent/runs", canonical: true, compatibilityAlias: false, requiresExplicitOptIn: false, legacyContentRunWriteAllowed: false });
assert.throws(() => resolveContentChainWriteAuthority({ path: "/content-agent/workflows", requestedMode: "unified", flags }), { code: "CONTENT_CHAIN_ENTRY_PATH_UNSUPPORTED" });
assert.throws(() => resolveContentChainWriteAuthority({ path: "/content-agent/runs", requestedMode: "legacy", flags }), (error) => error.code === "LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED" && error.statusCode === 410);
assert.equal(CONTENT_CHAIN_AUTHORITY.legacy.lifecycle, "removed");
assert.deepEqual(CONTENT_CHAIN_AUTHORITY.unified.compatibilityEntryPaths, []);

const [server, api, app] = await Promise.all([readFile(new URL("../../server.mjs", import.meta.url), "utf8"), readFile(new URL("../../api-client.js", import.meta.url), "utf8"), readFrontendSource()]);
assert.match(server, /req\.method === "POST" && path === "\/content-agent\/runs"/);
assert.match(server, /createUnifiedStagedAtomicDualBootstrap/);
assert.doesNotMatch(api, /legacyContentRunWriteRetired|createContentRun:|getContentRun:/);
assert.match(app, /contentProductionNewWechat.*openUnifiedPlatformProductionEntry\("wechat"\)/s);
console.log("content-chain-authority-self-test: ok");
