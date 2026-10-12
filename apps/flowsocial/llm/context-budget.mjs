const PRIORITY_KEYS = [
  "contract", "schemaVersion", "requestId", "traceId", "strategyTurnId", "contentRunId",
  "requiredFacts", "confirmedFacts", "facts", "business", "account", "accountStrategy",
  "strategy", "governance", "audiences", "offers", "product", "contentPillars", "topic", "platform",
  "platformRole", "platformRoles", "conversionPath", "riskPolicy", "accountDecision", "accountDecisions",
  "instruction", "rules", "outputSchema"
];

const priority = new Map(PRIORITY_KEYS.map((key, index) => [key, index]));

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function orderedKeys(value) {
  return Object.keys(value).sort((left, right) => {
    const leftPriority = priority.has(left) ? priority.get(left) : PRIORITY_KEYS.length;
    const rightPriority = priority.has(right) ? priority.get(right) : PRIORITY_KEYS.length;
    return leftPriority - rightPriority || left.localeCompare(right);
  });
}

function compactValue(value, limits, depth = 0) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length <= limits.maxString ? value : `${value.slice(0, limits.maxString)}…[trimmed]`;
  if (depth >= limits.maxDepth) return Array.isArray(value) ? [] : {};
  if (Array.isArray(value)) {
    const seen = new Set();
    const result = [];
    for (const item of value) {
      const signature = stableStringify(item);
      if (seen.has(signature)) continue;
      seen.add(signature);
      result.push(compactValue(item, limits, depth + 1));
      if (result.length >= limits.maxArrayItems) break;
    }
    return result;
  }
  const result = {};
  for (const key of orderedKeys(value)) result[key] = compactValue(value[key], limits, depth + 1);
  return result;
}

export function compactLlmPayload(payload = {}, charBudget = 56000) {
  const sourceChars = JSON.stringify(payload).length;
  const passes = [
    { maxString: 4000, maxArrayItems: 40, maxDepth: 8 },
    { maxString: 2000, maxArrayItems: 20, maxDepth: 7 },
    { maxString: 1000, maxArrayItems: 10, maxDepth: 6 },
    { maxString: 500, maxArrayItems: 5, maxDepth: 5 }
  ];
  let compacted = payload;
  for (const limits of passes) {
    compacted = compactValue(payload, limits);
    if (JSON.stringify(compacted).length <= charBudget) break;
  }
  if (JSON.stringify(compacted).length > charBudget) {
    const required = {};
    for (const key of orderedKeys(compacted)) {
      const candidate = { ...required, [key]: compacted[key] };
      if (JSON.stringify(candidate).length <= charBudget || Object.keys(required).length === 0) required[key] = compacted[key];
    }
    compacted = required;
  }
  const outputChars = JSON.stringify(compacted).length;
  return { payload: compacted, sourceChars, outputChars, trimmed: sourceChars > outputChars };
}

function errorPath(message) {
  return String(message || "").match(/^([a-zA-Z0-9_.\[\]-]+)/)?.[1] || "result";
}

function summarizeCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== "object") return { type: typeof candidate };
  const summary = {};
  for (const key of orderedKeys(candidate).slice(0, 20)) {
    const value = candidate[key];
    if (Array.isArray(value)) summary[key] = { type: "array", count: value.length };
    else if (value && typeof value === "object") summary[key] = { type: "object", keys: Object.keys(value).sort().slice(0, 12) };
    else if (typeof value === "string") summary[key] = value.slice(0, 160);
    else summary[key] = value;
  }
  return summary;
}

export function buildMinimalRepairPayload({ contract, validationErrors = [], candidate = {}, originalPayload = {}, charBudget = 8000 }) {
  const requiredContext = compactLlmPayload(originalPayload, Math.max(1000, Math.floor(charBudget * 0.55))).payload;
  return compactLlmPayload({
    contract,
    repair: {
      errorPaths: [...new Set(validationErrors.map(errorPath))].slice(0, 20),
      candidateSummary: summarizeCandidate(candidate),
      instruction: "Repair only the listed contract paths and return one complete JSON object."
    },
    requiredContext
  }, charBudget).payload;
}
