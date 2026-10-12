import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFrontendSourceSync();
const htmlSource = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const styles = JSON.parse(readFileSync(new URL("../../skills/design-xhs-integrated-pages/references/style-packs.json", import.meta.url), "utf8"));

const expected = ["friendly-handdrawn-tech", "editorial-metaphor", "structured-infographic"];
assert.deepEqual(styles.entries.map((item) => item.id), expected, "UI choices must mirror the complete current Skill style library");
for (const id of expected) assert.ok(htmlSource.includes(`value="${id}"`), `missing user-facing Skill style choice: ${id}`);
assert.ok(htmlSource.includes("页面呈现方式") && htmlSource.includes("内容自适应（推荐）") && htmlSource.includes("轻松手绘") && htmlSource.includes("结构化方法卡"));
assert.ok(appSource.includes('const stylePackId = $("#unifiedXhsStylePack")?.value'), "design request must use the user's exact style selection");
assert.ok(appSource.includes('const adaptiveArchetypeId = index === 0 || role === "cover"'), "the first page must receive a content-adaptive cover function");
assert.ok(appSource.includes('stylePackId === "editorial-metaphor" ? archetypeId'), "adaptive production must not inherit a generic upstream card archetype");
assert.ok(appSource.includes("explicitProcess") && appSource.includes("explicitComparison"), "structured layouts must require explicit page semantics");
assert.ok(appSource.includes("unifiedXhsStyleDescriptions"), "each system style must explain its intended use");
assert.ok(htmlSource.includes("视觉识别资料默认只提供一个品牌色锚点，不套用手册版式"), "VI must be described as a lightweight colour anchor instead of a page template");
assert.ok(appSource.includes("品牌色怎么用") && appSource.includes("本次创意原则") && appSource.includes("本页创意概念"), "pre-generation review must explain the brand/creative boundary");

console.log("xhs-skill-style-selection-ui-self-test: ok");
