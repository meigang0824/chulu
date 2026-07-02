/**
 * 数据服务层
 * 微信云开发模式
 */
import { productAPI, orderAPI, groupAPI, stockAPI, statsAPI, shopAPI, addressAPI, bannerAPI, notificationAPI } from './apiClient'
import { refreshAuthState, getAuthSession } from '@/utils/auth'
import { IMAGE_ASSETS, normalizeGroupImages, normalizeImageList, normalizeImageUrl, resolveImageList, resolveImageUrl } from '@/utils/image'
import { getDefaultBannerConfig, normalizeBannerConfig } from '@/utils/bannerConfig'
import { cachedRuntime, clearRuntimeCache } from '@/utils/runtimeCache'
import { formatDeadlineText } from '@/utils/format'

const STORAGE_KEYS = {
  identity: 'app_user_identity',
  portalMode: 'app_portal_mode'
}

const CACHE_TTL = {
  products: 8000,
  groups: 8000,
  groupProducts: 8000,
  banners: 30000,
  home: 6000,
  shop: 60000,
  dashboard: 6000
}

function clearProductRuntimeCache() {
  clearRuntimeCache('products:')
  clearRuntimeCache('product:')
  clearRuntimeCache('groupProducts:')
  clearRuntimeCache('home:')
  clearRuntimeCache('dashboard:')
}

function clearGroupRuntimeCache() {
  clearRuntimeCache('groups:')
  clearRuntimeCache('group:')
  clearRuntimeCache('groupProducts:')
  clearRuntimeCache('home:')
  clearRuntimeCache('dashboard:')
}

function clearBannerRuntimeCache() {
  clearRuntimeCache('banners:')
  clearRuntimeCache('home:')
}

function clearOrderRuntimeCache() {
  clearRuntimeCache('products:')
  clearRuntimeCache('groupProducts:')
  clearRuntimeCache('home:')
  clearRuntimeCache('dashboard:')
}

function authToken() {
  const session = getAuthSession()
  return session && session.token ? session.token : ''
}

function authCacheScope() {
  const token = authToken()
  return token ? token.slice(0, 16) : 'guest'
}

function bySort(a, b) {
  return Number(a.sort || 0) - Number(b.sort || 0)
}

function validRow(row = {}) {
  return row && !row._init && (row.id || row._id || row.orderNo)
}

function dateText(value, fallback = '') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function dateTimeText(value, fallback = '') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  const second = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function shortAddress(value = '') {
  return value.length > 24 ? `${value.slice(0, 24)}...` : value
}

