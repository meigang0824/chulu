<template>
  <view class="page confirm">
    <CustomNavBar title="确认订单" showBack />

    <AddressCard class="confirm__address" :address="address" variant="receiver" @select="chooseAddress" />

    <view class="goods card">
      <view class="card-title">商品清单</view>
      <view class="goods-row" v-for="item in orderItems" :key="item.id">
        <image class="goods-row__image" :src="item.image" mode="aspectFill" />
        <view class="goods-row__info">
          <view class="goods-row__name">
            {{ item.name }}
            <StatusTag type="normal" text="团购价" size="sm" plain />
          </view>
          <view class="goods-row__meta">
            <text class="goods-row__price">￥{{ item.price }}</text>
            <text class="goods-row__count">x{{ item.count }}</text>
          </view>
        </view>
        <view class="goods-row__total">￥{{ itemTotal(item) }}</view>
      </view>
    </view>

    <view class="line-card" @tap="pickDeliveryTime">
      <view>配送时间</view>
      <text>{{ checkoutText.deliveryTime }} 〉</text>
    </view>
    <view class="line-card" @tap="editNote">
      <view>订单备注</view>
      <text>{{ orderNote || checkoutText.notePlaceholder }} 〉</text>
    </view>

    <view class="fee card">
      <view class="fee__row">
        <text>商品金额</text>
        <text>￥{{ amount.productAmount }}</text>
      </view>
      <view class="fee__row">
        <text>配送费</text>
        <text>￥{{ amount.deliveryFee }}</text>
      </view>
      <view class="fee__row">
        <text>团购优惠</text>
        <text class="minus">-￥{{ amount.discount }}</text>
      </view>
      <view class="fee__total">
        <text>合计</text>
        <text>￥{{ amount.payable }}</text>
      </view>
    </view>

    <view v-if="checkoutText.serviceText" class="service-tip">{{ checkoutText.serviceText }}</view>

    <view class="bottom-pay">
      <view class="bottom-pay__amount">
        <view>实付款：<text>￥{{ amount.payable }}</text></view>
        <view>{{ addressReady ? `已优惠 ￥${amount.discount}` : '请先选择收货地址' }}</view>
      </view>
      <button :class="{ 'is-disabled': !addressReady }" @tap="pay">{{ addressReady ? checkoutText.payText : '选择地址后下单' }}</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AddressCard from '@/components/AddressCard/AddressCard.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import { calcOrderAmount } from '@/utils/calc'
import { createOrder, getDefaultAddress, getProductById, getShopConfig } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess, requireLogin } from '@/utils/auth'
import { clearCheckoutItems, getCheckoutItems, removeCartItems } from '@/utils/shopState'

