export const CLOUD_ENV_ID = 'cloudbase-d7gp8xx126047f577'
export const CLOUD_STORAGE_BUCKET = '636c-cloudbase-d7gp8xx126047f577-1446367223'
export const CLOUD_STORAGE_ORIGIN = 'https://636c-cloudbase-d7gp8xx126047f577-1446367223.tcb.qcloud.la'
export const CLOUD_FILE_ID_PREFIX = `cloud://${CLOUD_ENV_ID}.${CLOUD_STORAGE_BUCKET}`

export function cloudImage(path) {
  return `${CLOUD_FILE_ID_PREFIX}/${path}`
}

export const IMAGE_ASSETS = {
  logo: cloudImage('icons/logo.png'),
  product: cloudImage('products/product-strawberry-box.jpg'),
  productToast: cloudImage('products/product-toast.jpg'),
  productTart: cloudImage('products/product-tart.jpg'),
  banner: cloudImage('banners/home-hero-cake.jpg')
}

export const IMAGE_OPTIONS = [
  { label: '草莓蛋糕', value: IMAGE_ASSETS.product },
  { label: '吐司面包', value: IMAGE_ASSETS.productToast },
  { label: '蛋挞甜点', value: IMAGE_ASSETS.productTart },
  { label: '首页横幅', value: IMAGE_ASSETS.banner },
  { label: '店铺标志', value: IMAGE_ASSETS.logo }
]

const CLOUD_IMAGE_PATH_MAP = {
  'icons/logo.png': 'icons/logo.png',
  'icons/placeholder.png': 'products/product-strawberry-box.jpg',
  'products/product-strawberry-box.jpg': 'products/product-strawberry-box.jpg',
  'products/product-toast.jpg': 'products/product-toast.jpg',
  'products/product-tart.jpg': 'products/product-tart.jpg',
  'banners/home-hero-cake.jpg': 'banners/home-hero-cake.jpg'
}

function cloudStoragePath(path) {
  if (!path) return ''
  const normalized = String(path)
    .split(/[?#]/)[0]
    .replace(/^\/+/, '')
    .replace(/^static\/images\//, '')
    .replace(/^images\//, '')
  if (CLOUD_IMAGE_PATH_MAP[normalized]) return CLOUD_IMAGE_PATH_MAP[normalized]
  if (/^(products|banners|icons|tabbar|login|avatars|post)\//.test(normalized)) {
    return normalized
  }
  return ''
}

export function normalizeImageUrl(value, fallback = IMAGE_ASSETS.product) {
  if (value === undefined || value === null) return fallback || ''
  const raw = String(value).trim()
  if (!raw) return fallback || ''
  if (raw.indexOf('cloud://') === 0) {
    if (raw.indexOf(`cloud://${CLOUD_ENV_ID}/`) === 0) {
      return `${CLOUD_FILE_ID_PREFIX}/${raw.slice(`cloud://${CLOUD_ENV_ID}/`.length)}`
    }
    return raw
  }
  const path = cloudStoragePath(raw)
  if (path) {
    return cloudImage(path)
  }
  return raw
}

export function normalizeImageList(list, fallback = IMAGE_ASSETS.product) {
  const source = Array.isArray(list) ? list : (typeof list === 'string' && list ? [list] : [])
  const normalized = source
    .map(item => normalizeImageUrl(item, ''))
    .filter(Boolean)
  return normalized.length ? normalized : (fallback ? [fallback] : [])
}

export function isCloudFileID(value) {
  return String(value || '').indexOf('cloud://') === 0
}

export function cloudFilePath(value) {
  const raw = String(value || '').trim().split(/[?#]/)[0]
  if (!raw) return ''
  if (raw.indexOf('cloud://') === 0) {
    const match = raw.match(/^cloud:\/\/[^/]+\/(.+)$/)
    return match && match[1] ? match[1].replace(/^\/+/, '') : ''
  }
  return cloudStoragePath(raw)
}

export function cloudImageHttpsUrl(value) {
  const path = cloudFilePath(value)
  if (!path) return ''
  const encodedPath = path.split('/').map(item => encodeURIComponent(item)).join('/')
  return `${CLOUD_STORAGE_ORIGIN}/${encodedPath}`
}

export function resolveImageUrl(value, fallback = IMAGE_ASSETS.product) {
  const fileID = normalizeImageUrl(value, fallback)
  if (!isCloudFileID(fileID)) return Promise.resolve(fileID)
  const fallbackUrl = cloudImageHttpsUrl(fileID) || fileID
  return Promise.resolve(fallbackUrl)
}

export async function resolveImageList(list, fallback = IMAGE_ASSETS.product) {
  const fileIDs = normalizeImageList(list, fallback)
  return Promise.all(fileIDs.map(item => resolveImageUrl(item, '')))
}

export function normalizeGroupImages(group = {}) {
  group = group || {}
  const products = Array.isArray(group.products)
    ? group.products.map(item => {
        const imageFileID = normalizeImageUrl(item.imageFileID || item.image, IMAGE_ASSETS.product)
        const bannerImageFileID = normalizeImageUrl(item.bannerImageFileID || item.bannerImage || item.image, imageFileID)
        const galleryFileIDs = normalizeImageList(item.galleryFileIDs || item.gallery, bannerImageFileID)
        return {
          ...item,
          image: imageFileID,
          imageFileID,
          bannerImage: bannerImageFileID,
          bannerImageFileID,
          gallery: galleryFileIDs,
          galleryFileIDs
        }
      })
    : []
  return { ...group, products }
}

export function isTemporaryImageUrl(value) {
  const raw = String(value || '')
  return /^(wxfile:\/\/|http:\/\/tmp\/|https:\/\/tmp\/|file:\/\/|\/tmp\/)/.test(raw)
}

function imageExtension(filePath) {
  const match = String(filePath || '').split(/[?#]/)[0].match(/\.([a-zA-Z0-9]+)$/)
  const ext = match ? match[1].toLowerCase() : 'jpg'
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
}

export function uploadImageToCloud(filePath, folder = 'products') {
  const normalized = normalizeImageUrl(filePath, '')
  if (!isTemporaryImageUrl(filePath)) {
    return Promise.resolve(normalized)
  }
  // #ifdef MP-WEIXIN
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
    return Promise.reject(new Error('当前环境不支持云存储上传'))
  }
  const safeFolder = String(folder || 'products').replace(/^\/+|\/+$/g, '')
  const cloudPath = `${safeFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${imageExtension(filePath)}`
  return wx.cloud.uploadFile({ cloudPath, filePath }).then(res => res.fileID)
  // #endif
  // #ifndef MP-WEIXIN
  return Promise.resolve(normalized)
  // #endif
}
