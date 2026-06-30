// 云函数入口：businessApi
// 初炉小程序核心业务逻辑
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 微信小程序配置
const WECHAT_CONFIG = {
  appid: process.env.WECHAT_APPID || 'wx58f4dfa2c16fe2f0',
  secret: process.env.WECHAT_SECRET || ''
}

const WECHAT_PAY_CONFIG = {
  mchid: process.env.WECHAT_PAY_MCH_ID || '1747393367',
  serialNo: process.env.WECHAT_PAY_SERIAL_NO || '',
  apiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
  privateKey: process.env.WECHAT_PAY_PRIVATE_KEY || '',
  notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
  enabled: process.env.WECHAT_PAY_ENABLED === 'true'
}

const ADMIN_ROLES = ['owner', 'manager', 'staff']
const DEFAULT_USER_ROLE = 'buyer'
const SESSION_DAYS = 7
let cachedWechatAccessToken = null
let cachedWechatAccessTokenExpiresAt = 0

function now() { return new Date().toISOString() }
function isAdmin(r) { return ADMIN_ROLES.includes(r) }
function isPlaceholderDoc(row = {}) { return row && row._init === true }
function createToken() { return crypto.randomBytes(24).toString('hex') + Date.now().toString(36) }
function sessionExpiresAt() { return new Date(Date.now() + SESSION_DAYS * 86400000).toISOString() }
function createOrderNo() { return `o${Date.now()}${Math.random().toString(36).slice(2, 6)}` }
function businessError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function parseTime(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function isExpiredDeadline(value, nowTime = Date.now()) {
  const time = parseTime(value)
  return !!time && time <= nowTime
}

function normalizePrivateKey(value = '') {
  return String(value || '').replace(/\\n/g, '\n').trim()
}

function isWechatPayEnabled() {
  return !!(
    WECHAT_PAY_CONFIG.enabled &&
    WECHAT_CONFIG.appid &&
    WECHAT_PAY_CONFIG.mchid &&
    WECHAT_PAY_CONFIG.serialNo &&
    WECHAT_PAY_CONFIG.apiV3Key &&
    normalizePrivateKey(WECHAT_PAY_CONFIG.privateKey) &&
    WECHAT_PAY_CONFIG.notifyUrl
  )
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
    .sign(normalizePrivateKey(WECHAT_PAY_CONFIG.privateKey), 'base64')
}

function wechatPayAuthHeader(method, urlPath, bodyText = '') {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomNonce()
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${bodyText}\n`
  const signature = signWechatPayMessage(message)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${WECHAT_PAY_CONFIG.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${WECHAT_PAY_CONFIG.serialNo}"`
}

async function requestWechatPay(method, urlPath, body = null) {
  const bodyText = body ? JSON.stringify(body) : ''
  const response = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Encoding': 'identity',
      Authorization: wechatPayAuthHeader(method, urlPath, bodyText),
      'User-Agent': 'chulu-bakery-miniapp/1.0'
    },
    body: bodyText || undefined
  })
  const text = await response.text()
  const data = text ? parseJson(text, {}) : {}
  if (!response.ok) {
    const message = data.message || data.detail || `微信支付请求失败(${response.status})`
    throw businessError('WECHAT_PAY_API_ERROR', message)
  }
  return data
}

async function getWechatAccessToken() {
  if (cachedWechatAccessToken && Date.now() < cachedWechatAccessTokenExpiresAt) return cachedWechatAccessToken
  if (!WECHAT_CONFIG.appid || !WECHAT_CONFIG.secret) throw new Error('WECHAT_SECRET未配置，无法获取微信access_token')
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_CONFIG.appid}&secret=${WECHAT_CONFIG.secret}`
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(data.errmsg || `获取微信access_token失败(${response.status})`)
  }
  cachedWechatAccessToken = data.access_token
  cachedWechatAccessTokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in || 7200) - 300) * 1000
  return cachedWechatAccessToken
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

function buildPaymentParams(prepayId) {
  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = randomNonce()
  const packageValue = `prepay_id=${prepayId}`
  const paySign = signWechatPayMessage(`${WECHAT_CONFIG.appid}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`)
  return { timeStamp, nonceStr, package: packageValue, signType: 'RSA', paySign }
}

async function requireUserSession(authToken) {
  const auth = await getAccountByToken(authToken)
  if (!auth || !auth.account || auth.account.role === 'guest') {
    throw businessError('AUTH_REQUIRED', '请先登录')
  }
  return auth
}

async function requireAdminSession(authToken) {
  const auth = await requireUserSession(authToken)
  if (!isAdmin(auth.account.role)) {
    throw businessError('PERMISSION_DENIED', '需要店长权限')
  }
  return auth
}

function canAccessOrder(auth, order = {}) {
  if (!auth || !auth.account) return false
  return isAdmin(auth.account.role) || order.buyerId === auth.account.id
}

async function createSession(accountId, openid = '') {
  const token = createToken()
  const expiresAt = sessionExpiresAt()
  await db.collection('sessions').add({
    data: { token, expiresAt, accountId, openid, createdAt: now() }
  })
  return { token, expiresAt }
}

async function getAccountByToken(authToken) {
  if (!authToken) return null
  const { data: sessions } = await db.collection('sessions').where({ token: authToken }).limit(1).get()
  const session = sessions && sessions[0]
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null
  const { data: accounts } = await db.collection('accounts').where({ id: session.accountId }).limit(1).get()
  const account = accounts && accounts[0]
  return account ? { session, account } : null
}

function accountUser(account = {}) {
  return {
    id: account.id,
    username: account.username,
    phone: account.phone || '',
    role: account.role || 'buyer',
    displayName: account.displayName || '初炉用户',
    avatarText: account.avatarText || '甜',
    status: account.status || 'active',
    avatar: account.avatar || ''
  }
}

async function getAdminByOpenid(openid) {
  if (!openid) return null
  try {
    const { data } = await db.collection('admin_users').where({ openid, status: 'active' }).limit(1).get()
    const admin = data && data[0]
    return admin && isAdmin(admin.role) ? admin : null
  } catch {
    return null
  }
}

// 真实小程序内优先使用云开发上下文 OPENID；仅非云上下文才使用 code2session 兜底。
async function wxCode2Session(code) {
  const wxContext = cloud.getWXContext()
  if (wxContext && wxContext.OPENID) {
    return {
      openid: wxContext.OPENID,
      unionid: wxContext.UNIONID || '',
      appid: wxContext.APPID || WECHAT_CONFIG.appid,
      sessionKey: ''
    }
  }
  if (!WECHAT_CONFIG.secret) {
    throw new Error('微信登录配置缺失：请在云函数环境变量 WECHAT_SECRET 中配置 AppSecret，或从小程序端调用云函数')
  }
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_CONFIG.appid}&secret=${WECHAT_CONFIG.secret}&js_code=${code}&grant_type=authorization_code`
  const response = await fetch(url)
  const data = await response.json()
  if (data.errcode) throw new Error(`WeChat API error: ${data.errmsg}`)
  return { openid: data.openid, sessionKey: data.session_key, unionid: data.unionid }
}

// ==================== 认证 ====================

async function authGuestLogin() {
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    await db.collection('accounts').add({
      data: {
        id: guestId, username: guestId, phone: '', password: '',
        role: 'guest', displayName: '游客', avatarText: '游',
        status: 'active', openid: '', createdAt: now(), updatedAt: now()
      }
    })
  } catch (e) { /* duplicate ignore */ }

  const { token, expiresAt } = await createSession(guestId)

  return {
    ok: true, token, expiresAt,
    user: { id: guestId, username: guestId, phone: '', role: 'guest', displayName: '游客', avatarText: '游', status: 'active' },
    isGuest: true, role: 'guest', redirectTo: '/pages/home/index'
  }
}

