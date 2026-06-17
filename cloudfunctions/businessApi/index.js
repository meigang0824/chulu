// 云函数入口：businessApi
// 初炉小程序核心业务逻辑
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 微信小程序配置
const WECHAT_CONFIG = {
  appid: process.env.WECHAT_APPID || 'wxa7b8ae590c1373d2',
  secret: process.env.WECHAT_SECRET || ''
}

const ADMIN_ROLES = ['owner', 'manager', 'staff']
const DEFAULT_USER_ROLE = 'manager'
const SESSION_DAYS = 7

function now() { return new Date().toISOString() }
function isAdmin(r) { return ADMIN_ROLES.includes(r) }
function isPlaceholderDoc(row = {}) { return row && row._init === true }
function createToken() { return crypto.randomBytes(24).toString('hex') + Date.now().toString(36) }
function sessionExpiresAt() { return new Date(Date.now() + SESSION_DAYS * 86400000).toISOString() }

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
    if (account.role === DEFAULT_USER_ROLE) {
      skipped += 1
      continue
    }
    await db.collection('accounts').doc(account._id).update({
      data: {
        role: DEFAULT_USER_ROLE,
        status: account.status || 'active',
        updatedAt: now()
      }
    })
    updated += 1
  }
  return {
    ok: true,
    role: DEFAULT_USER_ROLE,
    updated,
    skipped,
    total: (accounts || []).length
  }
}

// ==================== 商品 ====================

