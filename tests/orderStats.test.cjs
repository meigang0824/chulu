const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

function loadOrderStats() {
  const filename = path.join(__dirname, '..', 'utils', 'orderStats.js')
  let source = fs.readFileSync(filename, 'utf8')
  source = source.replace(/export function /g, 'function ')
  source += '\nmodule.exports = { isRevenueOrder, sumRevenue, sumProductAmount, sumDeliveryFee, buildGroupProductSalesStats, buildGroupParticipants }'
  const sandbox = { module: { exports: {} }, exports: {} }
  vm.runInNewContext(source, sandbox, { filename })
  return sandbox.module.exports
}

function testSalesExcludeUnpaidCancelledOrders() {
  const { isRevenueOrder, sumDeliveryFee, sumProductAmount, sumRevenue } = loadOrderStats()
  const orders = [
    { status: 'pendingDelivery', payStatus: 'paid', payable: 86, productAmount: 78, deliveryFee: 8 },
    { status: 'cancelled', payStatus: 'paymentCancelled', payable: 187.02 },
    { status: 'cancelled', payStatus: 'paymentFailed', payable: 149 },
    { status: 'cancelled', payStatus: 'refunded', payable: 50 },
    { status: 'pendingPayment', payStatus: 'pending', payable: 25 }
  ]

  assert.strictEqual(isRevenueOrder(orders[0]), true)
  assert.strictEqual(isRevenueOrder(orders[1]), false)
  assert.strictEqual(sumRevenue(orders), 86)
  assert.strictEqual(sumProductAmount(orders), 78)
  assert.strictEqual(sumDeliveryFee(orders), 8)
}

testSalesExcludeUnpaidCancelledOrders()
function testGroupProductSalesStatsUsePaidOrdersAndGroupOrder() {
  const { buildGroupProductSalesStats } = loadOrderStats()
  const products = [
    { id: 'p2', productId: 'p2', name: '第二个', price: 20 },
    { id: 'p1', productId: 'p1', name: '第一个', price: 10 }
  ]
  const orders = [
    {
      status: 'pendingDelivery',
      payStatus: 'paid',
      items: [
        { productId: 'p1', groupId: 'g1', name: '第一个', count: 2, price: 10 },
        { productId: 'p2', groupId: 'g1', name: '第二个', count: 1, price: 20 }
      ]
    },
    {
      status: 'cancelled',
      payStatus: 'paymentCancelled',
      items: [{ productId: 'p2', groupId: 'g1', name: '第二个', count: 9, price: 20 }]
    },
    {
      status: 'pendingDelivery',
      payStatus: 'paid',
      items: [{ productId: 'p2', groupId: 'g2', name: '第二个', count: 4, price: 20 }]
    }
  ]

  const stats = buildGroupProductSalesStats({ products, orders, groupId: 'g1' })
  assert.deepStrictEqual(stats.map(item => item.productId), ['p2', 'p1'])
  assert.strictEqual(stats[0].soldCount, 1)
  assert.strictEqual(stats[0].salesAmount, 20)
  assert.strictEqual(stats[1].soldCount, 2)
  assert.strictEqual(stats[1].salesAmount, 20)
}

testGroupProductSalesStatsUsePaidOrdersAndGroupOrder()
function testGroupParticipantsExcludeCancelledPaymentOrders() {
  const { buildGroupParticipants } = loadOrderStats()
  const result = buildGroupParticipants({
    groupId: 'g1',
    productIds: new Set(['p1']),
    orders: [
      {
        buyerId: 'paid-user',
        customer: '已支付',
        status: 'pendingDelivery',
        payStatus: 'paid',
        items: [{ productId: 'p1', groupId: 'g1', name: '面包', count: 1 }]
      },
      {
        buyerId: 'cancelled-user',
        customer: '取消支付',
        status: 'cancelled',
        payStatus: 'paymentCancelled',
        items: [{ productId: 'p1', groupId: 'g1', name: '面包', count: 1 }]
      }
    ]
  })

  assert.strictEqual(result.participantCount, 1)
  assert.strictEqual(result.participants.map(item => item.id).join(','), 'paid-user')
}

testGroupParticipantsExcludeCancelledPaymentOrders()
console.log('order stats tests passed')
