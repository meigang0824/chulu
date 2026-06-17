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
        <AppIcon :name="item.icon" :size="42" :color="item.key === active ? '#E84F5F' : '#8A93A0'" />
      </view>
      <text class="buyer-tabbar__text">{{ item.text }}</text>
    </view>
  </view>
</template>

<script>
import AppIcon from '@/components/AppIcon/AppIcon.vue'

export default {
  name: 'BuyerTabBar',
  components: { AppIcon },
  props: {
    active: { type: String, default: 'home' }
  },
  data() {
    return {
      tabs: [
        { key: 'home', text: '首页', icon: 'home', url: '/pages/home/index' },
        { key: 'category', text: '商品', icon: 'grid', url: '/pages/category/index' },
        { key: 'orders', text: '订单', icon: 'receipt', url: '/pages/order/list/index' },
        { key: 'mine', text: '我的', icon: 'user', url: '/pages/mine/index' }
      ]
    }
  },
  methods: {
    go(item) {
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
  background: rgba(255, 255, 255, 0.98);
  border: 1rpx solid $color-border-light;
  border-radius: $radius-xl $radius-xl 0 0;
  box-shadow: $shadow-bottom;
}

.buyer-tabbar__item {
  flex: 1;
  min-width: 0;
  @include flex-center;
  flex-direction: column;
  color: $color-text-main;
  @include font-base;
  border-radius: $radius-md;
  transition: all 0.12s ease;
}

.buyer-tabbar__icon {
  @include flex-center;
  width: 66rpx;
  height: 66rpx;
  border-radius: $radius-md;
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
  box-shadow: none;
}

.buyer-tabbar__item--active .buyer-tabbar__text {
  font-weight: $font-weight-semibold;
}
</style>
