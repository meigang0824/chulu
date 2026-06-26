<template>
  <view class="page product-manage">
    <CustomNavBar title="商品管理" showBack />

    <view class="summary card">
      <view class="summary__item">
        <text>{{ products.length }}</text>
        <view>商品总数</view>
      </view>
      <view class="summary__item">
        <text>{{ activeCount }}</text>
        <view>上架中</view>
      </view>
      <view class="summary__item">
        <text>{{ inactiveCount }}</text>
        <view>已下架</view>
      </view>
      <view class="summary__item summary__item--warn" @tap="active = 'lowStock'">
        <text>{{ lowStockCount }}</text>
        <view>低库存</view>
      </view>
    </view>

    <view class="toolbar card">
      <view class="toolbar__search">
        <text>⌕</text>
        <input v-model.trim="keyword" placeholder="搜索商品名称或描述" />
        <text v-if="keyword" @tap="keyword = ''">×</text>
      </view>
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="toolbar__tab"
        :class="{ 'toolbar__tab--active': active === tab.key }"
        @tap="active = tab.key"
      >
        {{ tab.text }}
      </view>
      <button class="toolbar__add" @tap="createProduct">+ 新增商品</button>
    </view>

    <view v-if="loading" class="list">
      <view v-for="index in 3" :key="index" class="product-card card product-card--loading">
        <view class="product-card__image product-card__image--loading"></view>
        <view class="product-card__main">
          <SkeletonBlock variant="list" :rows="4" />
        </view>
      </view>
    </view>

    <view v-else-if="filteredProducts.length" class="list">
      <view v-for="item in renderProducts" :key="item._renderKey" class="product-card card">
        <image class="product-card__image" :src="item.image" mode="aspectFill" lazy-load />
        <view class="product-card__main">
          <view class="product-card__head">
            <view class="product-card__title">{{ item.name }}</view>
            <StatusTag :type="item.status === 'active' ? 'active' : 'cancelled'" :text="item.status === 'active' ? '上架中' : '已下架'" size="sm" />
          </view>
          <view class="product-card__desc">{{ item.desc || item.subtitle }}</view>
          <view class="product-card__meta">
            <text>￥{{ money(item.price) }}</text>
            <text>原价 ￥{{ money(item.originPrice) }}</text>
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
      title="当前筛选下还没有商品"
      desc="可以先新建商品，或者切回全部看看。"
      action-text="新增商品"
      @action="createProduct"
    />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import { getAdminProducts, updateProductStatus, deleteProduct } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'
import { money } from '@/utils/format'

export default {
  components: { CustomNavBar, StatusTag, EmptyState, SkeletonBlock },
  data() {
    return {
      products: [],
      loading: true,
      keyword: '',
      active: 'all',
      tabs: [
        { key: 'all', text: '全部' },
        { key: 'active', text: '上架中' },
        { key: 'inactive', text: '已下架' },
        { key: 'lowStock', text: '低库存' }
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
    lowStockCount() {
      return this.products.filter(item => Number(item.stock || 0) <= 5).length
    },
    filteredProducts() {
      const keyword = this.keyword.trim()
      let list = this.products
      if (this.active === 'active') list = list.filter(item => item.status === 'active')
      if (this.active === 'inactive') list = list.filter(item => item.status !== 'active')
      if (this.active === 'lowStock') list = list.filter(item => Number(item.stock || 0) <= 5)
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
    if (!ensurePageAccess('/pages/admin/product-manage/index', '需要店长权限')) return
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/product-manage/index', '需要店长权限')) return
    this.loadProducts()
  },
  methods: {
    money,
    async loadProducts() {
      this.loading = true
      this.products = await getAdminProducts()
      this.loading = false
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

.product-manage {
  padding-bottom: 80rpx;
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
  padding: 24rpx 0;
  text-align: center;
}

.summary__item text {
  color: $color-primary;
  font-size: 40rpx;
  font-weight: 800;
}

.summary__item view {
  margin-top: 8rpx;
  color: $color-text-regular;
  font-size: 24rpx;
}

.summary__item--warn text {
  color: $color-orange;
}

@media screen and (max-width: 430px) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 22rpx;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 22rpx;
  padding: 18rpx;
}

.toolbar__search {
  display: flex;
  align-items: center;
  width: 100%;
  height: 72rpx;
  padding: 0 20rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
}

.toolbar__search text {
  flex-shrink: 0;
  color: $color-text-placeholder;
  font-size: 28rpx;
}

.toolbar__search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  margin: 0 14rpx;
  color: $color-text-main;
  font-size: 26rpx;
}

.toolbar__tab {
  @include flex-center;
  min-width: 120rpx;
  height: 62rpx;
  padding: 0 20rpx;
  color: $color-text-regular;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 24rpx;
}

.toolbar__tab--active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255,92,114,.20);
  font-weight: 800;
}

.toolbar__add {
  margin: 0 0 0 auto;
  min-width: 180rpx;
  height: 66rpx;
  padding: 0 22rpx;
  color: #fff;
  background: $color-primary;
  border: none;
  border-radius: $radius-md;
  font-size: 26rpx;
  line-height: 66rpx;
}

.list {
  margin-top: 22rpx;
}

.product-card {
  display: flex;
  gap: 18rpx;
  padding: 22rpx;
}

.product-card + .product-card {
  margin-top: 18rpx;
}

.product-card__image {
  width: 170rpx;
  height: 170rpx;
  border-radius: $radius-card;
  flex-shrink: 0;
}

.product-card__image--loading {
  background: $color-bg-deep;
}

.product-card__main {
  flex: 1;
  min-width: 0;
}

.product-card--loading {
  align-items: center;
}

.product-card__head {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.product-card__title {
  flex: 1;
  min-width: 0;
  color: $color-text-main;
  font-size: 30rpx;
  font-weight: 800;
  @include text-ellipsis;
}

.product-card__desc {
  margin-top: 12rpx;
  color: $color-text-regular;
  font-size: 24rpx;
  line-height: 1.45;
  @include multi-ellipsis(2);
}

.product-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx 18rpx;
  margin-top: 14rpx;
}

.product-card__meta text:first-child {
  color: $color-primary;
  font-size: 34rpx;
  font-weight: 800;
}

.product-card__meta text {
  color: $color-text-light;
  font-size: 24rpx;
}

.product-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 18rpx;
}

.ghost-btn {
  min-width: 120rpx;
  height: 60rpx;
  margin: 0;
  padding: 0 22rpx;
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
  border-radius: $radius-md;
  font-size: 24rpx;
  line-height: 60rpx;
}

.ghost-btn.danger {
  color: $color-danger;
  border-color: $color-danger;
  background: $color-danger-light;
}

</style>
