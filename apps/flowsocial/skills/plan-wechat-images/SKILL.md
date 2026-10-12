---
name: plan-wechat-images
description: 根据已批准的公众号文章与 ContentMaster 规划必要配图槽位、用途、来源策略和无文字 ImageSpec。用于文章完成后、生图之前；不执行生图或修改正文。
---

# 规划公众号配图

让图片承担解释、证据、节奏或情绪功能，不为凑数量插图。每篇必须规划一张结合全文语义的封面和至少一张结合具体章节内容的正文图；正文图总数和形式由文章内容决定，不设置固定张数。

## 输入要求

要求输入包含公众号文章、ContentMaster、DesignDNA、授权素材、图片数量范围和供应商能力。执行前读取 [contract.md](references/contract.md)。

## 工作流

1. 标记最需要视觉支持的段落和具体目的。
2. 只从 `image_runtime.allowed_strategies` 中选择策略。
   只允许选择输入 `image_runtime.allowed_strategies` 中列出的策略；当 `generated_raster_available=false` 时严禁规划 `generated_raster`，不得把无法执行的策略留给下游。
3. 场景、隐喻、情绪或概念解释适合 `generated_raster`；需要精确呈现步骤、关系、比较、数据或清单时适合 `html_chart`。封面和正文图都应结合对应内容，不得把文章标题原样做成标题卡。
   当 `generated_raster_available=true` 时，封面优先使用 `generated_raster`，且至少规划一张非 `no_image` 正文图。整篇 `cover=no_image` 或空 `slots` 不是成功结果。
4. 对生成式图片建立无文字 ImageSpec，并指定构图、色板和文章插入位置。
5. 将事实型图片绑定 `claim_ids`；纯氛围图不得暗示不存在的事实。
6. 检查首图、正文配图和移动端比例的一致性。

## 边界

- 不修改标题、摘要、正文、引用和 CTA。
- 不调用生图，不生成公众号 HTML。
- 不伪造产品界面、数据图、现场照片或人物肖像。
- 不要求生成模型在图内写中文。

## 交付接缝

只有精确 Article Review 为 `pass`、无需事实复核且无 blocker 时才调用本 Skill。通过严格合同的 `success` 计划可由唯一 Artifact Engine 物化；`partial`、fallback 或裸 data 不具备权威性。精确中文、流程、比较与清单使用 `html_chart` 生成确定性 PNG；概念、场景或隐喻才允许 `generated_raster`。物化不得改写文章正文，且每张正文图必须按冻结 `after_section_id` 插入。离线包只生成可移植资产、预览与草稿上传计划；封面 `media_id`、正文 `uploadimg` URL 和平台发布仍是后续显式步骤。

Gateway 只验证 canonical envelope、plan/cover/slot 结构。通过结构检查不代表计划具备权威性；review readiness、章节/claim/source、素材许可、策略与 ImageSpec 一致性仍由 authoritative Domain Adapter fail closed，不得自动补图、改策略或提升 non-success。
