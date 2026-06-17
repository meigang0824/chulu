# 云数据库交互逻辑代码说明

## 小程序端入口

### `App.vue`

启动时调用：

```js
initCloud()
```

来自 `services/cloudClient.js`，负责初始化 `wx.cloud`。

## 云开发基础层

### `services/cloudClient.js`

职责：

- 判断当前运行环境是否支持 `wx.cloud`。
- 初始化云开发环境。
- 暴露 `db()` 获取云数据库实例。
- 暴露 `callFunction(name, data)` 调用云函数。
- 将云函数返回的 `{ ok: false }` 统一转为异常。

### `utils/cloudConfig.js`

职责：

- 配置云环境 ID。
- 统一维护集合名。
- 统一维护云函数名。

上线前必须修改：

```js
export const CLOUD_ENV_ID = 'aiwork-8g5erw9d885e24b4'
```

### `utils/cloudError.js`

职责：

- 将网络、权限、校验、库存不足等错误统一归一化。
- 提供 `showCloudError(error)` 进行用户提示。

## 业务数据服务层

### `services/dataService.js`

所有页面通过该文件访问数据，不直接散落调用数据库。

| 方法 | 数据源 | 说明 |
| --- | --- | --- |
| `getHomeData()` | `app_config`、`banners`、`products` | 首页轮播和商品 |
| `getProducts()` | `products` | 分类页商品 |
| `getProductById(id)` | `products` | 商品详情 |
| `getBuyerOrders(status)` | `orders` | 我的订单 |
| `getDefaultAddress()` | `addresses` | 默认地址 |
| `getAddresses()` | `addresses` | 地址列表 |
| `saveAddress(address)` | `addresses` | 新增或更新地址 |
| `deleteAddress(id)` | `addresses` | 删除地址 |
| `createOrder(payload)` | 云函数 `createOrder` | 创建订单并扣库存 |
| `adminAction(action, payload)` | 云函数 `businessApi` | 店长端后台操作 |
| `saveProduct(product)` | 云函数 `businessApi` | 新增或更新商品 |
| `updateProductStatus(productId, status)` | 云函数 `businessApi` | 商品上下架 |
| `updateOrderStatus(orderId, status)` | 云函数 `businessApi` | 订单状态更新 |
| `updateStockItem(productId, patch)` | 云函数 `businessApi` | 备货调整 |

服务层全部带 mock 回退：云环境不可用、网络异常或权限未配置时，小程序仍可以使用本地演示数据继续调试 UI。

## 已接入页面

| 页面 | 接入逻辑 |
| --- | --- |
| `pages/home/index.vue` | `onShow` 调用 `getHomeData()`，读取云端轮播、商品和轮播参数 |
| `pages/category/index.vue` | `onShow` 调用 `getProducts()` |
| `pages/product/detail.vue` | `onLoad` 调用 `getProductById(id)` |
| `pages/order/confirm/index.vue` | 提交订单时调用 `createOrder()` |
| `pages/order/list/index.vue` | `onShow` 调用 `getBuyerOrders()` |
| `pages/admin/banner-config/index.vue` | 保存配置时调用 `adminAction('saveBannerConfig')` |

## 云函数

### `cloudfunctions/dbSetup`

职责：

- 创建集合。
- 写入初始配置、分类、商品、轮播、备货数据。
- 返回初始化结果。

注意：

- 数据库权限和索引仍需在控制台按配置文件设置。

### `cloudfunctions/createOrder`

职责：

- 校验下单参数。
- 使用事务读取商品。
- 校验库存。
- 扣减 `products.stock`，增加 `products.sold`。
- 写入 `stock_logs`。
- 创建 `orders`。

错误：

- `VALIDATION_ERROR`
- `STOCK_NOT_ENOUGH`
- `NOT_FOUND`
- `UNKNOWN`

### `cloudfunctions/businessApi`

职责：

- 校验 `admin_users` 中的店长权限。
- 保存轮播配置。
- 更新订单状态。
- 更新备货数据。
- 新增或更新商品。
- 商品上下架。
- 写入 `audit_logs`。

错误：

- `PERMISSION_DENIED`
- `VALIDATION_ERROR`
- `UNKNOWN`

## 数据一致性策略

- 下单扣库存必须使用 `createOrder` 云函数事务，避免并发超卖。
- 买家端没有订单写权限，绕不开云函数校验。
- 后台操作统一记录审计日志。
- 轮播配置先尝试云端保存，云端失败时保留本地配置，方便开发调试。
