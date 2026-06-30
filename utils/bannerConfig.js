import { IMAGE_ASSETS, normalizeImageUrl } from '@/utils/image'

const STORAGE_KEY = 'chulu_home_banner_config'

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

export function getDefaultBannerConfig() {
  return {
    settings: { autoplay: true, interval: 3200, duration: 450, circular: true, showDots: true },
    banners: [
      {
        id: 'fresh-cake',
        title: '',
        highlight: '',
        tag: '',
        features: [],
        image: IMAGE_ASSETS.banner,
        route: '',
        sort: 1,
        enabled: true
      },
      {
        id: 'toast',
        title: '',
        highlight: '',
        tag: '',
        features: [],
        image: IMAGE_ASSETS.productToast,
        route: '',
        sort: 2,
        enabled: true
      },
      {
        id: 'tart',
        title: '',
        highlight: '',
        tag: '',
        features: [],
        image: IMAGE_ASSETS.productTart,
        route: '',
        sort: 3,
        enabled: true
      }
    ]
  }
}

export function normalizeBannerConfig(config) {
  const defaults = getDefaultBannerConfig()
  const source = config || {}
  const settings = { ...defaults.settings, ...(source.settings || {}) }
  const sourceBanners = Array.isArray(source.banners) ? source.banners : []
  const baseBanners = sourceBanners.length ? sourceBanners : defaults.banners
  const banners = baseBanners.map((item, index) => {
    const preset = defaults.banners.find(defaultItem => defaultItem.id === item.id) || {}
    const merged = { ...preset, ...item }
    const imageFileID = normalizeImageUrl(merged.imageFileID || merged.image, IMAGE_ASSETS.banner)
    return {
      ...merged,
      sort: Number(merged.sort || index + 1),
      enabled: merged.enabled !== false,
      features: Array.isArray(merged.features) ? merged.features : [],
      image: imageFileID,
      imageFileID
    }
  }).sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
  return {
    settings: { autoplay: settings.autoplay !== false, circular: settings.circular !== false,
      interval: Number(settings.interval || 3200), duration: Number(settings.duration || 450),
      showDots: settings.showDots !== false },
    banners
  }
}

export function getBannerConfig() {
  try { return normalizeBannerConfig(uni.getStorageSync(STORAGE_KEY)) } catch { return getDefaultBannerConfig() }
}

export function saveBannerConfig(config) {
  const normalized = normalizeBannerConfig(config)
  uni.setStorageSync(STORAGE_KEY, normalized)
  return normalized
}

export function resetBannerConfig() {
  const defaults = getDefaultBannerConfig()
  uni.setStorageSync(STORAGE_KEY, defaults)
  return defaults
}

export function getActiveBanners(config) {
  const normalized = normalizeBannerConfig(config)
  const sourceBanners = Array.isArray(config && config.banners) ? config.banners : []
  const banners = normalized.banners.map((item, index) => {
    const source = sourceBanners.find(sourceItem => sourceItem && sourceItem.id === item.id) || sourceBanners[index] || {}
    const displayImage = source.image && source.image !== source.imageFileID ? source.image : item.image
    return { ...item, image: displayImage || item.image }
  })
  const enabled = banners.filter(item => item.enabled).sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
  return enabled.length ? enabled : banners.slice(0, 1)
}
