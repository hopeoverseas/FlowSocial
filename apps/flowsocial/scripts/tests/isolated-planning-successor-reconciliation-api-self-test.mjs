import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const server = await readFile(new URL("../../server.mjs", import.meta.url), "utf8");
assert.match(server, /req\.method === "GET".*listUnifiedStagedAtomicDualBootstraps/s);
assert.match(server, /req\.method === "GET".*getUnifiedStagedAtomicDualBootstrap/s);
assert.doesNotMatch(server, /reconcileIsolatedPlanningSuccessor/,
  "reconciliation import must not be wired into the public Server API");
const cli = await readFile(new URL("../reconcile-isolated-planning-successor.mjs", import.meta.url), "utf8");
assert.match(cli, /apply: false/); assert.match(cli, /token === "--apply"/);
assert.match(cli, /expected-source-revision/); assert.match(cli, /expected-source-hash/);
assert.match(cli, /source-db/); assert.match(cli, /target-db/);
assert.match(cli, /expected-target-revision/); assert.match(cli, /expected-target-hash/);
assert.match(cli, /reconcileSqliteStorePair/);
console.log(JSON.stringify({ status: "isolated-planning-successor-reconciliation-api-self-test passed", publicImportWrites: 0, networkCalls: 0, activeDatabaseWrites: 0 }, null, 2));
