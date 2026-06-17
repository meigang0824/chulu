# 数据库测试报告

## 测试范围

测试文件：

- `tests/database/run-database-tests.mjs`

覆盖内容：

- 集合定义完整性
- 权限配置完整性
- 索引配置完整性
- 种子数据完整性
- 并发扣库存一致性模拟

## 本地执行

```sh
node tests/database/run-database-tests.mjs
```

## 预期结果

```txt
PASS testSchemaCoverage
PASS testPermissions
PASS testIndexes
PASS testSeedData
PASS testConcurrentStockConsistency

5/5 database tests passed
```

## 真云环境联调用例

| 用例 | 步骤 | 预期 |
| --- | --- | --- |
| 初始化集合 | 调用 `dbSetup` | 所有集合创建成功，种子数据写入 |
| 首页读取 | 打开首页 | 轮播、商品从云数据库读取 |
| 下单成功 | 选择商品并支付 | `orders` 新增记录，`products.stock` 扣减，`stock_logs` 新增流水 |
| 库存不足 | 将商品库存改为 0 后下单 | 返回 `STOCK_NOT_ENOUGH` |
| 权限不足 | 非管理员保存轮播 | 返回 `PERMISSION_DENIED` |
| 轮播配置 | 管理员保存轮播 | `banners` 和 `app_config.homeBannerSettings` 更新 |
| 订单状态 | 管理员更新配送状态 | `orders.status` 更新，`audit_logs` 有记录 |

## 当前限制

- 集合权限和索引必须在云开发控制台配置，云函数无法完整替代控制台权限设置。
- 支付目前是模拟支付，真实微信支付需要后续接入商户号与支付回调。
- 文件上传未接入云存储，目前轮播图片使用项目内静态资源路径。
