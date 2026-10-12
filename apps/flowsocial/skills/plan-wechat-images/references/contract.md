# WechatImagePlan@1.0

Gateway validates only the canonical envelope and exact plan/cover/slot structure. The authoritative Domain Adapter retains review readiness, section/claim/source authority, asset licensing, strategy/ImageSpec consistency, and immutable plan hashing; structural success is never publication authority.

```json
{
  "status": "success",
  "data": {
    "plan_id": "WIP001",
    "cover": {"purpose": "explain | prove | compare | pace | mood", "strategy": "authorized_asset | html_chart | generated_raster | no_image", "asset_id": null, "claim_ids": [], "image_spec": null},
    "slots": [{"slot_id": "WS01", "after_section_id": "W2", "purpose": "explain | prove | compare | pace | mood", "strategy": "authorized_asset | html_chart | generated_raster | no_image", "claim_ids": [], "asset_id": null, "image_spec": {"asset_id": "", "use_case": "illustration-story | photorealistic-natural | stylized-concept | product-context | texture-background", "asset_type": "wechat-inline", "prompt": "", "reference_asset_ids": [], "design_dna_version": "", "size": "1536x1024", "must_avoid": ["文字", "水印", "Logo"], "text_policy": "no_text_in_image"}}]
  },
  "warnings": [],
  "blocked_reasons": []
}
```

没有明确功能的额外槽位应不输出。成功计划必须包含一张非 `no_image` 封面和至少一张非 `no_image` 正文图；实际生图由 ImageProviderAdapter 完成。

运行时输入会提供 `image_runtime.allowed_strategies` 和 `generated_raster_available`。计划必须服从该能力快照；当前执行器未开放 `generated_raster` 时，只能使用 `html_chart`、`no_image` 和确有授权记录的 `authorized_asset`，避免生成一个下游无法物化的计划。

权威计划只接受完整四字段 envelope，且必须 `status=success`、`blocked_reasons=[]`。`partial`、`needs_review`、fallback、裸 `data` 和历史存储投影只能作为只读诊断材料，不能生成 Candidate 或 PlanFact。

- `no_image` 的 `asset_id`、`image_spec` 必须为 `null`，`claim_ids` 必须为空。
- `authorized_asset` 与 `html_chart` 必须绑定当前任务中 approved、允许发布、来源与 SHA-256 可追踪的资产；`image_spec` 必须为 `null`。
- `generated_raster` 必须内嵌完整 `image_spec`；封面使用 `asset_type=wechat-cover`，正文使用 `wechat-inline`，并要求 `text_policy=no_text_in_image` 与 `must_avoid=["文字","水印","Logo"]`。
- 正文 `after_section_id` 必须存在于当前文章冻结大纲；每个 `claim_id` 必须同时存在于该章节、当前 `claim_map`、ContentMaster confirmed facts，并解析到当前文章和母版共同允许的来源。

## Artifact Engine 兼容投影

- Skill 调用继续返回上面的 `status/data` 包装；写入 `WechatArticle@2.0.image_plan` 时只投影 `data`，并补充 `schemaVersion=1.0` 与不可变 `plan_id`。旧文章的空 `cover/slots` 仍由原无图渲染路径处理，不迁移、不改写。
- `html_chart` 的 `asset_id` 必须解析到当前任务的原创确定性资产定义，并渲染为包内 PNG；`authorized_asset` 必须解析到 approved 且许可证可追踪的 Registry 记录；`generated_raster` 必须解析到当前正文版本的成功资产。任何缺失或跨版本引用都阻断交付。
- `after_section_id` 只能绑定已确认大纲的 `section_id`。Artifact Engine 必须先验证 Markdown H2 与冻结大纲标题一一对应，再在完整章节正文之后插入 `figure/img/figcaption`；不得用标题 slug 猜测锚点。
- 离线包内 HTML 使用 `assets/...` 可移植路径。真实草稿 Adapter 必须把封面上传结果的 `media_id` 写入 `thumb_media_id`，把每张正文图片经 `uploadimg` 返回的 URL 替换到对应 `img.src`；两类结果不得互换，也不得把本地路径或任意外链静默写入草稿。
- `WECHAT_ILLUSTRATED_DELIVERY_V1` 默认关闭。关闭时保留历史无图 HTML；开启时输出图片计划、包内图片、质量报告和草稿上传计划，但仍不自动上传、不创建草稿、不发布。
- 非空 `claim_ids` 必须同时存在于当前 `claim_map`、目标 `after_section_id` 的冻结章节 `claim_ids`，并能解析到当前 `source_list` 中允许发布的来源；未知 ID、跨章节借用和私有/未授权来源一律阻断。
- `authorized_asset` 只接受当前任务 Registry 中 `status=approved`、具有明确许可证 ID、`allowsPublication=true`、来源引用及来源 SHA-256 的记录；包内实际文件必须与来源 SHA 一致。不得仅凭策略名称把许可证 Gate 记为通过。
- OCR、事实、许可证、视觉和移动 Gate 任一不是 `passed` 时，交付保持 `needs_review`，不得写出 Manifest、不得标记 `ready`、不得生成 ZIP。修复后重新渲染时不得沿用旧 Manifest 或旧 ZIP。
- 离线上传 Adapter 模拟必须验证封面只返回 `media_id`、正文只返回 HTTPS `uploadimg` URL；投影后的草稿正文不得残留本地/data/file `src`，也不得包含封面 `media_id`。ZIP 成员集合、字节数和 SHA-256 必须逐项匹配 Manifest。
