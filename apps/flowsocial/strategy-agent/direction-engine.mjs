const unique = (items, limit = 20) => [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit);

export function buildDirectionGenerationRequest(strategySnapshot) {
  return {
    task: "generate_monitoring_directions",
    contract: "StrategyDirectionSet@1.0",
    strategySnapshot,
    rules: [
      "生成3到6个互补而非同义的领域方向",
      "覆盖行业事件、受众问题、使用场景、购买触发、案例和政策变化",
      "每个方向必须绑定目标受众或内容支柱",
      "查询组必须包含排除词以控制招聘、娱乐、兼职和歧义噪音",
      "方向用于领域动态与内容信号，不把所有搜索结果称为热点"
    ]
  };
}

export function normalizeDirectionSet(raw = {}, strategySnapshotId) {
  const source = raw.data?.directions ? raw.data : raw;
  const directions = (source.directions || []).slice(0, 6).map((direction, index) => ({
    id: `${strategySnapshotId}__${direction.id || `direction_${String(index + 1).padStart(2, "0")}`}`,
    sourceDirectionId: direction.id || `direction_${String(index + 1).padStart(2, "0")}`,
    name: String(direction.name || "").trim(),
    purpose: String(direction.purpose || "").trim(),
    pillarIds: unique(direction.pillarIds, 8),
    audienceIds: unique(direction.audienceIds, 8),
    queryGroups: {
      core: unique(direction.queryGroups?.core, 8),
      scenario: unique(direction.queryGroups?.scenario, 8),
      problem: unique(direction.queryGroups?.problem, 8),
      event: unique(direction.queryGroups?.event, 8),
      policy: unique(direction.queryGroups?.policy, 8),
      competitor: unique(direction.queryGroups?.competitor, 8),
      case: unique(direction.queryGroups?.case, 8),
      exclude: unique(direction.queryGroups?.exclude, 12)
    },
    sourcePreferences: unique(direction.sourcePreferences, 8),
    freshnessWindowDays: Math.min(30, Math.max(1, Number(direction.freshnessWindowDays) || 7)),
    priority: Math.min(100, Math.max(0, Math.round(Number(direction.priority) || 50))),
    generatedBy: "strategy_snapshot",
    userEdited: false
  })).filter((direction) => direction.name && direction.queryGroups.core.length);
  return { schemaVersion: "1.0", strategySnapshotId, directions, generatedAt: new Date().toISOString() };
}

export function validateDirectionSet(directionSet) {
  const errors = [];
  if (!directionSet?.strategySnapshotId) errors.push("strategySnapshotId is required");
  if (!directionSet?.directions?.length) errors.push("at least one direction is required");
  for (const direction of directionSet?.directions || []) {
    if (!direction.name) errors.push("direction.name is required");
    if (!direction.queryGroups?.core?.length) errors.push(`${direction.name || "direction"}: core query group is required`);
  }
  return { valid: errors.length === 0, errors };
}
