// Synthetic test-only authority. No storage, configuration files, credentials or network.
// Atomic component builders follow atomic-materialized-commit-v2-self-test.mjs.
import { hashUnifiedContent, withUnifiedContentHash, createUnifiedWriterContext } from "../../../content-agent/unified-content-contracts.mjs";
import {
  createDeterministicAssemblyFactV2,
  createDeterministicCompilerInputRef,
  createDeterministicComponentFact,
  createExecutionAuthorityBinding,
  createSkillActivityInvocation,
  createValidatedComponentFact
} from "../../../content-agent/unified-execution-contracts.mjs";
import {
  validateXhsPostCopy,
  validateXhsFinalTitleBinding,
  validateXhsCarouselPlanV2,
  validateXhsVisualAssetPlan,
  validateXhsTraceabilityV2,
  validateXhsContentPreflightReportV2,
  assembleXhsPostPackageV4,
  validateXhsPostPackageV4
} from "../../../content-agent/xhs-content-components.mjs";
import { compileUnifiedAtomicCandidateUsage } from "../../../content-agent/unified-atomic-candidate-compiler.mjs";
import {
  createUnifiedAtomicContentCommitV2,
  validateUnifiedAtomicContentCommitV2
} from "../../../content-agent/unified-atomic-content-commit-store.mjs";

import { stableHash } from "../../../image-providers/xhs-integrated-page/canonical.mjs";
import { normalizePngCandidate, solidRgbaPng } from "../../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { invokeDesignXhsIntegratedPages } from "../../../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import { validateXhsDesignRuntimeEvidence } from "../../../content-agent/xhs-design-runtime-adapter.mjs";
import { validateIntegratedPageExecutionPlan } from "../../../image-providers/xhs-integrated-page/execution-plan.mjs";
import { createXhsPageRevisionFact, createXhsProviderAttemptFact, validateXhsArtifactFactAppendOnly } from "../../../content-agent/xhs-page-artifact-facts.mjs";


const roles = ["postCopy", "finalTitleBinding", "carouselPlan", "visualAssetPlan", "traceability", "preflightReport"];
const providerRoles = new Set(["postCopy", "carouselPlan", "visualAssetPlan"]);
const hashFields = { postCopy: "componentHash", finalTitleBinding: "bindingHash", carouselPlan: "componentHash", visualAssetPlan: "componentHash", traceability: "traceHash", preflightReport: "reportHash" };
const validators = { postCopy: validateXhsPostCopy, finalTitleBinding: validateXhsFinalTitleBinding, carouselPlan: validateXhsCarouselPlanV2, visualAssetPlan: validateXhsVisualAssetPlan, traceability: validateXhsTraceabilityV2, preflightReport: validateXhsContentPreflightReportV2 };
const ref = (id, token) => ({ id, hash: token.repeat(64).slice(0, 64) });
const bare = (value) => ({ id: value.id, hash: value.hash });

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function hashed(draft, field) {
  return freeze({ ...draft, [field]: hashUnifiedContent(draft) });
}

function componentRef(component, field = "componentHash") {
  return { id: component.id, hash: component[field] };
}

function buildProject() {
  const master = {
    schemaVersion: "1.0", contract: "SharedContentMasterRef@1.0", id: "master", hash: "5".repeat(64),
    authorityContract: "ContentMaster@3.0", authorityType: "shared_content_master"
  };
  const platformRun = {
    schemaVersion: "1.0", contract: "PlatformRunRef@1.0", id: "platform-run", hash: "4".repeat(64),
    platform: "xiaohongshu", accountId: "account", sharedContentMasterRef: master,
    platformBriefRef: ref("brief", "6"), outlineRef: ref("outline", "7"), writerInvocationRef: ref("writer-invocation", "8"),
    candidateRefs: [], finalVersionRef: null
  };
  const project = withUnifiedContentHash({
    schemaVersion: "1.0", contract: "ContentProject@1.0", id: "content-project", companyId: "company",
    contentOpportunityRef: ref("opportunity", "1"), activeStrategySnapshotRef: ref("strategy", "2"),
    sharedContentMasterRef: master, platformRuns: [platformRun], state: "candidate_ready",
    createdAt: "2026-08-07T03:00:00.000Z", projectHash: ""
  }, "projectHash");
  return freeze(project);
}

