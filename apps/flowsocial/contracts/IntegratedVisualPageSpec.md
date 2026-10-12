# IntegratedVisualPageSpec@1.0

离线整页候选的只读输入规范。上游为 `PageContentTruth@1.0`、冻结 Compiler Trace、能力评估与 Design DNA；下游为 `PageCandidate@1.0`。

严格字段：`schemaVersion=1.0`、`contract`、`id`、`contentTaskId`、`contentVersion`、`pageId`、`pageRole`、精确 `canvas={width:1080,height:1440}`、`contentTruthRef`、`contentTruthHash`、`compositionGoal`、`informationHierarchy`、`brandDnaRef`、`referenceAssetIds`、`styleConstraints`、`protectedRegions`、`normalizationPolicy`、`generationMode`、`sourceRefs`、`blockers`、`specHash`。未知或缺失字段失败；`specHash` 是除自身外完整对象的确定性 SHA-256。

`XhsPostPackage@2.0` 仅经只读 Adapter 投影为内容真值，不回写旧包。无法投影时返回 blocker，并显式回退 `deterministic_layout`。关闭离线 Pipeline Flag 即停止，不启用生产入口。
