# 小红书本地内容包下载兼容说明

## 变更

- 新增只读下载接口：`GET /api/v1/unified-content-projects/:projectId/platforms/xiaohongshu/final-deliveries/:deliveryId/download`。
- `POST .../xiaohongshu/final-delivery` 的响应新增 `localPackage.downloadUrl` 与 `localPackage.fileName`；原有字段和持久化事实不变。
- 下载 ZIP 只包含一份 `小红书发布文案.docx`（标题、正文、标签）和 `图片/` 下按页排序的 PNG。
- 下载使用已经冻结的 `AtomicXhsFinalDeliveryRecord@1.0`；不会重新生成内容、调用 Provider、上传或发布到平台。

## 兼容与下游影响

- 数据库和事实合同无迁移；历史 `AtomicXhsFinalDeliveryRecord@1.0` 可直接下载。
- 交付记录哈希、版本选择和人工确认语义不变。
- 前端已完成的内容包按钮从禁用状态改为“下载小红书内容包”。
- 公众号链路不使用此接口，行为不变。

## 代表性验证

- `node scripts/tests/xhs-local-package-self-test.mjs`
- `node scripts/tests/atomic-xhs-promotion-delivery-self-test.mjs`
- `node scripts/tests/content-production-studio-ui-self-test.mjs`
- `node scripts/tests/unified-content-product-api-self-test.mjs`
- 使用现有冻结项目从前端点击下载，验证 ZIP、DOCX 中文文案和 6 张 1080×1440 PNG。

## 回滚

移除下载路由、前端下载方法与按钮分支即可回滚。由于未修改数据库结构或既有交付事实，回滚不需要数据转换。
