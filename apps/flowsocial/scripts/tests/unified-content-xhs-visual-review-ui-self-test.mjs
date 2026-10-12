import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
const [app, css] = await Promise.all([
  readFrontendSource(),
  readFile(join(appRoot, "styles.css"), "utf8")
]);
const syntax = spawnSync(process.execPath, ["--check", join(appRoot, "app.js")], { encoding: "utf8" });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

const start = app.indexOf("// UNIFIED_XHS_VISUAL_REVIEW_PRESENTATION_START");
const end = app.indexOf("// UNIFIED_XHS_VISUAL_REVIEW_PRESENTATION_END");
assert.ok(start >= 0 && end > start, "visual-review presentation markers missing");
const source = app.slice(start, end);
const { gate, render } = new Function("asArray", "escapeHtml", "unifiedRefLabel", `${source}; return { gate: unifiedXhsHumanReviewGate, render: renderUnifiedXhsVisualReview };`)(
  (value) => Array.isArray(value) ? value : value == null ? [] : [value],
  (value = "") => String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]),
  (ref) => ref?.id ? `${ref.id}${ref.hash ? ` · ${ref.hash}` : ""}` : "—"
);

const revision = { id: "revision:P1:r2", hash: "b".repeat(64) };
const base = {
  humanReviewOpen: true,
  reviewStages: {
    technicalGate: { status: "eligible" },
    skillVisualReview: {
      status: "skill_passed",
      productionEligible: true,
      pixelInputConsumed: true,
      revisionSetHash: "a".repeat(64),
      pageRevisionRefs: [revision],
      provider: { name: "fixture-provider", model: "fixture-vision-model", status: "succeeded" },
      usage: { providerCalls: 1, automaticRetries: 0, cost: { status: "known", value: 0.2, currency: "CNY" } },
      wholeSet: { findings: [{ severity: "warning", issue: "跨页节奏偏密" }], passedChecks: ["visual consistency"], rerunStages: ["Renderer"] },
      pageFindings: [{ pageId: "P1", pageRevisionRef: revision, severity: "warning", issue: "标题离安全区过近", evidence: "像素边界仅余 12px", patch: { target: "P1", operation: "move", value: "down" } }],
      redo: { pendingPageIds: [] }
    },
    humanArtifactReview: { status: "available" }
  }
};

const scenarios = {
  passed: base,
  waiting: { humanReviewOpen: false, reviewStages: { ...base.reviewStages, skillVisualReview: { ...base.reviewStages.skillVisualReview, status: "not_reviewed" }, humanArtifactReview: { status: "locked" } } },
  blocked: { humanReviewOpen: false, reviewStages: { ...base.reviewStages, skillVisualReview: { ...base.reviewStages.skillVisualReview, status: "checkpoint_required" }, humanArtifactReview: { status: "locked", reason: "provider checkpoint 未对账" } } },
  metadataOnly: { humanReviewOpen: false, reviewStages: { ...base.reviewStages, skillVisualReview: { ...base.reviewStages.skillVisualReview, status: "metadata_only", productionEligible: false, pixelInputConsumed: false }, humanArtifactReview: { status: "locked" } } },
  stale: { humanReviewOpen: false, reviewStages: { ...base.reviewStages, skillVisualReview: { ...base.reviewStages.skillVisualReview, status: "stale" }, humanArtifactReview: { status: "locked" } } },
  redo: { humanReviewOpen: false, reviewStages: { ...base.reviewStages, skillVisualReview: { ...base.reviewStages.skillVisualReview, status: "redo_required", redo: { pendingPageIds: ["P1"] } }, humanArtifactReview: { status: "locked" } } }
};

for (const [name, material] of Object.entries(scenarios)) {
  const projection = render(material, { reviewable: true, selectable: name === "passed" });
  assert.match(projection, new RegExp(`data-xhs-review-state="${material.reviewStages.skillVisualReview.status}"`));
  assert.match(projection, /Technical Gate/);
  assert.match(projection, /review-xhs-visuals/);
  assert.match(projection, /Human Artifact Review/);
  assert.match(projection, /不代表已选择、已晋升、已下载或已发布/);
  assert.equal(gate(material, {}).open, name === "passed", `${name} human gate mismatch`);
  assert.match(projection, name === "passed" ? /data-human-review-open="true"/ : /data-human-review-open="false"/);
}

const passedHtml = render(scenarios.passed, {});
for (const evidence of [revision.id, "跨页节奏偏密", "visual consistency", "Renderer", "P1", "warning", "标题离安全区过近", "像素边界仅余 12px", "move", "fixture-provider", "fixture-vision-model", "calls / cost", "known", "0.2"])
  assert.match(passedHtml, new RegExp(evidence));
assert.match(render(scenarios.metadataOnly, {}), /metadata-only \/ 未消费真实像素，不能通过/);
assert.match(render(scenarios.redo, {}), new RegExp(revision.id));

const missing = render({}, { reviewable: true });
assert.equal(gate({}, { reviewable: true }).open, false, "legacy reviewable must not bypass a missing stage projection");
assert.match(missing, /服务端未投影审阅阶段/);
assert.match(missing, /fail closed/);

assert.match(app, /unifiedXhsHumanReviewGate\(material, artifactState\)\.open/);
assert.match(app, /!humanGate\.open \|\| includedIndex/);
assert.match(app, /服务端尚未开放 XHS 人工 Artifact Review/);
assert.match(app, /artifactState\.selectable === true/);
assert.match(css, /\.unified-xhs-review-stages/);
assert.doesNotMatch(source, /FlowAPI|fetch\(|XMLHttpRequest|callProvider|providerTransport/i);

console.log(JSON.stringify({
  status: "unified-content-xhs-visual-review-ui-self-test passed",
  scenarios: Object.keys(scenarios),
  authority: "server_projection_only",
  missingProjection: "fail_closed",
  realProviderCalls: 0,
  networkCalls: 0,
  platformCalls: 0,
  productionDatabaseCalls: 0
}, null, 2));
