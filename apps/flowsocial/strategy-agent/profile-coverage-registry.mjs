const slot = (id, label, required = true) => ({ id, label, required });

export const coreFieldSpecs = {
  "business.primaryOffers": { label: "产品与服务", slots: [slot("offerNames","产品/服务名称"),slot("priorityOffers","当前优先推广项"),slot("problemsSolved","解决的问题"),slot("targetCustomers","目标客户"),slot("deliverables","交付内容"),slot("applicableScenarios","适用场景"),slot("unsuitableScenarios","不适用场景",false),slot("offerRelationships","产品关系",false),slot("recentPriorities","近期业务重点",false)] },
  "business.businessModel": { label: "商业模式", slots: [slot("payer","付费方",false),slot("chargingModel","收费方式"),slot("deliveryModel","交付方式"),slot("serviceDuration","服务周期",false),slot("salesModel","销售方式",false),slot("revenuePriority","收入重点",false),slot("renewalModel","续费方式",false),slot("purchaseCharacteristics","采购特点",false),slot("modelTransition","模式变化",false)] },
  "audiences.primary": { label: "核心受众", slots: [slot("industries","行业"),slot("companyTypes","公司类型"),slot("decisionRoles","核心决策人"),slot("jobsToBeDone","要完成的任务"),slot("painPoints","核心痛点"),slot("buyingTriggers","购买触发点"),slot("sizes","公司规模",false),slot("stages","发展阶段",false),slot("regions","地区",false),slot("userRoles","实际使用者",false),slot("influencers","影响者",false),slot("awareness","认知阶段",false),slot("excluded","非目标受众",false)] },
  "business.conversionPath": { label: "转化路径", slots: [slot("entryCTA","内容中的行动引导"),slot("contactChannel","咨询入口"),slot("handoffOwner","承接人"),slot("informationCollection","首次收集信息"),slot("leadQualification","有效线索标准"),slot("diagnosticStep","需求诊断方式"),slot("nextBusinessStep","诊断后的下一步"),slot("cooperationEntry","进入合作的节点"),slot("firstResponse","首次回复方式",false),slot("followup","跟进机制",false),slot("decisionProcess","客户决策流程",false),slot("crm","线索记录工具",false),slot("platformDifference","平台差异",false)] },
  "accountStrategy.primaryGoal": { label: "账号目标", slots: [slot("primaryOutcome","首要商业结果"),slot("priority","目标优先级"),slot("timeHorizon","时间周期"),slot("targetAudience","目标对象"),slot("successSignals","成功判断信号"),slot("platformScope","平台范围",false),slot("baseline","当前基线",false),slot("resourceConstraints","资源限制",false),slot("tradeoffs","取舍原则",false)] },
  "accountStrategy.growthStage": { label: "账号阶段", slots: [slot("currentStage","当前阶段"),slot("stageEvidence","判断依据"),slot("bottleneck","当前瓶颈"),slot("nextMilestone","下一里程碑"),slot("duration","运营时长",false),slot("contentCount","内容数量",false),slot("cadence","更新频率",false),slot("followers","粉丝规模",false),slot("history","历史表现",false),slot("positioningChange","定位变化",false),slot("teamMaturity","团队成熟度",false)] },
  "accountStrategy.platformRoles": { label: "平台目标与分工", slots: [slot("xiaohongshuRole","小红书角色"),slot("wechatRole","公众号角色"),slot("crossPlatformRelationship","双平台协同关系"),slot("xiaohongshuAudience","小红书受众",false),slot("xiaohongshuContent","小红书内容重点",false),slot("xiaohongshuConversion","小红书转化方式",false),slot("wechatAudience","公众号受众",false),slot("wechatContent","公众号内容重点",false),slot("wechatConversion","公众号转化方式",false),slot("depths","内容深度差异",false),slot("promotionLevels","推广强度",false),slot("cadence","更新频率",false),slot("reuse","复用规则",false)] },
  "accountStrategy.contentResources": { label: "可用内容材料", slots: [slot("resourceTypes","目前有哪些材料"),slot("resourceLocations","材料存放位置",false),slot("publicUsage","材料能否用于公开内容"),slot("evidenceQuality","材料是否可核实",false),slot("resourceGaps","目前缺少的材料",false),slot("productMaterials","产品资料",false),slot("companyMaterials","公司资料",false),slot("cases","案例",false),slot("data","数据",false),slot("sops","SOP",false),slot("experience","业务经验",false),slot("faq","常见问答",false),slot("templates","模板",false),slot("images","图片素材",false),slot("owners","资料负责人",false),slot("freshness","资料时效",false)] },
  "accountStrategy.constraints": { label: "内容安全规则", slots: [slot("confidentialInformation","哪些信息不能公开"),slot("forbiddenClaims","哪些说法不能承诺"),slot("dataSourceRules","数据引用要遵守什么规则"),slot("caseAuthorizationRules","客户案例怎样才能使用"),slot("mandatoryReviewRules","哪些内容发布前需要审核"),slot("advertisingLaw","广告法要求",false),slot("industryCompliance","行业合规",false),slot("sensitiveTopics","敏感话题",false),slot("competitorRules","竞品规则",false),slot("copyrightRules","版权规则",false),slot("brandForbidden","品牌禁用表达",false),slot("disclosures","必要披露",false)] }
};

