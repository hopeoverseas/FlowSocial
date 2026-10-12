import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFrontendSourceSync();
const htmlSource = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

assert.ok(appSource.includes("data-v2-visual"), "settings overview must expose a direct visual-guidelines action");
assert.ok(appSource.includes("小红书视觉规范 · ${visualStatus}"), "the action must show the current human-readable status");
assert.ok(appSource.includes("window.FlowAPI.getDesignDna(item.id)"), "the status must come from the persisted Design DNA endpoint");
assert.ok(appSource.includes("#accountVisualGuidelines"), "the direct action must land on the visual-guidelines editor");
assert.ok(htmlSource.includes('id="accountVisualGuidelines"'), "the visual-guidelines editor must have a stable target");
assert.ok(htmlSource.includes("只有你确认的版本才会用于后续小红书生图"), "the human confirmation boundary must stay visible");
assert.ok(htmlSource.includes('id="analyzeAccountVisualSources"'), "visual sources must require an explicit analysis action");
assert.ok(htmlSource.includes("开始识别品牌风格"), "the user action must use task language instead of provider language");
assert.ok(!htmlSource.includes("MiniMax"), "the normal visual-guideline UI must not expose the provider name");
assert.ok(!appSource.includes("本次会向 MiniMax 发起"), "the primary flow must not add a second provider confirmation dialog");
assert.ok(appSource.includes("未自动重试"), "advanced details must retain the no-retry audit fact");
assert.ok(appSource.includes("品牌风格识别未完成"), "visual-analysis failures must use a task-specific recoverable banner");
assert.ok(appSource.includes("资料已经保留，可以直接重新识别"), "the UI must explain that an interrupted request does not lose uploads");
assert.ok(htmlSource.includes(".docx,.txt,.md,.markdown,.html,.htm"), "brand articles must be accepted as visual-guideline text sources");
assert.ok(appSource.includes("图片等待识别"), "upload completion must not claim analysis before the explicit action");
assert.ok(htmlSource.includes("视觉型 PDF 会直接读取每一页画面"), "the UI must describe PDF page vision in user language");
assert.ok(cssSource.includes("font-size: 15px"), "settings fields must use readable product-size type");
assert.ok(cssSource.includes("[data-v2-visual]"), "the direct action needs a stable layout rule");

console.log("settings-visual-guidelines-ui-self-test: ok");
