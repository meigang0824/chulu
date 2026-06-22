const automator = require('/tmp/miniprogram-automator-run/node_modules/miniprogram-automator')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const projectPath = '/Users/apple/.openclaw/workspace-wechat/sweet_bakery_uniapp'
const cliPath = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const envId = 'aiwork-8g5erw9d885e24b4'
const automatorPort = Number(process.env.ADMIN_AUDIT_PORT || 9430)
const cloudImage = `cloud://${envId}/products/product-strawberry-box.jpg`
const testPrefix = 'Codex按钮测试'
const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

const ids = {
  productCore: `codex_click_core_${stamp}`,
  productManage: `codex_click_manage_${stamp}`,
  productStock: `codex_click_stock_${stamp}`,
  productEdit: `codex_click_edit_${stamp}`,
  buyer: `codex_click_buyer_${stamp}`,
  route: `codex_click_route_${stamp}`,
  routeUi: `codex_click_route_ui_${stamp}`,
  category: `codex_click_category_${stamp}`
}

const adminSession = {
  token: 'codex-clickable-audit-token',
  expiresAt: '2026-06-18T00:00:00.000Z',
  role: 'owner',
  isAdmin: true,
  isGuest: false,
  user: { id: 'owner001', username: 'manager', role: 'owner', displayName: '初炉店长', avatarText: '店', status: 'active' },
  savedAt: new Date().toISOString()
}

const results = []
const createdOrders = []
let originalShopConfig = null
let originalBannerConfig = null

function run(bin, args, timeout = 90000) {
  return execFileSync(bin, args, {
    cwd: projectPath,
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
    '--env-id', envId,
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
    '--env-id', envId,
    '--json',
    '--command',
    JSON.stringify([{ TableName: table, CommandType: type, Command: JSON.stringify(command) }])
  ])
  return parseJsonOutput(output).data.results[0]
}

