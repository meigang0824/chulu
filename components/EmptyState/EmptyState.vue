<template>
  <view class="empty-state card" :class="stateClass">
    <view class="empty-state__icon">{{ iconText }}</view>
    <view class="empty-state__title">{{ title }}</view>
    <view v-if="desc" class="empty-state__desc">{{ desc }}</view>
    <button v-if="actionText" class="empty-state__btn" @tap="$emit('action')">{{ actionText }}</button>
  </view>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    type: { type: String, default: 'empty' },
    title: { type: String, default: '暂无内容' },
    desc: { type: String, default: '' },
    actionText: { type: String, default: '' }
  },
  computed: {
    stateClass() {
      return `empty-state--${this.type}`
    },
    iconText() {
      return this.type === 'error' ? '!' : '◌'
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.empty-state {
  @include flex-center;
  flex-direction: column;
  min-height: 240rpx;
  padding: 36rpx 28rpx;
  text-align: center;
}

.empty-state__icon {
  @include flex-center;
  width: 88rpx;
  height: 88rpx;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: 50%;
  @include font-base;
  font-size: 42rpx;
  font-weight: $font-weight-heavy;
}

.empty-state--error .empty-state__icon {
  color: $color-orange;
  background: $color-orange-light;
}

.empty-state__title {
  margin-top: 18rpx;
  @include text-card-title;
  font-weight: $font-weight-heavy;
}

.empty-state__desc {
  margin-top: 12rpx;
  @include text-caption;
  line-height: 1.55;
}

.empty-state__btn {
  min-width: 180rpx;
  height: 68rpx;
  margin-top: 22rpx;
  padding: 0 26rpx;
  color: #fff;
  background: $gradient-primary;
  border: none;
  border-radius: $radius-pill;
  box-shadow: $shadow-btn;
  @include font-base;
  font-size: 26rpx;
  line-height: 68rpx;
}
</style>
