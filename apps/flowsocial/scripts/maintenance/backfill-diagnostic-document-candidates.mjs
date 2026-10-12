import { database } from "../../storage.mjs";
import { extractKnowledgeCandidateFacts, saveDiagnosticDocumentCandidates } from "../../knowledge-base.mjs";

const links = database.prepare(`SELECT l.session_id, l.account_id, l.file_id FROM diagnostic_knowledge_links l LEFT JOIN diagnostic_document_candidates c ON c.session_id = l.session_id AND c.file_id = l.file_id WHERE l.status = 'linked' GROUP BY l.session_id, l.file_id HAVING SUM(CASE WHEN c.status IN ('confirmed','rejected') THEN 1 ELSE 0 END) = 0`).all();
let backfilled = 0;
for (const link of links) {
  database.prepare("DELETE FROM diagnostic_document_candidates WHERE session_id = ? AND file_id = ? AND status = 'pending'").run(link.session_id, link.file_id);
  const extracted = extractKnowledgeCandidateFacts(link.file_id);
  const text = [extracted.summary, ...(extracted.citations || []).map((item) => item.excerpt)].join("\n");
  const evidence = (extracted.citations || []).slice(0, 2);
  const candidates = [...extracted.candidates.map((item) => ({ ...item, candidateType: "field", targetKey: item.targetFieldPath, confidence: 0.75, evidence }))];
  const push = (targetFieldPath, value, confidence) => { if (value != null && value !== "" && (!Array.isArray(value) || value.length)) candidates.push({ candidateType: "field", targetFieldPath, targetKey: targetFieldPath, value, confidence, evidence }); };
  const offers = [...new Set(["企业知识库", "AI员工", "定制智能体", "AI工作流", "SaaS帮助中心", "智能搜索", "海外仓", "跨境物流", "供应链解决方案", "数字化营销", "营销运营", "全链路供应链服务"].filter((term) => text.includes(term)))];
  const serviceMatch = text.match(/(?:提供|主营|核心业务(?:包括|是)?)[：:]?([^。；\n]{3,100})/);
  if (!offers.length && serviceMatch?.[1]) offers.push(serviceMatch[1].trim());
  push("business.primaryOffers", offers, 0.82);
  const models = [text.includes("SaaS") ? "SaaS订阅" : "", /私有化|本地部署/.test(text) ? "私有化部署" : "", /项目制|定制交付/.test(text) ? "项目制交付" : ""].filter(Boolean);
  push("business.businessModel", models.join("＋"), 0.76);
  const audience = text.match(/(?:主要客户|目标客户|面向|服务于|专注于为)(?:是|为|包括)?([^。；\n]{3,100}?)(?:提供|，|。|；|\n)/)?.[1];
  push("audiences.primary", audience?.split(/[、，,及和]/).map((item) => item.trim()).filter(Boolean), 0.68);
  const constraints = [...new Set(text.split(/[。；\n]/).filter((line) => /不能|不得|禁止|必须有来源|脱敏|授权|公开边界|合规要求|合规限制|需遵守|避免/.test(line)).map((line) => line.trim()).filter(Boolean))].slice(0, 8);
  push("accountStrategy.constraints", constraints, 0.79);
  saveDiagnosticDocumentCandidates({ sessionId: link.session_id, accountId: link.account_id, fileId: link.file_id, candidates: [...new Map(candidates.map((item) => [item.targetFieldPath, item])).values()] });
  backfilled += 1;
}
console.log(JSON.stringify({ scanned: links.length, backfilled }, null, 2));

