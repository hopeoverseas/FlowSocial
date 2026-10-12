import { readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";

const readFileAsync = promisify(readFile);
const sources = [
  new URL("../../../app.js", import.meta.url),
  new URL("../../../ui/strategy-adjustment-workbench.js", import.meta.url),
  new URL("../../../ui/runtime-status.js", import.meta.url),
  new URL("../../../ui/unified-artifact-workbench.js", import.meta.url),
  new URL("../../../ui/application-bootstrap.js", import.meta.url)
];

export function readFrontendSourceSync() {
  return sources.map((source) => readFileSync(source, "utf8")).join("\n");
}

export async function readFrontendSource() {
  return (await Promise.all(sources.map((source) => readFileAsync(source, "utf8")))).join("\n");
}
