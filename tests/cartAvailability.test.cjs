const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

function loadCartAvailability() {
  const filename = path.join(__dirname, '..', 'utils', 'cartAvailability.js')
  let source = fs.readFileSync(filename, 'utf8')
  source = source.replace(/export function /g, 'function ')
  source += '\nmodule.exports = { findActiveCartGroup, groupContainsProduct }'
  const sandbox = { module: { exports: {} }, exports: {} }
  vm.runInNewContext(source, sandbox, { filename })
  return sandbox.module.exports
}

function testRejectsClosedOriginalGroup() {
  const { findActiveCartGroup } = loadCartAvailability()
  const result = findActiveCartGroup(
    { productId: 'p1', groupId: 'old-group' },
    [
      { id: 'new-group', status: 'active', products: [{ productId: 'p1' }] },
      { id: 'old-group', status: 'completed', products: [{ productId: 'p1' }] }
    ],
    Date.parse('2026-07-09T10:00:00+08:00')
  )
  assert.strictEqual(result, null)
}

function testFindsCurrentGroupWhenCartHasNoGroupId() {
  const { findActiveCartGroup } = loadCartAvailability()
  const result = findActiveCartGroup(
    { productId: 'p1' },
    [
      { id: 'active-group', status: 'active', deadlineAt: '2026-07-10T10:00:00+08:00', products: [{ productId: 'p1' }] }
    ],
    Date.parse('2026-07-09T10:00:00+08:00')
  )
  assert.strictEqual(result.id, 'active-group')
}

testRejectsClosedOriginalGroup()
testFindsCurrentGroupWhenCartHasNoGroupId()
console.log('cart availability tests passed')
