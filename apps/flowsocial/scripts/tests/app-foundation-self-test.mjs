import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [source, app, html] = await Promise.all([
  readFile(new URL("../../app-foundation.js", import.meta.url), "utf8"),
  readFrontendSource(),
  readFile(new URL("../../index.html", import.meta.url), "utf8")
]);
const context = { window: {} };
vm.runInNewContext(source, context);
const foundation = context.window.FlowSocialAppFoundation;
assert.ok(Object.isFrozen(foundation));
assert.equal(foundation.escapeHtml('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
assert.deepEqual([...foundation.asArray(null)], []);
assert.deepEqual([...foundation.asArray("one")], ["one"]);
assert.deepEqual([...foundation.parseKeywordLines("AI, 内容\nAI，策略")], ["AI", "内容", "策略"]);
assert.equal(foundation.humanizeDisplayValue({ primaryOutcome: "增长", timeHorizon: "90 天" }), "增长；核心目标：增长；目标周期：90 天");
assert.match(app, /window\.FlowSocialAppFoundation/);
assert.doesNotMatch(app, /function humanizeDisplayValue/);
assert.ok(html.indexOf("app-foundation.js") < html.indexOf("app.js"), "foundation must load before app.js");
console.log("app-foundation-self-test: ok");