function deleteWhere(table, query) {
  return dbCommand(table, 'DELETE', { delete: table, deletes: [{ q: query, limit: 0 }] })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function productPayload(id, name, sort, status = 'active') {
  return {
    id,
    name,
    desc: `${testPrefix}临时商品，脚本结束自动清理`,
    categoryKey: 'cake',
    price: 9.9,
    originPrice: 19.9,
    stock: 80,
    totalStock: 80,
    image: cloudImage,
    bannerImage: cloudImage,
    gallery: [cloudImage],
    status,
    sort
  }
}

function createOrderPayload(label, productId, status = 'pendingDelivery', deliveryStatus = 'pending') {
  return {
    buyerId: ids.buyer,
    status,
    deliveryStatus,
    payStatus: 'paid',
    amount: 9.9,
    productAmount: 9.9,
    payable: 9.9,
    address: {
      receiver: `${testPrefix}${label}`,
      phone: '13800138000',
      address: `上海市徐汇区${testPrefix}${label}路 1 号`
    },
    items: [{
      productId,
      name: `${testPrefix}商品`,
      count: 1,
      price: 9.9,
      image: cloudImage,
      imageFileID: cloudImage
    }],
    fulfillmentMethod: '快递发货',
    deliveryTime: '次日打包发货',
    note: `${testPrefix}${label}`
  }
}

async function cleanupCloudData() {
  try {
    const groups = invoke('listGroups')
    for (const group of groups || []) {
      if (String(group.name || group.title || '').startsWith(testPrefix) || String(group.id || '').includes('codex_click')) {
        try { invoke('deleteGroup', { id: group.id }) } catch {}
      }
    }
  } catch {}

  try {
    const orders = invoke('listOrders')
    for (const order of orders || []) {
      const address = order.address || {}
      const receiver = typeof address === 'object' ? address.receiver : ''
      if (String(order.buyerId || '').includes('codex_click_buyer') || String(receiver || '').startsWith(testPrefix)) {
        try { deleteWhere('orders', { id: order.id }) } catch {}
      }
    }
  } catch {}
  try { deleteWhere('orders', { buyerId: ids.buyer }) } catch {}
  for (const orderId of createdOrders) {
    try { deleteWhere('orders', { id: orderId }) } catch {}
  }

  try {
    const products = invoke('listProducts')
    for (const product of products || []) {
      if (String(product.id || '').includes('codex_click') || String(product.name || '').startsWith(testPrefix)) {
        try { invoke('deleteProduct', { id: product.id }) } catch {}
      }
    }
  } catch {}

  for (const productId of [ids.productCore, ids.productManage, ids.productStock, ids.productEdit]) {
    try { deleteWhere('stockItems', { productId }) } catch {}
    try { deleteWhere('stockItems', { id: productId }) } catch {}
  }
}

function createOrder(label, productId, status = 'pendingDelivery', deliveryStatus = 'pending') {
  const order = invoke('createOrder', createOrderPayload(label, productId, status, deliveryStatus))
  createdOrders.push(order.id)
  return order
}

async function setupCloudData() {
  await cleanupCloudData()
  originalShopConfig = invoke('getShopConfig')
  originalBannerConfig = invoke('getBannerConfig')

  invoke('createProduct', productPayload(ids.productManage, `${testPrefix}商品管理`, -10000000, 'active'))
  invoke('createProduct', productPayload(ids.productStock, `${testPrefix}货架管理`, -9999999, 'active'))
  invoke('createProduct', productPayload(ids.productCore, `${testPrefix}核心商品`, -9999998, 'active'))
  invoke('createProduct', productPayload(ids.productEdit, `${testPrefix}编辑商品`, -9999997, 'active'))

  const orderList = createOrder('订单列表', ids.productCore, 'pendingDelivery', 'pending')
  const orderDetail = createOrder('订单详情', ids.productCore, 'pendingDelivery', 'pending')
  const orderDelivery = createOrder('配送勾选', ids.productCore, 'pendingDelivery', 'pending')
  const orderCompleted = createOrder('已完成订单', ids.productCore, 'completed', 'completed')

  const group = invoke('createGroup', {
    title: `${testPrefix}团购管理`,
    deadline: '今日 22:00 截单',
    deadlineAt: new Date(Date.now() + 3600000).toISOString(),
    deliveryTime: '次日打包发货',
    deliveryRange: '快递发货 / 门店自提',
    fulfillmentMethods: ['快递发货', '门店自提'],
    products: [{
      id: ids.productCore,
      productId: ids.productCore,
      name: `${testPrefix}核心商品`,
      image: cloudImage,
      imageFileID: cloudImage,
      price: 9.9,
      originPrice: 19.9,
      stock: 10,
      totalStock: 10,
      limit: 2,
      status: 'active',
      sort: 1
    }]
  })

  return { groupId: group.id, orderList, orderDetail, orderDelivery, orderCompleted }
}

async function currentPath(miniProgram) {
  const page = await miniProgram.currentPage()
  return page ? `/${page.path}` : ''
}

async function open(miniProgram, url, ms = 1400) {
  const page = await miniProgram.reLaunch(url)
  await page.waitFor(ms)
  return page
}

async function waitForData(page, predicate, label, timeout = 12000) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeout) {
    last = await page.data()
    if (predicate(last)) return last
    await page.waitFor(350)
  }
  throw new Error(`等待数据超时：${label}`)
}

async function elements(page, selector) {
  try {
    return await page.$$(selector)
  } catch {
    return []
  }
}

async function tap(page, selector, label, index = 0, wait = 500) {
  const list = await elements(page, selector)
  const el = list[index]
  if (!el) throw new Error(`${label} 不存在：${selector}[${index}]`)
  await el.tap()
  await page.waitFor(wait)
}

async function tapOptional(page, selector, label, index = 0, wait = 500) {
  const list = await elements(page, selector)
  if (!list[index]) {
    console.log(`SKIP ${label}：当前页面无匹配元素`)
    return false
  }
  await list[index].tap()
  await page.waitFor(wait)
  return true
}

async function setPageData(page, patch) {
  if (typeof page.setData !== 'function') throw new Error('当前 automator Page 不支持 setData')
  await page.setData(patch)
  await page.waitFor(250)
}

