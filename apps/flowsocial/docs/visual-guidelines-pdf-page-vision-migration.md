# 小红书视觉规范：PDF 页面视觉识别迁移说明

## 变更

- `knowledge_files` 自动增加 `page_count` 和 `content_mode` 两列。
- 没有有效文本层的 PDF 不再生成伪知识片段，解析状态改为 `visual_ready`，解析模式改为 `pdf_page_vision`。
- Design DNA 来源校验同时接受 `ready` 和 `visual_ready`；前者代表可读取文字，后者代表可以进行页面视觉识别。
- 视觉分析接口仍兼容旧客户端的 `approvedFileIds`，新客户端使用 `sourceFileIds`，一次点击即代表本次固定预算授权。

## 下游影响

- 普通知识检索仍只使用有真实文本片段的文件，`visual_ready` PDF 不进入全文检索。
- 小红书视觉规范分析会把 PDF 页面渲染为总览图；单次请求最多 8 次模型调用且不自动重试。
- 分析成功必须同时包含有效视觉信号；失败信息不会写入 Design DNA 规则字段。
- 历史 `pdf_text` 文件无需立即迁移，视觉分析端会按 `.pdf` 文件类型强制走页面视觉识别。重新上传或重试解析后会写入新状态和页数。

## 兼容与回滚

- 新增数据库列带默认值，旧数据库启动时自动迁移，不要求停机脚本。
- 回滚应用代码时新增列可保留，旧代码会忽略它们。
- 若必须回滚视觉型 PDF 的状态，可将目标文件的 `parse_status` 改回 `ready`、`parse_mode` 改回 `pdf_text`；这只恢复旧行为，不会删除原始上传文件。

## 验证

- `knowledge-base-self-test.mjs`：无文本层 PDF 被识别为 `visual_ready`，页数正确且不生成知识片段。
- `minimax-vision-adapter-self-test.mjs`：PDF 页面渲染、分组调用、覆盖信息和视觉信号聚合。
- `settings-visual-guidelines-ui-self-test.mjs`：普通界面不暴露 Provider、不出现二次确认，并保留最终人工确认。
- 使用现有 33 页官方 VI 文件做离线渲染验证：33/33 页成功渲染，分为 5 个页面总览批次。
