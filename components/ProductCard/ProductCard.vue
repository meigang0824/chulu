<template>
  <view class="product-card" :class="'product-card--' + variant" @tap="handleTap">
    <view class="product-card__image-wrap">
      <image class="product-card__image" :src="product.image" mode="aspectFill" lazy-load />
    </view>

    <view class="product-card__body">
      <view class="product-card__main">
        <view class="product-card__name">{{ product.name }}</view>
        <view v-if="showDesc && product.desc" class="product-card__desc">{{ product.desc }}</view>
        <view v-if="showMeta" class="product-card__meta">
          <text>已售 {{ product.sold || 0 }} 份</text>
          <text v-if="showStock">仅剩 {{ product.stock || 0 }} 份</text>
          <text v-else-if="product.totalStock">库存 {{ product.totalStock }} 份</text>
        </view>
        <!-- home-list variant: price + button in footer row -->
        <view v-if="variant === 'home-list'" class="product-card__footer-row">
          <view class="product-card__price-block">
            <text class="product-card__price">￥{{ money(product.price) }}</text>
            <text v-if="product.originPrice" class="product-card__origin">￥{{ money(product.originPrice) }}</text>
          </view>
          <button v-if="showAction" class="product-card__btn product-card__btn--sm" @tap.stop="handleAction">
            {{ actionText }}
          </button>
        </view>
        <!-- other variants: inline price row -->
        <view v-else class="product-card__price-row">
          <text class="product-card__price">￥{{ money(product.price) }}</text>
          <text v-if="product.originPrice" class="product-card__origin">￥{{ money(product.originPrice) }}</text>
        </view>
      </view>

      <slot name="extra" :product="product"></slot>

      <view v-if="showDeadline" class="product-card__footer">
        <view v-if="showDeadline && product.deadline" class="product-card__deadline">
          <text class="product-card__clock">○</text>
          <text>{{ deadlineText }}</text>
        </view>
        <button v-if="variant !== 'home-list' && showAction" class="product-card__btn" @tap.stop="handleAction">
          {{ actionText }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { money } from '@/utils/format'

export default {
  name: 'ProductCard',
  props: {
    product: { type: Object, default: () => ({}) },
    variant: { type: String, default: 'home-grid' },
    actionText: { type: String, default: '去参团' },
    showAction: { type: Boolean, default: true },
    showDeadline: { type: Boolean, default: true },
    showStock: { type: Boolean, default: true },
    showMeta: { type: Boolean, default: true },
    showDesc: { type: Boolean, default: false }
  },
  computed: {
    deadlineText() {
      if (this.variant === 'home-grid') return String(this.product.deadline || '').replace('今晚', '').replace('截单', '截')
      return this.product.deadline
    }
  },
  methods: {
    money,
    handleTap() {
      this.$emit('tap', this.product)
    },
    handleAction() {
      this.$emit('join', this.product)
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.product-card {
  overflow: hidden;
  background: $color-card;
  border-radius: $radius-card;
  border: 1rpx solid $color-border-light;
  box-shadow: $shadow-card;
}

.product-card__image-wrap {
  position: relative;
  overflow: hidden;
}

.product-card__image {
  display: block;
  width: 100%;
  height: 220rpx;
  background: $gradient-cream;
}

.product-card__body {
  padding: 18rpx 20rpx 22rpx;
}

.product-card__name {
  @include text-body-strong;
  font-size: 30rpx;
  font-weight: $font-weight-bold;
  line-height: 1.25;
  @include multi-ellipsis(2);
}

.product-card__desc {
  margin-top: 8rpx;
  @include text-caption;
  @include multi-ellipsis(2);
}

.product-card__price-row {
  display: flex;
  align-items: baseline;
  margin-top: 10rpx;
}

.product-card__price {
  @include text-price(40rpx);
  font-weight: $font-weight-heavy;
  letter-spacing: 0;
}

.product-card__origin {
  margin-left: 12rpx;
  @include text-caption;
  text-decoration: line-through;
}

.product-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 10rpx;
  margin-top: 10rpx;
  @include text-caption($color-text-regular);
  line-height: 1.2;
}

.product-card__meta text {
  max-width: 100%;
  @include text-ellipsis;
}

.product-card__meta text:last-child {
  color: $color-orange;
}

.product-card__group {
  margin-top: 10rpx;
}

.product-card__group-bar {
  height: 10rpx;
  background: #f8ede7;
  border-radius: 5rpx;
  overflow: hidden;
}

.product-card__group-fill {
  height: 100%;
  background: linear-gradient(90deg, $color-primary, $color-primary-soft);
  border-radius: 5rpx;
  transition: width 0.3s ease;
}

.product-card__group-text {
  margin-top: 6rpx;
  @include text-helper($color-primary);
  font-size: 18rpx;
  line-height: 1.2;
}

.product-card__footer {
  display: flex;
  flex-direction: column;
}

.product-card__deadline {
  @include flex-center;
  box-sizing: border-box;
  width: 100%;
  height: 52rpx;
  margin-top: 14rpx;
  padding: 0 10rpx;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: $radius-pill;
  @include font-base;
  font-size: 24rpx;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  border: 1rpx solid rgba(255, 92, 114, 0.12);
}

.product-card__clock {
  flex-shrink: 0;
  margin-right: 6rpx;
  font-size: 24rpx;
}

.product-card__deadline text:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-card__btn {
  @include flex-center;
  height: 64rpx;
  margin-top: 14rpx;
  color: #fff;
  background: $gradient-primary;
  border-radius: $radius-pill;
  box-shadow: $shadow-btn;
  @include font-base;
  font-size: 28rpx;
  font-weight: $font-weight-semibold;
}

.product-card--home-grid .product-card__image {
  height: 172rpx;
}

.product-card--home-grid .product-card__body {
  padding: 14rpx 14rpx 14rpx;
}

.product-card--home-grid .product-card__name {
  min-height: 40rpx;
  font-size: 24rpx;
  line-height: 1.12;
}

.product-card--home-grid .product-card__price-row {
  margin-top: 4rpx;
}

.product-card--home-grid .product-card__price {
  font-size: 30rpx;
}

.product-card--home-grid .product-card__origin {
  font-size: 20rpx;
}

.product-card--home-grid .product-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0;
  margin-top: 2rpx;
  font-size: 18rpx;
  line-height: 1.2;
}

.product-card--home-grid .product-card__meta text {
  display: inline-block;
  margin-top: 0;
}

.product-card--home-grid .product-card__meta text + text {
  position: relative;
  margin-left: 10rpx;
  padding-left: 10rpx;
}

.product-card--home-grid .product-card__meta text + text::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 1rpx;
  height: 16rpx;
  background: rgba(123, 90, 77, 0.22);
  transform: translateY(-50%);
}

.product-card--home-grid .product-card__deadline {
  height: 42rpx;
  min-height: 42rpx;
  margin-top: 8rpx;
  padding: 0 8rpx;
  font-size: 16rpx;
  border-radius: 12rpx;
  text-align: center;
  background: $color-primary-light;
}

.product-card--home-grid .product-card__clock {
  display: inline-block;
  margin-right: 4rpx;
  font-size: 16rpx;
}

.product-card--home-grid .product-card__group-text { display: none; }

.product-card--home-grid .product-card__btn {
  height: 50rpx;
  margin-top: 8rpx;
  border-radius: $radius-pill;
  font-size: 22rpx;
  font-weight: $font-weight-bold;
}

.product-card--order-row,
.product-card--stock-row,
.product-card--dashboard-mini {
  display: flex;
  align-items: stretch;
  padding: 18rpx;
}

.product-card--order-row .product-card__image-wrap,
.product-card--stock-row .product-card__image-wrap,
.product-card--dashboard-mini .product-card__image-wrap {
  flex-shrink: 0;
  width: 160rpx;
  border-radius: 22rpx;
}

.product-card--order-row .product-card__image,
.product-card--stock-row .product-card__image,
.product-card--dashboard-mini .product-card__image {
  height: 160rpx;
}

.product-card--order-row .product-card__body,
.product-card--stock-row .product-card__body,
.product-card--dashboard-mini .product-card__body {
  flex: 1;
  min-width: 0;
  padding: 4rpx 0 4rpx 24rpx;
}

.product-card--order-row .product-card__btn,
.product-card--stock-row .product-card__btn,
.product-card--dashboard-mini .product-card__btn {
  display: none;
}

.product-card--category-row .product-card__btn {
  width: 148rpx;
  height: 54rpx;
  margin-top: 0;
  font-size: 24rpx;
  align-self: stretch;
}

.product-card--category-row {
  display: flex;
  align-items: stretch;
  padding: 20rpx 18rpx;
}

.product-card--category-row .product-card__image-wrap {
  flex-shrink: 0;
  width: 168rpx;
  align-self: stretch;
  border-radius: 22rpx;
}

.product-card--category-row .product-card__image {
  height: 100%;
  min-height: 168rpx;
}

.product-card--category-row .product-card__body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  min-height: 168rpx;
  padding: 2rpx 0 2rpx 20rpx;
}

