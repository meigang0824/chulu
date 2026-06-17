<template>
  <view class="page order-success">
    <CustomNavBar title="下单成功" showBack />

    <view class="hero card">
      <view class="hero__icon">✓</view>
      <view class="hero__title">支付成功，订单已提交</view>
      <view class="hero__desc">初炉已收到你的订单，正在安排新鲜制作与配送。</view>
      <view class="hero__amount">实付款 ￥{{ amount }}</view>
    </view>

    <view class="next-card card">
      <view class="next-card__title">订单已进入备货队列</view>
      <view class="next-card__steps">
        <view>店长确认</view>
        <view>打包发货</view>
        <view>完成配送</view>
      </view>
    </view>

    <view class="card summary">
      <view class="summary__row">
        <text>订单编号</text>
        <view>{{ orderNo || '--' }}</view>
      </view>
      <view class="summary__row">
        <text>配送时间</text>
        <view>{{ deliveryTime || shop.checkout.deliveryTime }}</view>
      </view>
      <view class="summary__row">
        <text>收货信息</text>
        <view>{{ receiverText }}</view>
      </view>
      <view class="summary__row">
        <text>门店承诺</text>
        <view>{{ shop.assurance }}</view>
      </view>
    </view>

    <view class="card tip-card">
      <view class="tip-card__title">接下来会发生什么</view>
      <view class="tip-card__item">1. 店长会尽快确认订单并开始备货</view>
      <view class="tip-card__item">2. 配送开始后，你可以在订单页查看进度</view>
      <view class="tip-card__item">3. 如需修改收货信息，请尽快联系客服</view>
    </view>

    <view class="bottom-actions">
      <button class="ghost-btn" @tap="continueShopping">继续逛逛</button>
      <button class="primary-btn" @tap="viewOrder">查看订单</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getShopConfig } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar },
  data() {
    return {
      shop: {},
      orderId: '',
      orderNo: '',
      amount: '0.0',
      deliveryTime: '',
      receiverText: ''
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/order/success/index', '订单结果页需要登录后查看')) return
    this.shop = await getShopConfig()
    // 优先从 storage 读取（下单页写入），其次从 query 兼容旧逻辑
    const data = uni.getStorageSync('order_success_data') || {}
    this.orderId = data.orderId || query.id || ''
    this.orderNo = data.orderId || query.orderNo || query.id || ''
    this.amount = data.payable ? `￥${data.payable}` : (query.amount ? `￥${query.amount}` : '--')
    this.deliveryTime = data.deliveryTime || query.deliveryTime || ''
    this.receiverText = (data.receiver && data.phone) ? `${data.receiver} ${data.phone}` : ((query.receiver && query.phone) ? `${query.receiver} ${query.phone}` : '')
    uni.removeStorageSync('order_success_data')
  },
  methods: {
    viewOrder() {
      if (!this.orderId) {
        uni.switchTab({ url: '/pages/order/list/index' })
        return
      }
      uni.redirectTo({ url: `/pages/order/detail/index?id=${this.orderId}` })
    },
    continueShopping() {
      uni.switchTab({ url: '/pages/home/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.order-success {
  padding-bottom: 180rpx;
}

.hero,
.next-card,
.summary,
.tip-card {
  margin-top: 24rpx;
}

.hero {
  padding: 40rpx 28rpx;
  text-align: center;
  background: $color-card;
}

.hero__icon {
  @include flex-center;
  width: 110rpx;
  height: 110rpx;
  margin: 0 auto;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
  font-size: 54rpx;
  font-weight: 800;
}

.hero__title {
  margin-top: 24rpx;
  color: $color-text-main;
  font-size: 40rpx;
  font-weight: 800;
}

.hero__desc {
  margin-top: 14rpx;
  color: $color-text-regular;
  font-size: 26rpx;
  line-height: 1.55;
}

.hero__amount {
  margin-top: 22rpx;
  color: $color-primary;
  font-size: 46rpx;
  font-weight: 800;
}

.summary,
.next-card,
.tip-card {
  padding: 28rpx;
}

.next-card__title {
  color: $color-text-main;
  font-size: 30rpx;
  font-weight: 800;
}

.next-card__steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 18rpx;
}

.next-card__steps view {
  @include flex-center;
  min-height: 58rpx;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(232,79,95,.14);
  border-radius: $radius-md;
  font-size: 24rpx;
  font-weight: 700;
}

.summary__row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $color-border-light;
}

.summary__row:last-child {
  border-bottom: none;
}

.summary__row text {
  flex-shrink: 0;
  color: $color-text-main;
  font-size: 28rpx;
}

.summary__row view {
  min-width: 0;
  color: $color-text-regular;
  font-size: 26rpx;
  text-align: right;
  line-height: 1.5;
}

.tip-card__title {
  color: $color-text-main;
  font-size: 32rpx;
  font-weight: 800;
}

.tip-card__item {
  margin-top: 18rpx;
  color: $color-text-regular;
  font-size: 26rpx;
  line-height: 1.55;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid $color-border-light;
  box-shadow: $shadow-bottom;
}

.ghost-btn,
.primary-btn {
  @include flex-center;
  flex: 1;
  height: 88rpx;
  margin: 0;
  border-radius: $radius-md;
  font-size: 30rpx;
  font-weight: 700;
}

.ghost-btn {
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
}

.primary-btn {
  color: #fff;
  background: $color-primary;
  border: none;
}
</style>
