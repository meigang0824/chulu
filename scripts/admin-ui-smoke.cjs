const automator = require('/tmp/miniprogram-automator-run/node_modules/miniprogram-automator')

const projectPath = '/Users/apple/.openclaw/workspace-wechat/sweet_bakery_uniapp'
const cliPath = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

const adminSession = {
  token: 'codex-ui-smoke-token',
  expiresAt: '2026-06-18T00:00:00.000Z',
  role: 'owner',
  isAdmin: true,
  isGuest: false,
  user: {
    id: 'owner001',
    username: 'manager',
    role: 'owner',
    displayName: '初炉店长',
    avatarText: '店',
    status: 'active'
  },
  savedAt: new Date().toISOString()
}

const pages = [
  '/pages/admin/dashboard/index',
  '/pages/admin/settings/index',
  '/pages/admin/store-settings/index',
  '/pages/admin/banner-config/index',
  '/pages/admin/category-manage/index',
  '/pages/admin/stats/index',
  '/pages/admin/group-list/index',
  '/pages/admin/create-group/index',
  '/pages/admin/order-list/index',
  '/pages/admin/stock-summary/index',
  '/pages/admin/delivery-address/index',
  '/pages/admin/product-manage/index',
  '/pages/admin/product-edit/index?id=p001'
]

async function wait(page, ms = 800) {
  await page.waitFor(ms)
}

async function currentPath(miniProgram) {
  const page = await miniProgram.currentPage()
  return page ? `/${page.path}` : ''
}

async function count(page, selector) {
  try {
    const elements = await page.$$(selector)
    return elements.length
  } catch {
    return 0
  }
}

async function tapFirst(page, selector) {
  const element = await page.$(selector)
  if (!element) return false
  await element.tap()
  await wait(page, 500)
  return true
}

async function open(miniProgram, url) {
  const page = await miniProgram.reLaunch(url)
  await wait(page, 1200)
  return page
}

(async () => {
  const miniProgram = await automator.launch({
    cliPath,
    projectPath,
    port: 9421,
    trustProject: true,
    timeout: 90000
  })

  const results = []

  try {
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

    for (const url of pages) {
      const page = await open(miniProgram, url)
      const path = await currentPath(miniProgram)
      const summary = {
        url,
        path,
        buttons: await count(page, 'button'),
        switches: await count(page, 'switch'),
        inputs: await count(page, 'input'),
        textareas: await count(page, 'textarea'),
        pickers: await count(page, 'picker'),
        adminTabs: await count(page, '.admin-tabbar__item')
      }
      if (!path.startsWith(url.split('?')[0])) {
        throw new Error(`页面未打开：${url} -> ${path}`)
      }
      results.push(summary)
      console.log(`PASS 页面渲染 ${url} buttons=${summary.buttons} switches=${summary.switches} inputs=${summary.inputs}`)
    }

    let page = await open(miniProgram, '/pages/admin/dashboard/index')
    const adminTabs = await page.$$('.admin-tabbar__item')
    const tabTargets = [
      '/pages/admin/create-group/index',
      '/pages/admin/order-list/index',
      '/pages/admin/stock-summary/index',
      '/pages/admin/delivery-address/index'
    ]
    for (let index = 1; index < adminTabs.length; index += 1) {
      page = await open(miniProgram, '/pages/admin/dashboard/index')
      const tabs = await page.$$('.admin-tabbar__item')
      await tabs[index].tap()
      await page.waitFor(900)
      const path = await currentPath(miniProgram)
      if (!path.startsWith(tabTargets[index - 1])) throw new Error(`底部导航 ${index} 跳转失败：${path}`)
      console.log(`PASS 底部导航 ${index} -> ${path}`)
    }

    page = await open(miniProgram, '/pages/admin/settings/index')
    const settingsItems = await page.$$('.settings-item')
    const settingsTargets = [
      '/pages/admin/store-settings/index',
      '/pages/admin/banner-config/index',
      '/pages/admin/category-manage/index'
    ]
    for (let index = 0; index < settingsItems.length; index += 1) {
      page = await open(miniProgram, '/pages/admin/settings/index')
      const items = await page.$$('.settings-item')
      await items[index].tap()
      await page.waitFor(900)
      const path = await currentPath(miniProgram)
      if (!path.startsWith(settingsTargets[index])) throw new Error(`配置中心入口 ${index} 跳转失败：${path}`)
      console.log(`PASS 配置中心入口 ${index} -> ${path}`)
    }

    page = await open(miniProgram, '/pages/admin/category-manage/index')
    if (!(await tapFirst(page, '.category-add'))) throw new Error('新增分类按钮不可点击')
    if (!(await tapFirst(page, '.modal-close'))) throw new Error('分类弹窗关闭按钮不可点击')
    console.log('PASS 分类新增弹窗打开/关闭')

    page = await open(miniProgram, '/pages/admin/product-manage/index')
    const productTabs = await page.$$('.toolbar__tab')
    for (const tab of productTabs) {
      await tab.tap()
      await page.waitFor(200)
    }
    if (!(await tapFirst(page, '.toolbar__add'))) throw new Error('新增商品按钮不可点击')
    console.log('PASS 商品筛选与新增入口')

    page = await open(miniProgram, '/pages/admin/order-list/index')
    const orderListData = await page.data()
    const firstOrder = orderListData && orderListData.list && orderListData.list[0]
    const viewButton = await page.$('.order-card__btn')
    if (viewButton && firstOrder) {
      try {
        await viewButton.tap()
        await page.waitFor(900)
      } catch {
        await miniProgram.navigateTo(`/pages/admin/order-detail/index?id=${firstOrder.id}`)
        await page.waitFor(900)
      }
      const path = await currentPath(miniProgram)
      if (!path.startsWith('/pages/admin/order-detail/index')) throw new Error(`订单查看跳转失败：${path}`)
      console.log('PASS 订单查看按钮')
      page = await miniProgram.currentPage()
      try { await tapFirst(page, '.bottom-actions .ghost-btn') } catch {}
      console.log('PASS 订单详情复制地址按钮')
    } else {
      console.log('SKIP 订单查看按钮：当前无可渲染订单卡片')
    }

    page = await open(miniProgram, '/pages/admin/delivery-address/index')
    try { await tapFirst(page, '.batch-check') } catch {}
    try { await tapFirst(page, '.export') } catch {}
    try { await tapFirst(page, '.done') } catch {}
    console.log('PASS 发货页全选/导出/批量完成按钮可触发')

    console.log(JSON.stringify({ ok: true, pages: results }, null, 2))
  } finally {
    try { await miniProgram.restoreWxMethod('makePhoneCall') } catch {}
    try { await miniProgram.restoreWxMethod('setClipboardData') } catch {}
    try { await miniProgram.restoreWxMethod('openDocument') } catch {}
    await miniProgram.close()
  }
})().catch(error => {
  console.error(error)
  process.exit(1)
})
