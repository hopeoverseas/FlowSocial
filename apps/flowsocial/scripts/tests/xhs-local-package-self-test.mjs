import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createXhsLocalPackage } from "../../content-agent/xhs-local-package.mjs";
import { readZipEntries } from "../../content-agent/zip-archive.mjs";

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const textFile = (path, content) => ({ path, kind: "user_text", content, encoding: "utf8" });
const imageFile = (path) => ({ path, kind: "selected_page_image", content: tinyPng.toString("base64"), encoding: "base64" });
const delivery = {
  contract: "AtomicXhsFinalDeliveryRecord@1.0",
  id: "atomic-xhs-delivery:test-package",
  deliveryReady: true,
  files: [
    textFile("copy/title.txt", "AI 落地前，先看这 3 个问题\n"),
    textFile("copy/body.txt", "很多团队不是缺工具，而是缺少清晰的业务场景。\n\n第一步：先找到高频、重复、可验证的任务。\n\n最后，用小步实验验证价值。\n"),
    textFile("copy/tags.txt", "#AI落地 #企业数字化 #工作方法\n"),
    imageFile("images/01_cover.png"), imageFile("images/02_step.png")
  ]
};

const output = createXhsLocalPackage(delivery);
assert.match(output.fileName, /^小红书内容包-.*\.zip$/);
const outer = readZipEntries(output.bytes);
assert.deepEqual([...outer.keys()], ["小红书发布文案.docx", "图片/01-封面.png", "图片/02-内页.png"]);
assert.deepEqual(outer.get("图片/01-封面.png"), tinyPng);
const docx = readZipEntries(outer.get("小红书发布文案.docx"));
const documentXml = docx.get("word/document.xml").toString("utf8");
assert.match(documentXml, /AI 落地前，先看这 3 个问题/);
assert.match(documentXml, /第一步：先找到高频、重复、可验证的任务/);
assert.match(documentXml, /#AI落地 #企业数字化 #工作方法/);

if (process.env.XHS_PACKAGE_QA_DIR) {
  await mkdir(process.env.XHS_PACKAGE_QA_DIR, { recursive: true });
  await writeFile(join(process.env.XHS_PACKAGE_QA_DIR, output.fileName), output.bytes);
  await writeFile(join(process.env.XHS_PACKAGE_QA_DIR, "小红书发布文案.docx"), outer.get("小红书发布文案.docx"));
}

console.log(JSON.stringify({ ok: true, fileName: output.fileName, members: [...outer.keys()], docxMembers: [...docx.keys()] }, null, 2));