function relativeTimeText(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const diff = Math.max(0, Date.now() - date.getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

function isToday(value) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const nowDate = new Date()
  return date.getFullYear() === nowDate.getFullYear() &&
    date.getMonth() === nowDate.getMonth() &&
    date.getDate() === nowDate.getDate()
}

function toDateOnly(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  const y = value.getFullYear()
  const m = `${value.getMonth() + 1}`.padStart(2, '0')
  const d = `${value.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateBoundary(value = '', endOfDay = false) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

function inDateRange(value, startDate = '', endDate = '') {
  if (!startDate && !endDate) return true
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return false
  const start = parseDateBoundary(startDate)
  const end = parseDateBoundary(endDate, true)
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function statusMeta(status = '', deliveryStatus = '') {
  if (status === 'pendingPayment') return { status: 'pendingPayment', statusText: '待支付', payStatusText: '待支付' }
  if (status === 'completed' || deliveryStatus === 'completed') return { status: 'completed', statusText: '已完成', payStatusText: '已付款' }
  if (status === 'delivering' || deliveryStatus === 'delivering') return { status: 'delivering', statusText: '已发货', payStatusText: '已付款' }
  if (status === 'cancelled') return { status: 'cancelled', statusText: '已取消', payStatusText: '已取消' }
  if (status === 'pendingDelivery' || deliveryStatus === 'pending' || status === 'paid') return { status: 'pendingDelivery', statusText: '待发货', payStatusText: '已付款' }
  return { status: status || 'pendingDelivery', statusText: '待发货', payStatusText: '已付款' }
}

function buildProgress(order) {
  if (order.status === 'pendingPayment') {
    return [
      { key: 'created', text: '订单已创建', subText: dateText(order.createdAt, order.createTime), done: true },
      { key: 'paid', text: '待支付', subText: '请完成微信支付', done: false, active: true },
      { key: 'stocking', text: '备货中', subText: '支付后开始制作', done: false },
      { key: 'delivery', text: '待发货', subText: order.deliveryTime || order.deliveryText || '等待打包发货', done: false }
    ]
  }
  if (order.status === 'cancelled') {
    return [
      { key: 'created', text: '下单成功', subText: dateText(order.createdAt, order.createTime), done: true },
      { key: 'paid', text: '已付款', subText: dateText(order.createdAt, order.createTime), done: true },
      { key: 'cancelled', text: '订单已取消', subText: dateText(order.cancelledAt, '库存已回补'), done: true, active: true }
    ]
  }
  const delivering = order.status === 'delivering'
  const completed = order.status === 'completed'
  return [
    { key: 'created', text: '下单成功', subText: dateText(order.createdAt, order.createTime), done: true },
    { key: 'paid', text: '已付款', subText: dateText(order.createdAt, order.createTime), done: true },
    { key: 'stocking', text: '备货中', subText: completed || delivering ? '备货完成' : '新鲜制作中', done: completed || delivering, active: !completed && !delivering },
    { key: 'delivery', text: completed ? '已完成' : delivering ? '已发货' : '待发货', subText: order.deliveryTime || order.deliveryText || '等待打包发货', done: completed, active: delivering }
  ]
}

function normalizeProduct(row = {}) {
  row = row || {}
  const rawLimit = Number(row.limit || 0)
  const limit = rawLimit > 0 ? rawLimit : 0
  const imageFileID = normalizeImageUrl(row.imageFileID || row.image, IMAGE_ASSETS.product)
  const bannerImageFileID = normalizeImageUrl(row.bannerImageFileID || row.bannerImage || row.image, imageFileID)
  const galleryFileIDs = normalizeImageList(row.galleryFileIDs || row.gallery, bannerImageFileID)
  const detail = Array.isArray(row.detail)
    ? row.detail.map(item => item && item.type === 'image'
      ? { ...item, contentFileID: normalizeImageUrl(item.contentFileID || item.content, bannerImageFileID), content: normalizeImageUrl(item.contentFileID || item.content, bannerImageFileID) }
      : item)
    : row.detail
  return {
    ...row,
    id: row.id || row._id,
    _id: row._id || row.id,
    image: imageFileID,
    imageFileID,
    bannerImage: bannerImageFileID,
    bannerImageFileID,
    gallery: galleryFileIDs,
    galleryFileIDs,
    detail,
    specs: Array.isArray(row.specs) ? row.specs : [],
    price: Number(row.price || 0),
    originPrice: Number(row.originPrice || 0),
    sold: Number(row.sold || 0),
    stock: Number(row.stock || 0),
    totalStock: Number(row.totalStock || row.stock || 0),
    limit
  }
}

function normalizeOrder(row = {}, productMap = {}) {
  row = row || {}
  const meta = statusMeta(row.status, row.deliveryStatus)
  const address = row.address || {}
  const items = (row.items || []).map(item => {
    const product = productMap[item.productId] || {}
    const imageFileID = normalizeImageUrl(item.imageFileID || item.image || product.imageFileID || product.image, IMAGE_ASSETS.product)
    return { ...item, image: imageFileID, imageFileID }
  })
  const deliveryText = row.deliveryStatus === 'completed'
    ? `${row.deliveryTime || '已送达'}`
    : row.deliveryStatus === 'delivering'
      ? `${row.deliveryTime || '已发货'}`
      : row.deliveryTime || '次日打包发货'

  return {
    id: row._id || row.orderNo || row.id,
    orderNo: row.orderNo || row._id || row.id,
    detailId: row.orderNo || row._id || row.id,
    status: meta.status,
    statusText: meta.statusText,
    payStatus: row.payStatus || 'paid',
    payStatusText: meta.payStatusText,
    customer: row.customer || address.receiver || '初炉用户',
    receiver: address.receiver || row.receiver || '初炉用户',
    phone: address.phone || row.phone || '',
    fullPhone: address.phone || row.fullPhone || '',
    address: address.address || row.address || '',
    shortAddress: shortAddress(address.address || row.address || ''),
    amount: Number(row.amount || row.payable || 0),
    productAmount: Number(row.productAmount || 0),
    deliveryFee: Number(row.deliveryFee || 0),
    discount: Number(row.discount || 0),
    payable: Number(row.payable || row.amount || 0),
    createdAt: row.createdAt || row.createDateTime || row.createTime || '',
    createTime: dateText(row.createdAt, row.createTime),
    createDateTime: dateTimeText(row.createdAt, row.createDateTime),
    payMethod: row.payMethod || '微信支付',
    deliveryTime: row.deliveryTime || '',
    deliveryText,
    fulfillmentMethod: row.fulfillmentMethod || row.shippingMethod || '快递发货',
    trackingNo: row.trackingNo || '',
    note: row.note || '无',
    refundStatus: row.refundStatus || '',
    refundType: row.refundType || '',
    refundNo: row.refundNo || '',
    refundAmount: Number(row.refundAmount || 0),
    refundReasonText: row.refundReasonText || '',
    refundError: row.refundError || '',
    refundErrorAt: row.refundErrorAt || '',
    refundCancelledAt: row.refundCancelledAt || '',
    avatar: row.avatar || '',
    avatarText: row.avatarText || '甜',
    buyerId: row.buyerId || row.userId || '',
    items,
    cancelledAt: row.cancelledAt || '',
    progress: buildProgress({ ...row, status: meta.status, deliveryText }),
    _openid: row._openid
  }
}

function normalizeAddress(row = {}) {
  const address = row.address || row.detail || [row.province, row.city, row.district, row.detail].filter(Boolean).join('')
  return {
    ...row,
    id: row.id || row._id,
    _id: row._id || row.id,
    address,
    detail: row.detail || address,
    tag: row.tag || '',
    note: row.note || '',
    isDefault: row.isDefault === true || row.isDefault === 1
  }
}

function buildActivities(orders = [], limit = 6) {
  const activities = orders.flatMap(order => {
    const name = order.buyerName || order.customer || order.receiver || '初炉用户'
    const displayName = String(name || '初炉用户')
    const maskedName = displayName.length > 1 ? `${displayName.slice(0, 1)}*` : displayName
    return (order.items || []).map((item, index) => ({
      id: `${order.id || order.orderNo}_${item.productId || index}`,
      customer: maskedName,
      buyerName: displayName,
      avatar: order.avatar || '',
      avatarText: order.avatarText || displayName.slice(0, 1) || '甜',
      text: `${relativeTimeText(order.createdAt || order.createDateTime)}团了 ${item.count}份`,
      productId: item.productId,
      productName: item.name,
      timeText: relativeTimeText(order.createdAt || order.createDateTime)
    }))
  })
  return limit ? activities.slice(0, limit) : activities
}

function normalizeBannerData(config = {}) {
  const normalized = normalizeBannerConfig(config)
  return {
    ...normalized,
    banners: (normalized.banners || []).map(item => ({
      ...item,
      image: normalizeImageUrl(item.imageFileID || item.image, IMAGE_ASSETS.banner),
      imageFileID: normalizeImageUrl(item.imageFileID || item.image, IMAGE_ASSETS.banner)
    }))
  }
}

function extractGroupProducts(groups = []) {
  return (groups || []).flatMap(group => {
    const groupId = group.id || group._id || group.docId || group.groupId || ''
    const products = Array.isArray(group.products) ? group.products : []
    return products.map((item, index) => ({
      ...item,
      id: item.productId || item.id,
      productId: item.productId || item.id,
      deadline: formatDeadlineText(item.deadlineAt || group.deadlineAt, item.deadline || group.deadline),
      deadlineAt: item.deadlineAt || group.deadlineAt,
      deliveryTime: item.deliveryTime || group.deliveryTime,
      deliveryRange: item.deliveryRange || group.deliveryRange,
      groupId,
      groupName: group.name || group.title || '',
      sort: Number(item.sort || index + 1)
    }))
  }).sort(bySort)
}

function mergeGroupProductsWithLiveProducts(groupProducts = [], liveProducts = []) {
  const productMap = (liveProducts || []).reduce((map, product) => {
    const id = product && (product.id || product._id || product.productId)
    if (id) map[id] = product
    return map
  }, {})
  return (groupProducts || []).map(item => {
    const live = productMap[item.productId || item.id] || {}
    return {
      ...live,
      ...item,
      sold: Number(live.sold !== undefined ? live.sold : item.sold || 0),
      stock: Number(live.stock !== undefined ? live.stock : item.stock || 0),
      totalStock: Number(live.totalStock !== undefined ? live.totalStock : item.totalStock || item.stock || 0),
      image: item.image || live.image,
      imageFileID: item.imageFileID || live.imageFileID || live.image,
      bannerImage: item.bannerImage || live.bannerImage,
      bannerImageFileID: item.bannerImageFileID || live.bannerImageFileID || live.bannerImage
    }
  })
}

function productIdentity(item = {}) {
  return String(item.productId || item.id || item._id || item.docId || '')
}

function productDeadlineTime(item = {}) {
  const date = new Date(item.deadlineAt || '')
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function shouldPreferProduct(next = {}, current = {}) {
  const nextDeadline = productDeadlineTime(next)
  const currentDeadline = productDeadlineTime(current)
  if (nextDeadline && currentDeadline && nextDeadline !== currentDeadline) return nextDeadline < currentDeadline
  if (nextDeadline && !currentDeadline) return true
  if (!nextDeadline && currentDeadline) return false
  return Number(next.sort || 0) < Number(current.sort || 0)
}

function dedupeProductsById(products = []) {
  const map = {}
  ;(products || []).forEach(item => {
    const key = productIdentity(item)
    if (!key) return
    if (!map[key] || shouldPreferProduct(item, map[key])) map[key] = item
  })
  return Object.values(map).sort((a, b) => {
    const deadlineDiff = productDeadlineTime(a) - productDeadlineTime(b)
    if (deadlineDiff) return deadlineDiff
    return bySort(a, b)
  })
}

function buildGroupSections(groups = [], liveProducts = []) {
  return (groups || []).map((group, index) => {
    const id = group.id || group._id || group.docId || group.groupId || ''
    const title = group.title || group.name || `团购 ${index + 1}`
    const products = mergeGroupProductsWithLiveProducts(extractGroupProducts([group]), liveProducts)
    return {
      ...group,
      id,
      _id: group._id || id,
      title,
      name: group.name || title,
      deadline: formatDeadlineText(group.deadlineAt, group.deadline || ''),
      deadlineAt: group.deadlineAt || '',
      deliveryTime: group.deliveryTime || '',
      deliveryRange: group.deliveryRange || '',
      products,
      productCount: products.length,
      sort: Number(group.sort || index + 1)
    }
  }).filter(group => group.productCount > 0)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
}

function groupParticipantCount(group = {}, orders = []) {
  const groupId = String(group.id || group._id || group.docId || group.groupId || '')
  const productIds = new Set((group.products || [])
    .map(item => String(item.productId || item.id || item._id || ''))
    .filter(Boolean))
  const buyers = new Set()

  ;(orders || []).forEach(order => {
    if (!order || order.status === 'cancelled' || order.payStatus === 'pending') return
    const items = Array.isArray(order.items) ? order.items : []
    const matched = items.some(item => {
      const itemGroupId = String(item.groupId || '')
      const itemProductId = String(item.productId || item.id || item._id || '')
      return (groupId && itemGroupId === groupId) || (itemProductId && productIds.has(itemProductId))
    })
    if (!matched) return
    const buyerKey = order.buyerId || order._openid || order.fullPhone || order.phone || order.orderNo || order.id
    if (buyerKey) buyers.add(String(buyerKey))
  })

  return buyers.size
}

async function hydrateProductImages(product) {
  const imageFileID = product.imageFileID || product.image
  const bannerImageFileID = product.bannerImageFileID || product.bannerImage || imageFileID
  const galleryFileIDs = product.galleryFileIDs || product.gallery
  const [image, bannerImage, gallery] = await Promise.all([
    resolveImageUrl(imageFileID, IMAGE_ASSETS.product),
    resolveImageUrl(bannerImageFileID, IMAGE_ASSETS.product),
    resolveImageList(galleryFileIDs, bannerImageFileID)
  ])
  const detail = Array.isArray(product.detail)
    ? await Promise.all(product.detail.map(async item => {
        if (!item || item.type !== 'image') return item
        const contentFileID = normalizeImageUrl(item.contentFileID || item.content, bannerImageFileID)
        return { ...item, contentFileID, content: await resolveImageUrl(contentFileID, bannerImageFileID) }
      }))
    : product.detail
  return { ...product, image, bannerImage, gallery, detail, imageFileID, bannerImageFileID, galleryFileIDs }
}

async function hydrateOrderImages(order) {
  const items = await Promise.all((order.items || []).map(async item => {
    const imageFileID = item.imageFileID || item.image
    return { ...item, imageFileID, image: await resolveImageUrl(imageFileID, IMAGE_ASSETS.product) }
  }))
  return { ...order, items }
}

export async function hydrateGroupImages(group = {}) {
  const normalized = normalizeGroupImages(group)
  const products = await Promise.all((normalized.products || []).map(async item => {
    const [image, bannerImage, gallery] = await Promise.all([
      resolveImageUrl(item.imageFileID, IMAGE_ASSETS.product),
      resolveImageUrl(item.bannerImageFileID, IMAGE_ASSETS.product),
      resolveImageList(item.galleryFileIDs, item.bannerImageFileID)
    ])
    return { ...item, image, bannerImage, gallery }
  }))
  return { ...normalized, products }
}

async function hydrateShopConfig(config) {
  const logoFileID = config.logoFileID || config.logo
  const adminHero = config.adminHero || {}
  const heroImageFileID = adminHero.imageFileID || adminHero.image
  const [logo, heroImage] = await Promise.all([
    resolveImageUrl(logoFileID, IMAGE_ASSETS.logo),
    resolveImageUrl(heroImageFileID, IMAGE_ASSETS.banner)
  ])
  return {
    ...config,
    logo,
    logoFileID,
    adminHero: { ...adminHero, image: heroImage, imageFileID: heroImageFileID }
  }
}

async function hydrateBannerConfigImages(config) {
  const normalized = normalizeBannerData(config)
  const banners = await Promise.all((normalized.banners || []).map(async item => ({
    ...item,
    image: await resolveImageUrl(item.imageFileID || item.image, IMAGE_ASSETS.banner)
  })))
  return { ...normalized, banners }
}

// ==================== 商品 ====================
export async function getProducts() {
  return cachedRuntime('products:active', CACHE_TTL.products, async () => {
    const rows = await productAPI.list({ status: 'active' })
    return Promise.all((rows || []).filter(validRow).map(row => hydrateProductImages(normalizeProduct(row))))
  })
}

export async function getAdminProducts() {
  const rows = await productAPI.list({}, authToken())
  return Promise.all((rows || []).filter(validRow).map(row => hydrateProductImages(normalizeProduct(row))))
}

export async function getProductById(id) {
  return cachedRuntime(`product:${id}`, CACHE_TTL.products, async () => {
    const row = await productAPI.get(id)
    return row ? hydrateProductImages(normalizeProduct(row)) : null
  })
}

export async function getAdminProductById(id) {
  const row = await productAPI.get(id, authToken())
  if (row) return hydrateProductImages(normalizeProduct(row))
  const products = await getAdminProducts()
  return products.find(item => item.id === id || item._id === id || item.docId === id) || null
}

export async function getCategories() {
  const fallback = [
    { key: 'all', text: '全部' },
    { key: 'cake', text: '蛋糕甜点' },
    { key: 'bread', text: '面包吐司' },
    { key: 'snack', text: '下午茶' }
  ]
  try {
    const config = await getShopConfig()
    const categories = Array.isArray(config.categories) && config.categories.length ? config.categories : fallback.slice(1)
    return [fallback[0], ...categories.filter(item => item && item.key !== 'all')]
  } catch {
    return fallback
  }
}

export async function saveProduct(product) {
  clearProductRuntimeCache()
  if (product.id) {
    return productAPI.update(product.id, product, authToken())
  }
  return productAPI.create(product, authToken())
}

export async function saveGroup(group) {
  clearGroupRuntimeCache()
  if (group.id) return groupAPI.update(group.id, group, authToken())
  return groupAPI.create(group, authToken())
}

export async function getActiveGroups() {
  return cachedRuntime('groups:active', CACHE_TTL.groups, async () => {
    const groups = await groupAPI.list({ status: 'active' })
    return Promise.all((groups || []).filter(validRow).map(hydrateGroupImages))
  })
}

export async function getGroupById(id, admin = false) {
  const loader = async () => {
    const row = await groupAPI.get(id, admin ? authToken() : '')
    return row ? hydrateGroupImages(row) : null
  }
  if (admin) return loader()
  return cachedRuntime(`group:${id}`, CACHE_TTL.groups, loader)
}

export async function getGroupProducts(groupId = '') {
  return cachedRuntime(`groupProducts:${groupId || 'all'}`, CACHE_TTL.groupProducts, async () => {
    const [groups, liveProducts] = await Promise.all([
      groupId
        ? getGroupById(groupId).then(group => [group].filter(Boolean))
        : getActiveGroups(),
      getProducts().catch(() => [])
    ])
    return dedupeProductsById(mergeGroupProductsWithLiveProducts(extractGroupProducts(groups), liveProducts))
  })
}

export async function updateProductStatus(productId, status) {
  clearProductRuntimeCache()
  return productAPI.update(productId, { status }, authToken())
}

export async function deleteProduct(productId) {
  clearProductRuntimeCache()
  return productAPI.delete(productId, authToken())
}

export async function getBannerConfigFromCloud(force = false) {
  if (force) clearBannerRuntimeCache()
  return cachedRuntime('banners:config', CACHE_TTL.banners, async () => {
    try {
      return normalizeBannerData(await bannerAPI.getConfig())
    } catch {
      return normalizeBannerData(getDefaultBannerConfig())
    }
  })
}

export async function getDisplayBannerConfigFromCloud(force = false) {
  if (force) clearBannerRuntimeCache()
  return cachedRuntime('banners:display', CACHE_TTL.banners, async () => hydrateBannerConfigImages(await getBannerConfigFromCloud(force)))
}

// ==================== 首页 ====================
export async function getHomeData() {
  return cachedRuntime(`home:data:${authCacheScope()}`, CACHE_TTL.home, async () => {
    try {
      const [orders, bannerConfig, activeGroups, liveProducts] = await Promise.all([
        orderAPI.list({}, authToken()).catch(() => []),
        getBannerConfigFromCloud(),
        getActiveGroups().catch(() => []),
        getProducts().catch(() => [])
      ])

      const normalizedGroups = activeGroups || []
      const groupSections = buildGroupSections(normalizedGroups, liveProducts)
      const ordersList = await Promise.all((orders || []).filter(validRow).map(o => hydrateOrderImages(normalizeOrder(o))))
      const groupSectionsWithStats = groupSections.map(group => ({
        ...group,
        participantCount: groupParticipantCount(group, ordersList)
      }))
      const displayProducts = dedupeProductsById(groupSectionsWithStats.flatMap(group => group.products || []))
      const displayBannerConfig = await hydrateBannerConfigImages(bannerConfig)
      const currentGroup = groupSectionsWithStats[0]

      return {
        source: 'cloud',
        bannerSettings: displayBannerConfig.settings,
        banners: displayBannerConfig.banners,
        activeProductCount: displayProducts.length,
        products: displayProducts,
        groups: groupSectionsWithStats,
        groupId: currentGroup && currentGroup.id,
        groupTitle: currentGroup && (currentGroup.title || currentGroup.name),
        groupDeadline: currentGroup && currentGroup.deadline,
        groupDeadlineAt: currentGroup && currentGroup.deadlineAt,
        activities: buildActivities(ordersList, 6)
      }
    } catch {
      const displayBannerConfig = await hydrateBannerConfigImages(getDefaultBannerConfig())
      return {
        source: 'fallback',
        bannerSettings: displayBannerConfig.settings,
        banners: displayBannerConfig.banners,
        activeProductCount: 0,
        products: [],
        groups: [],
        activities: []
      }
    }
  })
}

// ==================== 订单 ====================
export async function createOrder(payload) {
  const session = getAuthSession()
  const user = (session && session.user) || {}
  const buyerId = user.id || payload.buyerId || ''
  const result = await orderAPI.create({ ...payload, buyerId }, authToken())
  clearOrderRuntimeCache()
  return result
}

export async function cancelBuyerOrder(orderId) {
  const result = await orderAPI.createRefund({
    orderId,
    type: 'cancelOrder',
    refundType: 'cancelOrder',
    reason: 'cancel_order',
    reasonText: '申请取消订单',
    refundDesc: '用户申请取消订单，待店长同意后退款'
  }, authToken())
  clearOrderRuntimeCache()
  return result
}

export async function syncPaymentStatus(orderId) {
  return orderAPI.syncPaymentStatus(orderId, authToken())
}

export async function cancelPendingPaymentOrder(orderId) {
  const result = await orderAPI.cancelPendingPayment(orderId, authToken())
  clearOrderRuntimeCache()
  return result
}

export async function getBuyerOrders(status = 'all') {
  try {
    const session = getAuthSession()
    const buyerId = session && session.user && session.user.id
    const where = status === 'all' ? {} : { status }
    if (buyerId) where.buyerId = buyerId
    const [rows, products] = await Promise.all([
      orderAPI.list(where, authToken()),
      getProducts(),
    ])
    const productMap = products.reduce((map, item) => { map[item.id] = item; return map }, {})
    return Promise.all((rows || []).filter(validRow).map(item => hydrateOrderImages(normalizeOrder(item, productMap))))
  } catch {
    return []
  }
}

export async function getBuyerOrderById(id) {
  try {
    const row = await orderAPI.get(id, authToken())
    const products = await getProducts()
    const productMap = products.reduce((map, item) => { map[item.id] = item; return map }, {})
    return hydrateOrderImages(normalizeOrder(row, productMap))
  } catch {
    return null
  }
}

export async function getAdminOrders(status = 'all') {
  try {
    const [rows, products] = await Promise.all([
      orderAPI.list({}, authToken()),
      getProducts(),
    ])
    const productMap = products.reduce((map, item) => { map[item.id] = item; return map }, {})
    const normalized = await Promise.all((rows || []).filter(validRow).map(item => hydrateOrderImages(normalizeOrder(item, productMap))))
    return status === 'all' ? normalized : normalized.filter(item => item.status === status || item.payStatus === status)
  } catch {
    return []
  }
}

export async function getAdminOrderById(id) {
  const orders = await getAdminOrders('all')
  return orders.find(item => item.id === id || item.orderNo === id || item.detailId === id) || null
}

export async function updateOrderStatus(orderId, status) {
  const result = await orderAPI.updateStatus(orderId, status, authToken())
  clearOrderRuntimeCache()
  return result
}

export async function getBuyerActivities(productId = '', limit = 6) {
  const orders = await orderAPI.list({}, authToken()).catch(() => [])
  const normalized = await Promise.all((orders || []).map(o => hydrateOrderImages(normalizeOrder(o))))
  const activities = buildActivities(normalized, 0).filter(item => !productId || item.productId === productId)
  return limit ? activities.slice(0, limit) : activities
}

// ==================== 地址 ====================
export async function getDefaultAddress() {
  try {
    const addresses = await getAddresses()
    return addresses.find(item => item.isDefault) || addresses[0] || null
  } catch {
    return null
  }
}

export async function getAddresses() {
  try {
    const userId = (getAuthSession() && getAuthSession().user && getAuthSession().user.id) || 'buyer001'
    const rows = await addressAPI.list(userId, authToken())
    return (rows || []).map(normalizeAddress)
  } catch {
    return []
  }
}

export async function saveAddress(address) {
  const userId = (getAuthSession() && getAuthSession().user && getAuthSession().user.id) || 'buyer001'
  const id = address.id || address._id
  const data = { ...address, id, userId }
  if (id) {
    return addressAPI.update(id, data, authToken())
  }
  return addressAPI.create(data, authToken())
}

export async function setDefaultAddress(id) {
  return addressAPI.update(id, { isDefault: true }, authToken())
}

export async function deleteAddress(id) {
  return addressAPI.delete(id, authToken())
}

export async function submitRefundRequest(payload) {
  const result = await orderAPI.createRefund(payload, authToken())
  clearOrderRuntimeCache()
  return result
}

export async function cancelRefundRequest(orderId) {
  const result = await orderAPI.cancelRefundRequest({ orderId }, authToken())
  clearOrderRuntimeCache()
  return result
}

export async function handleRefundRequest(orderId, status, remark = '') {
  const result = await orderAPI.updateRefundStatus({ orderId, status, remark }, authToken())
  clearOrderRuntimeCache()
  return result
}

// ==================== 店铺配置 ====================
const DEFAULT_SHOP_CONFIG = {
  name: '初炉',
  bakeryName: '初炉烘焙团购',
  subtitle: '新鲜烘焙，每日现做',
  slogan: '新鲜烘焙，每日现做',
  bakeryTag: '每日新鲜 · 团购更甜蜜',
  logo: IMAGE_ASSETS.logo,
  rating: 4.9,
  totalSales: 1286,
  memberCount: 328,
  openTime: '09:00-21:00',
  phone: '400-888-2025',
  address: '上海市徐汇区甜品路 88 号',
  notice: '',
  assurance: '严选食材，新鲜现做，冷链打包，安心到家。',
  deliveryRange: '统一配送',
  deliveryRangeDetail: '满额后统一配送，按团购截单后打包发货。',
  deliveryTime: '次日打包发货',
  fulfillmentMethods: ['统一配送'],
  customerService: '09:00–21:00',
  orderTemplateId: '',
  afterSalesTemplateId: '',
  checkout: {
    deliveryTime: '次日打包发货',
    fulfillmentMethod: '统一配送',
    notePlaceholder: '口味、偏好或建议等(选填)',
    serviceText: '新鲜现做，按单打包发货，感谢等待～',
    payText: '微信支付',
    deliveryFee: 0,
    minimumOrderAmount: 88,
    freeShippingAmount: 88,
    groupDiscount: 0
  },
  adminHero: { image: IMAGE_ASSETS.banner },
  serviceBadges: [{ text: '严选食材' }, { text: '新鲜现做' }, { text: '明日配送' }],
  operationTips: ['22:00 前完成截单统计', '按快递/自提/同城分拣订单', '及时同步售罄商品和发货状态'],
  buyerAddress: null,
  buyerTabs: null,
}

function normalizeShopConfig(config = {}) {
  const source = config || {}
  const merged = {
    ...DEFAULT_SHOP_CONFIG,
    ...source,
    checkout: { ...DEFAULT_SHOP_CONFIG.checkout, ...(source.checkout || {}) },
    adminHero: { ...DEFAULT_SHOP_CONFIG.adminHero, ...(source.adminHero || {}) },
    serviceBadges: (source.serviceBadges && source.serviceBadges.length) ? source.serviceBadges : DEFAULT_SHOP_CONFIG.serviceBadges,
    operationTips: (source.operationTips && source.operationTips.length) ? source.operationTips : DEFAULT_SHOP_CONFIG.operationTips,
  }
  const logoFileID = normalizeImageUrl(merged.logoFileID || merged.logo, DEFAULT_SHOP_CONFIG.logo)
  const adminHeroImageFileID = normalizeImageUrl(merged.adminHero && (merged.adminHero.imageFileID || merged.adminHero.image), DEFAULT_SHOP_CONFIG.adminHero.image)
  const rawMinimumOrderAmount = merged.checkout.minimumOrderAmount !== undefined && merged.checkout.minimumOrderAmount !== ''
    ? merged.checkout.minimumOrderAmount
    : merged.checkout.freeShippingAmount !== undefined && merged.checkout.freeShippingAmount !== ''
      ? merged.checkout.freeShippingAmount
      : DEFAULT_SHOP_CONFIG.checkout.minimumOrderAmount
  const minimumOrderAmount = Number(rawMinimumOrderAmount || 0)
  return {
    ...merged,
    checkout: {
      ...merged.checkout,
      minimumOrderAmount,
      freeShippingAmount: Number(merged.checkout.freeShippingAmount || minimumOrderAmount)
    },
    logo: logoFileID,
    logoFileID,
    adminHero: {
      ...merged.adminHero,
      image: adminHeroImageFileID,
      imageFileID: adminHeroImageFileID
    },
  }
}

export async function getShopConfig() {
  return cachedRuntime('shop:config', CACHE_TTL.shop, async () => {
    try {
      return hydrateShopConfig(normalizeShopConfig(await shopAPI.get()))
    } catch {
      return hydrateShopConfig(normalizeShopConfig(DEFAULT_SHOP_CONFIG))
    }
  })
}

export async function saveShopConfigToCloud(config) {
  clearRuntimeCache('shop:')
  clearRuntimeCache('categories:')
  clearRuntimeCache('dashboard:')
  await shopAPI.update({
    ...config,
    logo: config.logoFileID || normalizeImageUrl(config.logo, DEFAULT_SHOP_CONFIG.logo),
    adminHero: {
      ...(config.adminHero || {}),
      image: (config.adminHero && config.adminHero.imageFileID) || normalizeImageUrl(config.adminHero && config.adminHero.image, DEFAULT_SHOP_CONFIG.adminHero.image)
    }
  }, authToken())
  return { ok: true }
}

export async function getAdminSubscriptionStatus() {
  const session = getAuthSession()
  if (!session || !session.token) return { enabled: false, orderTemplateId: '', afterSalesTemplateId: '', message: '请先登录店长账号' }
  return notificationAPI.getAdminSubscriptionStatus(session.token)
}

export async function requestAdminAfterSalesSubscribe(statusOverride = null) {
  const session = getAuthSession()
  if (!session || !session.token) throw new Error('请先登录店长账号')
  const status = statusOverride || await notificationAPI.getAdminSubscriptionStatus(session.token)
  const templates = [
    { type: 'order', templateId: status.orderTemplateId || '' },
    { type: 'afterSales', templateId: status.afterSalesTemplateId || status.templateId || '' }
  ].filter(item => item.templateId)
  if (!templates.length) throw new Error('请先在门店设置中配置下单或售后订阅模板ID')
  const requestSubscribeMessage = typeof wx !== 'undefined' && typeof wx.requestSubscribeMessage === 'function'
    ? wx.requestSubscribeMessage.bind(wx)
    : typeof uni.requestSubscribeMessage === 'function'
      ? uni.requestSubscribeMessage.bind(uni)
      : null
  if (!requestSubscribeMessage) {
    throw new Error('当前环境不支持订阅消息，请在微信小程序中操作')
  }
  const result = await new Promise((resolve, reject) => {
    requestSubscribeMessage({
      tmplIds: templates.map(item => item.templateId),
      success: resolve,
      fail: err => {
        const message = err && err.errMsg
          ? `微信订阅授权失败：${err.errMsg}`
          : '微信订阅授权失败，请确认模板ID属于当前小程序'
        reject(new Error(message))
      }
    })
  })
  const subscriptions = templates.map(item => ({
    ...item,
    accepted: result && result[item.templateId] === 'accept'
  }))
  if (!subscriptions.some(item => item.accepted)) {
    const rejected = subscriptions.some(item => result && result[item.templateId] === 'reject')
    throw new Error(rejected ? '你没有勾选允许通知，暂时无法发送微信服务通知' : '未授权消息提醒，暂时无法发送微信服务通知')
  }
  return notificationAPI.saveAdminSubscription({ subscriptions }, session.token)
}

export async function getBuyerProfileSummary() {
  const orders = await getBuyerOrders('all')
  return {
    totalOrders: orders.length,
    pendingDelivery: orders.filter(item => item.status === 'pendingDelivery' || item.status === 'paid').length,
    completed: orders.filter(item => item.status === 'completed').length
  }
}

export async function getShopAboutData() {
  const config = await getShopConfig()
  return {
    ...config,
    serviceBadges: config.serviceBadges || [],
    operationTips: config.operationTips || [],
    notice: config.notice || '',
    assurance: config.assurance || ''
  }
}

// ==================== 团购 ====================
export async function saveBannerConfigToCloud(config) {
  clearBannerRuntimeCache()
  const normalized = normalizeBannerData(config)
  const saved = await bannerAPI.updateConfig(normalized, authToken())
  return normalizeBannerData(saved || normalized)
}

// ==================== 备货 ====================
export async function getStockList() {
  try {
    const rows = await stockAPI.list({}, authToken())
    return rows || []
  } catch {
    return []
  }
}

export async function getStockData() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    await stockAPI.generate(today, authToken()).catch(() => {})
    const rows = await stockAPI.list({ date: today }, authToken())
    const products = await getProducts()
    const productMap = products.reduce((map, item) => { map[item.id] = item; return map }, {})

    const listData = await Promise.all((rows || []).map(async item => {
      const product = productMap[item.productId || item.id] || {}
      const imageFileID = normalizeImageUrl(item.imageFileID || item.image || product.imageFileID || product.image, IMAGE_ASSETS.product)
      return {
        ...item,
        id: item.productId || item.id,
        imageFileID,
        image: await resolveImageUrl(imageFileID, IMAGE_ASSETS.product),
        priority: item.priority || '正常',
        status: item.status === 'completed' ? '已备齐' : item.status === 'preparing' ? '制作中' : '待备货'
      }
    }))

    return {
      stockList: listData,
      stockSummary: {
        date: today,
        dateText: `${today}（今天）`,
        skuCount: listData.length,
        planTotal: listData.reduce((sum, item) => sum + Number(item.planCount || item.totalQuantity || 0), 0),
        updatedAt: dateText(new Date()),
        autoUpdateText: '实时同步云端数据'
      }
    }
  } catch {
    return {
      stockList: [],
      stockSummary: {
        skuCount: 0,
        planTotal: 0,
        dateText: `${new Date().toISOString().slice(0, 10)}（今天）`,
        updatedAt: dateText(new Date()),
        autoUpdateText: '后端未返回备货数据'
      }
    }
  }
}

export async function updateStockItem(productId, patch) {
  const result = await stockAPI.update(productId, patch, authToken())
  clearRuntimeCache('dashboard:')
  return result
}

// ==================== 管理面板 ====================
export async function getAdminDashboardData() {
  return cachedRuntime(`dashboard:data:${authCacheScope()}`, CACHE_TTL.dashboard, async () => {
    const [orders, stockData, activeGroups, liveProducts] = await Promise.all([
      getAdminOrders('all'),
      getStockData(),
      getActiveGroups().catch(() => []),
      getProducts().catch(() => [])
    ])

    const todayOrders = orders.filter(item => isToday(item.createdAt || item.createDateTime || item.createTime))
    const todaySales = todayOrders.reduce((sum, item) => sum + Number(item.payable || 0), 0)
    const groupSections = buildGroupSections(activeGroups || [], liveProducts)
    const groupProducts = dedupeProductsById(mergeGroupProductsWithLiveProducts(extractGroupProducts(activeGroups), liveProducts))
    const refundOrders = orders.filter(item => item.refundStatus === 'pending')
    const cancelledOrders = orders.filter(item => item.status === 'cancelled')
    const afterSalesCount = refundOrders.length

    return {
      orders,
      refundOrders,
      cancelledOrders,
      products: groupProducts,
      groups: groupSections,
      dashboardStats: [
        { key: 'orders', label: '今日订单', value: todayOrders.length, unit: '单', trend: '', trendType: 'up', icon: 'receipt', theme: 'red' },
        { key: 'sales', label: '今日销售额', value: todaySales.toFixed(2), unit: '元', trend: '', trendType: 'up', icon: 'yuan', theme: 'orange' },
        { key: 'delivery', label: '待发货', value: orders.filter(item => item.status === 'pendingDelivery' || item.status === 'paid').length, unit: '单', trend: '', trendType: 'up', icon: 'truck', theme: 'blue' },
        { key: 'afterSales', label: '售后/取消', value: afterSalesCount, unit: '单', trend: '', trendType: 'up', icon: 'receipt', theme: 'orange' }
      ],
      stockSummary: stockData.stockSummary
    }
  })
}

export async function getAdminStatsData(params = {}) {
  const [orders, products] = await Promise.all([getAdminOrders('all'), getAdminProducts()])
  const startDate = params.startDate || ''
  const endDate = params.endDate || ''
  const rangeOrders = orders.filter(item => inDateRange(item.createdAt || item.createDateTime || item.createTime, startDate, endDate))
  const payableOrders = rangeOrders.filter(item => item.payStatus === 'paid' && item.status !== 'cancelled')
  const totalSales = payableOrders.reduce((sum, item) => sum + Number(item.payable || item.amount || 0), 0)
  const completedSales = payableOrders
    .filter(item => item.status === 'completed')
    .reduce((sum, item) => sum + Number(item.payable || item.amount || 0), 0)
  const activeProducts = products.filter(item => item.status === 'active').length
  const rangeSoldMap = rangeOrders.reduce((map, order) => {
    if (order.status === 'cancelled') return map
    ;(order.items || []).forEach(item => {
      if (!item.productId) return
      map[item.productId] = (map[item.productId] || 0) + Number(item.count || 1)
    })
    return map
  }, {})
  const topProducts = [...products]
    .map(item => ({ ...item, sold: Number(rangeSoldMap[item.id] || 0), totalSold: Number(item.sold || 0) }))
    .filter(item => Number(item.sold || 0) > 0)
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
    .slice(0, 5)
  return {
    range: {
      startDate,
      endDate,
      generatedAt: dateTimeText(new Date())
    },
    overview: [
      { key: 'sales', label: '销售额', value: totalSales.toFixed(2), unit: '元' },
      { key: 'orders', label: '订单数', value: rangeOrders.length, unit: '单' },
      { key: 'completed', label: '已完成销售额', value: completedSales.toFixed(2), unit: '元' },
      { key: 'products', label: '上架商品数', value: activeProducts, unit: '个' }
    ],
    statusStats: [
      { key: 'paid', label: '待发货', value: rangeOrders.filter(item => ['paid', 'pendingDelivery'].includes(item.status)).length },
      { key: 'delivering', label: '已发货', value: rangeOrders.filter(item => item.status === 'delivering').length },
      { key: 'completed', label: '已完成', value: rangeOrders.filter(item => item.status === 'completed').length },
      { key: 'cancelled', label: '已取消', value: rangeOrders.filter(item => item.status === 'cancelled').length }
    ],
    topProducts
  }
}

export async function getDeliveryData() {
  const orders = await getAdminOrders('all')
  const listData = orders
    .filter(item => ['paid', 'pendingDelivery', 'delivering', 'completed'].includes(item.status))
    .map((item, index) => ({
      ...item,
      routeNo: index + 1,
      checked: false,
      planTime: item.deliveryTime,
      canNavigate: true,
      canContact: item.status !== 'completed',
      statusText: item.status === 'paid' ? '待发货' : item.status === 'pendingDelivery' ? '待发货' : item.status === 'delivering' ? '已发货' : item.statusText,
      status: item.status === 'paid' ? 'pendingDelivery' : item.status
    }))

  return {
    deliveryOrders: listData,
    deliveryTabs: [
      { key: 'all', text: '全部', count: listData.length },
      { key: 'pendingDelivery', text: '待发货', count: listData.filter(item => item.status === 'pendingDelivery').length },
      { key: 'delivering', text: '已发货', count: listData.filter(item => item.status === 'delivering').length },
      { key: 'completed', text: '已完成', count: listData.filter(item => item.status === 'completed').length }
    ],
    deliveryOverview: {
      shopName: '初炉',
      pendingCount: listData.filter(item => item.status === 'pendingDelivery').length,
      planTime: '次日打包发货',
      sortText: '按下单顺序'
    }
  }
}

// ==================== 用户身份 ====================
export async function getUserIdentity(force = false) {
  if (!force) {
    const cached = uni.getStorageSync(STORAGE_KEYS.identity)
    if (cached && typeof cached.isLoggedIn === 'boolean' && typeof cached.isAdmin === 'boolean') return cached
  }
  const session = getAuthSession()
  if (!session) {
    const guest = { isLoggedIn: false, isGuest: false, isAdmin: false, role: 'guest', user: null, token: '' }
    uni.setStorageSync(STORAGE_KEYS.identity, guest)
    return guest
  }
  // 游客身份
  if (session.role === 'guest' || session.isGuest) {
    const guestIdentity = {
      isLoggedIn: true,
      isGuest: true,
      isAdmin: false,
      role: 'guest',
      user: session.user || { displayName: '游客', avatarText: '游' },
      token: session.token
    }
    uni.setStorageSync(STORAGE_KEYS.identity, guestIdentity)
    return guestIdentity
  }
  const remote = await refreshAuthState().catch(() => null)
  const identity = remote && remote.isLoggedIn
    ? {
        isLoggedIn: true,
        isGuest: false,
        isAdmin: !!remote.isAdmin,
        role: remote.role || session.role || 'buyer',
        adminProfile: remote.adminProfile || (remote.isAdmin ? { id: remote.user && remote.user.id, role: remote.role, name: remote.user && remote.user.displayName, status: 'active' } : null),
        user: remote.user || session.user,
        token: session.token
      }
    : {
        isLoggedIn: true,
        isGuest: false,
        isAdmin: !!session.isAdmin,
        role: session.role || 'buyer',
        adminProfile: session.isAdmin ? { id: session.user && session.user.id, role: session.role, name: session.user && session.user.displayName, status: 'active' } : null,
        user: session.user,
        token: session.token
      }
  uni.setStorageSync(STORAGE_KEYS.identity, identity)
  return identity
}

export function getPortalMode() {
  return uni.getStorageSync(STORAGE_KEYS.portalMode) || 'buyer'
}

export function setPortalMode(mode = 'buyer') {
  const nextMode = mode === 'admin' ? 'admin' : 'buyer'
  uni.setStorageSync(STORAGE_KEYS.portalMode, nextMode)
  return nextMode
}

export async function shouldAutoEnterAdmin() {
  const identity = await getUserIdentity()
  return identity.isLoggedIn && identity.isAdmin && getPortalMode() === 'admin'
}

export async function adminAction(action, payload = {}) {
  switch (action) {
    case 'getDashboardData':
      return { orders: await getAdminOrders('all') }
    case 'getAdminOrders':
      return { orders: await getAdminOrders('all') }
    case 'getAdminProducts':
      return { products: await getAdminProducts() }
    case 'getStockData':
      return await getStockData()
    case 'saveProduct':
      return saveProduct(payload)
    case 'updateProductStatus':
      return updateProductStatus(payload.productId, payload.status)
    case 'updateOrderStatus':
      return updateOrderStatus(payload.orderId, payload.status)
    case 'updateStockItem':
      return updateStockItem(payload.productId, payload.patch)
    case 'saveBannerConfig':
      return saveBannerConfigToCloud(payload)
    case 'saveShopConfig':
      return saveShopConfigToCloud(payload)
    case 'getIdentity':
      return getUserIdentity(true)
    default:
      return { ok: true }
  }
}

export async function setupCloudDatabase() {
  return { ok: true, message: '数据库已就绪' }
}

// ==================== 地址管理 ====================
export async function getUserAddresses(userId) {
  try {
    return await addressAPI.list(userId, authToken())
  } catch {
    return []
  }
}

export async function getAddressById(id) {
  try {
    return await addressAPI.get(id, authToken())
  } catch {
    return null
  }
}

// ==================== Banner管理 ====================
export async function getBannerList() {
  try {
    const config = await getBannerConfigFromCloud()
    const displayConfig = await hydrateBannerConfigImages(config)
    return displayConfig.banners
  } catch {
    return []
  }
}

export async function saveBannerList(banners) {
  const current = await getBannerConfigFromCloud()
  return saveBannerConfigToCloud({ ...current, banners })
}
