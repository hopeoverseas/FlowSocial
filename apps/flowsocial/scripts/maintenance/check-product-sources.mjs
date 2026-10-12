import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const excluded = new Set(["node_modules", "data", "tmp", ".tmp", ".runtime-logs", "artifacts"]);
const roots = [
  "content-agent", "contracts", "http", "image-providers", "llm", "scripts/maintenance", "skills", "strategy-agent", "ui"
];
const topLevel = readdirSync(root)
  .filter((name) => name.endsWith(".mjs") || name.endsWith(".js"))
  .map((name) => join(root, name));

function collect(directory, files = []) {
  for (const name of readdirSync(directory)) {
    if (excluded.has(name)) continue;
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) collect(path, files);
    else if (name.endsWith(".mjs") || name.endsWith(".js")) files.push(path);
  }
  return files;
}

const files = [...topLevel, ...roots.flatMap((name) => collect(join(root, name)))].sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${relative(root, file)}\n`);
    process.exit(result.status || 1);
  }
}
console.log(`check-product-sources: ok (${files.length} files)`);
