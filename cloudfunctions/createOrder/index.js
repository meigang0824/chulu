// Deprecated cloud function. Order creation must go through businessApi so
// authentication, ownership and stock deduction stay in one transaction path.
exports.main = async () => ({
  ok: false,
  code: 'DEPRECATED_FUNCTION',
  message: '请使用 businessApi.createOrder'
})
