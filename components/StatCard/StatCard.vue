<template>
  <view class="stat-card" :class="'stat-card--' + theme">
    <view class="stat-card__icon">
      <AppIcon :name="icon" :size="34" color="#FFFFFF" />
    </view>
    <view class="stat-card__body">
      <view class="stat-card__label">{{ label }}</view>
      <view class="stat-card__value">
        <text v-if="prefix" class="stat-card__prefix">{{ prefix }}</text>
        <text>{{ value }}</text>
        <text v-if="unit" class="stat-card__unit">{{ unit }}</text>
      </view>
      <view v-if="trend" class="stat-card__trend" :class="'stat-card__trend--' + trendType">
        较昨日 {{ trend }}
      </view>
    </view>
  </view>
</template>

<script>
import AppIcon from '@/components/AppIcon/AppIcon.vue'

export default {
  name: 'StatCard',
  components: { AppIcon },
  props: {
    icon: { type: String, default: '' },
    label: { type: String, default: '' },
    value: { type: [String, Number], default: '' },
    unit: { type: String, default: '' },
    prefix: { type: String, default: '' },
    trend: { type: String, default: '' },
    trendType: { type: String, default: 'up' },
    theme: { type: String, default: 'red' }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.stat-card {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 28rpx 24rpx;
  background: #fff;
  border-radius: $radius-card;
  border: 1rpx solid $color-border-light;
  box-shadow: $shadow-card;
}

.stat-card__icon {
  @include flex-center;
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
  @include font-base;
  font-size: 34rpx;
  font-weight: $font-weight-heavy;
}

.stat-card__body {
  min-width: 0;
  margin-left: 20rpx;
}

.stat-card__label {
  @include text-body($font-weight-medium, $color-text-regular);
  font-size: 26rpx;
  @include text-ellipsis;
}

.stat-card__value {
  display: flex;
  align-items: baseline;
  margin-top: 10rpx;
  @include text-price(44rpx);
  color: $color-text-main;
  font-weight: $font-weight-heavy;
}

.stat-card__prefix,
.stat-card__unit {
  margin-right: 4rpx;
  @include font-base;
  font-size: 24rpx;
  font-weight: $font-weight-medium;
}

.stat-card__unit {
  margin: 0 0 0 8rpx;
}

.stat-card__trend {
  margin-top: 12rpx;
  @include text-caption($color-primary);
}

.stat-card__trend--down {
  color: $color-green;
}

.stat-card--orange .stat-card__icon {
  background: $color-orange;
}

.stat-card--blue .stat-card__icon {
  background: $color-blue;
}

.stat-card--green .stat-card__icon {
  background: $color-green;
}
</style>
