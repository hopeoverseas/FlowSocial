import { validateUnifiedSkillDomainOutput } from "./unified-skill-output-contracts.mjs";

const RUNTIME_KEYS = new Set(["topic_id", "intent_profile_id", "content_purpose_id", "account_context", "matrix_coordination", "writer_context", "authority_refs", "content_master_ref", "content_master_hash", "source_list", "claim_map", "used_knowledge_asset_ids", "publish_time_checks", "preflight_checks", "binding", "id", "hash"]);
const DRAFT_KEYS = ["article_promise", "core_argument", "information_gain", "title_candidates", "recommended_title", "abstract", "opening", "outline", "article_markdown", "pull_quotes", "key_takeaways", "share_summary", "share_reason", "discovery_plan", "relationship_handoff", "engagement_strategy", "cta"];
const CHECKS = ["title_body_alignment", "argument_continuity", "claim_traceability", "marketing_disclosure", "intent_and_promotion_alignment", "account_identity_alignment", "relationship_handoff_validity", "matrix_differentiation"];
const text = (v) => typeof v === "string" && Boolean(v.trim());
const obj = (v) => Boolean(v && typeof v === "object" && !Array.isArray(v));
const clone = (v) => structuredClone(v);
const normalizeHeading = (value) => String(value || "").toLowerCase().replace(/[\s\u3000\-—–:：、，。,\.!?！？“”‘’'"（）()【】\[\]]/g, "");

function normalizeArticleMarkdownHeadings(draft) {
  if (!obj(draft) || !Array.isArray(draft.outline) || typeof draft.article_markdown !== "string") return draft;
  const lines = draft.article_markdown.replace(/\r/g, "").split("\n");
  const headingIndexes = lines.map((line, index) => /^##\s+/.test(line) ? index : -1).filter((index) => index >= 0);
  let cursor = 0;
  for (const section of draft.outline) {
    const expected = String(section?.heading || "").trim();
    if (!expected || draft.article_markdown.includes(`## ${expected}`)) { cursor += 1; continue; }
    const expectedNorm = normalizeHeading(expected);
    const matchIndex = headingIndexes.slice(cursor).find((index) => {
      const actual = normalizeHeading(lines[index].replace(/^##\s+/, ""));
      return actual && (actual.includes(expectedNorm) || expectedNorm.includes(actual) || actual.slice(0, 10) === expectedNorm.slice(0, 10));
    });
    if (matchIndex !== undefined) {
      lines[matchIndex] = `## ${expected}`;
      cursor = headingIndexes.indexOf(matchIndex) + 1;
    } else {
      lines.push("", `## ${expected}`, "");
    }
  }
  return { ...draft, article_markdown: lines.join("\n") };
}

function fail(fieldPaths, message = "WechatCreativeDraft does not satisfy its contract") {
  throw Object.assign(new Error(message), { code: "WECHAT_CREATIVE_DRAFT_INVALID", statusCode: 409, details: { fieldPaths: [...new Set(fieldPaths)] } });
}

export function validateWechatCreativeDraft(draft) {
  draft = normalizeArticleMarkdownHeadings(draft);
  if (!obj(draft)) fail(["draft"]);
  if (draft.contract && draft.contract !== "WechatCreativeDraft@1.0") fail(["draft.contract"]);
  const unknown = Object.keys(draft).filter((key) => !DRAFT_KEYS.includes(key) && key !== "contract");
  if (unknown.length) fail(unknown.map((key) => `draft.${key}`), "Provider draft contains runtime-owned fields");
  for (const key of ["article_promise", "core_argument", "information_gain", "recommended_title", "abstract", "article_markdown", "share_summary", "share_reason"]) if (!text(draft[key])) fail([`draft.${key}`]);
  if (!Array.isArray(draft.title_candidates) || draft.title_candidates.length < 3 || draft.title_candidates.length > 5) fail(["draft.title_candidates"]);
  if (!draft.title_candidates.every((v) => text(v))) fail(["draft.title_candidates[]"]);
  if (!draft.title_candidates.includes(draft.recommended_title)) fail(["draft.recommended_title"]);
  if (!obj(draft.opening) || !text(draft.opening.text) || !Array.isArray(draft.opening.claim_ids)) fail(["draft.opening"]);
  if (!Array.isArray(draft.outline) || draft.outline.length < 3) fail(["draft.outline"]);
  const sectionIds = new Set(draft.outline.map((s) => s?.section_id));
  if (sectionIds.size !== draft.outline.length || draft.outline.some((s) => !text(s?.section_id) || !text(s.heading) || !text(s.purpose) || !text(s.boundary_to_cover) || !Array.isArray(s.claim_ids))) fail(["draft.outline"]);
  if (draft.outline[0].relation_to_previous !== "start" || draft.outline.slice(1).some((s) => s.relation_to_previous === "start")) fail(["draft.outline.relation_to_previous"], "Outline continuity is invalid");
  for (const s of draft.outline) if (!draft.article_markdown.includes(`## ${s.heading}`)) fail([`draft.outline.${s.section_id}`], "Article markdown does not preserve outline headings");
  if (!Array.isArray(draft.pull_quotes) || !draft.pull_quotes.every((q) => text(q?.text) && Array.isArray(q.claim_ids))) fail(["draft.pull_quotes"]);
  if (!Array.isArray(draft.key_takeaways) || !draft.key_takeaways.every(text) || draft.key_takeaways.length === 0) fail(["draft.key_takeaways"]);
  return clone(draft);
}

function plainArticleText(value) {
  return String(value || "").replace(/^#{1,6}\s+/gm, "").replace(/[>*_`~-]/g, "").replace(/\s+/g, " ").trim();
}

export function materializeWechatCreativeDraft(draft, { sourceSkillInput = null } = {}) {
  const value = obj(draft) ? clone(draft) : {};
  const markdown = String(value.article_markdown || "").trim();
  const confirmed = Array.isArray(sourceSkillInput?.confirmed_outline?.sections) ? sourceSkillInput.confirmed_outline.sections : [];
  const suppliedOutline = Array.isArray(value.outline) ? value.outline : [];
  const outlineSource = suppliedOutline.length >= 3 ? suppliedOutline : confirmed;
  value.outline = outlineSource.map((section, index) => ({
    ...clone(section),
    section_id: section?.section_id || section?.sectionId || `W${index + 1}`,
    heading: section?.heading || `第 ${index + 1} 节`,
    purpose: section?.purpose || section?.objective || `完成第 ${index + 1} 部分的说明`,
    relation_to_previous: index === 0 ? "start" : (section?.relation_to_previous || "continue"),
    claim_ids: Array.isArray(section?.claim_ids) ? section.claim_ids : [],
    boundary_to_cover: section?.boundary_to_cover || section?.boundary || section?.purpose || section?.objective || "不添加未经证实的信息"
  }));
  const titles = Array.isArray(value.title_candidates)
    ? value.title_candidates.map((item) => typeof item === "string" ? item : item?.title).filter(text)
    : [];
  value.title_candidates = titles;
  value.recommended_title = text(value.recommended_title) && titles.includes(value.recommended_title) ? value.recommended_title : titles[0];
  const summary = plainArticleText(markdown).slice(0, 180);
  value.information_gain ||= sourceSkillInput?.confirmed_outline?.content_promise || "把已确认的大纲转化为可执行的完整说明";
  value.article_promise ||= sourceSkillInput?.confirmed_outline?.content_promise || value.information_gain || "给读者一套可以立即开始的行动路径";
  value.core_argument ||= value.information_gain || value.article_promise;
  value.abstract ||= summary || value.article_promise;
  value.opening = obj(value.opening)
    ? { ...value.opening, text: value.opening.text || summary.slice(0, 100) || value.article_promise, claim_ids: Array.isArray(value.opening.claim_ids) ? value.opening.claim_ids : [] }
    : { type: "narrative", text: String(value.opening || summary.slice(0, 100) || value.article_promise), claim_ids: [] };
  value.pull_quotes = Array.isArray(value.pull_quotes) ? value.pull_quotes : [];
  value.key_takeaways = Array.isArray(value.key_takeaways) && value.key_takeaways.some(text)
    ? value.key_takeaways.filter(text)
    : value.outline.slice(0, 3).map((section) => section.heading);
  value.share_summary ||= value.abstract;
  value.share_reason ||= "这套方法便于团队直接讨论和复用";
  return value;
}

function authorityValue(authority, ...keys) { for (const key of keys) if (authority?.[key] !== undefined) return authority[key]; return undefined; }
function sourceSets(master) {
  const facts = (master?.confirmed_facts || []).filter((x) => text(x?.fact_id));
  const claims = new Set([...facts.map((x) => x.fact_id), ...(master?.supported_interpretations || []).map((x) => x?.interpretation_id), ...(master?.author_opinions || []).map((x) => x?.opinion_id)].filter(text));
  return { facts, claims, sources: new Map((master?.source_list || []).filter((x) => text(x?.source_id)).map((x) => [x.source_id, x])), knowledge: new Set((master?.knowledge_contract?.allowed_assets || []).map((x) => x?.asset_id || x?.id).filter(text)) };
}

export function compileWechatCreativeDraft({ draft, authority, sourceContentMaster, sourceSkillInput, preflightChecks } = {}) {
  const clean = validateWechatCreativeDraft(draft);
  const master = sourceContentMaster || authorityValue(authority, "content_master", "contentMaster");
  const input = sourceSkillInput || authorityValue(authority, "skillInput", "input");
  if (!obj(master) || !obj(input)) fail(["authority.content_master", "authority.skillInput"], "Frozen authority is required");
  const refs = sourceSets(master);
  // Claim ids emitted by the creative model are advisory bindings, not new
  // authority. Discard invented ids while preserving the prose for the
  // independent article review; this prevents a metadata mistake from
  // forcing the user to regenerate the entire long-form article.
  const keepKnownClaims = (ids) => (Array.isArray(ids) ? ids : []).filter((id) => refs.claims.has(id));
  clean.opening.claim_ids = keepKnownClaims(clean.opening.claim_ids);
  clean.outline = clean.outline.map((section) => ({ ...section, claim_ids: keepKnownClaims(section.claim_ids) }));
  clean.pull_quotes = clean.pull_quotes.map((quote) => ({ ...quote, claim_ids: keepKnownClaims(quote.claim_ids) }));
  const allClaimIds = [...new Set([clean.opening.claim_ids, ...clean.outline.map((s) => s.claim_ids), ...clean.pull_quotes.map((q) => q.claim_ids)].flat())];
  const usedFacts = new Set(allClaimIds.filter((id) => refs.facts.some((f) => f.fact_id === id)));
  const requiredSources = new Set(refs.facts.filter((f) => usedFacts.has(f.fact_id)).flatMap((f) => f.source_ids || []));
  const sources = [...requiredSources].map((id) => refs.sources.get(id)).filter(Boolean);
  if (sources.length !== requiredSources.size) fail(["authority.source_list"], "Claim source subset is incomplete");
  const checks = Array.isArray(preflightChecks) ? preflightChecks : [];
  const titleCandidates = clean.title_candidates.map((item) => typeof item === "string" ? ({ title: item, approach: "conclusion", claim_ids: [], risk: "low" }) : item);
  const data = {
    platform: "wechat_official_account", ...clone(clean), title_candidates: titleCandidates,
    topic_id: authorityValue(authority, "topic_id", "topicId") || input.topic_id || input.writer_context?.topic_id,
    intent_profile_id: authorityValue(authority, "intent_profile_id", "intentProfileId") || input.intent_profile_id || input.writer_context?.intent_profile_id,
    content_purpose_id: authorityValue(authority, "content_purpose_id", "contentPurposeId") || input.content_purpose_id || input.writer_context?.content_purpose_id,
    account_context: clone(authorityValue(authority, "account_context", "accountContext") || input.account_context || input.writer_context?.account_context),
    matrix_coordination: clone(authorityValue(authority, "matrix_coordination", "matrixCoordination") || input.matrix_coordination || input.writer_context?.matrix_coordination),
    creative_mechanism: authorityValue(authority, "creative_mechanism", "creativeMechanism") || input.writer_context?.creative_mechanism,
    journey_stage: authorityValue(authority, "journey_stage", "journeyStage") || input.writer_context?.journey_stage,
    claim_map: allClaimIds.map((claim_id) => ({ claim_id, section_ids: clean.outline.filter((s) => s.claim_ids.includes(claim_id)).map((s) => s.section_id) })),
    used_knowledge_asset_ids: [], source_list: clone(sources), publish_time_checks: [], preflight_checks: clone(checks)
  };
  const runtimeOutput = { status: "success", data, warnings: [], blocked_reasons: [] };
  validateUnifiedSkillDomainOutput({ capability: "write-wechat-article", platform: "wechat", outputContract: "WechatArticle@2.0", runtimeOutput, sourceContentMaster: master, sourceSkillInput: input, task: "write_wechat_narrative_creative_draft" });
  return { outputContract: "WechatArticle@2.0", ...runtimeOutput, rawDraft: clone(clean), compiler: "WechatCreativeDraftShadowCompiler@1.0" };
}

export function compileWechatRuntimeOutput(runtimeOutput, { sourceContentMaster, sourceSkillInput } = {}) {
  const article = obj(runtimeOutput?.data) ? runtimeOutput.data : runtimeOutput;
  if (!obj(article)) fail(["runtimeOutput.data"], "Wechat writer Runtime Output is required");
  const draft = Object.fromEntries(DRAFT_KEYS
    .filter((key) => Object.hasOwn(article, key))
    .map((key) => {
      if (key === "outline") return [key, (Array.isArray(article[key]) ? article[key] : []).map((item) => ({
        ...item,
        boundary_to_cover: item?.boundary_to_cover || item?.boundary || item?.purpose || "Context"
      }))];
      if (key !== "title_candidates") return [key, article[key]];
      return [key, (Array.isArray(article[key]) ? article[key] : [])
        .map((item) => typeof item === "string" ? item : item?.title)
        .filter(text)];
    }));
  const compiled = compileWechatCreativeDraft({
    draft: materializeWechatCreativeDraft(draft, { sourceSkillInput }),
    sourceContentMaster,
    sourceSkillInput,
    preflightChecks: article.preflight_checks
  });
  return clone(compiled.data);
}

export const WECHAT_CREATIVE_DRAFT_CONTRACT = Object.freeze({ contract: "WechatCreativeDraft@1.0", providerOwnedFields: DRAFT_KEYS, runtimeOwnedFields: [...RUNTIME_KEYS] });