.product-card--category-row .product-card__main {
  min-width: 0;
}

.product-card--category-row .product-card__footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
}

.product-card--category-row .product-card__name {
  font-size: 30rpx;
  line-height: 1.22;
}

.product-card--category-row .product-card__desc {
  margin-top: 6rpx;
  font-size: 22rpx;
}

.product-card--category-row .product-card__price-row {
  margin-top: 8rpx;
}

.product-card--category-row .product-card__price {
  font-size: 34rpx;
}

.product-card--category-row .product-card__origin {
  font-size: 20rpx;
}

.product-card--category-row .product-card__meta {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.3;
}

.product-card--category-row .product-card__deadline {
  flex: 1;
  justify-content: center;
  height: 44rpx;
  min-height: 44rpx;
  margin-top: 0;
  padding: 0 10rpx;
  font-size: 18rpx;
  border-radius: 12rpx;
}

.product-card--category-row .product-card__clock {
  margin-right: 4rpx;
  font-size: 18rpx;
}

/* home-list variant: 首页列表式布局 */
.product-card--home-list {
  display: flex;
  align-items: stretch;
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
}

.product-card--home-list .product-card__image-wrap {
  flex-shrink: 0;
  width: 200rpx;
  border-radius: 24rpx;
  overflow: hidden;
}

