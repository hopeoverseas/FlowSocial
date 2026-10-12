export const STRATEGY_DOCUMENT_VERSION = "2.0";
export const ACTIVE_STRATEGY_SNAPSHOT_VERSION = "2.0";
export const FACT_SNAPSHOT_VERSION = "1.0";
export const CONTENT_STRATEGY_PROFILE_VERSION = "1.0";
export const CONTENT_DIRECTION_CARD_VERSION = "1.0";
export const CONTENT_EXECUTION_CONTEXT_VERSION = "1.0";

export const CONTENT_FUNCTIONS = Object.freeze(["discovery", "authority", "proof", "solution", "action"]);
export const SUPPORTED_CONTENT_PLATFORMS = Object.freeze(["xiaohongshu", "wechat"]);

const object = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value) => typeof value === "string" && Boolean(value.trim());
const list = (value) => Array.isArray(value) ? value : [];

export function adaptAccountPortfolioV1(portfolio = {}, accountStrategies = []) {
  const availableIds = list(accountStrategies).map((item) => item?.socialAccountId).filter(Boolean);
  const mode = ["single_account", "role_matrix"].includes(portfolio?.mode) ? portfolio.mode : "single_account";
  const requested = [...new Set(list(portfolio?.selectedSocialAccountIds || portfolio?.selectedAccountIds).filter((id) => availableIds.includes(id)))];
  const primarySocialAccountId = availableIds.includes(portfolio?.primarySocialAccountId) ? portfolio.primarySocialAccountId : requested[0] || null;
  const selectedSocialAccountIds = mode === "single_account" ? (primarySocialAccountId ? [primarySocialAccountId] : []) : requested;
  const accountRoles = Object.fromEntries(selectedSocialAccountIds.map((id) => [id, String(portfolio?.accountRoles?.[id] || "").trim() || (id === primarySocialAccountId ? "primary" : "supporting")]));
  const matrixCompatible = mode !== "role_matrix"
    || (selectedSocialAccountIds.length >= 2 && new Set(selectedSocialAccountIds.map((id) => accountRoles[id])).size === selectedSocialAccountIds.length);
  return { ...portfolio, mode, primarySocialAccountId, selectedSocialAccountIds, accountRoles, selectedAccountIds: selectedSocialAccountIds, compatibilityStatus: matrixCompatible ? "current" : "compatibility_required" };
}

function result(name, version, errors) {
  return { name, version, valid: errors.length === 0, errors };
}

function required(errors, condition, path, message = "is required") {
  if (!condition) errors.push({ path, message });
}

function validateWeightedPortfolio(errors, portfolio, path) {
  required(errors, object(portfolio), path, "must be an object");
  if (!object(portfolio)) return;
  for (const key of CONTENT_FUNCTIONS) {
    required(errors, Number.isFinite(Number(portfolio[key])) && Number(portfolio[key]) >= 0, `${path}.${key}`, "must be a non-negative number");
  }
  const total = CONTENT_FUNCTIONS.reduce((sum, key) => sum + Number(portfolio[key] || 0), 0);
  required(errors, Math.abs(total - 100) < 0.001, path, "weights must sum to 100");
}

function validateAudience(errors, audience, index, path = "strategy.audiences") {
  const prefix = `${path}[${index}]`;
  required(errors, object(audience), prefix, "must be an object");
  if (!object(audience)) return;
  required(errors, text(audience.id), `${prefix}.id`);
  required(errors, text(audience.name), `${prefix}.name`);
  required(errors, Number.isFinite(Number(audience.priority)), `${prefix}.priority`, "must be a number");
  for (const key of ["decisionRoles", "jobsToBeDone", "painPoints", "buyingTriggers", "commonObjections", "contentNeeds"]) {
    required(errors, Array.isArray(audience[key]), `${prefix}.${key}`, "must be an array");
  }
}

function validatePillar(errors, pillar, index, path = "strategy.contentSystem.pillars") {
  const prefix = `${path}[${index}]`;
  required(errors, object(pillar), prefix, "must be an object");
  if (!object(pillar)) return;
  required(errors, text(pillar.id), `${prefix}.id`);
  required(errors, text(pillar.name), `${prefix}.name`);
  required(errors, text(pillar.strategicPurpose), `${prefix}.strategicPurpose`);
  required(errors, Array.isArray(pillar.objectiveIds), `${prefix}.objectiveIds`, "must be an array");
  required(errors, Array.isArray(pillar.audienceIds), `${prefix}.audienceIds`, "must be an array");
  required(errors, Array.isArray(pillar.recommendedContentFunctions), `${prefix}.recommendedContentFunctions`, "must be an array");
}

