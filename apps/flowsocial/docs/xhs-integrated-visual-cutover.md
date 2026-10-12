# 小红书整页视觉链路统一

## 当前行为

新生产请求不再调用 `plan-xhs-visual-assets` 的文字 Provider。该步骤仅生成满足原子内容包结构的确定性兼容投影：所有页面标记为 `html_css`、`imageSpecs=[]`、页面资产绑定为空。这个标记不代表最终使用 HTML/CSS 渲染。

`design-xhs-integrated-pages` 是整页 Prompt 的唯一权威。它从冻结页面文字、已确认 Design DNA、视觉方向、页面 Archetype、Style Pack 和 Prompt Pattern 编译逐页 Provider Prompt。已确认的精确品牌色、字体角色、版式、材质、插画方向和禁用元素进入 `visualStyleSelection.constraints`，并投影到 Provider Prompt。

## 兼容性与下游影响

- 历史 `XhsVisualAssetPlan@1.0` 和历史无文字 `imageSpecs` 保持只读可验证，不迁移、不改写。
- 新内容包仍保留 `visualAssetPlan`，因此原子 Commit、Trace、Preflight 和旧读取接口不需要数据迁移。
- 新内容包的兼容 `imageSpecs` 为空。下游不得再把该数组作为整页生图 Prompt 来源；必须读取 `XhsIntegratedPagePromptSet@1.0` / `IntegratedPageExecutionPlan@1.0`。
- 不可变 revision ID 含 `:` 分隔符。HTTP 入口统一解码浏览器编码后的路由参数，使设计、Provider 规划与执行、审阅和交付都解析到同一个 revision。
- 标题加正文的常规页面按中等密度处理；只有单一文字层才属于低密度，避免普通方法页或列表页在 Prompt 编译前被 Archetype 兼容性误拦截。
- 图片 Provider、费用确认、人工执行批准、Page Revision、最终选择和发布闸门不变。
- 原始 VI 文件不会自动作为参考图发送。只有独立授权资产且 Provider 能力支持参考图时才可进入请求。

## 回滚

回滚代码后，旧 Provider 视觉规划会重新成为原子内容包的必经步骤。历史数据无需回滚。若回滚，必须同时恢复下游从 `visualAssetPlan.imageSpecs` 读取无文字配图 Prompt 的行为；不得让两个 Prompt 来源同时可执行。
