import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isRetiredContentRunRoute, RETIRED_CONTENT_RUN_RESPONSE } from "../../http/retired-content-run-routes.mjs";

for (const [method, path] of [
  ["POST", "/content-agent/workflows"],
  ["GET", "/content-agent/runs/run_1"],
  ["GET", "/content-agent/runs/run_1/trace"],
  ["POST", "/content-agent/runs/run_1/outline"],
  ["POST", "/content-agent/publishing-cycles/cycle_1/slots/slot_1/runs"],
  ["POST", "/content-tasks/generate"]
]) assert.equal(isRetiredContentRunRoute(method, path), true, `${method} ${path} must be removed`);
assert.equal(isRetiredContentRunRoute("POST", "/content-agent/runs"), false, "canonical unified bootstrap must remain available");
assert.equal(RETIRED_CONTENT_RUN_RESPONSE.statusCode, 410);
assert.equal(RETIRED_CONTENT_RUN_RESPONSE.code, "LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED");

const [server, app, api, index] = await Promise.all([
  readFile(new URL("../../server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../app.js", import.meta.url), "utf8"),
  readFile(new URL("../../api-client.js", import.meta.url), "utf8"),
  readFile(new URL("../../index.html", import.meta.url), "utf8")
]);
assert.doesNotMatch(index, /data-view="runs"/);
assert.doesNotMatch(app, /renderV2RunWorkspace|loadDeepLinkedContentWorkflow|FlowAPI\.createContentRun\(|FlowAPI\.generateContent\(/);
assert.doesNotMatch(api, /legacyContentRunWriteRetired|getContentRun:|createContentRun:/);
assert.doesNotMatch(server, /contentWorkflowMatch|contentSourceSelectionMatch|workflowOutlineMatch|contentRunTraceMatch/);
assert.ok(server.split(/\r?\n/).length < 4750, "server composition root must stay below the phase 7 ceiling");
assert.ok(app.split(/\r?\n/).length < 4550, "frontend composition root must stay below the phase 7 ceiling");
console.log("phase7-content-run-removal-self-test: ok");