export function validateStrategyDocumentV2(document) {
  const errors = [];
  required(errors, object(document), "$", "must be an object");
  if (!object(document)) return result("StrategyDocument", STRATEGY_DOCUMENT_VERSION, errors);
  required(errors, document.schemaVersion === STRATEGY_DOCUMENT_VERSION, "schemaVersion", `must equal ${STRATEGY_DOCUMENT_VERSION}`);
  required(errors, text(document.accountId), "accountId");

  const business = document.business;
  required(errors, object(business), "business", "must be an object");
  if (object(business)) {
    required(errors, text(business.businessModel), "business.businessModel");
    required(errors, text(business.valueProposition), "business.valueProposition");
    required(errors, Array.isArray(business.offers) && business.offers.length > 0, "business.offers", "must contain at least one offer");
    list(business.offers).forEach((offer, index) => {
      required(errors, object(offer), `business.offers[${index}]`, "must be an object");
      if (!object(offer)) return;
      required(errors, text(offer.id), `business.offers[${index}].id`);
      required(errors, text(offer.name), `business.offers[${index}].name`);
      required(errors, Array.isArray(offer.problemsSolved), `business.offers[${index}].problemsSolved`, "must be an array");
      required(errors, Array.isArray(offer.targetAudienceIds), `business.offers[${index}].targetAudienceIds`, "must be an array");
    });
  }

  const strategy = document.strategy;
  required(errors, object(strategy), "strategy", "must be an object");
  if (object(strategy)) {
    required(errors, text(strategy.growthStage), "strategy.growthStage");
    required(errors, text(strategy.operatingMode), "strategy.operatingMode");
    required(errors, Array.isArray(strategy.objectives) && strategy.objectives.length > 0, "strategy.objectives", "must contain at least one objective");
    required(errors, text(strategy.primaryObjectiveId), "strategy.primaryObjectiveId");
    const objectiveIds = new Set(list(strategy.objectives).map((item) => item?.id).filter(Boolean));
    required(errors, objectiveIds.has(strategy.primaryObjectiveId), "strategy.primaryObjectiveId", "must reference strategy.objectives");
    list(strategy.objectives).forEach((objective, index) => {
      required(errors, object(objective), `strategy.objectives[${index}]`, "must be an object");
      if (!object(objective)) return;
      required(errors, text(objective.id), `strategy.objectives[${index}].id`);
      required(errors, text(objective.type), `strategy.objectives[${index}].type`);
      required(errors, text(objective.label), `strategy.objectives[${index}].label`);
      required(errors, Number.isFinite(Number(objective.weight)), `strategy.objectives[${index}].weight`, "must be a number");
    });
    required(errors, object(strategy.positioning), "strategy.positioning", "must be an object");
    if (object(strategy.positioning)) {
      required(errors, text(strategy.positioning.category), "strategy.positioning.category");
      required(errors, text(strategy.positioning.positioningStatement), "strategy.positioning.positioningStatement");
      required(errors, Array.isArray(strategy.positioning.differentiators), "strategy.positioning.differentiators", "must be an array");
    }
    required(errors, Array.isArray(strategy.audiences) && strategy.audiences.length > 0, "strategy.audiences", "must contain at least one audience");
    list(strategy.audiences).forEach((audience, index) => validateAudience(errors, audience, index));
    required(errors, object(strategy.messageArchitecture), "strategy.messageArchitecture", "must be an object");
    required(errors, object(strategy.contentSystem), "strategy.contentSystem", "must be an object");
    if (object(strategy.contentSystem)) {
      required(errors, Array.isArray(strategy.contentSystem.pillars) && strategy.contentSystem.pillars.length > 0, "strategy.contentSystem.pillars", "must contain at least one pillar");
      list(strategy.contentSystem.pillars).forEach((pillar, index) => validatePillar(errors, pillar, index));
      validateWeightedPortfolio(errors, strategy.contentSystem.portfolio, "strategy.contentSystem.portfolio");
    }
    required(errors, object(strategy.platformPlaybooks), "strategy.platformPlaybooks", "must be an object");
    for (const platform of SUPPORTED_CONTENT_PLATFORMS) {
      const playbook = strategy.platformPlaybooks?.[platform];
      required(errors, object(playbook), `strategy.platformPlaybooks.${platform}`, "must be an object");
      if (!object(playbook)) continue;
      required(errors, text(playbook.role), `strategy.platformPlaybooks.${platform}.role`);
      required(errors, Array.isArray(playbook.priorityAudienceIds), `strategy.platformPlaybooks.${platform}.priorityAudienceIds`, "must be an array");
      required(errors, Array.isArray(playbook.objectivePriorities), `strategy.platformPlaybooks.${platform}.objectivePriorities`, "must be an array");
      required(errors, Array.isArray(playbook.constraints), `strategy.platformPlaybooks.${platform}.constraints`, "must be an array");
    }
    required(errors, object(strategy.conversionSystem), "strategy.conversionSystem", "must be an object");
    required(errors, object(strategy.evidencePolicy), "strategy.evidencePolicy", "must be an object");
    required(errors, object(strategy.riskPolicy), "strategy.riskPolicy", "must be an object");
  }

  if (document.strategyExtensions != null) {
    const extensions=document.strategyExtensions;
    required(errors,object(extensions),"strategyExtensions","must be an object");
    if (object(extensions)) {
      required(errors,extensions.schemaVersion==="1.0","strategyExtensions.schemaVersion","must equal 1.0");
      required(errors,extensions.role==="long_term_account_guidance","strategyExtensions.role","must describe long-term guidance");
      const functions=extensions.contentFunctionPolicy?.functions;
      required(errors,object(functions),"strategyExtensions.contentFunctionPolicy.functions","must be an object");
      for (const key of CONTENT_FUNCTIONS) {
        const range=functions?.[key];
        required(errors,object(range),`strategyExtensions.contentFunctionPolicy.functions.${key}`,"must be an object");
        if (!object(range)) continue;
        const min=Number(range.min),target=Number(range.target),max=Number(range.max);
        required(errors,[min,target,max].every(Number.isFinite)&&min<=target&&target<=max,`strategyExtensions.contentFunctionPolicy.functions.${key}`,"must satisfy min <= target <= max");
        required(errors,text(range.rationale),`strategyExtensions.contentFunctionPolicy.functions.${key}.rationale`);
      }
      required(errors,object(extensions.purposeEligibilityPolicy),"strategyExtensions.purposeEligibilityPolicy","must be an object");
      required(errors,Array.isArray(extensions.conversionLadder?.stages),"strategyExtensions.conversionLadder.stages","must be an array");
      required(errors,object(extensions.knowledgeEvidencePlan),"strategyExtensions.knowledgeEvidencePlan","must be an object");
      required(errors,Array.isArray(extensions.knowledgeEvidencePlan?.queries),"strategyExtensions.knowledgeEvidencePlan.queries","must be an array");
      if (extensions.accountPortfolio != null) {
        required(errors,object(extensions.accountPortfolio),"strategyExtensions.accountPortfolio","must be an object");
        required(errors,["single_account","role_matrix"].includes(extensions.accountPortfolio?.mode),"strategyExtensions.accountPortfolio.mode","must be single_account or role_matrix");
        const adaptedPortfolio=adaptAccountPortfolioV1(extensions.accountPortfolio,extensions.accountGrowthStrategies);
        required(errors,adaptedPortfolio.selectedSocialAccountIds.length>0,"strategyExtensions.accountPortfolio.selectedSocialAccountIds","must contain at least one selected account");
        if(adaptedPortfolio.mode==="single_account")required(errors,adaptedPortfolio.selectedSocialAccountIds.length===1&&adaptedPortfolio.primarySocialAccountId===adaptedPortfolio.selectedSocialAccountIds[0],"strategyExtensions.accountPortfolio.primarySocialAccountId","must identify the single selected account");
        if(adaptedPortfolio.mode==="role_matrix"){
          required(errors,adaptedPortfolio.selectedSocialAccountIds.length>=2,"strategyExtensions.accountPortfolio.selectedSocialAccountIds","role_matrix must contain at least two accounts");
          required(errors,new Set(adaptedPortfolio.selectedSocialAccountIds.map((id)=>adaptedPortfolio.accountRoles?.[id])).size===adaptedPortfolio.selectedSocialAccountIds.length,"strategyExtensions.accountPortfolio.accountRoles","role_matrix accounts must have distinct roles");
        }
        for(const socialAccountId of adaptedPortfolio.selectedSocialAccountIds)required(errors,text(adaptedPortfolio.accountRoles?.[socialAccountId]),`strategyExtensions.accountPortfolio.accountRoles.${socialAccountId}`);
      }
      if (extensions.accountGrowthStrategies != null) {
        required(errors,Array.isArray(extensions.accountGrowthStrategies),"strategyExtensions.accountGrowthStrategies","must be an array");
        list(extensions.accountGrowthStrategies).forEach((item,index)=>{
          required(errors,text(item?.socialAccountId),`strategyExtensions.accountGrowthStrategies[${index}].socialAccountId`);
          required(errors,text(item?.selectedPlaybookId),`strategyExtensions.accountGrowthStrategies[${index}].selectedPlaybookId`);
          required(errors,text(item?.growthMode),`strategyExtensions.accountGrowthStrategies[${index}].growthMode`);
          required(errors,text(item?.accountIdentity?.id),`strategyExtensions.accountGrowthStrategies[${index}].accountIdentity.id`);
          required(errors,text(item?.accountIdentity?.subjectType),`strategyExtensions.accountGrowthStrategies[${index}].accountIdentity.subjectType`);
          required(errors,text(item?.accountIdentity?.speakerType),`strategyExtensions.accountGrowthStrategies[${index}].accountIdentity.speakerType`);
          required(errors,Array.isArray(item?.accountIdentity?.trustSources)&&item.accountIdentity.trustSources.length>0,`strategyExtensions.accountGrowthStrategies[${index}].accountIdentity.trustSources`,`must contain at least one trust source`);
          required(errors,item?.hotspotPolicy?.unrelatedAllowed!==true,`strategyExtensions.accountGrowthStrategies[${index}].hotspotPolicy.unrelatedAllowed`,"must not enable unrelated hotspots");
          required(errors,item?.hotspotPolicy?.autoDeleteHistoricalContent!==true,`strategyExtensions.accountGrowthStrategies[${index}].hotspotPolicy.autoDeleteHistoricalContent`,"must not enable automatic deletion");
        });
      }
      if (extensions.experimentPlans != null) required(errors,Array.isArray(extensions.experimentPlans),"strategyExtensions.experimentPlans","must be an array");
    }
  }

  const governance = document.governance;
  required(errors, object(governance), "governance", "must be an object");
  if (object(governance)) {
    for (const key of ["confirmedClaimIds", "strategyFactIds", "knowledgeSourceIds", "hypotheses", "conflicts", "missingInformation"]) {
      required(errors, Array.isArray(governance[key]), `governance.${key}`, "must be an array");
    }
    if (governance.factApplications != null) required(errors, Array.isArray(governance.factApplications), "governance.factApplications", "must be an array");
    required(errors, text(governance.sourceContextHash), "governance.sourceContextHash");
  }
  return result("StrategyDocument", STRATEGY_DOCUMENT_VERSION, errors);
}

