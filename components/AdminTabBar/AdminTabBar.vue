<template>
  <view class="admin-tabbar">
    <view
      v-for="item in tabs"
      :key="item.key"
      class="admin-tabbar__item"
      :class="{ 'admin-tabbar__item--active': item.key === active }"
      @tap="go(item)"
    >
      <view class="admin-tabbar__icon">
        <AppIcon :name="item.icon" :size="42" :stroke-width="2.2" :color="item.key === active ? '#E84F5F' : '#8A93A0'" />
      </view>
      <text class="admin-tabbar__text">{{ item.text }}</text>
    </view>
  </view>
</template>

<script>
import AppIcon from '@/components/AppIcon/AppIcon.vue'

export default {
  name: 'AdminTabBar',
  components: { AppIcon },
  props: {
    active: { type: String, default: 'dashboard' }
  },
  data() {
    return {
      tabs: [
        { key: 'dashboard', text: '工作台', icon: 'dashboard', url: '/pages/admin/dashboard/index' },
        { key: 'create', text: '开团', icon: 'plus', url: '/pages/admin/create-group/index' },
        { key: 'orders', text: '订单', icon: 'receipt', url: '/pages/admin/order-list/index' },
        { key: 'stock', text: '商品', icon: 'box', url: '/pages/admin/stock-summary/index' },
        { key: 'delivery', text: '发货', icon: 'truck', url: '/pages/admin/delivery-address/index' }
      ]
    }
  },
  methods: {
    go(item) {
      if (item.key === this.active) return
      uni.navigateTo({ url: item.url })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.admin-tabbar {
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

.admin-tabbar__item {
  flex: 1;
  min-width: 0;
  @include flex-center;
  flex-direction: column;
  color: $color-text-main;
  @include font-base;
  border-radius: $radius-md;
  transition: all 0.12s ease;
}

.admin-tabbar__icon {
  @include flex-center;
  width: 66rpx;
  height: 66rpx;
  border-radius: $radius-md;
}

.admin-tabbar__text {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.2;
  font-weight: $font-weight-medium;
}

.admin-tabbar__item--active {
  color: $color-primary;
}

.admin-tabbar__item--active .admin-tabbar__icon {
  background: $color-primary-light;
  box-shadow: none;
}

.admin-tabbar__item--active .admin-tabbar__text {
  font-weight: $font-weight-semibold;
}
</style>
