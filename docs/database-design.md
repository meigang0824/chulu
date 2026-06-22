# 初炉小程序云数据库设计

## 设计原则

- 公开展示数据可直接读：`app_config`、`categories`、`products`、`banners`。
- 用户私有数据只允许本人读写：`users`、`addresses`、`orders`。
- 敏感写入统一走云函数：下单、扣库存、轮播配置、订单状态、备货调整。
- 后台操作写入 `audit_logs`，保证可追溯。

## 集合清单

完整机器可读定义位于 `cloud/database/schema.mjs`。

| 集合 | 业务含义 | 权限策略 | 高频索引 |
| --- | --- | --- | --- |
| `app_config` | 门店配置、轮播参数 | 所有人读，云函数写 | `key_unique` |
| `admin_users` | 店长/员工权限 | 本人读，云函数写 | `openid_unique`, `role_status` |
| `categories` | 商品分类 | 所有人读，云函数写 | `key_unique`, `status_sort` |
| `products` | 团购商品 | 上架商品读，云函数写 | `status_sort`, `category_status`, `deadline` |
| `banners` | 首页轮播 | 启用项读，云函数写 | `enabled_sort`, `product` |
| `users` | 用户资料 | 本人读写 | `openid_unique` |
| `addresses` | 收货地址 | 本人读写 | `openid_default`, `updated` |
| `orders` | 订单 | 本人读，云函数写 | `openid_created`, `status_created`, `orderNo_unique` |
| `stock_items` | 备货汇总 | 云函数读写 | `product_unique`, `status_priority` |
| `stock_logs` | 库存流水 | 云函数读写 | `product_created`, `order` |
| `audit_logs` | 后台审计 | 云函数写 | `operator_created`, `action_created` |

## 关键字段约束

- `products.price/originPrice/stock/sold/totalStock` 必须为非负数。
- `products.status` 仅允许 `active`、`hidden`、`soldOut`。
- `orders.status` 仅允许 `created`、`paid`、`pendingDelivery`、`delivering`、`completed`、`cancelled`。
- `orders.orderNo` 唯一，用户端不可直接写。
- `addresses._openid` 必须等于当前用户 openid。
- `banners.enabled + sort` 控制首页轮播展示。
- `stock_logs.delta` 记录每次库存变化，扣减为负数，补货为正数。

## 权限规则

最小权限配置文件位于：

- `cloud/database/permissions/min-permission.json`

建议在云开发控制台逐集合设置：

- 公开读集合：`read: true, write: false`
- 用户私有集合：`read/write: doc._openid == auth.openid`
- 后台集合：`read/write: false`，只通过云函数读写

## 索引配置

索引配置位于：

- `cloud/database/indexes.json`

高频查询场景：

- 首页商品：`products.status + sort`
- 分类页：`products.categoryKey + status + sort`
- 首页轮播：`banners.enabled + sort`
- 我的订单：`orders._openid + createdAt`
- 店长订单：`orders.status + createdAt`
- 配送列表：`orders.deliveryStatus + deliveryTime`
- 备货：`stock_items.statusKey + prioritySort`

## 初始化数据

初始化数据位于：

- `cloud/database/seed/initial-data.mjs`
- `cloudfunctions/dbSetup/seed.js`

包含门店配置、轮播参数、分类、商品、轮播和备货汇总。
