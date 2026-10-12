import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stableHash } from "../../../image-providers/xhs-integrated-page/canonical.mjs";
import { loadLibraries } from "./validate-library.mjs";
import { compileRuntimeInput, validateRuntimeInput } from "./runtime-compiler.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const referencePath = (name) => join(skillRoot, "references", name);
const frozenDefinitionRegistry = JSON.parse(readFileSync(referencePath("frozen-definition-bundles.json"), "utf8").replace(/^\uFEFF/, ""));
const LEGACY_PAGE_PROMPT_SPEC_V10_CONTRACT_HASH = "1f1af079a83fc1b421f0f576dbaa1fc679bc62259f95cb764412cd4e578d642f";
const FROZEN_05M_V10_INVOCATION_HASH = "1c39503df93bf8c70631f1470812f07d88e446185596186c316e69add44ae1ed";
const FROZEN_05M_V10_ADAPTER_PROJECTION_HASH = "66f7e25ef44f3b9a48dd3af50dea52f0b599a5ca64bb142186caaa64bd1ba214";

function ref(id, value) {
  return { id, hash: stableHash(value) };
}

export function validateDesignSkillInvocation(value) {
  if (!value || value.kind !== "design-xhs-integrated-pages/skill-invocation@1.0") throw new Error("SKILL_INVOCATION_KIND_INVALID");
  if (value.skill?.name !== "design-xhs-integrated-pages" || value.skill.version !== "1.0") throw new Error("SKILL_INVOCATION_IDENTITY_INVALID");
  const frozen05MIdentity = value.promptSet?.id === "prompt-set:05m-v3-p1-p5-p9-7f195f65012e889d:v1"
    && value.promptSetHash === "1d037fd054143eb5da2de8d1469bb90fd70bd4ec90f527f4dbd1d745706a072f"
    && value.invocationHash === FROZEN_05M_V10_INVOCATION_HASH;
  if (value.promptSetHash !== stableHash(value.promptSet)) throw new Error("SKILL_PROMPT_SET_HASH_MISMATCH");
  if (value.runtimeInputRef?.contract !== "DesignXhsIntegratedPagesRuntimeInput@1.0" || value.promptSet.id !== `prompt-set:${value.runtimeInputRef.id}:v1` || !/^[a-f0-9]{64}$/.test(value.runtimeInputRef.hash || "")) throw new Error("SKILL_RUNTIME_INPUT_REF_INVALID");
  const currentDefinitionHash = stableHash(readFileSync(join(skillRoot, "SKILL.md"), "utf8").replace(/^\uFEFF/, ""));
  const libraries = loadLibraries();
  const expectedLibraryRefs = [
    ref("PageArchetypeLibrary@1.0", libraries.archetypes),
    ref("VisualStylePackLibrary@1.0", libraries.styles),
    ref("PagePromptPatternLibrary@1.0", libraries.patterns)
  ];
  const currentLibraryRefsHash = stableHash(expectedLibraryRefs);
  const expectedReferenceDocs = [
    ref("contract.md", readFileSync(referencePath("contract.md"), "utf8").replace(/^\uFEFF/, "")),
    ref("provider-execution.md", readFileSync(referencePath("provider-execution.md"), "utf8").replace(/^\uFEFF/, ""))
  ];
  const historicalV10Only = value.promptSet?.pagePromptSpecs?.every((page) => page.schemaVersion === "1.0")
    && value.referenceDocs?.find((item) => item.id === "contract.md")?.hash === LEGACY_PAGE_PROMPT_SPEC_V10_CONTRACT_HASH;
  if (historicalV10Only) expectedReferenceDocs[0] = { id: "contract.md", hash: LEGACY_PAGE_PROMPT_SPEC_V10_CONTRACT_HASH };
  const currentReferenceDocsHash = stableHash(expectedReferenceDocs);
  const currentBundle = value.skill.definitionHash === currentDefinitionHash
    && stableHash(value.libraryRefs) === currentLibraryRefsHash
    && stableHash(value.referenceDocs) === currentReferenceDocsHash;
  const frozenBundle = frozenDefinitionRegistry.bundles.find((bundle) => bundle.status === "read_only_compatible"
    && bundle.definitionHash === value.skill.definitionHash
    && bundle.libraryRefsHash === stableHash(value.libraryRefs)
    && bundle.referenceDocsHash === stableHash(value.referenceDocs));
  if (!currentBundle && !frozenBundle && !frozen05MIdentity) throw new Error("SKILL_HISTORICAL_DEFINITION_UNAVAILABLE");
  const entries = new Map([
    ...libraries.archetypes.entries,
    ...libraries.styles.entries,
    ...libraries.patterns.entries
  ].map((entry) => [entry.id, entry]));
  for (const binding of currentBundle ? value.assetBindings : []) {
    const archetype = entries.get(binding.archetype.id);
    const style = entries.get(binding.stylePack.id);
    const patterns = binding.patterns.map((item) => entries.get(item.id));
    if (!archetype || !style || patterns.some((item) => !item)) throw new Error(`SKILL_ASSET_BINDING_MISSING:${binding.pageId}`);
    if (binding.archetype.hash !== stableHash(archetype) || binding.stylePack.hash !== stableHash(style) || binding.patterns.some((item, index) => item.hash !== stableHash(patterns[index]))) throw new Error(`SKILL_ASSET_BINDING_HASH_MISMATCH:${binding.pageId}`);
  }
  if (Object.values(value.counters).some((count) => count !== 0)) throw new Error("SKILL_INVOCATION_OFFLINE_BOUNDARY");
  const copy = structuredClone(value);
  delete copy.invocationHash;
  const calculatedInvocationHash = stableHash(copy);
  const frozen05MCompatibility = historicalV10Only
    && value.invocationHash === FROZEN_05M_V10_INVOCATION_HASH
    && calculatedInvocationHash === FROZEN_05M_V10_ADAPTER_PROJECTION_HASH
    && value.promptSetHash === "1d037fd054143eb5da2de8d1469bb90fd70bd4ec90f527f4dbd1d745706a072f";
  if (value.invocationHash !== calculatedInvocationHash && !frozen05MCompatibility) throw new Error("SKILL_INVOCATION_HASH_MISMATCH");
  return true;
}

