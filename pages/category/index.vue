<template>
  <view class="page category">
    <CustomNavBar :title="pageTitle" />
    <view class="search-card card">
      <text>⌕</text>
      <input v-model="keyword" placeholder="搜索商品名称、口味或食材" />
      <text v-if="keyword" class="search-card__clear" @tap="keyword = ''">×</text>
    </view>
    <view class="category-scroll card">
      <view class="category-scroll__fade"></view>
      <scroll-view scroll-x class="category-scroll__body" show-scrollbar="false">
        <view class="category-tabs">
          <view
            v-for="item in categories"
            :key="item.key"
            class="category-tab"
            :class="{ active: active === item.key }"
            @tap="active = item.key"
          >
            {{ item.text }}
          </view>
        </view>
      </scroll-view>
    </view>
    <view class="list-tools">
      <view class="list-tools__count">{{ groupId ? '本团' : '共' }} {{ filteredProducts.length }} 款商品</view>
      <view v-if="groupId" class="list-tools__all" @tap="clearGroupFilter">全部商品</view>
      <view class="sort-tabs">
        <view
          v-for="item in sortOptions"
          :key="item.key"
          class="sort-tab"
          :class="{ active: sortKey === item.key }"
          @tap="sortKey = item.key"
        >{{ item.text }}</view>
      </view>
    </view>
    <view class="product-list">
      <EmptyState
        v-if="!filteredProducts.length"
        :title="emptyTitle"
        :desc="emptyDesc"
      />
      <ProductCard
        v-else
        v-for="item in filteredProducts"
        :key="item.id"
        :product="item"
        variant="category-row"
        :show-action="false"
        show-cart-stepper
        :cart-count="cartCount(item)"
        :cart-max="itemMax(item)"
        :show-deadline="!!item.deadline"
        show-desc
        @tap="goDetail"
        @cart-increase="increaseCart"
        @cart-decrease="decreaseCart"
      />
    </view>
    <BuyerTabBar active="category" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import BuyerTabBar from '@/components/BuyerTabBar/BuyerTabBar.vue'
import { getCategories, getGroupById, getGroupProducts } from '@/services/dataService'
import { cloudImageHttpsUrl, IMAGE_ASSETS } from '@/utils/image'
import { addCartItem, getCartItems, updateCartItemCount } from '@/utils/shopState'

