import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, styles] = await Promise.all([
  readFrontendSource(),
  readFile(new URL("../../styles.css", import.meta.url), "utf8")
]);

assert.match(app, /function renderReadablePlatformOutline/);
assert.match(app, /这篇内容要解决什么/);
assert.match(app, /第 \$\{index \+ 1\} 页/);
assert.match(app, /section\.key_points/);
assert.match(app, /和 AI 修改大纲/);
assert.match(app, /data-outline-instruction/);
assert.match(app, /发送给 AI 并生成新版大纲/);
assert.doesNotMatch(app, /window\.prompt\(`请说明\$\{platformName\}大纲要修改什么/);
assert.doesNotMatch(app, /window\.confirm\(`确认当前\$\{platformName\}大纲/);
assert.match(app, /await resumeUnifiedProductionPlatform\(platform\)/);
assert.match(app, /if \(selected && projectField\?\.value\) await refreshUnifiedProductionBootstrap\(\)/);
assert.match(app, /if \(unifiedArtifactWorkbench\.outlineConfirmations\?\.\[platform\]\)/);
assert.match(styles, /\.outline-readable/);
assert.match(styles, /\.outline-ai-chat/);

console.log("xhs-outline-review-ui-self-test: ok");
