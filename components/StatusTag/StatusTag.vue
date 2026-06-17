<template>
  <view class="status-tag" :class="classes">{{ displayText }}</view>
</template>

<script>
const defaultTextMap = {
  active: '进行中',
  paid: '已付款',
  pendingDelivery: '待发货',
  delivering: '已发货',
  completed: '已完成',
  ready: '已备齐',
  priority: '优先',
  normal: '正常',
  making: '制作中'
}

export default {
  name: 'StatusTag',
  props: {
    type: { type: String, default: 'default' },
    text: { type: String, default: '' },
    size: { type: String, default: 'md' },
    plain: { type: Boolean, default: false },
    solid: { type: Boolean, default: false }
  },
  computed: {
    displayText() {
      return this.text || defaultTextMap[this.type] || ''
    },
    classes() {
      return [
        'status-tag--' + this.type,
        'status-tag--' + this.size,
        {
          'status-tag--plain': this.plain,
          'status-tag--solid': this.solid
        }
      ]
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  height: 44rpx;
  padding: 0 18rpx;
  color: $color-text-regular;
  background: $color-bg-light;
  border: 1rpx solid transparent;
  border-radius: $radius-sm;
  @include font-base;
  font-size: 24rpx;
  font-weight: $font-weight-semibold;
  line-height: 1;
  white-space: nowrap;
}

.status-tag--sm {
  min-width: 0;
  height: 36rpx;
  padding: 0 12rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
}

.status-tag--lg {
  height: 54rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.status-tag--pendingDelivery,
.status-tag--paid,
.status-tag--active,
.status-tag--priority {
  color: $color-primary;
  background: $color-primary-light;
}

.status-tag--delivering {
  color: $color-blue;
  background: $color-blue-light;
}

.status-tag--completed,
.status-tag--ready {
  color: $color-green;
  background: $color-green-light;
}

.status-tag--normal,
.status-tag--making,
.status-tag--preparing {
  color: $color-orange;
  background: $color-orange-light;
}

.status-tag--cancelled,
.status-tag--hidden {
  color: $color-text-light;
  background: $color-bg-deep;
}

.status-tag--plain {
  background: #fff;
  border-color: currentColor;
}

.status-tag--solid {
  color: #fff;
  background: $color-primary;
}
</style>
