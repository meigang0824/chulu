# 组件清单

本文件基于九张原型图拆解通用组件，供后续 `refine_components` 与页面开发阶段使用。

## 已规划通用组件

| 组件 | 用途 | 主要页面 |
|---|---|---|
| `CustomNavBar` | 自定义导航栏，适配状态栏、返回、标题、品牌区、微信胶囊占位 | 全部页面 |
| `ProductCard` | 商品卡片，支持首页三列、横向列表、预览卡片等变体 | 首页、商品详情、工作台、开新团、订单列表 |
| `OrderCard` | 订单卡片，承载客户、商品、金额、状态与操作 | 工作台、订单列表、订单详情 |
| `StatusTag` | 状态标签/角标，统一红橙绿蓝等状态样式 | 商品、订单、配送、备货 |
| `StatCard` | 统计数据卡片，展示图标、标题、数值、趋势 | 工作台、备货汇总、配送地址单 |
| `QuantityStepper` | 数量加减器，支持最小/最大值和禁用态 | 商品详情、确认订单 |
| `FilterBar` | 分段筛选、搜索、下拉筛选组合 | 订单列表、备货汇总、配送地址单 |
| `AddressCard` | 收货/配送地址展示与选择，支持勾选、编号、导航、联系 | 确认订单、订单详情、配送地址单 |

## 组件详细规格

### CustomNavBar

- 视觉：透明或奶油渐变背景，深棕标题；二级页左侧为返回箭头。
- 模式：
  - `brand`：左侧 logo + 店铺名 + 副标题，右侧胶囊。
  - `title`：左返回 + 居中标题 + 右侧胶囊。
- 建议 props：`title`、`subtitle`、`logo`、`showBack`、`mode`、`background`、`fixed`。
- 建议事件：`back`。

### ProductCard

- 视觉：白底圆角卡片、食品图、配送/优先角标、商品名、价格、划线价、销量、库存/剩余、截单时间、主操作按钮。
- 变体：
  - `home-grid`：首页三列卡片，图片置顶，底部“去参团”。
  - `order-row`：确认订单/订单详情横排商品。
  - `dashboard-mini`：工作台正在开团横向小卡。
  - `stock-row`：备货汇总左图右统计状态。
  - `preview`：开新团右侧商品预览。
- 建议 props：`product`、`variant`、`showAction`、`showDeadline`、`showStock`、`quantity`。
- 建议事件：`click`、`action`。

### OrderCard

- 视觉：订单号和时间在顶部，客户头像/姓名/电话/地址为主体，金额右侧突出，商品缩略清单横排，底部操作按钮。
- 变体：
  - `compact-list`：工作台待处理订单表格式紧凑行。
  - `admin-list`：订单列表大卡，支持查看、标记配送中、再来一单。
  - `detail-info`：订单详情字段列表。
- 建议 props：`order`、`variant`、`actions`。
- 建议事件：`view`、`markDelivery`、`reorder`、`contact`。

### StatusTag

- 视觉：胶囊或小圆角标签，浅色底 + 深色字；重要状态可使用渐变底。
- 状态：
  - `active`/进行中：红色。
  - `paid`/已付款：红色或橙色。
  - `pendingDelivery`/待配送：橙色。
  - `delivering`/配送中：蓝色。
  - `completed`/已完成：绿色。
  - `ready`/已备齐：绿色。
  - `priority`/优先：红橙渐变。
  - `normal`/正常：橙色。
- 建议 props：`type`、`text`、`size`、`plain`。

### StatCard

- 视觉：圆形图标底、指标标题、大号数值、单位、同比/较昨日变化。
- 使用场景：
  - 工作台四项指标：今日订单、今日销售额、待配送、正在开团。
  - 备货汇总两项指标：商品总数、计划总数量。
  - 配送地址单顶部概览：待配送单数、计划配送时间。
- 建议 props：`icon`、`label`、`value`、`unit`、`trend`、`theme`。

### QuantityStepper

- 视觉：白底胶囊容器，减号灰底/描边，数量居中，加号红色圆按钮。
- 行为：支持 `min`、`max`、`disabled`；达到上下限时对应按钮弱化。
- 建议 props：`modelValue`、`min`、`max`、`disabled`。
- 建议事件：`update:modelValue`、`change`。

### FilterBar

- 视觉：顶部白色大圆角容器，分段项选中为红色渐变/浅红底；搜索框为白底圆角，筛选按钮为描边。
- 组合：
  - 订单列表：全部、已付款、待配送、已完成 + 搜索 + 筛选。
  - 备货汇总：日期选择 + 全部状态 + 按优先级。
  - 配送地址单：状态 tab + 按路线排序 + 筛选。
- 建议 props：`tabs`、`active`、`searchPlaceholder`、`showSearch`、`filters`。
- 建议事件：`changeTab`、`search`、`filter`、`sort`。

### AddressCard

- 视觉：地址信息白卡，定位图标或复选框在左，客户姓名/电话/地址为主体，状态与操作在右侧。
- 变体：
  - `receiver`：确认订单/订单详情收货地址。
  - `delivery`：配送地址单，含序号、勾选、状态、计划时间、导航/联系按钮、商品摘要、备注。
- 建议 props：`address`、`variant`、`checked`、`selectable`、`showActions`。
- 建议事件：`select`、`navigate`、`contact`、`changeStatus`。

## 页面级模块

以下模块可先作为页面内结构实现，若复用增加再抽成组件：

- `HeroBanner`：首页营销 banner、工作台顶部店铺 banner、订单详情状态 banner。
- `BuyerActivityList`：购买动态横向/纵向列表。
- `ShopInfoCard`：首页门店配送与客服信息。
- `PriceSummary`：确认订单费用明细与底部实付款。
- `ProgressSteps`：订单详情履约进度。
- `CreateGroupForm`：开新团表单。
- `BottomActionBar`：商品详情购买栏、确认订单支付栏、配送地址批量操作栏。

## 数据依赖

- 商品数据来自 `mock/products.js`。
- 订单数据来自 `mock/orders.js`。
- 店铺信息来自 `mock/shop.js`。
- 配送地址数据来自 `mock/delivery.js`。
- 备货汇总数据来自 `mock/stock.js`。
- 后续组件不得硬编码核心业务数据；文案类提示可在页面或 mock 中集中维护。