function buildComponents(authority) {
  const sectionRoles = [
    ["hook", "scene", "cover"], ["problem", "problem", "problem"], ["diagnosis", "conclusion", "conclusion"],
    ["evidence", "evidence", "evidence"], ["method", "method", "method"], ["action", "summary", "cta"]
  ];
  const postCopy = hashed({
    schemaVersion: "1.0", contract: "XhsPostCopy@1.0", id: "post-copy", authorityBinding: authority,
    contentPromise: "six useful steps", engagementStrategy: { mode: "auto", primaryAction: "save", reason: "useful reference", ctaPlacement: "ending", ctaText: "save this" },
    titleCandidates: [
      { title: "Balanced title", hookType: "checklist", claimIds: ["fact-1"], risk: "low" },
      { title: "Problem title", hookType: "problem", claimIds: ["fact-1"], risk: "low" },
      { title: "Question title", hookType: "question", claimIds: ["fact-1"], risk: "medium" }
    ], recommendedTitle: "Balanced title", opening: "A practical opening.",
    bodySections: sectionRoles.map(([outlineRole, role], index) => ({ sectionId: `section-${index + 1}`, outlineRole, role, text: `Unique section ${index + 1}`, claimIds: ["fact-1"], knowledgeAssetIds: [] })),
    ending: "Save this checklist.", pinnedComment: "", hashtags: ["workflow", "content", "quality"], cta: "save this", promotionUse: { mode: "none", itemIds: [], disclosure: "" }
  }, "componentHash");
  const finalTitleBinding = hashed({
    schemaVersion: "1.0", contract: "XhsFinalTitleBinding@1.0", id: "final-title", authorityBinding: authority,
    postCopyRef: componentRef(postCopy), titleOutputRef: ref("title-output", "9"), recommendation: "balanced",
    titleId: "title-balanced", title: "Balanced title", claimIds: ["fact-1"]
  }, "bindingHash");
  const carouselPlan = hashed({
    schemaVersion: "2.0", contract: "XhsCarouselPlan@2.0", id: "carousel", authorityBinding: authority,
    postCopyRef: componentRef(postCopy), finalTitleBindingRef: componentRef(finalTitleBinding, "bindingHash"), deckId: "deck",
    canvas: { width: 1080, height: 1440, ratio: "3:4" }, designDnaVersion: "dna-v1", readingArc: "problem to action",
    pages: sectionRoles.map(([outlineRole, , role], index) => ({
      page: index + 1, outlineSectionId: `section-${index + 1}`, outlineRole, role, objective: `Objective ${index + 1}`,
      takeaway: `Takeaway ${index + 1}`, textLayers: [{ type: "headline", text: index === 0 ? "Balanced title" : `Page ${index + 1}`, maxLines: 2, priority: 1 }],
      layoutHint: "clean", factIds: ["fact-1"], interpretationIds: [], knowledgeAssetIds: [], mustAvoid: []
    }))
  }, "componentHash");
  const visualAssetPlan = hashed({
    schemaVersion: "1.0", contract: "XhsVisualAssetPlan@1.0", id: "visual", authorityBinding: authority,
    carouselPlanRef: componentRef(carouselPlan), designDnaVersion: "dna-v1",
    pageVisuals: sectionRoles.map((_, index) => ({ page: index + 1, visualFunction: "none", visualNeed: "", renderStrategy: "html_css", mustKeep: [], mustAvoid: [] })),
    imageSpecs: [], skippedPages: sectionRoles.map((_, index) => ({ page: index + 1, reason: "html_css" })),
    authorizedReferenceAssets: [], pageAssetBindings: sectionRoles.map((_, index) => ({ page: index + 1, plannedAssetIds: [] }))
  }, "componentHash");
  const traceability = hashed({
    schemaVersion: "2.0", contract: "XhsTraceability@2.0", id: "trace", authorityBinding: authority,
    componentRefs: { postCopy: componentRef(postCopy), finalTitleBinding: componentRef(finalTitleBinding, "bindingHash"), carouselPlan: componentRef(carouselPlan), visualAssetPlan: componentRef(visualAssetPlan) },
    titleClaimIds: ["fact-1"], usedFactIds: ["fact-1"], usedInterpretationIds: [], usedKnowledgeAssetIds: [], usedReferenceAssetIds: [],
    pageClaimMap: sectionRoles.map((_, index) => ({ page: index + 1, claimIds: ["fact-1"] }))
  }, "traceHash");
  const checks = ["authority_binding", "component_hash_integrity", "final_title_binding", "confirmed_outline_binding", "page_order_and_role", "cross_page_repetition", "copy_carousel_intent_alignment", "promotion_policy", "visual_reference_authorization", "traceability_integrity"];
  const preflightReport = hashed({
    schemaVersion: "2.0", contract: "XhsContentPreflightReport@2.0", id: "preflight", authorityBinding: authority,
    componentRefs: { postCopy: componentRef(postCopy), finalTitleBinding: componentRef(finalTitleBinding, "bindingHash"), carouselPlan: componentRef(carouselPlan), visualAssetPlan: componentRef(visualAssetPlan) },
    traceabilityRef: componentRef(traceability, "traceHash"), checks: checks.map((check) => ({ check, result: "pass", detail: "verified" })), status: "passed"
  }, "reportHash");
  return freeze({ postCopy, finalTitleBinding, carouselPlan, visualAssetPlan, traceability, preflightReport });
}

