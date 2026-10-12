import assert from "node:assert/strict";
import { hashUnifiedContent, withUnifiedContentHash, createUnifiedWriterContext } from "../../content-agent/unified-content-contracts.mjs";
import {
  createDeterministicAssemblyFactV2,
  createDeterministicCompilerInputRef,
  createDeterministicComponentFact,
  createExecutionAuthorityBinding,
  createSkillActivityInvocation,
  createValidatedComponentFact
} from "../../content-agent/unified-execution-contracts.mjs";
import {
  validateXhsPostCopy,
  validateXhsFinalTitleBinding,
  validateXhsCarouselPlanV2,
  validateXhsVisualAssetPlan,
  validateXhsTraceabilityV2,
  validateXhsContentPreflightReportV2,
  assembleXhsPostPackageV4,
  validateXhsPostPackageV4
} from "../../content-agent/xhs-content-components.mjs";
import { compileUnifiedAtomicCandidateUsage } from "../../content-agent/unified-atomic-candidate-compiler.mjs";
import {
  createUnifiedAtomicContentCommitV2,
  createUnifiedAtomicContentCommitStore,
  validateUnifiedAtomicContentCommitV2
} from "../../content-agent/unified-atomic-content-commit-store.mjs";

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

function rehash(commit) {
  const copy = structuredClone(commit);
  delete copy.commitHash;
  return { ...copy, commitHash: hashUnifiedContent(copy) };
}

const commit = buildCommit();
validateUnifiedAtomicContentCommitV2(commit);
assert.ok(Object.isFrozen(commit) && Object.isFrozen(commit.contentProject) && Object.isFrozen(commit.materializedComponents[0].component));
assert.notEqual(commit.contentProjectRef.hash, commit.materializedContentProjectRef.hash, "pre-execution identity and final project refs must remain distinct");
assert.equal(buildCommit().commitHash, commit.commitHash, "v2 hash must be stable");
assert.equal(commit.materializedComponents.length, 6);
assert.deepEqual(commit.materializedComponents.map((item) => item.role), roles);
const roundTrip = JSON.parse(JSON.stringify(commit));
assert.doesNotThrow(() => validateUnifiedAtomicContentCommitV2(roundTrip));
for (const role of roles) assert.deepEqual(roundTrip.materializedComponents.find((item) => item.role === role).component, commit.materializedComponents.find((item) => item.role === role).component);
assert.deepEqual(roundTrip.assemblyOutput, commit.assemblyOutput);

const mutations = [
  ["project", (value) => { value.contentProject.state = "draft"; }],
  ["project extra", (value) => { value.contentProject.extra = true; }],
  ["identity", (value) => { value.contentProjectIdentity.companyId = "other"; }],
  ["identity extra", (value) => { value.contentProjectIdentity.extra = true; }],
  ["identity missing", (value) => { delete value.contentProjectIdentity.activeStrategySnapshotRef; }],
  ["identity ref", (value) => { value.contentProjectRef.hash = "0".repeat(64); }],
  ["materialized project ref", (value) => { value.materializedContentProjectRef.hash = "0".repeat(64); }],
  ["assembly output", (value) => { value.assemblyOutput.packageHash = "0".repeat(64); }],
  ["assembly output extra", (value) => { value.assemblyOutput.extra = true; }],
  ["assembly ref", (value) => { value.assemblyFact.assembly.outputRef.hash = "0".repeat(64); }],
  ["graph fact ref", (value) => { value.graph.componentFactRefs[0].factRef.hash = "0".repeat(64); }],
  ["authority", (value) => { value.materializedComponents[0].component.authorityBinding.writerContextRef.hash = "0".repeat(64); }],
  ["candidate authority", (value) => { value.candidate.authority.assemblyFactRef.hash = "0".repeat(64); }],
  ["materialized missing", (value) => { value.materializedComponents.pop(); }],
  ["materialized extra", (value) => { value.materializedComponents.push(structuredClone(value.materializedComponents[0])); }],
  ["extra root", (value) => { value.extra = true; }],
  ["missing root", (value) => { delete value.assemblyOutput; }],
  ["forbidden", (value) => { value.materializedComponents[0].component.providerMetadata = {}; }]
];
for (let index = 0; index < roles.length; index += 1) {
  mutations.push([`component ${roles[index]}`, (value) => { value.materializedComponents[index].component[hashFields[roles[index]]] = "0".repeat(64); }]);
  mutations.push([`component extra ${roles[index]}`, (value) => { value.materializedComponents[index].component.extra = true; }]);
  mutations.push([`fact ${roles[index]}`, (value) => { value.materializedComponents[index].fact.factHash = "0".repeat(64); }]);
}
for (const [label, mutate] of mutations) {
  const invalid = structuredClone(commit);
  mutate(invalid);
  assert.throws(() => validateUnifiedAtomicContentCommitV2(rehash(invalid)), (error) => error.code?.startsWith("UNIFIED_ATOMIC"), label);
}

const backing = {};
const store = createUnifiedAtomicContentCommitStore(backing);
const invalid = structuredClone(commit);
invalid.commitHash = "0".repeat(64);
assert.throws(() => store.append(invalid));
assert.equal(backing.unifiedAtomicContentCommits, undefined, "failed validation must be zero-write");
const stored = store.append(commit);
assert.equal(backing.unifiedAtomicContentCommits.length, 1);
assert.equal(store.append(JSON.parse(JSON.stringify(commit))).commitHash, commit.commitHash);
assert.equal(backing.unifiedAtomicContentCommits.length, 1);
assert.equal(store.listByProject(commit.contentProjectRef.hash).length, 1);
assert.equal(store.listByProject(commit.materializedContentProjectRef.hash).length, 1);
assert.ok(Object.isFrozen(stored) && Object.isFrozen(store.getByCommit(commit.id)));
assert.throws(() => { store.getByCommit(commit.id).assemblyOutput.id = "mutated"; }, TypeError);

console.log("atomic-materialized-commit-v2-self-test: ok");