export function validateActiveStrategySnapshotV2(snapshot) {
  const errors = [];
  required(errors, object(snapshot), "$", "must be an object");
  if (!object(snapshot)) return result("ActiveStrategySnapshot", ACTIVE_STRATEGY_SNAPSHOT_VERSION, errors);
  required(errors, snapshot.schemaVersion === ACTIVE_STRATEGY_SNAPSHOT_VERSION, "schemaVersion", `must equal ${ACTIVE_STRATEGY_SNAPSHOT_VERSION}`);
  required(errors, text(snapshot.id), "id");
  required(errors, text(snapshot.accountId), "accountId");
  required(errors, snapshot.status === "active", "status", "must equal active");
  required(errors, Number.isInteger(Number(snapshot.version)) && Number(snapshot.version) > 0, "version", "must be a positive integer");
  required(errors, text(snapshot.sourceDraftRevisionId), "sourceDraftRevisionId");
  required(errors, text(snapshot.documentHash), "documentHash");
  required(errors, text(snapshot.contextHash), "contextHash");
  required(errors, text(snapshot.activatedAt), "activatedAt");
  const document = snapshot.document || snapshot.payload;
  const documentValidation = validateStrategyDocumentV2(document);
  errors.push(...documentValidation.errors.map((item) => ({ ...item, path: `document.${item.path}` })));
  if (text(snapshot.accountId) && text(document?.accountId)) {
    required(errors, snapshot.accountId === document.accountId, "document.accountId", "must equal accountId");
  }
  return result("ActiveStrategySnapshot", ACTIVE_STRATEGY_SNAPSHOT_VERSION, errors);
}

