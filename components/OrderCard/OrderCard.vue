<template>
  <view class="order-card" :class="'order-card--' + variant">
    <view class="order-card__head">
      <view class="order-card__id">订单号：{{ order.id }}</view>
      <view class="order-card__time" v-if="order.createTime">下单时间：{{ order.createTime }}</view>
      <StatusTag :type="order.status" :text="order.statusText" />
    </view>

    <view class="order-card__main">
      <view class="order-card__avatar">{{ avatarText }}</view>
      <view class="order-card__user">
        <view class="order-card__user-line">
          <text class="order-card__name">{{ order.customer || order.receiver }}</text>
          <text v-if="order.phone" class="order-card__phone">☎ {{ order.phone }}</text>
        </view>
        <view v-if="order.address" class="order-card__address">⌖ {{ order.shortAddress || order.address }}</view>
      </view>
      <view class="order-card__amount">
        <view class="order-card__amount-label">实付金额</view>
        <view class="order-card__amount-value">￥{{ order.payable || order.amount }}</view>
      </view>
    </view>

    <view v-if="items.length" class="order-card__items">
      <view class="order-card__item" v-for="item in items" :key="item._renderKey">
        <image class="order-card__item-img" :src="item.image" mode="aspectFill" lazy-load />
        <view class="order-card__item-info">
          <view class="order-card__item-name">{{ item.name }}</view>
          <view class="order-card__item-count">×{{ item.count }}</view>
        </view>
      </view>
    </view>

    <view v-if="showActions" class="order-card__actions">
      <button class="order-card__btn" @tap="$emit('view', order)">查看</button>
      <button v-if="primaryActionText" class="order-card__btn order-card__btn--primary" @tap="$emit('updateStatus', order)">
        {{ primaryActionText }}
      </button>
    </view>
  </view>
</template>

<script>
import StatusTag from '@/components/StatusTag/StatusTag.vue'

export default {
  name: 'OrderCard',
  components: { StatusTag },
  props: {
    order: { type: Object, default: () => ({}) },
    variant: { type: String, default: 'admin-list' },
    showActions: { type: Boolean, default: true },
    maxItems: { type: Number, default: 3 },
    actionText: { type: String, default: '' }
  },
  computed: {
    items() {
      return (this.order.items || []).slice(0, this.maxItems).map((item, index) => ({
        ...item,
        _renderKey: item.productId || item.name || `item_${index}`
      }))
    },
    avatarText() {
      const name = this.order.customer || this.order.receiver || '客'
      return name.slice(0, 1)
    },
    primaryActionText() {
      if (this.actionText) return this.actionText
      if (this.order.status === 'cancelled') return ''
      if (this.order.status === 'completed') return '再来一单'
      if (this.order.status === 'delivering') return '标记完成'
      return '标记发货'
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.order-card {
  margin-bottom: 18rpx;
  padding: 22rpx;
  background: #fff;
  border-radius: $radius-card;
  border: 1rpx solid $color-border-light;
  box-shadow: $shadow-card;
}

.order-card__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $color-border-light;
  @include text-body($font-weight-medium, $color-text-main);
}

.order-card__id {
  flex-shrink: 0;
}

.order-card__time {
  flex: 1;
  min-width: 0;
  color: $color-text-light;
  @include text-ellipsis;
}

.order-card__main {
  display: flex;
  align-items: flex-start;
  margin-top: 22rpx;
}

.order-card__avatar {
  @include flex-center;
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  color: $color-text-main;
  background: $color-bg-deep;
  border-radius: $radius-md;
  font-size: 30rpx;
  font-weight: 700;
}

.order-card__user {
  flex: 1;
  min-width: 0;
  margin-left: 18rpx;
}

.order-card__user-line {
  display: flex;
  align-items: center;
}

.order-card__name {
  flex-shrink: 0;
  @include text-body-strong;
  font-size: 30rpx;
  font-weight: $font-weight-bold;
}

.order-card__phone {
  min-width: 0;
  margin-left: 18rpx;
  @include text-caption;
  @include text-ellipsis;
}

.order-card__address {
  margin-top: 10rpx;
  @include text-caption;
  font-size: 25rpx;
  line-height: 1.45;
  @include text-ellipsis;
}

.order-card__amount {
  flex-shrink: 0;
  min-width: 128rpx;
  text-align: right;
}

.order-card__amount-label {
  @include text-caption;
}

.order-card__amount-value {
  margin-top: 6rpx;
  @include text-price(36rpx);
  font-weight: $font-weight-heavy;
}

.order-card__items {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 16rpx;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
  background: $color-bg-light;
}

.order-card__item {
  width: calc(50% - 9rpx);
  min-width: 240rpx;
  display: flex;
  align-items: center;
}

.order-card__item-img {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  margin-right: 12rpx;
  border-radius: $radius-sm;
}

.order-card__item-info {
  min-width: 0;
}

.order-card__item-name {
  @include text-caption($color-text-main);
  @include text-ellipsis;
}

.order-card__item-count {
  margin-top: 6rpx;
  @include text-caption($color-text-regular);
}

.order-card__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-top: 22rpx;
}

.order-card__btn {
  @include flex-center;
  min-width: 150rpx;
  padding: 0 24rpx;
  height: 60rpx;
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
  border-radius: $radius-md;
  @include font-base;
  font-size: 26rpx;
}

.order-card__btn--primary {
  min-width: 210rpx;
  color: #fff;
  background: $color-primary;
  border: none;
}

.order-card--compact-list {
  padding: 0;
  box-shadow: none;
}

.order-card--compact-list .order-card__head,
.order-card--compact-list .order-card__items,
.order-card--compact-list .order-card__actions {
  display: none;
}

.order-card--compact-list .order-card__main {
  margin-top: 0;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $color-border-light;
}
</style>