.product-card--home-list .product-card__image {
  width: 200rpx;
  height: 200rpx;
}

.product-card--home-list .product-card__body {
  flex: 1;
  min-width: 0;
  padding: 6rpx 0 6rpx 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.product-card--home-list .product-card__name {
  font-size: 30rpx;
  font-weight: $font-weight-bold;
  line-height: 1.3;
  @include multi-ellipsis(2);
}

.product-card--home-list .product-card__desc {
  margin-top: 6rpx;
  @include text-caption;
  @include multi-ellipsis(1);
}

.product-card--home-list .product-card__meta {
  margin-top: 10rpx;
  display: flex;
  gap: 16rpx;
  font-size: 22rpx;
  @include text-caption($color-text-regular);
}

.product-card--home-list .product-card__meta text:last-child {
  color: $color-orange;
}

.product-card--home-list .product-card__footer {
  margin-top: auto;
  padding-top: 8rpx;
}

.product-card--home-list .product-card__footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-card--home-list .product-card__price-block {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.product-card--home-list .product-card__price {
  @include text-price(42rpx);
  font-weight: $font-weight-heavy;
}

.product-card--home-list .product-card__origin {
  font-size: 22rpx;
  @include text-caption;
  text-decoration: line-through;
}

.product-card--home-list .product-card__btn--sm {
  @include flex-center;
  height: 56rpx;
  padding: 0 28rpx;
  color: #fff;
  background: $gradient-primary;
  border-radius: $radius-pill;
  box-shadow: $shadow-btn;
  @include font-base;
  font-size: 24rpx;
  font-weight: $font-weight-semibold;
  border: none;
}

.product-card--preview {
  border: 1rpx solid $color-border-light;
  box-shadow: none;
}

.product-card--preview .product-card__image {
  height: 300rpx;
}
</style>