function validateNormalizedFactList(errors, facts, path) {
  required(errors, Array.isArray(facts), path, "must be an array");
  list(facts).forEach((fact, index) => {
    const prefix = `${path}[${index}]`;
    required(errors, object(fact), prefix, "must be an object");
    if (!object(fact)) return;
    required(errors, text(fact.id), `${prefix}.id`);
    required(errors, text(fact.key), `${prefix}.key`);
    required(errors, fact.value !== undefined && fact.value !== null && fact.value !== "", `${prefix}.value`);
    required(errors, text(fact.strategyImpact), `${prefix}.strategyImpact`);
    required(errors, Array.isArray(fact.platformScope), `${prefix}.platformScope`, "must be an array");
    required(errors, text(fact.sourceType), `${prefix}.sourceType`);
    required(errors, ["public", "anonymized", "private", "unknown"].includes(fact.visibility), `${prefix}.visibility`, "must be a supported authorization visibility");
    required(errors, ["allowed", "allowed_with_anonymization", "forbidden", "needs_review"].includes(fact.contentUsage), `${prefix}.contentUsage`, "must be a supported authorization usage");
    if (fact.visibility === "anonymized") required(errors, Array.isArray(fact.anonymizationRules) && fact.anonymizationRules.length > 0, `${prefix}.anonymizationRules`, "must describe required anonymization");
  });
}

