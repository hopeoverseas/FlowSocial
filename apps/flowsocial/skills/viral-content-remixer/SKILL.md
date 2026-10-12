---
name: viral-content-remixer
description: Analyze an imported high-performing social post, extract reusable structural and visual patterns, and create an original post for a new topic and account. Use for viral-post analysis, style transfer, reference-led creation, or generating platform-specific variants without copying source expression or assets.
---

# 爆款拆解与原创重构

> P1 可选能力：仅在用户明确导入参考内容并确认分析权限后显式调用。它不进入默认热点到内容主链路，也不得调用其他 Skill、搜索新素材或直接发布。

从用户有权使用或公开可分析的图文中提取抽象创作规律，再结合新主题、账号策略和事实材料生成原创内容。不得复刻原文、独特画面、人物形象、品牌资产或可识别的作者表达。

## 输入

```json
{
  "reference_post": {
    "platform": "",
    "url": "",
    "title": "",
    "body": "",
    "images": [],
    "performance_context": {},
    "usage_rights": "owned|licensed|public-analysis"
  },
  "target": {
    "topic": {},
    "account_strategy": {},
    "platforms": [],
    "evidence": [],
    "assets": []
  }
}
```

如果权限不清楚，只允许分析高层结构和公开可见特征，不下载、复用或编辑原素材。

## 拆解流程

1. 提取内容承诺：用户为什么愿意点开、看完、收藏或互动。
2. 拆解标题：受众、痛点、利益点、悬念、数字和语气，不复用特有句式。
3. 拆解叙事：钩子、冲突、信息递进、证据、转折、总结和 CTA。
4. 拆解信息密度：具体场景、数据、案例、步骤和可执行结论。
5. 拆解视觉：封面层级、页面节奏、构图类别、色彩关系、字体角色、图片与文字比例。
6. 识别平台机制：阅读/滑动/停留/评论动机及内容形式。
7. 形成抽象的 `style_blueprint`，禁止保留原文连续表达和独特画面描述。
8. 用目标账号、主题、事实和平台规则重新生成内容母版及平台版本。
9. 做文本和视觉相似度检查；过近时重新生成。

## 输出

```json
{
  "analysis": {
    "success_hypotheses": [],
    "title_pattern": {},
    "narrative_pattern": [],
    "information_pattern": [],
    "visual_pattern": {},
    "engagement_pattern": {},
    "platform_fit": [],
    "do_not_copy": []
  },
  "style_blueprint": {
    "hook_type": "",
    "pacing": "",
    "content_structure": [],
    "visual_roles": [],
    "tone_traits": [],
    "cta_mechanism": ""
  },
  "original_brief": {
    "new_core_claim": "",
    "new_outline": [],
    "required_evidence_ids": [],
    "visual_direction": "",
    "platforms": []
  },
  "similarity_check": {
    "text_risk": "low|medium|high",
    "visual_risk": "low|medium|high",
    "issues": []
  }
}
```

## 质量门槛

- 输出“成功假设”，不把单篇高表现的原因当成确定事实。
- 保留结构规律，不保留原作者独特措辞、案例、数据、画面或品牌元素。
- 新内容必须由目标账号的事实、观点和素材支撑。
- 不冒充原作者，不生成让用户误认来源的内容。