async function authWxLogin(payload) {
  const code = String(payload.code || '')
  if (!code) return { ok: false, code: 'MISSING_CODE', message: '微信授权码不能为空' }

  let wxData
  try {
    wxData = await wxCode2Session(code)
  } catch (error) {
    const message = error && error.message ? error.message : '微信授权失败'
    if (message.includes('微信登录配置缺失')) {
      return { ok: false, code: 'WECHAT_CONFIG_MISSING', message }
    }
    return { ok: false, code: 'WECHAT_AUTH_FAILED', message }
  }
  const openid = wxData.openid
  if (!openid) return { ok: false, code: 'WECHAT_AUTH_FAILED', message: '微信授权失败' }
  const adminProfile = await getAdminByOpenid(openid)

  const { data: existingAccounts } = await db.collection('accounts')
    .where({ openid }).limit(1).get()

  if (existingAccounts.length > 0) {
    const a = existingAccounts[0]
    if (a.status && a.status !== 'active') {
      return { ok: false, code: 'ACCOUNT_DISABLED', message: '账号已停用，请联系店长' }
    }
    const nextRole = adminProfile ? adminProfile.role : DEFAULT_USER_ROLE
    const patch = {
      lastLoginAt: now(),
      unionid: wxData.unionid || a.unionid || '',
      updatedAt: now()
    }
    if (a.role !== nextRole) patch.role = nextRole
    if (adminProfile && adminProfile.name && a.displayName !== adminProfile.name) patch.displayName = adminProfile.name
    if (!adminProfile) {
      const nextDisplayName = String(payload.displayName || payload.nickName || '').trim()
      const nextAvatar = String(payload.avatar || payload.avatarUrl || '').trim()
      if (nextDisplayName && nextDisplayName !== a.displayName) patch.displayName = nextDisplayName
      if (nextAvatar && nextAvatar !== a.avatar) patch.avatar = nextAvatar
    }
    if (Object.keys(patch).length) {
      await db.collection('accounts').doc(a._id).update({ data: patch })
    }
    const account = { ...a, ...patch, role: nextRole }
    const { token, expiresAt } = await createSession(a.id, openid)
    return {
      ok: true, token, expiresAt,
      user: accountUser(account),
      isNewUser: false,
      isAdmin: isAdmin(account.role),
      role: account.role,
      adminProfile: isAdmin(account.role) ? { id: account.id, role: account.role, name: account.displayName, status: 'active' } : null,
      redirectTo: isAdmin(account.role) ? '/pages/admin/dashboard/index' : '/pages/home/index'
    }
  }

  const newId = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const displayName = adminProfile && adminProfile.name
    ? adminProfile.name
    : String(payload.displayName || payload.nickName || '').trim() || `微信用户${Math.floor(Math.random() * 10000)}`
  const role = adminProfile ? adminProfile.role : DEFAULT_USER_ROLE
  const avatar = String(payload.avatar || payload.avatarUrl || '').trim()
  await db.collection('accounts').add({
    data: {
      id: newId, username: `wx_${openid.slice(-8)}`, phone: '', password: '',
      role, displayName, avatarText: adminProfile ? '店' : '微', status: 'active',
      openid, unionid: wxData.unionid || '', avatar,
      createdAt: now(), updatedAt: now(), lastLoginAt: now()
    }
  })

  const { token, expiresAt } = await createSession(newId, openid)
  const user = { id: newId, username: `wx_${openid.slice(-8)}`, phone: '', role, displayName, avatarText: adminProfile ? '店' : '微', status: 'active', avatar }

  return {
    ok: true, token, expiresAt,
    user,
    isNewUser: true,
    isAdmin: isAdmin(role),
    role,
    adminProfile: isAdmin(role) ? { id: newId, role, name: displayName, status: 'active' } : null,
    redirectTo: isAdmin(role) ? '/pages/admin/dashboard/index' : '/pages/home/index'
  }
}

async function authLogin(payload) {
  const id = String(payload.identifier || payload.username || payload.phone || '').trim()
  const pw = String(payload.password || '')
  const { data: accounts } = await db.collection('accounts')
    .where(_.or([{ username: id }, { phone: id }])).limit(1).get()
  if (!accounts.length) return { ok: false, code: 'ACCOUNT_NOT_FOUND', message: '账号不存在' }
  const a = accounts[0]
  if (a.password !== pw) return { ok: false, code: 'PASSWORD_INCORRECT', message: '密码错误' }

  const { token, expiresAt } = await createSession(a.id, a.openid || '')
  return {
    ok: true, token, expiresAt,
    user: accountUser(a),
    isAdmin: isAdmin(a.role),
    role: a.role || 'buyer',
    adminProfile: isAdmin(a.role) ? { id: a.id, role: a.role, name: a.displayName, status: 'active' } : null,
    redirectTo: isAdmin(a.role) ? '/pages/admin/dashboard/index' : '/pages/home/index'
  }
}

async function authMe(authToken) {
  const auth = await getAccountByToken(authToken)
  if (!auth) return { ok: true, isLoggedIn: false, role: 'guest', isAdmin: false, user: null }
  const a = auth.account
  return {
    ok: true, isLoggedIn: true, isAdmin: isAdmin(a.role), role: a.role,
    user: accountUser(a),
    adminProfile: isAdmin(a.role) ? { id: a.id, role: a.role, name: a.displayName, status: 'active' } : null
  }
}

async function authLogout(authToken) {
  if (authToken) {
    const { data: sessions } = await db.collection('sessions').where({ token: authToken }).get()
    for (const s of sessions) await db.collection('sessions').doc(s._id).remove()
  }
  return { ok: true }
}

async function forgotPassword(payload) {
  return { ok: true, message: '如需重置密码，请联系店长处理' }
}

async function updateProfile(authToken, payload = {}) {
  const auth = await getAccountByToken(authToken)
  if (!auth || auth.account.role === 'guest') return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录后再修改资料' }
  const patch = { updatedAt: now() }
  if (payload.displayName !== undefined) patch.displayName = String(payload.displayName || '').trim() || auth.account.displayName
  if (payload.avatar !== undefined) patch.avatar = String(payload.avatar || '').trim()
  if (payload.avatarText !== undefined) patch.avatarText = String(payload.avatarText || '').trim().slice(0, 2) || auth.account.avatarText
  await db.collection('accounts').doc(auth.account._id).update({ data: patch })
  const account = { ...auth.account, ...patch }
  return { ok: true, user: accountUser(account), role: account.role, isAdmin: isAdmin(account.role) }
}

async function promoteAllUsersToManager(authToken) {
  const auth = await getAccountByToken(authToken)
  if (!auth || !isAdmin(auth.account.role)) {
    return { ok: false, code: 'PERMISSION_DENIED', message: '需要店长权限' }
  }
  const { data: accounts } = await db.collection('accounts').limit(1000).get()
  let updated = 0
  let skipped = 0
  for (const account of accounts || []) {
    if (!account || isPlaceholderDoc(account)) {
      skipped += 1
      continue
    }
    if (account.role === 'guest') {
      skipped += 1
      continue
    }
    if (account.role === 'manager') {
      skipped += 1
      continue
    }
    await db.collection('accounts').doc(account._id).update({
      data: {
        role: 'manager',
        status: account.status || 'active',
        updatedAt: now()
      }
    })
    updated += 1
  }
  return {
    ok: true,
    role: 'manager',
    updated,
    skipped,
    total: (accounts || []).length
  }
}

function publicAccount(account = {}, currentAccountId = '') {
  return {
    id: account.id || account._id || '',
    username: account.username || '',
    phone: account.phone || '',
    role: account.role || 'buyer',
    displayName: account.displayName || account.username || '初炉用户',
    avatar: account.avatar || '',
    avatarText: account.avatarText || (account.displayName || account.username || '用').slice(0, 2),
    status: account.status || 'active',
    openidBound: !!account.openid,
    isSelf: !!currentAccountId && account.id === currentAccountId,
    createdAt: account.createdAt || '',
    updatedAt: account.updatedAt || '',
    lastLoginAt: account.lastLoginAt || ''
  }
}

async function listAccounts(authToken) {
  const auth = await getAccountByToken(authToken)
  if (!auth || !isAdmin(auth.account.role)) {
    return { ok: false, code: 'PERMISSION_DENIED', message: '需要店长权限' }
  }
  const { data } = await db.collection('accounts').limit(1000).get()
  const roleWeight = role => role === 'owner' ? 0 : role === 'manager' ? 1 : role === 'staff' ? 2 : role === 'buyer' ? 3 : 4
  const accounts = (data || [])
    .filter(account => account && !isPlaceholderDoc(account))
    .map(account => publicAccount(account, auth.account.id))
    .sort((a, b) => {
      if (roleWeight(a.role) !== roleWeight(b.role)) return roleWeight(a.role) - roleWeight(b.role)
      return String(b.lastLoginAt || b.updatedAt || b.createdAt || '').localeCompare(String(a.lastLoginAt || a.updatedAt || a.createdAt || ''))
    })
  return { ok: true, data: accounts }
}

async function syncAdminUserForAccount(account = {}, role = 'buyer') {
  if (!account.openid) return
  const timestamp = now()
  const { data } = await db.collection('admin_users').where({ openid: account.openid }).limit(1).get()
  if (isAdmin(role)) {
    const payload = {
      openid: account.openid,
      role,
      name: account.displayName || account.username || '店长',
      status: 'active',
      accountId: account.id || '',
      updatedAt: timestamp
    }
    if (data && data.length) {
      await db.collection('admin_users').doc(data[0]._id).update({ data: payload })
    } else {
      await db.collection('admin_users').add({ data: { ...payload, createdAt: timestamp } })
    }
  } else if (data && data.length) {
    await db.collection('admin_users').doc(data[0]._id).update({
      data: { status: 'inactive', role: 'buyer', updatedAt: timestamp }
    })
  }
}

async function updateAccountRole(authToken, payload = {}) {
  const auth = await getAccountByToken(authToken)
  if (!auth || !isAdmin(auth.account.role)) {
    return { ok: false, code: 'PERMISSION_DENIED', message: '需要店长权限' }
  }
  const accountId = String(payload.accountId || payload.id || '').trim()
  const role = String(payload.role || '').trim()
  if (!accountId) return { ok: false, code: 'MISSING_ACCOUNT_ID', message: '缺少用户ID' }
  if (!['buyer', 'manager'].includes(role)) {
    return { ok: false, code: 'INVALID_ROLE', message: '当前仅支持设置普通用户或店长' }
  }
  if (accountId === auth.account.id) {
    return { ok: false, code: 'CANNOT_UPDATE_SELF_ROLE', message: '不能修改当前登录账号的权限' }
  }
  const { data } = await db.collection('accounts').where({ id: accountId }).limit(1).get()
  const account = data && data[0]
  if (!account || isPlaceholderDoc(account)) return { ok: false, code: 'ACCOUNT_NOT_FOUND', message: '用户不存在' }
  if (account.role === 'guest') return { ok: false, code: 'GUEST_ROLE_LOCKED', message: '游客账号不能设置权限' }
  if (account.role === 'owner') return { ok: false, code: 'OWNER_ROLE_LOCKED', message: '店主账号不能在这里修改' }

  const updateData = { role, status: account.status || 'active', updatedAt: now() }
  await db.collection('accounts').doc(account._id).update({ data: updateData })
  await syncAdminUserForAccount({ ...account, ...updateData }, role)
  return { ok: true, data: publicAccount({ ...account, ...updateData }, auth.account.id) }
}