const dynamic = (id, label, priority, slots, question, targetFactKey=`profile.${id}`) => ({ id, label, priority, targetFactKey, slots: slots.map((x)=>slot(x[0],x[1],x[2] !== false)), question });
export const dynamicFactSpecs = [
  dynamic("account_identity","账号身份与信任模型","P0",[["assetOwner","账号资产归属"],["publicIdentity","对外身份"],["speaker","持续发声者"],["trustSources","信任来源"],["authorship","署名和第一人称规则"],["accountMode","平台账号模式",false],["proofBoundary","身份与证据边界",false]],"这个账号由公司还是个人持有？对外以官方品牌、创始人、员工专家、个人创作者、产品专号或机构服务号中的哪种身份发声？谁持续输出，主要靠什么建立信任？","strategy.account_identity"),
  dynamic("account_portfolio","账号组合与矩阵决策","P0",[["existingAccounts","现有账号"],["roleDifferences","账号角色差异"],["audienceDifferences","受众差异"],["contentOwnership","内容归属"],["conversionOwnership","转化归属"],["teamFeasibility","团队维护能力"],["coordinationRules","协同规则",false],["duplicationBoundary","重复边界",false]],"目前需要运营哪些平台和账号？它们是否面向不同受众、产品、地区或发声角色，分别由谁承接转化？团队能否持续维护这些分工？","strategy.account_portfolio"),
  dynamic("growth_strategy","增长打法与实验边界","P0",[["stage","账号阶段"],["candidateModes","可接受的增长方式"],["hotspotTolerance","热点容忍度"],["relevanceBoundary","业务相关性底线"],["experimentWindow","实验周期"],["successSignals","验证指标"],["exitConditions","退出条件"],["audienceDriftRisk","受众偏移风险",false],["transitionPlan","回归或切换路径",false]],"这个账号当前更重视精准垂直还是快速验证触达？是否接受受控热点实验或热点桥接？请说明可以接受的相关性边界、实验周期、判断指标和停止条件；如果不确定，我可以比较几种方案。","strategy.growth_method"),
  dynamic("xiaohongshu_infrastructure","小红书账号经营条件","P1",[["accountType","账号类型"],["audienceMoment","目标用户状态"],["visualCapacity","图文与视觉产能"],["officialCapabilities","专业号/店铺/正式承接"],["conversionEntry","承接入口"],["primaryMetrics","主要指标"],["realScenes","真实场景与人物素材",false],["hotspotBridgeAbility","热点桥接能力",false]],"针对小红书，这个账号是什么类型、主要触达用户的什么场景？目前有哪些图文素材与正式承接能力，准备优先观察哪些平台和业务指标？","platform.xiaohongshu_infrastructure"),
  dynamic("wechat_infrastructure","公众号账号模式与承接设施","P1",[["accountMode","流量/IP/企业经营/机构服务模式"],["authorship","持续作者与署名"],["initialAudience","首批读者来源"],["discoveryPriority","订阅/搜索/推荐/转发重点"],["columns","栏目"],["welcomeReply","欢迎回复"],["keywordReplies","关键词回复"],["menuNavigation","菜单与历史内容导航"],["handoff","企微/销售/社群/官网承接"],["primaryMetrics","主要指标"]],"针对公众号，它主要承担流量、个人IP、企业经营还是机构服务？谁持续署名，首批读者从哪里来，栏目、欢迎回复、关键词、菜单和关注后承接目前分别准备到什么程度？","platform.wechat_infrastructure"),
  dynamic("audience_insight","客户真实洞察","P0",[["painPoints","具体痛点"],["triggers","主动寻找方案的触发点"],["failedAttempts","尝试过但无效的方法"],["knowledgeGaps","知识缺口"],["misconceptions","常见误区"],["contentNeeds","希望获得的内容"]],"客户日常最棘手的问题是什么？通常发生什么事后会主动找方案？他们试过哪些办法、还存在哪些误区？","audience.pain_points"),
  dynamic("purchase_decision","采购决策机制","P0",[["initiators","发起者"],["users","使用者"],["influencers","影响者"],["decisionMakers","决策人"],["payers","付费方"],["criteria","决策标准"],["process","采购流程"],["cycle","决策周期"],["budget","预算特征"],["objections","常见异议"],["alternatives","替代方案"],["trustFactors","信任依据"]],"一笔典型采购由谁发起、使用、影响、决策和付款？他们按什么标准、经过哪些步骤决定，最常见的顾虑和替代方案是什么？"),
  dynamic("offer_detail","产品服务细节","P0",[["variants","产品/服务版本"],["scenarios","适用场景"],["unsuitable","不适用情况"],["problems","解决的问题"],["deliverables","交付物"],["process","交付流程"],["duration","周期"],["requirements","客户配合要求"],["value","核心价值"],["differentiators","差异点"],["thresholds","适用门槛"],["faq","常见问题"],["updates","近期变化"]],"请选一个当前最重要的产品或服务，说明适用与不适用场景、交付流程和结果、客户需配合什么，以及它与替代方案的差异。"),
  dynamic("customer_scenario","客户使用场景","P0",[["roles","参与角色"],["beforeState","使用前状态"],["tasks","核心任务"],["process","使用过程"],["humanAiBoundary","人与AI边界"],["exceptions","异常场景"],["afterState","使用后状态"],["differences","不同客户差异"]],"在一个真实客户场景里，谁在什么状态下完成什么任务？使用你们服务前后有什么变化，过程中有哪些例外或需要人工介入的地方？"),
  dynamic("case_evidence","可用于内容的案例","P0",[["background","案例背景"],["problem","原始问题"],["objective","项目目标"],["actions","采取的动作"],["process","实施过程"],["results","结果"],["metricDefinitions","数字是怎样统计的"],["feedback","客户反馈"],["authorization","客户是否同意公开"],["anonymization","哪些信息需要隐去"],["sourceQuality","是否有原始记录可以核实"]],"如果目前有能用于内容的客户案例，请介绍一个案例的背景、问题、做法和结果，并说明哪些信息可以公开或需要隐去；如果没有，直接说“目前没有案例”即可。"),
  dynamic("expert_knowledge","专业知识资产","P0",[["sops","SOP"],["frameworks","方法框架"],["criteria","诊断或选择标准"],["mistakes","常见错误"],["checklists","清单"],["templates","模板"],["opinions","专家观点"],["terms","行业术语"],["tips","实操技巧"],["faq","高频问答"]],"团队有哪些可复用的SOP、方法框架、判断标准、避坑清单、模板或高频问答？哪些最能体现你们的专业经验？"),
  dynamic("conversion_sales","销售转化细节","P0",[["cta","行动引导"],["entry","咨询入口"],["owner","承接人"],["allocation","线索分配"],["firstResponse","首次回复"],["informationCollection","信息收集"],["qualification","有效线索标准"],["invalidLeads","无效线索"],["diagnosis","需求诊断"],["nextSteps","下一步"],["followup","跟进"],["cycle","销售周期"],["crm","记录工具"],["platformPaths","平台差异"]],"从用户看到行动引导开始，到咨询、判断有效、诊断、跟进和进入合作，完整链路是什么？小红书和公众号是否不同？"),
  dynamic("compliance_risk","发布前需要注意的规则","P0",[["clientIdentity","客户名称和Logo"],["projectDetails","项目过程和结果"],["internalProcess","内部流程"],["productInfo","产品信息"],["employeeInfo","员工信息"],["copyright","版权"],["advertisingLaw","广告法"],["industryCompliance","行业合规"],["absoluteClaims","绝对化表述"],["aiDisclosure","AI审核/披露"],["reviewOwner","审核负责人"]],"发布内容前，哪些信息不能公开，哪些说法不能承诺，哪些内容需要专人审核？如果目前没有额外规定，也可以直接说明。"),
  dynamic("brand_expression","品牌表达偏好","P1",[["personality","品牌人格"],["speaker","发声身份"],["style","表达风格"],["preferredPhrases","偏好用语"],["forbiddenPhrases","禁用语"],["expertise","专业感"],["emotion","情绪浓度"],["promotionTolerance","推广容忍度"],["references","参考账号"],["negativeReferences","反面参考"],["stories","品牌故事"],["visuals","视觉偏好"]],"希望账号像谁在说话、给人什么感觉？有哪些偏好或禁用表达、参考与反面账号，以及视觉和推广强度偏好？"),
  dynamic("platform_operation","平台运营规则","P1",[["audienceDifferences","平台受众差异"],["topicPreferences","选题偏好"],["depthPreferences","深度偏好"],["formatPreferences","形式偏好"],["cadence","频率"],["interaction","互动方式"],["promotion","推广方式"],["reuse","复用规则"],["timing","发布时间"],["coordination","平台协同"],["constraints","平台限制"]],"小红书与公众号在受众、选题、深度、形式、频率、互动和推广上分别怎么做？两边如何复用和协同？"),
  dynamic("operating_capacity","团队执行能力","P1",[["roles","团队角色"],["weeklyCapacity","周产能"],["reviewProcess","审核流程"],["reviewSla","审核时效"],["assetAbility","素材能力"],["expertParticipation","专家参与"],["salesParticipation","销售参与"],["tools","工具"],["outsourcing","外包"],["bottlenecks","瓶颈"],["hotspotResponse","热点响应速度"]],"目前谁负责选题、写作、设计、审核和发布？每周真实产能、审核时效、工具和最大瓶颈是什么，能多快响应热点？"),
  dynamic("market_context","市场与竞争环境","P2",[["industries","重点行业"],["regions","重点地区"],["stages","客户阶段"],["trends","趋势"],["policy","政策"],["technology","技术变化"],["competitors","竞品"],["alternatives","替代方案"],["topics","关注话题"],["misconceptions","市场误区"],["opportunities","机会"],["risks","风险"]],"近期重点行业和地区有哪些趋势、政策或技术变化？客户常比较哪些竞品或替代方案，市场机会、误区与风险是什么？"),
  dynamic("business_calendar","业务日历","P2",[["launches","新品/服务发布"],["events","活动"],["reports","报告"],["recruiting","招聘"],["promotions","促销"],["salesPriorities","销售重点"],["seasonality","季节性"],["industryMoments","行业节点"],["temporaryEvents","临时事件"],["expiry","时效截止"]],"未来三个月有哪些发布、活动、报告、招聘、促销或销售重点？哪些行业节点或临时事件必须在特定日期前传播？"),
  dynamic("performance_learning","历史表现与学习","P2",[["highPerformingTopics","高表现选题"],["savesCommentsLeads","收藏评论线索"],["weakPatterns","低表现模式"],["titleOpeningStructure","标题开头结构"],["platformDifferences","平台表现差异"],["feedback","用户反馈"],["viralFramework","爆款框架"],["experiments","实验结果"]],"过去哪些内容的阅读、收藏、评论或线索表现最好/最差？标题、开头、结构、平台差异和测试结果说明了什么？")
];

