import sharp from "sharp";
import { hashWechatArtifactValue } from "./wechat-image-plan-adapter.mjs";

const clone = (value) => structuredClone(value);
const clean = (value) => String(value ?? "").trim();

function xml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function html(value) {
  return xml(value);
}

function textLines(value, max = 16, limit = 3) {
  const source = clean(value).replace(/\s+/g, "");
  const lines = [];
  for (let index = 0; index < source.length; index += max) lines.push(source.slice(index, index + max));
  return lines.slice(0, limit);
}

function articleTitle(article) {
  return clean(article?.recommended_title || article?.title || clean(article?.article_markdown).match(/^##\s+(.+)$/m)?.[1]) || "公众号内容方案";
}

function sectionTitle(article, sectionId) {
  const section = (article?.outline || []).find((item) => clean(item.section_id) === clean(sectionId));
  return clean(section?.heading || section?.title || section?.section_title) || articleTitle(article);
}

function compact(value, max = 13) {
  const source = clean(value)
    .replace(/^第[一二三四五六七八九十0-9]+[步部分章节][:：、.\s-]*/, "")
    .replace(/[。！？!?；;，,：:].*$/, "")
    .replace(/[“”"'《》【】]/g, "")
    .replace(/\s+/g, "");
  return source.slice(0, max);
}

function markdownSections(article) {
  const outline = Array.isArray(article?.outline) ? article.outline : [];
  const chunks = clean(article?.article_markdown).split(/^##\s+/m).slice(1);
  return chunks.map((chunk, index) => {
    const lines = chunk.split(/\r?\n/);
    const heading = clean(lines.shift());
    const body = clean(lines.join("\n"));
    return {
      sectionId: clean(outline[index]?.section_id),
      heading: heading || sectionTitle(article, outline[index]?.section_id),
      body
    };
  });
}

function semanticPhrases(value, fallback = []) {
  const phrases = clean(value)
    .replace(/^[-*]\s+/gm, "")
    .split(/[。！？!?；;，,、\n]+/)
    .map((item) => compact(item))
    .filter((item) => item.length >= 2);
  const selected = [...new Set(phrases)];
  for (const item of fallback) {
    const label = compact(item);
    if (selected.length >= 4) break;
    if (label && !selected.includes(label)) selected.push(label);
  }
  return selected.slice(0, 4);
}

function illustrationDefinition({ declaration, article }) {
  const cover = declaration.role === "cover";
  const sections = markdownSections(article);
  const section = sections.find((item) => item.sectionId === clean(declaration.afterSectionId))
    || sections.find((item) => item.heading === sectionTitle(article, declaration.afterSectionId));
  const outlineLabels = (article?.outline || []).map((item) => item?.heading || item?.title || item?.section_title).filter(Boolean);
  const summarySource = cover
    ? article?.core_argument || article?.article_promise || article?.abstract || article?.opening
    : section?.body;
  const summary = compact(summarySource, 22);
  const labels = semanticPhrases(summarySource, cover ? outlineLabels : [section?.heading])
    .filter((item) => compact(item, 22) !== summary)
    .slice(0, 4);
  return {
    schemaVersion: "1.0",
    contract: "LocalWechatSemanticIllustration@1.0",
    renderer: "flowsocial-local-svg-sharp-v2",
    role: declaration.role,
    slotId: declaration.slotId,
    visualType: cover ? "article_concept_map" : "section_explanation_map",
    contextLabel: cover ? "文章核心框架" : sectionTitle(article, declaration.afterSectionId),
    summary: summary || compact(labels[0], 22),
    labels: labels.length >= 2 ? labels : [...labels, "理解问题", "采取行动"].slice(0, 3),
    palette: ["#D71018", "#231815", "#F6F2EC", "#FFFFFF"],
    visibleTextPolicy: "content_derived_short_labels",
    externalProviderCalls: 0
  };
}

function renderSvg(definition) {
  const summaryLines = textLines(definition.summary, 13, 2);
  const summary = summaryLines.map((line, index) => `<text x="82" y="${190 + index * 64}" font-size="48" font-weight="700" fill="#231815">${xml(line)}</text>`).join("");
  const labels = definition.labels.slice(0, 4);
  const startX = labels.length === 4 ? 520 : 570;
  const gap = labels.length === 4 ? 150 : 180;
  const nodes = labels.map((label, index) => {
    const x = startX + index * gap;
    const active = index === 0;
    const nodeLines = textLines(compact(label, 10), 5, 2);
    const nodeText = nodeLines.map((line, lineIndex) => `<text x="${x + 60}" y="${370 + lineIndex * 25}" text-anchor="middle" font-size="18" font-weight="600" fill="${active ? "#FFFFFF" : "#231815"}">${xml(line)}</text>`).join("");
    const connector = index === labels.length - 1 ? "" : `<path d="M ${x + 120} 351 L ${x + gap - 18} 351" stroke="#D71018" stroke-width="4" stroke-linecap="round"/><path d="M ${x + gap - 28} 341 L ${x + gap - 18} 351 L ${x + gap - 28} 361" fill="none" stroke="#D71018" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `${connector}<rect x="${x}" y="286" width="120" height="136" rx="22" fill="${active ? "#D71018" : "#FFFFFF"}" stroke="${active ? "#D71018" : "#D8CEC5"}" stroke-width="2"/><circle cx="${x + 60}" cy="323" r="15" fill="${active ? "#FFFFFF" : "#D71018"}" opacity="${active ? "0.95" : "0.16"}"/>${nodeText}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#F6F2EC"/>
    <rect x="0" y="0" width="22" height="630" fill="#D71018"/>
    <path d="M 35 512 C 210 425, 330 590, 500 500 S 840 422, 1180 515" fill="none" stroke="#D71018" stroke-width="52" opacity="0.07"/>
    <circle cx="1090" cy="80" r="145" fill="#231815" opacity="0.04"/>
    <text x="82" y="102" font-size="24" font-weight="600" fill="#D71018">${xml(definition.contextLabel)}</text>
    ${summary}
    <circle cx="440" cy="351" r="78" fill="#231815"/>
    <circle cx="440" cy="351" r="46" fill="#F6F2EC"/>
    <circle cx="440" cy="351" r="18" fill="#D71018"/>
    ${nodes}
    <text x="82" y="562" font-size="22" fill="#5B514B">把核心观点拆成清晰、可执行的路径</text>
  </svg>`;
}

export function buildLocalWechatImagePlan(article, { planId }) {
  const sections = Array.isArray(article?.outline) ? article.outline : [];
  const selected = sections.filter((_, index) => index === 0 || index === Math.floor(sections.length / 2) || index === sections.length - 1)
    .filter((item, index, list) => list.findIndex((other) => other?.section_id === item?.section_id) === index)
    .slice(0, 3);
  return {
    status: "success",
    data: {
      plan_id: planId,
      cover: { purpose: "mood", strategy: "html_chart", asset_id: "wechat_cover_card", claim_ids: [], image_spec: null },
      slots: selected.map((section, index) => ({
        slot_id: `section_card_${index + 1}`,
        after_section_id: section?.section_id,
        purpose: "explain",
        strategy: "html_chart",
        asset_id: `wechat_section_card_${index + 1}`,
        claim_ids: [],
        image_spec: null
      }))
    },
    warnings: [],
    blocked_reasons: []
  };
}

export function createLocalWechatIllustrationResolver() {
  return async ({ declaration, article }) => {
    const definition = illustrationDefinition({ declaration, article });
    const bytes = await sharp(Buffer.from(renderSvg(definition), "utf8")).png().toBuffer();
    return {
      bytes,
      extension: ".png",
      evidence: { deterministic: true, definition: clone(definition), definitionHash: hashWechatArtifactValue(definition) }
    };
  };
}

function figure(resource, label) {
  return resource ? `<figure style="margin:24px 0"><img src="${html(resource.relativePath)}" alt="${html(label)}" style="display:block;width:100%;height:auto;border-radius:12px" /></figure>` : "";
}

export async function formatWechatIllustratedHtml({ article, canonicalPlan, resources }) {
  const bySlot = new Map((resources || []).map((item) => [item.slotId, item]));
  const cover = figure(bySlot.get("cover"), `${articleTitle(article)}封面`);
  const slotsBySection = new Map((canonicalPlan?.slots || []).map((slot) => [slot.afterSectionId, bySlot.get(slot.slotId)]));
  const sectionIds = (article?.outline || []).map((item) => item.section_id);
  let sectionIndex = -1;
  const body = clean(article?.article_markdown).split(/\r?\n/).map((line) => {
    if (/^##\s+/.test(line)) {
      sectionIndex += 1;
      const heading = line.replace(/^##\s+/, "");
      const card = figure(slotsBySection.get(sectionIds[sectionIndex]), `${heading}配图`);
      return `<h2>${html(heading)}</h2>${card}`;
    }
    if (!line.trim()) return "";
    return `<p>${html(line)}</p>`;
  }).join("\n");
  return `<article style="max-width:760px;margin:0 auto;color:#231815;line-height:1.8">${cover}${body}</article>`;
}