// ==================== 商品 ====================

async function listProducts(params = {}, authToken = '') {
  const auth = await getAccountByToken(authToken)
  let query = {}
  if (isAdmin(auth && auth.account && auth.account.role)) {
    if (params.status) query.status = params.status
  } else {
    query.status = params.status || 'active'
  }
  if (params.categoryKey) query.categoryKey = params.categoryKey
  const { data } = await db.collection('products').where(query).orderBy('sort', 'asc').limit(1000).get()
  return data.filter(row => !isPlaceholderDoc(row)).map(normalizeProductDoc)
}

function normalizeProductDoc(r = {}) {
  return {
    ...r,
    id: r.id || r._id,
    _id: r._id || r.id,
    docId: r._id,
    specs: safeJson(r.specs),
    detail: safeJson(r.detail),
    gallery: safeJson(r.gallery)
  }
}

async function findProductDocs(id) {
  if (!id) return []
  const { data } = await db.collection('products').where(_.or([{ id }, { _id: id }])).limit(1000).get()
  return (data || []).filter(row => !isPlaceholderDoc(row))
}

async function getProduct(id, authToken = '', options = {}) {
  const data = await findProductDocs(id)
  if (!data.length) return null
  const product = data[0]
  if (!options.includeInactive && product.status && product.status !== 'active') {
    const auth = await getAccountByToken(authToken)
    if (!isAdmin(auth && auth.account && auth.account.role)) return null
  }
  return normalizeProductDoc(product)
}

async function createProduct(body) {
  const id = body.id || `p${Date.now()}`
  const doc = {
    id, name: body.name || '', desc: body.desc || '', categoryKey: body.categoryKey || '',
    price: body.price || 0, originPrice: body.originPrice || 0, stock: body.stock || 0,
    totalStock: body.totalStock || body.stock || 0, sold: body.sold || 0, status: body.status || 'active',
    image: body.image || '', bannerImage: body.bannerImage || body.image || '',
    priority: body.priority ? 1 : 0, limit: body.limit !== undefined ? body.limit : 0, deadline: body.deadline || '',
    deliveryText: body.deliveryText || '', deliveryRange: body.deliveryRange || '',
    storage: body.storage || '', sort: body.sort || Date.now(),
    specs: JSON.stringify(body.specs || []), detail: JSON.stringify(body.detail || []),
    gallery: JSON.stringify(body.gallery || []), createdAt: now(), updatedAt: now()
  }
  await db.collection('products').add({ data: doc })
  const created = await getProduct(id, '', { includeInactive: true })
  return created
}

async function updateProduct(id, body) {
  const existing = await findProductDocs(id)
  if (!existing.length) return null
  const e = existing[0]
  const updateData = {
    name: body.name !== undefined ? body.name : e.name,
    desc: body.desc !== undefined ? body.desc : e.desc,
    categoryKey: body.categoryKey !== undefined ? body.categoryKey : e.categoryKey,
    price: body.price !== undefined ? body.price : e.price,
    originPrice: body.originPrice !== undefined ? body.originPrice : e.originPrice,
    stock: body.stock !== undefined ? body.stock : e.stock,
    totalStock: body.totalStock !== undefined ? body.totalStock : e.totalStock,
    sold: body.sold !== undefined ? body.sold : e.sold,
    status: body.status !== undefined ? body.status : e.status,
    image: body.image !== undefined ? body.image : e.image,
    bannerImage: body.bannerImage !== undefined ? body.bannerImage : e.bannerImage,
    priority: body.priority !== undefined ? (body.priority ? 1 : 0) : e.priority,
    limit: body.limit !== undefined ? body.limit : e.limit,
    deadline: body.deadline !== undefined ? body.deadline : e.deadline,
    deliveryText: body.deliveryText !== undefined ? body.deliveryText : e.deliveryText,
    deliveryRange: body.deliveryRange !== undefined ? body.deliveryRange : e.deliveryRange,
    storage: body.storage !== undefined ? body.storage : e.storage,
    sort: body.sort !== undefined ? body.sort : e.sort,
    specs: body.specs ? JSON.stringify(body.specs) : e.specs,
    detail: body.detail ? JSON.stringify(body.detail) : e.detail,
    gallery: body.gallery ? JSON.stringify(body.gallery) : e.gallery,
    updatedAt: now()
  }
  if (existing.length) await db.collection('products').doc(existing[0]._id).update({ data: updateData })
  return await getProduct(id, '', { includeInactive: true })
}

async function deleteProduct(id) {
  const docs = await findProductDocs(id)
  for (const d of docs) await db.collection('products').doc(d._id).remove()
  return { ok: true }
}

// ==================== 订单 ====================

async function listOrders(params = {}, authToken = '') {
  const auth = await requireUserSession(authToken)
  let query = {}
  if (params.status && params.status !== 'all') query.status = params.status
  if (isAdmin(auth.account.role)) {
    if (params.buyerId) query.buyerId = params.buyerId
  } else {
    query.buyerId = auth.account.id
  }
  const { data } = await db.collection('orders').where(query).orderBy('createdAt', 'desc').limit(1000).get()
  return enrichOrdersWithAccounts(data.filter(row => !isPlaceholderDoc(row)).map(normalizeOrderDoc))
}

async function getOrder(id, authToken = '') {
  const auth = await requireUserSession(authToken)
  const { data } = await db.collection('orders').where({ id }).limit(1).get()
  if (!data.length) return null
  if (!canAccessOrder(auth, data[0])) throw businessError('PERMISSION_DENIED', '无权查看该订单')
  const enriched = await enrichOrdersWithAccounts([normalizeOrderDoc(data[0])])
  return enriched[0] || null
}

function normalizeOrderDoc(r = {}) {
  return { ...r, _id: r.id, address: safeJson(r.address), items: safeJson(r.items) }
}

async function enrichOrdersWithAccounts(orders = []) {
  const buyerIds = Array.from(new Set((orders || []).map(order => order.buyerId).filter(Boolean)))
  if (!buyerIds.length) return orders
  const accountMap = {}
  for (let i = 0; i < buyerIds.length; i += 20) {
    const ids = buyerIds.slice(i, i + 20)
    const { data } = await db.collection('accounts').where({ id: _.in(ids) }).limit(1000).get()
    for (const account of data || []) {
      if (!account || !account.id) continue
      accountMap[account.id] = account
    }
  }
  return orders.map(order => {
    const account = accountMap[order.buyerId] || {}
    return {
      ...order,
      buyerName: account.displayName || order.buyerName || '',
      avatar: account.avatar || '',
      avatarText: account.avatarText || '甜'
    }
  })
}

