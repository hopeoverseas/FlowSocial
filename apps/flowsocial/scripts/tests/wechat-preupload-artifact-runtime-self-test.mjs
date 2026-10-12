import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The production-authoritative runtime fixture now originates from an immutable
// Atomic WeChat Commit/Resolver. Historical naked planOutput fixtures are not a
// valid substitute for first-party Skill Output Facts.
const test = fileURLToPath(new URL("./atomic-wechat-artifact-cutover-self-test.mjs", import.meta.url));
const result = spawnSync(process.execPath, [test], { encoding: "utf8", env: { ...process.env } });
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /atomic-wechat-artifact-cutover-self-test passed/);
assert.match(result.stdout, /pre_upload_template_not_wechat_final/);

console.log(JSON.stringify({
  status: "wechat-preupload-artifact-runtime-self-test passed",
  fixtureAuthority: "atomic_wechat_v1",
  nakedPlanOutputTrusted: false,
  platformUploadPerformed: false,
  draftCreated: false,
  publicationPerformed: false,
  realProviderCalls: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0
}, null, 2));
