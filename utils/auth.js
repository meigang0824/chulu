import { callFunction } from '@/services/apiClient'
import { API_ENDPOINTS } from '@/utils/apiConfig'
import { normalizeCloudError } from '@/utils/apiError'

export const AUTH_STORAGE_KEY = 'app_auth_session'

const ADMIN_ROLES = ['owner', 'manager', 'staff']
const LOGIN_PAGE = '/pages/auth/login/index'
const ADMIN_PAGE_PREFIX = '/pages/admin/'

// 买家端需要登录才能访问的页面（其余页面游客可浏览）
const LOGIN_REQUIRED = [
  '/pages/order/confirm/index',
  '/pages/order/success/index',
  '/pages/order/list/index',
  '/pages/order/detail/index',
  '/pages/order/refund/index',
  '/pages/address/list/index',
  '/pages/address/edit/index',
  '/pages/order/review/index',
]

let guardsInstalled = false

function now() {
  return Date.now()
}

export function normalizePath(url = '') {
  const path = String(url || '').split('?')[0]
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

export function isAdminRole(role = '') {
  return ADMIN_ROLES.includes(role)
}

export function isGuestRole(role = '') {
  return role === 'guest'
}

export function getAuthSession() {
  try {
    const session = uni.getStorageSync(AUTH_STORAGE_KEY)
    if (!session || !session.token) return null
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= now()) {
      clearAuthSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function getAuthToken() {
  const session = getAuthSession()
  return session ? session.token : ''
}

export function getCurrentUser() {
  const session = getAuthSession()
  return session ? session.user : null
}

export function isLoggedIn() {
  const session = getAuthSession()
  return !!(session && session.role !== 'guest')
}

export function isGuest() {
  const session = getAuthSession()
  return !!(session && session.role === 'guest')
}

export function clearAuthSession() {
  try { uni.removeStorageSync(AUTH_STORAGE_KEY) } catch {}
}

export function setAuthSession(result = {}) {
  const user = result.user || {}
  const session = {
    token: result.token,
    expiresAt: result.expiresAt,
    role: user.role || result.role || 'buyer',
    isAdmin: isAdminRole(user.role || result.role),
    isGuest: user.role === 'guest' || result.isGuest || false,
    user,
    savedAt: new Date().toISOString()
  }
  try { uni.setStorageSync(AUTH_STORAGE_KEY, session) } catch {}
  return session
}

function syncAuthSessionFromRemote(remote = {}) {
  const session = getAuthSession()
  if (!session || !remote || !remote.isLoggedIn) return session
  const remoteUser = remote.user || {}
  const user = { ...(session.user || {}), ...remoteUser }
  const role = user.role || remote.role || session.role || 'buyer'
  const isAdmin = isAdminRole(role) || !!remote.isAdmin
  const nextSession = {
    ...session,
    role,
    isAdmin,
    isGuest: role === 'guest' || !!remote.isGuest,
    user: { ...user, role },
    adminProfile: remote.adminProfile || (isAdmin ? {
      id: user.id,
      role,
      name: user.displayName,
      status: user.status || 'active'
    } : null),
    savedAt: new Date().toISOString()
  }
  try { uni.setStorageSync(AUTH_STORAGE_KEY, nextSession) } catch {}
  return nextSession
}

export function updateAuthSessionUser(patch = {}) {
  const session = getAuthSession()
  if (!session) return null
  const user = { ...(session.user || {}), ...patch }
  const nextSession = {
    ...session,
    user,
    role: user.role || session.role || 'buyer',
    isAdmin: isAdminRole(user.role || session.role),
    isGuest: user.role === 'guest' || session.isGuest || false,
    savedAt: new Date().toISOString()
  }
  try { uni.setStorageSync(AUTH_STORAGE_KEY, nextSession) } catch {}
  return nextSession
}

export async function loginWithPassword({ identifier, password }) {
  const result = await callFunction(API_ENDPOINTS.businessApi, {
    action: 'authLogin',
    payload: { identifier, password }
  })
  if (result && result.ok) setAuthSession(result)
  return result
}

export async function loginWithWechat(profile = {}) {
  // 真实的微信登录流程
  // 1. 调用uni.login获取微信code
  // 2. 将code发送到后端换取openid和登录凭证
  
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('获取微信授权码失败'))
          return
        }
        
        // 将code发送到后端
        callFunction(API_ENDPOINTS.businessApi, {
          action: 'authWxLogin',
          payload: {
            code: loginRes.code,
            ...profile
          }
        }).then((result) => {
          if (result && result.ok) {
            setAuthSession(result)
            resolve(result)
          } else {
            reject(new Error(result.message || '微信登录失败'))
          }
        }).catch((error) => {
          reject(error)
        })
      },
      fail: (err) => {
        console.error('uni.login failed:', err)
        reject(new Error('微信登录调用失败，请确认在小程序环境中运行'))
      }
    })
  })
}

