<template>
  <view class="page create-group">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="group-settings card">
      <view class="section-title">团基础信息</view>
      <view class="setting-grid">
        <view class="field">
          <view class="field__label">团名称 <text>*</text></view>
          <input v-model.trim="groupForm.title" placeholder="例如：周末烘焙鲜享团" />
        </view>
        <view class="field">
          <view class="field__label">截单时间 <text>*</text></view>
          <view class="picker-line" @tap="pick('deadline')">{{ groupForm.deadline }}<text>〉</text></view>
        </view>
        <view class="field">
          <view class="field__label">发货时间 <text>*</text></view>
          <view class="picker-line" @tap="pick('deliveryTime')">{{ groupForm.deliveryTime }}<text>〉</text></view>
        </view>
        <view class="field">
          <view class="field__label">履约方式</view>
          <view class="picker-line" @tap="pick('deliveryRange')">{{ groupForm.deliveryRange }}<text>〉</text></view>
        </view>
      </view>
      <view class="batch-actions">
        <button @tap="selectRecommended">选择当前 {{ filteredProducts.length }} 款</button>
        <button @tap="clearSelected">清空重选</button>
      </view>
    </view>

    <view class="toolbar card">
      <view class="search-box">
        <text>⌕</text>
        <input v-model.trim="keyword" placeholder="搜索商品名称 / 分类" />
      </view>
      <scroll-view scroll-x class="category-scroll">
        <view class="category-list">
          <view
            v-for="item in categoryOptions"
            :key="item.key"
            class="category-chip"
            :class="{ active: activeCategory === item.key }"
            @tap="activeCategory = item.key"
          >{{ item.text }}</view>
        </view>
      </scroll-view>
      <view v-if="excludedCount > 0" class="filter-toggle">
        <switch :checked="showAllProducts" @change="showAllProducts = $event.detail.value" color="#e84f5f" />
        <text>显示已参团商品（{{ excludedCount }}款）</text>
      </view>
    </view>

    <view v-if="selectedCount" class="selected-panel card">
      <view class="section-head">
        <view>
          <view class="section-title">已选商品</view>
          <view class="section-subtitle">发布前请确认商品、库存和预计销售额</view>
        </view>
        <view class="pool-count">预计 ￥{{ estimatedSales }}</view>
      </view>
      <scroll-view scroll-x class="selected-scroll" show-scrollbar="false">
        <view class="selected-list">
          <view v-for="item in selectedItems" :key="item.id" class="selected-item">
            <image :src="item.image" mode="aspectFill" />
            <view class="selected-item__name">{{ item.name }}</view>
            <view class="selected-item__meta">￥{{ item.groupPrice }} · {{ item.groupStock }}份</view>
            <view class="selected-item__remove" @tap="removeProduct(item.id)">移除</view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="product-pool card">
      <view class="section-head">
        <view>
          <view class="section-title">已上架商品</view>
          <view class="section-subtitle">点击选择商品加入本场团</view>
        </view>
        <view class="pool-count">已选 {{ selectedCount }}/{{ filteredProducts.length }} 款</view>
      </view>

      <view v-if="loading" class="state-card">正在加载商品...</view>
      <view v-else-if="!filteredProducts.length" class="state-card">暂无已上架商品，请先在商品页添加并上架。</view>
      <view v-else class="pool-list">
        <view
          v-for="product in filteredProducts"
          :key="product.id"
          class="pool-item"
          :class="{ selected: isSelected(product.id) }"
          @tap="toggleProduct(product)"
        >
          <image :src="product.image" mode="aspectFill" lazy-load />
          <view class="pool-item__main">
            <view class="pool-item__name">{{ product.name }}</view>
            <view class="pool-item__desc">{{ product.desc || '新鲜烘焙商品' }}</view>
            <view class="pool-item__meta">
              <text>￥{{ product.price }}</text>
              <text>库存 {{ product.stock || product.totalStock || 0 }}</text>
            </view>
          </view>
          <view class="select-dot">{{ isSelected(product.id) ? '✓' : '+' }}</view>
        </view>
      </view>
    </view>

    <view class="summary-bar">
      <view>
        <text>{{ selectedCount }}</text> 款商品
        <text>{{ totalStock }}</text> 份库存
        <view>{{ groupForm.deadline }} · {{ groupForm.deliveryTime }}</view>
      </view>
      <button :disabled="publishing" @tap="publishGroup">{{ publishing ? '发布中...' : '发布本场团' }}</button>
    </view>
    <AdminTabBar active="create" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { getProducts, getCategories, saveGroup, getShopConfig, getActiveGroups } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, AdminTabBar },
  data() {
    return {
      loading: true,
      publishing: false,
      shop: {},
      keyword: '',
      activeCategory: 'all',
      products: [],
      selectedItems: [],
      productIdsInActiveGroups: [],
      showAllProducts: false,
      categoryOptions: [{ key: 'all', text: '全部' }],
      groupForm: {
        title: '明日新鲜烘焙团',
        deadline: '今日 22:00 截单',
        deliveryTime: '次日打包发货',
        deliveryRange: '快递发货 / 门店自提 / 同城配送'
      }
    }
  },
  computed: {
    filteredProducts() {
      const kw = this.keyword.toLowerCase()
      return this.products.filter(item => {
        const inCategory = this.activeCategory === 'all' || item.categoryKey === this.activeCategory
        const inKeyword = !kw || String(item.name || '').toLowerCase().includes(kw) || String(item.desc || '').toLowerCase().includes(kw)
        const notInActiveGroup = this.showAllProducts || !this.productIdsInActiveGroups.includes(item.id)
        return inCategory && inKeyword && notInActiveGroup
      })
    },
    excludedCount() {
      return this.productIdsInActiveGroups.length
    },
    selectedCount() {
      return this.selectedItems.length
    },
    totalStock() {
      return this.selectedItems.reduce((sum, item) => sum + Number(item.groupStock || item.stock || 0), 0)
    },
    estimatedSales() {
      const amount = this.selectedItems.reduce((sum, item) => {
        return sum + Number(item.groupPrice || item.price || 0) * Number(item.groupStock || item.stock || 0)
      }, 0)
      return amount.toFixed(amount % 1 === 0 ? 0 : 1)
    }
  },
  methods: {
    normalizeSelected(product) {
      const stock = Number(product.stock || product.totalStock || 30)
      return {
        ...product,
        groupPrice: String(product.price || ''),
        groupStock: String(stock),
        limit: String(product.limit || 5),
        tag: product.tag || '明日配送'
      }
    },
    isSelected(id) {
      return this.selectedItems.some(item => item.id === id)
    },
    toggleProduct(product) {
      if (this.isSelected(product.id)) this.removeProduct(product.id)
      else this.selectedItems.push(this.normalizeSelected(product))
    },
    removeProduct(id) {
      this.selectedItems = this.selectedItems.filter(item => item.id !== id)
    },
    selectRecommended() {
      if (!this.filteredProducts.length) return
      uni.showModal({
        title: '选择当前筛选商品',
        content: `确认选择当前筛选出的 ${this.filteredProducts.length} 款商品加入本场团吗？`,
        success: ({ confirm }) => {
          if (!confirm) return
          this.selectedItems = this.filteredProducts.map(this.normalizeSelected)
          uni.showToast({ title: `已选 ${this.filteredProducts.length} 款商品`, icon: 'success' })
        }
      })
    },
    clearSelected() {
      this.selectedItems = []
    },
    pick(key) {
      const map = {
        deadline: ['今日 20:00 截单', '今日 22:00 截单', '明日 10:00 截单'],
        deliveryTime: ['次日打包发货', '48小时内发货', '指定日期统一发货'],
        deliveryRange: ['快递发货 / 门店自提 / 同城配送', '仅快递发货', '仅门店自提', '快递发货 + 门店自提']
      }
      uni.showActionSheet({
        itemList: map[key],
        success: res => { this.groupForm[key] = map[key][res.tapIndex] }
      })
    },
    buildDeadlineAt() {
      const date = new Date()
      const text = this.groupForm.deadline || ''
      if (text.includes('明日')) date.setDate(date.getDate() + 1)
      const match = text.match(/(\d{1,2}):(\d{2})/)
      date.setHours(match ? Number(match[1]) : 22, match ? Number(match[2]) : 0, 0, 0)
      return date.toISOString()
    },
    validate() {
      if (!this.groupForm.title) return '请输入团名称'
      if (!this.selectedItems.length) return '请至少选择 1 款商品'
      const invalid = this.selectedItems.find(item => Number(item.groupPrice) <= 0 || Number(item.groupStock) <= 0 || Number(item.limit) <= 0)
      if (invalid) return `请检查「${invalid.name}」的价格、库存和限购`
      return ''
    },
    async publishGroup() {
      const message = this.validate()
      if (message) {
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      if (this.publishing) return
      const confirmed = await new Promise(resolve => {
        uni.showModal({
          title: '发布确认',
          content: `本场团将发布 ${this.selectedCount} 款商品，共 ${this.totalStock} 份库存，预计销售额 ￥${this.estimatedSales}。\n${this.groupForm.deadline}\n${this.groupForm.deliveryTime}`,
          confirmText: '确认发布',
          success: ({ confirm }) => resolve(confirm),
          fail: () => resolve(false)
        })
      })
      if (!confirmed) return
      this.publishing = true
      try {
        await saveGroup({
          title: this.groupForm.title,
          deadline: this.groupForm.deadline,
          deadlineAt: this.buildDeadlineAt(),
          deliveryTime: this.groupForm.deliveryTime,
          deliveryRange: this.groupForm.deliveryRange,
          fulfillmentMethods: this.groupForm.deliveryRange.split('/').map(item => item.trim()).filter(Boolean),
          productCount: this.selectedItems.length,
          totalStock: this.totalStock,
          products: this.selectedItems.map((item, index) => {
            const image = item.imageFileID || item.image
            return {
              id: item.id,
              productId: item.id,
              name: item.name,
              image,
              imageFileID: image,
              desc: item.desc,
              categoryKey: item.categoryKey,
              price: Number(item.groupPrice),
              originPrice: Number(item.originPrice || item.groupPrice),
              stock: Number(item.groupStock),
              totalStock: Number(item.groupStock),
              limit: Number(item.limit),
              tag: item.tag,
              priority: index < 3,
              status: 'active',
              sort: index + 1,
              deadline: this.groupForm.deadline,
              deadlineAt: this.buildDeadlineAt(),
              deliveryTime: this.groupForm.deliveryTime,
              deliveryRange: this.groupForm.deliveryRange,
              fulfillmentMethods: this.groupForm.deliveryRange.split('/').map(item => item.trim()).filter(Boolean),
              gallery: [image],
              galleryFileIDs: [image],
              bannerImage: image,
              bannerImageFileID: image
            }
          })
        })
        uni.showToast({ title: '本场团已发布', icon: 'success' })
        setTimeout(() => uni.redirectTo({ url: '/pages/admin/dashboard/index' }), 600)
      } catch (error) {
        showCloudError(error)
      } finally {
        this.publishing = false
      }
    },
    async loadData() {
      this.loading = true
      try {
        const [categories, products, shopConfig, activeGroups] = await Promise.all([getCategories(), getProducts(), getShopConfig(), getActiveGroups()])
        this.categoryOptions = categories.length ? categories : [{ key: 'all', text: '全部' }]
        this.shop = shopConfig
        const activeProducts = (products || []).filter(item => item && item.id && item.status === 'active')
        this.products = activeProducts
        // 获取所有进行中团购的商品ID
        const productIds = []
        const groupsArray = Array.isArray(activeGroups) ? activeGroups : []
        groupsArray.forEach(group => {
          const groupProducts = Array.isArray(group.products) ? group.products : []
          groupProducts.forEach(p => {
            if (p.id || p.productId) productIds.push(p.id || p.productId)
          })
        })
        this.productIdsInActiveGroups = [...new Set(productIds)]
      } catch (e) {
        this.productIdsInActiveGroups = []
      } finally {
        this.loading = false
      }
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/create-group/index', '需要店长权限')) return
    this.loadData()
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.create-group { padding-bottom: 310rpx; }
.group-settings,.toolbar,.selected-panel,.product-pool { margin-top:22rpx; padding:26rpx; }
.section-title { @include text-card-title; font-size:32rpx; font-weight:$font-weight-heavy; }
.section-subtitle { margin-top:8rpx; @include text-caption($color-text-light); }
.setting-grid { display:grid; grid-template-columns:1fr; gap:18rpx; margin-top:22rpx; }
.field { min-width:0; padding:18rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.field__label { @include text-caption($color-text-main); font-weight:$font-weight-bold; }
.field__label text { color:$color-primary; }
.field input,.picker-line { width:100%; height:56rpx; margin-top:10rpx; color:$color-text-main; font-size:26rpx; }
.picker-line { display:flex; align-items:center; justify-content:space-between; }
.batch-actions { display:flex; gap:16rpx; margin-top:22rpx; }
.batch-actions button { flex:1; height:74rpx; border-radius:$radius-md; color:$color-primary; background:$color-primary-light; border:1rpx solid rgba(232,79,95,.16); font-size:26rpx; font-weight:$font-weight-bold; line-height:74rpx; }
.batch-actions button:first-child { color:#fff; background:$color-primary; border-color:$color-primary; }
.search-box { display:flex; align-items:center; gap:12rpx; height:78rpx; padding:0 22rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-md; }
.search-box text { color:$color-primary; font-size:30rpx; }
.search-box input { flex:1; height:100%; font-size:26rpx; }
.category-scroll { margin-top:18rpx; white-space:nowrap; }
.category-list { display:flex; gap:14rpx; }
.category-chip { flex-shrink:0; padding:14rpx 24rpx; color:$color-text-regular; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-md; font-size:24rpx; }
.category-chip.active { color:$color-primary; background:$color-primary-light; border-color:rgba(232,79,95,.18); font-weight:700; }
.filter-toggle { display:flex; align-items:center; gap:12rpx; margin-top:16rpx; padding:12rpx 16rpx; background:$color-orange-light; border:1rpx solid #f1ddc6; border-radius:$radius-md; }
.filter-toggle text { font-size:24rpx; color:$color-text-regular; }
.section-head { display:flex; align-items:center; justify-content:space-between; gap:20rpx; }
.pool-count { flex-shrink:0; padding:10rpx 18rpx; border-radius:$radius-md; font-size:24rpx; font-weight:$font-weight-bold; color:$color-primary; background:$color-primary-light; }
.selected-scroll { margin-top:20rpx; white-space:nowrap; }
.selected-list { display:inline-flex; gap:16rpx; }
.selected-item { width:190rpx; padding:14rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.selected-item image { width:100%; height:120rpx; border-radius:$radius-sm; }
.selected-item__name { margin-top:10rpx; color:$color-text-main; font-size:24rpx; font-weight:700; @include text-ellipsis; }
.selected-item__meta { margin-top:6rpx; color:$color-text-light; font-size:22rpx; @include text-ellipsis; }
.selected-item__remove { margin-top:10rpx; color:$color-primary; font-size:22rpx; font-weight:700; }
.state-card { margin-top:22rpx; padding:42rpx 24rpx; text-align:center; color:$color-text-light; background:$color-bg-light; border-radius:$radius-card; font-size:26rpx; }
.pool-list { display:flex; flex-direction:column; gap:16rpx; margin-top:22rpx; }
.pool-item { position:relative; display:flex; gap:18rpx; padding:16rpx; border:1rpx solid $color-border-light; border-radius:$radius-card; background:#fff; }
.pool-item.selected { border-color:rgba(232,79,95,.42); background:$color-primary-pale; }
.pool-item image { width:116rpx; height:116rpx; border-radius:$radius-card; }
.pool-item__main { flex:1; min-width:0; }
.pool-item__name { @include text-body-strong; font-size:28rpx; @include text-ellipsis; }
.pool-item__desc { margin-top:8rpx; @include text-caption($color-text-light); @include text-ellipsis; }
.pool-item__meta { display:flex; gap:18rpx; margin-top:12rpx; font-size:24rpx; color:$color-text-regular; }
.pool-item__meta text:first-child { color:$color-primary; font-weight:$font-weight-bold; }
.select-dot { @include flex-center; flex-shrink:0; width:46rpx; height:46rpx; color:#fff; background:$color-primary; border-radius:$radius-md; font-size:28rpx; font-weight:$font-weight-bold; }
.summary-bar { position:fixed; left:0; right:0; bottom:calc(142rpx + env(safe-area-inset-bottom)); z-index:40; display:flex; align-items:center; gap:20rpx; padding:18rpx 24rpx; background:rgba(255,255,255,.98); box-shadow:$shadow-bottom-sm; border-top:1rpx solid $color-border-light; }
.summary-bar > view { flex:1; min-width:0; color:$color-text-main; font-size:26rpx; font-weight:$font-weight-bold; }
.summary-bar > view > text { color:$color-primary; font-size:32rpx; margin-right:6rpx; }
.summary-bar > view view { margin-top:6rpx; color:$color-text-light; font-size:22rpx; font-weight:$font-weight-regular; @include text-ellipsis; }
.summary-bar button { flex:0 0 220rpx; height:82rpx; color:#fff; background:$color-primary; border-radius:$radius-md; font-size:28rpx; font-weight:$font-weight-heavy; line-height:82rpx; box-shadow:none; }
.summary-bar button[disabled] { background:$color-text-light; box-shadow:none; }
</style>
