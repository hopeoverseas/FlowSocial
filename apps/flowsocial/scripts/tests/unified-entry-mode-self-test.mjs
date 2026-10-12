import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { resolveContentEntryMode } from "../../feature-flags.mjs";
import { readFile } from "node:fs/promises";

const enabled = { unifiedContentPrerequisitesV1: true, unifiedContentStagedAtomicDualBootstrapV1: true };
assert.equal(resolveContentEntryMode(undefined, enabled), "unified");
assert.equal(resolveContentEntryMode("unified", enabled), "unified");
assert.equal(resolveContentEntryMode("legacy", enabled), "legacy");
assert.equal(resolveContentEntryMode("unified", { ...enabled, unifiedContentStagedAtomicDualBootstrapV1: false }), null);
assert.equal(resolveContentEntryMode("unknown", enabled), null);

const api = await readFile(new URL("../../api-client.js", import.meta.url), "utf8");
const app = await readFrontendSource();
const server = await readFile(new URL("../../server.mjs", import.meta.url), "utf8");
assert.match(api, /createUnifiedContentBootstrap/);
assert.match(api, /mode === "legacy"/);
assert.match(api, /call\("\/content-agent\/runs", "createUnifiedContentBootstrap"/);
assert.doesNotMatch(api, /call\("\/unified-content-projects\/bootstrap", "createUnifiedContentBootstrap", \{ method: "POST", body: JSON\.stringify\(\{ entryMode:/);
assert.match(app, /entryMode: "unified"/);
assert.match(server, /UNIFIED_CONTENT_ENTRY_DISABLED/);
assert.match(server, /UNIFIED_CONTENT_ENTRY_REQUEST_INVALID/);
console.log("unified-entry-mode-self-test: passed");
