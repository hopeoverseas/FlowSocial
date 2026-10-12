# XhsVisualDeliveryEvent@1.0

选择、拒绝、单页恢复、整套恢复、包准备、下载和交付的不可变事件。严格字段为版本/合同/id、连续 sequence、`idempotencyKey`、type、aggregate ref、actor、时间、payload、`previousEventHash` 与 `eventHash`。

相同幂等键和相同语义返回既有事件；同键不同语义硬失败。事件 hash 链必须连续，任何 payload、引用、顺序或前序 hash 篡改失败。包准备、下载、平台交付和用户选择保持独立；05F 的 `delivery_marked` 只能保留 `not_delivered`，不得伪造生产 delivered。关闭 Flag 后不写新事件；历史链保留只读。
