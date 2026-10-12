const list = (value) => Array.isArray(value) ? value : [];
const clean = (value) => String(value || "").toLowerCase().replace(/[\s，。！？、；：“”‘’（）《》【】,.!?;:'"()[\]{}_-]+/g, "");

function ngrams(value, size = 2) {
  const source = clean(value);
  if (!source) return new Set();
  if (source.length <= size) return new Set([source]);
  return new Set(Array.from({ length: source.length - size + 1 }, (_, index) => source.slice(index, index + size)));
}

function overlap(left, right) {
  const a = ngrams(left);
  const b = ngrams(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / a.size;
}

function packageText(platform, contentPackage) {
  if (platform === "wechat") {
    return [
      contentPackage?.recommended_title,
      contentPackage?.abstract,
      contentPackage?.opening,
      contentPackage?.article_markdown,
      contentPackage?.cta
    ].filter(Boolean).join("\n");
  }
  return [
    contentPackage?.post_copy?.recommended_title,
    contentPackage?.post_copy?.opening,
    ...list(contentPackage?.post_copy?.body_sections).flatMap((item) => [item.heading, item.content]),
    contentPackage?.post_copy?.ending,
    ...list(contentPackage?.deck?.pages).flatMap((item) => [item.headline, item.supporting_text])
  ].filter(Boolean).join("\n");
}

function titleText(platform, contentPackage) {
  return platform === "wechat"
    ? contentPackage?.recommended_title
    : contentPackage?.post_copy?.recommended_title;
}

function outlineAdherence(confirmedOutline, bodyText) {
  if (!confirmedOutline) return { result: "fail", detail: "missing confirmed outline" };
  const sections = list(confirmedOutline.sections);
  const coverage = sections.map((section) => {
    const signals = [section.heading, section.objective, ...list(section.key_points)].filter(Boolean);
    const score = Math.max(0, ...signals.map((signal) => overlap(signal, bodyText)));
    return { sectionId: section.section_id, heading: section.heading, score: Number(score.toFixed(3)), covered: score >= 0.18 };
  });
  return {
    result: coverage.length >= 3 && coverage.every((item) => item.covered) ? "pass" : "warning",
    detail: coverage
  };
}

function factTraceability(platform, contentMaster, contentPackage) {
  const knownFactIds = new Set(list(contentMaster?.confirmed_facts).map((item) => item.fact_id).filter(Boolean));
  if (platform === "wechat") {
    const knownSourceIds = new Set(list(contentMaster?.source_list).map((item) => item.source_id).filter(Boolean));
    const used = list(contentPackage?.claim_map).flatMap((item) => list(item.source_ids));
    const unknown = used.filter((id) => !knownSourceIds.has(id));
    return { result: unknown.length ? "fail" : "pass", detail: { used, unknown } };
  }
  const used = list(contentPackage?.deck?.pages).flatMap((item) => list(item.fact_ids));
  const unknown = used.filter((id) => !knownFactIds.has(id));
  return { result: unknown.length ? "fail" : "pass", detail: { used, unknown } };
}

function platformCompleteness(platform, contentPackage) {
  if (platform === "wechat") {
    const markdown = String(contentPackage?.article_markdown || "");
    const passed = Boolean(titleText(platform, contentPackage)) && markdown.length >= 1200 && (markdown.match(/^##\s/gm) || []).length >= 3;
    return { result: passed ? "pass" : "warning", detail: { characters: markdown.length, sections: (markdown.match(/^##\s/gm) || []).length } };
  }
  const pages = list(contentPackage?.deck?.pages);
  const passed = Boolean(titleText(platform, contentPackage)) && pages.length >= 6 && pages.length <= 10;
  return { result: passed ? "pass" : "warning", detail: { pages: pages.length } };
}

export function runContentGates({ platform, contentMaster, confirmedOutline, contentPackage, requireConfirmedOutline = false }) {
  const bodyText = packageText(platform, contentPackage);
  const title = titleText(platform, contentPackage);
  const promise = confirmedOutline?.content_promise || contentMaster?.reader_value || contentMaster?.central_thesis || "";
  const sources = list(contentMaster?.source_list);
  const confirmedFacts = list(contentMaster?.confirmed_facts);
  const sourceTypes = new Map(sources.map((item) => [item.source_id, item.source_type]));
  const recognizedFacts = confirmedFacts.filter((fact) => list(fact.source_ids).some((sourceId) => ["strategy_fact", "user_temporary_material"].includes(sourceTypes.get(sourceId))));
  const evidenceReady = confirmedFacts.length > 0;
  const titleScore = overlap(title, `${promise}\n${bodyText}`);
  const checks = [
    { gate: "SourceReadinessGate", result: evidenceReady ? "pass" : "fail", detail: { confirmedFacts: confirmedFacts.length, strategyFacts: recognizedFacts.filter((fact) => list(fact.source_ids).some((id) => sourceTypes.get(id) === "strategy_fact")).length, temporaryMaterialFacts: recognizedFacts.filter((fact) => list(fact.source_ids).some((id) => sourceTypes.get(id) === "user_temporary_material")).length } },
    { gate: "OutlineConfirmationGate", result: confirmedOutline || !requireConfirmedOutline ? "pass" : "fail", detail: confirmedOutline?.outline_id || (requireConfirmedOutline ? null : "legacy_pipeline_not_enforced") },
    { gate: "OutlineAdherenceGate", ...(confirmedOutline ? outlineAdherence(confirmedOutline, bodyText) : { result: requireConfirmedOutline ? "fail" : "pass", detail: "legacy_pipeline_not_enforced" }) },
    { gate: "FactTraceabilityGate", ...factTraceability(platform, contentMaster, contentPackage) },
    { gate: "TitlePromiseConsistencyGate", result: title && titleScore >= 0.16 ? "pass" : "warning", detail: { score: Number(titleScore.toFixed(3)), promise } },
    { gate: "PlatformCompletenessGate", ...platformCompleteness(platform, contentPackage) }
  ];
  const failures = checks.filter((item) => item.result === "fail");
  const warnings = checks.filter((item) => item.result === "warning");
  return {
    schemaVersion: "1.0",
    decision: failures.length ? "block" : warnings.length ? "review" : "pass",
    checks,
    issues: [...failures, ...warnings].map((item) => ({ gate: item.gate, severity: item.result, detail: item.detail })),
    repairPlan: [...failures, ...warnings].map((item) => ({
      gate: item.gate,
      rerunFrom: item.gate === "SourceReadinessGate" ? "content_master" : item.gate === "OutlineAdherenceGate" ? "platform_writer" : item.gate === "TitlePromiseConsistencyGate" ? "generate-platform-titles" : "quality_review"
    }))
  };
}
