export function calcOrderAmount(items = [], deliveryFee = 0, discount = 0, minimumOrderAmount = 0) {
  const productAmount = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.count || 0), 0)
  const baseDeliveryFee = Number(deliveryFee || 0)
  const minimumAmount = Number(minimumOrderAmount || 0)
  const discountAmount = Number(discount || 0)
  const finalDeliveryFee = minimumAmount > 0 ? 0 : baseDeliveryFee
  const payable = Math.max(0, productAmount + finalDeliveryFee - discountAmount)
  return {
    productAmount: Number(productAmount.toFixed(2)),
    deliveryFee: Number(finalDeliveryFee.toFixed(2)),
    baseDeliveryFee: Number(baseDeliveryFee.toFixed(2)),
    minimumOrderAmount: Number(minimumAmount.toFixed(2)),
    minimumOrderMissing: Number(Math.max(0, minimumAmount - productAmount).toFixed(2)),
    freeShippingAmount: Number(minimumAmount.toFixed(2)),
    freeShippingMissing: Number(Math.max(0, minimumAmount - productAmount).toFixed(2)),
    discount: Number(discountAmount.toFixed(2)),
    payable: Number(payable.toFixed(2))
  }
}