async function createOrder(body, authToken = '') {
  const auth = await requireUserSession(authToken)
  await closeExpiredGroups()
  const sourceItems = Array.isArray(body.items) ? body.items : []
  if (!sourceItems.length) throw businessError('EMPTY_ORDER', '订单不能为空')
  const realPayment = isWechatPayEnabled() && body.payMode !== 'mock'
  if (realPayment && !auth.session.openid) {
    throw businessError('OPENID_REQUIRED', '当前账号缺少微信 openid，请重新微信登录后支付')
  }

  const mergedItems = []
  const itemMap = {}
  for (const source of sourceItems) {
    const productId = String(source.productId || source.id || '').trim()
    const count = Math.floor(Number(source.count || 1))
    if (!productId) throw businessError('INVALID_ORDER_ITEM', '商品信息不完整')
    if (!Number.isFinite(count) || count < 1) throw businessError('INVALID_ORDER_ITEM', '购买数量不正确')
    if (itemMap[productId]) {
      itemMap[productId].count += count
    } else {
      itemMap[productId] = { ...source, productId, count }
      mergedItems.push(itemMap[productId])
    }
  }

  const id = createOrderNo()
  let orderDoc = null
  const { data: activeGroups } = await db.collection('groups').where({ status: 'active' }).limit(1000).get()
  const shopConfig = await getShopConfig().catch(() => ({}))
  const checkoutConfig = (shopConfig && shopConfig.checkout) || {}
  const nowTime = Date.now()

  await db.runTransaction(async transaction => {
    const orderItems = []
    let productAmount = 0
    const timestamp = now()

    for (const item of mergedItems) {
      const count = Number(item.count || 1)
      const res = await transaction.collection('products')
        .where({ id: item.productId, status: 'active', stock: _.gte(count) })
        .limit(1)
        .get()
      if (!res.data.length) {
        throw businessError('STOCK_NOT_ENOUGH', `${item.name || item.productId}库存不足`)
      }
      const product = res.data[0]
      const limit = Number(product.limit || 0)
      if (limit > 0 && count > limit) {
        throw businessError('BUY_LIMIT_EXCEEDED', `${product.name || item.name || item.productId}单次最多购买${limit}份`)
      }
      const group = activeGroupForProduct(activeGroups, item.productId, item.groupId || '', nowTime)
      if (!group) {
        throw businessError('GROUP_CLOSED', `${product.name || item.name || item.productId}所属团购已结束，请返回首页选择正在进行的团购`)
      }
      const price = Number(product.price || item.price || 0)
      productAmount += price * count
      orderItems.push({
        productId: product.id || item.productId,
        groupId: group.id || item.groupId || '',
        groupName: group.title || group.name || '',
        count,
        name: product.name || item.name || '',
        price,
        image: product.imageFileID || product.image || item.image || ''
      })
      await transaction.collection('products').doc(product._id).update({
        data: { stock: _.inc(-count), sold: _.inc(count), updatedAt: timestamp }
      })
    }

    const baseDeliveryFee = Number(
      checkoutConfig.deliveryFee !== undefined && checkoutConfig.deliveryFee !== null
        ? checkoutConfig.deliveryFee
        : body.deliveryFee || 0
    )
    const rawMinimumOrderAmount = checkoutConfig.minimumOrderAmount !== undefined && checkoutConfig.minimumOrderAmount !== ''
      ? checkoutConfig.minimumOrderAmount
      : checkoutConfig.freeShippingAmount !== undefined && checkoutConfig.freeShippingAmount !== ''
        ? checkoutConfig.freeShippingAmount
        : body.minimumOrderAmount !== undefined && body.minimumOrderAmount !== ''
          ? body.minimumOrderAmount
          : body.freeShippingAmount !== undefined && body.freeShippingAmount !== ''
            ? body.freeShippingAmount
            : 88
    const minimumOrderAmount = Number(rawMinimumOrderAmount || 0)
    if (minimumOrderAmount > 0 && productAmount < minimumOrderAmount) {
      throw businessError('MINIMUM_ORDER_AMOUNT', `满￥${minimumOrderAmount.toFixed(2)}起下单，还差￥${(minimumOrderAmount - productAmount).toFixed(2)}`)
    }
    const deliveryFee = minimumOrderAmount > 0 ? 0 : baseDeliveryFee
    const discount = Number(body.discount || 0)
    const payable = Math.max(0, productAmount + deliveryFee - discount)
    const paymentExpiresAt = realPayment ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : ''
    orderDoc = {
      id, orderNo: id, buyerId: auth.account.id,
      status: realPayment ? 'pendingPayment' : (body.status || 'pendingDelivery'),
      payStatus: realPayment ? 'pending' : (body.payStatus || 'paid'),
      amount: Number(payable.toFixed(2)),
      productAmount: Number(productAmount.toFixed(2)), deliveryFee: Number(deliveryFee.toFixed(2)),
      discount: Number(discount.toFixed(2)), payable: Number(payable.toFixed(2)),
      address: JSON.stringify(body.address || {}), items: JSON.stringify(orderItems),
      note: body.note || '', payMethod: body.payMethod || '微信支付',
      fulfillmentMethod: body.fulfillmentMethod || '快递发货',
      deliveryStatus: body.deliveryStatus || 'pending',
      paymentMode: realPayment ? 'wechatPay' : 'mock',
      paymentExpiresAt,
      createdAt: timestamp, updatedAt: timestamp
    }

    await transaction.collection('orders').add({ data: orderDoc })
  })

  const createdOrder = await getOrder(id, authToken)
  if (!realPayment) {
    await sendAfterSalesNotice(createdOrder, 'order')
    return createdOrder
  }
  try {
    const payment = await createWechatJsapiPayment(createdOrder, auth.session.openid)
    await db.collection('orders').where({ id }).update({
      data: { prepayId: payment.prepayId, updatedAt: now() }
    })
    return { ...createdOrder, payRequired: true, payment: payment.params }
  } catch (error) {
    await rollbackPendingPaymentOrder(id)
    throw error
  }
}

async function createWechatJsapiPayment(order, openid) {
  const items = Array.isArray(order.items) ? order.items : safeJson(order.items)
  const description = (items.map(item => item.name).filter(Boolean).join('、') || '初炉烘焙订单').slice(0, 120)
  const body = {
    appid: WECHAT_CONFIG.appid,
    mchid: WECHAT_PAY_CONFIG.mchid,
    description,
    out_trade_no: order.id || order.orderNo,
    time_expire: order.paymentExpiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    notify_url: WECHAT_PAY_CONFIG.notifyUrl,
    amount: {
      total: amountToFen(order.payable || order.amount),
      currency: 'CNY'
    },
    payer: { openid }
  }
  const result = await requestWechatPay('POST', '/v3/pay/transactions/jsapi', body)
  if (!result.prepay_id) throw businessError('WECHAT_PAY_PREPAY_FAILED', '微信支付预下单失败')
  return {
    prepayId: result.prepay_id,
    params: buildPaymentParams(result.prepay_id)
  }
}

async function rollbackPendingPaymentOrder(id) {
  await db.runTransaction(async transaction => {
    const res = await transaction.collection('orders').where({ id }).limit(1).get()
    if (!res.data.length) return
    const order = res.data[0]
    if (order.payStatus !== 'pending' || order.status !== 'pendingPayment') return
    const timestamp = now()
    const items = safeJson(order.items)
    for (const item of items) {
      const count = Number(item.count || 1)
      if (!item.productId || !Number.isFinite(count) || count <= 0) continue
      const prods = await transaction.collection('products').where({ id: item.productId }).limit(1).get()
      if (prods.data.length) {
        await transaction.collection('products').doc(prods.data[0]._id).update({
          data: { stock: _.inc(count), sold: _.inc(-count), updatedAt: timestamp }
        })
      }
    }
    await transaction.collection('orders').doc(order._id).update({
      data: { status: 'cancelled', payStatus: 'paymentFailed', deliveryStatus: 'cancelled', cancelledAt: timestamp, updatedAt: timestamp }
    })
  })
}

async function queryWechatPayment(orderId) {
  if (!isWechatPayEnabled()) throw businessError('WECHAT_PAY_CONFIG_MISSING', '微信支付配置不完整')
  const outTradeNo = encodeURIComponent(orderId)
  return requestWechatPay('GET', `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${WECHAT_PAY_CONFIG.mchid}`)
}

async function markOrderPaidByWechat(orderId, payment = {}, authToken = '') {
  const { data: docs } = await db.collection('orders').where({ id: orderId }).limit(1).get()
  if (!docs.length) throw businessError('ORDER_NOT_FOUND', '订单不存在')
  const order = docs[0]
  if (order.payStatus === 'paid') return authToken ? getOrder(orderId, authToken) : normalizeOrderDoc(order)
  const paidTotal = payment.amount && Number(payment.amount.total || 0)
  const expectedTotal = amountToFen(order.payable || order.amount)
  if (paidTotal && paidTotal !== expectedTotal) {
    throw businessError('PAY_AMOUNT_MISMATCH', '微信支付金额与订单金额不一致')
  }
  const timestamp = now()
  const patch = {
    status: 'pendingDelivery',
    payStatus: 'paid',
    deliveryStatus: 'pending',
    transactionId: payment.transaction_id || payment.transactionId || '',
    tradeState: payment.trade_state || payment.tradeState || 'SUCCESS',
    paidAt: payment.success_time || payment.paidAt || timestamp,
    updatedAt: timestamp
  }
  await db.collection('orders').doc(order._id).update({ data: patch })
  const updated = authToken ? await getOrder(orderId, authToken) : normalizeOrderDoc({ ...order, ...patch })
  await sendAfterSalesNotice(updated, 'order')
  return updated
}

async function syncPaymentStatus(id, authToken = '') {
  const auth = await requireUserSession(authToken)
  const order = await getOrder(id, authToken)
  if (!order) throw businessError('ORDER_NOT_FOUND', '订单不存在')
  if (!canAccessOrder(auth, order)) throw businessError('PERMISSION_DENIED', '无权查看该订单')
  if (order.payStatus === 'paid') return order
  const payment = await queryWechatPayment(id)
  if (payment.trade_state === 'SUCCESS') {
    return markOrderPaidByWechat(id, payment, authToken)
  }
  return { ...order, tradeState: payment.trade_state || '', payStatus: order.payStatus || 'pending' }
}

async function requestWechatRefund(order = {}, refundNo = '', amount = 0, reason = '') {
  if (!isWechatPayEnabled() || order.paymentMode !== 'wechatPay') {
    return { mode: order.paymentMode || 'mock', refundId: '', status: 'accepted' }
  }
  const refundAmount = amountToFen(amount || order.payable || order.amount)
  const totalAmount = amountToFen(order.payable || order.amount)
  const body = {
    out_trade_no: order.id || order.orderNo,
    out_refund_no: refundNo,
    reason: String(reason || '订单退款').slice(0, 80),
    amount: {
      refund: refundAmount,
      total: totalAmount,
      currency: 'CNY'
    }
  }
  const result = await requestWechatPay('POST', '/v3/refund/domestic/refunds', body)
  return {
    mode: 'wechatPay',
    refundId: result.refund_id || '',
    status: result.status || 'PROCESSING',
    raw: result
  }
}

async function rollbackOrderStock(transaction, order, timestamp) {
  const items = safeJson(order.items)
  for (const item of items) {
    const count = Number(item.count || 1)
    if (!item.productId || !Number.isFinite(count) || count <= 0) continue
    const prods = await transaction.collection('products').where({ id: item.productId }).limit(1).get()
    if (prods.data.length) {
      await transaction.collection('products').doc(prods.data[0]._id).update({
        data: { stock: _.inc(count), sold: _.inc(-count), updatedAt: timestamp }
      })
    }
  }
}

async function updateOrder(id, body) {
  const updateData = { ...body, updatedAt: now() }
  const { data: docs } = await db.collection('orders').where({ id }).get()
  if (!docs.length) return null
  if (body.address) updateData.address = JSON.stringify(body.address)
  if (body.items) updateData.items = JSON.stringify(body.items)
  for (const d of docs) await db.collection('orders').doc(d._id).update({ data: updateData })
  return await getOrder(id)
}

