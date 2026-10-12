# 阶段 4：产品能力策略基线

## 目标

`product-capability-policy.mjs` 成为本地产品模式 Feature Flag 的唯一声明源。能力不再只显示“代码存在/开关值”，而是明确分为产品基线、受控 Provider 动作、平台外部效果和实验能力。

## 默认策略

- `baseline`：统一策略到双平台内容、原子内容产品、人工大纲/视觉选择、本地版本与内容包默认开启。
- `controlled`：会产生付费 Provider 调用的计划、执行和轻修订入口可用，但原有精确 Prompt、费用与二次执行确认保持不变。
- `external_effect`：公众号上传/草稿、平台发布、发布事实、自动反馈和旧 Promotion 全部显式关闭。
- `experimental`：自动学习、自动 Skill 晋升、视觉 Review、OCR/离线整页管线、直接交付和 body-first 恢复全部显式关闭。

## 下游影响

- `product-mode-flags.mjs` 不再维护第二份开关表，只应用根策略默认值，并继续保留运维人员的显式环境变量覆盖。
- `/api/v1/health` 新增 `productCapabilityPolicy`，显示基线是否完整、外部效果是否关闭、偏差和不安全偏差；不返回密钥或环境变量值。
- 健康接口同时校验环境变量与运行时 Feature Flag 投影；前端“供应商配置”页展示同一策略的主链、受控 Provider、外部效果和实验能力计数。
- Skill Manifest 为原子小红书组件声明 `local-package` Profile、产品层级和实际 Feature Flag，避免“代码存在”被误解为默认可用。
- 旧 `CONTENT_PROMOTION_V1` 不再隐式开启 `LOCAL_CONTENT_PROMOTION_V1` 或 `LOCAL_PACKAGE_DELIVERY_V1`。需要本地锁版/内容包的非产品模式部署必须显式设置对应开关；产品启动器已显式设置，不受影响。
- 现有 HTTP 路径、数据库结构、人工确认门、Provider 调用预算和历史事实均不改变。

## 回滚

回退阶段 4 提交即可恢复旧的本地开关表及旧 Promotion 兼容回退。该变更不迁移数据，也不删除任何 Feature Flag。若仅需兼容旧部署，可显式设置 `LOCAL_CONTENT_PROMOTION_V1=1` 与 `LOCAL_PACKAGE_DELIVERY_V1=1`，无需重新打开上传或发布。若出现紧急问题，可关闭单个 baseline/controlled Flag；健康接口会把它列入 `missingBaseline` 或 `deviations`，但不会改写已存在的内容事实。
