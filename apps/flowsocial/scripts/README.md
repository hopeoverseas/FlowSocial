# Scripts

- `tests/`：自测、合同评测和显式 live test；普通测试默认不访问外网。
- `maintenance/`：备份、数据修复、回填和修复预览。
- `demos/`：可复现演示流程及产物生成。

优先通过 `package.json` 中的 npm scripts 调用，不要直接依赖脚本文件路径。
