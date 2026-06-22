<template>
  <view class="page favorite-page">
    <CustomNavBar title="我的收藏" showBack />

    <EmptyState
      v-if="!items.length"
      title="还没有收藏商品"
      desc="在商品详情页点收藏后，会在这里集中查看。"
      action-text="去选商品"
      @action="goCategory"
    />

    <view v-else class="favorite-list">
      <ProductCard
        v-for="item in items"
        :key="item.id"
        :product="item"
        variant="category-row"
        action-text="加入购物车"
        show-desc
        @tap="goDetail"
        @join="addToCart"
      />
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import { getProductById } from '@/services/dataService'
import { addCartItem, getCartItemCount, getFavoriteItems } from '@/utils/shopState'

export default {
  components: { CustomNavBar, EmptyState, ProductCard },
  data() {
    return {
      items: []
    }
  },
  async onShow() {
    await this.loadFavorites()
  },
  methods: {
    async loadFavorites() {
      const saved = getFavoriteItems()
      this.items = await Promise.all(saved.map(async item => {
        if (item.name) return item
        const product = await getProductById(item.id || item.productId).catch(() => null)
        return product || item
      }))
    },
    goDetail(product) {
      uni.navigateTo({ url: `/pages/product/detail?id=${product.id || product.productId}` })
    },
    addToCart(product) {
      addCartItem(product, 1)
      const cartCount = getCartItemCount(product.id || product.productId)
      uni.showToast({ title: `购物车已有 ${cartCount} 份`, icon: 'success' })
    },
    goCategory() {
      uni.switchTab({ url: '/pages/category/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.favorite-page { padding-bottom: 160rpx; }
.favorite-list { display: flex; flex-direction: column; gap: 18rpx; margin-top: 20rpx; }
</style>
