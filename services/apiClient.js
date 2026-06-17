/**
 * API 客户端 — 微信云开发模式
 * 使用 wx.cloud.callFunction 调用云函数，替代 HTTP 请求
 */

/**
 * 调用 businessApi 云函数
 */
const CLOUD_FUNCTION_TIMEOUT = 10000

function cloudTimeout(action) {
  const error = new Error('请求超时，请稍后重试')
  error.code = 'CLOUD_TIMEOUT'
  error.action = action
  return error
}

function withTimeout(promise, action) {
  let timer = null
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(cloudTimeout(action)), CLOUD_FUNCTION_TIMEOUT)
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
    throw new Error(result.message || result.code || '请求失败')
  })
}

// ==================== 商品 ====================
export const productAPI = {
  list: (params = {}) => callBusinessApi('listProducts', params),
  get: (id) => callBusinessApi('getProduct', { id }),
  create: (data) => callBusinessApi('createProduct', data),
  update: (id, data) => callBusinessApi('updateProduct', { id, ...data }),
  delete: (id) => callBusinessApi('deleteProduct', { id }),
}

// ==================== 订单 ====================
export const orderAPI = {
  list: (params = {}) => callBusinessApi('listOrders', params),
  get: (id) => callBusinessApi('getOrder', { id }),
  create: (data) => callBusinessApi('createOrder', data),
  update: (id, data) => callBusinessApi('updateOrder', { id, ...data }),
  updateStatus: (id, status) => callBusinessApi('updateOrderStatus', { id, status }),
  createRefund: (data) => callBusinessApi('createRefund', data),
}

// ==================== 团购 ====================
export const groupAPI = {
  list: (params = {}) => callBusinessApi('listGroups', params),
  get: (id) => callBusinessApi('getGroup', { id }),
  create: (data) => callBusinessApi('createGroup', data),
  updateStatus: (id, status) => callBusinessApi('updateGroupStatus', { id, status }),
  delete: (id) => callBusinessApi('deleteGroup', { id }),
}

// ==================== 备货 ====================
export const stockAPI = {
  list: (params = {}) => callBusinessApi('listStock', params),
  generate: (date) => callBusinessApi('generateStock', { date }).catch(() => {}),
  update: (id, data) => callBusinessApi('updateStock', { id, ...data }),
}

// ==================== 统计 ====================
export const statsAPI = {
  today: () => callBusinessApi('statsToday'),
}

// ==================== 店铺配置 ====================
export const shopAPI = {
  get: () => callBusinessApi('getShopConfig'),
  update: (data) => callBusinessApi('updateShopConfig', data),
}

// ==================== 地址 ====================
export const addressAPI = {
  list: (userId) => callBusinessApi('listAddresses', userId ? { userId } : {}),
  get: (id) => callBusinessApi('getAddress', { id }),
  create: (data) => callBusinessApi('createAddress', data),
  update: (id, data) => callBusinessApi('updateAddress', { id, ...data }),
  delete: (id) => callBusinessApi('deleteAddress', { id }),
}

// ==================== 轮播 ====================
export const bannerAPI = {
  getConfig: () => callBusinessApi('getBannerConfig'),
  updateConfig: (data) => callBusinessApi('updateBannerConfig', data),
  list: () => callBusinessApi('listBanners'),
  update: (data) => callBusinessApi('updateBanners', data),
}

// ==================== 配送路线 ====================
export const routeAPI = {
  list: () => callBusinessApi('listRoutes'),
  save: (data) => callBusinessApi('saveRouteConfig', data),
  delete: (id) => callBusinessApi('deleteRoute', { id }),
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