export function getTargetSpec(targetType, targetId) {
  return targetType === "core_field" ? coreFieldSpecs[targetId] || null : dynamicFactSpecs.find((item)=>item.id===targetId || item.targetFactKey===targetId) || null;
}

export function requiredSlotIds(spec) { return (spec?.slots || []).filter((item)=>item.required).map((item)=>item.id); }

const minimumSlotGroups = {
  "business.primaryOffers": [["offerNames","priorityOffers","problemsSolved"]],
  "business.businessModel": [["chargingModel","deliveryModel"]],
  "audiences.primary": [["industries","companyTypes","decisionRoles"]],
  "business.conversionPath": [["entryCTA","contactChannel"],["handoffOwner","informationCollection","leadQualification","diagnosticStep","nextBusinessStep","cooperationEntry"]],
  "accountStrategy.primaryGoal": [["primaryOutcome"]],
  "accountStrategy.growthStage": [["currentStage"]],
  "accountStrategy.platformRoles": [["xiaohongshuRole","wechatRole"]],
  "accountStrategy.contentResources": [["resourceTypes"]],
  "accountStrategy.constraints": [["confidentialInformation","forbiddenClaims","dataSourceRules","caseAuthorizationRules","mandatoryReviewRules"]]
};

export function evaluateCoverageLayers({ targetType, targetId, capturedSlots = [], skippedSlots = [], status = "partial" } = {}) {
  const capturedIds=new Set(capturedSlots.map((item)=>item?.slot).filter(Boolean));
  const skippedIds=new Set(skippedSlots);
  const terminal=["skipped","not_applicable"].includes(status);
  const groups=targetType==="core_field" ? minimumSlotGroups[targetId] || [] : [];
  const minimumMissingGroups=terminal ? [] : groups.filter((group)=>!group.some((slotId)=>capturedIds.has(slotId)||skippedIds.has(slotId)));
  const qualityMissingSlots=terminal ? [] : requiredSlotIds(getTargetSpec(targetType,targetId)).filter((slotId)=>!capturedIds.has(slotId)&&!skippedIds.has(slotId));
  return {
    answered:terminal || capturedIds.size>0 || skippedIds.size>0,
    minimumDraftReady:terminal || minimumMissingGroups.length===0,
    qualityComplete:terminal || qualityMissingSlots.length===0,
    minimumMissingGroups,
    qualityMissingSlots
  };
}

