# PageNormalizationRecord@1.0

记录 `none`、`fit_pad`、`fit_crop` 或等比 `resample`。字段严格包含版本/合同/id、`candidateRef`、模式与状态、输入/输出资产及尺寸、统一缩放、crop、pad、保护区校验、背景策略、blockers、时间和 `recordHash`。

输入和输出 SHA-256 均由实际 PNG 字节计算；输出成功必须机器验证为精确 1080×1440。`scale.x`、`scale.y` 和 `uniform` 必须由裁切窗口或填充后实际内容像素尺寸反算，不得用请求缩放值替代；奇数尺寸导致横纵实际缩放不一致时只能 blocked。禁止非等比拉伸；裁切穿越保护区或填充背景未获确定性白名单时硬阻断。源声明 hash 不可信，必须与字节复核。无法安全规范化时不产生输出，显式回退 `deterministic_layout`。
