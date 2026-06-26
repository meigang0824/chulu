const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CONFIG = {
  appid: process.env.WECHAT_APPID || 'wx58f4dfa2c16fe2f0',
  mchid: process.env.WECHAT_PAY_MCH_ID || '1747393367',
  serialNo: process.env.WECHAT_PAY_SERIAL_NO || '',
  apiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
  privateKey: process.env.WECHAT_PAY_PRIVATE_KEY || ''
}

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
    const address = parseJson(order.address, {})
    const customer = order.buyerName || address.receiver || order.receiver || '用户'
    const amount = Number(order.payable || order.amount || 0)
    const timeText = (order.paidAt || order.createdAt || now()).replace('T', ' ').slice(0, 16)
    const data = {
      thing1: { value: '收到新订单' },
      character_string2: { value: String(order.id || order.orderNo || '-').slice(0, 32) },
      amount3: { value: `${amount.toFixed(2)}元` },
      thing4: { value: String(customer).slice(0, 20) },
      time5: { value: timeText }
    }
    for (const item of subscriptions) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: item.openid,
          templateId,
          page: `pages/admin/order-detail/index?id=${order.id || order.orderNo || ''}`,
          data
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
