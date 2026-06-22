import { IMAGE_ASSETS, cloudImageHttpsUrl, normalizeImageUrl } from '@/utils/image'

const CART_KEY = 'chulu_cart_items'
const FAVORITE_PREFIX = 'chulu_favorite_'

function productId(product = {}) {
  return product.id || product.productId || product._id || ''
}

function countItems(items = []) {
  return items.reduce((sum, item) => sum + Number(item.count || 0), 0)
}

function displayImage(value, fallback = IMAGE_ASSETS.product) {
  const normalized = normalizeImageUrl(value, fallback)
  return cloudImageHttpsUrl(normalized) || normalized
}

export function syncCartBadge(items = getCartItems()) {
  try {
    const count = countItems(items)
    if (count > 0) {
      uni.setTabBarBadge({ index: 2, text: count > 99 ? '99+' : String(count) })
    } else {
      uni.removeTabBarBadge({ index: 2 })
    }
    return count
  } catch {
    return countItems(items)
  }
}

export function getCartItems() {
  try {
    const items = uni.getStorageSync(CART_KEY)
    return Array.isArray(items)
      ? items.map(item => ({
          ...item,
          image: displayImage(item.image || item.imageFileID),
          imageFileID: normalizeImageUrl(item.imageFileID || item.image, IMAGE_ASSETS.product)
        }))
      : []
  } catch {
    return []
  }
}

export function saveCartItems(items = []) {
  try { uni.setStorageSync(CART_KEY, items) } catch {}
  syncCartBadge(items)
  try { uni.$emit('cart:changed', countItems(items)) } catch {}
  return items
}

export function addCartItem(product = {}, count = 1) {
  const id = productId(product)
  if (!id) return getCartItems()
  const items = getCartItems()
  const index = items.findIndex(item => item.id === id)
  const rawLimit = Number(product.limit || 0)
  const stock = Number(product.stock || 0)
  const max = rawLimit > 1 ? rawLimit : 99
  const nextCount = Math.max(1, Number(count || 1))
  const imageFileID = normalizeImageUrl(product.imageFileID || product.image, IMAGE_ASSETS.product)
  const image = displayImage(product.image || product.imageFileID || imageFileID)
  if (index >= 0) {
    items[index] = { ...items[index], count: Math.min(max, Number(items[index].count || 0) + nextCount), stock, limit: max, image, imageFileID }
  } else {
    items.push({
      id,
      productId: id,
      name: product.name || '',
      desc: product.desc || '',
      price: Number(product.price || 0),
      originPrice: Number(product.originPrice || 0),
      image,
      imageFileID,
      stock,
      limit: max,
      count: Math.min(max, nextCount)
    })
  }
  return saveCartItems(items)
}

export function updateCartItemCount(id, count) {
  const items = getCartItems().map(item => {
    if (item.id !== id) return item
    const rawLimit = Number(item.limit || 0)
    const max = rawLimit > 1 ? rawLimit : 99
    return { ...item, count: Math.min(max, Math.max(1, Number(count || 1))) }
  })
  return saveCartItems(items)
}

export function removeCartItems(ids = []) {
  const idSet = new Set((ids || []).filter(Boolean).map(id => String(id)))
  if (!idSet.size) return saveCartItems(getCartItems())
  return saveCartItems(getCartItems().filter(item => {
    const keys = [item.id, item.productId, item._id].filter(Boolean).map(id => String(id))
    return !keys.some(id => idSet.has(id))
  }))
}

export function getCartCount() {
  return countItems(getCartItems())
}

export function getCartItemCount(id) {
  if (!id) return 0
  const item = getCartItems().find(row => row.id === id || row.productId === id)
  return Number((item && item.count) || 0)
}

export function setCheckoutItems(items = []) {
  try { uni.setStorageSync('checkout_cart_items', items) } catch {}
}

export function clearCheckoutItems() {
  try { uni.removeStorageSync('checkout_cart_items') } catch {}
}

export function getCheckoutItems() {
  try {
    const items = uni.getStorageSync('checkout_cart_items')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

export function isFavorite(id) {
  if (!id) return false
  try { return !!uni.getStorageSync(FAVORITE_PREFIX + id) } catch { return false }
}

export function setFavorite(product = {}, liked = true) {
  const id = productId(product)
  if (!id) return
  try {
    if (liked) {
      uni.setStorageSync(FAVORITE_PREFIX + id, {
        id,
        productId: id,
        name: product.name || '',
        desc: product.desc || '',
        price: Number(product.price || 0),
        originPrice: Number(product.originPrice || 0),
        image: product.imageFileID || product.image || '',
        imageFileID: product.imageFileID || product.image || '',
        stock: Number(product.stock || 0),
        limit: Number(product.limit || 5),
        savedAt: new Date().toISOString()
      })
    } else {
      uni.removeStorageSync(FAVORITE_PREFIX + id)
    }
  } catch {}
}

export function getFavoriteItems() {
  try {
    const keys = uni.getStorageInfoSync().keys || []
    return keys
      .filter(key => key.startsWith(FAVORITE_PREFIX))
      .map(key => {
        const value = uni.getStorageSync(key)
        if (value && typeof value === 'object') return value
        const id = key.replace(FAVORITE_PREFIX, '')
        return { id, productId: id }
      })
      .filter(item => item.id || item.productId)
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))
  } catch {
    return []
  }
}