async function setVmData(miniProgram, patch) {
  const ok = await miniProgram.evaluate(function (incoming) {
    if (typeof getCurrentPages !== 'function') return false
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    const vm = page && (page.$vm || (page.$scope && page.$scope.$vm) || page.__vue__)
    if (!vm) return false
    Object.keys(incoming).forEach(function (key) {
      if (typeof vm.$set === 'function') vm.$set(vm, key, incoming[key])
      else vm[key] = incoming[key]
    })
    if (typeof vm.$forceUpdate === 'function') vm.$forceUpdate()
    return true
  }, patch)
  if (!ok) throw new Error('未找到当前页面 Vue 实例')
  const page = await miniProgram.currentPage()
  await page.waitFor(300)
}

async function waitForCloud(label, fn, timeout = 20000) {
  const started = Date.now()
  let lastError = null
  while (Date.now() - started < timeout) {
    try {
      const value = fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 1800))
  }
  throw new Error(`${label}${lastError ? `：${lastError.message}` : ''}`)
}

async function test(name, fn) {
  const onlyFilter = process.env.ADMIN_AUDIT_ONLY || ''
  if (onlyFilter && !name.includes(onlyFilter)) {
    console.log(`SKIP ${name}`)
    return
  }
  const started = Date.now()
  try {
    await fn()
    results.push({ name, status: 'PASS', ms: Date.now() - started })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, status: 'FAIL', ms: Date.now() - started, error: error.message })
    console.log(`FAIL ${name}: ${error.message}`)
  }
}

async function assertAt(miniProgram, expectedPrefix, label) {
  const pathName = await currentPath(miniProgram)
  assert(pathName.startsWith(expectedPrefix), `${label} 跳转失败：${pathName}`)
}

async function setupMiniProgram(miniProgram) {
  await miniProgram.callWxMethod('setStorageSync', 'app_auth_session', adminSession)
  await miniProgram.callWxMethod('setStorageSync', 'app_user_identity', {
    isLoggedIn: true,
    isGuest: false,
    isAdmin: true,
    role: 'owner',
    user: adminSession.user,
    token: adminSession.token
  })
  await miniProgram.callWxMethod('setStorageSync', 'app_portal_mode', 'admin')
  await miniProgram.mockWxMethod('makePhoneCall', { errMsg: 'makePhoneCall:ok' })
  await miniProgram.mockWxMethod('setClipboardData', { errMsg: 'setClipboardData:ok' })
  await miniProgram.mockWxMethod('openDocument', { errMsg: 'openDocument:ok' })
  await miniProgram.mockWxMethod('showModal', { confirm: true, cancel: false, errMsg: 'showModal:ok' })
  await miniProgram.mockWxMethod('showActionSheet', { tapIndex: 0, errMsg: 'showActionSheet:ok' })
  await miniProgram.mockWxMethod('chooseImage', { tempFilePaths: [cloudImage], tempFiles: [{ path: cloudImage, size: 1024 }], errMsg: 'chooseImage:ok' })
}

async function restoreMocks(miniProgram) {
  for (const name of ['makePhoneCall', 'setClipboardData', 'openDocument', 'showModal', 'showActionSheet', 'chooseImage']) {
    try { await miniProgram.restoreWxMethod(name) } catch {}
  }
}