export function validateFactSnapshotV1(snapshot) {
  const errors = [];
  required(errors, object(snapshot), "$", "must be an object");
  if (!object(snapshot)) return result("FactSnapshot", FACT_SNAPSHOT_VERSION, errors);
  required(errors, snapshot.schemaVersion === FACT_SNAPSHOT_VERSION, "schemaVersion", `must equal ${FACT_SNAPSHOT_VERSION}`);
  required(errors, text(snapshot.id), "id");
  required(errors, text(snapshot.accountId), "accountId");
  required(errors, Number.isInteger(Number(snapshot.factRevision)) && Number(snapshot.factRevision) >= 0, "factRevision", "must be a non-negative integer");
  required(errors, text(snapshot.capturedAt), "capturedAt");
  for (const key of ["usableFacts", "contextOnlyFacts", "forbiddenFacts", "missingFacts"]) validateNormalizedFactList(errors, snapshot[key], key);
  return result("FactSnapshot", FACT_SNAPSHOT_VERSION, errors);
}

export function validateContentStrategyProfileV1(profile) {
  const errors = [];
  required(errors, object(profile), "$", "must be an object");
  if (!object(profile)) return result("ContentStrategyProfile", CONTENT_STRATEGY_PROFILE_VERSION, errors);
  required(errors, profile.schemaVersion === CONTENT_STRATEGY_PROFILE_VERSION, "schemaVersion", `must equal ${CONTENT_STRATEGY_PROFILE_VERSION}`);
  for (const key of ["strategySnapshotId", "accountId", "accountStage", "businessModel", "valueProposition", "primaryObjectiveId"]) required(errors, text(profile[key]), key);
  required(errors, Array.isArray(profile.offers) && profile.offers.length > 0, "offers", "must contain at least one offer");
  required(errors, Array.isArray(profile.audiences) && profile.audiences.length > 0, "audiences", "must contain at least one audience");
  required(errors, Array.isArray(profile.contentPillars) && profile.contentPillars.length > 0, "contentPillars", "must contain at least one pillar");
  validateWeightedPortfolio(errors, profile.contentFunctionPortfolio, "contentFunctionPortfolio");
  required(errors, object(profile.platformPlaybooks), "platformPlaybooks", "must be an object");
  required(errors, object(profile.conversionSystem), "conversionSystem", "must be an object");
  required(errors, object(profile.evidencePolicy), "evidencePolicy", "must be an object");
  required(errors, object(profile.riskPolicy), "riskPolicy", "must be an object");
  if (profile.contentFunctionPolicy != null) required(errors, object(profile.contentFunctionPolicy), "contentFunctionPolicy", "must be an object");
  if (profile.purposeEligibilityPolicy != null) required(errors, object(profile.purposeEligibilityPolicy), "purposeEligibilityPolicy", "must be an object");
  if (profile.conversionLadder != null) required(errors, Array.isArray(profile.conversionLadder?.stages), "conversionLadder.stages", "must be an array");
  return result("ContentStrategyProfile", CONTENT_STRATEGY_PROFILE_VERSION, errors);
}

