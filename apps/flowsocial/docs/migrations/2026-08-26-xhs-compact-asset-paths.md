# 小红书本地产物短路径兼容说明

## 变更

- 新的初次整页图片和轻量改单图片使用 `xhs/compact-v1/` 短路径；目录身份由候选 Hash、页面 ID、attempt 和执行请求 Hash 的稳定短摘要组成。
- Provider staging 在上游未声明路径时也使用短哈希 fallback，不再把完整 attempt ID 拼进目录名。
- 路径方案只影响新写入的本地文件位置，不改变 Provider Attempt、Page Revision、Hash、人工确认或最终交付合同。

## 兼容与下游影响

- 历史事实中的 `xhs/raw/...`、`xhs/normalized/...`、`xhs/provider-results/...` 和 `provider/<long-attempt-id>/...` 路径保持不可变，并继续由读取器按事实中的精确 `relativePath` 读取。
- 不扫描、不猜测、不重命名，也不迁移历史产物。读取器天然双读：旧路径和 `compact-v1` 路径都经过同一个隔离目录边界与 Hash 校验。
- 新写入只使用 `compact-v1`；路径本身携带方案版本，因此无需给历史事实增加字段或执行数据库迁移。
- 新相对路径的测试上限为 140 字符，为 Windows 工作区绝对路径、临时 staging 和 ZIP 处理保留余量。

## 验证

- `node scripts/tests/xhs-compact-asset-path-self-test.mjs`
- `node scripts/tests/xhs-kie-production-adapter-self-test.mjs`
- `node scripts/tests/xhs-page-artifact-runtime-self-test.mjs`
- `node scripts/tests/xhs-light-revision-self-test.mjs`
- `npm run test:product`

所有验证使用离线或注入式 Provider，不调用 Kie、不上传、不发布。

## 回滚

1. 回退新写路径生成器即可停止创建 `compact-v1` 产物。
2. 已写入事实中的短路径必须继续按精确路径读取，不得删除或改写。
3. 不要在回滚时搬迁历史或短路径文件；如需重新生成，必须创建新的审批与执行事实，不能复用旧 Provider 权限。
