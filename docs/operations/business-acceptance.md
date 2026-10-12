# 真实业务验收输入与证据

这是一份待填写的验收准备清单，尚未授权真实 Provider 或平台调用。填写非敏感 ID、版本、hash 和私有证据引用；不写密钥、Token、Cookie、密码、客户原文、数据库路径内容或凭据截图。当前先验证本地单工作区，团队线上需求待所有者确认。

## 1. 权威输入确认

| 输入 | 待填写非敏感引用 | 责任人/确认 |
| --- | --- | --- |
| 验收范围 | 本机 / 团队方案；小红书 / 微信公众号 | 待确认 |
| 工作区/公司/账号 | workspaceId、companyId、accountId、platform | 待确认 |
| 业务数据策略 | 新 seed / 已授权的私有数据迁移批次引用 | 待确认 |
| 冻结业务事实 | fact snapshot ref + version + hash，来源授权引用 | 待确认 |
| 活动策略 | strategy snapshot ref + version + hash | 待确认 |
| 周期/选题/来源 | publishingCycle、opportunity、source snapshot 精确引用 | 待确认 |
| 权限范围 | 授权记录的私有引用、有效期、允许操作；不填凭据 | 待确认 |
| 账号操作责任 | 谁生成、谁审阅、谁最终发布、谁回收指标 | 待确认 |

不同平台共享同一冻结上游输入，平台大纲和最终内容仍按平台隔离。输入发生变化时生成新版本并重新确认，不改写历史事实。

## 2. 内容生成与费用批准

| 输入 | 待填写 |
| --- | --- |
| 目标内容 | exact commit/product ref、目标平台、大纲确认 ref |
| 生成范围 | 文本 / 整套图片 / 单页 regenerate / image_edit，目标 page revision |
| Provider 配置摘要 | Provider、model、协议；操作者私下确认配置可用 |
| 精确计划 | prompt plan ref/hash、authority hash、revision-set hash |
| 调用预算 | 本次创建任务最多几次、查询最多几次、总调用上限 |
| 费用预算 | credits 上限及币种/报价来源；无报价写 upper_bound_only |
| 重试预算 | 自动重试 0；重新授权的人工追加预算与理由单独记录 |
| 批准对象 | approval ref/hash、批准人、时间、失效条件 |

初次生成与 regenerate 采用 `gpt-image-2-text-to-image`，纯视觉编辑采用 `seedream/4.5-edit`，具体可用性须由操作者核实。未知费用、未知外部效果或过期 approval 不能用一次新请求绕开。

## 3. 用户审阅与精确选择

| 输入 | 待填写 |
| --- | --- |
| 文章版本 | title/body/article ref + version + hash |
| 图片/页面集合 | 每页 page ref + revision + asset hash，完整 revision-set hash |
| 技术检查 | 事实、锁定文字、尺寸、文件/MIME、平台结构结果 |
| 人工视觉确认 | exact full page revision set、确认人/时间/ref |
| 用户选择 | selected article/page/image refs、selection ref/hash |
| 本地交付 | manifest/hash 与精确内容引用；仅记引用，不提交产物 |

任何改单造成 current revision set 变化后，旧人工确认和选择可能 stale，必须重新确认当前精确对象。本地 HTML/ZIP/图片可供用户检查，但不能填写为已上传、草稿或已发布证据。

## 4. 发布前人工确认

发布前最后一次确认必须列出目标账号、确切标题/正文/逐图版本、所用本地交付 manifest、计划时间与权限范围。确认人和确认时间：**待填写**。

当前产品默认关闭真实平台 API 写入；人工发布场景由已授权操作者在平台完成后回填事实。后续如果启用平台 API，需另行审查开关、精确执行对象、调用预算和授权，不能把本清单当作 API 发布许可。

公众号历史 `WECHAT_40164` 的 IP 白名单证据引用：**待独立确认**。未确认前不运行上传/草稿重试；现有批准图文包保持 local-only。

## 5. 发布证据与反馈对账

| 证据 | 待填写非敏感引用 |
| --- | --- |
| 发布事实 | 平台对象 ID/公开 URL、账号、发布时间、精确内容 hash、人工观察证据私有引用 |
| 本地记录 | publication fact ref、幂等键、确认人、核对时间 |
| 72h 指标 | observation window、采集时间、指标来源、metric snapshot ref/hash |
| 7d 指标 | 同上；未提供指标记 null，不填为 0 |
| 下一步 | tactic experiment / strategy review candidate / next-cycle refs |
| 对账结果 | 实际发布与选中版本是否一致；差异、未确认效果和责任人 |

发布时间/反馈窗口必须成熟，数据与精确发布版本对应；记录本地事实仅证明已登记，平台真实性仍需独立证据。当前 `GET /dashboard` 的 generated/drafts 仍有演示偏移（`server.mjs:2665`），不能用作真实统计或业务验收证据；指标以平台来源和精确 snapshot 为准。

## 验收场景

| 场景 | 可接受证据 | 不能据此宣称 |
| --- | --- | --- |
| 干净离线回归 | Node 24.18.0、`test:offline` 退出 0、临时数据与零外网 | Provider 成功、模型质量或平台效果 |
| 小红书真实内容质量 | 已授权精确计划/预算、Provider attempt/task/effect 引用、原图 hash、人工逐页确认 | 图片已发布 |
| 小红书人工闭环 | 精确选择 + 发布前确认 + 实际平台发布证据 + 72h/7d 指标 | 自动发布/自动采集已实现 |
| 公众号本地包 | 专用 Artifact Review/Selection、文章/图片版本与 manifest | 已上传、草稿、发布或微信反馈 |
| 公众号人工闭环 | 已授权操作者完成精确发布，真实平台证据与成熟指标对账 | 微信 API 上传或草稿成功 |
| 后续公众号 API 验收 | 独立白名单证据、明确授权/预算、精确计划、逐项 attempt/effect/对账 | 上传成功等同发布成功 |

## 停止条件与恢复

以下任一出现即停止依赖动作：权威输入/账号不一致，权限或有效期不明，用户未选精确版本，approval stale，原图缺失，费用/调用预算耗尽，IP 白名单未确认，响应/效果未知，事实冲突或已发布对象无法对账。

保留请求的精确引用、幂等键、调用预算消耗和非敏感错误类别。先查询并核实原效果，不自动创建新的 Provider/平台请求。仅在效果明确、版本和授权重新确认且人工批准追加预算后恢复。回退代码不撤销已发生的平台效果，也不删除历史快照/attempt/反馈。
