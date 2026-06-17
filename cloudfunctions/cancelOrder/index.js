// 云函数入口：cancelOrder
// 取消订单并回补库存
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function now() { return new Date().toISOString() }

exports.main = async (event, context) => {
  const { orderId } = event

  try {
    await db.runTransaction(async transaction => {
      const res = await transaction.collection('orders').where({ id: orderId }).get()
      if (!res.data.length) throw new Error('订单不存在')
      const order = res.data[0]

      // 只有待发货/待付款状态可以取消
      if (!['pendingDelivery', 'paid'].includes(order.status)) {
        throw new Error('该状态下的订单无法取消')
      }

      // 回补库存
      const items = JSON.parse(order.items || '[]')
      for (const item of items) {
        const prods = await transaction.collection('products').where({ id: item.productId }).get()
        if (prods.data.length) {
          await transaction.collection('products').doc(prods.data[0]._id).update({
            data: { stock: _.inc(item.count || 1), sold: _.inc(-(item.count || 1)), updatedAt: now() }
          })
        }
      }

      // 更新订单状态
      await transaction.collection('orders').doc(res.data[0]._id).update({
        data: { status: 'cancelled', deliveryStatus: 'cancelled', cancelledAt: now(), updatedAt: now() }
      })
    })

    return { ok: true, message: '订单已取消' }
  } catch (err) {
    return { ok: false, code: 'CANCEL_FAILED', message: err.message || '取消失败' }
  }
}
