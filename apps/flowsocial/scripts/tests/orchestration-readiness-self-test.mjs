import assert from "node:assert/strict";
import { buildOrchestrationReadinessReport, simulateContentOrchestration } from "../../content-agent/orchestration-lab.mjs";

const readiness = buildOrchestrationReadinessReport();
assert.equal(readiness.schemaVersion, "1.0");
assert.equal(readiness.skillConformance.valid, true, readiness.skillConformance.errors.join("\n"));
assert.ok(readiness.skillConformance.summary.total >= 20);
assert.equal(readiness.skillConformance.capabilities.find((item) => item.capability === "revise-content-package").adapter.stage, "revision");
assert.equal(readiness.skillConformance.capabilities.find((item) => item.capability === "analyze-viral-content").adapter.stage, "source_analysis");
assert.equal(readiness.contracts.ActiveStrategySnapshot, "2.0");
assert.ok(readiness.replaceableBoundaries.includes("strategy-adapter"));

const normal = simulateContentOrchestration({ platform: "xiaohongshu" });
assert.equal(normal.persisted, false);
assert.equal(normal.trace.state, "content_ready");
assert.equal(normal.trace.lineage.strategySnapshotId, "strategy_lab");
assert.equal(normal.trace.nodes.find((item) => item.id === "outline").status, "completed");
assert.equal(normal.trace.nodes.find((item) => item.id === "platform_writer").status, "completed");
assert.equal(normal.trace.decisions[0].decision, "confirmed");

const outlineRetry = simulateContentOrchestration({ platform: "wechat", failOnceAt: "outline" });
assert.equal(outlineRetry.trace.state, "content_ready");
assert.equal(outlineRetry.trace.nodes.find((item) => item.id === "outline").attempts, 2);
assert.ok(outlineRetry.trace.ledgerHistory.some((item) => item.nodeId === "outline" && item.status === "failed"));

const writerRetry = simulateContentOrchestration({ platform: "xiaohongshu", failOnceAt: "platform_writer" });
assert.equal(writerRetry.trace.nodes.find((item) => item.id === "platform_writer").attempts, 2);
assert.ok(writerRetry.trace.ledgerHistory.some((item) => item.nodeId === "platform_writer" && item.status === "failed"));

console.log(JSON.stringify({
  status: "orchestration-readiness-self-test passed",
  skillSummary: readiness.skillConformance.summary,
  warnings: readiness.skillConformance.warnings.length,
  normalState: normal.trace.state,
  outlineAttempts: outlineRetry.trace.nodes.find((item) => item.id === "outline").attempts,
  writerAttempts: writerRetry.trace.nodes.find((item) => item.id === "platform_writer").attempts
}, null, 2));

