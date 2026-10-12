import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CONTENT_CHAIN_AUTHORITY, assertLegacyContentRunCompatibilityRemoved, resolveContentChainWriteAuthority } from "../../content-agent/content-chain-authority.mjs";

const flags = { unifiedContentPrerequisitesV1: true, unifiedContentStagedAtomicDualBootstrapV1: true };
const removed = (callback) => assert.throws(callback, (error) => error.code === "LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED" && error.statusCode === 410);
removed(() => assertLegacyContentRunCompatibilityRemoved({ path: "/content-agent/runs/run_1/outline" }));
removed(() => resolveContentChainWriteAuthority({ path: "/content-agent/runs", requestedMode: "legacy", flags }));
assert.equal(CONTENT_CHAIN_AUTHORITY.legacy.lifecycle, "removed");

const [server, api, app, retiredRoutes] = await Promise.all([readFile(new URL("../../server.mjs", import.meta.url), "utf8"), readFile(new URL("../../api-client.js", import.meta.url), "utf8"), readFile(new URL("../../app.js", import.meta.url), "utf8"), readFile(new URL("../../http/retired-content-run-routes.mjs", import.meta.url), "utf8")]);
assert.match(server, /handleRetiredContentRunRoute/);
assert.match(retiredRoutes, /LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED/);
assert.doesNotMatch(server, /contentSourceSelectionMatch|workflowOutlineMatch|workflowConfirmMatch|contentWorkflowMatch|contentRunPlanMatch|contentRunTraceMatch/);
assert.doesNotMatch(api, /legacyContentRunWriteRetired|selectContentRunSources:|getContentRun:/);
assert.doesNotMatch(app, /旧 ContentRun 只读兼容|renderV2RunWorkspace|selectV2Run\(/);
console.log("phase6-legacy-content-run-retirement-self-test: ok (superseded by phase 7 removal)");
