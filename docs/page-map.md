# 页面地图

本文件为 `analyze_prototype` 阶段输出，只记录原型与路由规划，不包含页面实现。

## 原型路由映射

| 原型图 | 页面 | 路由 | 端 | 关键内容 |
|---|---|---|---|---|
| `docs/prototypes/prototype-reference-01.png` | 买家首页 | `pages/home/index` | 买家 | 品牌导航、营销 banner、今日开团、购买动态、店铺配送信息、买家底部导航 |
| `docs/prototypes/prototype-reference-02.png` | 商品详情 | `pages/product/detail` | 买家 | 商品轮播图、价格库存、配送说明、储存/口感信息、购买动态、数量选择、底部购买栏 |
| `docs/prototypes/prototype-reference-03.png` | 确认订单 | `pages/order/confirm/index` | 买家 | 收货地址、商品清单、配送时间、订单备注、费用明细、微信支付底栏 |
| `docs/prototypes/prototype-reference-04.png` | 备货汇总 | `pages/admin/stock-summary/index` | 商家 | 日期筛选、SKU/计划总量统计、备货提示、商品备货明细、状态筛选排序 |
| `docs/prototypes/prototype-reference-05.png` | 订单详情 | `pages/order/detail/index` | 买家 | 已付款状态、地址、商品、订单信息、实付款、履约进度、联系客服/再次购买 |
| `docs/prototypes/prototype-reference-06.png` | 店长工作台 | `pages/admin/dashboard/index` | 商家 | 今日经营统计、快捷入口、正在开团、待处理订单、经营提示 |
| `docs/prototypes/prototype-reference-07.png` | 开新团 | `pages/admin/create-group/index` | 商家 | 发布提示、商品表单、商品预览、购买动态预览、立即开团 |
| `docs/prototypes/prototype-reference-08.png` | 订单列表 | `pages/admin/order-list/index` | 商家 | 状态分段、搜索筛选、订单卡片、商品缩略清单、配送状态操作 |
| `docs/prototypes/prototype-reference-09.png` | 配送地址单 | `pages/admin/delivery-address/index` | 商家 | 配送概览、筛选排序、地址卡片、导航/联系、批量导出与完成 |

## 当前路由骨架

`pages.json` 已声明以上核心页面，并额外包含 `pages/mine/index`。当前 tabBar 为商家端四栏：工作台、开团、订单、我的。

## 待确认导航差异

- `prototype-reference-01.png` 展示买家端 tabBar：首页、分类、订单、我的。
- `prototype-reference-06.png` 至 `prototype-reference-09.png` 展示商家端 tabBar：工作台、开团、订单、我的。
- 当前 `pages.json` 只有商家端 tabBar，尚未配置买家端“分类/订单”tabBar 页面。后续实现时建议优先保留当前商家 tabBar，买家首页底部导航可按原型做静态/页面内导航样式，或由你确认是否新增买家 tabBar 路由。

## 页面流程

买家链路：

1. `pages/home/index` 点击商品卡片或“去参团”进入 `pages/product/detail`。
2. `pages/product/detail` 调整数量并点击“立即参团”进入 `pages/order/confirm/index`。
3. `pages/order/confirm/index` 点击“微信支付”后进入 `pages/order/detail/index`。

商家链路：

1. `pages/admin/dashboard/index` 快捷入口进入开团、订单列表、备货汇总、配送地址单。
2. `pages/admin/create-group/index` 填写开团信息并预览商品卡片。
3. `pages/admin/order-list/index` 查看订单并执行配送状态操作。
4. `pages/admin/stock-summary/index` 按日期、状态、优先级查看备货。
5. `pages/admin/delivery-address/index` 勾选地址，支持导出地址和批量标记完成。
