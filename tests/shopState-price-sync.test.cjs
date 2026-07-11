const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

function loadShopState(initialStorage = []) {
  const storage = {
    chulu_cart_items: initialStorage
  }
  const uni = {
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    removeTabBarBadge() {},
    setTabBarBadge() {},
    $emit() {}
  }
  const filename = path.join(__dirname, '..', 'utils', 'shopState.js')
  let source = fs.readFileSync(filename, 'utf8')
  source = source
    .replace("import { IMAGE_ASSETS, normalizeImageUrl } from '@/utils/image'\n", "const IMAGE_ASSETS = { product: 'fallback.png' }\nconst normalizeImageUrl = (value, fallback) => value || fallback\n")
    .replace(/export function /g, 'function ')
  source += '\nmodule.exports = { addCartItem, getCartItems, saveCartItems }'
  const sandbox = { module: { exports: {} }, exports: {}, uni }
  vm.runInNewContext(source, sandbox, { filename })
  return { api: sandbox.module.exports, storage }
}

function testExistingCartItemRefreshesSnapshot() {
  const { api } = loadShopState([
    {
      id: 'p1',
      productId: 'p1',
      name: '胡萝卜米碱水球',
      price: 0.01,
      originPrice: 0.01,
      image: 'old.png',
      imageFileID: 'old.png',
      stock: 10,
      limit: 0,
      count: 1
    }
  ])

  api.addCartItem({
    id: 'p1',
    name: '胡萝卜米碱水球',
    desc: 'fresh',
    price: 15,
    originPrice: 15,
    image: 'new.png',
    imageFileID: 'new.png',
    stock: 10,
    limit: 0,
    groupId: 'g1',
    groupName: '今日团'
  }, 1)

  const [item] = api.getCartItems()
  assert.strictEqual(item.price, 15)
  assert.strictEqual(item.originPrice, 15)
  assert.strictEqual(item.name, '胡萝卜米碱水球')
  assert.strictEqual(item.imageFileID, 'new.png')
  assert.strictEqual(item.count, 2)
}

testExistingCartItemRefreshesSnapshot()
console.log('shopState price sync tests passed')
