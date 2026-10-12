function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s，。！？、；：“”‘’（）《》【】,.!?;:'"()[\]{}_-]+/g, "");
}

function ngrams(value, size = 2) {
  const source = normalize(value);
  if (!source) return new Set();
  if (source.length <= size) return new Set([source]);
  return new Set(Array.from({ length: source.length - size + 1 }, (_, index) => source.slice(index, index + size)));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function similarity(left, right) {
  return jaccard(ngrams(left), ngrams(right));
}

function identityFromHistory(item) {
  return item.contentIdentity || item.identity || {
    contentPillar: item.contentPillar,
    audienceProblem: item.audienceProblem,
    coreClaim: item.coreClaim,
    contentRole: item.contentRole,
    angle: item.angle,
    format: item.format,
    platform: item.platform,
    sourceIds: item.sourceIds || []
  };
}

export function evaluateDuplication(candidate, history = []) {
  let best = null;
  for (const item of history) {
    const prior = identityFromHistory(item);
    const topicScore = similarity(candidate.topic, item.topic || item.ideaTitle || item.currentContent?.title);
    const problemScore = similarity(candidate.audienceProblem, prior.audienceProblem);
    const claimScore = similarity(candidate.coreClaim, prior.coreClaim);
    const pillarMatch = candidate.contentPillar && candidate.contentPillar === prior.contentPillar ? 1 : 0;
    const angleMatch = candidate.angle && candidate.angle === prior.angle ? 1 : 0;
    const score = topicScore * 0.25 + problemScore * 0.2 + claimScore * 0.35 + pillarMatch * 0.15 + angleMatch * 0.05;
    if (!best || score > best.score) best = { item, prior, score, topicScore, problemScore, claimScore };
  }

  const matchDetails = best ? {
    matchedContentId: best.item?.id || best.item?.historyItemId || null,
    matchedTopic: best.item?.topic || best.item?.ideaTitle || best.item?.currentContent?.title || null,
    matchedPlatform: best.item?.platform || null,
    dimensions: {
      topic: Number(best.topicScore.toFixed(3)),
      audienceProblem: Number(best.problemScore.toFixed(3)),
      coreClaim: Number(best.claimScore.toFixed(3)),
      samePillar: candidate.contentPillar && candidate.contentPillar === best.prior.contentPillar,
      sameAngle: Boolean(candidate.angle && candidate.angle === best.prior.angle)
    },
    thresholds: { warn: 0.42, rework: 0.58, block: 0.72 }
  } : {
    matchedContentId: null,
    matchedTopic: null,
    matchedPlatform: null,
    dimensions: null,
    thresholds: { warn: 0.42, rework: 0.58, block: 0.72 }
  };

  if (!best || best.score < 0.42) {
    return { decision: "allow", score: best?.score || 0, ...matchDetails, reasons: [] };
  }

  const sameAngle = candidate.angle && candidate.angle === best.prior.angle;
  const decision = best.score >= 0.72 && sameAngle ? "block" : best.score >= 0.58 ? "rework" : "warn";
  const reasons = [
    best.claimScore >= 0.55 ? "核心观点与历史内容接近" : null,
    best.problemScore >= 0.55 ? "解决的是相近的受众问题" : null,
    sameAngle ? "切入角度也相同" : "可以通过更换角度形成新的内容任务"
  ].filter(Boolean);
  return {
    decision,
    score: Number(best.score.toFixed(3)),
    ...matchDetails,
    reasons,
    suggestedChanges: decision === "block" || decision === "rework"
      ? ["更换内容角度或内容形式", "优先使用新的案例与证据", "明确本次相对旧内容的新增价值"]
      : []
  };
}
