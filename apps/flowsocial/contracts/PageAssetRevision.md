# PageAssetRevision@1.0

不可变页面版本 DAG 节点。严格字段包含版本/合同/id、任务/内容版本/页面、递增 revision、`parentRevisionId`、operation、generation mode、源候选/源修订 refs、绑定字节 hash 的 asset、normalization ref、三 Gate refs、选择者/时间及 `revisionHash`。

父节点必须存在且属于同一任务版本和页面，revision 单调递增且不得成环。`asset` 的 `relativePath`、`sha256`、`bytes` 和 `dimensions` 必须与 `normalizationRef` 指向记录的 `outputAsset` 完全一致；创建、快照、Manifest 与完整性审计均复核该绑定。选择、单页恢复、整套恢复都创建新节点，不覆盖旧节点。历史版本只读；关闭 Versioning Flag 后仍可读但禁止新写。回退是关闭 Flag 并保留历史对象。