async function listProducts(params = {}) {
  let query = {}
  if (params.status) query.status = params.status
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

async function getProduct(id) {
  const data = await findProductDocs(id)
  return data.length ? normalizeProductDoc(data[0]) : null
}

async function createProduct(body) {
  const id = body.id || `p${Date.now()}`
  const doc = {
    id, name: body.name || '', desc: body.desc || '', categoryKey: body.categoryKey || '',
    price: body.price || 0, originPrice: body.originPrice || 0, stock: body.stock || 0,
    totalStock: body.totalStock || body.stock || 0, sold: body.sold || 0, status: body.status || 'active',
    image: body.image || '', bannerImage: body.bannerImage || body.image || '', tag: body.tag || '',
    priority: body.priority ? 1 : 0, limit: body.limit || 5, deadline: body.deadline || '',
    deliveryText: body.deliveryText || '', deliveryRange: body.deliveryRange || '',
    storage: body.storage || '', sort: body.sort || Date.now(),
    specs: JSON.stringify(body.specs || []), detail: JSON.stringify(body.detail || []),
    gallery: JSON.stringify(body.gallery || []), createdAt: now(), updatedAt: now()
  }
  await db.collection('products').add({ data: doc })
  const created = await getProduct(id)
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
    tag: body.tag !== undefined ? body.tag : e.tag,
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
  return await getProduct(id)
}

async function deleteProduct(id) {
  const docs = await findProductDocs(id)
  for (const d of docs) await db.collection('products').doc(d._id).remove()
  return { ok: true }
}

// ==================== 订单 ====================

async function listOrders(params = {}) {
  let query = {}
  if (params.status && params.status !== 'all') query.status = params.status
  if (params.buyerId) query.buyerId = params.buyerId
  const { data } = await db.collection('orders').where(query).orderBy('createdAt', 'desc').limit(1000).get()
  return data.filter(row => !isPlaceholderDoc(row)).map(r => ({ ...r, _id: r.id, address: safeJson(r.address), items: safeJson(r.items) }))
}

async function getOrder(id) {
  const { data } = await db.collection('orders').where({ id }).limit(1).get()
  if (!data.length) return null
  const r = data[0]
  return { ...r, _id: r.id, address: safeJson(r.address), items: safeJson(r.items) }
}

async function createOrder(body) {
  const id = `o${Date.now()}`
  const doc = {
    id, orderNo: id, buyerId: body.buyerId || '', status: body.status || 'pendingDelivery',
    payStatus: body.payStatus || 'paid', amount: body.amount || 0,
    productAmount: body.productAmount || 0, deliveryFee: body.deliveryFee || 0,
    discount: body.discount || 0, payable: body.payable || body.amount || 0,
    address: JSON.stringify(body.address || {}), items: JSON.stringify(body.items || []),
    note: body.note || '', payMethod: body.payMethod || '微信支付',
    fulfillmentMethod: body.fulfillmentMethod || '快递发货',
    deliveryStatus: body.deliveryStatus || 'pending',
    createdAt: now(), updatedAt: now()
  }
  await db.collection('orders').add({ data: doc })

  // 扣减库存
  for (const item of (body.items || [])) {
    const { data: prods } = await db.collection('products').where({ id: item.productId }).limit(1).get()
    if (prods.length) {
      const p = prods[0]
      const newStock = Math.max(0, (p.stock || 0) - (item.count || 1))
      await db.collection('products').doc(prods[0]._id).update({
        data: { stock: newStock, sold: _.inc(item.count || 1), updatedAt: now() }
      })
    }
  }

  return await getOrder(id)
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

async function updateOrderStatus(id, status) {
  const { data: docs } = await db.collection('orders').where({ id }).get()
  if (!docs.length) return null
  const updateData = { status, updatedAt: now() }
  if (status === 'delivering') updateData.deliveryStatus = 'delivering'
  if (status === 'completed') updateData.deliveryStatus = 'completed'
  if (status === 'cancelled') {
    updateData.deliveryStatus = 'cancelled'
    updateData.cancelledAt = now()
    // 回补库存
    const order = docs[0]
    const items = safeJson(order.items)
    for (const item of items) {
      const { data: prods } = await db.collection('products').where({ id: item.productId }).limit(1).get()
      if (prods.length) {
        await db.collection('products').doc(prods[0]._id).update({
          data: { stock: _.inc(item.count || 1), sold: _.inc(-(item.count || 1)), updatedAt: now() }
        })
      }
    }
  }
  for (const d of docs) await db.collection('orders').doc(d._id).update({ data: updateData })
  return await getOrder(id)
}

// ==================== 退款 ====================
async function createRefund(body) {
  const refundId = `rf${Date.now()}`
  await db.collection('refunds').add({
    data: {
      id: refundId, orderId: body.orderId, buyerId: body.buyerId || '',
      reason: body.reason || '', status: 'pending',
      amount: body.amount || 0, createdAt: now(), updatedAt: now()
    }
  })
  return { id: refundId, status: 'pending' }
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
async function listGroups(params = {}) {
  const query = {}
  if (params.status && params.status !== 'all') query.status = params.status
  const { data } = await db.collection('groups').where(query).orderBy('createdAt', 'desc').limit(1000).get()
  return data.filter(row => !isPlaceholderDoc(row))
}

async function getGroup(id) {
  const { data } = await db.collection('groups').where({ id }).limit(1).get()
  const group = data.find(row => !isPlaceholderDoc(row))
  return group || null
}

async function createGroup(body) {
  const id = `g${Date.now()}`
  const products = Array.isArray(body.products) ? body.products : []
  const productIds = Array.isArray(body.productIds) && body.productIds.length
    ? body.productIds
    : products.map(item => item.productId || item.id).filter(Boolean)
  const doc = {
    id,
    name: body.name || body.title || '',
    title: body.title || body.name || '',
    description: body.description || '',
    status: body.status || 'active',
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
    createdAt: now(), updatedAt: now()
  }
  await db.collection('groups').add({ data: doc })
  return await getGroup(id)
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

async function generateStock(date = '') {
  const targetDate = String(date || now().slice(0, 10)).slice(0, 10)
  await ensureCollection('stockItems')
  const [products, orders] = await Promise.all([
    listProducts({ status: 'active' }),
    listOrders({})
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

// ==================== 地址 ====================
async function listAddresses(userId) {
  const query = userId ? { userId } : {}
  const { data } = await db.collection('addresses').where(query).orderBy('isDefault', 'desc').limit(100).get()
  return data
}

async function findAddressDocs(id) {
  if (!id) return []
  const { data } = await db.collection('addresses').where(_.or([{ id }, { _id: id }])).get()
  return data || []
}

async function getAddress(id) {
  const data = await findAddressDocs(id)
  return data.length ? data[0] : null
}

async function createAddress(body) {
  const id = body.id || `addr${Date.now()}`
  const addressText = body.address || body.detail || [body.province, body.city, body.district, body.detail].filter(Boolean).join('')
  const doc = {
    id, userId: body.userId || '', receiver: body.receiver || '', phone: body.phone || '',
    province: body.province || '', city: body.city || '', district: body.district || '',
    detail: body.detail || addressText, address: addressText,
    tag: body.tag || '', note: body.note || '',
    isDefault: body.isDefault ? 1 : 0,
    createdAt: now(), updatedAt: now()
  }
  await db.collection('addresses').add({ data: doc })
  return await getAddress(id)
}

async function updateAddress(id, body) {
  const addressText = body.address || body.detail || [body.province, body.city, body.district, body.detail].filter(Boolean).join('')
  const updateData = { ...body, updatedAt: now() }
  delete updateData._id
  if (addressText) {
    updateData.address = addressText
    if (!updateData.detail) updateData.detail = addressText
  }
  if (updateData.isDefault !== undefined) updateData.isDefault = updateData.isDefault ? 1 : 0
  const docs = await findAddressDocs(id)
  if (!docs.length) return null
  if (updateData.isDefault && docs[0].userId) {
    try {
      await db.collection('addresses').where({ userId: docs[0].userId, isDefault: 1 }).update({ data: { isDefault: 0, updatedAt: now() } })
    } catch {}
  }
  for (const d of docs) await db.collection('addresses').doc(d._id).update({ data: updateData })
  return await getAddress(id)
}

async function deleteAddress(id) {
  const docs = await findAddressDocs(id)
  for (const d of docs) await db.collection('addresses').doc(d._id).remove()
  return { ok: true }
}

// ==================== 轮播 ====================
const DEFAULT_BANNER_SETTINGS = { autoplay: true, interval: 3200, duration: 450, circular: true, showDots: true }

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
      .map((item, index) => ({
        ...item,
        id: item.id || `banner_${index + 1}`,
        sort: Number(item.sort || index + 1),
        enabled: item.enabled !== false,
        features: Array.isArray(item.features) ? item.features : []
      }))
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
  }
}

async function getBannerConfig() {
  const { data } = await db.collection('bannerConfig').where({ key: 'home' }).limit(1).get()
  if (data.length) {
    return normalizeBannerConfig(parseJson(data[0].value, {}))
  }
  const banners = await listBanners()
  return normalizeBannerConfig({ settings: DEFAULT_BANNER_SETTINGS, banners })
}

async function updateBannerConfig(body) {
  const config = normalizeBannerConfig(body)
  const { data: existing } = await db.collection('bannerConfig').where({ key: 'home' }).limit(1).get()
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
  const { data } = await db.collection('banners').orderBy('sort', 'asc').limit(20).get()
  return data
}

async function updateBanners(body) {
  // 简单处理：清除旧数据，写入新数据
  const { data: existing } = await db.collection('banners').get()
  for (const d of existing) await db.collection('banners').doc(d._id).remove()
  const banners = Array.isArray(body) ? body : (body.banners || [])
  for (const b of banners) {
    await db.collection('banners').add({
      data: { ...b, createdAt: now(), updatedAt: now() }
    })
  }
  return await listBanners()
}

// ==================== 路由管理 ====================
async function listRoutes() {
  const { data } = await db.collection('deliveryRoutes').orderBy('sort', 'asc').limit(100).get()
  return data
}

async function saveRouteConfig(body) {
  const { _id, ...safeBody } = body || {}
  const id = safeBody.id || `route${Date.now()}`
  const routeData = { ...safeBody, id }
  const { data: existing } = await db.collection('deliveryRoutes').where({ id }).limit(1).get()
  if (existing.length) {
    await db.collection('deliveryRoutes').doc(existing[0]._id).update({ data: { ...routeData, updatedAt: now() } })
  } else {
    await db.collection('deliveryRoutes').add({ data: { ...routeData, createdAt: now(), updatedAt: now() } })
  }
  return routeData
}

async function deleteRoute(id) {
  const { data: docs } = await db.collection('deliveryRoutes').where({ id }).get()
  for (const d of docs) await db.collection('deliveryRoutes').doc(d._id).remove()
  return { ok: true }
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

      // 商品
      case 'listProducts': return { ok: true, data: await listProducts(payload) }
      case 'getProduct': return { ok: true, data: await getProduct(payload.id) }
      case 'createProduct': return { ok: true, data: await createProduct(payload) }
      case 'updateProduct': return { ok: true, data: await updateProduct(payload.id, payload) }
      case 'deleteProduct': return await deleteProduct(payload.id)

      // 订单
      case 'listOrders': return { ok: true, data: await listOrders(payload) }
      case 'getOrder': return { ok: true, data: await getOrder(payload.id) }
      case 'createOrder': return { ok: true, data: await createOrder(payload) }
      case 'updateOrder': return { ok: true, data: await updateOrder(payload.id, payload) }
      case 'updateOrderStatus': return { ok: true, data: await updateOrderStatus(payload.id, payload.status) }
      case 'createRefund': return { ok: true, data: await createRefund(payload) }
      case 'submitReview': return await submitReview(authToken, payload)
      case 'createReview': return await submitReview(authToken, payload)

      // 团购
      case 'listGroups': return { ok: true, data: await listGroups(payload) }
      case 'getGroup': return { ok: true, data: await getGroup(payload.id) }
      case 'createGroup': return { ok: true, data: await createGroup(payload) }
      case 'updateGroupStatus': return { ok: true, data: await updateGroupStatus(payload.id, payload.status) }
      case 'deleteGroup': return await deleteGroup(payload.id)

      // 备货
      case 'listStock': return { ok: true, data: await listStock(payload) }
      case 'generateStock': return { ok: true, data: await generateStock(payload.date) }
      case 'updateStock': return { ok: true, data: await updateStock(payload.id, payload) }

      // 统计
      case 'statsToday': return { ok: true, data: await statsToday() }

      // 店铺配置
      case 'getShopConfig': return { ok: true, data: await getShopConfig() }
      case 'updateShopConfig': return { ok: true, data: await updateShopConfig(payload) }

      // 地址
      case 'listAddresses': return { ok: true, data: await listAddresses(payload.userId) }
      case 'getAddress': return { ok: true, data: await getAddress(payload.id) }
      case 'createAddress': return { ok: true, data: await createAddress(payload) }
      case 'updateAddress': return { ok: true, data: await updateAddress(payload.id, payload) }
      case 'deleteAddress': return await deleteAddress(payload.id)

      // 轮播
      case 'getBannerConfig': return { ok: true, data: await getBannerConfig() }
      case 'updateBannerConfig': return { ok: true, data: await updateBannerConfig(payload) }
      case 'listBanners': return { ok: true, data: await listBanners() }
      case 'updateBanners': return { ok: true, data: await updateBanners(payload) }

      // 配送路线
      case 'listRoutes': return { ok: true, data: await listRoutes() }
      case 'saveRouteConfig': return { ok: true, data: await saveRouteConfig(payload) }
      case 'deleteRoute': return await deleteRoute(payload.id)

      default:
        return { ok: true, message: `Unknown action: ${action}` }
    }
  } catch (error) {
    console.error(`[businessApi] Error in ${action}:`, error)
    return { ok: false, code: 'SERVER_ERROR', message: error.message || '服务器异常' }
  }
}