export default {
  components: { CustomNavBar, AddressCard, StatusTag },
  data() {
    return {
      product: null,
      orderItems: [],
      count: 1,
      address: null,
      checkout: {},
      orderNote: '',
      fromCart: false
    }
  },
  computed: {
    amount() {
      return calcOrderAmount(this.orderItems, this.checkout.deliveryFee, this.checkout.groupDiscount)
    },
    productTotal() {
      return this.amount.productAmount.toFixed(2)
    },
    checkoutText() {
      return {
        deliveryTime: this.cleanText(this.checkout.deliveryTime, '次日打包发货'),
        notePlaceholder: this.cleanText(this.checkout.notePlaceholder, '口味、偏好或建议等(选填)'),
        serviceText: this.cleanText(this.checkout.serviceText, ''),
        payText: this.cleanText(this.checkout.payText, '微信支付')
      }
    },
    stepperMax() {
      if (Number(this.product && this.product.stock) <= 0) return 0
      const limit = Number(this.product && this.product.limit)
      return limit > 1 ? limit : 99
    },
    addressReady() {
      return Boolean(this.address && this.address.receiver && this.address.address)
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/order/confirm/index', '下单功能需要登录后使用')) return
    if (query.from === 'cart') {
      this.fromCart = true
      this.orderItems = getCheckoutItems()
    } else if (query.id) {
      this.product = await getProductById(query.id)
      if (query.count) this.count = Number(query.count)
      this.normalizeCount()
      if (this.product) {
        this.orderItems = [{
          id: this.product.id,
          productId: this.product.id,
          count: this.count,
          name: this.product.name,
          price: this.product.price,
          image: this.product.imageFileID || this.product.image,
          stock: this.product.stock,
          limit: this.stepperMax
        }]
      }
    }
    if (!this.orderItems.length) {
      uni.showToast({ title: '请选择商品', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 600)
      return
    }
    const shopConfig = await getShopConfig()
    this.checkout = shopConfig.checkout || {}
    this.address = await getDefaultAddress()
  },
  onShow() {
    if (!ensurePageAccess('/pages/order/confirm/index', '下单功能需要登录后使用')) return
    const selected = uni.getStorageSync('buyer_selected_address')
    if (selected && selected.address) {
      this.address = selected
    }
  },
  methods: {
    chooseAddress() {
      uni.navigateTo({ url: '/pages/address/list/index?select=1' })
    },
    cleanText(value, fallback = '') {
      const text = String(value === undefined || value === null ? '' : value).trim()
      if (!text || text === 'undefined' || text === 'null') return fallback
      return text
    },
    normalizeCount() {
      const max = this.stepperMax || 1
      const next = Math.min(Math.max(Number(this.count) || 1, 1), max)
      if (next !== this.count) this.count = next
    },
    itemTotal(item) {
      const total = Number(item.price || 0) * Number(item.count || 0)
      return total.toFixed(2)
    },
    pickDeliveryTime() {
      const options = ['明日配送', '后天配送', '门店自提（明日）']
      uni.showActionSheet({
        itemList: options,
        success: ({ tapIndex }) => {
          this.checkout = {
            ...this.checkout,
            deliveryTime: options[tapIndex] || this.checkoutText.deliveryTime
          }
        }
      })
    },
    editNote() {
      uni.showModal({
        title: '订单备注',
        editable: true,
        placeholderText: this.checkoutText.notePlaceholder || '请输入备注',
        content: this.orderNote,
        success: ({ confirm, content }) => {
          if (!confirm) return
          this.orderNote = String(content || '').trim()
        }
      })
    },
    async pay() {
      if (!requireLogin('下单功能需要登录后使用')) return
      this.normalizeCount()
      if (!this.address || !this.address.receiver || !this.address.address) {
        uni.showToast({ title: '请选择收货地址', icon: 'none' })
        return
      }
      try {
        uni.showLoading({ title: '提交中' })
        const result = await createOrder({
          items: this.orderItems.map(item => ({
            productId: item.productId || item.id,
            count: item.count,
            name: item.name,
            price: item.price,
            image: item.imageFileID || item.image
          })),
          address: this.address,
          note: this.orderNote,
          deliveryTime: this.checkoutText.deliveryTime,
          productAmount: this.amount.productAmount,
          deliveryFee: this.amount.deliveryFee,
          discount: this.amount.discount,
          payable: this.amount.payable,
          amount: this.amount.payable,
          fulfillmentMethod: '统一配送'
        })
        if (!result || !result.id) {
          uni.hideLoading()
          uni.showToast({ title: '下单失败', icon: 'none' })
          return
        }
        uni.hideLoading()
        uni.showToast({ title: '下单成功', icon: 'success' })
        if (this.fromCart) {
          removeCartItems(this.orderItems.flatMap(item => [item.id, item.productId, item._id]))
          clearCheckoutItems()
        }
        const orderId = result.id || result.orderNo
        const payable = result.payable || result.amount || this.amount.payable
        // 使用 storage 传递敏感数据，避免 URL 泄露
        uni.setStorageSync('order_success_data', { orderId, payable, receiver: this.address.receiver, phone: this.address.phone, deliveryTime: this.checkoutText.deliveryTime })
        setTimeout(() => {
          uni.redirectTo({ url: '/pages/order/success/index' })
        }, 800)
      } catch (error) {
        uni.hideLoading()
        showCloudError(error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.confirm {
  padding-bottom: 190rpx;
}

.confirm__address,
.goods,
.fee {
  margin-top: 24rpx;
}

.confirm__address {
  position: relative;
  overflow: hidden;
}

.confirm__address::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 8rpx;
  background: repeating-linear-gradient(135deg, #8fc1ea 0 24rpx, #fff 24rpx 36rpx, #ff7676 36rpx 60rpx, #fff 60rpx 72rpx);
}

.goods,
.fee {
  padding: 30rpx;
}

.card-title {
  @include text-card-title;
  font-weight: $font-weight-heavy;
}

.goods-row {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin-top: 28rpx;
}

.goods-row__image {
  flex-shrink: 0;
  width: 160rpx;
  height: 160rpx;
  border-radius: 24rpx;
}

.goods-row__info {
  flex: 1;
  min-width: 0;
}

.goods-row__name {
  display: flex;
  align-items: center;
  gap: 10rpx;
  @include text-body-strong;
  font-size: 32rpx;
  font-weight: $font-weight-heavy;
}

.goods-row__meta {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 24rpx;
}

.goods-row__price {
  @include text-price(38rpx);
  font-weight: $font-weight-heavy;
}

.goods-row__count {
  color: $color-text-regular;
  font-size: 28rpx;
  font-weight: 700;
}

.goods-row__total {
  flex-shrink: 0;
  min-width: 132rpx;
  @include text-price(36rpx);
  font-weight: $font-weight-heavy;
  text-align: right;
}

.line-card {
  margin-top: 22rpx;
}

.line-card view {
  color: $color-text-main;
  font-weight: $font-weight-bold;
}

.line-card text {
  @include text-body;
}

.fee__row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
  @include text-body($font-weight-regular, $color-text-main);
}

.minus {
  color: $color-primary;
}

.fee__total {
  display: flex;
  justify-content: space-between;
  padding-top: 24rpx;
  border-top: 1rpx dashed $color-border;
  @include text-card-title;
  font-weight: $font-weight-heavy;
}

.fee__total text:last-child {
  color: $color-primary;
  font-size: 48rpx;
}

.service-tip {
  @include flex-center;
  min-height: 64rpx;
  margin-top: 24rpx;
  color: $color-orange-dark;
  background: $color-orange-light;
  border: 1rpx solid rgba(200, 121, 50, 0.18);
  border-radius: $radius-card;
  @include text-body($font-weight-medium, $color-orange-dark);
}

.bottom-pay {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 24rpx;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 253, 249, 0.98);
  border-top: 1rpx solid $color-border-light;
  box-shadow: $shadow-bottom;
}

.bottom-pay__amount {
  flex: 1;
  min-width: 0;
}

.bottom-pay__amount view:first-child {
  @include text-body-strong;
  font-size: 30rpx;
  font-weight: $font-weight-bold;
}

.bottom-pay__amount text {
  @include text-price(48rpx);
}

.bottom-pay__amount view:last-child {
  margin-top: 8rpx;
  @include text-body($font-weight-regular, $color-text-regular);
  font-size: 26rpx;
}

.bottom-pay button {
  @include flex-center;
  flex: 1;
  min-width: 300rpx;
  height: 90rpx;
  color: #fff;
  background: $gradient-primary;
  border-radius: $radius-pill;
  box-shadow: $shadow-btn;
  @include font-base;
  font-size: 34rpx;
  font-weight: $font-weight-heavy;
}

.bottom-pay button.is-disabled {
  background: $color-text-light;
  box-shadow: none;
}

@media screen and (max-width: 430px) {
  .bottom-pay button {
    min-width: 240rpx;
  }
}
</style>
