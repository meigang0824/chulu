// Deprecated cloud function. Order cancellation must go through businessApi so
// authentication, ownership and stock rollback stay in one transaction path.
exports.main = async () => ({
  ok: false,
  code: 'DEPRECATED_FUNCTION',
  message: '请使用 businessApi.updateOrderStatus'
})