export function normalizeCoverageAssessment(raw = {}, { targetType, targetId, status = "partial" } = {}) {
  const spec = getTargetSpec(targetType, targetId);
  const allowed=new Set((spec?.slots||[]).map((x)=>x.id));
  const captured = Array.isArray(raw.capturedSlots) ? raw.capturedSlots.filter((x)=>x && x.slot && allowed.has(String(x.slot))).map((x)=>({ slot:String(x.slot), value:x.value ?? true, confidence:Math.max(0,Math.min(1,Number(x.confidence)||0.7)), source:x.source || "user_statement" })) : [];
  const capturedIds = new Set(captured.map((x)=>x.slot));
  const skippedSlots = [...new Set((Array.isArray(raw.skippedSlots) ? raw.skippedSlots : []).map(String).filter((id)=>allowed.has(id)))];
  const skippedIds = new Set(skippedSlots);
  const missingRequiredSlots = requiredSlotIds(spec).filter((id)=>!capturedIds.has(id)&&!skippedIds.has(id));
  const missingOptionalSlots = (spec?.slots || []).filter((x)=>!x.required && !capturedIds.has(x.id)&&!skippedIds.has(x.id)).map((x)=>x.id);
  const terminal = ["skipped","not_applicable"].includes(raw.status || status);
  const resolvedStatus = terminal ? (raw.status || status) : missingRequiredSlots.length ? "partial" : (raw.status === "confirmed" ? "confirmed" : "sufficient");
  const layers=evaluateCoverageLayers({targetType,targetId,capturedSlots:captured,skippedSlots,status:resolvedStatus});
  return { targetType, targetId, capturedSlots:captured, skippedSlots, missingRequiredSlots, missingOptionalSlots, status:resolvedStatus, strategyReady:layers.qualityComplete, contentReady:layers.qualityComplete && (terminal || captured.length >= Math.min(4,(spec?.slots||[]).length)), ...layers, followUpNeeded:!terminal && !layers.minimumDraftReady, followUpQuestion:String(raw.followUpQuestion || "").trim() };
}

