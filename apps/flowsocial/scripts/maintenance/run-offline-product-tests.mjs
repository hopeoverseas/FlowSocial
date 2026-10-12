import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const repository = resolve(root, "../..");
// Inspect presence only. Never load a developer's provider/platform secrets.
const privateNames = [".env", ".env.local", ".platform-integrations.local.json", "provider-config.local.json"];
if ([root, repository].some((directory) => privateNames.some((name) => existsSync(join(directory, name))))) {
  console.error("test:offline requires a clean source checkout without local provider/platform configuration. No configuration was read.");
  process.exit(1);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "flowsocial-offline-tests-"));
const testRoot = join(temporaryRoot, "app");
const dataDirectory = join(temporaryRoot, "runtime");
const sourceDirectories = new Set(["content-agent", "contracts", "defaults", "http", "image-providers", "llm", "scripts", "skills", "strategy-agent", "ui", "tests", "docs"]);
const sourceExtensions = new Set([".mjs", ".js", ".json", ".md", ".yaml", ".yml", ".html", ".css", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".pdf", ".docx"]);
const excludedDirectories = new Set(["data", "node_modules", "artifacts", "uploads", "deliveries", "logs", "runtime", "backups", "tmp", "dist", "build", "coverage", "venv", "__pycache__"]);
function sourceOnly(path) {
  const parts = relative(root, path).split(sep);
  if (parts.some((part) => part.startsWith(".") || excludedDirectories.has(part))) return false;
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return false;
  if (stat.isDirectory()) return true;
  const name = basename(path).toLowerCase();
  if (/credentials|secrets|cookies/.test(name)) return false;
  return stat.isFile() && sourceExtensions.has(extname(name));
}
const environment = {};
// Avoid inheriting provider keys, deployment settings or npm authentication.
for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "ComSpec", "PATHEXT", "TEMP", "TMP", "TMPDIR"]) {
  if (process.env[name]) environment[name] = process.env[name];
}
Object.assign(environment, {
  CI: "1",
  TZ: "UTC",
  LANG: "C.UTF-8",
  FLOWSOCIAL_DATA_DIR: dataDirectory,
  FLOWSOCIAL_TEST_MODE: "1",
  FLOWSOCIAL_DISABLE_SERVER_LISTEN: "1",
  NODE_OPTIONS: `--import=${pathToFileURL(join(testRoot, "scripts/maintenance/offline-network-guard.mjs")).href}`
});

const commands = [
  "scripts/tests/offline-network-guard-self-test.mjs",
  "scripts/maintenance/check-product-sources.mjs",
  "scripts/maintenance/check-architecture-boundaries.mjs",
  "scripts/maintenance/run-product-tests.mjs"
];
let status = 0;
try {
  // Never copy/read the workspace seed, private configuration or runtime data.
  // Tests which create their own DATA_DIR can only fall back to this synthetic seed.
  mkdirSync(testRoot);
  mkdirSync(dataDirectory);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const source = join(root, entry.name);
    if ((entry.isDirectory() && sourceDirectories.has(entry.name)) || (entry.isFile() && sourceOnly(source))) {
      cpSync(source, join(testRoot, entry.name), { recursive: true, filter: sourceOnly });
    }
  }
  mkdirSync(join(testRoot, "data"));
  writeFileSync(join(testRoot, "data/store.json"), JSON.stringify({
    accounts: [], directions: [], keywords: [], hotspots: [], opportunities: [],
    contentTasks: [], imageTasks: [], workflowTemplates: [], workflowRuns: [],
    workflowEvents: [], contentPublications: [], contentPerformanceSnapshots: [], settings: {}
  }));
  symlinkSync(join(root, "node_modules"), join(testRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  console.log("test:offline: isolated source, synthetic seed, no inherited provider configuration");
  for (const command of commands) {
    const result = spawnSync(process.execPath, [command], { cwd: testRoot, env: environment, stdio: "inherit" });
    if (result.error || result.status !== 0) {
      if (result.error) console.error(`Offline test process could not start: ${result.error.code || "unknown"}`);
      status = result.status || 1;
      break;
    }
  }
} finally {
  // This directory was created by this process and contains only test state.
  rmSync(temporaryRoot, { recursive: true, force: true });
}
process.exitCode = status;
