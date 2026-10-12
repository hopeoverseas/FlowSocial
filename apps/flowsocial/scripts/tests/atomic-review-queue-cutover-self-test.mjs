import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFrontendSource } from "./helpers/frontend-source.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const [app, history, server] = await Promise.all([
  readFrontendSource(),
  readFile(join(root, "content-agent", "history-index.mjs"), "utf8"),
  readFile(join(root, "server.mjs"), "utf8")
]);

assert.match(history, /schemaVersion:\s*"1\.4"/);
assert.match(history, /authority:\s*"unified_atomic"/);
assert.match(history, /authority:\s*"legacy_content_task"/);
assert.match(history, /atomicPublicationIdentity/);
assert.match(server, /buildContentHistoryIndex\(store,[\s\S]*featureFlags:\s*featureFlags\(\)/);
assert.match(app, /data-v2-review-project=/);
assert.match(app, /data-v2-review-platform=/);
assert.match(app, /openAtomicReviewProject\(projectButton\.dataset\.v2ReviewProject, projectButton\.dataset\.v2ReviewPlatform\)/);
assert.match(app, /await openContentProductionProject\(projectId, platform\)/);
assert.match(app, /setV2LegacyFeedbackReadOnly/);
assert.match(app, /旧链路记录仅供查看/);

const atomicRoute = app.slice(app.indexOf("async function openAtomicReviewProject"), app.indexOf("function routeLegacyPublicationEntryToAtomic"));
assert.doesNotMatch(atomicRoute, /openV2Feedback|recordContentPublication|updateContentPublication|recordPublicationMetrics/);

console.log(JSON.stringify({
  status: "atomic-review-queue-cutover-self-test passed",
  atomicRoute: "project+platform",
  legacyMode: "read_only",
  providerCalls: 0,
  platformActions: 0
}, null, 2));
