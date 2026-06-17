# 验收记录

本文件为 `integrate_and_qa` 阶段输出，记录当前项目联调与验收结果。

## 验收范围

- 买家链路：`pages/home/index`、`pages/product/detail`、`pages/order/confirm/index`、`pages/order/detail/index`。
- 商家链路：`pages/admin/dashboard/index`、`pages/admin/create-group/index`、`pages/admin/order-list/index`、`pages/admin/stock-summary/index`、`pages/admin/delivery-address/index`。
- tabBar 辅助页：`pages/mine/index`。
- 通用组件：`CustomNavBar`、`ProductCard`、`OrderCard`、`StatusTag`、`StatCard`、`QuantityStepper`、`FilterBar`、`AddressCard`。
- 数据来源：`mock/products.js`、`mock/orders.js`、`mock/shop.js`、`mock/delivery.js`、`mock/stock.js`。

## 已完成项

1. HBuilderX 项目骨架保留，`pages.json`、`manifest.json`、`App.vue` 均保持 uni-app 微信小程序结构。
2. `pages.json` 中声明的 10 个页面文件全部存在。
3. 页面均使用自定义导航，`navigationStyle` 为 `custom`。
4. 买家首页、商品详情、确认订单、订单详情已完成原型主要结构还原。
5. 商家工作台、开新团、订单列表、备货汇总、配送地址单已完成原型主要结构还原。
6. 商品详情到确认订单、确认订单到订单详情链路已串通。
7. 确认订单金额使用 `utils/calc.js` 计算，示例校验：草莓奶油盒子 2 份，商品金额 `39.8`，配送费 `6`，优惠 `4`，实付款 `41.8`。
8. 商家端支持基础交互：快捷入口跳转、开团表单预览、订单搜索筛选、订单状态切换、备货筛选、配送地址勾选/全选/批量完成。
9. 核心业务数据已从 `mock/` 读取，未在页面中硬编码商品、订单、店铺、备货、配送核心数据。
10. 已清理页面中的 AI 占位提示文案，`pages/mine/index` 已补为完整轻量页面。

## 自动检查结果

- 路由检查：`pages.json` 声明页面数 `10`，缺失页面 `0`。
- 页面/组件结构检查：`template`、`script`、`style` 块检查通过。
- mock 数据检查：商品、订单、店铺、配送、备货数据完整性检查通过。
- 金额计算检查：`calcOrderAmount` 示例计算通过。
- SCSS 检查：全量页面与组件样式临时 Sass 编译通过。

## 已知说明

- 当前环境未实际启动 HBuilderX，也未运行“运行到小程序模拟器 → 微信开发者工具”的真实编译流程。
- Sass 检查中出现 `@import` 弃用提醒，这是 Dart Sass 对未来版本的提示；当前项目和 HBuilderX/uni-app 写法仍使用 `@import`，不影响本阶段验收。
- 原型图中部分食品/门店图片数量多于当前静态资源，当前实现复用已有本地图片资源，避免引用不存在的文件。

## HBuilderX 手动验收建议

1. 用 HBuilderX 打开项目根目录。
2. 运行到微信开发者工具，目标平台选择微信小程序。
3. 检查页面无横向滚动，底部 tabBar 和固定操作栏未遮挡内容。
4. 验证买家链路：首页点击商品进入详情，调整数量进入确认订单，模拟支付进入订单详情。
5. 验证商家链路：工作台快捷入口、订单列表状态切换、备货筛选、配送地址勾选和批量完成。
