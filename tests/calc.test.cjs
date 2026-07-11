const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

function loadCalc() {
  const filename = path.join(__dirname, '..', 'utils', 'calc.js')
  let source = fs.readFileSync(filename, 'utf8')
  source = source.replace(/export function /g, 'function ')
  source += '\nmodule.exports = { calcOrderAmount }'
  const sandbox = { module: { exports: {} }, exports: {} }
  vm.runInNewContext(source, sandbox, { filename })
  return sandbox.module.exports
}

function testDeliveryFeeAppliesBelowFreeShippingThreshold() {
  const { calcOrderAmount } = loadCalc()
  const amount = calcOrderAmount([{ price: 50, count: 1 }], 8, 0, 88)
  assert.strictEqual(amount.productAmount, 50)
  assert.strictEqual(amount.deliveryFee, 8)
  assert.strictEqual(amount.payable, 58)
  assert.strictEqual(amount.freeShippingMissing, 38)
}

function testDeliveryFeeWaivedAtThreshold() {
  const { calcOrderAmount } = loadCalc()
  const amount = calcOrderAmount([{ price: 88, count: 1 }], 8, 0, 88)
  assert.strictEqual(amount.deliveryFee, 0)
  assert.strictEqual(amount.payable, 88)
}

testDeliveryFeeAppliesBelowFreeShippingThreshold()
testDeliveryFeeWaivedAtThreshold()
console.log('calc tests passed')
