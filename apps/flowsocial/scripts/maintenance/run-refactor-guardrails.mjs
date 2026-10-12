import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const commands = [
  [process.execPath, ["scripts/maintenance/check-product-sources.mjs"]],
  [process.execPath, ["scripts/tests/phase5-refactor-guardrails-self-test.mjs"]],
  [process.execPath, ["scripts/maintenance/run-product-tests.mjs"]]
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("refactor-guardrails: ok");
