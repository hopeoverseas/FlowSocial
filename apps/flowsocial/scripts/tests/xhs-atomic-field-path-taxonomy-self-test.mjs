import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  EXPLICITLY_REJECTED_XHS_ATOMIC_RUNTIME_FIELD_PATHS,
  sanitizeUnifiedSkillValidationFieldPaths
} from "../../content-agent/unified-skill-output-contracts.mjs";

const runtimePath = fileURLToPath(new URL("../../content-agent/xhs-atomic-skill-runtime.mjs", import.meta.url));
const source = await readFile(runtimePath, "utf8");
const inventory = [...new Set([...source.matchAll(/\[\s*"((?:\$\.|system\.|system$|capability)[^"]*)"\s*,/g)].map((match) => match[1]))].sort();
assert.equal(inventory.length, 62, "Runtime static failure-path inventory changed; classify every new path explicitly");

const rejected = new Set(EXPLICITLY_REJECTED_XHS_ATOMIC_RUNTIME_FIELD_PATHS);
const classifications = inventory.map((path) => ({ path, projected: sanitizeUnifiedSkillValidationFieldPaths([path]) }));
for (const { path, projected } of classifications) {
  if (rejected.has(path)) assert.deepEqual(projected, [], `${path} must remain explicitly rejected`);
  else assert.equal(projected.length, 1, `${path} is missing a safe taxonomy mapping`);
}
assert.match(source, /fail\(capability, \["capability"\], "XHS_ATOMIC_SKILL_UNSUPPORTED"\)/);
assert.deepEqual(sanitizeUnifiedSkillValidationFieldPaths([...rejected]), []);

const authorityPaths = classifications.filter(({ path }) => path === "system" || path.startsWith("system."));
assert.ok(authorityPaths.length > 0);
assert.ok(authorityPaths.every(({ projected }) => projected[0] === "system.authority"));
assert.equal(JSON.stringify(authorityPaths.map(({ projected }) => projected)).match(/[a-f0-9]{64}|secret|prompt|value/i), null);

const carouselPaths = [
  "$", "$.status", "$.warnings", "$.blocked_reasons", "$.data", "$.data.schemaVersion", "$.data.contract",
  "$.data.pages", "$.data.pages.length", "$.data.pages[]", "$.data.pages[].text_layers",
  "$.data.pages[].text_layers[]", "$.data.pages[].takeaway", "$.data.pages[0].text_layers",
  "$.data.fact_ids", "$.data.interpretation_ids", "$.data.knowledge_asset_ids",
  "system.postCopy", "system.finalTitleContext.binding", "system.authorizedFactIds",
  "system.authorizedInterpretationIds", "system.authorizedKnowledgeAssetIds"
];
assert.ok(carouselPaths.every((path) => sanitizeUnifiedSkillValidationFieldPaths([path]).length === 1));

console.log(JSON.stringify({
  status: "xhs-atomic-field-path-taxonomy-self-test passed",
  runtimeInventory: inventory.length,
  safeMappings: inventory.length - rejected.size,
  explicitRejects: rejected.size,
  authorityProjection: "system.authority",
  providerCalls: 0,
  retries: 0,
  externalEffects: 0
}, null, 2));
