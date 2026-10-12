import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFrontendSourceSync();
const startup = app.slice(app.lastIndexOf("refreshRuntimeStatus();"));
const accountHydration = startup.indexOf("loadGenerationAccounts().then(() => {");
const initialViewLoad = startup.indexOf("switchView(resolvedInitialView)");

assert.ok(accountHydration >= 0, "startup must hydrate social accounts");
assert.ok(initialViewLoad > accountHydration, "initial view must load after account hydration");
assert.match(startup, /loadGenerationAccounts\(\)\.then\(\(\) => \{[\s\S]*switchView\(resolvedInitialView\)/);
assert.match(startup, /resolvedInitialView === "plan" \? Promise\.resolve\(\) : loadV2Plan\(\)/);
assert.doesNotMatch(startup.slice(0, accountHydration), /switchView\(resolvedInitialView\)/);

console.log("initial-account-hydration-ui-self-test: ok");
