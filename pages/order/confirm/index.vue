<template>
  <view class="page confirm">
    <CustomNavBar title="确认订单" showBack />

    <AddressCard class="confirm__address" :address="address" variant="receiver" @select="chooseAddress" />

    <view class="goods card">
      <view class="card-title">商品清单</view>
      <view class="goods-row">
        <image class="goods-row__image" :src="product.image" mode="aspectFill" />
        <view class="goods-row__info">
          <view class="goods-row__name">
            {{ product.name }}
            <StatusTag type="normal" text="团购价" size="sm" plain />
          </view>
          <view class="goods-row__price">￥{{ product.price }}</view>
        </view>
        <QuantityStepper v-model="count" :max="product.limit || 5" />
      </view>
      <view class="goods-row__total">￥{{ productTotal }}</view>
    </view>

    <view class="line-card" @tap="pickDeliveryTime">
      <view>配送时间</view>
      <text>{{ checkout.deliveryTime }} 〉</text>
    </view>
    <view class="fulfillment card">
      <view class="card-title">履约方式</view>
      <view class="fulfillment__tabs">
        <view
          v-for="item in fulfillmentOptions"
          :key="item"
          class="fulfillment__tab"
          :class="{ active: selectedFulfillment === item }"
          @tap="selectedFulfillment = item"
        >
          {{ item }}
        </view>
      </view>
    </view>
    <view class="line-card" @tap="editNote">
      <view>订单备注</view>
      <text>{{ orderNote || checkout.notePlaceholder }} 〉</text>
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

    <view class="service-tip">{{ checkout.serviceText }}</view>

    <view class="bottom-pay">
      <view class="bottom-pay__amount">
        <view>实付款：<text>￥{{ amount.payable }}</text></view>
        <view>{{ addressReady ? `已优惠 ￥${amount.discount}` : '请先选择收货地址' }}</view>
      </view>
      <button :class="{ 'is-disabled': !addressReady }" @tap="pay">{{ addressReady ? checkout.payText : '选择地址后下单' }}</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import QuantityStepper from '@/components/QuantityStepper/QuantityStepper.vue'
import AddressCard from '@/components/AddressCard/AddressCard.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import { calcOrderAmount } from '@/utils/calc'
import { createOrder, getDefaultAddress, getProductById, getShopConfig } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess, requireLogin } from '@/utils/auth'

export default {
  components: { CustomNavBar, QuantityStepper, AddressCard, StatusTag },
  data() {
    return {
      product: null,
      count: 1,
      address: null,
      checkout: {},
      selectedFulfillment: '快递发货',
      orderNote: ''
    }
  },
  computed: {
    amount() {
      return calcOrderAmount([{ ...this.product, count: this.count }], this.checkout.deliveryFee, this.checkout.groupDiscount)
    },
    productTotal() {
      return this.amount.productAmount.toFixed(2)
    },
    addressReady() {
      return Boolean(this.address && this.address.receiver && this.address.address)
    },
    fulfillmentOptions() {
      const product = this.product || {}
      const range = this.checkout.fulfillmentMethods || product.fulfillmentMethods
      if (Array.isArray(range) && range.length) return range
      const text = product.deliveryRange || this.checkout.deliveryRange || ''
      const list = String(text).split(/[\/、,，]/).map(item => item.trim()).filter(Boolean)
      return list.length ? list : ['快递发货', '门店自提', '同城配送']
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/order/confirm/index', '下单功能需要登录后使用')) return
    if (query.id) this.product = await getProductById(query.id)
    if (!this.product) {
      uni.showToast({ title: '商品不存在', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 600)
      return
    }
    const shopConfig = await getShopConfig()
    this.checkout = shopConfig.checkout || {}
    this.selectedFulfillment = this.checkout.fulfillmentMethod || this.fulfillmentOptions[0] || '快递发货'
    this.address = await getDefaultAddress()
    if (query.count) this.count = Number(query.count)
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
    pickDeliveryTime() {
      const options = ['明日配送', '后天配送', '门店自提（明日）']
      uni.showActionSheet({
        itemList: options,
        success: ({ tapIndex }) => {
          this.checkout = {
            ...this.checkout,
            deliveryTime: options[tapIndex] || this.checkout.deliveryTime
          }
        }
      })
    },
    editNote() {
      uni.showModal({
        title: '订单备注',
        editable: true,
        placeholderText: this.checkout.notePlaceholder || '请输入备注',
        content: this.orderNote,
        success: ({ confirm, content }) => {
          if (!confirm) return
          this.orderNote = String(content || '').trim()
        }
      })
    },
    async pay() {
      if (!requireLogin('下单功能需要登录后使用')) return
      if (!this.address || !this.address.receiver || !this.address.address) {
        uni.showToast({ title: '请选择收货地址', icon: 'none' })
        return
      }
      try {
        uni.showLoading({ title: '提交中' })
        const image = this.product.imageFileID || this.product.image
        const result = await createOrder({
          items: [{ productId: this.product.id, count: this.count, name: this.product.name, price: this.product.price, image }],
          address: this.address,
          note: this.orderNote,
          deliveryTime: this.checkout.deliveryTime,
          productAmount: this.amount.productAmount,
          deliveryFee: this.amount.deliveryFee,
          discount: this.amount.discount,
          payable: this.amount.payable,
          amount: this.amount.payable,
          fulfillmentMethod: this.selectedFulfillment || this.checkout.fulfillmentMethod || '快递发货'
        })
        if (!result || !result.id) {
          uni.hideLoading()
          uni.showToast({ title: '下单失败', icon: 'none' })
          return
        }
        uni.hideLoading()
        uni.showToast({ title: '下单成功', icon: 'success' })
        const orderId = result.id || result.orderNo
        const payable = result.payable || result.amount || this.amount.payable
        // 使用 storage 传递敏感数据，避免 URL 泄露
        uni.setStorageSync('order_success_data', { orderId, payable, receiver: this.address.receiver, phone: this.address.phone, deliveryTime: this.checkout.deliveryTime })
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
.fulfillment,
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
  height: 10rpx;
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
  flex-wrap: wrap;
  gap: 22rpx;
  margin-top: 28rpx;
}

.goods-row__image {
  flex-shrink: 0;
  width: 160rpx;
  height: 160rpx;
  border-radius: 20rpx;
}

.goods-row__info {
  flex: 1;
  min-width: 260rpx;
}

.goods-row__name {
  display: flex;
  align-items: center;
  gap: 10rpx;
  @include text-body-strong;
  font-size: 32rpx;
  font-weight: $font-weight-heavy;
}

.goods-row__price {
  margin-top: 24rpx;
  @include text-price(38rpx);
  font-weight: $font-weight-heavy;
}

.goods-row__total {
  width: 100%;
  margin-top: 12rpx;
  @include text-price(36rpx);
  font-weight: $font-weight-heavy;
  text-align: right;
}

.line-card {
  margin-top: 22rpx;
}

.fulfillment {
  padding: 28rpx;
}

.fulfillment__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 20rpx;
}

.fulfillment__tab {
  @include flex-center;
  min-width: 150rpx;
  height: 64rpx;
  padding: 0 22rpx;
  color: $color-text-regular;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 26rpx;
}

.fulfillment__tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(232, 79, 95, 0.18);
  font-weight: 700;
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
  border: 1rpx solid #f1ddc6;
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
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
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
  background: $color-primary;
  border-radius: $radius-md;
  @include font-base;
  font-size: 34rpx;
  font-weight: $font-weight-heavy;
}

.bottom-pay button.is-disabled {
  background: $color-text-light;
}
</style>
