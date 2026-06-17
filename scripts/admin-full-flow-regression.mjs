import { execFileSync } from 'node:child_process'

const ENV_ID = 'aiwork-8g5erw9d885e24b4'
const IMAGE = 'cloud://aiwork-8g5erw9d885e24b4/products/product-strawberry-box.jpg'
const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const ids = {
  product: `codex_admin_product_${stamp}`,
  category: `codex_admin_category_${stamp}`,
  buyer: `codex_admin_buyer_${stamp}`,
  route: `codex_admin_route_${stamp}`
}
let createdOrderId = ''
let createdGroupId = ''

const results = []

function run(bin, args, timeout = 90000) {
  return execFileSync(bin, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
    maxBuffer: 20 * 1024 * 1024
  })
}

function parseJsonOutput(output) {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error(`无法解析 JSON 输出：${output.slice(0, 300)}`)
  return JSON.parse(output.slice(start, end + 1))
}

function invoke(action, payload = {}, authToken = '') {
  const output = run('tcb', [
    'fn', 'invoke', 'businessApi',
    '--env-id', ENV_ID,
    '--json',
    '-d', JSON.stringify({ action, payload, authToken })
  ])
  const parsed = parseJsonOutput(output)
  const ret = parsed.data && parsed.data.RetMsg ? JSON.parse(parsed.data.RetMsg) : parsed
  if (ret && ret.ok === false) throw new Error(`${action} failed: ${ret.message || ret.code}`)
  return ret && ret.data !== undefined ? ret.data : ret
}

function dbCommand(table, type, command) {
  const output = run('tcb', [
    'db', 'nosql', 'execute',
    '--env-id', ENV_ID,
    '--json',
    '--command',
    JSON.stringify([{ TableName: table, CommandType: type, Command: JSON.stringify(command) }])
  ])
  return parseJsonOutput(output).data.results[0]
}

function deleteWhere(table, query) {
  return dbCommand(table, 'DELETE', { delete: table, deletes: [{ q: query, limit: 0 }] })
}

function assert(name, condition, detail = '') {
  if (!condition) throw new Error(`${name}${detail ? `：${detail}` : ''}`)
}

async function test(name, fn) {
  const started = Date.now()
  try {
    await fn()
    results.push({ name, status: 'PASS', ms: Date.now() - started })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, status: 'FAIL', ms: Date.now() - started, error: error.message })
    console.log(`FAIL ${name}: ${error.message}`)
    throw error
  }
}

async function cleanup() {
  const today = new Date().toISOString().slice(0, 10)
  try { if (createdGroupId) invoke('deleteGroup', { id: createdGroupId }) } catch {}
  try { invoke('deleteRoute', { id: ids.route }) } catch {}
  try { if (createdOrderId) deleteWhere('orders', { id: createdOrderId }) } catch {}
  try { deleteWhere('stockItems', { productId: ids.product }) } catch {}
  try { deleteWhere('stockItems', { id: `stock_${today}_${ids.product}` }) } catch {}
  try { invoke('deleteProduct', { id: ids.product }) } catch {}
}

let originalShopConfig = null
let originalBannerConfig = null
let authToken = ''