export async function loginAsGuest() {
  const result = await callFunction(API_ENDPOINTS.businessApi, {
    action: 'authGuestLogin',
    payload: {}
  })
  if (result && result.ok) setAuthSession(result)
  return result
}

export async function refreshAuthState() {
  const token = getAuthToken()
  if (!token) return { isLoggedIn: false, isAdmin: false, role: 'guest', user: null }
  try {
    const result = await callFunction(API_ENDPOINTS.businessApi, {
      action: 'authMe',
      authToken: token
    })
    if (!result.isLoggedIn) clearAuthSession()
    else syncAuthSessionFromRemote(result)
    return result
  } catch (error) {
    const normalized = normalizeCloudError(error)
    if (['SESSION_EXPIRED', 'PERMISSION_DENIED'].includes(normalized.code)) clearAuthSession()
    return { isLoggedIn: false, isAdmin: false, role: 'guest', user: null, error: normalized }
  }
}

export async function logoutAuth() {
  const token = getAuthToken()
  try {
    if (token) {
      await callFunction(API_ENDPOINTS.businessApi, {
        action: 'authLogout',
        authToken: token
      })
    }
  } catch {} finally {
    clearAuthSession()
  }
}

export async function requestPasswordReset(identifier) {
  return callFunction(API_ENDPOINTS.businessApi, {
    action: 'forgotPassword',
    payload: { identifier }
  })
}

/**
 * 页面权限规则：
 * - public:  任何人可访问（首页、分类、商品详情、登录页、订单列表、个人中心、关于门店）
 * - login:   需要正式登录（订单确认、订单成功、地址管理、评价）
 * - admin:   需要管理员权限（/pages/admin/*）
 */
export function getAccessRequirement(url = '') {
  const path = normalizePath(url)
  if (!path || path === LOGIN_PAGE) return { type: 'public' }
  if (path.startsWith(ADMIN_PAGE_PREFIX)) return { type: 'admin' }
  if (LOGIN_REQUIRED.includes(path)) return { type: 'login' }
  return { type: 'public' }
}

export function canAccessUrl(url = '') {
  const requirement = getAccessRequirement(url)
  if (requirement.type === 'public') return true
  const session = getAuthSession()
  if (!session) return false
  // 游客不能访问需要正式登录的页面
  if (requirement.type === 'login' && session.role === 'guest') return false
  if (requirement.type === 'admin') return isAdminRole(session.role)
  return true
}

export function buildLoginUrl(redirect = '', requiredRole = '') {
  const params = []
  if (redirect) params.push(`redirect=${encodeURIComponent(redirect)}`)
  if (requiredRole) params.push(`requiredRole=${encodeURIComponent(requiredRole)}`)
  return params.length ? `${LOGIN_PAGE}?${params.join('&')}` : LOGIN_PAGE
}

export function getRoleHome(role = '') {
  return isAdminRole(role) ? '/pages/admin/dashboard/index' : '/pages/home/index'
}

