import { randomUUID } from "node:crypto";

export const EVALUATED_CONTENT_SKILLS = Object.freeze(["generate-platform-titles", "generate-content-outline", "write-xhs-content", "write-wechat-article"]);

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const searchable = (value) => JSON.stringify(value || {}).toLowerCase();

export function createCaseDrivenEvaluationSuite(analyses = [], options = {}) {
  const approved = list(analyses).filter((item) => item.status === "approved");
  const cases = approved.flatMap((analysis) => {
    const blueprint = analysis.blueprintCandidate || {};
    const shared = {
      sourceAnalysisId: analysis.id,
      sourceReferenceIds: list(analysis.sourceReferenceIds),
      platform: blueprint.platform || "unknown",
      expectedMechanisms: [...list(blueprint.titleMechanisms), blueprint.openingMechanism, ...list(blueprint.structureRules), blueprint.interactionMechanism].filter(Boolean),
      forbiddenCopy: list(analysis.doNotCopy || blueprint.prohibitedUses)
    };
    const skills = shared.platform === "xiaohongshu"
      ? ["generate-platform-titles", "generate-content-outline", "write-xhs-content"]
      : shared.platform === "wechat"
        ? ["generate-platform-titles", "generate-content-outline", "write-wechat-article"]
        : EVALUATED_CONTENT_SKILLS;
    return skills.map((skillName) => ({ id: `eval_${randomUUID().slice(0, 8)}`, skillName, ...shared }));
  });
  return { schemaVersion: "1.0", generatedAt: new Date().toISOString(), accountId: options.accountId || null, sourceCount: approved.length, cases };
}

export function evaluateContentSkillOutput(testCase, output) {
  if (!EVALUATED_CONTENT_SKILLS.includes(testCase?.skillName)) throw new Error("Unsupported content skill evaluation case");
  const haystack = searchable(output);
  const expected = list(testCase.expectedMechanisms);
  const matched = expected.filter((item) => haystack.includes(String(item).toLowerCase()));
  const copied = list(testCase.forbiddenCopy).filter((item) => String(item).length >= 6 && haystack.includes(String(item).toLowerCase()));
  const mechanismCoverage = expected.length ? Math.round(matched.length / expected.length * 100) : null;
  const structural = Boolean(output && typeof output === "object");
  const score = Math.max(0, Math.round((structural ? 40 : 0) + (mechanismCoverage === null ? 30 : mechanismCoverage * 0.6) - copied.length * 20));
  return {
    caseId: testCase.id,
    skillName: testCase.skillName,
    score,
    decision: copied.length ? "fail" : score >= 70 ? "pass" : "needs_review",
    checks: { structuralOutput: structural, mechanismCoverage, matchedMechanisms: matched, prohibitedCopyMatches: copied },
    note: "This is a case-driven regression score, not a prediction of platform traffic."
  };
}