async function updateOrderStatus(id, status, authToken = '') {
  const auth = await requireUserSession(authToken)
  const { data: docs } = await db.collection('orders').where({ id }).get()
  if (!docs.length) return null
  const order = docs[0]
  if (!canAccessOrder(auth, order)) throw businessError('PERMISSION_DENIED', '无权操作该订单')
  if (status === 'cancelled') {
    if (!isAdmin(auth.account.role) && ['paid', 'pendingDelivery'].includes(order.status)) {
      throw businessError('CANCEL_REQUIRES_APPROVAL', '已付款订单需要提交取消申请，待店长同意后退款')
    }
    let notifyOrder = null
    await db.runTransaction(async transaction => {
      const res = await transaction.collection('orders').where({ id }).limit(1).get()
      if (!res.data.length) throw businessError('ORDER_NOT_FOUND', '订单不存在')
      const current = res.data[0]
      if (current.status === 'cancelled') return
      if (!canAccessOrder(auth, current)) throw businessError('PERMISSION_DENIED', '无权操作该订单')
      if (!['pendingPayment', 'paid', 'pendingDelivery'].includes(current.status)) {
        throw businessError('ORDER_STATUS_INVALID', '当前订单状态不支持取消，请申请售后退款')
      }
      const timestamp = now()
      await rollbackOrderStock(transaction, current, timestamp)
      const updateData = { status, deliveryStatus: 'cancelled', cancelledAt: timestamp, updatedAt: timestamp }
      await transaction.collection('orders').doc(current._id).update({ data: updateData })
      notifyOrder = { ...current, ...updateData }
    })
    const updatedOrder = await getOrder(id, authToken)
    if (notifyOrder) await sendAfterSalesNotice({ ...notifyOrder, ...updatedOrder }, 'cancelled')
    return updatedOrder
  }

  if (!isAdmin(auth.account.role)) throw businessError('PERMISSION_DENIED', '需要店长权限')

  const updateData = { status, updatedAt: now() }
  if (status === 'delivering') updateData.deliveryStatus = 'delivering'
  if (status === 'completed') updateData.deliveryStatus = 'completed'
  for (const d of docs) await db.collection('orders').doc(d._id).update({ data: updateData })
  return await getOrder(id, authToken)
}

// ==================== 退款 ====================
async function createRefund(body, authToken = '') {
  const auth = await requireUserSession(authToken)
  const refundId = `rf${Date.now()}`
  const orderId = String(body.orderId || '').trim()
  const refundType = body.type === 'cancelOrder' || body.refundType === 'cancelOrder' ? 'cancelOrder' : 'refund'
  if (!orderId) throw new Error('订单编号不能为空')
  const { data: orders } = await db.collection('orders').where({ id: orderId }).limit(1).get()
  const order = orders && orders[0]
  if (!order) throw new Error('订单不存在')
  if (!canAccessOrder(auth, order)) throw businessError('PERMISSION_DENIED', '无权申请该订单售后')
  if (order.status === 'cancelled') throw new Error('已取消订单无需申请退款')
  if (refundType === 'cancelOrder') {
    if (!['paid', 'pendingDelivery'].includes(order.status) && order.payStatus !== 'paid') {
      throw new Error('当前订单状态不支持申请取消')
    }
  } else if (!['delivering', 'completed'].includes(order.status)) {
    throw new Error('当前订单状态不支持申请退款')
  }
  if (order.refundStatus === 'pending') throw new Error('退款申请已提交，请勿重复申请')
  const refundAmount = Number(body.amount || order.payable || order.amount || 0)
  const reasonText = body.reasonText || (refundType === 'cancelOrder' ? '用户申请取消订单，待店长同意后退款' : '')
  await db.collection('refunds').add({
    data: {
      id: refundId, refundNo: body.refundNo || refundId, orderId, buyerId: auth.account.id || order.buyerId || '',
      type: refundType, refundType,
      reason: body.reason || (refundType === 'cancelOrder' ? 'cancel_order' : ''), reasonText, refundDesc: body.refundDesc || '',
      contactPhone: body.contactPhone || '', remark: body.remark || '', status: 'pending',
      amount: refundAmount, createdAt: now(), updatedAt: now()
    }
  })
  await db.collection('orders').doc(order._id).update({
    data: {
      refundStatus: 'pending',
      refundType,
      refundNo: body.refundNo || refundId,
      refundAmount,
      refundReasonText: reasonText,
      updatedAt: now()
    }
  })
  await sendAfterSalesNotice({
    ...order,
    refundStatus: 'pending',
    refundType,
    refundNo: body.refundNo || refundId,
    refundAmount,
    refundReasonText: reasonText,
    updatedAt: now()
  }, 'refund')
  return { id: refundId, status: 'pending' }
}

async function updateRefundStatus(body = {}, authToken = '') {
  await requireAdminSession(authToken)
  const orderId = String(body.orderId || '').trim()
  const status = String(body.status || '').trim()
  if (!orderId) throw new Error('订单编号不能为空')
  if (!['approved', 'rejected'].includes(status)) throw new Error('售后处理状态不正确')

  const { data: orders } = await db.collection('orders').where({ id: orderId }).limit(1).get()
  const order = orders && orders[0]
  if (!order) throw new Error('订单不存在')
  if (order.refundStatus !== 'pending') throw new Error('当前订单没有待处理售后')
  const refundType = order.refundType === 'cancelOrder' ? 'cancelOrder' : 'refund'
  const refundAmount = Number(order.refundAmount || order.payable || order.amount || 0)
  let wechatRefund = null
  if (status === 'approved' && refundAmount > 0 && order.payStatus === 'paid') {
    wechatRefund = await requestWechatRefund(order, order.refundNo || `rf${Date.now()}`, refundAmount, order.refundReasonText || '订单退款')
  }

  const updateData = {
    refundStatus: status,
    refundHandledAt: now(),
    refundHandleRemark: body.remark || '',
    updatedAt: now()
  }
  if (status === 'approved') {
    updateData.payStatus = 'refunded'
    updateData.refundedAt = now()
    if (wechatRefund) {
      updateData.wechatRefundId = wechatRefund.refundId || ''
      updateData.wechatRefundStatus = wechatRefund.status || ''
    }
  }

  if (status === 'approved' && refundType === 'cancelOrder') {
    await db.runTransaction(async transaction => {
      const res = await transaction.collection('orders').where({ id: orderId }).limit(1).get()
      if (!res.data.length) throw businessError('ORDER_NOT_FOUND', '订单不存在')
      const current = res.data[0]
      const timestamp = now()
      if (current.status !== 'cancelled') await rollbackOrderStock(transaction, current, timestamp)
      await transaction.collection('orders').doc(current._id).update({
        data: {
          ...updateData,
          status: 'cancelled',
          deliveryStatus: 'cancelled',
          cancelledAt: current.cancelledAt || timestamp
        }
      })
    })
  } else {
    await db.collection('orders').doc(order._id).update({ data: updateData })
  }

  const refundQuery = order.refundNo
    ? _.or([{ orderId }, { refundNo: order.refundNo }])
    : { orderId }
  const { data: refunds } = await db.collection('refunds').where(refundQuery).limit(1000).get()
  for (const refund of refunds || []) {
    await db.collection('refunds').doc(refund._id).update({
      data: {
        status,
        handledAt: now(),
        handleRemark: body.remark || '',
        wechatRefundId: wechatRefund && wechatRefund.refundId ? wechatRefund.refundId : '',
        wechatRefundStatus: wechatRefund && wechatRefund.status ? wechatRefund.status : '',
        updatedAt: now()
      }
    })
  }

  return await getOrder(orderId, authToken)
}

// ==================== 评价 ====================
async function submitReview(authToken, body = {}) {
  const auth = await getAccountByToken(authToken)
  if (!auth || auth.account.role === 'guest') return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录后再评价' }
  const orderId = String(body.orderId || '').trim()
  if (!orderId) return { ok: false, code: 'VALIDATION_ERROR', message: '订单编号不能为空' }
  const content = String(body.content || '').trim()
  if (!content) return { ok: false, code: 'VALIDATION_ERROR', message: '请填写评价内容' }
  const rating = Math.min(5, Math.max(1, Number(body.rating || 5)))
  const { data: orders } = await db.collection('orders').where({ id: orderId }).limit(1).get()
  if (!orders.length) return { ok: false, code: 'ORDER_NOT_FOUND', message: '订单不存在' }
  const order = orders[0]
  if (order.buyerId && order.buyerId !== auth.account.id && !isAdmin(auth.account.role)) {
    return { ok: false, code: 'PERMISSION_DENIED', message: '无权评价该订单' }
  }
  const reviewId = `rv${Date.now()}`
  const doc = {
    id: reviewId,
    orderId,
    buyerId: auth.account.id,
    rating,
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 8) : [],
    content,
    status: 'published',
    createdAt: now(),
    updatedAt: now()
  }
  await db.collection('reviews').add({ data: doc })
  await db.collection('orders').doc(order._id).update({
    data: { reviewed: true, reviewId, reviewedAt: now(), updatedAt: now() }
  })
  return { ok: true, data: doc }
}

