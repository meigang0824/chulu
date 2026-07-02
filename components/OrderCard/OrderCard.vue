<template>
  <view class="order-card" :class="'order-card--' + variant">
    <view class="order-card__head">
      <view class="order-card__id">订单号：{{ order.id }}</view>
      <view class="order-card__tags">
        <StatusTag v-if="order.refundStatus === 'pending'" type="refund" :text="order.refundType === 'cancelOrder' ? '取消审核中' : '售后中'" />
        <StatusTag v-else-if="order.refundStatus === 'approved'" type="refundApproved" text="已同意退款" />
        <StatusTag v-else-if="order.refundStatus === 'rejected'" type="refundRejected" text="已拒绝售后" />
        <StatusTag :type="order.status" :text="order.statusText" />
      </view>
    </view>

    <view class="order-card__main">
      <view class="order-card__avatar">
        <image v-if="avatarImage" class="order-card__avatar-img" :src="avatarImage" mode="aspectFill" />
        <text v-else>{{ avatarText }}</text>
      </view>
      <view class="order-card__user">
        <view class="order-card__user-line">
          <text class="order-card__name">{{ order.customer || order.receiver }}</text>
          <text v-if="order.phone" class="order-card__phone">☎ {{ order.phone }}</text>
        </view>
        <view v-if="order.address" class="order-card__address">⌖ {{ order.shortAddress || order.address }}</view>
      </view>
      <view class="order-card__amount">
        <view class="order-card__amount-label">实付金额</view>
        <view class="order-card__amount-value">￥{{ money(order.payable || order.amount) }}</view>
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
      <view v-if="hiddenItemCount" class="order-card__more-items">还有 {{ hiddenItemCount }} 款商品，点查看详情</view>
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
import { money } from '@/utils/format'

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
    allItems() {
      return (this.order.items || []).map((item, index) => ({
        ...item,
        _renderKey: item.productId || item.name || `item_${index}`
      }))
    },
    items() {
      if (this.maxItems <= 0) return this.allItems
      return this.allItems.slice(0, this.maxItems)
    },
    hiddenItemCount() {
      if (this.maxItems <= 0) return 0
      return Math.max(0, this.allItems.length - this.maxItems)
    },
    avatarImage() {
      const avatar = String(this.order.avatar || this.order.avatarUrl || '').trim()
      if (!avatar || ['girl', 'bear', 'rabbit'].includes(avatar)) return ''
      return avatar
    },
    avatarText() {
      return String(this.order.avatarText || this.order.customer || this.order.receiver || '客').trim().slice(0, 1) || '客'
    },
    primaryActionText() {
      if (this.actionText) return this.actionText
      if (this.order.refundStatus === 'pending') return '处理售后'
      if (this.order.status === 'cancelled') return ''
      if (this.order.status === 'completed') return ''
      if (this.order.status === 'delivering') return '标记完成'
      return '标记发货'
    }
  },
  methods: { money }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.order-card {
  margin-bottom: 18rpx;
  padding: 22rpx;
  background: $color-card;
  border-radius: $radius-card;
  border: 1rpx solid $color-border-light;
  box-shadow: $shadow-card;
}

.order-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx dashed $color-border-light;
  @include text-body($font-weight-medium, $color-text-main);
}

.order-card__id {
  flex: 1;
  min-width: 0;
  @include text-ellipsis;
}

.order-card__tags {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
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
  overflow: hidden;
  color: $color-primary;
  background: linear-gradient(180deg, #fff1f4 0%, #ffe3e8 100%);
  border: 1rpx solid rgba(255, 92, 114, 0.16);
  border-radius: 50%;
  font-size: 30rpx;
  font-weight: 900;
  box-shadow: 0 10rpx 24rpx rgba(255, 92, 114, 0.12);
}

.order-card__avatar-img {
  width: 100%;
  height: 100%;
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
  background: rgba(255, 248, 239, 0.72);
}

.order-card__item {
  width: calc(50% - 9rpx);
  min-width: 240rpx;
  display: flex;
  align-items: center;
}

.order-card__more-items {
  @include flex-center;
  width: 100%;
  min-height: 52rpx;
  color: $color-primary;
  background: rgba(255, 92, 114, 0.08);
  border-radius: $radius-sm;
  @include font-base;
  font-size: 24rpx;
  font-weight: $font-weight-semibold;
}

.order-card__item-img {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  margin-right: 12rpx;
  border-radius: 14rpx;
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
  border-radius: $radius-pill;
  @include font-base;
  font-size: 26rpx;
}

.order-card__btn--primary {
  min-width: 210rpx;
  color: #fff;
  background: $gradient-primary;
  border: none;
  box-shadow: $shadow-btn;
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
