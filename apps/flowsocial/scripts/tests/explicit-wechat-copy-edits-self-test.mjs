import assert from "node:assert/strict";
import { explicitWechatCopyOperations, extractExplicitWechatCopyEdits } from "../../content-agent/explicit-copy-edits.mjs";

const instruction = "文案调整：将推荐标题替换为「企业引入AI前，先把这四类流程梳理清楚」；在文章开头加入「AI落地的第一步，不是采购工具，而是看清业务流程。」其他段落保持原样。";
assert.deepEqual(extractExplicitWechatCopyEdits(instruction), {
  title: "企业引入AI前，先把这四类流程梳理清楚",
  opening: "AI落地的第一步，不是采购工具，而是看清业务流程。"
});
const result = explicitWechatCopyOperations({ recommended_title: "旧标题", article_markdown: "## 第一节\n\n原正文" }, instruction);
assert.deepEqual(result.operations.map((item) => item.path), ["/recommended_title", "/article_markdown"]);
assert.equal(result.operations[1].value.startsWith("AI落地的第一步，不是采购工具，而是看清业务流程。\n\n## 第一节"), true);
assert.equal(explicitWechatCopyOperations({ recommended_title: result.edits.title, article_markdown: result.operations[1].value }, instruction).operations.length, 0);
console.log("explicit-wechat-copy-edits-self-test: ok");
