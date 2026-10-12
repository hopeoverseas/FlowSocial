import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { materializeContentMasterSemanticAuthority } from "../../content-agent/unified-skill-output-contracts.mjs";
import { materializeUnifiedStagedAtomicDualBootstrap } from "../../content-agent/unified-content-server-adapter.mjs";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";

const intentBase = {
  id: "structure-intent:persisted-replay",
  structureType: "ordered_framework",
  requiredUnits: [{ id: "problem", meaning: "Bound the problem.", boundary: "No invented causes." }],
  optionalUnits: [],
  orderingPolicy: { mode: "strict", unitOrder: ["problem"] }
};
const intent = { ...intentBase, intentHash: hashUnifiedContent(intentBase) };
const raw = {
  content_master_id: "master:persisted-replay",
  confirmed_facts: [{ fact_id: "fact:1", fact: "Verified.", source_ids: ["source:1"] }],
  supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "source:1" }],
  semanticUnitIds: ["problem"]
};
const canonical = materializeContentMasterSemanticAuthority(raw, intent);
const serializedCanonical = structuredClone(canonical);
assert.throws(
  () => materializeContentMasterSemanticAuthority(serializedCanonical, intent),
  (error) => error.causeCode === "CONTENT_MASTER_SEMANTIC_UNIT_IDS_REQUIRED"
    && error.details.fieldPaths.includes("data.semanticUnitIds"),
  "an arbitrary canonical clone must remain untrusted raw input"
);
const serverMaster = { schemaVersion: "3.0", contract: "ContentMaster@3.0", id: canonical.content_master_id, ...canonical };

let providerCalls = 0;
const fakeAuthority = { orchestrationInput: { project: { structureIntent: intent } } };
const fakePlanningBase = {
  schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0",
  sharedContentMaster: serverMaster,
  sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(serverMaster) }],
  platformRuns: []
};
const fakePlanning = { ...fakePlanningBase, planningHash: hashUnifiedContent(fakePlanningBase) };
await assert.rejects(
  () => materializeUnifiedStagedAtomicDualBootstrap(
    { unifiedStagedAtomicDualBootstraps: [] },
    { bootstrapId: "forged", authority: fakeAuthority, planning: fakePlanning },
    { generateText: async () => { providerCalls += 1; throw new Error("must not run"); } }
  ),
  (error) => error.code === "UNIFIED_STAGED_ATOMIC_PERSISTED_PLANNING_REQUIRED",
  "self-authored planning hashes must not mint persisted replay trust"
);
assert.equal(providerCalls, 0);

let trustedMaterializerCalls = 0;
let committed = null;
const executor = createUnifiedSkillActivityExecutor({
  generateText: async () => { throw new Error("runner owns this focused path"); },
  evidenceCompiler: {
    compileExecutionEvidence: () => ({}),
    commitCompletedInvocation: (value) => { committed = value; },
    resolveUniqueOutputFact: () => null
  },
  runner: async () => ({ data: { status: "success", data: structuredClone(canonical), warnings: [], blocked_reasons: [] } }),
  runtimeOutputMaterializer: ({ capability, runtimeOutput, sourceSkillInput }) => {
    assert.equal(capability, "build-content-master");
    assert.deepEqual(sourceSkillInput.structureIntent, intent);
    trustedMaterializerCalls += 1;
    return { ...structuredClone(runtimeOutput), data: structuredClone(canonical) };
  }
});
const verifiedReplay = await executor({
  capability: "build-content-master", platform: "xiaohongshu",
  input: { structureIntent: intent },
  step: { id: "master", capability: "build-content-master", outputContract: "ContentMaster@2.0" },
  executionPlan: {}
});
assert.equal(trustedMaterializerCalls, 2, "trusted replay materializer must cover executor materialization and domain validation");
assert.equal(verifiedReplay.contentMaster.contentMasterHash, canonical.contentMasterHash);
assert.equal(committed.verifiedDomainOutput.contentMaster.contentMasterHash, canonical.contentMasterHash);

const persistedProjection = {
  schemaVersion: "1.0", contract: "SharedContentMaster@1.0", id: canonical.content_master_id,
  sourceOutputContract: "ContentMaster@2.0", sourceOutputHash: hashUnifiedContent({ status: "success", data: canonical, warnings: [], blocked_reasons: [] }),
  contentMaster: canonical,
  confirmed_facts: canonical.confirmed_facts,
  supported_interpretations: canonical.supported_interpretations,
  author_opinions: canonical.author_opinions,
  source_list: canonical.source_list
};
assert.deepEqual(
  { ...structuredClone(persistedProjection.contentMaster), schemaVersion: "3.0", contract: "ContentMaster@3.0", id: canonical.content_master_id },
  fakePlanning.sharedContentMaster,
  "production SharedContentMaster output fact must close over the normalized server planning master"
);

const adapterSource = await readFile(fileURLToPath(new URL("../../content-agent/unified-content-server-adapter.mjs", import.meta.url)), "utf8");
assert.doesNotMatch(adapterSource, /semanticUnitIds\s*[:=]/, "resume adapter must not synthesize Provider semanticUnitIds");
assert.match(adapterSource, /trustedPersistedPlanningMaterializers = new WeakMap\(\)/, "persisted trust must be module-private and in-memory");
assert.equal(
  (adapterSource.match(/runtimeOutputMaterializer: trustedPersistedPlanningMaterializers\.get\(store\) \|\| materializeUnifiedSkillRuntimeOutput/g) || []).length,
  2,
  "both planning entry points must bind the private replay materializer to their exact Store instance"
);

console.log(JSON.stringify({
  status: "persisted-master-resume-trust-self-test passed",
  arbitraryCloneRejected: true,
  forgedPersistedReplayRejected: true,
  trustedMaterializerCalls,
  realProviderCalls: providerCalls,
  retries: 0,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  browserCalls: 0,
  platformWrites: 0
}, null, 2));
