// 云函数入口：createOrder
// 创建订单并自动扣减库存
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function now() { return new Date().toISOString() }

exports.main = async (event, context) => {
  const { buyerId, items, amount, payable, address, note, payMethod, fulfillmentMethod, deliveryFee, discount } = event

  if (!items || !items.length) return { ok: false, message: '订单不能为空' }

  const id = `o${Date.now()}`

  // 事务：创建订单 + 扣减库存
  try {
    await db.runTransaction(async transaction => {
      // 检查并扣减库存
      for (const item of items) {
        const res = await transaction.collection('products')
          .where({ id: item.productId, stock: _.gte(item.count || 1) }).get()
        if (!res.data.length) throw new Error(`库存不足: ${item.name || item.productId}`)
        const stockDelta = -(item.count || 1)
        await transaction.collection('products').doc(res.data[0]._id).update({
          data: { stock: _.inc(stockDelta), sold: _.inc(item.count || 1), updatedAt: now() }
        })
      }

      // 创建订单
      await transaction.collection('orders').add({
        data: {
          id, orderNo: id, buyerId, status: 'pendingDelivery', payStatus: 'paid',
          amount: amount || 0, productAmount: amount || 0, deliveryFee: deliveryFee || 0,
          discount: discount || 0, payable: payable || amount || 0,
          address: JSON.stringify(address || {}), items: JSON.stringify(items),
          note: note || '', payMethod: payMethod || '微信支付',
          fulfillmentMethod: fulfillmentMethod || '快递发货',
          deliveryStatus: 'pending', createdAt: now(), updatedAt: now()
        }
      })
    })

    return {
      ok: true,
      data: { id, status: 'pendingDelivery', message: '订单创建成功' }
    }
  } catch (err) {
    return { ok: false, code: 'CREATE_FAILED', message: err.message || '订单创建失败' }
  }
}
