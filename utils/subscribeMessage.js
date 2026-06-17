/**
 * 微信订阅消息封装
 * 需要在微信公众平台配置模板ID后使用
 */

// 订阅消息模板 ID（需替换为实际的模板 ID）
// TODO: 在微信公众平台配置实际模板ID后替换以下占位符
const TEMPLATE_IDS = {
  ORDER_REMINDER: '截单提醒模板ID',      // 截单前2h提醒
  DELIVERY_NOTICE: '配送通知模板ID',      // 开始配送通知
  NEW_PRODUCT: '新品上架模板ID',         // 新品提醒
  ORDER_STATUS: '订单状态变更模板ID'     // 订单状态变更
}

/**
 * 请求用户授权订阅消息
 * @param {Array<string>} tmplIds - 需要授权的模板 ID 列表
 * @returns {Promise} 授权结果
 */
export function requestSubscribeMessage(tmplIds) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.requestSubscribeMessage) {
      reject(new Error('当前环境不支持订阅消息'))
      return
    }
    const params = { tmplIds }
    // 微信小程序要求至少传入一个 tmplId
    if (!tmplIds.length) {
      reject(new Error('未传入模板 ID'))
      return
    }
    wx.requestSubscribeMessage({
      ...params,
      success(res) {
        resolve(res)
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

/**
 * 用户下单后请求订阅配送通知
 */
export function subscribeDeliveryNotice() {
  return requestSubscribeMessage([TEMPLATE_IDS.DELIVERY_NOTICE])
    .then(res => {
      const status = res[TEMPLATE_IDS.DELIVERY_NOTICE]
      if (status === 'accept') {
        return { ok: true, message: '已开启配送通知' }
      }
      return { ok: false, message: '您拒绝了通知授权' }
    })
    .catch(() => ({ ok: false, message: '' }))
}

/**
 * 用户进入商品页时请求截单提醒
 */
export function subscribeOrderReminder() {
  return requestSubscribeMessage([TEMPLATE_IDS.ORDER_REMINDER])
    .then(res => {
      const status = res[TEMPLATE_IDS.ORDER_REMINDER]
      if (status === 'accept') {
        return { ok: true, message: '已开启截单提醒' }
      }
      return { ok: false, message: '' }
    })
    .catch(() => ({ ok: false, message: '' }))
}

/**
 * 发送截单提醒（由云函数调用）
 */
export function sendOrderReminder(openid, product, deadlineTime) {
  // 此函数在云函数中实现
  // 需要调用 wx.server.sendMessage 发送订阅消息
  return {
    touser: openid,
    templateId: TEMPLATE_IDS.ORDER_REMINDER,
    page: `/pages/product/detail?id=${product.id || ''}`,
    data: {
      thing1: { value: product.name || '商品' },       // 商品名称
      time2: { value: deadlineTime || '今晚22:00' },  // 截单时间
      thing3: { value: '您的团购即将截止，请尽快下单' } // 提醒内容
    }
  }
}

/**
 * 发送配送通知（由云函数调用）
 */
export function sendDeliveryNotice(openid, order) {
  return {
    touser: openid,
    templateId: TEMPLATE_IDS.DELIVERY_NOTICE,
    page: `/pages/order/detail/index?id=${order.id || order.orderNo || ''}`,
    data: {
      thing1: { value: order.receiver || '顾客' },           // 收货人
      thing2: { value: order.address || '配送地址' },         // 配送地址
      time3: { value: order.deliveryTime || '配送中' }       // 配送时间
    }
  }
}

export default {
  TEMPLATE_IDS,
  requestSubscribeMessage,
  subscribeDeliveryNotice,
  subscribeOrderReminder,
  sendOrderReminder,
  sendDeliveryNotice
}
