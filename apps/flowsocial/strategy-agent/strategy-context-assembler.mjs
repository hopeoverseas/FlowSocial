import { createHash } from "node:crypto";
import { classifyFactImpact, normalizeGovernedFact } from "./fact-governance.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const stableHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function normalizedClaim(claim = {}) {
  return { id: claim.id || null, fieldPath: claim.fieldPath || "", value: claim.value, status: claim.status || "unknown", confidence: Number(claim.confidence || 0), sourceType: claim.sourceType || "unknown", sourceRef: claim.sourceRef || null, updatedAt: claim.updatedAt || null };
}

function normalizedKnowledgeCandidate(candidate = {}) {
  return { id: candidate.candidateId || candidate.id || null, fileId: candidate.fileId || null, targetType: candidate.candidateType || (candidate.targetFieldPath ? "field" : "fact"), targetKey: candidate.targetKey || candidate.targetFieldPath || "", value: candidate.value, confidence: Number(candidate.confidence || 0), evidence: list(candidate.evidence), status: candidate.status || "unknown" };
}

export function assembleStrategyInputBundle({ account, claims = [], facts = [], knowledgeCandidates = [], retrievedKnowledgeEvidence = [], knowledgeEvidenceRequest = null, historicalContext = [], performanceSignals = [], referencePatterns = [], strategyDecisions = null, coverageSnapshot = null, factSnapshotId = null, claimRevision = 0, factRevision = 0, knowledgeRevision = null } = {}) {
  const normalizedClaims = claims.map(normalizedClaim);
  const confirmedClaims = normalizedClaims.filter((claim) => ["confirmed", "accepted_suggestion"].includes(claim.status));
  const inferredClaims = normalizedClaims.filter((claim) => claim.status === "inferred");
  const governedFacts = facts.filter((fact) => !["rejected", "conflicting", "superseded"].includes(fact.status)).map(normalizeGovernedFact);
  const dynamicFacts = Object.fromEntries(["strategy", "platform", "topic", "risk", "content_only"].map((impact) => [impact, governedFacts.filter((fact) => classifyFactImpact(fact) === impact)]));
  const acceptedKnowledge = knowledgeCandidates.filter((candidate) => candidate.status === "confirmed").map(normalizedKnowledgeCandidate);
  const conflicts = [
    ...normalizedClaims.filter((claim) => claim.status === "conflicting").map((claim) => ({ type: "claim", key: claim.fieldPath, candidateIds: [claim.id], requiresUserResolution: true })),
    ...facts.filter((fact) => fact.status === "conflicting").map((fact) => ({ type: "fact", key: fact.factKey, candidateIds: [fact.id], requiresUserResolution: true }))
  ];
  const contextCore = {
    account: account ? { id: account.id, name: account.name, platform: account.platform || null } : null,
    coreClaims: confirmedClaims,
    inferredClaims,
    dynamicFacts,
    knowledgeEvidence: acceptedKnowledge,
    retrievedKnowledgeEvidence: list(retrievedKnowledgeEvidence),
    knowledgeEvidenceRequest,
    historicalContext: list(historicalContext),
    performanceSignals: list(performanceSignals),
    referencePatterns: list(referencePatterns),
    strategyDecisions: strategyDecisions && typeof strategyDecisions === "object" ? structuredClone(strategyDecisions) : null,
    coverageSnapshot,
    conflicts,
    missingInformation: normalizedClaims.filter((claim) => ["temporarily_unknown", "skipped", "not_available"].includes(claim.status)).map((claim) => claim.fieldPath),
    provenance: { claimIds: normalizedClaims.map((claim) => claim.id).filter(Boolean), factIds: governedFacts.map((fact) => fact.id).filter(Boolean), knowledgeCandidateIds: acceptedKnowledge.map((item) => item.id).filter(Boolean), retrievedKnowledgeEvidenceIds:list(retrievedKnowledgeEvidence).map((item)=>item.id).filter(Boolean),factSnapshotId },
    contextVersion: { claimRevision: Number(claimRevision || 0), factRevision: Number(factRevision || 0), knowledgeRevision }
  };
  return { schemaVersion: "1.0", ...contextCore, contextHash: stableHash(contextCore), assembledAt: new Date().toISOString() };
}
