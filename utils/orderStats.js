export function isRevenueOrder(order = {}) {
  if (!order) return false
  if (order.status === 'cancelled') return false
  return order.payStatus === 'paid'
}

export function sumRevenue(orders = []) {
  return (orders || [])
    .filter(isRevenueOrder)
    .reduce((sum, order) => sum + Number(order.payable || order.amount || 0), 0)
}

export function sumProductAmount(orders = []) {
  return (orders || [])
    .filter(isRevenueOrder)
    .reduce((sum, order) => sum + Number(order.productAmount || 0), 0)
}

export function sumDeliveryFee(orders = []) {
  return (orders || [])
    .filter(isRevenueOrder)
    .reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0)
}

function productKey(item = {}) {
  return String(item.productId || item.id || item._id || item.docId || '')
}

function orderItemMatchesGroup(item = {}, groupId = '', productIds = new Set(), allowProductFallback = false) {
  const itemGroupId = String(item.groupId || item.group_id || item.groupID || '')
  if (groupId && itemGroupId === String(groupId)) return true
  if (!allowProductFallback) return false
  const id = productKey(item)
  return !!id && productIds.has(id)
}

export function buildGroupProductSalesStats({ products = [], orders = [], groupId = '', allowProductFallback = false } = {}) {
  const productIds = new Set((products || []).map(productKey).filter(Boolean))
  const statsMap = {}
  ;(products || []).forEach((product, index) => {
    const id = productKey(product)
    if (!id) return
    statsMap[id] = {
      productId: id,
      name: product.name || '',
      price: Number(product.price || product.groupPrice || 0),
      stock: Number(product.stock || product.totalStock || product.groupStock || 0),
      sort: Number(product.sort || index + 1),
      soldCount: 0,
      salesAmount: 0
    }
  })

  ;(orders || []).filter(isRevenueOrder).forEach(order => {
    ;(order.items || []).forEach(item => {
      if (!orderItemMatchesGroup(item, groupId, productIds, allowProductFallback)) return
      const id = productKey(item)
      if (!id || !statsMap[id]) return
      const count = Number(item.count || 0)
      const price = Number(item.price !== undefined ? item.price : statsMap[id].price || 0)
      statsMap[id].soldCount += count
      statsMap[id].salesAmount += price * count
    })
  })

  return (products || [])
    .map(product => statsMap[productKey(product)])
    .filter(Boolean)
    .map(item => ({ ...item, salesAmount: Number(item.salesAmount.toFixed(2)) }))
}

export function buildGroupParticipants({ orders = [], groupId = '', productIds = new Set(), allowProductFallback = false } = {}) {
  const userMap = {}
  ;(orders || []).filter(isRevenueOrder).forEach(order => {
    const matchedItems = (order.items || []).filter(item => orderItemMatchesGroup(item, groupId, productIds, allowProductFallback))
    if (!matchedItems.length) return
    const key = order.buyerId || order._openid || order.customer || order.orderNo || order.id
    if (!key) return
    if (!userMap[key]) {
      userMap[key] = {
        id: key,
        displayName: order.customer || order.receiver || '匿名用户',
        avatar: order.avatar || '',
        avatarText: order.avatarText || (order.customer || order.receiver || '用').slice(0, 1),
        phone: order.fullPhone || order.phone || '',
        paid: true,
        payText: '已支付',
        orderCount: 0,
        itemMap: {}
      }
    }
    userMap[key].orderCount += 1
    matchedItems.forEach(item => {
      const name = item.name || '商品'
      userMap[key].itemMap[name] = (userMap[key].itemMap[name] || 0) + Number(item.count || 0)
    })
  })

  const participants = Object.values(userMap).map(user => ({
    ...user,
    itemSummary: Object.keys(user.itemMap)
      .map(name => `${name} ×${user.itemMap[name]}`)
      .join('、') || `订单 ${user.orderCount} 笔`
  })).sort((a, b) => b.orderCount - a.orderCount)

  return {
    participants,
    participantCount: participants.length
  }
}
