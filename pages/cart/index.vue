<template>
  <view class="page cart-page">
    <CustomNavBar title="购物车" />

    <EmptyState
      v-if="!items.length"
      title="购物车还是空的"
      desc="把想一起购买的商品先加入购物车，再统一结算。"
      action-text="去选商品"
      @action="goCategory"
    />

    <template v-else>
      <view class="cart-list">
        <view class="cart-item card" v-for="item in items" :key="item.id">
          <image class="cart-item__image" :src="item.image" mode="aspectFill" @error="repairItemImage(item)" />
          <view class="cart-item__main">
            <view class="cart-item__name">{{ item.name }}</view>
            <view class="cart-item__meta">
              <text>已选 {{ item.count || 1 }} 份</text>
              <text>单次最多 {{ itemMax(item) }} 份</text>
            </view>
            <view class="cart-item__bottom">
              <view class="cart-item__price">￥{{ item.price }}</view>
              <view class="cart-stepper">
                <view
                  class="cart-stepper__btn"
                  :class="{ 'cart-stepper__btn--disabled': Number(item.count || 1) <= 1 }"
                  @tap.stop="decreaseItem(item)"
                >−</view>
                <view class="cart-stepper__value">{{ item.count || 1 }}</view>
                <view
                  class="cart-stepper__btn"
                  :class="{ 'cart-stepper__btn--disabled': Number(item.count || 1) >= itemMax(item) }"
                  @tap.stop="increaseItem(item)"
                >+</view>
              </view>
            </view>
          </view>
          <view class="cart-item__remove" @tap="removeItem(item)">×</view>
        </view>
      </view>

      <view class="cart-bottom">
        <view class="cart-bottom__meta">
          <view>共 {{ totalCount }} 件</view>
          <text>合计：￥{{ totalAmount }}</text>
        </view>
        <button @tap="checkout">去结算</button>
      </view>
    </template>
    <BuyerTabBar active="cart" :badge-count="totalCount" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import BuyerTabBar from '@/components/BuyerTabBar/BuyerTabBar.vue'
import { getCartItems, removeCartItems, saveCartItems, setCheckoutItems, updateCartItemCount } from '@/utils/shopState'
import { requireLogin } from '@/utils/auth'
import { getProductById } from '@/services/dataService'

export default {
  components: { CustomNavBar, EmptyState, BuyerTabBar },
  data() {
    return {
      items: []
    }
  },
  onShow() {
    this.loadCart()
  },
  computed: {
    totalCount() {
      return this.items.reduce((sum, item) => sum + Number(item.count || 0), 0)
    },
    totalAmount() {
      const total = this.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.count || 0), 0)
      return total.toFixed(2)
    }
  },
  methods: {
    loadCart() {
      this.items = getCartItems()
    },
    async repairItemImage(item) {
      const id = item.productId || item.id
      if (!id) return
      const product = await getProductById(id).catch(() => null)
      if (!product || !product.image) return
      const next = this.items.map(row => {
        if (row.id !== item.id && row.productId !== item.productId) return row
        return {
          ...row,
          image: product.image,
          imageFileID: product.imageFileID || row.imageFileID
        }
      })
      this.items = next
      saveCartItems(next)
    },
    itemMax(item) {
      const limit = Number(item.limit || 0)
      return limit > 1 ? limit : 99
    },
    updateCount(item, count) {
      updateCartItemCount(item.id, count)
      this.loadCart()
    },
    decreaseItem(item) {
      const current = Number(item.count || 1)
      if (current <= 1) return
      this.updateCount(item, current - 1)
    },
    increaseItem(item) {
      const current = Number(item.count || 1)
      const max = this.itemMax(item)
      if (current >= max) {
        uni.showToast({ title: '已到最大购买数量', icon: 'none' })
        return
      }
      this.updateCount(item, current + 1)
    },
    removeItem(item) {
      removeCartItems([item.id])
      this.loadCart()
    },
    checkout() {
      if (!requireLogin('结算前请先登录')) return
      setCheckoutItems(this.items)
      uni.navigateTo({ url: '/pages/order/confirm/index?from=cart' })
    },
    goCategory() {
      uni.switchTab({ url: '/pages/category/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.cart-page { padding-bottom: 300rpx; }
.cart-list { margin-top: 20rpx; }
.cart-item { position: relative; display: flex; gap: 18rpx; margin-top: 18rpx; padding: 20rpx; }
.cart-item__image { flex-shrink: 0; width: 150rpx; height: 150rpx; border-radius: 22rpx; background: $color-bg-deep; }
.cart-item__main { flex: 1; min-width: 0; }
.cart-item__name { color: $color-text-main; font-size: 30rpx; font-weight: 800; line-height: 1.3; @include multi-ellipsis(2); }
.cart-item__meta { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 8rpx; color: $color-text-light; font-size: 23rpx; }
.cart-item__meta text:first-child { color: $color-primary; font-weight: 700; }
.cart-item__bottom { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 18rpx; }
.cart-item__price { color: $color-primary; font-size: 34rpx; font-weight: 900; }
.cart-stepper {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}
.cart-stepper__btn {
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
.cart-stepper__btn--disabled {
  color: $color-text-placeholder;
  background: $color-bg-deep;
  border-color: $color-border-light;
  box-shadow: none;
}
.cart-stepper__value {
  width: 52rpx;
  color: $color-text-main;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
}
.cart-item__remove { position: absolute; right: 18rpx; top: 14rpx; width: 40rpx; height: 40rpx; color: $color-text-light; text-align: center; font-size: 34rpx; line-height: 40rpx; }
.cart-bottom { position: fixed; left: 0; right: 0; bottom: calc(142rpx + env(safe-area-inset-bottom)); z-index: 20; display: flex; align-items: center; gap: 22rpx; padding: 18rpx 24rpx; background: rgba(255, 253, 249, 0.98); border-top: 1rpx solid $color-border-light; box-shadow: $shadow-bottom; }
.cart-bottom__meta { flex: 1; min-width: 0; color: $color-text-regular; font-size: 24rpx; }
.cart-bottom__meta text { display: block; margin-top: 4rpx; color: $color-primary; font-size: 34rpx; font-weight: 900; }
.cart-bottom button { @include flex-center; width: 220rpx; height: 88rpx; margin: 0; color: #fff; background: $gradient-primary; border: none; border-radius: $radius-pill; box-shadow: $shadow-btn; font-size: 30rpx; font-weight: 800; }
</style>
