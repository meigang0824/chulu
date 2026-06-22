<template>
  <view class="page shelf-page">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="filter-wrap card">
      <view class="filter-row">
        <view class="category-tabs">
          <view
            v-for="tab in tabs"
            :key="tab.key"
            class="category-tab"
            :class="{ active: active === tab.key }"
            @tap="active = tab.key"
          >
            {{ tab.text }}
            <text class="category-tab__count">{{ getTabCount(tab.key) }}</text>
          </view>
        </view>
        <button class="add-btn" @tap="createProduct">+ 新增</button>
      </view>
      <view class="search-card" style="margin-top:18rpx;">
        <text>⌕</text>
        <input v-model="keyword" placeholder="搜索商品名称、分类或描述" />
        <text v-if="keyword" class="search-clear" @tap="keyword = ''">✕</text>
      </view>
    </view>

    <view v-if="loading" class="list">
      <view v-for="index in 3" :key="index" class="product-card card product-card--loading">
        <view class="product-card__image product-card__image--loading"></view>
        <view class="product-card__main">
          <SkeletonBlock variant="list" :rows="4" />
        </view>
      </view>
    </view>

    <view v-else-if="renderProducts.length" class="list">
      <view v-for="item in renderProducts" :key="item._renderKey" class="product-card card">
        <image class="product-card__image" :src="item.image" mode="aspectFill" lazy-load />
        <view class="product-card__main">
          <view class="product-card__head">
            <view class="product-card__title">{{ item.name }}</view>
            <StatusTag :type="item.status === 'active' ? 'active' : 'cancelled'" :text="item.status === 'active' ? '上架中' : '已下架'" size="sm" />
          </view>
          <view class="product-card__desc">{{ item.desc || item.subtitle || '暂未填写商品描述' }}</view>
          <view class="product-card__meta">
            <text>￥{{ item.price }}</text>
            <text>原价 ￥{{ item.originPrice }}</text>
            <text>库存 {{ item.stock }}</text>
            <text>已售 {{ item.sold }}</text>
          </view>
          <view class="product-card__actions">
            <button class="ghost-btn" @tap="editProduct(item)">编辑</button>
            <button class="ghost-btn" @tap="toggleStatus(item)">{{ item.status === 'active' ? '下架' : '上架' }}</button>
            <button v-if="item.status !== 'active'" class="ghost-btn danger" @tap="deleteProductItem(item)">删除</button>
          </view>
        </view>
      </view>
    </view>

    <EmptyState
      v-else
      title="当前还没有可管理的商品"
      desc="先添加商品并上架，开团时才能从商品池里选择。"
      action-text="新增商品"
      @action="createProduct"
    />

    <AdminTabBar active="stock" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { getAdminProducts, updateProductStatus, deleteProduct, getShopConfig } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, StatusTag, EmptyState, SkeletonBlock, AdminTabBar },
  data() {
    return {
      shop: {},
      products: [],
      loading: true,
      active: 'all',
      keyword: '',
      tabs: [
        { key: 'all', text: '全部' },
        { key: 'active', text: '上架中' },
        { key: 'inactive', text: '已下架' }
      ]
    }
  },
  computed: {
    activeCount() {
      return this.products.filter(item => item.status === 'active').length
    },
    inactiveCount() {
      return this.products.filter(item => item.status !== 'active').length
    },
    filteredProducts() {
      const keyword = this.keyword.trim()
      let list = this.products
      if (this.active === 'active') list = list.filter(item => item.status === 'active')
      if (this.active === 'inactive') list = list.filter(item => item.status !== 'active')
      if (!keyword) return list
      return list.filter(item => [item.name, item.desc, item.subtitle, item.categoryKey].join(' ').includes(keyword))
    },
    renderProducts() {
      return this.filteredProducts.map((item, index) => ({
        ...item,
        _renderKey: item.id || item._id || `product_${index}`
      }))
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/stock-summary/index', '需要店长权限')) return
  },
  async onShow() {
    if (!ensurePageAccess('/pages/admin/stock-summary/index', '需要店长权限')) return
    await this.loadProducts()
  },
  methods: {
    async loadProducts() {
      this.loading = true
      try {
        const [products, shopConfig] = await Promise.all([getAdminProducts(), getShopConfig()])
        this.products = products
        this.shop = shopConfig
      } finally {
        this.loading = false
      }
    },
    getTabCount(key) {
      if (key === 'all') return this.products.length
      if (key === 'active') return this.activeCount
      return this.inactiveCount
    },
    createProduct() {
      uni.navigateTo({ url: '/pages/admin/product-edit/index' })
    },
    editProduct(item) {
      const id = item.id || item._id || item.docId
      if (!id) {
        uni.showToast({ title: '商品编号缺失，无法编辑', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/pages/admin/product-edit/index?id=${id}` })
    },
    toggleStatus(item) {
      const id = item.id || item._id || item.docId
      if (!id) {
        uni.showToast({ title: '商品编号缺失，无法更新', icon: 'none' })
        return
      }
      const targetStatus = item.status === 'active' ? 'inactive' : 'active'
      uni.showModal({
        title: targetStatus === 'active' ? '上架商品' : '下架商品',
        content: `确认${targetStatus === 'active' ? '上架' : '下架'}“${item.name}”吗？`,
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '更新中' })
            await updateProductStatus(id, targetStatus)
            await this.loadProducts()
            uni.hideLoading()
            uni.showToast({ title: targetStatus === 'active' ? '已上架' : '已下架', icon: 'success' })
          } catch (error) {
            uni.hideLoading()
            showCloudError(error)
          }
        }
      })
    },
    deleteProductItem(item) {
      const id = item.id || item._id || item.docId
      if (!id) {
        uni.showToast({ title: '商品编号缺失，无法删除', icon: 'none' })
        return
      }
      if (item.status === 'active') {
        uni.showToast({ title: '请先下架后再删除', icon: 'none' })
        return
      }
      uni.showModal({
        title: '删除商品',
        content: `确认删除“${item.name}”吗？删除后不可恢复。`,
        confirmText: '删除',
        confirmColor: '#ff4d4f',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '删除中' })
            await deleteProduct(id)
            await this.loadProducts()
            uni.hideLoading()
            uni.showToast({ title: '已删除', icon: 'success' })
          } catch (error) {
            uni.hideLoading()
            showCloudError(error)
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.shelf-page { padding-bottom: 190rpx; }
.filter-wrap { margin-top:18rpx; padding:18rpx; }
.filter-row { display:flex; align-items:center; justify-content:space-between; gap:14rpx; }
.category-tabs { display:flex; gap:14rpx; flex:1; min-width:0; }
.add-btn { flex-shrink:0; min-width:130rpx; height:64rpx; margin:0; padding:0 20rpx; color:#fff; background:$gradient-primary; border:none; border-radius:$radius-pill; box-shadow:$shadow-btn; font-size:24rpx; line-height:64rpx; }
.category-tab { @include flex-center; flex:1; height:64rpx; color:$color-text-regular; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-pill; font-size:26rpx; }
.category-tab.active { color:$color-primary; background:$color-primary-light; border-color:rgba(255,92,114,.20); font-weight:800; }
.category-tab__count { margin-left:8rpx; font-size:20rpx; opacity:.8; }
.search-card { display:flex; align-items:center; height:76rpx; padding:0 24rpx; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-pill; }
.search-card text { margin-right:14rpx; color:$color-text-placeholder; font-size:34rpx; }
.search-card input { flex:1; min-width:0; color:$color-text-main; font-size:28rpx; }
.search-clear { margin-right:0 !important; margin-left:10rpx; font-size:26rpx !important; }
.list { margin-top:22rpx; }
.product-card { display:flex; gap:18rpx; padding:22rpx; border:1rpx solid $color-border-light; }
.product-card + .product-card { margin-top:18rpx; }
.product-card__image { width:170rpx; height:170rpx; border-radius:24rpx; flex-shrink:0; }
.product-card__image--loading { background:#f8efe7; }
.product-card__main { flex:1; min-width:0; }
.product-card--loading { align-items:center; }
.product-card__head { display:flex; align-items:center; gap:14rpx; }
.product-card__title { flex:1; min-width:0; color:$color-text-main; font-size:30rpx; font-weight:800; @include text-ellipsis; }
.product-card__desc { margin-top:10rpx; color:$color-text-regular; font-size:24rpx; line-height:1.5; }
.product-card__meta { display:flex; flex-wrap:wrap; gap:10rpx 16rpx; margin-top:16rpx; color:$color-text-light; font-size:22rpx; }
.product-card__meta text:first-child { color:$color-primary; font-size:34rpx; font-weight:800; }
.product-card__actions { display:flex; gap:14rpx; margin-top:18rpx; }
.ghost-btn { min-width:136rpx; height:64rpx; margin:0; padding:0 18rpx; color:$color-text-main; background:#fff; border:1rpx solid $color-border; border-radius:$radius-pill; font-size:24rpx; line-height:64rpx; }
.ghost-btn.danger { color:$color-danger; background:$color-danger-light; border-color:$color-danger; }
</style>