try {
  await cleanup()

  await test('店长账号登录与身份识别', () => {
    const login = invoke('authLogin', { identifier: 'manager', password: 'Chulu@2026' })
    authToken = login.token
    assert('登录返回 token', !!authToken)
    assert('登录识别店长', login.isAdmin === true && login.role === 'owner')
    const me = invoke('authMe', {}, authToken)
    assert('authMe 识别店长', me.isAdmin === true && me.role === 'owner')
  })

  await test('初始化占位记录不进入订单/团购列表', () => {
    const orders = invoke('listOrders')
    const groups = invoke('listGroups')
    assert('订单列表过滤 _init', !orders.some(item => item._init))
    assert('团购列表过滤 _init', !groups.some(item => item._init))
  })

  await test('商品新增、编辑、上下架、详情读取', () => {
    const created = invoke('createProduct', {
      id: ids.product,
      name: 'Codex 后台全功能测试商品',
      desc: '用于店长端按钮回归，测试完成自动删除',
      categoryKey: 'cake',
      price: 9.9,
      originPrice: 19.9,
      stock: 12,
      totalStock: 12,
      image: IMAGE,
      bannerImage: IMAGE,
      gallery: [IMAGE],
      status: 'active',
      sort: Date.now()
    })
    assert('商品创建成功', created.id === ids.product)
    const inactive = invoke('updateProduct', { id: ids.product, status: 'inactive' })
    assert('商品下架成功', inactive.status === 'inactive')
    const active = invoke('updateProduct', { id: ids.product, status: 'active', price: 10.9 })
    assert('商品上架并编辑成功', active.status === 'active' && Number(active.price) === 10.9)
    const fetched = invoke('getProduct', { id: ids.product })
    assert('商品详情可读取', fetched && fetched.id === ids.product)
  })

  await test('门店配置与分类保存', () => {
    originalShopConfig = invoke('getShopConfig')
    const categories = Array.isArray(originalShopConfig.categories) ? originalShopConfig.categories : [
      { key: 'cake', text: '蛋糕甜点' },
      { key: 'bread', text: '面包吐司' },
      { key: 'snack', text: '下午茶' }
    ]
    const next = {
      ...originalShopConfig,
      notice: `${originalShopConfig.notice || '今日截单22:00'} · codex`,
      categories: [...categories.filter(item => item.key !== ids.category), { key: ids.category, text: 'Codex测试分类' }]
    }
    const saved = invoke('updateShopConfig', next)
    assert('门店配置保存成功', saved.notice.includes('codex'))
    const reloaded = invoke('getShopConfig')
    assert('分类新增成功', (reloaded.categories || []).some(item => item.key === ids.category))
  })

  await test('轮播配置保存与读取', () => {
    originalBannerConfig = invoke('getBannerConfig')
    const banners = originalBannerConfig.banners && originalBannerConfig.banners.length
      ? originalBannerConfig.banners
      : [{ id: 'codex_banner', sort: 1, enabled: true, title: '测试轮播', highlight: '测试', tag: '测试', features: [], image: IMAGE, imageFileID: IMAGE, route: '' }]
    const next = {
      settings: {
        ...originalBannerConfig.settings,
        autoplay: !(originalBannerConfig.settings && originalBannerConfig.settings.autoplay === false),
        interval: 3600,
        duration: 500
      },
      banners
    }
    const saved = invoke('updateBannerConfig', next)
    assert('轮播保存成功', Number(saved.settings.interval) === 3600)
    const reloaded = invoke('getBannerConfig')
    assert('轮播读取成功', Number(reloaded.settings.interval) === 3600)
  })

  await test('团购发布、列表过滤、详情、结束与删除', () => {
    const group = invoke('createGroup', {
      title: 'Codex 后台全功能测试团',
      deadline: '今日 22:00 截单',
      deadlineAt: new Date(Date.now() + 3600000).toISOString(),
      deliveryTime: '次日打包发货',
      deliveryRange: '快递发货 / 门店自提',
      fulfillmentMethods: ['快递发货', '门店自提'],
      products: [{
        id: ids.product,
        productId: ids.product,
        name: 'Codex 后台全功能测试商品',
        image: IMAGE,
        imageFileID: IMAGE,
        price: 10.9,
        originPrice: 19.9,
        stock: 5,
        totalStock: 5,
        limit: 2,
        status: 'active',
        sort: 1
      }]
    })
    createdGroupId = group.id
    assert('团购发布保存标题', group.name === 'Codex 后台全功能测试团')
    assert('团购发布保存商品', Array.isArray(group.products) && group.products.length === 1)
    const activeGroups = invoke('listGroups', { status: 'active' })
    assert('进行中列表包含新团', activeGroups.some(item => item.id === createdGroupId))
    const ended = invoke('updateGroupStatus', { id: createdGroupId, status: 'ended' })
    assert('团购结束成功', ended.status === 'ended')
    const activeAfterEnd = invoke('listGroups', { status: 'active' })
    assert('结束后不在进行中列表', !activeAfterEnd.some(item => item.id === createdGroupId))
    invoke('deleteGroup', { id: createdGroupId })
    const deleted = invoke('getGroup', { id: createdGroupId })
    assert('团购删除成功', deleted === null)
    createdGroupId = ''
  })

  await test('订单创建、详情、状态推进、备货生成与更新', () => {
    const order = invoke('createOrder', {
      buyerId: ids.buyer,
      status: 'pendingDelivery',
      payStatus: 'paid',
      amount: 21.8,
      productAmount: 21.8,
      payable: 21.8,
      address: { receiver: 'Codex测试顾客', phone: '13800138000', address: '上海市徐汇区测试路 1 号' },
      items: [{ productId: ids.product, name: 'Codex 后台全功能测试商品', count: 2, price: 10.9, image: IMAGE, imageFileID: IMAGE }],
      fulfillmentMethod: '快递发货',
      deliveryTime: '次日打包发货',
      note: '后台全按钮回归'
    })
    createdOrderId = order.id
    assert('订单创建成功', !!createdOrderId)
    const listed = invoke('listOrders', { buyerId: ids.buyer })
    assert('订单列表可按 buyerId 过滤', listed.length === 1 && listed[0].id === createdOrderId)
    const today = new Date().toISOString().slice(0, 10)
    const stockRows = invoke('generateStock', { date: today })
    assert('备货生成包含订单商品', stockRows.some(item => item.productId === ids.product && Number(item.planCount) === 2))
    const updatedStock = invoke('updateStock', { id: ids.product, status: 'preparing', priority: '优先' })
    assert('备货状态更新成功', updatedStock && updatedStock.status === 'preparing')
    const delivering = invoke('updateOrderStatus', { id: createdOrderId, status: 'delivering' })
    assert('订单标记发货成功', delivering.status === 'delivering')
    const completed = invoke('updateOrderStatus', { id: createdOrderId, status: 'completed' })
    assert('订单标记完成成功', completed.status === 'completed')
  })

  await test('发货批次新增、编辑、绑定订单与删除', () => {
    const saved = invoke('saveRouteConfig', {
      id: ids.route,
      name: 'Codex测试发货批次',
      date: new Date().toISOString().slice(0, 10),
      startTime: '09:00',
      endTime: '12:00',
      status: 'planned',
      orderIds: createdOrderId ? [createdOrderId] : []
    })
    assert('发货批次新增成功', saved.id === ids.route)
    const edited = invoke('saveRouteConfig', { ...saved, name: 'Codex测试发货批次-编辑', status: 'delivering' })
    assert('发货批次编辑成功', edited.name.includes('编辑'))
    const routes = invoke('listRoutes')
    assert('发货批次列表可读取', routes.some(item => item.id === ids.route))
    invoke('deleteRoute', { id: ids.route })
    const afterDelete = invoke('listRoutes')
    assert('发货批次删除成功', !afterDelete.some(item => item.id === ids.route))
  })

  await test('统计接口可读取经营数据', () => {
    const stats = invoke('statsToday')
    assert('统计返回订单数', typeof stats.orderCount === 'number')
    assert('统计返回销售额', typeof stats.totalAmount === 'number')
    assert('统计返回商品数', typeof stats.activeProductCount === 'number')
  })

  await test('商品删除与临时数据清理', () => {
    if (createdOrderId) {
      deleteWhere('orders', { id: createdOrderId })
      createdOrderId = ''
    }
    const today = new Date().toISOString().slice(0, 10)
    invoke('generateStock', { date: today })
    deleteWhere('stockItems', { productId: ids.product })
    invoke('deleteProduct', { id: ids.product })
    const missing = invoke('getProduct', { id: ids.product })
    assert('临时商品已删除', missing === null)
  })

  console.log(JSON.stringify({ ok: true, ids, results }, null, 2))
} finally {
  if (originalBannerConfig) {
    try { invoke('updateBannerConfig', originalBannerConfig) } catch {}
  }
  if (originalShopConfig) {
    try { invoke('updateShopConfig', originalShopConfig) } catch {}
  }
  await cleanup()
}