function decision(sourceRef) {
  return freeze(withUnifiedContentHash({
    schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "decision", companyId: "company",
    projectInputRef: ref("project-input", "a"), activeStrategySnapshotRef: ref("strategy", "2"),
    taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
    mechanisms: [{ mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated", candidates: [{ sourceRef, status: "selected", reason: "fixture" }], reason: "fixture", factPolicy: null }],
    selectedSourceRefs: [sourceRef], strategyHotspotPolicy: "disabled", deviation: { status: "none", reason: null, confirmationEventRef: null },
    decidedAt: "2026-08-07T03:00:00.000Z", decisionHash: ""
  }, "decisionHash"));
}

function buildCommit() {
  const contentProject = buildProject();
  const identityDraft = {
    id: contentProject.id, companyId: contentProject.companyId,
    contentOpportunityRef: contentProject.contentOpportunityRef, activeStrategySnapshotRef: contentProject.activeStrategySnapshotRef
  };
  const contentProjectIdentity = freeze({ ...identityDraft, identityHash: hashUnifiedContent(identityDraft) });
  const contentProjectRef = { id: contentProjectIdentity.id, hash: contentProjectIdentity.identityHash };
  const platformRunRef = bare(contentProject.platformRuns[0]);
  const masterRef = bare(contentProject.sharedContentMasterRef);
  const sourceRef = ref("source", "b");
  const mechanismDecision = decision(sourceRef);
  const mechanismDecisionRef = { id: mechanismDecision.id, hash: mechanismDecision.decisionHash };
  const strategySnapshot = freeze({ id: "account-strategy", payload: { creativeMechanism: "checklist" } });
  const writerContext = createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "xiaohongshu", account_id: "account",
    topic_id: "topic", intent_profile_id: "intent", content_purpose_id: "purpose",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "discovery", trust_source: "institution" },
    creative_mechanism: "checklist", journey_stage: "discover", coordination_mode: "standalone",
    matrix_coordination: { shared_campaign_topic_id: "", differentiation_angle: "fixture", prohibited_overlap: [] },
    authority_refs: { accountStrategyRef: { id: strategySnapshot.id, hash: hashUnifiedContent(strategySnapshot) }, mechanismDecisionRef }
  });
  const writerContextRef = { id: "writer-context", hash: writerContext.writerContextHash };
  const componentAuthority = freeze({
    companyId: "company", accountId: "account", activeStrategySnapshotRef: contentProject.activeStrategySnapshotRef,
    contentOpportunityRef: contentProject.contentOpportunityRef, mechanismDecisionRef, contentProjectRef, platformRunRef,
    sharedContentMasterRef: masterRef, platformBriefRef: ref("brief", "6"), confirmedOutlineRef: ref("outline", "7"),
    writerContextRef, designDnaRef: ref("dna", "c")
  });
  const executionAuthority = createExecutionAuthorityBinding({
    family: "atomic_v2", companyId: "company", accountId: "account",
    refs: Object.entries(componentAuthority).filter(([key]) => key.endsWith("Ref")).map(([role, value]) => ({ role, ref: value }))
  });
  const components = buildComponents(componentAuthority);
  const facts = {};
  for (const role of roles) {
    const component = components[role];
    if (providerRoles.has(role)) {
      const invocation = createSkillActivityInvocation({
        id: `invocation-${role}`, skill: { name: `skill-${role}`, version: "1.0.0" }, inputRef: ref(`input-${role}`, "d"),
        authorityBinding: executionAuthority, planHash: "e".repeat(64)
      });
      facts[role] = createValidatedComponentFact({
        id: `fact-${role}`, invocation, componentRole: role, component, componentHashField: hashFields[role],
        validateComponent: validators[role], validator: { name: `validate-${role}`, version: "1.0.0" }, rawProviderEnvelopeRef: ref(`raw-${role}`, "f")
      });
    } else {
      const upstreamFacts = [{ kind: "provider_component", role: "postCopy", fact: facts.postCopy }];
      const input = freeze({ role });
      const inputRef = createDeterministicCompilerInputRef({ id: `input-${role}`, input, upstreamFacts, authorityBinding: executionAuthority });
      facts[role] = createDeterministicComponentFact({
        id: `fact-${role}`, producer: { name: `compile-${role}`, version: "1.0.0", authorityBinding: executionAuthority },
        input, inputRef, upstreamFacts, componentRole: role, compiler: () => component, validateComponent: validators[role],
        validator: { name: `validate-${role}`, version: "1.0.0" }, componentHashField: hashFields[role]
      }).fact;
    }
  }
  const materializedComponents = roles.map((role) => ({
    role, kind: providerRoles.has(role) ? "provider_component" : "deterministic_component",
    fact: facts[role], component: components[role], componentHashField: hashFields[role]
  }));
  const assembly = createDeterministicAssemblyFactV2({
    id: "package", componentEntries: materializedComponents.map(({ role, fact, component, componentHashField }) => ({ role, fact, component, componentHashField })),
    assemblySpec: { name: "assembleXhsPostPackageV4", version: "1.0.0", requiredRoles: roles, outputContract: "XhsPostPackage@4.0" },
    assembler: ({ id, components: value }) => assembleXhsPostPackageV4({ id, ...value }),
    validateAssembly: validateXhsPostPackageV4, assemblyHashField: "packageHash"
  });
  const componentFacts = materializedComponents.map(({ role, kind, fact }) => ({ role, kind, fact }));
  const graphBase = {
    schemaVersion: "1.0", contract: "UnifiedAtomicFactGraph@1.0", id: "graph", authorityBinding: executionAuthority,
    activityRefs: ["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets"].map((capability, index) => ({ capability, bundleRef: ref(`bundle-${index}`, "9") })),
    componentFactRefs: materializedComponents.map(({ role, kind, fact }) => ({ role, kind, factRef: { id: fact.id, hash: fact.factHash }, componentRef: fact.componentRef })),
    titleUpstreamRef: ref("title", "a"), assemblyFactRef: { id: assembly.fact.id, hash: assembly.fact.factHash }
  };
  const graph = freeze({ ...graphBase, graphHash: hashUnifiedContent(graphBase) });
  const sourcePlan = freeze({ schemaVersion: "1.0", mode: "knowledge", frozenSourceRefs: [sourceRef], sources: [{ sourceRef, candidateIds: [sourceRef.id] }] });
  const sourcePlanRef = { id: "source-plan", hash: hashUnifiedContent(sourcePlan) };
  const candidateUsage = compileUnifiedAtomicCandidateUsage({
    factGraphCompilation: freeze({ assembly, deterministicFacts: { traceability: { component: components.traceability } } }),
    compilerContexts: freeze([{ capability: "write-xhs-post-copy", input: { mechanism_decision: mechanismDecision, mechanism_decision_ref: mechanismDecisionRef, source_plan: sourcePlan, source_plan_ref: sourcePlanRef, writer_context: writerContext } }]),
    orchestrationSnapshot: freeze({ platformRuns: [{ platform: "xiaohongshu", platformRunRef }] }), strategySnapshot,
    existingConfirmationEvents: [], boundAt: "2026-08-07T03:01:00.000Z"
  });
  return createUnifiedAtomicContentCommitV2({
    id: "materialized-commit", idempotencyKey: "materialized-key", contentProjectIdentity, contentProject, platform: "xiaohongshu", graph,
    componentFacts, materializedComponents, assemblyFact: assembly.fact, assemblyOutput: assembly.assemblyOutput,
    usageBinding: candidateUsage.usageBinding, mechanismExplanation: candidateUsage.mechanismExplanation, candidate: candidateUsage.candidate
  });
}


