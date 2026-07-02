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
import { addCartItem, getCartItemCount, getFavoriteItems, setFavorite } from '@/utils/shopState'

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
      let removedCount = 0
      const items = (await Promise.all(saved.map(async item => {
        const id = item.id || item.productId
        if (!id) return null
        try {
          const product = await getProductById(id)
          if (!product) {
            removedCount += 1
            setFavorite(item, false)
            return null
          }
          return product
        } catch {
          return item
        }
      }))).filter(Boolean)
      this.items = items
      if (removedCount) {
        uni.showToast({ title: '已移除失效收藏', icon: 'none' })
      }
    },
    goDetail(product) {
      const id = product && (product.productId || product.id || product._id)
      if (!id) return
      uni.setStorageSync(`buyer_product_context_${id}`, product)
      if (product.id && product.id !== id) uni.setStorageSync(`buyer_product_context_${product.id}`, product)
      uni.navigateTo({ url: `/pages/product/detail?id=${id}` })
    },
    addToCart(product) {
      const stock = Number(product && product.stock || 0)
      const limit = Number(product && product.limit || 0)
      const max = stock > 0 ? Math.min(limit > 0 ? limit : 99, stock) : 0
      const current = getCartItemCount(product.id || product.productId)
      if (max <= 0) {
        uni.showToast({ title: '商品已售罄', icon: 'none' })
        return
      }
      if (current >= max) {
        uni.showToast({ title: '已到最大购买数量', icon: 'none' })
        return
      }
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
