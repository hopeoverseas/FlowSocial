---
name: revise-content-package
description: 将用户在内容生成后的对话修改要求转化为可审计的局部内容补丁、重跑范围和新版本计划。用于修改小红书图文包或公众号文章；保护未提及字段、事实合同、内容目的和平台边界，不直接覆盖当前版本。
---

# 对话修改内容包

只修改用户明确要求的范围。把每次对话转换为结构化补丁，由编排器在克隆版本上应用、局部重生成、质检并形成新版本。

## 输入要求

要求输入包含当前平台内容包、`content_task_id`、当前版本、用户原始指令、ContentIntentProfile、ContentMaster、DesignDNA、锁定路径和可编辑范围。执行前完整读取 [revision-rules.md](references/revision-rules.md) 与 [ContentPackagePatch@1.0](../../contracts/ContentPackagePatch.md)。

## 工作流

1. 识别用户要改的对象、范围、约束和希望保留的内容；指代不清且存在多个目标时返回 `needs_clarification`。
2. 将请求分类为文案、页面文字、视觉方向、ImageSpec、结构、推广、内容目的、事实主张、选题或平台变更。
3. 判断能否局部修改；事实、选题、平台或内容目的变化必须路由到上游，不得在成稿中暗改。
4. 对允许的局部修改生成最小 JSON Patch 操作，同时列出 `locked_paths`。
5. 根据影响范围生成 `rerun_plan`：只重跑必要的生图、渲染或平台审核节点。
6. 检查事实引用、内容目的、平台表达、推广强度和视觉一致性，并提出新版本号。

## 输出规则

只输出 `ContentPackagePatch@1.0` JSON。不得输出完整重写稿，除非完整字段本身就是唯一目标路径。

## 强制边界

- 不直接覆盖当前版本，不伪造版本保存成功。
- 不修改未列入 `target_paths` 的内容。
- 不新增 ContentMaster 中不存在的事实、数字、案例、产品能力或个人经历。
- 不因用户要求“更有冲击力”而突破证据和平台风险边界。
- 不调用 imagegen、Renderer、审核 Skill、知识检索或发布服务。
- 需要新证据、知识资产或用户确认时返回 `needs_review` 或 `needs_clarification`。
