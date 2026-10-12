import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function collect(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) collect(path, files);
    else if (name.endsWith(".mjs") || name.endsWith(".js")) files.push(path);
  }
  return files;
}

function imports(source) {
  return [...source.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/g)].map((match) => match[2]);
}

const violations = [];
const boundaries = [
  {
    directory: "contracts",
    forbidden: ["content-agent", "strategy-agent", "http", "ui"],
    reason: "contract kernel must not depend on domain or delivery layers"
  },
  {
    directory: "content-agent",
    forbidden: ["strategy-agent"],
    forbiddenFiles: ["server.mjs"],
    reason: "content domain may not import the strategy domain or composition root"
  },
  {
    directory: "strategy-agent",
    forbidden: ["content-agent"],
    forbiddenFiles: ["server.mjs"],
    reason: "strategy domain may not import the content domain or composition root"
  }
];

for (const boundary of boundaries) {
  const directory = join(root, boundary.directory);
  for (const file of collect(directory)) {
    for (const specifier of imports(readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".")) continue;
      const target = resolve(file, "..", specifier);
      const targetRelative = relative(root, target);
      const forbidden = boundary.forbidden.find((name) => targetRelative === name || targetRelative.startsWith(`${name}${sep}`));
      const forbiddenFile = boundary.forbiddenFiles?.includes(targetRelative);
      if (forbidden || forbiddenFile) violations.push(`${relative(root, file)} -> ${specifier}: ${boundary.reason}`);
    }
  }
}

if (violations.length) {
  process.stderr.write(`architecture boundary violations:\n${violations.map((item) => `- ${item}`).join("\n")}\n`);
  process.exit(1);
}

console.log("check-architecture-boundaries: ok");
