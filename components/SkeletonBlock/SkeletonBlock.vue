<template>
  <view class="skeleton" :class="skeletonClass">
    <view
      v-for="(item, index) in rowsMeta"
      :key="index"
      class="skeleton__row"
      :style="item.style"
    ></view>
  </view>
</template>

<script>
export default {
  name: 'SkeletonBlock',
  props: {
    variant: { type: String, default: 'card' },
    rows: { type: Number, default: 3 },
    animated: { type: Boolean, default: true }
  },
  computed: {
    skeletonClass() {
      return {
        [`skeleton--${this.variant}`]: true,
        'skeleton--animated': this.animated
      }
    },
    rowsMeta() {
      return Array.from({ length: this.rows }, (_, index) => ({
        style: this.getRowStyle(index)
      }))
    }
  },
  methods: {
    getRowStyle(index) {
      if (this.variant === 'hero') {
        const widths = ['34%', '58%', '46%']
        return `width:${widths[index] || '42%'};`
      }
      if (this.variant === 'tabs') {
        return 'width:22%;height:64rpx;border-radius:999rpx;'
      }
      if (this.variant === 'list') {
        const widths = ['30%', '70%', '48%']
        return `width:${widths[index] || '60%'};`
      }
      return `width:${index === this.rows - 1 ? '44%' : '100%'};`
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.skeleton {
  position: relative;
  overflow: hidden;
}

.skeleton__row {
  height: 24rpx;
  margin-top: 18rpx;
  background: linear-gradient(90deg, #f8efe7 0%, #fdf7f2 50%, #f8efe7 100%);
  border-radius: 14rpx;
}

.skeleton__row:first-child {
  margin-top: 0;
}

.skeleton--hero .skeleton__row {
  height: 30rpx;
}

.skeleton--list .skeleton__row {
  height: 22rpx;
}

.skeleton--tabs {
  display: flex;
  gap: 14rpx;
}

.skeleton--tabs .skeleton__row {
  margin-top: 0;
}

.skeleton--animated::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%);
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