async function runUiAudit() {
  const seed = await setupCloudData()
  const miniProgram = await automator.launch({
    cliPath,
    projectPath,
    port: automatorPort,
    trustProject: true,
    timeout: 120000
  })

  try {
    await setupMiniProgram(miniProgram)

    const renderPages = [
      '/pages/admin/dashboard/index',
      '/pages/admin/settings/index',
      '/pages/admin/store-settings/index',
      '/pages/admin/banner-config/index',
      '/pages/admin/category-manage/index',
      '/pages/admin/stats/index',
      '/pages/admin/group-list/index',
      `/pages/admin/group-detail/index?id=${seed.groupId}`,
      '/pages/admin/create-group/index',
      '/pages/admin/order-list/index',
      `/pages/admin/order-detail/index?id=${seed.orderDetail.id}`,
      '/pages/admin/delivery-address/index',
      '/pages/admin/product-manage/index',
      '/pages/admin/stock-summary/index',
      `/pages/admin/product-edit/index?id=${ids.productEdit}`
    ]

    await test('店长端 15 个页面可直接打开', async () => {
      for (const url of renderPages) {
        await open(miniProgram, url)
        await assertAt(miniProgram, url.split('?')[0], url)
      }
    })

    await test('工作台按钮：切回用户端、快捷入口、商品管理入口', async () => {
      let page = await open(miniProgram, '/pages/admin/dashboard/index')
      await tap(page, '.portal-switch', '切回用户端')
      await assertAt(miniProgram, '/pages/home/index', '切回用户端')
      await miniProgram.callWxMethod('setStorageSync', 'app_portal_mode', 'admin')

      const quickTargets = [
        '/pages/admin/settings/index',
        '/pages/admin/group-list/index',
        '/pages/admin/stats/index'
      ]
      for (let index = 0; index < quickTargets.length; index += 1) {
        page = await open(miniProgram, '/pages/admin/dashboard/index')
        await tap(page, '.quick-card', `工作台快捷入口 ${index + 1}`, index, 800)
        await assertAt(miniProgram, quickTargets[index], `工作台快捷入口 ${index + 1}`)
      }

      page = await open(miniProgram, '/pages/admin/dashboard/index')
      await tap(page, '.section__head .link', '正在开团-查看全部', 0, 800)
      await assertAt(miniProgram, '/pages/admin/group-list/index', '正在开团-查看全部')

      page = await open(miniProgram, '/pages/admin/dashboard/index')
      await tapOptional(page, '.product-card__btn', '正在开团商品-管理', 0, 800)
    })

    await test('底部店长导航：工作台、开团、订单、商品、发货', async () => {
      let page = await open(miniProgram, '/pages/admin/create-group/index')
      await tap(page, '.admin-tabbar__item', '底部导航工作台', 0, 1200)
      await assertAt(miniProgram, '/pages/admin/dashboard/index', '底部导航工作台')

      const targets = [
        ['/pages/admin/create-group/index', '底部导航开团', 1],
        ['/pages/admin/order-list/index', '底部导航订单', 2],
        ['/pages/admin/stock-summary/index', '底部导航商品', 3],
        ['/pages/admin/delivery-address/index', '底部导航发货', 4]
      ]
      for (const [target, label, index] of targets) {
        page = await open(miniProgram, '/pages/admin/dashboard/index')
        await tap(page, '.admin-tabbar__item', label, index, 1200)
        await assertAt(miniProgram, target, label)
      }
    })

    await test('配置中心入口：店铺、轮播、分类', async () => {
      const targets = [
        '/pages/admin/store-settings/index',
        '/pages/admin/banner-config/index',
        '/pages/admin/category-manage/index'
      ]
      for (let index = 0; index < targets.length; index += 1) {
        const page = await open(miniProgram, '/pages/admin/settings/index')
        await tap(page, '.settings-item', `配置中心入口 ${index + 1}`, index, 900)
        await assertAt(miniProgram, targets[index], `配置中心入口 ${index + 1}`)
      }
    })

    await test('门店配置：保存按钮可写入', async () => {
      const page = await open(miniProgram, '/pages/admin/store-settings/index')
      const data = await waitForData(page, d => d.form && d.form.name, '门店配置表单')
      await setVmData(miniProgram, {
        form: {
          ...data.form,
          notice: `${data.form.notice || '今日截单22:00'} ${testPrefix}`,
          checkout: {
            ...(data.form.checkout || {}),
            deliveryTime: (data.form.checkout && data.form.checkout.deliveryTime) || '次日打包发货',
            deliveryFee: 6,
            groupDiscount: 4
          }
        }
      })
      await tap(page, '.primary-btn', '保存门店配置', 0, 2200)
      await waitForCloud('门店配置未写入云数据库', () => {
        const saved = invoke('getShopConfig')
        return String(saved.notice || '').includes(testPrefix) ? saved : null
      })
    })

    await test('轮播配置：开关、上传、新图排序、恢复默认、保存', async () => {
      const page = await open(miniProgram, '/pages/admin/banner-config/index', 1800)
      await waitForData(page, d => Array.isArray(d.banners) && d.banners.length > 0, '轮播列表')
      await tapOptional(page, 'switch', '轮播自动播放开关', 0)
      await tapOptional(page, 'switch', '轮播循环播放开关', 1)
      await tapOptional(page, 'switch', '轮播圆点开关', 2)
      await tapOptional(page, '.upload-inline', '轮播上传新图', 0, 800)
      const actionButtons = await elements(page, '.banner-card__actions button')
      if (actionButtons.length >= 4) {
        await actionButtons[1].tap()
        await page.waitFor(400)
        const refreshed = await elements(page, '.banner-card__actions button')
        await refreshed[2].tap()
        await page.waitFor(400)
      }
      await tap(page, '.bottom-actions button', '恢复默认轮播', 0, 800)
      await tap(page, '.bottom-actions button', '保存轮播配置', 1, 1400)
      const saved = invoke('getBannerConfig')
      assert(saved && saved.settings, '轮播配置未保存')
    })

    await test('分类管理：新增、关闭、取消、保存、编辑、删除', async () => {
      const page = await open(miniProgram, '/pages/admin/category-manage/index', 1600)
      await waitForData(page, d => Array.isArray(d.categories), '分类列表')
      await tap(page, '.category-add', '新增分类入口')
      await tap(page, '.modal-close', '新增分类弹窗关闭')
      await tap(page, '.category-add', '新增分类入口-取消')
      await tap(page, '.cancel-btn', '新增分类取消')
      await tap(page, '.category-add', '新增分类入口-保存')
      await setVmData(miniProgram, { form: { key: ids.category, text: `${testPrefix}分类` } })
      await tap(page, '.confirm-btn', '新增分类保存', 0, 1200)
      await waitForCloud('新增分类未写入云数据库', () => {
        const shop = invoke('getShopConfig')
        return (shop.categories || []).some(item => item.key === ids.category) ? shop : null
      })
      let data = await waitForData(page, d => (d.categories || []).some(item => item.key === ids.category), '新增分类写入')
      let categoryIndex = data.categories.findIndex(item => item.key === ids.category)
      let buttons = await elements(page, '.category-item__actions button')
      await buttons[categoryIndex * 2].tap()
      await page.waitFor(500)
      await setVmData(miniProgram, { form: { key: ids.category, text: `${testPrefix}分类编辑` } })
      await tap(page, '.confirm-btn', '编辑分类保存', 0, 1200)
      await waitForCloud('编辑分类未写入云数据库', () => {
        const shop = invoke('getShopConfig')
        return (shop.categories || []).some(item => item.key === ids.category && item.text.includes('编辑')) ? shop : null
      })
      data = await waitForData(page, d => (d.categories || []).some(item => item.key === ids.category && item.text.includes('编辑')), '编辑分类写入')
      categoryIndex = data.categories.findIndex(item => item.key === ids.category)
      buttons = await elements(page, '.category-item__actions button')
      await buttons[categoryIndex * 2 + 1].tap()
      await page.waitFor(1200)
      await waitForCloud('分类删除未写入云数据库', () => {
        const shop = invoke('getShopConfig')
        return !(shop.categories || []).some(item => item.key === ids.category) ? shop : null
      })
    })

    await test('团购管理：筛选、详情、结束、删除、发布入口', async () => {
      let page = await open(miniProgram, '/pages/admin/group-list/index', 1800)
      await waitForData(page, d => (d.groups || []).some(item => item.id === seed.groupId), '团购列表')
      await tap(page, '.filter-item', '团购筛选全部', 0)
      await tap(page, '.filter-item', '团购筛选进行中', 1)
      await tap(page, '.filter-item', '团购筛选已结束', 2)
      await tap(page, '.filter-item', '团购筛选回全部', 0)
      await tap(page, '.group-card__actions button', '团购查看详情', 0, 900)
      await assertAt(miniProgram, '/pages/admin/group-detail/index', '团购查看详情')
      page = await open(miniProgram, '/pages/admin/group-list/index', 1600)
      await tap(page, '.group-card__actions button', '结束团购', 1, 1600)
      const ended = invoke('getGroup', { id: seed.groupId })
      assert(ended && ended.status === 'ended', '团购未结束')
      await tap(page, '.group-card__actions button', '删除团购', 1, 1600)
      const deleted = invoke('getGroup', { id: seed.groupId })
      assert(deleted === null, '团购未删除')
      page = await open(miniProgram, '/pages/admin/group-list/index', 1200)
      await tap(page, '.bottom-action button', '发布新团购入口', 0, 900)
      await assertAt(miniProgram, '/pages/admin/create-group/index', '发布新团购入口')
    })

    await test('发布团购页：选择项、批量选择、清空、商品勾选、发布', async () => {
      const page = await open(miniProgram, '/pages/admin/create-group/index', 1800)
      await waitForData(page, d => Array.isArray(d.products) && d.products.length > 0 && !d.loading, '开团商品池')
      await tap(page, '.picker-line', '截单时间选择', 0)
      await tap(page, '.picker-line', '发货时间选择', 1)
      await tap(page, '.picker-line', '履约方式选择', 2)
      await tap(page, '.batch-actions button', '一键全选', 0)
      let data = await page.data()
      assert((data.selectedItems || []).length > 0, '一键全选后未选中商品')
      await tap(page, '.batch-actions button', '清空重选', 1)
      data = await page.data()
      assert((data.selectedItems || []).length === 0, '清空重选后仍有商品')
      await tapOptional(page, '.category-chip', '分类筛选', 1)
      await tap(page, '.category-chip', '分类筛选回全部', 0)
      await tap(page, '.pool-item', '选择单个商品', 0)
      data = await page.data()
      assert((data.selectedItems || []).length === 1, '点击商品后未选中')
      await setVmData(miniProgram, { groupForm: { ...data.groupForm, title: `${testPrefix}UI发布团` } })
      await tap(page, '.summary-bar button', '发布本场团', 0, 2600)
      await assertAt(miniProgram, '/pages/admin/dashboard/index', '发布本场团后返回工作台')
      await waitForCloud('UI 发布团未写入', () => {
        const groups = invoke('listGroups')
        return (groups || []).some(item => String(item.name || item.title || '').startsWith(`${testPrefix}UI发布团`)) ? groups : null
      })
    })

    await test('商品编辑页：上传入口、运营开关、编辑保存、新增保存', async () => {
      let page = await open(miniProgram, `/pages/admin/product-edit/index?id=${ids.productEdit}`, 1600)
      let data = await waitForData(page, d => d.form && d.form.id === ids.productEdit, '编辑商品表单')
      await tap(page, '.upload-box__inner', '商品图片上传入口')
      await tapOptional(page, 'switch', '运营设置开关', 0)
      await setVmData(miniProgram, {
        form: {
          ...data.form,
          image: cloudImage,
          imagePreview: cloudImage,
          name: `${testPrefix}编辑商品已保存`,
          price: '10.9',
          originPrice: '19.9',
          stock: '70'
        }
      })
      await tap(page, '.bottom-action button', '保存修改', 0, 2200)
      await waitForCloud('编辑商品未写入', () => {
        const edited = invoke('getProduct', { id: ids.productEdit })
        return edited && edited.name.includes('已保存') ? edited : null
      })

      page = await open(miniProgram, '/pages/admin/product-edit/index', 1600)
      data = await page.data()
      await tap(page, '.upload-box__inner', '新增商品图片入口')
      await setVmData(miniProgram, {
        form: {
          ...data.form,
          image: cloudImage,
          imagePreview: cloudImage,
          categoryKey: 'cake',
          name: `${testPrefix}新增商品`,
          price: '11.9',
          originPrice: '21.9',
          stock: '12',
          desc: `${testPrefix}新增商品描述`,
          detailText: `${testPrefix}新增商品详情`,
          showActivity: true
        }
      })
      await tap(page, '.bottom-action button', '新增商品保存', 0, 2400)
      await waitForCloud('新增商品未写入', () => {
        const products = invoke('listProducts')
        return (products || []).some(item => item.name === `${testPrefix}新增商品`) ? products : null
      })
    })

    await test('商品管理页：筛选、新增、编辑、上下架、删除', async () => {
      let page = await open(miniProgram, '/pages/admin/product-manage/index', 1800)
      await waitForData(page, d => Array.isArray(d.products) && !d.loading, '商品管理列表')
      await tap(page, '.toolbar__tab', '商品筛选全部', 0)
      await tap(page, '.toolbar__tab', '商品筛选上架中', 1)
      await tap(page, '.toolbar__tab', '商品筛选已下架', 2)
      await tap(page, '.toolbar__tab', '商品筛选回全部', 0)
      await tap(page, '.toolbar__add', '商品新增入口', 0, 900)
      await assertAt(miniProgram, '/pages/admin/product-edit/index', '商品新增入口')

      page = await open(miniProgram, '/pages/admin/product-manage/index', 1600)
      await tap(page, '.product-card__actions button', '商品编辑入口', 0, 900)
      await assertAt(miniProgram, '/pages/admin/product-edit/index', '商品编辑入口')

      page = await open(miniProgram, '/pages/admin/product-manage/index', 1600)
      await tap(page, '.product-card__actions button', '商品下架', 1, 1600)
      const inactive = invoke('getProduct', { id: ids.productManage })
      assert(inactive && inactive.status === 'inactive', '商品下架未写入')
      page = await open(miniProgram, '/pages/admin/product-manage/index', 1600)
      await tap(page, '.toolbar__tab', '切到已下架删除商品', 2)
      await tap(page, '.product-card__actions button', '商品删除', 2, 1600)
      const deleted = invoke('getProduct', { id: ids.productManage })
      assert(deleted === null, '商品删除未写入')
    })

    await test('商品底部页：筛选、搜索清空、新增、编辑、上下架、删除', async () => {
      let page = await open(miniProgram, '/pages/admin/stock-summary/index', 1800)
      await waitForData(page, d => Array.isArray(d.products) && !d.loading, '商品底部页列表')
      await tap(page, '.category-tab', '商品底部筛选全部', 0)
      await tap(page, '.category-tab', '商品底部筛选上架中', 1)
      await tap(page, '.category-tab', '商品底部筛选已下架', 2)
      await setPageData(page, { keyword: testPrefix })
      await tap(page, '.search-clear', '商品底部搜索清空')
      await tap(page, '.add-btn', '商品底部新增入口', 0, 900)
      await assertAt(miniProgram, '/pages/admin/product-edit/index', '商品底部新增入口')

      page = await open(miniProgram, '/pages/admin/stock-summary/index', 1600)
      await tap(page, '.product-card__actions button', '商品底部编辑入口', 0, 900)
      await assertAt(miniProgram, '/pages/admin/product-edit/index', '商品底部编辑入口')

      page = await open(miniProgram, '/pages/admin/stock-summary/index', 1600)
      await tap(page, '.product-card__actions button', '商品底部下架', 1, 1600)
      const inactive = invoke('getProduct', { id: ids.productStock })
      assert(inactive && inactive.status === 'inactive', '商品底部下架未写入')
      page = await open(miniProgram, '/pages/admin/stock-summary/index', 1600)
      await tap(page, '.category-tab', '商品底部切到已下架', 2)
      await tap(page, '.product-card__actions button', '商品底部删除', 2, 1600)
      const deleted = invoke('getProduct', { id: ids.productStock })
      assert(deleted === null, '商品底部删除未写入')
    })

    await test('订单列表：状态筛选、搜索清空、查看、状态推进', async () => {
      let page = await open(miniProgram, '/pages/admin/order-list/index', 1800)
      await waitForData(page, d => Array.isArray(d.list) && !d.loading, '订单列表')
      await tap(page, '.category-tab', '订单筛选全部', 0)
      await tap(page, '.category-tab', '订单筛选待发货', 1)
      await tap(page, '.category-tab', '订单筛选配送中', 2)
      await tap(page, '.category-tab', '订单筛选已完成', 3)
      await tap(page, '.category-tab', '订单筛选已取消', 4)
      await setVmData(miniProgram, { keyword: testPrefix })
      await tap(page, '.search-clear', '订单搜索清空')
      await setVmData(miniProgram, { active: 'pendingDelivery', keyword: testPrefix })
      await page.waitFor(500)
      await tap(page, '.order-card__actions button', '订单查看详情', 0, 900)
      await assertAt(miniProgram, '/pages/admin/order-detail/index', '订单查看详情')

      page = await open(miniProgram, '/pages/admin/order-list/index', 1600)
      await setVmData(miniProgram, { active: 'pendingDelivery', keyword: '订单列表' })
      await page.waitFor(500)
      await tap(page, '.order-card__actions button', '订单列表标记发货', 1, 1800)
      await waitForCloud('订单列表状态推进未写入', () => {
        const updated = invoke('getOrder', { id: seed.orderList.id })
        return updated && updated.status === 'delivering' ? updated : null
      })

      page = await open(miniProgram, '/pages/admin/order-list/index', 1600)
      await setVmData(miniProgram, { active: 'completed', keyword: '已完成订单' })
      await page.waitFor(500)
      await tapOptional(page, '.order-card__actions button', '已完成订单再来一单按钮', 1, 600)
    })

    await test('订单详情：复制地址、联系顾客、标记发货、标记完成', async () => {
      const page = await open(miniProgram, `/pages/admin/order-detail/index?id=${seed.orderDetail.id}`, 1600)
      await tap(page, '.bottom-actions button', '订单详情复制地址', 0)
      await tap(page, '.bottom-actions button', '订单详情联系顾客', 1)
      await tap(page, '.bottom-actions button', '订单详情标记发货', 2, 1600)
      let order = invoke('getOrder', { id: seed.orderDetail.id })
      assert(order && order.status === 'delivering', '订单详情标记发货未写入')
      await tap(page, '.bottom-actions button', '订单详情标记完成', 2, 1600)
      order = invoke('getOrder', { id: seed.orderDetail.id })
      assert(order && order.status === 'completed', '订单详情标记完成未写入')
    })

    await test('发货管理：状态/履约筛选、搜索清空、地址按钮、全选、导出、标记完成', async () => {
      const page = await open(miniProgram, '/pages/admin/delivery-address/index', 1800)
      await waitForData(page, d => Array.isArray(d.list) && d.list.length > 0, '发货地址列表')
      await tapOptional(page, '.category-tab', '发货状态筛选', 0)
      await tap(page, '.fulfillment-tab', '履约筛选全部', 0)
      await tap(page, '.fulfillment-tab', '履约筛选快递', 1)
      await setPageData(page, { keyword: '配送勾选', fulfillmentFilter: 'all' })
      await page.waitFor(500)
      await tap(page, '.search-clear', '发货搜索清空')
      await setPageData(page, { keyword: '配送勾选', fulfillmentFilter: 'all', active: 'all', selectedIds: [] })
      await page.waitFor(500)
      await tap(page, '.address-card', '发货地址卡片勾选', 0)
      await tap(page, '.address-card__action', '发货复制地址', 0)
      await tapOptional(page, '.address-card__action', '发货联系顾客', 1)
      await setPageData(page, { selectedIds: [] })
      await tap(page, '.batch-check', '发货全选')
      let data = await page.data()
      assert((data.selectedIds || []).includes(seed.orderDelivery.id), '发货全选未选中测试订单')
      await tap(page, '.export', '导出快递单')
      await tap(page, '.done', '标记已发货/完成', 0, 1800)
      const order = invoke('getOrder', { id: seed.orderDelivery.id })
      assert(order && order.status === 'completed', '发货批量完成未写入')
    })
  } finally {
    try { await restoreMocks(miniProgram) } catch {}
    await miniProgram.close()
    if (originalBannerConfig) {
      try { invoke('updateBannerConfig', originalBannerConfig) } catch {}
    }
    if (originalShopConfig) {
      try { invoke('updateShopConfig', originalShopConfig) } catch {}
    }
    await cleanupCloudData()
  }
}

runUiAudit().then(() => {
  const failed = results.filter(item => item.status !== 'PASS')
  const summary = {
    ok: failed.length === 0,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    ids,
    results
  }
  console.log(JSON.stringify(summary, null, 2))
  if (failed.length) process.exit(1)
}).catch(error => {
  console.error(error)
  process.exit(1)
})
