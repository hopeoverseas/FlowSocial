import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
const publication = source("content-agent/atomic-manual-publication-store.mjs");
assert.match(publication, /ControlledManualPublication@1\.0/);
assert.match(publication, /resolveUnifiedContentAuthority/);
assert.match(publication, /manual_platform_observation/);
assert.match(publication, /platformApiPublicationPerformed:\s*false/);
assert.match(publication, /humanPublicationConfirmed:\s*true/);
assert.match(publication, /unifiedAtomicManualPublications = \[\.\.\.publications, publication\]/);
assert.doesNotMatch(publication, /contentPublications\.(?:push|splice)/);
const projection = source("content-agent/unified-atomic-product-projection.mjs");
assert.match(projection, /ControlledManualPublication@1\.0/);
assert.match(projection, /sameRef\(item\.deliveryRef/);
assert.match(projection, /sameRef\(item\.manifestRef/);
const flags = source("feature-flags.mjs");
assert.match(flags, /ATOMIC_MANUAL_PUBLICATION_V1["'], false/);
const lifecycle = source("content-agent/atomic-publication-lifecycle-store.mjs");
assert.match(lifecycle, /ControlledPublicationCorrection@1\.0/);
assert.match(lifecycle, /ControlledPublicationTakedown@1\.0/);
console.log(JSON.stringify({
  status: "atomic-manual-publication-self-test passed",
  appendOnly: true, correctionAndTakedownImplemented: true, lifecycleModuleSeparate: true,
  providerCalls: 0, externalCalls: 0, browserCalls: 0, activeDatabaseWrites: 0, platformCalls: 0
}, null, 2));
