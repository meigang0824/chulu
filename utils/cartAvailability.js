function deadlineExpired(deadlineAt = '', nowTime = Date.now()) {
  if (!deadlineAt) return false
  const time = new Date(deadlineAt).getTime()
  return Number.isFinite(time) && time <= nowTime
}

export function groupContainsProduct(group = {}, productId = '') {
  const id = String(productId || '')
  if (!id || !group) return false
  const productIds = Array.isArray(group.productIds) ? group.productIds : []
  if (productIds.some(item => String(item) === id)) return true
  const products = Array.isArray(group.products) ? group.products : []
  return products.some(item => String(item.productId || item.id || item._id || '') === id)
}

export function findActiveCartGroup(item = {}, groups = [], nowTime = Date.now()) {
  const productId = String(item.productId || item.id || item._id || '')
  const groupId = String(item.groupId || '')
  if (!productId) return null
  return (groups || []).find(group => {
    if (!group || group.status !== 'active') return false
    if (deadlineExpired(group.deadlineAt, nowTime)) return false
    const id = String(group.id || group._id || group.groupId || '')
    if (groupId && id !== groupId) return false
    return groupContainsProduct(group, productId)
  }) || null
}
