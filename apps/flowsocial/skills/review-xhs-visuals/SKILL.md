---
name: review-xhs-visuals
description: 对已渲染的小红书图文页进行多模态视觉审核，检查缩略图吸引力、中文可读性、层级、品牌一致性、图文事实对应和跨页节奏。只输出问题与局部补丁。
---

# 审核小红书视觉

比较最终页面图片、DeckSpec、DesignDNA 与 ContentMaster。先判断是否可发布，再提供最小范围的修复建议。

## 输入要求

要求输入包含所有渲染页图片、XhsPostPackage、ContentIntentProfile、ContentMaster、DesignDNA、当前版本和渲染日志。图片缺页或无法读取时返回 `failed`。执行前读取 [contract.md](references/contract.md)。

## 审核维度

1. 封面在缩略图下是否仍有清晰主题和层级。
2. 中文字号、行数、对比度、边距、安全区和文字溢出。
3. 单页是否只有一个主要信息点，跨页是否重复或断裂。
4. 图片是否服务页面目标，是否出现错误文字、水印、Logo 或伪造界面。
5. 数字、图示和文案是否与 `fact_ids` 一致。
6. 色板、字体角色、构图和素材处理是否符合 DesignDNA。
7. 页码、来源、CTA 和必要免责声明是否完整。
8. 内容目的是否在封面、卡片与正文中兑现，推广强度是否与 IntentProfile 一致。
9. 主要互动方式是否自然且唯一，是否出现堆叠式 CTA。

## 输出规则

按 `blocker`、`warning`、`suggestion` 输出定位到页码和元素的发现，并提供最小补丁。只有阻断项为零时才可 `pass`。

## 边界

- 不重做选题、正文、DeckSpec 全局结构或 DesignDNA。
- 不直接编辑图片、HTML 或文案。
- 不调用生图或渲染；修复由编排器分派到对应节点。

## 05F 隔离离线审阅

当输入为 `PageCandidate@1.0` 时，必须分别读取三层尺寸、`PageTextCheck@1.0`、`PageFactCheck@1.0`、`XhsIntegratedVisualReview@1.0`、资产 SHA-256 与修订引用。任一 blocker、非精确最终画布或非 passed Gate 都不得被人工选择绕过。离线 fixture 断言和预览不等于真实 OCR、真实 Provider 视觉质量或生产交付通过；只允许建议显式 `deterministic_layout` 回退。五个 05F Feature Flag 默认关闭，本 Skill 不启用它们、不写生产 UI/存储，也不批准资产。
