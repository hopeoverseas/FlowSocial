import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(appRoot, "skills");
const manifestPath = join(skillsRoot, "skill-manifest.json");

function readUtf8(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function hashSkillEvidence(value) {
  const serialized = JSON.stringify(canonicalize(value));
  return digest(serialized === undefined ? "undefined" : serialized);
}

export function validateSkillBundleDeclaration({ skillName, folder, bundleFiles }) {
  if (!Array.isArray(bundleFiles) || !bundleFiles.length) throw new Error(`Skill 未声明 reference_bundle：${skillName}`);
  const seen = new Set();
  const realFolder = realpathSync(folder);
  const bundle = bundleFiles.map((declaredPath) => {
    if (typeof declaredPath !== "string" || !declaredPath.trim() || isAbsolute(declaredPath)) throw new Error(`Skill bundle 路径无效：${skillName}`);
    const normalized = declaredPath.replaceAll("\\", "/");
    const absolutePath = resolve(folder, normalized);
    const relativePath = relative(folder, absolutePath);
    if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) throw new Error(`Skill bundle 路径越界：${skillName}/${declaredPath}`);
    if (seen.has(normalized)) throw new Error(`Skill bundle 文件重复：${skillName}/${normalized}`);
    seen.add(normalized);
    if (!existsSync(absolutePath)) throw new Error(`Skill bundle 文件不存在：${skillName}/${normalized}`);
    const realPath = realpathSync(absolutePath);
    const realRelativePath = relative(realFolder, realPath);
    if (!realRelativePath || realRelativePath === ".." || realRelativePath.startsWith(`..${sep}`) || isAbsolute(realRelativePath)) throw new Error(`Skill bundle 路径越界：${skillName}/${declaredPath}`);
    return { path: normalized, absolutePath: realPath, content: readUtf8(realPath) };
  });
  if (!bundle.some((item) => item.path === "SKILL.md")) throw new Error(`Skill reference_bundle 缺少 SKILL.md：${skillName}`);
  return bundle;
}

function manifest() {
  return JSON.parse(readUtf8(manifestPath));
}

export function loadSkillDefinition(skillName) {
  const registry = manifest();
  const declared = [...(registry.p0 || []), ...(registry.p1 || [])].find((item) => item.capability === skillName);
  if (!declared) throw new Error(`Skill 未在 manifest 注册：${skillName}`);
  const folder = join(skillsRoot, skillName);
  const bundle = validateSkillBundleDeclaration({ skillName, folder, bundleFiles: declared.reference_bundle });
  const skill = bundle.find((item) => item.path === "SKILL.md");
  const contractEntry = bundle.find((item) => item.path === "references/contract.md");
  const instructions = skill.content;
  const contract = contractEntry?.content || "";
  const bundleHash = hashSkillEvidence(bundle.map(({ path, content }) => ({ path, content })));
  const version = `${registry.schema_version || "1.0.0"}-${bundleHash.slice(0, 16)}`;
  return {
    name: skillName,
    version,
    manifestVersion: registry.schema_version || "1.0.0",
    declared,
    instructions,
    contract,
    bundleHash,
    referenceBundle: bundle.map(({ path, content }) => ({ path, content })),
    paths: { skill: skill.absolutePath, contract: contractEntry?.absolutePath || null, bundle: bundle.map(({ absolutePath }) => absolutePath) }
  };
}

export async function executeSkill({ skillName, input, generateText, fallback = null, expectedContract = null, task = null }) {
  if (typeof generateText !== "function") throw new Error(`Skill ${skillName} 缺少 LLM 执行器`);
  const definition = loadSkillDefinition(skillName);
  const startedAt = new Date().toISOString();
  const request = {
    task: task || `execute_skill:${skillName}`,
    contract: expectedContract || definition.declared.output || null,
    skill_runtime: {
      skill_name: definition.name,
      skill_version: definition.version,
      manifest_version: definition.manifestVersion,
      lifecycle: definition.declared.lifecycle,
      bundle_hash: definition.bundleHash,
      execution_policy: [
        "产品编排器拥有工作流控制权；只执行当前 Skill，不启动其他 Skill 或完整工作流",
        "严格遵守当前 Skill 的输入、输出和边界",
        "只返回当前输出合同要求的一个 JSON 对象"
      ]
    },
    skill_instructions: definition.instructions,
    skill_contract: definition.contract,
    skill_reference_bundle: definition.referenceBundle,
    expected_contract: expectedContract || definition.declared.output || null,
    input
  };
  const result = await generateText(request, fallback);
  const completedAt = new Date().toISOString();
  const inputHash = hashSkillEvidence(input);
  const outputHash = hashSkillEvidence(result?.data ?? null);
  return {
    ...result,
    skillTrace: {
      skillName: definition.name,
      skillVersion: definition.version,
      expectedContract: request.expected_contract,
      bundleHash: definition.bundleHash,
      inputHash,
      outputHash,
      providerMode: result?.mode || "unknown",
      startedAt,
      completedAt
    }
  };
}

export function getSkillRuntimeStatus() {
  const registry = manifest();
  const legacyWorkflows = registry.workflows || {};
  const declaredSkills = [...(registry.p0 || []), ...(registry.p1 || [])];
  return {
    manifestVersion: registry.schema_version || "1.0.0",
    skillsRoot,
    registered: declaredSkills.map((item) => item.capability),
    productProfile: registry.product_profile || null,
    conditionalCapabilities: declaredSkills.filter((item) => item.lifecycle === "stable_conditional").map((item) => ({
      capability: item.capability,
      lifecycle: item.lifecycle,
      productTier: item.product_tier || null,
      productProfiles: item.product_profiles || [],
      featureFlag: item.feature_flag || null,
      executionFeatureFlag: item.execution_feature_flag || null
    })),
    // Compatibility: `workflows` remains the stable legacy projection for
    // existing diagnostics consumers. Product-mode observability is additive
    // and names the atomic pipeline explicitly so it cannot be confused with
    // the legacy ContentRun/XhsHtmlRenderer graph.
    workflows: legacyWorkflows,
    legacyWorkflows,
    unifiedAtomicWorkflows: {
      shared_planning_pipeline: [
        "ActiveStrategySnapshotV2", "UnifiedContentPrerequisite", "build-content-master",
        "generate-content-outline:xiaohongshu", "generate-content-outline:wechat",
        "UnifiedPlatformOutlineConfirmation"
      ],
      xhs_atomic_product_pipeline: [
        "write-xhs-post-copy", "generate-platform-titles", "plan-xhs-carousel",
        "XhsPostPackageV4Assembler", "design-xhs-integrated-pages",
        "UnifiedXhsProviderPlan", "HumanProviderExecutionApproval", "ImageProviderAdapter",
        "XhsPageArtifactRevisionFact", "UnifiedXhsHumanVisualConfirmationFact",
        "ArtifactReview", "ContentReview", "UserSelection", "LocalContentPromotion", "AtomicXhsFinalDeliveryRecord"
      ],
      wechat_atomic_product_pipeline: [
        "write-wechat-article", "review-wechat-article", "plan-wechat-images",
        "UnifiedAtomicWechatCommit", "WechatProductionControl", "WechatPreuploadArtifact",
        "PreuploadArtifactReview", "EditorialReview", "UserSelection", "LocalContentPromotion", "LocalPackageDelivery"
      ]
    },
    workflowProjectionVersion: "2.0"
  };
}