export function mergeCoverageAssessment(previous, raw, target) {
  const combined = new Map();
  for (const item of [...(previous?.capturedSlots || []), ...(raw?.capturedSlots || [])]) if (item?.slot) combined.set(item.slot,item);
  return normalizeCoverageAssessment({ ...raw, skippedSlots:[...new Set([...(previous?.skippedSlots||[]),...(raw?.skippedSlots||[])])], capturedSlots:[...combined.values()] }, target);
}

export function conservativeCoverageFromAnswer(targetType,targetId,value,message="") {
  const source = `${typeof value === "string" ? value : JSON.stringify(value || {})} ${message}`;
  const patterns = targetId === "business.conversionPath" ? {
    entryCTA:/私信|评论|扫码|点击|联系|咨询|领取/,contactChannel:/微信|企微|电话|表单|私信|公众号|官网/,handoffOwner:/销售|客服|顾问|运营|负责人/,informationCollection:/公司|行业|规模|预算|需求|联系方式|地区/,leadQualification:/有效|筛选|匹配|预算|决策|需求明确/,diagnosticStep:/诊断|沟通|会议|演示|demo|方案/,nextBusinessStep:/报价|方案|演示|会议|试用|合同/,cooperationEntry:/合同|签约|付款|立项|合作/
  } : {};
  const capturedSlots = Object.entries(patterns).filter(([,re])=>re.test(source)).map(([slotId])=>({slot:slotId,value:source.trim(),confidence:0.65,source:"deterministic_inference"}));
  const addStructuredSlot=(slotId,slotValue,confidence=0.9)=>{
    if (slotValue == null || slotValue === "" || (Array.isArray(slotValue)&&!slotValue.length) || capturedSlots.some((item)=>item.slot===slotId)) return;
    capturedSlots.push({slot:slotId,value:slotValue,confidence,source:"structured_value"});
  };
  if (targetId === "business.primaryOffers") {
    addStructuredSlot("offerNames",Array.isArray(value)?value:value?.offerNames||value?.primaryOffers||value?.services||value?.products);
    addStructuredSlot("priorityOffers",value?.priorityOffers);
    addStructuredSlot("problemsSolved",value?.problemsSolved);
  }
  if (targetId === "business.businessModel") {
    addStructuredSlot("chargingModel",value?.chargingModel || (/订阅|收费|按年|按月|项目制|销售/.test(source)?(typeof value==="string"?value:value?.summary):null),0.8);
    addStructuredSlot("deliveryModel",value?.deliveryModel || (/交付|服务|部署|项目制|SaaS/.test(source)?(typeof value==="string"?value:value?.summary):null),0.8);
  }
  if (targetId === "audiences.primary") {
    addStructuredSlot("industries",value?.industries);
    addStructuredSlot("companyTypes",value?.companyTypes || value?.companyStages);
    addStructuredSlot("decisionRoles",value?.decisionRoles || value?.decisionMakers);
    addStructuredSlot("jobsToBeDone",value?.jobsToBeDone);
    addStructuredSlot("painPoints",value?.painPoints);
    addStructuredSlot("buyingTriggers",value?.buyingTriggers);
  }
  if (targetId === "accountStrategy.primaryGoal") addStructuredSlot("primaryOutcome",value?.primaryOutcome || value?.summary || (typeof value==="string"?value:null));
  if (targetId === "accountStrategy.growthStage") addStructuredSlot("currentStage",value?.currentStage || value?.summary || (typeof value==="string"?value:null));
  if (targetId === "accountStrategy.platformRoles") {
    addStructuredSlot("xiaohongshuRole",value?.xiaohongshuRole || value?.xiaohongshu);
    addStructuredSlot("wechatRole",value?.wechatRole || value?.wechat);
    addStructuredSlot("crossPlatformRelationship",value?.crossPlatformRelationship);
  }
  if (targetId === "accountStrategy.contentResources" && value?.none === true) {
    return normalizeCoverageAssessment({
      capturedSlots: [],
      skippedSlots: requiredSlotIds(getTargetSpec(targetType,targetId)),
      status: "not_applicable"
    },{targetType,targetId,status:"not_applicable"});
  }
  if (targetId === "accountStrategy.contentResources" && typeof value === "object" && value) {
    const resourceKeys=["cases","data","sops","productMaterials","companyMaterials","businessExperience","experience","faq","templates","images"];
    const available=resourceKeys.filter((key)=>Array.isArray(value[key])?value[key].length:Boolean(value[key]));
    if (available.length) capturedSlots.push({slot:"resourceTypes",value:available,confidence:0.9,source:"structured_value"});
    if (value.knowledgeAssetIds?.length || value.resourceLocations?.length) capturedSlots.push({slot:"resourceLocations",value:value.knowledgeAssetIds||value.resourceLocations,confidence:0.95,source:"knowledge_asset"});
    if (available.some((key)=>["cases","data","sops"].includes(key))) capturedSlots.push({slot:"evidenceQuality",value:"存在可核验的案例、数据或流程资料，具体公开权限仍需确认",confidence:0.75,source:"deterministic_inference"});
    addStructuredSlot("resourceTypes",value.resourceTypes || value.summary);
    if (["public","anonymized","internal","forbidden"].includes(value.publicUsage)) addStructuredSlot("publicUsage",value.publicUsage);
  }
  if (targetId === "accountStrategy.constraints") {
    const constraintPatterns = {
      confidentialInformation: /不能公开|不得公开|保密|客户名称|内部信息|敏感信息|脱敏/,
      forbiddenClaims: /不能承诺|不得承诺|不保证|绝对化|百分百|一定|夸大/,
      dataSourceRules: /数据.{0,8}(来源|可核实|标注|引用)|不虚构.{0,8}数据|数据必须有来源|可验证来源|没有来源.{0,8}(观点|不写|不引用)|来源.{0,8}(标注|注明|核实)/,
      caseAuthorizationRules: /案例.{0,8}(授权|同意|脱敏|隐去)|不虚构.{0,8}案例|未经授权/,
      mandatoryReviewRules: /发布前.{0,8}(审核|确认)|需要.{0,8}(审核|法务|负责人确认)|人工审核/
    };
    for (const [slotId, pattern] of Object.entries(constraintPatterns)) {
      if (pattern.test(source)) capturedSlots.push({slot:slotId,value:source.trim(),confidence:0.82,source:"deterministic_inference"});
    }
  }
  if (!capturedSlots.length && typeof value === "object" && value) {
    const spec=getTargetSpec(targetType,targetId);
    for (const item of spec?.slots || []) if (value[item.id] != null && String(value[item.id]).trim()) capturedSlots.push({slot:item.id,value:value[item.id],confidence:0.75,source:"structured_value"});
  }
  return normalizeCoverageAssessment({ capturedSlots,status:"partial" },{targetType,targetId});
}

