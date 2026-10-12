import { clone, stableHash } from "./canonical.mjs";
import { CONTRACTS, validatePromptReviewDecision, withComputedHash } from "./contracts.mjs";

const blocker = (code, scope, detail) => ({ code, scope, detail, fallback: "deterministic_layout" });

function candidateStructure(candidate) {
  return {
    archetypePlan: candidate.archetypePlan,
    compositionModel: candidate.compositionModel,
    hierarchyStrategy: candidate.hierarchyStrategy,
    imageRole: candidate.imageRole
  };
}

function candidateRefs(candidates) {
  return candidates.map((candidate) => ({ id: candidate.id, hash: stableHash(candidate) })).sort((left, right) => left.id.localeCompare(right.id));
}

export function validateDirectionCandidates(candidates) {
  const blockers = [];
  if (!Array.isArray(candidates) || candidates.length < 2) blockers.push(blocker("DIRECTION_CANDIDATES_INSUFFICIENT", "visualDirectionSelection", "至少需要两个结构不同的方向"));
  const signatures = new Set();
  const ids = new Set();
  for (const candidate of candidates || []) {
    const required = ["id", "stylePackId", "archetypePlan", "compositionModel", "hierarchyStrategy", "imageRole", "palette", "source", "license", "risks", "capabilityStatus"];
    if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(required.sort())) throw new Error(`VisualDirectionCandidate:FIELDS:${candidate.id || "unknown"}`);
    if (typeof candidate.id !== "string" || candidate.id.length === 0) throw new Error("VisualDirectionCandidate:ID_REQUIRED");
    if (ids.has(candidate.id)) blockers.push(blocker("DIRECTION_CANDIDATE_ID_DUPLICATE", candidate.id, "视觉方向候选 ID 必须唯一"));
    ids.add(candidate.id);
    if (typeof candidate.source !== "string" || candidate.source.length === 0) blockers.push(blocker("DIRECTION_SOURCE_MISSING", candidate.id, "方向缺少来源"));
    if (typeof candidate.license !== "string" || candidate.license.length === 0) blockers.push(blocker("DIRECTION_LICENSE_MISSING", candidate.id, "方向缺少许可证"));
    if (!Array.isArray(candidate.risks)) throw new Error(`VisualDirectionCandidate:RISKS_REQUIRED:${candidate.id}`);
    const capabilityKeys = ["snapshotRef", "status", "blockers"];
    if (!candidate.capabilityStatus || JSON.stringify(Object.keys(candidate.capabilityStatus).sort()) !== JSON.stringify(capabilityKeys.sort())) throw new Error(`VisualDirectionCandidate:CAPABILITY_STATUS_FIELDS:${candidate.id}`);
    if (!Array.isArray(candidate.capabilityStatus.blockers)) throw new Error(`VisualDirectionCandidate:CAPABILITY_BLOCKERS_REQUIRED:${candidate.id}`);
    const signature = stableHash(candidateStructure(candidate));
    if (signatures.has(signature)) blockers.push(blocker("DIRECTION_NOT_STRUCTURALLY_DISTINCT", candidate.id, "仅颜色变化不能构成独立方向"));
    signatures.add(signature);
    if (candidate.capabilityStatus.status === "blocked") blockers.push(...candidate.capabilityStatus.blockers.map((item) => blocker(item.code, candidate.id, item.detail)));
  }
  const refs = candidateRefs(candidates || []);
  return {
    blockers,
    candidateRefs: refs,
    candidateSetHash: stableHash(refs),
    structuralEvidenceHash: stableHash([...signatures].sort())
  };
}

function overallStatus(decision) {
  if (decision.blockers.length) return "blocked";
  if (decision.visualDirectionSelection.status !== "selected") return "direction_pending";
  if (decision.promptReview.status !== "approved") return "prompt_review_pending";
  return "awaiting_cost_confirmation";
}

function finalize(decision) {
  const next = clone(decision);
  next.overallStatus = overallStatus(next);
  return withComputedHash(next, "decisionHash");
}

export function createPromptReviewDecision({ id, promptSet, directionCandidates }) {
  const candidateValidation = validateDirectionCandidates(directionCandidates);
  return finalize({
    schemaVersion: "1.0",
    contract: CONTRACTS.promptReviewDecision,
    id,
    promptSetRef: { id: promptSet.id, schemaVersion: promptSet.schemaVersion, hash: stableHash(promptSet) },
    visualDirectionSelection: {
      status: "pending",
      candidateIds: directionCandidates.map((item) => item.id),
      candidateRefs: candidateValidation.candidateRefs,
      candidateSetHash: candidateValidation.candidateSetHash,
      selectedDirectionRef: null,
      structuralEvidenceHash: candidateValidation.structuralEvidenceHash,
      decidedBy: null,
      decidedAt: null
    },
    promptReview: { status: "pending", reviewedPromptSetHash: null, reviewedBy: null, reviewedAt: null },
    costConfirmation: { status: "pending", currency: null, estimatedCost: null, confirmedBy: null, confirmedAt: null },
    overallStatus: "direction_pending",
    blockers: candidateValidation.blockers,
    decisionHash: ""
  });
}

export function transitionPromptReviewDecision(decision, event) {
  validatePromptReviewDecision(decision);
  const next = clone(decision);
  if (event.lane === "visualDirectionSelection") {
    if (event.action !== "select" || !next.visualDirectionSelection.candidateIds.includes(event.directionId)) throw new Error("PromptReviewDecision:INVALID_DIRECTION_TRANSITION");
    const selectedDirectionRef = next.visualDirectionSelection.candidateRefs.find((item) => item.id === event.directionId);
    next.visualDirectionSelection = { ...next.visualDirectionSelection, status: "selected", selectedDirectionRef, decidedBy: event.actor, decidedAt: event.at };
  } else if (event.lane === "promptReview") {
    if (next.visualDirectionSelection.status !== "selected") throw new Error("PromptReviewDecision:DIRECTION_REQUIRED");
    if (event.action === "approve") {
      if (event.reviewedPromptSetHash !== next.promptSetRef.hash) throw new Error("PromptReviewDecision:PROMPT_HASH_MISMATCH");
      next.promptReview = { status: "approved", reviewedPromptSetHash: event.reviewedPromptSetHash, reviewedBy: event.actor, reviewedAt: event.at };
    } else if (event.action === "request_changes") {
      next.promptReview = { status: "changes_requested", reviewedPromptSetHash: event.reviewedPromptSetHash, reviewedBy: event.actor, reviewedAt: event.at };
    } else throw new Error("PromptReviewDecision:INVALID_PROMPT_TRANSITION");
  } else if (event.lane === "costConfirmation") {
    next.blockers.push(blocker("COST_CONFIRMATION_OUT_OF_SCOPE", "costConfirmation", "离线任务不得确认费用"));
  } else throw new Error("PromptReviewDecision:UNKNOWN_LANE");
  return finalize(next);
}
