<template>
  <view class="address-card" :class="'address-card--' + variant" @tap="$emit('select', address)">
    <view v-if="selectable" class="address-card__check" :class="{ 'address-card__check--on': checked }"></view>
    <view v-if="showRouteNo" class="address-card__route">{{ address.routeNo }}</view>

    <view class="address-card__icon" v-if="variant === 'receiver'">
      <AppIcon name="home" :size="32" color="#C87932" />
    </view>

    <view class="address-card__body">
      <view class="address-card__head">
        <text class="address-card__name">{{ address.receiver || address.customer }}</text>
        <text class="address-card__phone">{{ address.fullPhone || address.phone }}</text>
        <StatusTag v-if="address.tag" type="normal" :text="address.tag" size="sm" plain />
      </view>
      <view class="address-card__detail">{{ address.address }}</view>

      <view v-if="items.length" class="address-card__items">
        <view class="address-card__item" v-for="item in items" :key="item._renderKey">
          <image v-if="item.image" class="address-card__item-img" :src="item.image" mode="aspectFill" lazy-load />
          <text>{{ item.name }} ×{{ item.count }}</text>
        </view>
      </view>

      <view v-if="showFulfillment && address.fulfillmentMethod" class="address-card__note">履约：{{ address.fulfillmentMethod }}</view>
      <view v-if="address.note" class="address-card__note">备注：{{ address.note }}</view>
    </view>

    <view v-if="showActions" class="address-card__side">
      <StatusTag v-if="address.statusText" :type="address.status" :text="address.statusText" />
      <view v-if="address.planTime || address.deliveryTime" class="address-card__time">{{ address.planTime || address.deliveryTime }}</view>
      <button v-if="address.canNavigate !== false" class="address-card__action" @tap.stop="$emit('navigate', address)">复制地址</button>
      <button v-if="address.canContact" class="address-card__action" @tap.stop="$emit('contact', address)">联系</button>
    </view>
  </view>
</template>

<script>
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'

export default {
  name: 'AddressCard',
  components: { StatusTag, AppIcon },
  props: {
    address: { type: Object, default: () => ({}) },
    variant: { type: String, default: 'receiver' },
    checked: { type: Boolean, default: false },
    selectable: { type: Boolean, default: false },
    showActions: { type: Boolean, default: false },
    showRouteNo: { type: Boolean, default: false },
    showFulfillment: { type: Boolean, default: true }
  },
  computed: {
    items() {
      return (this.address.items || []).map((item, index) => ({
        ...item,
        _renderKey: item.productId || item.name || `addr_item_${index}`
      }))
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.address-card {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 30rpx 28rpx;
  background: $color-card;
  border-radius: $radius-card;
  border: 1rpx solid $color-border-light;
  box-shadow: $shadow-card;
}

.address-card__check {
  flex-shrink: 0;
  width: 34rpx;
  height: 34rpx;
  margin: 6rpx 22rpx 0 0;
  border: 2rpx solid $color-text-placeholder;
  border-radius: 50%;
}

.address-card__check--on {
  background: $gradient-primary;
  border-color: $color-primary;
}

.address-card__route {
  @include flex-center;
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  margin: 2rpx 16rpx 0 0;
  color: #fff;
  background: $gradient-primary;
  border-radius: 50%;
  font-size: 24rpx;
  font-weight: 700;
}

.address-card__icon {
  @include flex-center;
  flex-shrink: 0;
  width: 62rpx;
  height: 62rpx;
  margin: 6rpx 20rpx 0 0;
  background: linear-gradient(180deg, #fff4e5 0%, #ffe7c7 100%);
  border: 1rpx solid rgba(200, 121, 50, 0.16);
  border-radius: 50%;
}

.address-card__body {
  flex: 1;
  min-width: 0;
}

.address-card__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx 16rpx;
}

.address-card__name {
  color: $color-text-main;
  font-size: 32rpx;
  font-weight: 800;
}

.address-card__phone {
  color: $color-text-regular;
  font-size: 26rpx;
}

.address-card__detail {
  margin-top: 10rpx;
  color: $color-text-regular;
  font-size: 26rpx;
  line-height: 1.45;
}

.address-card__items {
  margin-top: 18rpx;
  padding: 14rpx 16rpx;
  background: rgba(255, 248, 239, 0.72);
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
}

.address-card__item {
  display: flex;
  align-items: center;
  min-height: 44rpx;
  color: $color-text-main;
  font-size: 26rpx;
}

.address-card__item + .address-card__item {
  margin-top: 8rpx;
}

.address-card__item-img {
  width: 44rpx;
  height: 44rpx;
  margin-right: 12rpx;
  border-radius: 12rpx;
}

.address-card__note {
  margin-top: 14rpx;
  color: $color-text-regular;
  font-size: 26rpx;
  line-height: 1.45;
}

.address-card__side {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  width: 100%;
  margin: 18rpx 0 0;
  padding-left: 98rpx;
  text-align: left;
}

.address-card__time {
  margin-top: 0;
  color: $color-text-regular;
  font-size: 24rpx;
  line-height: 1.35;
}

.address-card__action {
  @include flex-center;
  width: auto;
  min-width: 120rpx;
  height: 54rpx;
  margin: 0;
  padding: 0 18rpx;
  color: $color-orange;
  background: #fff;
  border: 1rpx solid $color-orange;
  border-radius: $radius-pill;
  font-size: 24rpx;
}

.address-card--delivery {
  box-shadow: none;
  border: 1rpx solid $color-border-light;
}
</style>