const at = "2026-08-18T00:00:00.000Z";
const fixtureRef = (id, value = id) => ({ id, hash: stableHash(value) });
const stableFact = (value) => ({ ...value, factHash: stableHash(value) });

function designEvidence(commit) {
  const component = (role) => commit.materializedComponents.find((entry) => entry.role === role).component;
  const postCopy = component("postCopy");
  const carouselPlan = component("carouselPlan");
  const runtimeInput = {
    schemaVersion: "1.0", contract: "DesignXhsIntegratedPagesRuntimeInput@1.0", id: "light-revision-runtime:fixture", contentVersion: 1,
    xhsPostPackage: { status: "success", data: { platform: "xiaohongshu", post_copy: { cta: postCopy.cta }, deck: {
      pages: carouselPlan.pages.map((page) => ({ page: page.page, role: page.role,
        text_layers: page.textLayers.map((layer) => ({ type: layer.type, text: layer.text })),
        fact_ids: [...page.factIds], interpretation_ids: [...page.interpretationIds], must_avoid: [...page.mustAvoid] }))
    } } },
    designDna: { snapshotId: "dna-v1", palette: ["ink", "cream"], typographyRoles: ["headline", "body"], constraints: ["fixture only"] },
    authorizedAssets: [], providerCapability: { integratedChineseTypography: true, exactDimensions: true, referenceImages: false },
    pageDensity: Object.fromEntries(carouselPlan.pages.map((page) => [`P${page.page}`, "low"])),
    visualSelection: { stylePackId: "editorial-metaphor", reason: "offline synthetic fixture", pages: carouselPlan.pages.map((page) => ({
      pageId: `P${page.page}`, archetypeId: "cover.promise", patternIds: ["pattern.hierarchy.promise-focus"], referenceAssetIds: [],
      verbatimTextOverride: null, stylePackId: null
    })) }
  };
  const skillInvocation = invokeDesignXhsIntegratedPages(runtimeInput);
  const plan = { kind: "UnifiedSkillExecutionPlan@fixture", platform: "xiaohongshu", authorization: { mode: "strict" },
    steps: [{ id: "visual_design", capability: "design-xhs-integrated-pages", createdAt: at }] };
  const bindings = {
    xhsPostPackageRef: componentRef(commit.assemblyOutput, "packageHash"), sharedContentMasterRef: bare(commit.contentProject.sharedContentMasterRef),
    platformRunRef: commit.platformRunRef, candidateRef: componentRef(commit.candidate, "candidateHash"),
    visualSelectionRef: fixtureRef(`${runtimeInput.id}:visual-selection`, runtimeInput.visualSelection)
  };
  const outputs = { skillInvocation, promptSetHash: skillInvocation.promptSetHash, integratedPageExecutionPlan: null };
  const base = {
    schemaVersion: "1.0", contract: "XhsVisualDesignRuntimeEvidence@1.0", id: "xhs-design-evidence:light-revision:fixture",
    capability: "design-xhs-integrated-pages", stage: "visual_design", platform: "xiaohongshu", status: "prompt_set_ready",
    executionMode: "deterministic_adapter", authorization: { mode: "strict", planRef: { kind: plan.kind, platform: plan.platform, hash: stableHash(plan) },
      stepRef: { id: "visual_design", capability: "design-xhs-integrated-pages", hash: stableHash(plan.steps[0]) } },
    bindings, outputs,
    hashes: { bundleHash: stableHash({ skill: skillInvocation.skill, libraryRefs: skillInvocation.libraryRefs, referenceDocs: skillInvocation.referenceDocs }),
      libraryHashes: skillInvocation.libraryRefs, inputHash: stableHash({ bindings, runtimeInputRef: skillInvocation.runtimeInputRef }),
      outputHash: stableHash(outputs), planHash: stableHash(plan), providerExecutionPlanHash: null },
    boundary: { counters: { networkCalls: 0, providerCalls: 0, retries: 0, cost: 0, databaseWrites: 0 }, pageRevisionRefs: [],
      selectionAuthority: false, deliveryBundleCreated: false, publicationPerformed: false },
    productionEligible: false, nextGate: "ProviderExecutionPlanningInputsRequired"
  };
  const evidence = { ...base, evidenceHash: stableHash(base) };
  validateXhsDesignRuntimeEvidence(evidence);
  return evidence;
}

