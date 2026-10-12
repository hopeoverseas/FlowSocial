import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const sandbox = await mkdtemp(join(tmpdir(), "flowsocial-asset-upload-"));
const dataDir = join(sandbox, "data");
const uploadDir = join(sandbox, "uploads");
await mkdir(dataDir, { recursive: true });
await writeFile(join(dataDir, "store.json"), JSON.stringify({ knowledgeFolders: [], knowledgeFiles: [] }), "utf8");
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_KNOWLEDGE_UPLOAD_DIR = uploadDir;
process.env.PORT = "0";

const knowledge = await import("../../knowledge-base.mjs");
const { database } = await import("../../storage.mjs");
let server;

try {
  const folder = knowledge.createKnowledgeFolder({ workspaceId: "ws_upload", companyId: "company_upload", name: "上传测试" });
  const ready = await knowledge.saveKnowledgeFile({
    folderId: folder.id,
    workspaceId: "ws_upload",
    companyId: "company_upload",
    name: "内容素材.csv",
    mimeType: "text/csv",
    tags: ["内容计划"],
    description: "内容计划检索测试",
    buffer: Buffer.from("主题,说明\n知识库闭环,上传资料进入内容计划并冻结快照")
  });
  assert.equal(ready.parseStatus, "ready");
  assert.equal(ready.kind, "sheet");
  assert.equal((await readdir(uploadDir)).length, 1);

  const failed = await knowledge.saveKnowledgeFile({
    folderId: folder.id,
    workspaceId: "ws_upload",
    companyId: "company_upload",
    name: "损坏资料.pdf",
    mimeType: "application/pdf",
    tags: ["失败路径"],
    buffer: Buffer.from("not a pdf")
  });
  assert.equal(failed.parseStatus, "failed");
  assert.ok(failed.errorMessage);
  const retried = await knowledge.retryKnowledgeFile(failed.id, { workspaceId: "ws_upload", companyId: "company_upload" });
  assert.equal(retried.parseStatus, "failed");
  assert.equal(retried.parseAttempts, 2);
  assert.ok(retried.errorMessage);

  const refreshed = knowledge.listKnowledgeFiles({ folderId: folder.id, workspaceId: "ws_upload", companyId: "company_upload" });
  assert.equal(refreshed.find((item) => item.id === ready.id).parseStatus, "ready");
  assert.equal(refreshed.find((item) => item.id === failed.id).parseStatus, "failed");
  ({ server } = await import("../../server.mjs"));
  if (!server.listening) await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const apiFiles = await fetch(`${baseUrl}/knowledge/files?folderId=${encodeURIComponent(folder.id)}&workspaceId=ws_upload&companyId=company_upload`).then((response) => response.json());
  assert.equal(apiFiles.items.length, 2);
  const isolatedApiFiles = await fetch(`${baseUrl}/knowledge/files?folderId=${encodeURIComponent(folder.id)}&workspaceId=other&companyId=other`).then((response) => response.json());
  assert.equal(isolatedApiFiles.items.length, 0);

  const search = knowledge.searchKnowledge({ query: "知识库闭环", folderIds: [folder.id], workspaceId: "ws_upload", companyId: "company_upload" });
  assert.equal(search.files[0].id, ready.id);
  const snapshot = knowledge.createKnowledgeSnapshot({ contentTaskId: "content_run_upload", query: search.query, folderIds: [folder.id], citations: search.items, workspaceId: "ws_upload", companyId: "company_upload" });
  assert.equal(snapshot.citations[0].fileId, ready.id);

  assert.equal(await knowledge.deleteKnowledgeFile(ready.id, { workspaceId: "other", companyId: "other" }), false);
  assert.equal(await knowledge.deleteKnowledgeFile(ready.id, { workspaceId: "ws_upload", companyId: "company_upload" }), true);
  assert.equal(knowledge.listKnowledgeFiles({ folderId: folder.id, workspaceId: "ws_upload", companyId: "company_upload" }).some((item) => item.id === ready.id), false);
  assert.equal(knowledge.getKnowledgeSnapshot(snapshot.id).citations[0].fileId, ready.id);

  console.log(JSON.stringify({ status: "asset-upload-self-test passed", readyStatus: ready.parseStatus, failedStatus: failed.parseStatus, retryAttempts: retried.parseAttempts, snapshotFrozen: true }));
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  database.close();
  await rm(sandbox, { recursive: true, force: true });
}