// ==================== 团购 ====================
async function closeExpiredGroups() {
  const nowTime = Date.now()
  const timestamp = now()
  let closed = 0
  const { data } = await db.collection('groups').where({ status: 'active' }).limit(1000).get()
  const expired = (data || []).filter(row => !isPlaceholderDoc(row) && isExpiredDeadline(row.deadlineAt, nowTime))
  for (const group of expired) {
    await db.collection('groups').doc(group._id).update({
      data: {
        status: 'completed',
        endedAt: group.endedAt || timestamp,
        endReason: group.endReason || 'deadline',
        updatedAt: timestamp
      }
    })
    closed += 1
  }
  return { closed }
}

function groupContainsProduct(group = {}, productId = '') {
  const id = String(productId || '')
  if (!id) return false
  const productIds = Array.isArray(group.productIds) ? group.productIds : []
  if (productIds.some(item => String(item) === id)) return true
  const products = safeJson(group.products)
  return products.some(item => String(item.productId || item.id || item._id || '') === id)
}

function activeGroupForProduct(groups = [], productId = '', groupId = '', nowTime = Date.now()) {
  return (groups || []).find(group => {
    if (!group || group.status !== 'active') return false
    if (isExpiredDeadline(group.deadlineAt, nowTime)) return false
    if (groupId && String(group.id || group._id || '') !== String(groupId)) return false
    return groupContainsProduct(group, productId)
  })
}

async function listGroups(params = {}, authToken = '') {
  await closeExpiredGroups()
  const auth = await getAccountByToken(authToken)
  const query = {}
  if (isAdmin(auth && auth.account && auth.account.role)) {
    if (params.status && params.status !== 'all') query.status = params.status
  } else {
    query.status = 'active'
  }
  const { data } = await db.collection('groups').where(query).orderBy('createdAt', 'desc').limit(1000).get()
  return data.filter(row => !isPlaceholderDoc(row))
}

async function getGroup(id, authToken = '', options = {}) {
  await closeExpiredGroups()
  const auth = await getAccountByToken(authToken)
  let group = null
  const { data } = await db.collection('groups').where({ id }).limit(1).get()
  group = data.find(row => !isPlaceholderDoc(row)) || null
  if (!group && id) {
    try {
      const doc = await db.collection('groups').doc(id).get()
      group = doc && doc.data && !isPlaceholderDoc(doc.data) ? doc.data : null
    } catch (e) {
      group = null
    }
  }
  if (group && group.status && group.status !== 'active' && !options.includeInactive && !isAdmin(auth && auth.account && auth.account.role)) return null
  return group || null
}

async function createGroup(body) {
  const id = `g${Date.now()}`
  const products = Array.isArray(body.products) ? body.products : []
  const expired = isExpiredDeadline(body.deadlineAt)
  const productIds = Array.isArray(body.productIds) && body.productIds.length
    ? body.productIds
    : products.map(item => item.productId || item.id).filter(Boolean)
  const doc = {
    id,
    name: body.name || body.title || '',
    title: body.title || body.name || '',
    description: body.description || '',
    status: expired ? 'completed' : (body.status || 'active'),
    productIds,
    products,
    productCount: body.productCount !== undefined ? body.productCount : products.length,
    totalStock: body.totalStock !== undefined ? body.totalStock : products.reduce((sum, item) => sum + Number(item.stock || item.totalStock || 0), 0),
    deadline: body.deadline || '',
    deadlineAt: body.deadlineAt || '',
    deliveryTime: body.deliveryTime || '',
    deliveryRange: body.deliveryRange || '',
    fulfillmentMethods: Array.isArray(body.fulfillmentMethods) ? body.fulfillmentMethods : [],
    startDate: body.startDate || now(),
    endDate: body.endDate || '',
    endedAt: expired ? now() : '',
    endReason: expired ? 'deadline' : '',
    createdAt: now(), updatedAt: now()
  }
  await db.collection('groups').add({ data: doc })
  return await getGroup(id)
}

async function updateGroup(id, body = {}) {
  const { data: docs } = await db.collection('groups').where({ id }).get()
  if (!docs.length) return null
  const products = Array.isArray(body.products) ? body.products : []
  const expired = isExpiredDeadline(body.deadlineAt)
  const productIds = Array.isArray(body.productIds) && body.productIds.length
    ? body.productIds
    : products.map(item => item.productId || item.id).filter(Boolean)
  const updateData = {
    name: body.name || body.title || '',
    title: body.title || body.name || '',
    description: body.description || '',
    productIds,
    products,
    productCount: body.productCount !== undefined ? body.productCount : products.length,
    totalStock: body.totalStock !== undefined ? body.totalStock : products.reduce((sum, item) => sum + Number(item.stock || item.totalStock || 0), 0),
    deadline: body.deadline || '',
    deadlineAt: body.deadlineAt || '',
    deliveryTime: body.deliveryTime || '',
    deliveryRange: body.deliveryRange || '',
    fulfillmentMethods: Array.isArray(body.fulfillmentMethods) ? body.fulfillmentMethods : [],
    updatedAt: now()
  }
  if (body.status) updateData.status = body.status
  if (expired) {
    updateData.status = 'completed'
    updateData.endedAt = now()
    updateData.endReason = 'deadline'
  } else {
    updateData.status = 'active'
    updateData.endedAt = ''
    updateData.endReason = ''
  }
  for (const d of docs) await db.collection('groups').doc(d._id).update({ data: updateData })
  return await getGroup(id, '', { includeInactive: true })
}

async function updateGroupStatus(id, status) {
  const { data: docs } = await db.collection('groups').where({ id }).get()
  if (!docs.length) return null
  for (const d of docs) await db.collection('groups').doc(d._id).update({ data: { status, updatedAt: now() } })
  return await getGroup(id)
}

async function deleteGroup(id) {
  const { data: docs } = await db.collection('groups').where({ id }).get()
  for (const d of docs) await db.collection('groups').doc(d._id).remove()
  return { ok: true }
}

// ==================== 备货 ====================
async function ensureCollection(name) {
  if (typeof db.createCollection !== 'function') return
  try { await db.createCollection(name) } catch {}
}

async function listStock(params = {}) {
  let query = {}
  if (params.date) query.date = params.date
  const { data } = await db.collection('stockItems').where(query).orderBy('createdAt', 'desc').limit(1000).get()
  return data
}

async function generateStock(date = '', authToken = '') {
  const targetDate = String(date || now().slice(0, 10)).slice(0, 10)
  await ensureCollection('stockItems')
  const [products, orders] = await Promise.all([
    listProducts({ status: 'active' }, authToken),
    listOrders({}, authToken)
  ])
  const productMap = products.reduce((map, product) => {
    map[product.id] = product
    return map
  }, {})
  const quantityMap = {}
  for (const order of orders) {
    if (['cancelled', 'completed'].includes(order.status)) continue
    for (const item of (order.items || [])) {
      if (!item.productId) continue
      quantityMap[item.productId] = (quantityMap[item.productId] || 0) + Number(item.count || 1)
    }
  }
  const generatedIds = new Set()
  const rows = []
  for (const productId of Object.keys(quantityMap)) {
    const product = productMap[productId] || {}
    const id = `stock_${targetDate}_${productId}`
    generatedIds.add(id)
    const doc = {
      id,
      date: targetDate,
      productId,
      productName: product.name || '',
      image: product.image || '',
      imageFileID: product.image || '',
      planCount: quantityMap[productId],
      totalQuantity: quantityMap[productId],
      status: 'pending',
      priority: product.priority ? '优先' : '正常',
      updatedAt: now()
    }
    const { data: existing } = await db.collection('stockItems').where({ id }).limit(1).get()
    if (existing.length) {
      await db.collection('stockItems').doc(existing[0]._id).update({ data: doc })
    } else {
      await db.collection('stockItems').add({ data: { ...doc, createdAt: now() } })
    }
    rows.push(doc)
  }
  const { data: existingRows } = await db.collection('stockItems').where({ date: targetDate }).limit(1000).get()
  for (const row of existingRows || []) {
    if (String(row.id || '').startsWith(`stock_${targetDate}_`) && !generatedIds.has(row.id)) {
      await db.collection('stockItems').doc(row._id).remove()
    }
  }
  return rows
}

async function updateStock(id, body = {}) {
  const { data: docs } = await db.collection('stockItems').where(_.or([{ id }, { productId: id }, { _id: id }])).limit(1).get()
  if (!docs.length) return null
  const patch = { ...body, updatedAt: now() }
  delete patch.id
  await db.collection('stockItems').doc(docs[0]._id).update({ data: patch })
  const { data } = await db.collection('stockItems').doc(docs[0]._id).get()
  return data
}

// ==================== 统计 ====================
async function statsToday() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: orders } = await db.collection('orders')
    .where({ createdAt: db.command.gte(today) }).limit(1000).get()

  const orderCount = orders.length
  const totalAmount = orders.reduce((s, o) => s + Number(o.payable || o.amount || 0), 0)
  const pendingCount = orders.filter(o => o.status === 'pendingDelivery' || o.status === 'paid').length

  const { data: products } = await db.collection('products').where({ status: 'active' }).get()

  return {
    orderCount, totalAmount, pendingCount,
    activeProductCount: products.length,
    today
  }
}

// ==================== 店铺配置 ====================
async function getShopConfig() {
  const { data } = await db.collection('shopConfig').limit(1).get()
  if (!data.length) return {}
  return safeJson(data[0].value) || {}
}