function executionPlan(evidence) {
  const provider = { id: "fixture-provider", model: "fixture-model", adapter: { id: "fixture-adapter", version: "1.0", projectionKey: "fixture" },
    lifecycle: "fixture", createEndpoint: "/fixture", requestFields: [] };
  const renderPrompt = (sections) => [
    ["页面语义", sections.pageSemantics], ["视觉媒介", sections.visualMedium], ["构图与层级", sections.composition],
    ["材质空间光影", sections.materialSpaceLight], ["跨页统一", sections.crossPageRules], ["逐字真值", sections.verbatimText],
    ["负面约束", sections.negativeConstraints]
  ].map(([label, values]) => `${label}：\n${values.map((item) => `- ${item}`).join("\n")}`).join("\n\n");
  const pages = evidence.outputs.skillInvocation.promptSet.pagePromptSpecs.map((spec) => {
    const promptSections = { pageSemantics: [spec.contentTruth.headline], visualMedium: ["fixture only"], composition: ["fixture only"],
      materialSpaceLight: ["fixture only"], crossPageRules: ["fixture only"], verbatimText: [...spec.promptBlocks.verbatimText], negativeConstraints: ["fixture only"] };
    const base = { pageId: spec.pageId, contentTruthRef: fixtureRef(`${spec.id}:truth`, spec.contentTruth),
      assetBindings: { archetype: fixtureRef(spec.pageArchetypeId), stylePack: fixtureRef(evidence.outputs.skillInvocation.promptSet.visualStyleSelection.stylePackId), patterns: [], referenceAssets: [] },
      legacyCompiler: { requestRef: fixtureRef(`${spec.id}:request`), traceRef: fixtureRef(`${spec.id}:trace`), originalBlockerCodes: [], reclassifiedBlockerCodes: [] },
      promptSections, providerRequest: { endpoint: "/fixture", method: "POST", body: { model: provider.model, input: { prompt: renderPrompt(promptSections) } }, requestFields: [] },
      nativeDimensionQualification: { dimensions: { width: 1080, height: 1440 }, status: "exact" },
      deliveryQualification: { target: { width: 1080, height: 1440 }, status: "pending_post_normalization_gates", normalizationMode: "none" }, estimatedCost: 1, blockers: [] };
    return { ...base, pageHash: stableHash(base) };
  });
  const base = { schemaVersion: "1.0", contract: "IntegratedPageExecutionPlan@1.0", id: "fixture-plan:light-revision", mode: "isolated_experimental",
    skillBinding: { invocationHash: evidence.outputs.skillInvocation.invocationHash, promptSetRef: { id: evidence.outputs.skillInvocation.promptSet.id, hash: evidence.outputs.skillInvocation.promptSetHash } },
    reviewBinding: fixtureRef("fixture-review"), capabilitySnapshotRef: fixtureRef("fixture-capability"), registrySnapshotRef: fixtureRef("fixture-registry"), provider,
    cost: { status: "confirmed", confirmationHash: stableHash("fixture-cost-confirmation"), currency: "CNY", estimatedTotal: pages.length, approvedMaxTotal: 10 },
    pages, states: { provider: "not_called", userSelection: "not_selected", delivery: "not_delivered" }, productionEligible: false,
    execution: { status: "ready_for_isolated_provider_execution", networkCalls: 0, providerCalls: 0, retries: 0, actualCost: 0, databaseWrites: 0, featureFlag: "fixture_only" },
    inputHash: stableHash({ fixture: evidence.evidenceHash }) };
  const plan = { ...base, planHash: stableHash(base) };
  validateIntegratedPageExecutionPlan(plan);
  return plan;
}

