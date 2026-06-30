<template>
  <view class="buyer-tabbar">
    <view
      v-for="item in tabs"
      :key="item.key"
      class="buyer-tabbar__item"
      :class="{ 'buyer-tabbar__item--active': item.key === active }"
      @tap="go(item)"
    >
      <view class="buyer-tabbar__icon">
        <AppIcon :name="item.icon" :size="42" :color="item.key === active ? '#FF5C72' : '#9A7D70'" />
        <view v-if="item.key === 'cart' && displayCartCount > 0" class="buyer-tabbar__badge">{{ cartBadgeText }}</view>
      </view>
      <text class="buyer-tabbar__text">{{ item.text }}</text>
    </view>
  </view>
</template>

<script>
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import { getCartCount } from '@/utils/shopState'

export default {
  name: 'BuyerTabBar',
  components: { AppIcon },
  props: {
    active: { type: String, default: 'home' },
    badgeCount: { type: Number, default: undefined }
  },
  data() {
    return {
      cartCount: 0,
      tabs: [
        { key: 'home', text: '首页', icon: 'home', url: '/pages/home/index' },
        { key: 'category', text: '商品', icon: 'grid', url: '/pages/category/index' },
        { key: 'cart', text: '购物车', icon: 'cart', url: '/pages/cart/index' },
        { key: 'orders', text: '订单', icon: 'receipt', url: '/pages/order/list/index' },
        { key: 'mine', text: '我的', icon: 'user', url: '/pages/mine/index' }
      ]
    }
  },
  computed: {
    displayCartCount() {
      return this.badgeCount !== undefined ? Number(this.badgeCount || 0) : this.cartCount
    },
    cartBadgeText() {
      return this.displayCartCount > 99 ? '99+' : String(this.displayCartCount)
    }
  },
  created() {
    this.refreshCartCount()
  },
  mounted() {
    this.refreshCartCount()
    uni.$on('cart:changed', this.refreshCartCount)
  },
  beforeDestroy() {
    uni.$off('cart:changed', this.refreshCartCount)
  },
  methods: {
    refreshCartCount() {
      this.cartCount = getCartCount()
    },
    go(item) {
      if (item.key === 'category') {
        uni.removeStorageSync('buyer_selected_group_id')
        if (item.key === this.active) {
          uni.$emit('buyer:category-clear-group')
          return
        }
      }
      if (item.key === this.active) return
      uni.switchTab({ url: item.url })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.buyer-tabbar {
  position: fixed;
  left: 16rpx;
  right: 16rpx;
  bottom: 0;
  z-index: 60;
  display: flex;
  min-height: 136rpx;
  padding: 12rpx 12rpx calc(12rpx + env(safe-area-inset-bottom));
  background: rgba(255, 253, 249, 0.98);
  border: 1rpx solid $color-border-light;
  border-radius: $radius-xl $radius-xl 0 0;
  box-shadow: $shadow-bottom;
}

.buyer-tabbar__item {
  flex: 1;
  min-width: 0;
  @include flex-center;
  flex-direction: column;
  color: $color-text-light;
  @include font-base;
  border-radius: $radius-md;
  transition: all 0.12s ease;
}

.buyer-tabbar__icon {
  position: relative;
  @include flex-center;
  width: 66rpx;
  height: 66rpx;
  border-radius: $radius-md;
}

.buyer-tabbar__badge {
  position: absolute;
  right: 2rpx;
  top: 0;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  color: #fff;
  background: $color-primary;
  border: 2rpx solid #fff;
  border-radius: $radius-pill;
  font-size: 20rpx;
  line-height: 30rpx;
  font-weight: $font-weight-bold;
  text-align: center;
  box-shadow: 0 4rpx 10rpx rgba(255, 92, 114, 0.24);
  box-sizing: border-box;
}

.buyer-tabbar__text {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.2;
  font-weight: $font-weight-medium;
}

.buyer-tabbar__item--active {
  color: $color-primary;
}

.buyer-tabbar__item--active .buyer-tabbar__icon {
  background: $color-primary-light;
  box-shadow: 0 6rpx 16rpx rgba(255, 92, 114, 0.10);
}

.buyer-tabbar__item--active .buyer-tabbar__text {
  font-weight: $font-weight-semibold;
}
</style>
