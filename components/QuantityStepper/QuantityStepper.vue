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
  height: 64rpx;
  overflow: hidden;
  background: #fff;
  border: 1rpx solid $color-border;
  border-radius: $radius-md;
}

.stepper--disabled {
  opacity: 0.55;
}

.stepper__btn {
  @include flex-center;
  width: 64rpx;
  height: 64rpx;
  color: $color-text-light;
  font-size: 36rpx;
  font-weight: 500;
}

.stepper__btn--plus {
  color: #fff;
  background: $color-primary;
  border-radius: 50%;
}

.stepper__btn--disabled {
  color: $color-text-placeholder;
  background: $color-bg-deep;
}

.stepper__btn--plus.stepper__btn--disabled {
  color: #fff;
  background: #f4bdc5;
}

.stepper__value {
  width: 72rpx;
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
