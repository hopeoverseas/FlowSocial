import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*\.main-area > \.topbar[\s\S]*padding-top: 52px/);
assert.match(styles, /body:not\(\[data-current-view="artifact-review"\]\) > \.app-view \{ top:108px; \}/);
assert.match(styles, /@media \(min-width: 561px\) and \(max-width: 820px\)[\s\S]*\.nav-item \{ font-size:0; \}/);
assert.match(styles, /\.head-actions[\s\S]*grid-template-columns:minmax\(150px,1fr\) repeat\(2,minmax\(0,1fr\)\) auto/);
assert.match(styles, /\.account-card-actions[\s\S]*grid-column:1 \/ -1/);
assert.match(styles, /\.unified-xhs-production-stages[\s\S]*position:sticky/);
assert.match(styles, /\.unified-xhs-page-copy-grid,[\s\S]*\.unified-xhs-pages[\s\S]*scroll-snap-type:x mandatory/);
assert.match(markup, /<aside class="surface agent-diagnostic-sidebar">[\s\S]*?<\/aside>\s*<\/div>\s*<section class="surface agent-strategy-decisions"/);
assert.match(styles, /body:not\(\[data-current-view="agent"\]\) #agentStrategyDecisionPanel,[\s\S]*#agentWorkflowPanel \{ display: none !important; \}/);

console.log("responsive-layout-contract-self-test: ok");
