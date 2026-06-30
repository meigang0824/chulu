const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CONFIG = {
  appid: process.env.WECHAT_APPID || 'wx58f4dfa2c16fe2f0',
  secret: process.env.WECHAT_SECRET || '',
  mchid: process.env.WECHAT_PAY_MCH_ID || '1747393367',
  serialNo: process.env.WECHAT_PAY_SERIAL_NO || '',
  apiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
  privateKey: process.env.WECHAT_PAY_PRIVATE_KEY || ''
}

let cachedAccessToken = null
let cachedAccessTokenExpiresAt = 0

function now() { return new Date().toISOString() }
function parseJson(value, fallback) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}
function safeJson(value) {
  const parsed = parseJson(value, [])
  return Array.isArray(parsed) ? parsed : []
}
function normalizePrivateKey(value = '') {
  return String(value || '').replace(/\\n/g, '\n').trim()
}
function randomNonce(size = 16) {
  return crypto.randomBytes(size).toString('hex')
}
function amountToFen(amount) {
  return Math.max(1, Math.round(Number(amount || 0) * 100))
}
function truncateNoticeValue(value, max = 20) {
  const text = String(value || '').trim()
  return (text || '-').slice(0, max)
}
function noticeTimeText(value) {
  return String(value || now()).replace('T', ' ').replace(/\.\d{3}Z$/, '').slice(0, 19)
}
function orderProductNames(order = {}) {
  const items = safeJson(order.items)
  const names = items.map(item => item.name).filter(Boolean).join('、')
  return truncateNoticeValue(names || '初炉商品', 20)
}
function orderAddressText(order = {}) {
  const address = parseJson(order.address, {})
  return truncateNoticeValue(address.detail || address.address || address.receiver || '统一配送', 20)
}
function signWechatPayMessage(message) {
  return crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(normalizePrivateKey(CONFIG.privateKey), 'base64')
}
function wechatPayAuthHeader(method, urlPath, bodyText = '') {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomNonce()
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${bodyText}\n`
  const signature = signWechatPayMessage(message)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${CONFIG.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${CONFIG.serialNo}"`
}
async function requestWechatPay(method, urlPath, body = null) {
  const bodyText = body ? JSON.stringify(body) : ''
  const response = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: wechatPayAuthHeader(method, urlPath, bodyText),
      'User-Agent': 'chulu-bakery-miniapp/1.0'
    },
    body: bodyText || undefined
  })
  const text = await response.text()
  const data = text ? parseJson(text, {}) : {}
  if (!response.ok) throw new Error(data.message || `微信支付查询失败(${response.status})`)
  return data
}
async function getWechatAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) return cachedAccessToken
  if (!CONFIG.appid || !CONFIG.secret) throw new Error('WECHAT_SECRET未配置，无法获取微信access_token')
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.appid}&secret=${CONFIG.secret}`
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(data.errmsg || `获取微信access_token失败(${response.status})`)
  }
  cachedAccessToken = data.access_token
  cachedAccessTokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in || 7200) - 300) * 1000
  return cachedAccessToken
}
async function sendSubscribeMessage(params) {
  try {
    return await cloud.openapi.subscribeMessage.send(params)
  } catch (error) {
    const errMsg = String(error && (error.errMsg || error.message) || '')
    if (!/access_token|INVALID_WX_ACCESS_TOKEN|invalid wx openapi access_token/i.test(errMsg)) throw error
    const accessToken = await getWechatAccessToken()
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: params.touser,
        template_id: params.templateId,
        page: params.page,
        data: params.data,
        miniprogram_state: 'formal'
      })
    })
    const result = await response.json()
    if (!response.ok || result.errcode) {
      throw new Error(result.errmsg || `订阅消息发送失败(${response.status})`)
    }
    return result
  }
}
function decryptResource(resource = {}) {
  if (!CONFIG.apiV3Key) throw new Error('APIv3密钥未配置')
  const ciphertext = Buffer.from(resource.ciphertext || '', 'base64')
  const authTag = ciphertext.slice(ciphertext.length - 16)
  const encrypted = ciphertext.slice(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(CONFIG.apiV3Key, 'utf8'), Buffer.from(resource.nonce || '', 'utf8'))
  decipher.setAuthTag(authTag)
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return parseJson(decrypted, {})
}
function httpResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}
function requestBody(event = {}) {
  const body = event.body || event.rawBody || ''
  if (event.isBase64Encoded) return Buffer.from(body, 'base64').toString('utf8')
  return typeof body === 'string' ? body : JSON.stringify(body)
}
async function sendOrderNotice(order = {}) {
  try {
    const { data: configs } = await db.collection('shopConfig').limit(1).get()
    const config = configs.length ? parseJson(configs[0].value, {}) : {}
    const templateId = String(config.orderTemplateId || '').trim()
    if (!templateId || !cloud.openapi || !cloud.openapi.subscribeMessage) return
    const { data: subscriptions } = await db.collection('adminSubscriptions')
      .where({ type: 'order', templateId, status: 'enabled' })
      .limit(100)
      .get()
    if (!subscriptions || !subscriptions.length) return
    const amount = Number(order.payable || order.amount || 0)
    const data = {
      date4: { value: noticeTimeText(order.paidAt || order.createdAt) },
      thing5: { value: orderProductNames(order) },
      thing7: { value: orderAddressText(order) },
      amount12: { value: `¥${amount.toFixed(2)}` },
      thing26: { value: truncateNoticeValue(order.note || '请及时处理订单', 20) }
    }
    for (const item of subscriptions) {
      try {
        await sendSubscribeMessage({
          touser: item.openid,
          templateId,
          page: `pages/admin/order-detail/index?id=${order.id || order.orderNo || ''}`,
          data
        })
        console.log('[paymentNotify.subscribeMessage] sent:', {
          openid: item.openid,
          templateId,
          orderId: order.id || order.orderNo || ''
        })
      } catch (error) {
        console.error('[paymentNotify.subscribeMessage] failed:', error)
      }
    }
  } catch (error) {
    console.error('[paymentNotify.sendOrderNotice] failed:', error)
  }
}
async function markPaid(outTradeNo, payment = {}) {
  const { data } = await db.collection('orders').where({ id: outTradeNo }).limit(1).get()
  if (!data.length) throw new Error('订单不存在')
  const order = data[0]
  if (order.payStatus === 'paid') return order
  const expectedTotal = amountToFen(order.payable || order.amount)
  const paidTotal = payment.amount && Number(payment.amount.total || 0)
  if (paidTotal && paidTotal !== expectedTotal) throw new Error('支付金额不一致')
  const patch = {
    status: 'pendingDelivery',
    payStatus: 'paid',
    deliveryStatus: 'pending',
    transactionId: payment.transaction_id || '',
    tradeState: payment.trade_state || 'SUCCESS',
    paidAt: payment.success_time || now(),
    updatedAt: now()
  }
  await db.collection('orders').doc(order._id).update({ data: patch })
  const updated = { ...order, ...patch }
  await sendOrderNotice(updated)
  return updated
}

exports.main = async (event = {}) => {
  try {
    const notice = parseJson(requestBody(event), {})
    const decrypted = notice.resource ? decryptResource(notice.resource) : notice
    const outTradeNo = decrypted.out_trade_no || decrypted.outTradeNo
    if (!outTradeNo) throw new Error('缺少商户订单号')
    const queried = await requestWechatPay('GET', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${CONFIG.mchid}`)
    if (queried.trade_state === 'SUCCESS') await markPaid(outTradeNo, queried)
    return httpResponse(200, { code: 'SUCCESS', message: '成功' })
  } catch (error) {
    console.error('[paymentNotify] failed:', error)
    return httpResponse(500, { code: 'FAIL', message: error.message || '失败' })
  }
}
