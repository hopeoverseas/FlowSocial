import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkillDefinition } from "../skill-runtime.mjs";
import { listSkillAdapters } from "./skill-adapter-registry.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(root, "skills", "skill-manifest.json");

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
}

function cleanWorkflowToken(token) {
  return String(token || "").replace(/\?$/, "").trim();
}

export function buildSkillConformanceReport() {
  const manifest = readManifest();
  const declared = [...(manifest.p0 || []).map((item) => ({ ...item, priority: "p0" })), ...(manifest.p1 || []).map((item) => ({ ...item, priority: "p1" }))];
  const adapters = new Map(listSkillAdapters().map((item) => [item.capability, item]));
  const duplicateNames = declared.map((item) => item.capability).filter((name, index, names) => names.indexOf(name) !== index);
  const capabilities = declared.map((item) => {
    const errors = [];
    const warnings = [];
    let definition = null;
    try {
      definition = loadSkillDefinition(item.capability);
    } catch (error) {
      errors.push(error.message);
    }
    const adapter = adapters.get(item.capability) || null;
    const externalContractName = String(item.output || "").split("@")[0];
    const externalContractExists = externalContractName ? existsSync(join(root, "contracts", `${externalContractName}.md`)) : false;
    if (!item.input) warnings.push("manifest_input_not_declared");
    if (!item.output) errors.push("manifest_output_not_declared");
    if (definition && !definition.instructions.trim()) errors.push("skill_instructions_empty");
    if (definition && item.output?.includes("@") && !definition.contract.trim() && !externalContractExists) warnings.push("versioned_output_without_reference_contract");
    if (adapter && item.input && adapter.inputContract !== item.input) errors.push(`adapter_input_mismatch:${adapter.inputContract}:${item.input}`);
    if (adapter && item.output && adapter.outputContract !== item.output) errors.push(`adapter_output_mismatch:${adapter.outputContract}:${item.output}`);
    if (!adapter && ["build-content-master", "generate-content-outline", "write-xhs-content", "write-wechat-article", "generate-platform-titles", "naturalize-copy", "review-xhs-visuals", "review-wechat-article", "plan-wechat-images", "revise-content-package", "analyze-viral-content", "viral-content-remixer"].includes(item.capability)) warnings.push("content_skill_without_orchestration_adapter");
    const state = item.status === "compatibility_only"
      ? "fallback_only"
      : errors.length
        ? "disabled"
        : warnings.some((warning) => warning === "versioned_output_without_reference_contract")
          ? "contract_pending"
          : "contract_ready";
    return {
      capability: item.capability,
      priority: item.priority,
      state,
      manifestVersion: manifest.schema_version,
      skillVersion: definition?.version || null,
      inputContract: item.input || null,
      outputContract: item.output || null,
      adapter: adapter ? { stage: adapter.stage, platforms: adapter.platforms || [], failurePolicy: adapter.failurePolicy, humanConfirmation: adapter.humanConfirmation } : null,
      errors,
      warnings
    };
  });

  const declaredNames = new Set(declared.map((item) => item.capability));
  const services = new Set([...(manifest.non_skill_services || []), ...(manifest.contract_tokens || [])]);
  const workflowUnknownTokens = [];
  for (const [workflow, steps] of Object.entries(manifest.workflows || {})) {
    for (const raw of steps) {
      for (const token of String(raw).split("|").map(cleanWorkflowToken)) {
        if (!token || declaredNames.has(token) || services.has(token)) continue;
        workflowUnknownTokens.push({ workflow, token });
      }
    }
  }
  const adapterWithoutManifest = [...adapters.keys()].filter((name) => !declaredNames.has(name));
  const errors = [
    ...duplicateNames.map((name) => `duplicate_manifest_capability:${name}`),
    ...adapterWithoutManifest.map((name) => `adapter_without_manifest:${name}`),
    ...capabilities.flatMap((item) => item.errors.map((error) => `${item.capability}:${error}`))
  ];
  const warnings = [
    ...workflowUnknownTokens.map((item) => `unknown_workflow_token:${item.workflow}:${item.token}`),
    ...capabilities.flatMap((item) => item.warnings.map((warning) => `${item.capability}:${warning}`))
  ];
  return {
    schemaVersion: "1.0",
    manifestVersion: manifest.schema_version,
    generatedAt: new Date().toISOString(),
    valid: errors.length === 0,
    summary: {
      total: capabilities.length,
      contractReady: capabilities.filter((item) => item.state === "contract_ready").length,
      contractPending: capabilities.filter((item) => item.state === "contract_pending").length,
      fallbackOnly: capabilities.filter((item) => item.state === "fallback_only").length,
      disabled: capabilities.filter((item) => item.state === "disabled").length,
      retired: (manifest.retired_capabilities || []).length
    },
    capabilities,
    retiredCapabilities: manifest.retired_capabilities || [],
    errors,
    warnings
  };
}