/** 冷启动目标：游客默认进首页，已登录按角色跳转 */
export function getStartupTarget() {
  const session = getAuthSession()
  if (!session) return '/pages/home/index'
  return getRoleHome(session.role)
}

export function redirectLoggedInFromLogin(requiredRole = '') {
  const session = getAuthSession()
  if (!session || session.role === 'guest') return false
  if (requiredRole === 'admin' && !isAdminRole(session.role)) return false
  const target = getRoleHome(session.role)
  setTimeout(() => {
    if (target.startsWith('/pages/home') || target.startsWith('/pages/category') ||
        target.startsWith('/pages/order/list') || target.startsWith('/pages/mine')) {
      uni.switchTab({ url: target })
    } else {
      uni.redirectTo({ url: target })
    }
  }, 0)
  return true
}

/** 游客操作拦截：弹出提示并引导登录 */
export function showGuestAuthPrompt(title = '该功能需要登录', content = '登录后即可使用完整功能，包括下单购买、地址管理等。') {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: buildLoginUrl() })
        }
        resolve(res.confirm)
      }
    })
  })
}

/** 检查当前用户是否能执行需要正式登录的操作 */
export function requireLogin(message = '请先登录后再操作') {
  const session = getAuthSession()
  if (!session) {
    showGuestAuthPrompt('请先登录', message)
    return false
  }
  if (session.role === 'guest') {
    showGuestAuthPrompt('需要正式登录', message)
    return false
  }
  return true
}

export function ensurePageAccess(url = '', message = '游客模式下无法使用该功能，请登录后再试。') {
  const path = normalizePath(url)
  const requirement = getAccessRequirement(path)
  if (requirement.type === 'public') return true

  const session = getAuthSession()

  if (requirement.type === 'admin') {
    if (session && isAdminRole(session.role)) return true
    redirectToLogin(path)
    return false
  }

  if (requirement.type === 'login') {
    if (session && session.role !== 'guest') return true
    if (session && session.role === 'guest') {
      showGuestAuthPrompt('需要正式登录', message)
      return false
    }
    redirectToLogin(path)
    return false
  }

  return true
}

function redirectToLogin(targetUrl) {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const currentPath = normalizePath((pages.slice(-1)[0] || {}).route || '')
  if (currentPath === LOGIN_PAGE) return
  const loginUrl = buildLoginUrl(targetUrl)
  setTimeout(() => {
    uni.navigateTo({ url: loginUrl })
  }, 0)
}

/** 路由守卫：拦截 navigateTo/redirectTo/reLaunch */
export function guardRoute(url = '') {
  const requirement = getAccessRequirement(url)
  if (requirement.type === 'public') return true
  if (canAccessUrl(url)) return true
  // 游客访问需要登录的页面，弹窗引导
  const session = getAuthSession()
  if (session && session.role === 'guest' && requirement.type === 'login') {
    showGuestAuthPrompt('需要正式登录', '游客模式下无法使用该功能，请登录后再试。')
    return false
  }
  redirectToLogin(url)
  return false
}

/** onShow 守卫：只在未登录访问登录页或管理员页时拦截 */
export function guardCurrentPage() {
  if (typeof getCurrentPages !== 'function') return true
  const pages = getCurrentPages()
  if (!pages.length) return true
  const current = pages[pages.length - 1]
  if (!current || !current.route) return true
  const path = `/${current.route}`
  return ensurePageAccess(path)
}

export function installAuthGuards() {
  if (guardsInstalled || typeof uni === 'undefined' || typeof uni.addInterceptor !== 'function') return
  guardsInstalled = true
  ;['navigateTo', 'redirectTo', 'reLaunch'].forEach(method => {
    uni.addInterceptor(method, {
      invoke(args = {}) {
        if (!args.url) return true
        return guardRoute(args.url)
      }
    })
  })
}
