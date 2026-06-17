const ERROR_TEXT = {
  API_UNAVAILABLE: '服务暂不可用，请稍后重试',
  NETWORK_ERROR: '网络异常，请稍后重试',
  PERMISSION_DENIED: '暂无操作权限',
  AUTH_REQUIRED: '请先登录',
  SESSION_EXPIRED: '登录状态已过期，请重新登录',
  ACCOUNT_LOCKED: '密码错误次数过多，账号已锁定',
  ACCOUNT_DISABLED: '账号已停用，请联系店长处理',
  PASSWORD_INCORRECT: '账号或密码不正确',
  ACCOUNT_NOT_FOUND: '账号不存在，请检查后重试',
  VALIDATION_ERROR: '提交信息不完整，请检查后重试',
  STOCK_NOT_ENOUGH: '库存不足，请减少购买数量',
  NOT_FOUND: '数据不存在或已下架',
  UNKNOWN: '系统开了个小差，请稍后再试'
}

export function normalizeCloudError(error) {
  const message = String(error && (error.message || error.errMsg || error.code) || '')
  if (/AUTH_REQUIRED|请先登录/i.test(message)) return { code: 'AUTH_REQUIRED', message: ERROR_TEXT.AUTH_REQUIRED, raw: error }
  if (/SESSION_EXPIRED|SESSION_INVALID|登录状态/i.test(message)) return { code: 'SESSION_EXPIRED', message: ERROR_TEXT.SESSION_EXPIRED, raw: error }
  if (/ACCOUNT_LOCKED|锁定/i.test(message)) return { code: 'ACCOUNT_LOCKED', message: ERROR_TEXT.ACCOUNT_LOCKED, raw: error }
  if (/ACCOUNT_DISABLED|停用/i.test(message)) return { code: 'ACCOUNT_DISABLED', message: ERROR_TEXT.ACCOUNT_DISABLED, raw: error }
  if (/PASSWORD_INCORRECT|密码错误/i.test(message)) return { code: 'PASSWORD_INCORRECT', message: ERROR_TEXT.PASSWORD_INCORRECT, raw: error }
  if (/ACCOUNT_NOT_FOUND|账号不存在/i.test(message)) return { code: 'ACCOUNT_NOT_FOUND', message: ERROR_TEXT.ACCOUNT_NOT_FOUND, raw: error }
  if (/permission|auth|denied|PERMISSION/i.test(message)) return { code: 'PERMISSION_DENIED', message: ERROR_TEXT.PERMISSION_DENIED, raw: error }
  if (/network|timeout|fail|CONNECTION|request/i.test(message)) return { code: 'NETWORK_ERROR', message: ERROR_TEXT.NETWORK_ERROR, raw: error }
  if (/stock|库存|STOCK_NOT_ENOUGH/i.test(message)) return { code: 'STOCK_NOT_ENOUGH', message: ERROR_TEXT.STOCK_NOT_ENOUGH, raw: error }
  if (/validate|invalid|VALIDATION/i.test(message)) return { code: 'VALIDATION_ERROR', message: ERROR_TEXT.VALIDATION_ERROR, raw: error }
  if (/not found|NOT_FOUND/i.test(message)) return { code: 'NOT_FOUND', message: ERROR_TEXT.NOT_FOUND, raw: error }
  return { code: 'UNKNOWN', message: ERROR_TEXT.UNKNOWN, raw: error }
}

export function showCloudError(error) {
  const normalized = normalizeCloudError(error)
  uni.showToast({ title: normalized.message, icon: 'none' })
  return normalized
}

export function createAppError(code, detail) {
  const error = new Error(ERROR_TEXT[code] || ERROR_TEXT.UNKNOWN)
  error.code = code
  error.detail = detail
  return error
}