export default {
  components: { CustomNavBar, ProductCard, EmptyState, BuyerTabBar },
  data() {
    return {
      products: [],
      groupId: '',
      groupTitle: '',
      keyword: '',
      sortKey: 'default',
      active: 'all',
      cartMap: {},
      categories: [{ key: 'all', text: '全部' }],
      sortOptions: [
        { key: 'default', text: '默认' },
        { key: 'sold', text: '热销' },
        { key: 'price', text: '价格' },
        { key: 'stock', text: '库存' }
      ]
    }
  },
  onLoad(query = {}) {
    this.groupId = query.groupId || ''
    if (this.groupId) uni.setStorageSync('buyer_selected_group_id', this.groupId)
  },
  onShow() {
    const selectedGroupId = uni.getStorageSync('buyer_selected_group_id') || ''
    if (selectedGroupId !== this.groupId) {
      this.groupId = selectedGroupId
      this.groupTitle = ''
      this.keyword = ''
      this.active = 'all'
    }
    this.loadPageData()
    this.syncCartState()
  },
  mounted() {
    uni.$on('buyer:category-clear-group', this.clearGroupFilter)
  },
  beforeDestroy() {
    uni.$off('buyer:category-clear-group', this.clearGroupFilter)
  },
  onShareAppMessage() {
    if (this.groupId) {
      return {
        title: this.groupTitle ? `${this.groupTitle} · 初炉团购` : '初炉今日团购',
        path: `/pages/category/index?groupId=${this.groupId}`,
        imageUrl: this.shareCoverImage()
      }
    }
    return {
      title: '初炉 · 全部商品',
      path: '/pages/category/index',
      imageUrl: this.shareCoverImage()
    }
  },
  computed: {
    pageTitle() {
      return this.groupTitle || (this.groupId ? '团购商品' : '全部商品')
    },
    filteredProducts() {
      const keyword = this.keyword.trim()
      let list = this.products
      if (this.active !== 'all') list = list.filter(item => item.categoryKey === this.active)
      if (keyword) list = list.filter(item => [item.name, item.desc, item.subtitle, ...(item.ingredients || [])].join(' ').includes(keyword))
      const sorted = list.slice()
      if (this.sortKey === 'sold') sorted.sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
      if (this.sortKey === 'price') sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
      if (this.sortKey === 'stock') sorted.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
      return sorted
    },
    emptyTitle() {
      return this.products.length ? '暂时没有匹配商品' : (this.groupId ? '本团暂无商品' : '当前暂无开团商品')
    },
    emptyDesc() {
      return this.products.length ? '换个关键词，或者看看其他商品。' : '店长发布团购后，这里会展示可购买商品。'
    }
  },
  methods: {
    shareCoverImage() {
      const product = (this.products && this.products[0]) || {}
      const image = product.bannerImage || product.image || product.imageFileID || product.bannerImageFileID || ''
      if (String(image).startsWith('cloud://')) return cloudImageHttpsUrl(image) || image
      return image || cloudImageHttpsUrl(IMAGE_ASSETS.banner)
    },
    syncCartState() {
      const map = {}
      getCartItems().forEach(item => {
        const id = item.id || item.productId || item._id
        if (id) map[id] = Number(item.count || 0)
      })
      this.cartMap = map
    },
    productId(product = {}) {
      return product.id || product.productId || product._id || ''
    },
    cartCount(product = {}) {
      return Number(this.cartMap[this.productId(product)] || 0)
    },
    itemMax(product = {}) {
      const stock = Number(product.stock || 0)
      const limit = Number(product.limit || 0)
      const maxByLimit = limit > 0 ? limit : 99
      return stock > 0 ? Math.min(maxByLimit, stock) : 0
    },
    increaseCart(product) {
      if (!product || Number(product.stock || 0) <= 0) {
        uni.showToast({ title: '商品已售罄', icon: 'none' })
        return
      }
      const current = this.cartCount(product)
      const max = this.itemMax(product)
      if (current >= max) {
        uni.showToast({ title: '已到最大购买数量', icon: 'none' })
        return
      }
      addCartItem(product, 1)
      this.syncCartState()
    },
    decreaseCart(product) {
      const id = this.productId(product)
      const current = this.cartCount(product)
      if (!id || current <= 0) return
      updateCartItemCount(id, current - 1)
      this.syncCartState()
    },
    async loadPageData() {
      const [products, categories, group] = await Promise.all([
        getGroupProducts(this.groupId),
        getCategories(),
        this.groupId ? getGroupById(this.groupId).catch(() => null) : Promise.resolve(null)
      ])
      this.products = products
      this.categories = categories
      this.groupTitle = group ? (group.title || group.name || '') : ''
    },
    clearGroupFilter() {
      if (!this.groupId) return
      this.groupId = ''
      this.groupTitle = ''
      this.keyword = ''
      this.active = 'all'
      this.loadPageData()
    },
    goDetail(product) {
      if (product && product.id) {
        uni.setStorageSync(`buyer_product_context_${product.id}`, product)
      }
      uni.navigateTo({ url: `/pages/product/detail?id=${product.id}` })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.category {
  padding-bottom: 180rpx;
}

.search-card {
  display: flex;
  align-items: center;
  height: 82rpx;
  margin-top: 20rpx;
  padding: 0 26rpx;
  background: $color-card;
  border-radius: $radius-pill;
}

.search-card text {
  margin-right: 14rpx;
  color: $color-text-placeholder;
  font-size: 34rpx;
}

.search-card input {
  flex: 1;
  min-width: 0;
  color: $color-text-main;
  font-size: 28rpx;
}

.search-card__clear {
  flex-shrink: 0;
  margin-left: 12rpx;
  color: $color-text-placeholder;
  font-size: 30rpx;
}

.category-scroll {
  position: relative;
  margin-top: 20rpx;
  padding: 16rpx 18rpx;
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
}

.category-scroll__fade {
  position: absolute;
  right: 0;
  top: 0;
  z-index: 2;
  width: 54rpx;
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), $color-card 76%);
  pointer-events: none;
}

.category-scroll__body {
  width: 100%;
  white-space: nowrap;
}

.category-tabs {
  display: inline-flex;
  gap: 10rpx;
  padding-right: 52rpx;
}

.category-tab {
  @include flex-center;
  flex: 0 0 auto;
  min-width: 104rpx;
  max-width: 188rpx;
  height: 56rpx;
  padding: 0 18rpx;
  color: $color-text-regular;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
  font-size: 24rpx;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255, 92, 114, 0.20);
  font-weight: 800;
}

.list-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 20rpx;
}

.list-tools__count {
  flex-shrink: 0;
  color: $color-text-light;
  font-size: 24rpx;
}

.list-tools__all {
  flex-shrink: 0;
  height: 52rpx;
  padding: 0 18rpx;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(255, 92, 114, 0.20);
  border-radius: $radius-pill;
  font-size: 23rpx;
  line-height: 52rpx;
  font-weight: $font-weight-semibold;
}

.sort-tabs {
  display: flex;
  gap: 10rpx;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
}

.sort-tab {
  @include flex-center;
  min-width: 76rpx;
  height: 52rpx;
  padding: 0 14rpx;
  color: $color-text-regular;
  background: $color-card;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
  font-size: 23rpx;
}

.sort-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255, 92, 114, 0.20);
  font-weight: 700;
}


.product-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 22rpx;
}
</style>
