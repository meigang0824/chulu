/**
 * API 客户端 — 微信云开发模式
 * 使用 wx.cloud.callFunction 调用云函数，替代 HTTP 请求
 */

/**
 * 调用 businessApi 云函数
 */
const CLOUD_FUNCTION_TIMEOUT = 10000
const CLOUD_FUNCTION_TIMEOUTS = {
  authWxLogin: 20000,
  createOrder: 30000,
  syncPaymentStatus: 20000,
  updateProfile: 30000,
  updateRefundStatus: 30000
}

function cloudTimeout(action) {
  const error = new Error('请求超时，请稍后重试')
  error.code = 'CLOUD_TIMEOUT'
  error.action = action
  return error
}

function withTimeout(promise, action) {
  let timer = null
  const timeoutMs = CLOUD_FUNCTION_TIMEOUTS[action] || CLOUD_FUNCTION_TIMEOUT
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(cloudTimeout(action)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function callCloudFunction(name, data = {}, action = name) {
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    return Promise.reject(new Error('当前环境不支持微信云函数'))
  }
  return withTimeout(wx.cloud.callFunction({ name, data }), action)
}

function callBusinessApi(action, payload = {}, authToken = '') {
  return callCloudFunction('businessApi', { action, payload, authToken }, action).then(res => {
    const result = res.result || {}
    if (result.ok) return result.data !== undefined ? result.data : result
    const error = new Error(result.message || result.code || '请求失败')
    error.code = result.code || 'REQUEST_FAILED'
    error.result = result
    throw error
  })
}

// ==================== 商品 ====================
export const productAPI = {
  list: (params = {}, authToken = '') => callBusinessApi('listProducts', params, authToken),
  get: (id, authToken = '') => callBusinessApi('getProduct', { id }, authToken),
  create: (data, authToken = '') => callBusinessApi('createProduct', data, authToken),
  update: (id, data, authToken = '') => callBusinessApi('updateProduct', { id, ...data }, authToken),
  delete: (id, authToken = '') => callBusinessApi('deleteProduct', { id }, authToken),
}

// ==================== 订单 ====================
export const orderAPI = {
  list: (params = {}, authToken = '') => callBusinessApi('listOrders', params, authToken),
  get: (id, authToken = '') => callBusinessApi('getOrder', { id }, authToken),
  create: (data, authToken = '') => callBusinessApi('createOrder', data, authToken),
  update: (id, data, authToken = '') => callBusinessApi('updateOrder', { id, ...data }, authToken),
  updateStatus: (id, status, authToken = '') => callBusinessApi('updateOrderStatus', { id, status }, authToken),
  syncPaymentStatus: (id, authToken = '') => callBusinessApi('syncPaymentStatus', { id }, authToken),
  cancelPendingPayment: (id, authToken = '') => callBusinessApi('cancelPendingPaymentOrder', { id }, authToken),
  createRefund: (data, authToken = '') => callBusinessApi('createRefund', data, authToken),
  updateRefundStatus: (data, authToken = '') => callBusinessApi('updateRefundStatus', data, authToken),
  cancelRefundRequest: (data, authToken = '') => callBusinessApi('cancelRefundRequest', data, authToken),
}

// ==================== 团购 ====================
export const groupAPI = {
  list: (params = {}, authToken = '') => callBusinessApi('listGroups', params, authToken),
  get: (id, authToken = '') => callBusinessApi('getGroup', { id }, authToken),
  create: (data, authToken = '') => callBusinessApi('createGroup', data, authToken),
  update: (id, data, authToken = '') => callBusinessApi('updateGroup', { id, ...data }, authToken),
  updateStatus: (id, status, authToken = '') => callBusinessApi('updateGroupStatus', { id, status }, authToken),
  delete: (id, authToken = '') => callBusinessApi('deleteGroup', { id }, authToken),
}

// ==================== 备货 ====================
export const stockAPI = {
  list: (params = {}, authToken = '') => callBusinessApi('listStock', params, authToken),
  generate: (date, authToken = '') => callBusinessApi('generateStock', { date }, authToken).catch(() => {}),
  update: (id, data, authToken = '') => callBusinessApi('updateStock', { id, ...data }, authToken),
}

// ==================== 统计 ====================
export const statsAPI = {
  today: (authToken = '') => callBusinessApi('statsToday', {}, authToken),
}

// ==================== 店铺配置 ====================
export const shopAPI = {
  get: () => callBusinessApi('getShopConfig'),
  update: (data, authToken = '') => callBusinessApi('updateShopConfig', data, authToken),
}

// ==================== 消息订阅 ====================
export const notificationAPI = {
  getAdminSubscriptionStatus: (authToken = '') => callBusinessApi('getAdminSubscriptionStatus', {}, authToken),
  saveAdminSubscription: (data = {}, authToken = '') => callBusinessApi('saveAdminSubscription', data, authToken),
}

// ==================== 权限 / 用户 ====================
export const accountAPI = {
  list: (authToken = '') => callBusinessApi('listAccounts', {}, authToken),
  updateRole: (accountId, role, authToken = '') => callBusinessApi('updateAccountRole', { accountId, role }, authToken),
}

// ==================== 地址 ====================
export const addressAPI = {
  list: (userId, authToken = '') => callBusinessApi('listAddresses', userId ? { userId } : {}, authToken),
  get: (id, authToken = '') => callBusinessApi('getAddress', { id }, authToken),
  create: (data, authToken = '') => callBusinessApi('createAddress', data, authToken),
  update: (id, data, authToken = '') => callBusinessApi('updateAddress', { id, ...data }, authToken),
  delete: (id, authToken = '') => callBusinessApi('deleteAddress', { id }, authToken),
}

// ==================== 轮播 ====================
export const bannerAPI = {
  getConfig: () => callBusinessApi('getBannerConfig'),
  updateConfig: (data, authToken = '') => callBusinessApi('updateBannerConfig', data, authToken),
  list: () => callBusinessApi('listBanners'),
  update: (data, authToken = '') => callBusinessApi('updateBanners', data, authToken),
}

// ==================== 兼容旧 callFunction 调用 ====================
export function callFunction(name, data = {}) {
  if (name === 'businessApi') {
    return callBusinessApi(data.action, data.payload || {}, data.authToken || '')
  }
  return callCloudFunction(name, data.payload || data)
    .then(res => res.result)
}

export function requestJson({ url, method = 'GET', data = {} }) {
  // 兼容旧接口：将 URL 映射到对应的云函数 action
  const path = url.replace(/^\/api\/?/, '')
  const actionMap = {
    'products': 'listProducts',
    'orders': 'listOrders',
    'groups': 'listGroups',
    'stock': 'listStock',
    'stats/today': 'statsToday',
    'shop': 'getShopConfig',
    'addresses': 'listAddresses',
    'banners': 'listBanners',
    'banner-config': 'getBannerConfig',
  }
  const action = actionMap[path] || actionMap[path.split('/')[0]]
  if (action) {
    return callBusinessApi(action, data)
  }
  return Promise.reject(new Error('未知请求: ' + path))
}
