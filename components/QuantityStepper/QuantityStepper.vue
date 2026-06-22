<template>
  <view class="stepper" :class="{ 'stepper--disabled': isSoldOut }">
    <view class="stepper__btn" :class="{ 'stepper__btn--disabled': isMin }" @tap="minus">−</view>
    <view v-if="isSoldOut" class="stepper__soldout">已售罄</view>
    <view v-else class="stepper__value">{{ currentValue }}</view>
    <view class="stepper__btn stepper__btn--plus" :class="{ 'stepper__btn--disabled': isMax }" @tap="plus">+</view>
  </view>
</template>

<script>
export default {
  name: 'QuantityStepper',
  props: {
    value: { type: Number, default: undefined },
    modelValue: { type: Number, default: undefined },
    min: { type: Number, default: 1 },
    max: { type: Number, default: 999 },
    disabled: { type: Boolean, default: false }
  },
  computed: {
    currentValue() {
      const value = this.modelValue !== undefined ? this.modelValue : this.value
      return Number(value === undefined ? this.min : value)
    },
    isMin() {
      return this.disabled || this.currentValue <= this.min
    },
    isMax() {
      return this.disabled || this.currentValue >= this.max
    },
    isSoldOut() {
      return this.disabled || this.max <= 0
    }
  },
  methods: {
    update(next) {
      this.$emit('input', next)
      this.$emit('update:modelValue', next)
      this.$emit('change', next)
    },
    minus() {
      if (this.isMin) return
      this.update(this.currentValue - 1)
    },
    plus() {
      if (this.isMax) return
      this.update(this.currentValue + 1)
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.stepper {
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 64rpx;
  overflow: visible;
  background: transparent;
}

.stepper--disabled {
  opacity: 0.55;
}

.stepper__btn {
  @include flex-center;
  width: 56rpx;
  height: 56rpx;
  color: $color-primary;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1;
  background: #fff;
  border: 1rpx solid rgba(255, 92, 114, 0.22);
  border-radius: 50%;
  box-shadow: 0 8rpx 18rpx rgba(255, 92, 114, 0.1);
}

.stepper__btn--plus {
  color: $color-primary;
  background: #fff;
  box-shadow: 0 8rpx 18rpx rgba(255, 92, 114, 0.1);
}

.stepper__btn--disabled {
  color: $color-text-placeholder;
  background: $color-bg-deep;
  border-color: $color-border-light;
  box-shadow: none;
}

.stepper__btn--plus.stepper__btn--disabled {
  color: $color-text-placeholder;
  background: $color-bg-deep;
  box-shadow: none;
}

.stepper__value {
  width: 52rpx;
  color: $color-text-main;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
}

.stepper__soldout {
  width: 72rpx;
  color: $color-text-light;
  font-size: 22rpx;
  text-align: center;
  font-weight: 500;
}
</style>
