import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { deleteKnowledgeFile, saveKnowledgeFile, searchKnowledge } from "../../knowledge-base.mjs";

async function docxBuffer() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>FlowSocial DOCX knowledge retrieval test 企业知识库检索测试。</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function pdfBuffer() {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText("FlowSocial PDF knowledge retrieval test", { x: 72, y: 720, size: 12, font });
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

const created = [];
try {
  created.push(await saveKnowledgeFile({ folderId: "folder_product", name: "knowledge-test.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", tags: ["self-test"], description: "DOCX parser test", buffer: await docxBuffer() }));
  created.push(await saveKnowledgeFile({ folderId: "folder_product", name: "knowledge-test.pdf", mimeType: "application/pdf", tags: ["self-test"], description: "PDF parser test", buffer: await pdfBuffer() }));
  const docxSearch = searchKnowledge({ query: "企业知识库检索", folderIds: ["folder_product"] });
  const pdfSearch = searchKnowledge({ query: "PDF knowledge retrieval", folderIds: ["folder_product"] });
  const result = { files: created.map((file) => ({ name: file.name, status: file.parseStatus, chunks: file.chunkCount, error: file.errorMessage })), docxSearchHits: docxSearch.items.length, pdfSearchHits: pdfSearch.items.length };
  console.log(JSON.stringify(result));
  if (created.some((file) => file.parseStatus !== "ready") || !docxSearch.items.length || !pdfSearch.items.length) process.exitCode = 1;
} finally {
  for (const file of created) await deleteKnowledgeFile(file.id);
}

