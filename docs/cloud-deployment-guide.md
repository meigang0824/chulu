# 云开发部署与联调说明

## 1. 修改环境 ID

打开 `utils/cloudConfig.js`，将：

```js
export const CLOUD_ENV_ID = 'aiwork-8g5erw9d885e24b4'
```

替换为你的云开发环境 ID。

## 2. 上传云函数

在微信开发者工具中右键上传并部署：

- `cloudfunctions/dbSetup`
- `cloudfunctions/createOrder`
- `cloudfunctions/businessApi`

每个云函数均包含 `package.json`，依赖 `wx-server-sdk`。

## 3. 初始化集合与种子数据

在开发者工具云函数调试中调用：

```json
{
  "name": "dbSetup",
  "data": {}
}
```

该函数会创建以下集合并写入初始数据：

- `app_config`
- `admin_users`
- `categories`
- `products`
- `banners`
- `users`
- `addresses`
- `orders`
- `stock_items`
- `stock_logs`
- `delivery_routes`
- `audit_logs`

## 4. 配置权限

按 `cloud/database/permissions/min-permission.json` 在云开发控制台配置数据库权限。

重要规则：

- `orders.write = false`，下单只能走 `createOrder` 云函数。
- `products.write = false`，商品维护只能走后台云函数。
- `stock_items/read/write = false`，库存不暴露给买家端。
- `addresses` 只允许用户操作自己的数据。

## 5. 配置索引

按 `cloud/database/indexes.json` 在控制台创建索引。索引生效前，部分查询可能走全表扫描。

## 6. 配置管理员

首次部署后，在 `admin_users` 手动插入你的 openid：

```json
{
  "_id": "你的openid",
  "openid": "你的openid",
  "role": "owner",
  "name": "店长",
  "status": "active",
  "createdAt": "数据库日期",
  "updatedAt": "数据库日期"
}
```

这样店长端才能调用 `businessApi` 保存轮播、调整订单和库存。

## 7. 小程序端交互逻辑

已新增：

- `services/cloudClient.js`：初始化云环境、调用云函数、获取数据库实例。
- `services/dataService.js`：业务数据 API，支持云数据库与 mock 回退。
- `utils/cloudError.js`：统一错误转换和 Toast 提示。

已接入页面：

- 首页：读取 `banners`、`products`、`app_config.homeBannerSettings`。
- 分类：读取 `products`。
- 商品详情：按商品 ID 读取 `products`。
- 确认订单：调用 `createOrder`，云函数事务扣库存。
- 我的订单：读取 `orders`。
- 店长轮播配置：调用 `businessApi.saveBannerConfig`。

## 8. 异常处理

覆盖场景：

- 云开发不可用：服务层回退 mock 数据。
- 网络异常：统一提示“网络异常，请稍后重试”。
- 权限不足：统一提示“暂无操作权限”。
- 参数校验失败：统一提示“提交信息不完整”。
- 库存不足：统一提示“库存不足，请减少购买数量”。
