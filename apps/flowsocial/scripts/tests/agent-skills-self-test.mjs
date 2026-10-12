import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const skillsRoot = join(root, "skills");
const skillNames = ["analyze-diagnostic-turn", "synthesize-account-strategy", "generate-monitoring-directions", "analyze-viral-content"];
const manifest = JSON.parse(readFileSync(join(skillsRoot, "skill-manifest.json"), "utf8"));
const registered = new Set([...(manifest.p0 || []), ...(manifest.p1 || [])].map((item) => item.capability));

for (const name of skillNames) {
  assert.match(name, /^[a-z0-9-]{1,63}$/);
  const skillPath = join(skillsRoot, name, "SKILL.md");
  const contractPath = join(skillsRoot, name, "references", "contract.md");
  const agentPath = join(skillsRoot, name, "agents", "openai.yaml");
  assert.equal(existsSync(skillPath), true, `${name}: missing SKILL.md`);
  assert.equal(existsSync(contractPath), true, `${name}: missing contract`);
  assert.equal(existsSync(agentPath), true, `${name}: missing agents/openai.yaml`);
  const skill = readFileSync(skillPath, "utf8");
  const agent = readFileSync(agentPath, "utf8");
  assert.match(skill, new RegExp(`^---\\r?\\nname: ${name}\\r?\\ndescription: .+\\r?\\n---`, "s"), `${name}: invalid frontmatter`);
  assert.doesNotMatch(skill, /\[TODO|TODO:/);
  assert.match(agent, /display_name: "[^"]+"/);
  assert.match(agent, /short_description: "[^"]{25,64}"/);
  assert.match(agent, new RegExp(`default_prompt: ".*\\$${name}.*"`));
  assert.equal(registered.has(name), true, `${name}: not registered in manifest`);
}

assert.equal(manifest.retired_capabilities.includes("classify-domain-signals"), true);
assert.equal(manifest.retired_capabilities.includes("cluster-hotspot-events"), true);
assert.equal(manifest.non_skill_services.includes("SignalRelevanceClassifier"), true);
assert.equal(manifest.non_skill_services.includes("HotspotEventClusterService"), true);

console.log(JSON.stringify({ status: "passed", validated: skillNames.length, manifestVersion: manifest.schema_version }));

