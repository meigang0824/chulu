# 微信真实支付接入准备

当前商户号：

```text
1747393367
```

当前支付回调地址：

```text
https://cloudbase-d7gp8xx126047f577.service.tcloudbase.com/paymentNotify
```

## 还需要准备

真实微信支付不能只靠商户号，还需要以下配置：

- `WECHAT_PAY_MCH_ID`：商户号，当前为 `1747393367`
- `WECHAT_PAY_SERIAL_NO`：商户 API 证书序列号
- `WECHAT_PAY_API_V3_KEY`：APIv3 密钥
- `WECHAT_PAY_PRIVATE_KEY`：商户 API 私钥内容，建议配置到云函数环境变量或安全密钥，不要提交到代码仓库
- `WECHAT_PAY_NOTIFY_URL`：微信支付回调 HTTPS 地址

## 当前代码状态

项目已接入微信 JSAPI 支付骨架：

- `businessApi` 已支持 JSAPI 预下单并返回小程序支付参数。
- 确认订单页已支持 `uni.requestPayment`。
- `paymentNotify` 已作为 HTTP 云函数部署，用于接收微信支付回调。
- 支付成功后会把订单更新为 `payStatus: paid`、`status: pendingDelivery`。
- 未配置真实支付时仍可保留模拟支付逻辑。

## 切换真实支付时要改

1. 下单创建待支付订单，写入 `payStatus: pending`、`status: pendingPayment`。
2. 云函数调用微信支付 API v3 JSAPI 下单，获取 `prepay_id`。
3. 云函数生成小程序调起支付参数：`timeStamp`、`nonceStr`、`package`、`signType`、`paySign`。
4. 前端确认订单页调用 `uni.requestPayment`。
5. 支付通知 HTTP 云函数解密通知，并主动查询微信支付订单，确认成功后更新订单状态。
6. 支付成功后以前端查询后端订单状态为准，不只相信前端回调。
7. 后续售后同意退款时还需要继续接入微信支付退款接口和退款通知。

## 注意

不要把 APIv3 密钥、商户私钥、证书文件提交到仓库。真实接入时应通过云函数环境变量或云开发安全配置读取。
