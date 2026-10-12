import { createZipBuffer } from "./zip-archive.mjs";

const xml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

function paragraph(value, { style, spacingAfter = 160 } = {}) {
  const text = String(value ?? "");
  const properties = style ? `<w:pStyle w:val="${style}"/>` : "";
  const lines = text.split(/\n/);
  const runs = lines.map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join("");
  return `<w:p><w:pPr>${properties}<w:spacing w:after="${spacingAfter}"/></w:pPr>${runs || "<w:r><w:t></w:t></w:r>"}</w:p>`;
}

export function createXhsCopyDocx({ title, body, tags }) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${paragraph("小红书发布文案", { style: "Kicker", spacingAfter: 120 })}
${paragraph("标题", { style: "Heading1" })}${paragraph(title, { style: "CopyText", spacingAfter: 360 })}
${paragraph("正文", { style: "Heading1" })}${paragraph(body, { style: "CopyText", spacingAfter: 360 })}
${paragraph("标签", { style: "Heading1" })}${paragraph(tags, { style: "Tags", spacingAfter: 0 })}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1020" w:bottom="1020" w:left="1020" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/><w:sz w:val="22"/><w:lang w:val="zh-CN" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Kicker"><w:name w:val="Kicker"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="D95B43"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:color w:val="1D2B27"/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CopyText"><w:name w:val="Copy Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Tags"><w:name w:val="Tags"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="4D645D"/><w:sz w:val="22"/></w:rPr></w:style>
</w:styles>`;
  const entries = [
    { name: "[Content_Types].xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`) },
    { name: "word/document.xml", data: Buffer.from(documentXml) },
    { name: "word/styles.xml", data: Buffer.from(stylesXml) },
    { name: "word/_rels/document.xml.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "docProps/core.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:subject>小红书发布文案</dc:subject><dc:creator>FlowSocial</dc:creator></cp:coreProperties>`) },
    { name: "docProps/app.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FlowSocial</Application></Properties>`) }
  ];
  return createZipBuffer(entries);
}

function decodeFile(file) {
  return file.encoding === "base64" ? Buffer.from(file.content, "base64") : Buffer.from(file.content, "utf8");
}

export function createXhsLocalPackage(delivery) {
  if (delivery?.contract !== "AtomicXhsFinalDeliveryRecord@1.0" || delivery.deliveryReady !== true) throw Object.assign(new Error("当前小红书内容包尚未完成"), { code: "XHS_LOCAL_PACKAGE_NOT_READY", statusCode: 409 });
  const byPath = new Map((delivery.files || []).map((file) => [file.path, file]));
  const readText = (path) => {
    const file = byPath.get(path);
    if (!file) throw Object.assign(new Error(`内容包缺少 ${path}`), { code: "XHS_LOCAL_PACKAGE_COPY_MISSING", statusCode: 409 });
    return decodeFile(file).toString("utf8").trim();
  };
  const title = readText("copy/title.txt");
  const body = readText("copy/body.txt");
  const tags = readText("copy/tags.txt");
  const images = (delivery.files || []).filter((file) => file.kind === "selected_page_image" || file.path?.startsWith("images/"));
  if (!images.length) throw Object.assign(new Error("内容包缺少已确认图片"), { code: "XHS_LOCAL_PACKAGE_IMAGES_MISSING", statusCode: 409 });
  const entries = [{ name: "小红书发布文案.docx", data: createXhsCopyDocx({ title, body, tags }) }];
  images.forEach((file, index) => entries.push({
    name: `图片/${String(index + 1).padStart(2, "0")}-${index === 0 ? "封面" : "内页"}.png`,
    data: decodeFile(file)
  }));
  return {
    bytes: createZipBuffer(entries),
    fileName: `小红书内容包-${delivery.id.replace(/[^a-zA-Z0-9_-]+/g, "-")}.zip`,
    members: entries.map((entry) => entry.name)
  };
}
