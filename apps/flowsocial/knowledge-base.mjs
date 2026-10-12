import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import { database } from "./storage.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const uploadRoot = process.env.FLOWSOCIAL_KNOWLEDGE_UPLOAD_DIR
  ? resolve(process.env.FLOWSOCIAL_KNOWLEDGE_UPLOAD_DIR)
  : process.env.FLOWSOCIAL_DATA_DIR
    ? join(resolve(process.env.FLOWSOCIAL_DATA_DIR), "knowledge-files")
    : join(root, "data", "knowledge-files");
const DEFAULT_WORKSPACE_ID = "workspace_default";
const DEFAULT_COMPANY_ID = "account_damaishuzhi";

database.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '▤',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_files (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL REFERENCES knowledge_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stored_name TEXT,
    mime_type TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL DEFAULT 'document',
    tags_json TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    storage_status TEXT NOT NULL DEFAULT 'stored',
    parse_status TEXT NOT NULL DEFAULT 'pending',
    char_count INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    char_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(file_id, chunk_index)
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
    chunk_id UNINDEXED,
    file_id UNINDEXED,
    content,
    tokenize = 'unicode61'
  );

  CREATE TABLE IF NOT EXISTS knowledge_snapshots (
    id TEXT PRIMARY KEY,
    content_task_id TEXT,
    query TEXT NOT NULL,
    folder_ids_json TEXT NOT NULL,
    citations_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS diagnostic_knowledge_links (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    file_id TEXT NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
    scope TEXT NOT NULL DEFAULT 'session',
    usage_json TEXT NOT NULL DEFAULT '["diagnostic_reference"]',
    status TEXT NOT NULL DEFAULT 'linked',
    created_at TEXT NOT NULL,
    UNIQUE(session_id, file_id)
  );

  CREATE INDEX IF NOT EXISTS idx_diagnostic_knowledge_links_session ON diagnostic_knowledge_links(session_id, created_at);

  CREATE TABLE IF NOT EXISTS diagnostic_document_candidates (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    file_id TEXT NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
    candidate_type TEXT NOT NULL DEFAULT 'field',
    target_key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.7,
    evidence_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_document_candidates_session ON diagnostic_document_candidates(session_id, created_at);
`);

function ensureColumn(table, column, declaration) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
}

for (const table of ["knowledge_folders", "knowledge_files", "knowledge_snapshots"]) {
  ensureColumn(table, "workspace_id", `TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`);
  ensureColumn(table, "company_id", `TEXT NOT NULL DEFAULT '${DEFAULT_COMPANY_ID}'`);
}
ensureColumn("knowledge_snapshots", "social_account_id", "TEXT");
ensureColumn("knowledge_folders", "visibility", "TEXT NOT NULL DEFAULT 'visible'");
ensureColumn("knowledge_files", "library_status", "TEXT NOT NULL DEFAULT 'knowledge'");
ensureColumn("knowledge_files", "parse_mode", "TEXT NOT NULL DEFAULT 'text_extraction'");
ensureColumn("knowledge_files", "parse_attempts", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("knowledge_files", "page_count", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("knowledge_files", "content_mode", "TEXT NOT NULL DEFAULT 'text'");

const insertFolder = database.prepare(`INSERT INTO knowledge_folders (id, name, description, icon, workspace_id, company_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const insertFile = database.prepare(`INSERT INTO knowledge_files (id, folder_id, name, stored_name, mime_type, size, kind, tags_json, description, storage_status, parse_status, char_count, chunk_count, error_message, workspace_id, company_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertChunk = database.prepare(`INSERT INTO knowledge_chunks (id, file_id, chunk_index, content, char_count, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
const insertFts = database.prepare(`INSERT INTO knowledge_chunks_fts (chunk_id, file_id, content) VALUES (?, ?, ?)`);

function identifier(prefix) {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

function parseJson(value, fallback = []) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function kindFor(mimeType, name) {
  const extension = extname(name).toLowerCase();
  if (mimeType?.startsWith("image/")) return "image";
  if ([".csv", ".xlsx", ".xls"].includes(extension)) return "sheet";
  return "document";
}

function fileRow(row) {
  return {
    id: row.id,
    folderId: row.folder_id,
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    companyId: row.company_id || DEFAULT_COMPANY_ID,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size,
    sizeLabel: row.size >= 1024 * 1024 ? `${(row.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(row.size / 1024))} KB`,
    kind: row.kind,
    tags: parseJson(row.tags_json),
    description: row.description,
    storageStatus: row.storage_status,
    libraryStatus: row.library_status || "knowledge",
    parseStatus: row.parse_status,
    parseMode: row.parse_mode || "text_extraction",
    parseAttempts: row.parse_attempts || 0,
    pageCount: row.page_count || 0,
    contentMode: row.content_mode || "text",
    charCount: row.char_count,
    chunkCount: row.chunk_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedLabel: row.parse_status === "ready" ? `已解析 · ${row.chunk_count} 段` : row.parse_status === "failed" ? "解析失败" : row.parse_status === "metadata_only" ? "等待重新上传" : "处理中"
  };
}

function migrateLegacyKnowledge() {
  const state = database.prepare("SELECT payload FROM app_state WHERE id = 1").get();
  if (!state) return;
  const store = JSON.parse(state.payload);
  const now = new Date().toISOString();
  for (const folder of store.knowledgeFolders || []) {
    database.prepare(`INSERT OR IGNORE INTO knowledge_folders (id, name, description, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(folder.id, folder.name, folder.description || "", folder.icon || "▤", folder.createdAt || now, now);
  }
  for (const file of store.knowledgeFiles || []) {
    database.prepare(`INSERT OR IGNORE INTO knowledge_files (id, folder_id, name, mime_type, size, kind, tags_json, description, storage_status, parse_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(file.id, file.folderId, file.name, file.mimeType || "", file.size || 0, file.kind || "document", JSON.stringify(file.tags || []), file.description || "", "metadata_only", "metadata_only", file.createdAt || now, now);
  }
}

migrateLegacyKnowledge();

export function listKnowledgeFolders({ workspaceId = null, companyId = null, includeHidden = false } = {}) {
  return database.prepare(`SELECT f.id, f.name, f.description, f.icon, f.workspace_id, f.company_id, f.visibility, f.created_at, f.updated_at, COUNT(k.id) AS file_count FROM knowledge_folders f LEFT JOIN knowledge_files k ON k.folder_id = f.id AND k.library_status = 'knowledge' WHERE (? = 1 OR f.visibility = 'visible') AND (? IS NULL OR f.workspace_id = ?) AND (? IS NULL OR f.company_id = ?) GROUP BY f.id ORDER BY f.created_at`).all(includeHidden ? 1 : 0, workspaceId, workspaceId, companyId, companyId).map((row) => ({ id: row.id, name: row.name, description: row.description, icon: row.icon, visibility: row.visibility || "visible", workspaceId: row.workspace_id, companyId: row.company_id, fileCount: row.file_count, createdAt: row.created_at, updatedAt: row.updated_at }));
}

export function createKnowledgeFolder(payload) {
  const now = new Date().toISOString();
  const folder = { id: identifier("folder"), name: payload.name.trim(), description: payload.description || "", icon: payload.icon || "▤", workspaceId: payload.workspaceId || DEFAULT_WORKSPACE_ID, companyId: payload.companyId || DEFAULT_COMPANY_ID, createdAt: now, updatedAt: now };
  insertFolder.run(folder.id, folder.name, folder.description, folder.icon, folder.workspaceId, folder.companyId, now, now);
  if (payload.visibility === "hidden") database.prepare("UPDATE knowledge_folders SET visibility = 'hidden' WHERE id = ?").run(folder.id);
  return { ...folder, fileCount: 0 };
}

export function listKnowledgeFiles({ folderId, query = "", workspaceId = null, companyId = null } = {}) {
  const rows = database.prepare(`SELECT * FROM knowledge_files WHERE library_status = 'knowledge' AND (? IS NULL OR folder_id = ?) AND (? IS NULL OR workspace_id = ?) AND (? IS NULL OR company_id = ?) ORDER BY created_at DESC`).all(folderId || null, folderId || null, workspaceId, workspaceId, companyId, companyId);
  const normalized = query.trim().toLowerCase();
  const contentMatches = normalized ? new Set(database.prepare("SELECT DISTINCT file_id FROM knowledge_chunks WHERE lower(content) LIKE ?").all(`%${normalized}%`).map((row) => row.file_id)) : new Set();
  return rows.map(fileRow).filter((file) => !normalized || contentMatches.has(file.id) || `${file.name} ${file.tags.join(" ")} ${file.description}`.toLowerCase().includes(normalized));
}

export function countKnowledgeFiles(companyId = null) {
  return database.prepare("SELECT COUNT(*) AS count FROM knowledge_files WHERE library_status = 'knowledge' AND (? IS NULL OR company_id = ?)").get(companyId, companyId).count;
}

function normalizeText(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/[\t\f\v]+/g, " ").replace(/[ ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const supportedExtensions = new Map([
  [".pdf", { kind: "document", parseMode: "pdf_text" }],
  [".docx", { kind: "document", parseMode: "docx_text" }],
  [".pptx", { kind: "document", parseMode: "pptx_text" }],
  [".ppt", { kind: "document", parseMode: "ppt_legacy_metadata" }],
  [".txt", { kind: "document", parseMode: "plain_text" }],
  [".md", { kind: "document", parseMode: "plain_text" }],
  [".markdown", { kind: "document", parseMode: "plain_text" }],
  [".csv", { kind: "sheet", parseMode: "csv_text" }],
  [".json", { kind: "document", parseMode: "plain_text" }],
  [".html", { kind: "document", parseMode: "html_text" }],
  [".htm", { kind: "document", parseMode: "html_text" }],
  [".png", { kind: "image", parseMode: "image_metadata" }],
  [".jpg", { kind: "image", parseMode: "image_metadata" }],
  [".jpeg", { kind: "image", parseMode: "image_metadata" }],
  [".webp", { kind: "image", parseMode: "image_metadata" }]
]);

export function validateKnowledgeUpload({ name = "", size = 0 } = {}) {
  const extension = extname(name).toLowerCase();
  const descriptor = supportedExtensions.get(extension);
  if (!descriptor) {
    const error = new Error("不支持该文件格式。支持 PDF、PPT/PPTX、DOCX、TXT、Markdown、CSV、JSON、HTML、PNG、JPG 和 WebP");
    error.code = "UNSUPPORTED_KNOWLEDGE_FILE";
    error.statusCode = 415;
    throw error;
  }
  if (Number(size) > 25 * 1024 * 1024) {
    const error = new Error("文件不能超过 25 MB");
    error.code = "KNOWLEDGE_FILE_TOO_LARGE";
    error.statusCode = 413;
    throw error;
  }
  return { extension, ...descriptor };
}

async function extractText(buffer, name, mimeType, metadata = {}) {
  const extension = extname(name).toLowerCase();
  if (extension === ".pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ pageJoiner: "" });
      const text = normalizeText(result.text)
        .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
        .replace(/--\s*\d+\s*\/\s*\d+\s*--/g, " ")
        .trim();
      if (text.replace(/[\d\W_]+/g, "").length < 40) {
        const error = new Error(`已检测到 ${result.total || 0} 页视觉内容，需要按页面进行识别`);
        error.code = "PDF_VISUAL_ONLY";
        error.pageCount = result.total || 0;
        throw error;
      }
      return text;
    }
    finally { await parser.destroy(); }
  }
  if (extension === ".docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return normalizeText((await mammoth.extractRawText({ buffer })).value);
  if (extension === ".pptx" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    const archive = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(archive.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const themeNames = Object.keys(archive.files).filter((path) => /^ppt\/theme\/theme\d+\.xml$/i.test(path));
    const xmlText = [];
    for (const path of [...slideNames, ...themeNames]) {
      const xml = await archive.file(path)?.async("string");
      if (!xml) continue;
      xmlText.push(xml.replace(/<a:br\s*\/>/gi, "\n").replace(/<\/a:p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
    }
    return normalizeText(`PPTX视觉资料：${name}\n${xmlText.join("\n")}`);
  }
  if (extension === ".ppt") {
    return normalizeText(`旧版PPT视觉资料已真实保存：${name}\n用户说明：${metadata.description || "未填写"}\n用户标签：${(metadata.tags || []).join("、") || "未填写"}\n解析限制：当前不能提取旧版二进制PPT的页面内容；Design DNA只使用用户批准的文字说明。`);
  }
  if ([".txt", ".md", ".markdown", ".csv", ".json", ".html", ".htm"].includes(extension) || /^text\//.test(mimeType || "")) {
    const text = buffer.toString("utf8");
    return normalizeText([".html", ".htm"].includes(extension) ? text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ") : text);
  }
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    return normalizeText(`图片资产：${name}\n用户说明：${metadata.description || "未填写"}\n用户标签：${(metadata.tags || []).join("、") || "未填写"}\n说明：当前仅索引用户提供的元数据，未执行 OCR 或视觉识别。`);
  }
  throw new Error("当前文件没有可用解析器");
}

function splitText(text, targetSize = 1200, overlap = 160) {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > targetSize) {
      if (current) chunks.push(current);
      current = "";
      for (let offset = 0; offset < paragraph.length; offset += targetSize - overlap) chunks.push(paragraph.slice(offset, offset + targetSize));
      continue;
    }
    if (current && current.length + paragraph.length + 2 > targetSize) {
      chunks.push(current);
      current = `${current.slice(-overlap)}\n\n${paragraph}`;
    } else current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) chunks.push(current);
  return chunks.filter((item) => item.trim().length >= 20);
}

async function parseKnowledgeFile(id, buffer, metadata) {
  const now = new Date().toISOString();
  database.prepare("UPDATE knowledge_files SET parse_status = 'pending', error_message = NULL, parse_attempts = parse_attempts + 1, updated_at = ? WHERE id = ?").run(now, id);
  database.prepare("DELETE FROM knowledge_chunks_fts WHERE file_id = ?").run(id);
  database.prepare("DELETE FROM knowledge_chunks WHERE file_id = ?").run(id);
  try {
    const text = await extractText(buffer, metadata.name, metadata.mimeType, metadata);
    if (!text) throw new Error("文件中没有提取到可检索文字");
    const chunks = splitText(text);
    if (!chunks.length) throw new Error("文件内容过短，无法建立可检索知识片段");
    database.exec("BEGIN IMMEDIATE");
    try {
      chunks.forEach((content, index) => {
        const chunkId = identifier("chunk");
        insertChunk.run(chunkId, id, index, content, content.length, now);
        insertFts.run(chunkId, id, content);
      });
      database.prepare(`UPDATE knowledge_files SET parse_status = 'ready', content_mode = 'text', char_count = ?, chunk_count = ?, error_message = NULL, updated_at = ? WHERE id = ?`).run(text.length, chunks.length, new Date().toISOString(), id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    if (error.code === "PDF_VISUAL_ONLY") {
      database.prepare(`UPDATE knowledge_files SET parse_status = 'visual_ready', parse_mode = 'pdf_page_vision', content_mode = 'visual', page_count = ?, char_count = 0, chunk_count = 0, error_message = NULL, updated_at = ? WHERE id = ?`).run(error.pageCount || 0, new Date().toISOString(), id);
    } else {
      database.prepare(`UPDATE knowledge_files SET parse_status = 'failed', char_count = 0, chunk_count = 0, error_message = ?, updated_at = ? WHERE id = ?`).run(error.message, new Date().toISOString(), id);
    }
  }
  return getKnowledgeFile(id);
}

export async function saveKnowledgeFile({ folderId, name, mimeType = "", size, tags = [], description = "", buffer, workspaceId = null, companyId = null, libraryStatus = "knowledge" }) {
  const folder = database.prepare("SELECT id, workspace_id, company_id FROM knowledge_folders WHERE id = ?").get(folderId);
  if (!folder) throw new Error("Knowledge folder not found");
  const resolvedWorkspaceId = workspaceId || folder.workspace_id || DEFAULT_WORKSPACE_ID;
  const resolvedCompanyId = companyId || folder.company_id || DEFAULT_COMPANY_ID;
  if (folder.workspace_id && folder.workspace_id !== resolvedWorkspaceId) throw new Error("Knowledge folder belongs to another workspace");
  if (folder.company_id && folder.company_id !== resolvedCompanyId) throw new Error("Knowledge folder belongs to another company");
  const descriptor = validateKnowledgeUpload({ name, size: size || buffer?.length || 0 });
  await mkdir(uploadRoot, { recursive: true });
  const id = identifier("file");
  const extension = descriptor.extension.replace(/[^.a-z0-9]/g, "");
  const storedName = `${id}${extension}`;
  const storedPath = join(uploadRoot, storedName);
  const now = new Date().toISOString();
  await writeFile(storedPath, buffer);
  insertFile.run(id, folderId, name, storedName, mimeType, size || buffer.length, descriptor.kind || kindFor(mimeType, name), JSON.stringify(tags), description, "stored", "pending", 0, 0, null, resolvedWorkspaceId, resolvedCompanyId, now, now);
  database.prepare("UPDATE knowledge_files SET library_status = ?, parse_mode = ? WHERE id = ?").run(libraryStatus === "diagnostic_only" ? "diagnostic_only" : "knowledge", descriptor.parseMode, id);
  return parseKnowledgeFile(id, buffer, { name, mimeType, tags, description });
}

export async function retryKnowledgeFile(id, { workspaceId = null, companyId = null } = {}) {
  const row = database.prepare("SELECT * FROM knowledge_files WHERE id = ? AND (? IS NULL OR workspace_id = ?) AND (? IS NULL OR company_id = ?)").get(id, workspaceId, workspaceId, companyId, companyId);
  if (!row) return null;
  if (!row.stored_name) {
    database.prepare("UPDATE knowledge_files SET parse_status = 'failed', error_message = ?, parse_attempts = parse_attempts + 1, updated_at = ? WHERE id = ?").run("原始文件不存在，无法重试；请删除后重新上传", new Date().toISOString(), id);
    return getKnowledgeFile(id);
  }
  const buffer = await readFile(join(uploadRoot, row.stored_name)).catch(() => null);
  if (!buffer) {
    database.prepare("UPDATE knowledge_files SET parse_status = 'failed', error_message = ?, parse_attempts = parse_attempts + 1, updated_at = ? WHERE id = ?").run("原始文件不存在，无法重试；请删除后重新上传", new Date().toISOString(), id);
    return getKnowledgeFile(id);
  }
  return parseKnowledgeFile(id, buffer, { name: row.name, mimeType: row.mime_type, tags: parseJson(row.tags_json), description: row.description });
}

export function getKnowledgeFile(id) {
  const row = database.prepare("SELECT * FROM knowledge_files WHERE id = ?").get(id);
  return row ? fileRow(row) : null;
}

export function attachDiagnosticKnowledgeFile({ sessionId, accountId, fileId, scope = "session", usage = ["diagnostic_reference"] }) {
  if (!sessionId || !accountId || !getKnowledgeFile(fileId)) throw new Error("Valid sessionId, accountId and fileId are required");
  if (!["session", "account", "workspace"].includes(scope)) throw new Error("Unsupported knowledge scope");
  const linkId = identifier("diagnostic_link");
  const createdAt = new Date().toISOString();
  database.prepare(`INSERT INTO diagnostic_knowledge_links (id, session_id, account_id, file_id, scope, usage_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'linked', ?) ON CONFLICT(session_id, file_id) DO UPDATE SET scope = excluded.scope, usage_json = excluded.usage_json, status = 'linked'`).run(linkId, sessionId, accountId, fileId, scope, JSON.stringify(usage || []), createdAt);
  return listDiagnosticKnowledgeFiles(sessionId).find((item) => item.fileId === fileId);
}

export function listDiagnosticKnowledgeFiles(sessionId) {
  return database.prepare(`SELECT l.id AS link_id, l.session_id, l.account_id, l.scope, l.usage_json, l.status, l.created_at AS linked_at, f.* FROM diagnostic_knowledge_links l JOIN knowledge_files f ON f.id = l.file_id WHERE l.session_id = ? AND l.status = 'linked' ORDER BY l.created_at DESC`).all(sessionId).map((row) => ({
    linkId: row.link_id,
    sessionId: row.session_id,
    accountId: row.account_id,
    fileId: row.id,
    scope: row.scope,
    usage: parseJson(row.usage_json),
    linkedAt: row.linked_at,
    file: fileRow(row)
  }));
}

export function extractKnowledgeCandidateFacts(fileId) {
  const file = getKnowledgeFile(fileId);
  if (!file) throw new Error("Knowledge file not found");
  const chunks = database.prepare("SELECT chunk_index, content FROM knowledge_chunks WHERE file_id = ? ORDER BY chunk_index LIMIT 6").all(fileId);
  const text = chunks.map((item) => item.content).join("\n\n").slice(0, 5000);
  if (!text) return { file, candidates: [], summary: "文件尚未解析出可用文字" };
  const resourceTypes = [];
  if (/案例|客户|项目成果/.test(text)) resourceTypes.push("customer_case");
  if (/SOP|流程|步骤|交付/.test(text)) resourceTypes.push("sop");
  if (/产品|功能|服务|解决方案/.test(text)) resourceTypes.push("product_material");
  if (/数据|报告|统计|\d+%|\d+家/.test(text)) resourceTypes.push("data");
  const summary = text.replace(/\s+/g, " ").slice(0, 420);
  return {
    file,
    summary,
    citations: chunks.slice(0, 3).map((item) => ({ fileId, fileName: file.name, chunkIndex: item.chunk_index, excerpt: item.content.slice(0, 260) })),
    candidates: [{
      candidateId: identifier("knowledge_candidate"),
      targetFieldPath: "accountStrategy.contentResources",
      value: { summary: `已上传并解析《${file.name}》`, resourceTypes: resourceTypes.length ? resourceTypes : ["reference_document"], knowledgeAssetIds: [fileId], publicUsage: "unknown" },
      sourceType: "document_extracted",
      requiresConfirmation: true
    }]
  };
}

function documentCandidateRow(row) {
  return {
    candidateId: row.id,
    sessionId: row.session_id,
    accountId: row.account_id,
    fileId: row.file_id,
    candidateType: row.candidate_type,
    targetKey: row.target_key,
    targetFieldPath: row.candidate_type === "field" ? row.target_key : null,
    value: parseJson(row.value_json, null),
    confidence: row.confidence,
    evidence: parseJson(row.evidence_json),
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at
  };
}

export function saveDiagnosticDocumentCandidates({ sessionId, accountId, fileId, candidates = [] }) {
  const now = new Date().toISOString();
  const insert = database.prepare(`INSERT INTO diagnostic_document_candidates (id, session_id, account_id, file_id, candidate_type, target_key, value_json, confidence, evidence_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`);
  database.prepare("DELETE FROM diagnostic_document_candidates WHERE session_id = ? AND file_id = ? AND status = 'pending'").run(sessionId, fileId);
  for (const candidate of candidates) {
    const candidateType = candidate.candidateType === "fact" ? "fact" : "field";
    const targetKey = candidate.targetKey || candidate.targetFieldPath;
    if (!targetKey || candidate.value == null) continue;
    insert.run(candidate.candidateId || identifier("doc_candidate"), sessionId, accountId, fileId, candidateType, targetKey, JSON.stringify(candidate.value), Number(candidate.confidence) || 0.7, JSON.stringify(candidate.evidence || []), now);
  }
  return listDiagnosticDocumentCandidates(sessionId);
}

export function listDiagnosticDocumentCandidates(sessionId) {
  return database.prepare("SELECT * FROM diagnostic_document_candidates WHERE session_id = ? ORDER BY created_at, id").all(sessionId).map(documentCandidateRow);
}

export function getDiagnosticDocumentCandidate(candidateId) {
  const row = database.prepare("SELECT * FROM diagnostic_document_candidates WHERE id = ?").get(candidateId);
  return row ? documentCandidateRow(row) : null;
}

export function setDiagnosticDocumentCandidateStatus(candidateId, status) {
  if (!["confirmed", "rejected"].includes(status)) throw new Error("Unsupported document candidate status");
  database.prepare("UPDATE diagnostic_document_candidates SET status = ?, decided_at = ? WHERE id = ?").run(status, new Date().toISOString(), candidateId);
  return getDiagnosticDocumentCandidate(candidateId);
}

export async function deleteKnowledgeFile(id, { workspaceId = null, companyId = null } = {}) {
  const row = database.prepare("SELECT stored_name FROM knowledge_files WHERE id = ? AND (? IS NULL OR workspace_id = ?) AND (? IS NULL OR company_id = ?)").get(id, workspaceId, workspaceId, companyId, companyId);
  if (!row) return false;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM knowledge_chunks_fts WHERE file_id = ?").run(id);
    database.prepare("DELETE FROM knowledge_files WHERE id = ?").run(id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  if (row.stored_name) await unlink(join(uploadRoot, row.stored_name)).catch(() => undefined);
  return true;
}

function searchTerms(query) {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, " ");
  const words = normalized.split(/\s+/).filter((item) => item.length >= 2);
  const chinese = [...normalized.matchAll(/[\u4e00-\u9fff]{2,}/g)].flatMap(([value]) => value.length <= 4 ? [value] : Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
  return [...new Set([...words, ...chinese])].slice(0, 40);
}

export function searchKnowledge({ query, folderIds = [], limit = 8, workspaceId = null, companyId = null }) {
  if (!folderIds.length) return { query, items: [], files: [] };
  const placeholders = folderIds.map(() => "?").join(",");
  const rows = database.prepare(`SELECT c.id AS chunk_id, c.content, c.chunk_index, f.id AS file_id, f.folder_id, f.name AS file_name, f.tags_json, f.description FROM knowledge_chunks c JOIN knowledge_files f ON f.id = c.file_id WHERE f.parse_status = 'ready' AND f.library_status = 'knowledge' AND f.folder_id IN (${placeholders}) AND (? IS NULL OR f.workspace_id = ?) AND (? IS NULL OR f.company_id = ?) LIMIT 1000`).all(...folderIds, workspaceId, workspaceId, companyId, companyId);
  const terms = searchTerms(query);
  const ranked = rows.map((row) => {
    const haystack = `${row.file_name} ${row.tags_json} ${row.description} ${row.content}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? (row.content.toLowerCase().includes(term) ? 3 : 1) : 0), 0);
    return { ...row, score };
  }).filter((row) => row.score > 0 || rows.length <= limit).sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index).slice(0, limit);
  const items = ranked.map((row, index) => ({ citationId: `K${index + 1}`, chunkId: row.chunk_id, fileId: row.file_id, folderId: row.folder_id, fileName: row.file_name, chunkIndex: row.chunk_index, text: row.content, score: row.score }));
  const files = [...new Map(items.map((item) => [item.fileId, { id: item.fileId, folderId: item.folderId, name: item.fileName, kind: "document" }])).values()];
  return { query, items, files };
}

export function getKnowledgeEvidenceForFiles({ fileIds = [], limitPerFile = 4, workspaceId = null, companyId = null } = {}) {
  const ids = [...new Set(fileIds.map(String).filter(Boolean))];
  if (!ids.length) return { items: [], files: [] };
  const placeholders = ids.map(() => "?").join(",");
  const rows = database.prepare(`SELECT * FROM knowledge_files WHERE id IN (${placeholders}) AND parse_status = 'ready' AND library_status = 'knowledge' AND (? IS NULL OR workspace_id = ?) AND (? IS NULL OR company_id = ?) ORDER BY created_at, id`).all(...ids, workspaceId, workspaceId, companyId, companyId);
  const files = rows.map(fileRow);
  const items = [];
  for (const file of files) {
    const chunks = database.prepare("SELECT id, chunk_index, content FROM knowledge_chunks WHERE file_id = ? ORDER BY chunk_index LIMIT ?").all(file.id, Math.max(1, Number(limitPerFile) || 4));
    for (const chunk of chunks) {
      items.push({
        citationId: `K${items.length + 1}`,
        chunkId: chunk.id,
        fileId: file.id,
        folderId: file.folderId,
        fileName: file.name,
        chunkIndex: chunk.chunk_index,
        text: chunk.content,
        score: 100,
        selectionSource: "user_confirmed_exact_file"
      });
    }
  }
  return { items, files };
}

export function createKnowledgeSnapshot({ contentTaskId = null, query, folderIds, citations, workspaceId = DEFAULT_WORKSPACE_ID, companyId = DEFAULT_COMPANY_ID, socialAccountId = null }) {
  const snapshot = { id: identifier("knowledge_snapshot"), contentTaskId, query, folderIds, citations, workspaceId, companyId, socialAccountId, createdAt: new Date().toISOString() };
  database.prepare(`INSERT INTO knowledge_snapshots (id, content_task_id, query, folder_ids_json, citations_json, workspace_id, company_id, social_account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(snapshot.id, contentTaskId, query, JSON.stringify(folderIds), JSON.stringify(citations), workspaceId, companyId, socialAccountId, snapshot.createdAt);
  return snapshot;
}

export function attachSnapshotToTask(snapshotId, contentTaskId) {
  database.prepare("UPDATE knowledge_snapshots SET content_task_id = ? WHERE id = ?").run(contentTaskId, snapshotId);
}

export function getKnowledgeSnapshot(id) {
  const row = id ? database.prepare("SELECT * FROM knowledge_snapshots WHERE id = ?").get(id) : null;
  return row ? { id: row.id, contentTaskId: row.content_task_id, query: row.query, folderIds: parseJson(row.folder_ids_json), citations: parseJson(row.citations_json), workspaceId: row.workspace_id, companyId: row.company_id, socialAccountId: row.social_account_id, createdAt: row.created_at } : null;
}

export async function readStoredKnowledgeFile(fileId) {
  const row = database.prepare("SELECT stored_name FROM knowledge_files WHERE id = ?").get(fileId);
  if (!row?.stored_name) return null;
  return readFile(join(uploadRoot, row.stored_name));
}

export function buildDesignDnaSourceFiles(fileIds = []) {
  return [...new Set(fileIds)].map((fileId) => {
    const file = getKnowledgeFile(fileId);
    if (!file) return null;
    const chunks = database.prepare("SELECT content FROM knowledge_chunks WHERE file_id = ? ORDER BY chunk_index LIMIT 8").all(fileId);
    return {
      ...file,
      extractedTextSummary: chunks.map((item) => item.content).join("\n").slice(0, 3000)
    };
  }).filter(Boolean);
}
