# 初炉小程序迁移清单

## 结论

项目可以迁移，但不能由 Codex 100% 独立完成。Codex 可以完成代码修改、云函数部署、数据库导入导出、云存储资源路径替换和构建验证；微信公众平台里的账号权限、AppID、主体/管理员确认、订阅消息模板、支付商户等动作需要新旧账号管理员配合。

如果只是换一个人继续开发原小程序，推荐不要迁移项目，直接在微信公众平台和云开发控制台把对方加入开发者/管理员。这样 AppID、云环境、openid、数据库、云存储都不变，风险最低。

如果要换到另一个人的新小程序账号，则按下面清单迁移。

## 当前绑定信息

- 旧小程序 AppID：`wxa7b8ae590c1373d2`
- 旧云环境 ID：`aiwork-8g5erw9d885e24b4`
- 旧云存储域名：`https://6169-aiwork-8g5erw9d885e24b4-1311068699.tcb.qcloud.la`
- 新小程序 AppID：`wx58f4dfa2c16fe2f0`
- 新云环境 ID：`cloudbase-d7gp8xx126047f577`
- 新云存储域名：`https://636c-cloudbase-d7gp8xx126047f577-1446367223.tcb.qcloud.la`
- 主要云函数：`businessApi`
- 旧辅助云函数：`createOrder`、`cancelOrder`

## Codex 可以迁移的内容

- 前端代码和页面路由
- 云函数代码部署
- 数据库集合导出、导入
- 云存储图片下载、上传
- 代码里的 AppID、云环境 ID、云存储域名替换
- 门店配置、商品、订单、售后、地址等业务数据搬迁
- 构建验证：`npm run build:mp-weixin`
- 云函数部署验证：`tcb fn deploy businessApi --env-id <新环境ID> --force`

## 必须人工配合的内容

- 新微信小程序账号注册/认证
- 获取新 AppID 和 AppSecret
- 新云开发环境开通
- 给 Codex 所在机器登录新账号的微信开发者工具/CloudBase CLI 权限
- 微信公众平台订阅消息模板申请，并提供模板 ID
- 微信支付商户号、支付权限、回调配置
- 业务域名、隐私协议、类目、版本提交审核
- 如果是主体迁移，需要原主体和新主体按微信平台流程确认

## 需要替换的代码位置

| 文件 | 当前内容 | 迁移时替换为 |
| --- | --- | --- |
| `project.config.json` | `appid: wxa7b8ae590c1373d2` | 新小程序 AppID |
| `manifest.json` | `mp-weixin.appid` | 新小程序 AppID |
| `App.vue` | `wx.cloud.init env` | 新云环境 ID |
| `utils/image.js` | `CLOUD_ENV_ID` | 新云环境 ID |
| `utils/image.js` | `CLOUD_STORAGE_ORIGIN` | 新云存储 HTTPS 域名 |
| `pages/auth/login/index.vue` | 登录页固定云存储图片 URL | 新云存储图片 URL |
| `cloudfunctions/businessApi/index.js` | `WECHAT_APPID` 默认值 | 新 AppID 或环境变量 |
| 云函数环境变量 | `WECHAT_SECRET` | 新 AppSecret |

## 需要迁移的数据库集合

按当前代码使用情况，至少迁移这些集合：

- `accounts`
- `sessions`，可不迁，建议让用户重新登录
- `admin_users`
- `orders`
- `refunds`
- `products`
- `groups`
- `stockItems`
- `shopConfig`
- `addresses`
- `banners`
- `adminSubscriptions`，可不迁，建议店长在新小程序重新授权

注意：换 AppID 后用户 openid 会变化。旧订单数据可以保留展示，但旧账号与新 openid 的自动关联需要重新登录或做手机号/unionid 绑定策略。

## 需要迁移的云存储资源

当前代码依赖这些目录：

- `icons/`
- `products/`
- `banners/`
- `tabbar/`
- `login/`

迁移后要确保新云存储里路径一致，或者同步替换数据库和代码中的图片地址。

## 推荐迁移顺序

1. 新账号开通小程序和云开发环境。
2. 获取新 AppID、新云环境 ID、新云存储域名、新 AppSecret。AppSecret 只配置到云函数环境变量，不写入代码仓库。
3. 导出旧云环境数据库集合。
4. 下载旧云存储资源。
5. 在新云环境创建集合并导入数据库。
6. 上传云存储资源到新环境，尽量保持相同目录结构。
7. 修改代码中的 AppID、云环境 ID、云存储域名和登录页图片 URL。
8. 给 `businessApi` 配置新 `WECHAT_APPID`、`WECHAT_SECRET` 环境变量。
9. 部署云函数。
10. 在新小程序后台申请并配置下单/售后订阅消息模板 ID。
11. 构建并用微信开发者工具打开新项目。
12. 用新账号完整测试：登录、商品浏览、加购、下单、取消、售后、店长发货、消息提醒。

## 给 Codex 的迁移提示词

```text
请按 docs/wechat-project-migration-guide.md 迁移这个 uni-app 微信小程序到新的微信小程序账号。

新 AppID：<填写>
新云环境 ID：<填写>
新云存储 HTTPS 域名：<填写>
新 AppSecret：<填写或说明已在云函数环境变量配置>
CloudBase CLI 是否已登录新账号：<是/否>
数据库导出文件路径：<填写>
云存储资源目录：<填写>

要求：
1. 替换代码里的 AppID、云环境 ID、云存储域名和登录页图片地址。
2. 部署 businessApi 到新云环境。
3. 导入数据库和上传云存储资源。
4. 跑 npm run build:mp-weixin。
5. 打开微信开发者工具验证项目能运行。
6. 不要删除旧环境数据。
```

## 迁移风险

- 旧用户 openid 不能直接在新 AppID 下复用。
- 订阅消息授权不能迁移，店长需要重新授权。
- 云存储 fileID 含旧环境 ID，必须迁到新环境或替换为新 URL。
- 微信支付如果使用新主体，需要重新配置商户号。
- 如果数据库里有旧云存储 URL，迁移后需要批量替换。
