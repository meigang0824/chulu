# 初炉小程序字体规范落地与验证报告

## 1. 原型字体规范提取

依据 [docs/visual-spec.md](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/docs/visual-spec.md:1) 与 `docs/prototypes/` 原型图，当前项目统一采用如下字体体系：

| 层级 | 字体家族 | 字重 | 字号 | 行高 | 字间距 | 主色值 | 适用场景 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 超大标题 | `-apple-system`, `BlinkMacSystemFont`, `PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, `sans-serif` | 700 | 52-64rpx | 1.12 | 0 | `#5A2416` | Hero 主标题、运营看板大数字 |
| 页面标题 | 同上 | 700 | 36-42rpx | 1.2 | 0 | `#5A2416` | 顶部标题、一级模块标题 |
| 卡片标题 | 同上 | 700 | 30-36rpx | 1.28 | 0 | `#5A2416` | 卡片标题、区块标题 |
| 正文强调 | 同上 | 500-700 | 28-30rpx | 1.5 | 0 | `#5A2416` | 商品名、订单主信息、菜单主文案 |
| 正文 | 同上 | 400-500 | 26-28rpx | 1.5 | 0 | `#7B5A4D` | 描述、列表信息、表单值 |
| 辅助文本 | 同上 | 400 | 24rpx | 1.4 | 0 | `#A99186` | 说明、次要信息、提示语 |
| 微辅助文本 | 同上 | 400 | 22rpx | 1.4 | 0 | `#A99186` | 标签补充、次级元数据 |
| 价格数字 | 同上 | 700 | 34-48rpx | 1 | 0 | `#FF4F66` | 售价、金额、关键 KPI |
| 交互高亮文本 | 同上 | 500-600 | 22-28rpx | 1.4-1.5 | 0 | `#FF4F66` | 按钮、选中态、提醒信息 |
| 提示 / 警示文本 | 同上 | 500 | 24-28rpx | 1.4-1.5 | 0 | `#F27612` | 温馨提示、配送说明、异常提醒 |

### 文本色值标准

| 类型 | 色值 | 说明 |
| --- | --- | --- |
| 主文本 | `#5A2416` | 页面标题、主信息、关键说明 |
| 常规文本 | `#7B5A4D` | 正文、列表信息 |
| 辅助文本 | `#A99186` | 次要文案、弱化信息 |
| 占位文本 | `#C6AFA2` | 搜索框、表单占位 |
| 品牌强调 | `#FF4F66` | 价格、按钮、选中态 |
| 暖橙强调 | `#FF8A1F` / `#F27612` | 标签、运营提示、服务信息 |

## 2. 本次代码落地范围

### 2.1 全局字体基线

- [App.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/App.vue:1)
- [common/theme.scss](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/common/theme.scss:1)
- [common/components.scss](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/common/components.scss:1)

新增并统一了以下 token / mixin：

- `$font-family-base`
- `$font-weight-*`
- `$line-height-*`
- `text-display`
- `text-page-title`
- `text-card-title`
- `text-body`
- `text-body-strong`
- `text-caption`
- `text-helper`
- `text-price`

### 2.2 已调整的核心页面与组件

#### 公共组件

- [components/CustomNavBar/CustomNavBar.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/components/CustomNavBar/CustomNavBar.vue:1)
- [components/ProductCard/ProductCard.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/components/ProductCard/ProductCard.vue:1)
- [components/OrderCard/OrderCard.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/components/OrderCard/OrderCard.vue:1)
- [components/StatCard/StatCard.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/components/StatCard/StatCard.vue:1)
- [components/EmptyState/EmptyState.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/components/EmptyState/EmptyState.vue:1)

#### 用户端页面

- [pages/home/index.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/pages/home/index.vue:1)
- [pages/order/confirm/index.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/pages/order/confirm/index.vue:1)
- [pages/mine/index.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/pages/mine/index.vue:1)

#### 管理端页面

- [pages/admin/dashboard/index.vue](/Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter/pages/admin/dashboard/index.vue:1)

## 3. 字体规范替换策略

1. 先统一全局字体家族，避免端侧 fallback 不一致。
2. 把页面标题、卡片标题、正文、辅助、价格拆成标准 mixin。
3. 优先替换导航、卡片、按钮、列表、金额等高频场景。
4. 保留极少数业务特化字号，但全部挂靠统一 token 与 line-height 体系。

## 4. 兼容性验证结果

### 已完成验证

1. HBuilderX 微信小程序编译验证通过  
   命令：

   ```bash
   /Applications/HBuilderX.app/Contents/MacOS/cli launch mp-weixin --project /Users/apple/Documents/sweet_bakery_uniapp_openclaw_starter --compile true --continue-on-error false
   ```

2. 全局字体栈已统一为系统中文优先栈，适配：
   - iOS 微信 WebView
   - Android 微信 WebView
   - macOS 开发者工具预览

3. 关键模块已统一：
   - 顶部导航标题
   - 首页 Hero 与分区标题
   - 商品卡价格与元数据
   - 订单卡金额与地址信息
   - 我的页面资料与菜单
   - 店长工作台标题、KPI、快捷入口

### 需继续人工验收的终端项

以下项目建议在真机或开发者工具不同机型下补充目测确认：

- iPhone 刘海屏与非刘海屏顶部标题垂直对齐
- Android 机型下 22rpx / 24rpx 辅助文案是否出现过细感
- 深色环境下系统字体抗锯齿表现
- 低分辨率机型中价格大字与按钮文案是否存在拥挤

## 5. 当前结论

本轮已经完成字体规范的基础设施建设与核心页面落地，当前系统的标题层级、正文层级、辅助信息层级和价格高亮层级已基本与原型规范统一。

从交付角度看，字体系统已经从“页面各自写样式”收束成“统一 token + mixin + 关键页面落地”的状态，后续若继续扩展页面，只需要复用同一套 mixin 即可保持视觉一致。
