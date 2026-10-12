const clean = (value) => String(value || "").trim();

export function extractExplicitWechatCopyEdits(instruction) {
  const value = clean(instruction);
  const title = value.match(/(?:推荐)?标题(?:改成|改为|替换成|替换为)[^「“'‘]{0,6}[「“'‘]([^」”'’]+)[」”'’]/)?.[1]?.trim() || null;
  const opening = value.match(/(?:文章|正文)?开头(?:增加|加入|添加)(?:一句)?[^「“'‘]{0,6}[「“'‘]([^」”'’]+)[」”'’]/)?.[1]?.trim() || null;
  return { title, opening };
}

export function explicitWechatCopyOperations(contentPackage, instruction) {
  const edits = extractExplicitWechatCopyEdits(instruction);
  const operations = [];
  if (edits.title && clean(contentPackage?.recommended_title) !== edits.title) {
    operations.push({ op: "replace", path: "/recommended_title", value: edits.title });
  }
  const markdown = clean(contentPackage?.article_markdown);
  if (edits.opening && !markdown.includes(edits.opening)) {
    operations.push({ op: "replace", path: "/article_markdown", value: `${edits.opening}\n\n${markdown}`.trim() });
  }
  return { edits, operations };
}