export function validateContentDirectionCardV1(card) {
  const errors = [];
  required(errors, object(card), "$", "must be an object");
  if (!object(card)) return result("ContentDirectionCard", CONTENT_DIRECTION_CARD_VERSION, errors);
  required(errors, card.schemaVersion === CONTENT_DIRECTION_CARD_VERSION, "schemaVersion", `must equal ${CONTENT_DIRECTION_CARD_VERSION}`);
  for (const key of ["id", "strategySnapshotId", "platform", "objectiveId", "contentFunction", "pillarId", "audienceId", "topic", "angle", "coreClaim"]) required(errors, text(card[key]), key);
  required(errors, SUPPORTED_CONTENT_PLATFORMS.includes(card.platform), "platform", "must be supported");
  required(errors, CONTENT_FUNCTIONS.includes(card.contentFunction), "contentFunction", "must be supported");
  required(errors, Array.isArray(card.messageIds), "messageIds", "must be an array");
  required(errors, Array.isArray(card.offerIds), "offerIds", "must be an array");
  if (card.contentPurposeId != null) required(errors, text(card.contentPurposeId), "contentPurposeId");
  if (card.promotionMode != null) required(errors, ["none", "soft", "focused"].includes(card.promotionMode), "promotionMode", "must be none, soft, or focused");
  if (card.conversionStage != null) required(errors, object(card.conversionStage), "conversionStage", "must be an object");
  return result("ContentDirectionCard", CONTENT_DIRECTION_CARD_VERSION, errors);
}

export function validateContentExecutionContextV1(context) {
  const errors = [];
  required(errors, object(context), "$", "must be an object");
  if (!object(context)) return result("ContentExecutionContext", CONTENT_EXECUTION_CONTEXT_VERSION, errors);
  required(errors, context.schemaVersion === CONTENT_EXECUTION_CONTEXT_VERSION, "schemaVersion", `must equal ${CONTENT_EXECUTION_CONTEXT_VERSION}`);
  for (const key of ["id", "strategySnapshotId", "factSnapshotId", "knowledgeSnapshotId", "createdAt"]) required(errors, text(context[key]), key);
  if (context.companyId != null) required(errors,text(context.companyId),"companyId");
  if (context.socialAccountId != null) required(errors,text(context.socialAccountId),"socialAccountId");
  if (context.accountContext != null) {
    required(errors, object(context.accountContext), "accountContext", "must be an object");
    if (object(context.accountContext)) {
      for (const key of ["workspaceId", "companyId", "socialAccountId", "platform", "strategySnapshotId", "selectionSource"]) required(errors, text(context.accountContext[key]), `accountContext.${key}`);
      required(errors, SUPPORTED_CONTENT_PLATFORMS.includes(context.accountContext.platform), "accountContext.platform", "must be supported");
      required(errors, ["user_confirmed", "single_account_default"].includes(context.accountContext.selectionSource), "accountContext.selectionSource", "must be user_confirmed or single_account_default");
      if (text(context.companyId) && text(context.accountContext.companyId)) required(errors, context.companyId === context.accountContext.companyId, "accountContext.companyId", "must equal companyId");
      if (text(context.socialAccountId) && text(context.accountContext.socialAccountId)) required(errors, context.socialAccountId === context.accountContext.socialAccountId, "accountContext.socialAccountId", "must equal socialAccountId");
      if (text(context.strategySnapshotId) && text(context.accountContext.strategySnapshotId)) required(errors, context.strategySnapshotId === context.accountContext.strategySnapshotId, "accountContext.strategySnapshotId", "must equal strategySnapshotId");
    }
  }
  const cardValidation = validateContentDirectionCardV1(context.directionCard);
  errors.push(...cardValidation.errors.map((item) => ({ ...item, path: `directionCard.${item.path}` })));
  required(errors, object(context.contentIntentProfile), "contentIntentProfile", "must be an object");
  required(errors, object(context.sourcePlan), "sourcePlan", "must be an object");
  required(errors, object(context.resolvedPolicies), "resolvedPolicies", "must be an object");
  required(errors, object(context.userOverrides), "userOverrides", "must be an object");
  return result("ContentExecutionContext", CONTENT_EXECUTION_CONTEXT_VERSION, errors);
}

export function assertSharedContract(validation) {
  if (validation.valid) return validation;
  const detail = validation.errors.map((item) => `${item.path} ${item.message}`).join("; ");
  const error = new Error(`${validation.name}@${validation.version} validation failed: ${detail}`);
  error.contract = validation;
  throw error;
}
