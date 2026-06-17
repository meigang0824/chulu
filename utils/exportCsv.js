function escapeCsvValue(value) {
  const text = value === undefined || value === null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(headers = [], rows = []) {
  const head = headers.map(item => escapeCsvValue(item.label || item.key || item)).join(',')
  const body = rows.map(row => headers.map(header => {
    const key = header.key || header
    const value = typeof header.format === 'function' ? header.format(row[key], row) : row[key]
    return escapeCsvValue(value)
  }).join(','))
  return ['\ufeff' + head, ...body].join('\n')
}

export function exportCsvFile({ fileName = `export_${Date.now()}.csv`, headers = [], rows = [] }) {
  const csv = buildCsv(headers, rows)
  if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
    const fs = wx.getFileSystemManager()
    const path = `${wx.env.USER_DATA_PATH}/${fileName}`
    fs.writeFileSync(path, csv, 'utf8')
    wx.openDocument({
      filePath: path,
      fileType: 'csv',
      showMenu: true
    })
    return { path, csv }
  }
  uni.setClipboardData({ data: csv })
  return { path: '', csv }
}

export function buildDeliveryCsvRows(orders = []) {
  return orders.map((order, index) => ({
    routeNo: order.routeNo || index + 1,
    orderNo: order.orderNo || order.id,
    receiver: order.receiver || order.customer,
    phone: order.fullPhone || order.phone,
    address: order.address,
    deliveryTime: order.deliveryTime || order.planTime,
    statusText: order.statusText,
    goods: (order.items || []).map(item => `${item.name}x${item.count}`).join('；'),
    note: order.note || ''
  }))
}

export const deliveryCsvHeaders = [
  { key: 'routeNo', label: '路线序号' },
  { key: 'orderNo', label: '订单号' },
  { key: 'receiver', label: '收货人' },
  { key: 'phone', label: '电话' },
  { key: 'address', label: '地址' },
  { key: 'deliveryTime', label: '配送时间' },
  { key: 'statusText', label: '状态' },
  { key: 'goods', label: '商品' },
  { key: 'note', label: '备注' }
]
