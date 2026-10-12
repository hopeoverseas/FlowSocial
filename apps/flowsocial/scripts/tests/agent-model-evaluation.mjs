import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeterministicDiagnosticFallback } from "../../strategy-agent/deterministic-extractor.mjs";
import { buildAssistanceFallback, validateAssistanceRelevance } from "../../strategy-agent/consultative-engine.mjs";
import { validateContract } from "../../llm/contracts.mjs";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const readJsonl = (name) => readFileSync(join(root, "tests", "fixtures", "evaluation", name), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const failures = [];
let passed = 0;
let total = 0;
const verify = (condition, caseId, message) => { total += 1; if (condition) passed += 1; else failures.push({ caseId, message }); };

for (const item of readJsonl("diagnostic-extraction.jsonl")) {
  const pendingQuestion = { id: `q_${item.caseId}`, content: "测试问题", targetFieldPaths: [item.pendingField] };
  const result = buildDeterministicDiagnosticFallback(item.input, [], pendingQuestion);
  const paths = result.coreClaimOperations.map((operation) => operation.fieldPath);
  for (const path of item.mustWrite) verify(paths.includes(path), item.caseId, `missing field ${path}`);
  for (const path of item.forbidden) verify(!paths.includes(path), item.caseId, `forbidden field ${path}`);
  const serialized = JSON.stringify(result.coreClaimOperations);
  for (const text of item.mustContain) verify(serialized.includes(text), item.caseId, `missing content ${text}`);
}

const claims = [{ fieldPath: "business.primaryOffers", value: ["企业知识库", "帮助中心"], status: "confirmed" }, { fieldPath: "accountStrategy.primaryGoal", value: "建立专业信任并获得咨询", status: "confirmed" }];
for (const item of readJsonl("diagnostic-assistance.jsonl")) {
  const result = buildAssistanceFallback({ intent: item.intent, fieldPath: item.fieldPath, claims });
  const relevance = validateAssistanceRelevance(result, item.fieldPath, item.intent);
  verify(relevance.valid, item.caseId, relevance.reason || "assistance irrelevant");
  const serialized = JSON.stringify(result);
  for (const text of item.mustContain) verify(serialized.includes(text), item.caseId, `missing content ${text}`);
}

for (const item of readJsonl("provider-contracts.jsonl")) {
  const result = validateContract(item.contract, item.value);
  verify(result.valid === item.valid, item.caseId, `expected valid=${item.valid}, got ${result.valid}`);
}

const score = total ? Number((passed / total).toFixed(4)) : 0;
if (failures.length) {
  console.error(JSON.stringify({ status: "failed", passed, total, score, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: "passed", passed, total, score, datasets: ["diagnostic-extraction", "diagnostic-assistance", "provider-contracts"] }, null, 2));

