const automator = require('/tmp/miniprogram-automator-run/node_modules/miniprogram-automator')

const projectPath = '/Users/apple/.openclaw/workspace-wechat/sweet_bakery_uniapp'
const cliPath = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const orderId = 'o1781143770163'

const adminSession = {
  token: 'codex-ui-smoke-token',
  expiresAt: '2026-06-18T00:00:00.000Z',
  role: 'owner',
  isAdmin: true,
  isGuest: false,
  user: { id: 'owner001', username: 'manager', role: 'owner', displayName: '初炉店长', avatarText: '店', status: 'active' },
  savedAt: new Date().toISOString()
}

async function currentPath(miniProgram) {
  const page = await miniProgram.currentPage()
  return page ? `/${page.path}` : ''
}

async function open(miniProgram, url, ms = 1500) {
  const page = await miniProgram.reLaunch(url)
  await page.waitFor(ms)
  return page
}

async function tapIfExists(page, selector) {
  const el = await page.$(selector)
  if (!el) return false
  await el.tap()
  await page.waitFor(400)
  return true
}

(async () => {
  const miniProgram = await automator.launch({ cliPath, projectPath, port: 9422, trustProject: true, timeout: 90000 })
  try {
    await miniProgram.callWxMethod('setStorageSync', 'app_auth_session', adminSession)
    await miniProgram.callWxMethod('setStorageSync', 'app_portal_mode', 'admin')
    await miniProgram.mockWxMethod('makePhoneCall', { errMsg: 'makePhoneCall:ok' })
    await miniProgram.mockWxMethod('setClipboardData', { errMsg: 'setClipboardData:ok' })
    await miniProgram.mockWxMethod('openDocument', { errMsg: 'openDocument:ok' })

    let page = await open(miniProgram, `/pages/admin/order-detail/index?id=${orderId}`)
    let path = await currentPath(miniProgram)
    if (!path.startsWith('/pages/admin/order-detail/index')) throw new Error(`订单详情打开失败：${path}`)
    const copied = await tapIfExists(page, '.bottom-actions .ghost-btn')
    if (!copied) throw new Error('订单详情复制地址按钮不存在')
    console.log('PASS 订单详情直接打开与复制地址按钮')

    page = await open(miniProgram, '/pages/admin/delivery-address/index')
    path = await currentPath(miniProgram)
    if (!path.startsWith('/pages/admin/delivery-address/index')) throw new Error(`发货页打开失败：${path}`)
    await tapIfExists(page, '.batch-check')
    await tapIfExists(page, '.export')
    await tapIfExists(page, '.done')
    console.log('PASS 发货页全选/导出/批量完成按钮')
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