async function updateShopConfig(body) {
  const { data: existing } = await db.collection('shopConfig').limit(1).get()
  if (existing.length) {
    await db.collection('shopConfig').doc(existing[0]._id).update({ data: { value: JSON.stringify(body), updatedAt: now() } })
  } else {
    await db.collection('shopConfig').add({ data: { key: 'config', value: JSON.stringify(body), updatedAt: now() } })
  }
  return body
}

// ==================== 订阅消息 ====================
async function getAdminSubscriptionStatus(authToken) {
  const auth = await requireAdminSession(authToken)
  const config = await getShopConfig()
  const orderTemplateId = String(config.orderTemplateId || '').trim()
  const afterSalesTemplateId = String(config.afterSalesTemplateId || '').trim()
  const openid = auth.session.openid || ''
  let orderSubscription = null
  let afterSalesSubscription = null
  if (openid && (orderTemplateId || afterSalesTemplateId)) {
    const { data } = await db.collection('adminSubscriptions')
      .where({ openid, status: 'enabled' })
      .limit(100)
      .get()
    orderSubscription = (data || []).find(item => item.type === 'order' && item.templateId === orderTemplateId)
    afterSalesSubscription = (data || []).find(item => item.type === 'afterSales' && item.templateId === afterSalesTemplateId)
  }
  return {
    enabled: !!(orderSubscription || afterSalesSubscription),
    orderEnabled: !!orderSubscription,
    afterSalesEnabled: !!afterSalesSubscription,
    orderTemplateId,
    afterSalesTemplateId,
    templateId: afterSalesTemplateId,
    openidBound: !!openid,
    updatedAt: (orderSubscription || afterSalesSubscription || {}).updatedAt || ''
  }
}

async function saveAdminSubscription(authToken, body = {}) {
  const auth = await requireAdminSession(authToken)
  const config = await getShopConfig()
  const wxContext = cloud.getWXContext()
  const openid = auth.session.openid || wxContext.OPENID || ''
  if (!openid) throw new Error('当前账号缺少微信 openid，请用微信登录店长账号后再开启提醒')
  const subscriptions = Array.isArray(body.subscriptions) && body.subscriptions.length
    ? body.subscriptions
    : [{ type: body.type || 'afterSales', templateId: body.templateId || config.afterSalesTemplateId, accepted: body.accepted !== false }]
  const saved = []
  for (const subscription of subscriptions) {
    const type = subscription.type === 'order' ? 'order' : 'afterSales'
    const fallbackTemplateId = type === 'order' ? config.orderTemplateId : config.afterSalesTemplateId
    const templateId = String(subscription.templateId || fallbackTemplateId || '').trim()
    if (!templateId) continue
    const status = subscription.accepted === false ? 'disabled' : 'enabled'
    const doc = {
      type,
      templateId,
      openid,
      accountId: auth.account.id,
      adminName: auth.account.displayName || auth.account.username || '店长',
      status,
      updatedAt: now()
    }
    const { data } = await db.collection('adminSubscriptions')
      .where({ openid, type, templateId })
      .limit(1)
      .get()
    if (data && data.length) await db.collection('adminSubscriptions').doc(data[0]._id).update({ data: doc })
    else await db.collection('adminSubscriptions').add({ data: { ...doc, createdAt: now() } })
    saved.push(doc)
  }
  if (!saved.length) throw new Error('没有可保存的订阅授权')
  const result = await getAdminSubscriptionStatus(authToken)
  return { ...result, openidBound: true }
}

function truncateNoticeValue(value, max = 20) {
  const text = String(value || '')
  return text.length > max ? text.slice(0, max) : text
}

function noticeTimeText(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return new Date().toISOString().replace('T', ' ').slice(0, 16)
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const h = `${date.getHours()}`.padStart(2, '0')
  const min = `${date.getMinutes()}`.padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

function noticeProductNames(order = {}) {
  const items = Array.isArray(order.items) ? order.items : safeJson(order.items)
  const names = items.map(item => item.name).filter(Boolean).join('、')
  return truncateNoticeValue(names || '初炉商品', 20)
}

function noticeAddressText(order = {}) {
  const address = parseJson(order.address, {})
  return truncateNoticeValue(address.detail || address.address || address.receiver || '统一配送', 20)
}

async function sendAfterSalesNotice(order = {}, scene = 'refund') {
  try {
    const config = await getShopConfig()
    const noticeType = scene === 'order' ? 'order' : 'afterSales'
    const templateId = String(noticeType === 'order' ? config.orderTemplateId : config.afterSalesTemplateId || '').trim()
    if (!templateId || !cloud.openapi || !cloud.openapi.subscribeMessage) return
    const { data: subscriptions } = await db.collection('adminSubscriptions')
      .where({ type: noticeType, templateId, status: 'enabled' })
      .limit(100)
      .get()
    if (!subscriptions || !subscriptions.length) return
    const amount = Number(order.refundAmount || order.payable || order.amount || 0)
    const page = scene === 'order'
      ? `pages/admin/order-detail/index?id=${order.id || order.orderNo || ''}`
      : scene === 'cancelled'
      ? 'pages/admin/after-sales/index?active=cancelled'
      : 'pages/admin/after-sales/index?active=pending'
    const data = scene === 'order' ? {
      date4: { value: noticeTimeText(order.updatedAt || order.paidAt || order.createdAt) },
      thing5: { value: noticeProductNames(order) },
      thing7: { value: noticeAddressText(order) },
      amount12: { value: `¥${amount.toFixed(2)}` },
      thing26: { value: truncateNoticeValue(order.note || '请及时处理订单', 20) }
    } : {
      character_string1: { value: truncateNoticeValue(order.id || order.orderNo || order._id || '-', 32) },
      time4: { value: noticeTimeText(order.updatedAt || order.cancelledAt || order.createdAt) },
      amount8: { value: `¥${amount.toFixed(2)}` },
      thing6: { value: noticeProductNames(order) },
      phrase2: { value: scene === 'cancelled' ? '取消订单' : '仅退款' }
    }
    for (const item of subscriptions) {
      try {
        await sendSubscribeMessage({
          touser: item.openid,
          templateId,
          page,
          data
        })
        console.log('[subscribeMessage.send] sent:', {
          type: noticeType,
          openid: item.openid,
          templateId,
          orderId: order.id || order.orderNo || order._id || ''
        })
      } catch (error) {
        console.error('[subscribeMessage.send] failed:', item.openid, error)
      }
    }
  } catch (error) {
    console.error('[sendAfterSalesNotice] failed:', error)
  }
}

// ==================== 地址 ====================
async function listAddresses(userId, authToken = '') {
  const auth = await requireUserSession(authToken)
  const query = {}
  if (isAdmin(auth.account.role)) {
    if (userId) query.userId = userId
  } else {
    query.userId = auth.account.id
  }
  const { data } = await db.collection('addresses').where(query).orderBy('isDefault', 'desc').limit(100).get()
  return data
}

async function findAddressDocs(id) {
  if (!id) return []
  const { data } = await db.collection('addresses').where(_.or([{ id }, { _id: id }])).get()
  return data || []
}

async function getAddress(id, authToken = '') {
  const auth = await requireUserSession(authToken)
  const data = await findAddressDocs(id)
  if (data.length && !isAdmin(auth.account.role) && data[0].userId !== auth.account.id) {
    throw businessError('PERMISSION_DENIED', '无权查看该地址')
  }
  return data.length ? data[0] : null
}

async function createAddress(body, authToken = '') {
  const auth = await requireUserSession(authToken)
  const id = body.id || `addr${Date.now()}`
  const addressText = body.address || body.detail || [body.province, body.city, body.district, body.detail].filter(Boolean).join('')
  const doc = {
    id, userId: isAdmin(auth.account.role) && body.userId ? body.userId : auth.account.id, receiver: body.receiver || '', phone: body.phone || '',
    province: body.province || '', city: body.city || '', district: body.district || '',
    detail: body.detail || addressText, address: addressText,
    tag: body.tag || '', note: body.note || '',
    isDefault: body.isDefault ? 1 : 0,
    createdAt: now(), updatedAt: now()
  }
  await db.collection('addresses').add({ data: doc })
  return await getAddress(id, authToken)
}

async function updateAddress(id, body, authToken = '') {
  const auth = await requireUserSession(authToken)
  const addressText = body.address || body.detail || [body.province, body.city, body.district, body.detail].filter(Boolean).join('')
  const updateData = { ...body, updatedAt: now() }
  delete updateData._id
  delete updateData.userId
  if (addressText) {
    updateData.address = addressText
    if (!updateData.detail) updateData.detail = addressText
  }
  if (updateData.isDefault !== undefined) updateData.isDefault = updateData.isDefault ? 1 : 0
  const docs = await findAddressDocs(id)
  if (!docs.length) return null
  if (!isAdmin(auth.account.role) && docs[0].userId !== auth.account.id) throw businessError('PERMISSION_DENIED', '无权修改该地址')
  if (updateData.isDefault && docs[0].userId) {
    try {
      await db.collection('addresses').where({ userId: docs[0].userId, isDefault: 1 }).update({ data: { isDefault: 0, updatedAt: now() } })
    } catch {}
  }
  for (const d of docs) await db.collection('addresses').doc(d._id).update({ data: updateData })
  return await getAddress(id, authToken)
}

async function deleteAddress(id, authToken = '') {
  const auth = await requireUserSession(authToken)
  const docs = await findAddressDocs(id)
  if (docs.length && !isAdmin(auth.account.role) && docs[0].userId !== auth.account.id) throw businessError('PERMISSION_DENIED', '无权删除该地址')
  for (const d of docs) await db.collection('addresses').doc(d._id).remove()
  return { ok: true }
}

// ==================== 轮播 ====================
const DEFAULT_BANNER_SETTINGS = { autoplay: true, interval: 3200, duration: 450, circular: true, showDots: true }

function isCollectionMissing(error) {
  const message = String(error && (error.errMsg || error.message || error.code) || '')
  return /collection not exists|Table not exist|DATABASE_COLLECTION_NOT_EXIST|ResourceNotFound|-502005/i.test(message)
}

async function ensureCollection(name) {
  try {
    if (typeof db.createCollection === 'function') await db.createCollection(name)
  } catch (error) {
    const message = String(error && (error.errMsg || error.message || error.code) || '')
    if (!/already exists|already exist|Collection already exists|DATABASE_COLLECTION_ALREADY_EXISTS|DATABASE_COLLECTION_ALREADY_EXIST|ResourceExist|Table exist|-502001|-501001/i.test(message)) {
      throw error
    }
  }
}

function normalizeBannerConfig(body = {}) {
  const source = body || {}
  const settings = { ...DEFAULT_BANNER_SETTINGS, ...(source.settings || {}) }
  const banners = Array.isArray(source.banners) ? source.banners : []
  return {
    settings: {
      autoplay: settings.autoplay !== false,
      circular: settings.circular !== false,
      showDots: settings.showDots !== false,
      interval: Number(settings.interval || DEFAULT_BANNER_SETTINGS.interval),
      duration: Number(settings.duration || DEFAULT_BANNER_SETTINGS.duration)
    },
    banners: banners
      .map((item, index) => {
        const { _id, _openid, createdAt, updatedAt, ...banner } = item || {}
        return {
          ...banner,
          id: banner.id || `banner_${index + 1}`,
          sort: Number(banner.sort || index + 1),
          enabled: banner.enabled !== false,
          title: '',
          highlight: '',
          subtitle: '',
          tag: '',
          features: []
        }
      })
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
  }
}

async function getBannerConfig() {
  try {
    const { data } = await db.collection('bannerConfig').where({ key: 'home' }).limit(1).get()
    if (data.length) {
      return normalizeBannerConfig(parseJson(data[0].value, {}))
    }
  } catch (error) {
    if (!isCollectionMissing(error)) throw error
  }
  const banners = await listBanners()
  return normalizeBannerConfig({ settings: DEFAULT_BANNER_SETTINGS, banners })
}

async function updateBannerConfig(body) {
  const config = normalizeBannerConfig(body)
  await ensureCollection('bannerConfig')
  let existing = []
  try {
    const result = await db.collection('bannerConfig').where({ key: 'home' }).limit(1).get()
    existing = result.data || []
  } catch (error) {
    if (!isCollectionMissing(error)) throw error
    await ensureCollection('bannerConfig')
  }
  const data = { key: 'home', value: JSON.stringify(config), updatedAt: now() }
  if (existing.length) {
    await db.collection('bannerConfig').doc(existing[0]._id).update({ data })
  } else {
    await db.collection('bannerConfig').add({ data: { ...data, createdAt: now() } })
  }
  await updateBanners(config.banners)
  return config
}

async function listBanners() {
  try {
    const { data } = await db.collection('banners').orderBy('sort', 'asc').limit(20).get()
    return data
  } catch (error) {
    if (isCollectionMissing(error)) return []
    throw error
  }
}

async function updateBanners(body) {
  await ensureCollection('banners')
  // 简单处理：清除旧数据，写入新数据
  let existing = []
  try {
    const result = await db.collection('banners').get()
    existing = result.data || []
  } catch (error) {
    if (!isCollectionMissing(error)) throw error
    await ensureCollection('banners')
  }
  for (const d of existing) await db.collection('banners').doc(d._id).remove()
  const banners = Array.isArray(body) ? body : (body.banners || [])
  for (const b of banners) {
    const { _id, _openid, createdAt, updatedAt, ...banner } = b || {}
    await db.collection('banners').add({
      data: { ...banner, createdAt: now(), updatedAt: now() }
    })
  }
  return await listBanners()
}

// ==================== 工具函数 ====================
function safeJson(v) {
  if (!v) return []
  if (Array.isArray(v)) return v
  try { return JSON.parse(v) } catch { return [] }
}

function parseJson(v, fallback) {
  if (!v) return fallback
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return fallback }
}

