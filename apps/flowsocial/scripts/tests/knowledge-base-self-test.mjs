import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PDFDocument, rgb } from "pdf-lib";

const sandbox = await mkdtemp(join(tmpdir(), "flowsocial-kb-test-"));
const dataDir = join(sandbox, "data");
const uploadDir = join(sandbox, "uploads");
await import("node:fs/promises").then(({ mkdir }) => mkdir(dataDir, { recursive: true }));
await writeFile(join(dataDir, "store.json"), JSON.stringify({ knowledgeFolders: [], knowledgeFiles: [] }), "utf8");
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_KNOWLEDGE_UPLOAD_DIR = uploadDir;

const knowledge = await import("../../knowledge-base.mjs");
const { database } = await import("../../storage.mjs");

try {
  const folderA = knowledge.createKnowledgeFolder({ workspaceId: "ws_a", companyId: "company_a", name: "公司A资料" });
  const folderB = knowledge.createKnowledgeFolder({ workspaceId: "ws_b", companyId: "company_b", name: "公司B资料" });
  const file = await knowledge.saveKnowledgeFile({
    folderId: folderA.id,
    workspaceId: "ws_a",
    companyId: "company_a",
    name: "产品说明.txt",
    mimeType: "text/plain",
    tags: ["产品", "策略资料"],
    description: "策略诊断和内容生成都可以引用",
    buffer: Buffer.from("FlowSocial 企业产品提供社媒策略诊断、内容规划和可追溯知识引用。这个资料用于验证统一知识库。")
  });
  assert.equal(file.parseStatus, "ready");
  assert.equal(file.workspaceId, "ws_a");
  assert.equal(file.companyId, "company_a");
  assert.equal(file.parseAttempts, 1);

  assert.equal(knowledge.listKnowledgeFolders({ workspaceId: "ws_a", companyId: "company_a" }).length, 1);
  assert.equal(knowledge.listKnowledgeFolders({ workspaceId: "ws_b", companyId: "company_b" }).length, 1);
  assert.equal(knowledge.listKnowledgeFiles({ folderId: folderA.id, workspaceId: "ws_b", companyId: "company_b" }).length, 0);
  await assert.rejects(
    knowledge.saveKnowledgeFile({ folderId: folderB.id, workspaceId: "ws_a", companyId: "company_a", name: "越权.txt", tags: ["测试"], buffer: Buffer.from("不应该保存到其他公司文件夹") }),
    /another workspace|another company/
  );

  const retrieved = knowledge.searchKnowledge({ query: "社媒策略诊断", folderIds: [folderA.id], workspaceId: "ws_a", companyId: "company_a" });
  assert.equal(retrieved.files[0].id, file.id);
  assert.equal(knowledge.searchKnowledge({ query: "社媒策略诊断", folderIds: [folderA.id], workspaceId: "ws_b", companyId: "company_b" }).items.length, 0);
  const exactEvidence = knowledge.getKnowledgeEvidenceForFiles({ fileIds: [file.id], workspaceId: "ws_a", companyId: "company_a" });
  assert.equal(exactEvidence.files[0].id, file.id);
  assert.equal(exactEvidence.items[0].selectionSource, "user_confirmed_exact_file");
  assert.match(exactEvidence.items[0].text, /可追溯知识引用/);
  assert.equal(knowledge.getKnowledgeEvidenceForFiles({ fileIds: [file.id], workspaceId: "ws_b", companyId: "company_b" }).items.length, 0);

  const link = knowledge.attachDiagnosticKnowledgeFile({ sessionId: "session_test", accountId: "company_a", fileId: file.id });
  assert.equal(link.fileId, file.id);
  assert.match(knowledge.extractKnowledgeCandidateFacts(file.id).summary, /社媒策略诊断/);

  const snapshot = knowledge.createKnowledgeSnapshot({
    contentTaskId: "content_run_test",
    query: retrieved.query,
    folderIds: [folderA.id],
    citations: retrieved.items,
    workspaceId: "ws_a",
    companyId: "company_a"
  });
  const frozen = knowledge.getKnowledgeSnapshot(snapshot.id);
  assert.equal(frozen.contentTaskId, "content_run_test");
  assert.equal(frozen.citations[0].fileId, file.id);

  const image = await knowledge.saveKnowledgeFile({
    folderId: folderA.id,
    workspaceId: "ws_a",
    companyId: "company_a",
    name: "产品现场.png",
    mimeType: "image/png",
    tags: ["现场图"],
    description: "用户明确说明：这是产品部署现场，可用于理解服务场景",
    buffer: Buffer.alloc(1024, 1)
  });
  assert.equal(image.parseStatus, "ready");
  assert.equal(image.parseMode, "image_metadata");
  assert.ok(knowledge.searchKnowledge({ query: "产品部署现场", folderIds: [folderA.id], workspaceId: "ws_a", companyId: "company_a" }).items.some((item) => item.fileId === image.id));

  const visualPdfDocument = await PDFDocument.create();
  for (let index = 0; index < 3; index += 1) {
    const page = visualPdfDocument.addPage([842, 595]);
    page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: index % 2 ? rgb(0.05, 0.05, 0.05) : rgb(0.8, 0.04, 0.06) });
  }
  const visualPdf = await knowledge.saveKnowledgeFile({
    folderId: folderA.id,
    workspaceId: "ws_a",
    companyId: "company_a",
    name: "视觉型VI.pdf",
    mimeType: "application/pdf",
    tags: ["品牌视觉"],
    description: "没有文本层的品牌手册",
    buffer: Buffer.from(await visualPdfDocument.save())
  });
  assert.equal(visualPdf.parseStatus, "visual_ready");
  assert.equal(visualPdf.parseMode, "pdf_page_vision");
  assert.equal(visualPdf.contentMode, "visual");
  assert.equal(visualPdf.pageCount, 3);
  assert.equal(visualPdf.chunkCount, 0);

  await assert.rejects(
    knowledge.saveKnowledgeFile({ folderId: folderA.id, workspaceId: "ws_a", companyId: "company_a", name: "恶意程序.exe", tags: ["错误"], buffer: Buffer.from("fake") }),
    (error) => error.code === "UNSUPPORTED_KNOWLEDGE_FILE" && error.statusCode === 415
  );

  console.log(JSON.stringify({ status: "knowledge-base-self-test passed", retrievedFileId: file.id, diagnosticLinkId: link.linkId, snapshotId: snapshot.id, imageParseMode: image.parseMode, visualPdfPages: visualPdf.pageCount }));
} finally {
  database.close();
  await rm(sandbox, { recursive: true, force: true });
}