export function createXhsLightRevisionFixture() {
  const commit = buildCommit();
  validateUnifiedAtomicContentCommitV2(commit);
  const evidence = designEvidence(commit);
  const plan = executionPlan(evidence);
  const scope = { workspaceId: "light-revision-fixture", companyId: commit.companyId, accountId: commit.accountId,
    contentProjectRef: commit.contentProjectRef, materializedContentProjectRef: commit.materializedContentProjectRef,
    platformRunRef: commit.platformRunRef, candidateRef: componentRef(commit.candidate, "candidateHash") };
  const designFact = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsDesignArtifactFact@1.0", id: "xhs-design-fact:light-revision:fixture",
    ...scope, platform: "xiaohongshu", evidence, providerApprovalEligible: false, pageRevisionRefs: [], selectionAuthority: false,
    finalBundleAuthority: false, publicationPerformed: false, idempotencyKey: "fixture-design", requestHash: stableHash("fixture-design"), recordedAt: at }, "factHash");
  const providerPlan = stableFact({ schemaVersion: "1.0", contract: "UnifiedXhsProviderPlanFact@1.0", id: "provider-plan-fact:light-revision:fixture",
    ...scope, designEvidenceRef: componentRef(evidence, "evidenceHash"),
    promptSetRef: { id: evidence.outputs.skillInvocation.promptSet.id, hash: evidence.outputs.skillInvocation.promptSetHash }, plan,
    providerApprovalEligible: true, nextGate: "HumanProviderExecutionApproval" });
  const attempts = [];
  const revisions = [];
  for (const page of plan.pages) {
    const normalization = normalizePngCandidate({ id: `normalization:fixture:${page.pageId}`, candidateRef: fixtureRef(`page:fixture:${page.pageId}`),
      sourceBuffer: solidRgbaPng(1080, 1440, [20, 40, 60, 255]), sourceRelativePath: `fixture/raw/${page.pageId}.png`,
      outputRelativePath: `fixture/normalized/${page.pageId}.png`, mode: "none", protectedRegions: [], createdAt: at });
    const common = { ...scope, designEvidenceRef: providerPlan.designEvidenceRef, planRef: componentRef(plan, "planHash"), pageId: page.pageId,
      pageRef: { id: `${plan.id}:${page.pageId}`, hash: page.pageHash }, approvalRef: fixtureRef("approval:fixture"),
      providerRef: fixtureRef("provider:fixture", plan.provider), budgetRef: fixtureRef("budget:fixture"), provider: "fixture-provider", model: "fixture-model",
      idempotencyKey: `fixture-initial:${page.pageId}`, executionRequestHash: stableHash(`fixture-initial:${page.pageId}`),
      transport: { kind: "injected", networked: false, context: { mode: "fixture", networked: false } },
      selectionAuthority: false, finalBundleAuthority: false, publicationPerformed: false, recordedAt: at };
    const attempt = createXhsProviderAttemptFact({ ...common, id: `attempt:fixture:${page.pageId}:a1`, attempt: 1,
      requestHash: stableHash(page.providerRequest), status: "succeeded", taskId: `fixture-task:${page.pageId}`, rawAsset: normalization.record.inputAsset,
      normalization: { status: "succeeded", recordHash: normalization.record.recordHash, outputAsset: normalization.record.outputAsset, blockers: [] }, cost: 0, error: null });
    attempts.push(attempt);
    revisions.push(createXhsPageRevisionFact({ ...common, id: `revision:fixture:${page.pageId}:r1`, revision: 1,
      sourceAttemptRef: componentRef(attempt, "attemptHash"), rawAsset: normalization.record.inputAsset,
      normalizedAsset: normalization.record.outputAsset, normalizationRef: componentRef(normalization.record, "recordHash"),
      status: "artifact_review_required", reviewable: true, selectable: false, createdAt: at }));
  }
  validateXhsArtifactFactAppendOnly({ attempts, revisions });
  const store = { accounts: [
    { id: scope.companyId, companyId: scope.companyId, workspaceId: scope.workspaceId, accountType: "company" },
    { id: scope.accountId, socialAccountId: scope.accountId, companyId: scope.companyId, workspaceId: scope.workspaceId, accountType: "social", platform: "xiaohongshu" }
  ], unifiedAtomicContentCommits: [commit], unifiedContentXhsDesignFacts: [designFact], unifiedContentXhsProviderPlanFacts: [providerPlan],
    unifiedContentXhsProviderAttemptFacts: attempts, unifiedContentXhsPageRevisionFacts: revisions };
  return structuredClone(store);
}