// ==================== 云函数入口 ====================
exports.main = async (event, context) => {
  const { action, payload = {}, authToken } = event
  console.log(`[businessApi] action: ${action}`)

  try {
    if (!action || action === 'timer.closeExpiredGroups') {
      return { ok: true, data: await closeExpiredGroups() }
    }
    switch (action) {
      // 认证
      case 'authGuestLogin': return await authGuestLogin()
      case 'authWxLogin': return await authWxLogin(payload)
      case 'authLogin': return await authLogin(payload)
      case 'authMe': case 'getIdentity': return await authMe(authToken)
      case 'authLogout': return await authLogout(authToken)
      case 'forgotPassword': return await forgotPassword(payload)
      case 'updateProfile': return await updateProfile(authToken, payload)
      case 'promoteAllUsersToManager': return await promoteAllUsersToManager(authToken)
      case 'listAccounts': return await listAccounts(authToken)
      case 'updateAccountRole': return await updateAccountRole(authToken, payload)

      // 商品
      case 'listProducts': return { ok: true, data: await listProducts(payload, authToken) }
      case 'getProduct': return { ok: true, data: await getProduct(payload.id, authToken) }
      case 'createProduct': await requireAdminSession(authToken); return { ok: true, data: await createProduct(payload) }
      case 'updateProduct': await requireAdminSession(authToken); return { ok: true, data: await updateProduct(payload.id, payload) }
      case 'deleteProduct': await requireAdminSession(authToken); return await deleteProduct(payload.id)

      // 订单
      case 'listOrders': return { ok: true, data: await listOrders(payload, authToken) }
      case 'getOrder': return { ok: true, data: await getOrder(payload.id, authToken) }
      case 'createOrder': return { ok: true, data: await createOrder(payload, authToken) }
      case 'updateOrder': await requireAdminSession(authToken); return { ok: true, data: await updateOrder(payload.id, payload) }
      case 'updateOrderStatus': return { ok: true, data: await updateOrderStatus(payload.id, payload.status, authToken) }
      case 'syncPaymentStatus': return { ok: true, data: await syncPaymentStatus(payload.id, authToken) }
      case 'createRefund': return { ok: true, data: await createRefund(payload, authToken) }
      case 'updateRefundStatus': return { ok: true, data: await updateRefundStatus(payload, authToken) }
      case 'submitReview': return await submitReview(authToken, payload)
      case 'createReview': return await submitReview(authToken, payload)

      // 团购
      case 'listGroups': return { ok: true, data: await listGroups(payload, authToken) }
      case 'getGroup': return { ok: true, data: await getGroup(payload.id, authToken) }
      case 'createGroup': await requireAdminSession(authToken); return { ok: true, data: await createGroup(payload) }
      case 'updateGroup': await requireAdminSession(authToken); return { ok: true, data: await updateGroup(payload.id, payload) }
      case 'updateGroupStatus': await requireAdminSession(authToken); return { ok: true, data: await updateGroupStatus(payload.id, payload.status) }
      case 'deleteGroup': await requireAdminSession(authToken); return await deleteGroup(payload.id)
      case 'closeExpiredGroups': await requireAdminSession(authToken); return { ok: true, data: await closeExpiredGroups() }

      // 备货
      case 'listStock': await requireAdminSession(authToken); return { ok: true, data: await listStock(payload) }
      case 'generateStock': await requireAdminSession(authToken); return { ok: true, data: await generateStock(payload.date, authToken) }
      case 'updateStock': await requireAdminSession(authToken); return { ok: true, data: await updateStock(payload.id, payload) }

      // 统计
      case 'statsToday': await requireAdminSession(authToken); return { ok: true, data: await statsToday() }

      // 店铺配置
      case 'getShopConfig': return { ok: true, data: await getShopConfig() }
      case 'updateShopConfig': await requireAdminSession(authToken); return { ok: true, data: await updateShopConfig(payload) }

      // 订阅消息
      case 'getAdminSubscriptionStatus': return { ok: true, data: await getAdminSubscriptionStatus(authToken) }
      case 'saveAdminSubscription': return { ok: true, data: await saveAdminSubscription(authToken, payload) }

      // 地址
      case 'listAddresses': return { ok: true, data: await listAddresses(payload.userId, authToken) }
      case 'getAddress': return { ok: true, data: await getAddress(payload.id, authToken) }
      case 'createAddress': return { ok: true, data: await createAddress(payload, authToken) }
      case 'updateAddress': return { ok: true, data: await updateAddress(payload.id, payload, authToken) }
      case 'deleteAddress': return await deleteAddress(payload.id, authToken)

      // 轮播
      case 'getBannerConfig': return { ok: true, data: await getBannerConfig() }
      case 'updateBannerConfig': await requireAdminSession(authToken); return { ok: true, data: await updateBannerConfig(payload) }
      case 'listBanners': return { ok: true, data: await listBanners() }
      case 'updateBanners': await requireAdminSession(authToken); return { ok: true, data: await updateBanners(payload) }

      default:
        return { ok: true, message: `Unknown action: ${action}` }
    }
  } catch (error) {
    console.error(`[businessApi] Error in ${action}:`, error)
    return { ok: false, code: error.code || 'SERVER_ERROR', message: error.message || '服务器异常' }
  }
}