export function buildCoverageSnapshot(coreStates = [], dynamicStates = []) {
  const decorate=(item)=>{ const spec=getTargetSpec(item.targetType,item.targetId); return { ...item,label:spec?.label || item.targetId,missingRequiredLabels:(item.missingRequiredSlots||[]).map((id)=>spec?.slots?.find((x)=>x.id===id)?.label || id),capturedSlotLabels:(item.capturedSlots||[]).map((entry)=>spec?.slots?.find((x)=>x.id===entry.slot)?.label || entry.slot),skippedSlotLabels:(item.skippedSlots||[]).map((id)=>spec?.slots?.find((x)=>x.id===id)?.label||id) }; };
  const canonicalCoreIds=new Set(Object.keys(coreFieldSpecs));
  const canonicalDynamicIds=new Set(dynamicFactSpecs.map((item)=>item.id));
  const core = (coreStates || []).filter((item)=>canonicalCoreIds.has(item.targetId)).map(decorate), dynamic = (dynamicStates || []).filter((item)=>canonicalDynamicIds.has(item.targetId)).map(decorate);
  const coreReady = core.filter((x)=>x.strategyReady || ["skipped","not_applicable"].includes(x.status)).length;
  const coreAnswered=core.filter((item)=>evaluateCoverageLayers(item).answered).length;
  const coreMinimumReady=core.filter((item)=>evaluateCoverageLayers(item).minimumDraftReady).length;
  const dynamicReady = dynamic.filter((x)=>x.strategyReady || ["skipped","not_applicable"].includes(x.status)).length;
  return { schemaVersion:"1.1", core:{ ready:coreReady,answered:coreAnswered,minimumReady:coreMinimumReady,qualityComplete:coreReady,total:Object.keys(coreFieldSpecs).length,complete:coreReady===Object.keys(coreFieldSpecs).length,items:core }, dynamic:{ ready:dynamicReady,total:dynamic.length,complete:dynamic.length>0&&dynamicReady===dynamic.length,items:dynamic,displayMode:"collected_relevant_facts" }, strategyReady:coreReady===Object.keys(coreFieldSpecs).length, minimumDraftReady:coreMinimumReady===Object.keys(coreFieldSpecs).length, contentReady:core.filter((x)=>x.contentReady).length===Object.keys(coreFieldSpecs).length && dynamicReady>=Math.min(8,dynamic.length) };
}
