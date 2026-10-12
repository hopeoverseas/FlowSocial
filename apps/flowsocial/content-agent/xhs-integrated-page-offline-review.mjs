import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { validatePageAssetRevision, validatePageCandidate, validatePageNormalizationRecord, validateXhsVisualSetSnapshot } from "../image-providers/xhs-integrated-page/vertical-contracts.mjs";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export async function writeOfflineReviewPreview({ store, snapshot, candidates, revisions, normalizations, relativePath = "review/index.html", flags }) {
  if (flags?.xhsIntegratedPageOfflineReview !== true) throw new Error("XHS_INTEGRATED_PAGE_OFFLINE_REVIEW_FLAG_DISABLED");
  validateXhsVisualSetSnapshot(snapshot);
  const candidateByPage = new Map(candidates.map((item) => { validatePageCandidate(item); return [item.pageId, item]; }));
  const revisionById = new Map(revisions.map((item) => { validatePageAssetRevision(item); return [item.id, item]; }));
  const normalizationById = new Map(normalizations.map((item) => { validatePageNormalizationRecord(item); return [item.id, item]; }));
  const cards = snapshot.pages.map((page) => {
    const candidate = candidateByPage.get(page.pageId); const revision = revisionById.get(page.revisionRef.id); const normalization = revision && normalizationById.get(revision.normalizationRef.id);
    if (!candidate || !revision || !normalization) throw new Error(`OFFLINE_REVIEW_REFERENCE_MISSING:${page.pageId}`);
    return `<article><h2>${escape(page.pageId)}</h2><img src="../${escape(revision.asset.relativePath)}" alt="${escape(page.pageId)} offline preview"><dl>` +
      `<dt>provider native</dt><dd>${candidate.providerNativeDimensions.width}×${candidate.providerNativeDimensions.height} (${escape(candidate.providerNativeDimensionStatus)})</dd>` +
      `<dt>normalization</dt><dd>${escape(normalization.mode)} / ${escape(normalization.status)}</dd>` +
      `<dt>final canvas</dt><dd>${normalization.outputDimensions.width}×${normalization.outputDimensions.height} (${escape(candidate.finalCanvasStatus)})</dd>` +
      `<dt>text / fact / visual</dt><dd>${escape(candidate.textStatus)} / ${escape(candidate.factStatus)} / ${escape(candidate.visualStatus)}</dd>` +
      `<dt>source / revision</dt><dd>${escape(page.source)} / ${escape(revision.id)}</dd>` +
      `<dt>selection / cost</dt><dd>selected / ${escape(candidate.costStatus)}</dd>` +
      `<dt>blockers</dt><dd>${escape(candidate.blockers.map((item) => item.code).join(", ") || "none")}</dd></dl></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FlowSocial offline visual review</title><style>body{font:16px system-ui;background:#f4f2ed;color:#171717;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}article{background:white;padding:16px;border:1px solid #bbb;border-radius:12px}img{width:100%;aspect-ratio:3/4;object-fit:contain;background:#ddd}dt{font-weight:700;margin-top:8px}dd{margin-left:0}</style><h1>离线审阅预览</h1><p>仅供人工审阅；不代表真实 Provider 视觉质量通过，不写生产 UI。</p><main>${cards}</main></html>`;
  if (/https?:\/\//i.test(html)) throw new Error("OFFLINE_REVIEW_NETWORK_REFERENCE_FORBIDDEN");
  const target = store.resolveForRead(relativePath); await mkdir(dirname(target), { recursive: true }); await writeFile(target, html, "utf8");
  return { relativePath, previewHash: stableHash(html), pageCount: snapshot.pages.length, boundary: "offline_review_only" };
}
