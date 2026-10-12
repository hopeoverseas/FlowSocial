import { createHash } from "node:crypto";

export function canonicalUnifiedContent(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalUnifiedContent).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalUnifiedContent(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashUnifiedContent(value) {
  return createHash("sha256").update(canonicalUnifiedContent(value)).digest("hex");
}
