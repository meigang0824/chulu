export function calcOrderAmount(items = [], deliveryFee = 0, discount = 0) {
  const productAmount = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.count || 0), 0)
  const payable = productAmount + Number(deliveryFee || 0) - Number(discount || 0)
  return { productAmount: Number(productAmount.toFixed(2)), deliveryFee: Number(deliveryFee.toFixed(2)), discount: Number(discount.toFixed(2)), payable: Number(payable.toFixed(2)) }
}