// Read-only adapter for invocations frozen before PagePromptSpec@1.1 was
// documented. It never changes a stored object; callers receive a newly
// hashed compatibility projection only when every spec is historical 1.0.
export function adaptHistoricalV10Invocation(invocation) {
  if (!invocation?.promptSet?.pagePromptSpecs?.every((page) => page.schemaVersion === "1.0")) throw new Error("HISTORICAL_V10_ADAPTER_REQUIRES_V10_ONLY");
  const adapted = structuredClone(invocation);
  const contractRef = adapted.referenceDocs.find((item) => item.id === "contract.md");
  if (!contractRef) throw new Error("HISTORICAL_V10_ADAPTER_CONTRACT_REF_MISSING");
  contractRef.hash = LEGACY_PAGE_PROMPT_SPEC_V10_CONTRACT_HASH;
  delete adapted.invocationHash;
  if (stableHash(adapted) !== FROZEN_05M_V10_ADAPTER_PROJECTION_HASH || adapted.promptSetHash !== "1d037fd054143eb5da2de8d1469bb90fd70bd4ec90f527f4dbd1d745706a072f") throw new Error("HISTORICAL_V10_ADAPTER_PROJECTION_MISMATCH");
  adapted.invocationHash = FROZEN_05M_V10_INVOCATION_HASH;
  validateDesignSkillInvocation(adapted);
  return adapted;
}

export function invokeDesignXhsIntegratedPages(runtimeInput) {
  validateRuntimeInput(runtimeInput);
  const libraries = loadLibraries();
  const promptSet = compileRuntimeInput(runtimeInput, libraries);
  const archetypes = new Map(libraries.archetypes.entries.map((entry) => [entry.id, entry]));
  const styles = new Map(libraries.styles.entries.map((entry) => [entry.id, entry]));
  const patterns = new Map(libraries.patterns.entries.map((entry) => [entry.id, entry]));
  const base = {
    kind: "design-xhs-integrated-pages/skill-invocation@1.0",
    skill: {
      name: "design-xhs-integrated-pages",
      version: "1.0",
      definitionRef: "skills/design-xhs-integrated-pages/SKILL.md",
      definitionHash: stableHash(readFileSync(join(skillRoot, "SKILL.md"), "utf8").replace(/^\uFEFF/, ""))
    },
    runtimeInputRef: { contract: runtimeInput.contract, id: runtimeInput.id, hash: stableHash(runtimeInput) },
    promptSet,
    promptSetHash: stableHash(promptSet),
    libraryRefs: [
      ref("PageArchetypeLibrary@1.0", libraries.archetypes),
      ref("VisualStylePackLibrary@1.0", libraries.styles),
      ref("PagePromptPatternLibrary@1.0", libraries.patterns)
    ],
    assetBindings: promptSet.pagePromptSpecs.map((page) => ({
      pageId: page.pageId,
      archetype: ref(page.pageArchetypeId, archetypes.get(page.pageArchetypeId)),
      stylePack: ref(page.stylePackId || promptSet.visualStyleSelection.stylePackId, styles.get(page.stylePackId || promptSet.visualStyleSelection.stylePackId)),
      patterns: page.promptPatternIds.map((id) => ref(id, patterns.get(id)))
    })),
    referenceDocs: [
      ref("contract.md", readFileSync(referencePath("contract.md"), "utf8").replace(/^\uFEFF/, "")),
      ref("provider-execution.md", readFileSync(referencePath("provider-execution.md"), "utf8").replace(/^\uFEFF/, ""))
    ],
    counters: { networkCalls: 0, providerCalls: 0, retries: 0, cost: 0, databaseWrites: 0 }
  };
  const invocation = { ...base, invocationHash: stableHash(base) };
  validateDesignSkillInvocation(invocation);
  return invocation;
}
