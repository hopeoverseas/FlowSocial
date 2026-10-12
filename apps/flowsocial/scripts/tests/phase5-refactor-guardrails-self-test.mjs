import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const [mapSource, app, index, server, legacyContentRoutes, flags] = await Promise.all([
  readFile(new URL("docs/architecture/phase5-boundary-map.json", root), "utf8"),
  readFrontendSource(),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("server.mjs", root), "utf8"),
  readFile(new URL("http/legacy-content-routes.mjs", root), "utf8"),
  readFile(new URL("feature-flags.mjs", root), "utf8")
]);
const map = JSON.parse(mapSource);

assert.equal(map.phase, "5A");
assert.equal(new Set(map.frontend.domains.map((item) => item.id)).size, map.frontend.domains.length);
assert.equal(new Set(map.backend.domains.map((item) => item.id)).size, map.backend.domains.length);
for (const gate of ["explicit-user-selection", "provider-cost-approval", "publication-confirmation", "legacy-write-fail-closed"]) {
  assert.ok(map.protectedGates.includes(gate), `missing protected gate ${gate}`);
}

assert.match(index, /<script src="api-client\.js/);
assert.match(index, /<script src="app-foundation\.js/);
assert.match(index, /<script src="app\.js/);
assert.match(index, /<script src="ui\/runtime-status\.js/);
assert.match(index, /<script src="ui\/unified-artifact-workbench\.js/);
assert.match(index, /<script src="ui\/application-bootstrap\.js/);
assert.ok(index.indexOf('src="app.js') < index.indexOf('src="ui/runtime-status.js'));
assert.ok(index.indexOf('src="ui/runtime-status.js') < index.indexOf('src="ui/unified-artifact-workbench.js'));
assert.ok(index.indexOf('src="ui/unified-artifact-workbench.js') < index.indexOf('src="ui/application-bootstrap.js'));
assert.match(app, /UNIFIED_ARTIFACT_REVIEW_WORKBENCH_START/);
assert.match(app, /UNIFIED_ARTIFACT_REVIEW_WORKBENCH_END/);
assert.match(server, /handleLegacyContentRoute\(/);
assert.match(legacyContentRoutes, /atomicPublicationFeedbackUiCutoverV1/);
assert.match(legacyContentRoutes, /Legacy publication writes are disabled by the Atomic UI cutover/);
assert.match(flags, /localContentPromotionV1: enabled\("LOCAL_CONTENT_PROMOTION_V1", false\)/);
assert.doesNotMatch(flags, /LOCAL_CONTENT_PROMOTION_V1", legacyContentPromotion/);

console.log("phase5-refactor-guardrails-self-test: ok");
