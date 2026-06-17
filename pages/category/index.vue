<template>
  <view class="page category">
    <CustomNavBar title="全部商品" />
    <view class="search-card card">
      <text>⌕</text>
      <input v-model="keyword" placeholder="搜索商品名称、口味或食材" />
      <text v-if="keyword" class="search-card__clear" @tap="keyword = ''">×</text>
    </view>
    <scroll-view scroll-x class="category-scroll card" show-scrollbar="false">
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
    <view class="list-tools">
      <view class="list-tools__count">共 {{ filteredProducts.length }} 款商品</view>
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
        title="暂时没有匹配商品"
        desc="换个关键词，或者看看其他商品。"
      />
      <ProductCard
        v-else
        v-for="item in filteredProducts"
        :key="item.id"
        :product="item"
        variant="category-row"
        action-text="去参团"
        show-desc
        @tap="goDetail"
        @join="goDetail"
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
import { getCategories, getProducts } from '@/services/dataService'

export default {
  components: { CustomNavBar, ProductCard, EmptyState, BuyerTabBar },
  data() {
    return {
      products: [],
      keyword: '',
      sortKey: 'default',
      active: 'all',
      categories: [{ key: 'all', text: '全部' }],
      sortOptions: [
        { key: 'default', text: '默认' },
        { key: 'sold', text: '热销' },
        { key: 'price', text: '价格' },
        { key: 'stock', text: '库存' }
      ]
    }
  },
  onShow() {
    this.loadPageData()
  },
  onShareAppMessage() {
    return {
      title: '初炉 · 全部商品',
      path: '/pages/category/index'
    }
  },
  computed: {
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
    }
  },
  methods: {
    async loadPageData() {
      const [products, categories] = await Promise.all([getProducts(), getCategories()])
      this.products = products
      this.categories = categories
    },
    goDetail(product) {
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
  margin-top: 20rpx;
  padding: 18rpx;
  white-space: nowrap;
}

.category-tabs {
  display: inline-flex;
  gap: 14rpx;
}

.category-tab {
  @include flex-center;
  flex: 0 0 auto;
  min-width: 132rpx;
  height: 64rpx;
  padding: 0 22rpx;
  color: $color-text-regular;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 26rpx;
}

.category-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(232, 79, 95, 0.18);
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

.sort-tabs {
  display: flex;
  gap: 10rpx;
}

.sort-tab {
  @include flex-center;
  min-width: 76rpx;
  height: 52rpx;
  padding: 0 14rpx;
  color: $color-text-regular;
  background: $color-card;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-sm;
  font-size: 23rpx;
}

.sort-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(232, 79, 95, 0.18);
  font-weight: 700;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 22rpx;
}
</style>
