# 离线编译合同

本 Skill 只接受已冻结输入，不负责创建或修订内容真值。详细版本定义见 `../../../contracts/PagePromptSpec.md`、`../../../contracts/XhsIntegratedPagePromptSet.md` 和 `../../../contracts/VisualStyleSelection.md`。

## 统一 Runtime 授权

Skill 生命周期为 `stable_conditional`。原子运行时合同之外，产品调用必须由小红书 `UnifiedPlatformSkillExecutionPlan` 中已启用的 `visual_design` 步骤严格授权，并通过 deterministic Adapter 绑定共享 ContentMaster、平台 run、候选和显式视觉选择。两个 Feature Flag 均默认关闭；未计划、未启用或 hash 不一致的调用必须失败。

标准 Evidence 保存 Skill definition/reference/library bundle hash、runtime input hash、输出 hash、统一计划 hash与 Provider execution plan hash。所有调用计数固定为零，`pageRevisionRefs=[]`、`selectionAuthority=false`、`deliveryBundleCreated=false`、`publicationPerformed=false`。Evidence 的 `productionEligible=true` 仅允许进入人工 Provider approval，不是内容或交付完成状态。

## 输入

```json
{
  "schemaVersion": "1.0",
  "contract": "DesignXhsIntegratedPagesRuntimeInput@1.0",
  "id": "runtime-input-001",
  "xhsPostPackage": {"status": "success", "data": {"platform": "xiaohongshu", "deck": {"pages": []}}},
  "contentVersion": 1,
  "designDna": {"snapshotId": "", "palette": [], "typographyRoles": [], "constraints": []},
  "authorizedAssets": [{"assetId": "", "status": "approved", "license": {"id": "", "allowsGenerationReference": true}}],
  "providerCapability": {"integratedChineseTypography": false, "exactDimensions": false, "referenceImages": false},
  "pageDensity": {"P1": "medium"},
  "visualSelection": {
    "stylePackId": "friendly-editorial",
    "reason": "frozen user selection",
    "pages": [{"pageId": "P1", "archetypeId": "cover.promise", "patternIds": [], "referenceAssetIds": [], "verbatimTextOverride": null, "stylePackId": null}]
  }
}
```

生产调用只接受上述显式运行时合同。评测样本的 `{id,input,selection}` 封装只由离线验证脚本通过兼容 Adapter 转换，不是 Skill 运行时输入，也不得进入生产调用路径。结构化 `text_layers[].items[]` 中的 `text`、`content`、`value`、`title`、`body` 分别投影为独立文本节点。CTA 页面以冻结的 `post_copy.cta` 为准；重复 CTA 只保留一次，冲突 CTA 返回 `CTA_TEXT_MISMATCH`。

## 只读投影

对 `xhs_post_package.data.deck.pages[]` 逐页投影：

- `page` -> `pageId`（格式 `P{page}`）；
- `role` -> `pageRole`；
- `text_layers[type=headline].text` -> `headline`；
- 其余 `text_layers` 按原顺序 -> `supportingText`、`labels` 和 `cta`；
- `fact_ids`、`interpretation_ids` 原样复制；
- 英文产品名、中文专有名词、数字和 CTA 进入 `protectedTerms`；
- `must_avoid` -> `forbiddenClaims`。

缺少 `data.deck.pages`、页码、页面角色、封面标题或任何非空文字层的 `text` 时返回 `INPUT_TRUTH_INCOMPLETE`。投影不得修改输入对象。

## 输出封套

```json
{
  "schemaVersion": "1.0",
  "contract": "XhsIntegratedPagePromptSet@1.0",
  "id": "prompt-set:set-001:v1",
  "status": "draft | blocked",
  "sourcePackage": {"contract": "XhsPostPackage@2.0", "contentVersion": 1, "readOnly": true},
  "visualStyleSelection": {},
  "pagePromptSpecs": [],
  "crossPageRules": {"singleStylePack": true, "stablePalette": true, "stableTypographyRoles": true, "repetitionLimit": 2},
  "visualSelectionGate": {"status": "pending_user_review", "selectedBy": null, "selectedAt": null},
  "productionEligible": false,
  "blockers": [{"code": "", "pageId": "", "detail": "", "fallback": "deterministic_layout"}],
  "trace": {"networkCalls": 0, "providerCalls": 0, "databaseWrites": 0}
}
```

`visualStyleSelection.constraints` is the canonical lightweight brand projection for Provider compilation. For new production outputs it contains at most one confirmed hexadecimal brand-colour anchor. Typography, layout rules, materials, illustration/photography examples and manual motifs remain account reference data and must not constrain page creativity or enter Provider prompts. The anchor is a small identity accent, not a mandatory background, complete palette or page template. Historical prompt sets remain immutable.

## PagePromptSpec version compatibility

Historical `PagePromptSpec@1.0` remains read-only compatible. It has the
original field set and always inherits the prompt-set global Style Pack; a
`1.0` object containing `stylePackId` is invalid and is never silently
upgraded or re-hashed.

`PagePromptSpec@1.1` is reserved for the explicit
`semantic_auxiliary_style@1.0` adapter. It must contain both `stylePackId` and
`semanticAuxiliaryStyle` with these bindings:

```json
{
  "schemaVersion": "1.1",
  "stylePackId": "friendly-handdrawn-tech",
  "semanticAuxiliaryStyle": {
    "adapter": "semantic_auxiliary_style@1.0",
    "primaryStylePackId": "editorial-metaphor",
    "auxiliaryStylePackId": "friendly-handdrawn-tech",
    "requiredPageRole": "method",
    "designDnaPreserved": true,
    "antiTemplateConstraintsPreserved": true
  }
}
```

The adapter is intentionally narrow: it is accepted only for the frozen P6
method page. The primary direction remains `editorial-metaphor`; paper design,
burgundy/charcoal/warm-white palette, text roles, and the no HTML/UI/card/
dashboard constraints remain bound. Any missing field, version mismatch,
tampered adapter binding, or other per-page Style Pack drift is blocked before
Provider execution. Disabling this adapter leaves the historical `1.0`
single-Style-Pack path unchanged.

`blocked` 时不得生成 Provider 请求。`draft` 只表示确定性合同已编译，仍须原创资产审核和用户视觉选择；Prompt Set 本身任何状态都保持 `productionEligible=false`。历史 experimental/offline Invocation 仅可通过只读 `legacy_unplanned` Adapter 查看，禁止改写或回填为 stable evidence。
