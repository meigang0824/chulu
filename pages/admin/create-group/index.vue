<template>
  <view class="page create-group" :class="{ 'create-group--editing': isEditMode }">
    <CustomNavBar showBack :title="isEditMode ? '编辑团购' : '发布团购'" />

    <view class="group-settings card">
      <view class="section-title">团基础信息</view>
      <view class="setting-grid">
        <view class="field">
          <view class="field__label">团名称 <text>*</text></view>
          <input v-model.trim="groupForm.title" placeholder="例如：周末烘焙鲜享团" />
        </view>
        <view class="field">
          <view class="field__label">截单时间 <text>*</text></view>
          <view class="deadline-pickers">
            <picker mode="date" :value="groupForm.deadlineDate" :start="todayDate" @change="setDeadlineDate">
              <view class="picker-line">{{ groupForm.deadlineDate }}<text>〉</text></view>
            </picker>
            <picker mode="time" :value="groupForm.deadlineTime" @change="setDeadlineTime">
              <view class="picker-line">{{ groupForm.deadlineTime }}<text>〉</text></view>
            </picker>
          </view>
          <view class="field__helper">{{ deadlineLabel }}</view>
        </view>
        <view class="field">
          <view class="field__label">发货时间 <text>*</text></view>
          <view class="picker-line" @tap="pick('deliveryTime')">{{ groupForm.deliveryTime }}<text>〉</text></view>
        </view>
        <view class="field">
          <view class="field__label">履约方式</view>
          <view class="picker-line picker-line--static">{{ groupForm.deliveryRange }}</view>
        </view>
      </view>
    </view>

    <view class="selected-panel card">
      <view class="section-head">
        <view>
          <view class="section-title">已选商品</view>
          <view class="section-subtitle">{{ isEditMode ? '保存前请确认商品、库存和预计销售额' : '发布前请确认商品、库存和预计销售额' }}</view>
        </view>
        <view class="pool-count">预计 ￥{{ estimatedSales }}</view>
      </view>
      <view v-if="!selectedCount" class="selected-empty">还没有选择商品，先从下方商品池补充本场团商品。</view>
      <scroll-view v-else scroll-x class="selected-scroll" show-scrollbar="false">
        <view class="selected-list">
          <view v-for="item in selectedItems" :key="item.id" class="selected-item">
            <image :src="item.image" mode="aspectFill" />
            <view class="selected-item__name">{{ item.name }}</view>
            <view class="selected-item__meta">￥{{ money(item.groupPrice) }} · {{ item.groupStock }}份</view>
            <view class="selected-item__remove" @tap="removeProduct(item.id)">移除</view>
          </view>
        </view>
      </scroll-view>
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
        <text>{{ excludedCount }} 款商品已在其他团，可继续加入本团</text>
      </view>
      <view class="batch-actions">
        <button @tap="selectRecommended">选择当前 {{ filteredProducts.length }} 款</button>
        <button @tap="clearSelected">清空重选</button>
      </view>
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
                <text>￥{{ money(product.price) }}</text>
                <text>库存 {{ product.stock || product.totalStock || 0 }}</text>
                <text v-if="isProductInActiveGroup(product)">其他团中</text>
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
        <view>{{ deadlineLabel }} · {{ groupForm.deliveryTime }}</view>
      </view>
      <button :disabled="publishing" @tap="publishGroup">{{ publishing ? submitLoadingText : submitText }}</button>
    </view>
    <AdminTabBar v-if="!isEditMode" active="create" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { getProducts, getCategories, saveGroup, getShopConfig, getActiveGroups, getGroupById } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'
import { money } from '@/utils/format'

function pad2(value) {
  return String(value).padStart(2, '0')
}

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function defaultDeadlineDate() {
  return dateValue(new Date())
}

function productKeys(item = {}) {
  return [item.id, item._id, item.docId, item.productId]
    .filter(Boolean)
    .map(value => String(value))
}

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
      editGroupId: '',
      editGroupStatus: '',
      categoryOptions: [{ key: 'all', text: '全部' }],
      todayDate: defaultDeadlineDate(),
      groupForm: {
        title: '明日新鲜烘焙团',
        deadlineDate: defaultDeadlineDate(),
        deadlineTime: '22:00',
        deliveryTime: '次日打包发货',
        deliveryRange: '统一配送'
      }
    }
  },
  computed: {
    isEditMode() {
      return !!this.editGroupId
    },
    submitText() {
      if (this.isRestartingGroup) return '重新开团'
      return this.isEditMode ? '保存修改' : '发布本场团'
    },
    submitLoadingText() {
      if (this.isRestartingGroup) return '重新开团中...'
      return this.isEditMode ? '保存中...' : '发布中...'
    },
    isRestartingGroup() {
      return this.isEditMode && this.editGroupStatus && this.editGroupStatus !== 'active' && !this.isDeadlineExpired
    },
    isDeadlineExpired() {
      const time = new Date(`${this.groupForm.deadlineDate}T${this.groupForm.deadlineTime}:00`).getTime()
      return !Number.isNaN(time) && time <= Date.now()
    },
    filteredProducts() {
      const kw = this.keyword.toLowerCase()
      return this.products.filter(item => {
        const inCategory = this.activeCategory === 'all' || item.categoryKey === this.activeCategory
        const inKeyword = !kw || String(item.name || '').toLowerCase().includes(kw) || String(item.desc || '').toLowerCase().includes(kw)
        return inCategory && inKeyword
      })
    },
    excludedCount() {
      return this.products.filter(item => this.isProductInActiveGroup(item)).length
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
      return money(amount)
    },
    deadlineLabel() {
      const target = new Date(`${this.groupForm.deadlineDate}T${this.groupForm.deadlineTime}:00`)
      if (Number.isNaN(target.getTime())) return '请选择截单时间'
      const today = dateValue(new Date())
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const targetDate = dateValue(target)
      const dateLabel = targetDate === today
        ? '今日'
        : targetDate === dateValue(tomorrow)
          ? '明日'
          : `${target.getMonth() + 1}月${target.getDate()}日`
      return `${dateLabel} ${this.groupForm.deadlineTime} 截单`
    }
  },
  methods: {
    money,
    normalizeSelected(product) {
      const stock = Number(product.stock || product.totalStock || 30)
      return {
        ...product,
        id: product.id || product.productId || product._id || product.docId,
        productId: product.productId || product.id || product._id || product.docId,
        groupPrice: String(product.price || ''),
        groupStock: String(stock),
        limit: String(product.limit || 0)
      }
    },
    normalizeSelectedFromGroup(product) {
      return this.normalizeSelected({
        ...product,
        id: product.productId || product.id,
        productId: product.productId || product.id,
        price: product.price,
        stock: product.stock || product.totalStock,
        groupPrice: String(product.price || product.groupPrice || ''),
        groupStock: String(product.stock || product.totalStock || product.groupStock || ''),
        limit: String(product.limit || 0)
      })
    },
    isProductInActiveGroup(product) {
      const activeIds = this.productIdsInActiveGroups
      return productKeys(product).some(key => activeIds.includes(key))
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
    setDeadlineDate(event) {
      this.groupForm.deadlineDate = event.detail.value
    },
    setDeadlineTime(event) {
      this.groupForm.deadlineTime = event.detail.value
    },
    pick(key) {
      const map = {
        deliveryTime: ['次日打包发货', '48小时内发货', '指定日期统一发货'],
        deliveryRange: ['统一配送']
      }
      uni.showActionSheet({
        itemList: map[key],
        success: res => { this.groupForm[key] = map[key][res.tapIndex] }
      })
    },
    buildDeadlineAt() {
      const date = new Date(`${this.groupForm.deadlineDate}T${this.groupForm.deadlineTime}:00`)
      return date.toISOString()
    },
    validate() {
      if (!this.groupForm.title) return '请输入团名称'
      if (!this.groupForm.deadlineDate || !this.groupForm.deadlineTime) return '请选择截单时间'
      if (Number.isNaN(new Date(`${this.groupForm.deadlineDate}T${this.groupForm.deadlineTime}:00`).getTime())) return '截单时间无效'
      if (!this.selectedItems.length) return '请至少选择 1 款商品'
      const invalid = this.selectedItems.find(item => Number(item.groupPrice) <= 0 || Number(item.groupStock) <= 0 || Number(item.limit || 0) < 0)
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
          title: this.isEditMode ? '保存确认' : '发布确认',
          content: `本场团将${this.isRestartingGroup ? '重新开团' : this.isEditMode ? '保存' : '发布'} ${this.selectedCount} 款商品，共 ${this.totalStock} 份库存，预计销售额 ￥${this.estimatedSales}。\n${this.deadlineLabel}\n${this.groupForm.deliveryTime}`,
          confirmText: this.isRestartingGroup ? '确认开团' : this.isEditMode ? '确认保存' : '确认发布',
          success: ({ confirm }) => resolve(confirm),
          fail: () => resolve(false)
        })
      })
      if (!confirmed) return
      this.publishing = true
      try {
        await saveGroup({
          id: this.editGroupId,
          title: this.groupForm.title,
          deadline: this.deadlineLabel,
          deadlineAt: this.buildDeadlineAt(),
          deliveryTime: this.groupForm.deliveryTime,
          deliveryRange: this.groupForm.deliveryRange,
          fulfillmentMethods: this.groupForm.deliveryRange.split('/').map(item => item.trim()).filter(Boolean),
          productCount: this.selectedItems.length,
          totalStock: this.totalStock,
          products: this.selectedItems.map((item, index) => {
            const image = item.imageFileID || item.image
            const gallery = Array.isArray(item.galleryFileIDs) && item.galleryFileIDs.length
              ? item.galleryFileIDs
              : Array.isArray(item.gallery) && item.gallery.length
                ? item.gallery
                : [image].filter(Boolean)
            return {
              id: item.id,
              productId: item.id,
              name: item.name,
              image,
              imageFileID: image,
              desc: item.desc,
              specs: item.specs || [],
              categoryKey: item.categoryKey,
              price: Number(item.groupPrice),
              originPrice: Number(item.originPrice || item.groupPrice),
              stock: Number(item.groupStock),
              totalStock: Number(item.groupStock),
              limit: Number(item.limit),
              priority: index < 3,
              status: 'active',
              sort: index + 1,
              deadline: this.deadlineLabel,
              deadlineAt: this.buildDeadlineAt(),
              deliveryTime: this.groupForm.deliveryTime,
              deliveryRange: this.groupForm.deliveryRange,
              fulfillmentMethods: this.groupForm.deliveryRange.split('/').map(item => item.trim()).filter(Boolean),
              gallery,
              galleryFileIDs: gallery,
              bannerImage: image,
              bannerImageFileID: image
            }
          })
        })
        uni.showToast({ title: this.isRestartingGroup ? '团购已重新开始' : this.isEditMode ? '团购已保存' : '本场团已发布', icon: 'success' })
        setTimeout(() => uni.redirectTo({ url: this.isEditMode ? '/pages/admin/group-list/index' : '/pages/admin/dashboard/index' }), 600)
      } catch (error) {
        showCloudError(error)
      } finally {
        this.publishing = false
      }
    },
    async loadData() {
      this.loading = true
      try {
        const [categories, products, shopConfig, activeGroups, editGroup] = await Promise.all([
          getCategories(),
          getProducts(),
          getShopConfig(),
          getActiveGroups(),
          this.editGroupId ? getGroupById(this.editGroupId, true).catch(() => null) : Promise.resolve(null)
        ])
        this.categoryOptions = categories.length ? categories : [{ key: 'all', text: '全部' }]
        this.shop = shopConfig
        const activeProducts = (products || []).filter(item => item && item.id && item.status === 'active')
        this.products = activeProducts
        // 获取所有进行中团购的商品标识；历史数据可能混用 id/_id/docId/productId。
        const productIds = []
        const groupsArray = Array.isArray(activeGroups) ? activeGroups : []
        groupsArray.forEach(group => {
          if (this.editGroupId && group.id === this.editGroupId) return
          if (Array.isArray(group.productIds)) {
            group.productIds.forEach(id => {
              if (id) productIds.push(String(id))
            })
          }
          const groupProducts = Array.isArray(group.products) ? group.products : []
          groupProducts.forEach(p => {
            productIds.push(...productKeys(p))
          })
        })
        this.productIdsInActiveGroups = [...new Set(productIds)]
        if (editGroup) this.applyEditGroup(editGroup)
      } catch (e) {
        this.productIdsInActiveGroups = []
      } finally {
        this.loading = false
      }
    },
    applyEditGroup(group) {
      this.editGroupStatus = group.status || ''
      this.groupForm = {
        title: group.title || group.name || this.groupForm.title,
        deadlineDate: group.deadlineAt ? dateValue(new Date(group.deadlineAt)) : this.groupForm.deadlineDate,
        deadlineTime: group.deadlineAt ? `${pad2(new Date(group.deadlineAt).getHours())}:${pad2(new Date(group.deadlineAt).getMinutes())}` : this.groupForm.deadlineTime,
        deliveryTime: group.deliveryTime || this.groupForm.deliveryTime,
        deliveryRange: group.deliveryRange || this.groupForm.deliveryRange
      }
      this.selectedItems = (Array.isArray(group.products) ? group.products : []).map(this.normalizeSelectedFromGroup)
    }
  },
  onLoad(query = {}) {
    if (!ensurePageAccess('/pages/admin/create-group/index', '需要店长权限')) return
    this.editGroupId = query.id || ''
    this.loadData()
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.create-group { padding-bottom: 310rpx; }
.create-group--editing { padding-bottom: 230rpx; }
.group-settings,.toolbar,.selected-panel,.product-pool { margin-top:22rpx; padding:26rpx; }
.section-title { @include text-card-title; font-size:32rpx; font-weight:$font-weight-heavy; }
.section-subtitle { margin-top:8rpx; @include text-caption($color-text-light); }
.setting-grid { display:grid; grid-template-columns:1fr; gap:18rpx; margin-top:22rpx; }
.field { min-width:0; padding:18rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.field__label { @include text-caption($color-text-main); font-weight:$font-weight-bold; }
.field__label text { color:$color-primary; }
.field input,.picker-line { width:100%; height:56rpx; margin-top:10rpx; color:$color-text-main; font-size:26rpx; }
.picker-line { display:flex; align-items:center; justify-content:space-between; }
.picker-line--static { justify-content:flex-start; color:$color-text-regular; }
.deadline-pickers { display:grid; grid-template-columns:1fr 1fr; gap:14rpx; }
.deadline-pickers picker { min-width:0; }
.deadline-pickers .picker-line { box-sizing:border-box; padding:0 14rpx; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-pill; }
.field__helper { margin-top:12rpx; color:$color-primary; font-size:24rpx; font-weight:$font-weight-bold; }
.batch-actions { display:flex; gap:16rpx; margin-top:22rpx; }
.batch-actions button { flex:1; height:74rpx; border-radius:$radius-pill; color:$color-primary; background:$color-primary-light; border:1rpx solid rgba(255,92,114,.18); font-size:26rpx; font-weight:$font-weight-bold; line-height:74rpx; }
.batch-actions button:first-child { color:#fff; background:$gradient-primary; border-color:transparent; box-shadow:$shadow-btn; }
.search-box { display:flex; align-items:center; gap:12rpx; height:78rpx; padding:0 22rpx; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-pill; }
.search-box text { color:$color-primary; font-size:30rpx; }
.search-box input { flex:1; height:100%; font-size:26rpx; }
.category-scroll { margin-top:18rpx; white-space:nowrap; }
.category-list { display:flex; gap:14rpx; }
.category-chip { flex-shrink:0; padding:14rpx 24rpx; color:$color-text-regular; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-pill; font-size:24rpx; }
.category-chip.active { color:$color-primary; background:$color-primary-light; border-color:rgba(255,92,114,.20); font-weight:700; }
.filter-toggle { display:flex; align-items:center; gap:12rpx; margin-top:16rpx; padding:12rpx 16rpx; background:$color-orange-light; border:1rpx solid rgba(200, 121, 50, 0.18); border-radius:$radius-pill; }
.filter-toggle text { font-size:24rpx; color:$color-text-regular; }
.section-head { display:flex; align-items:center; justify-content:space-between; gap:20rpx; }
.pool-count { flex-shrink:0; padding:10rpx 18rpx; border-radius:$radius-pill; font-size:24rpx; font-weight:$font-weight-bold; color:$color-primary; background:$color-primary-light; }
.selected-empty { margin-top:18rpx; padding:24rpx; color:$color-text-light; background:$color-bg-light; border:1rpx dashed $color-border-light; border-radius:$radius-card; font-size:25rpx; line-height:1.4; text-align:center; }
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
.pool-item.selected { border-color:rgba(255,92,114,.42); background:$color-primary-pale; }
.pool-item image { width:116rpx; height:116rpx; border-radius:$radius-card; }
.pool-item__main { flex:1; min-width:0; }
.pool-item__name { @include text-body-strong; font-size:28rpx; @include text-ellipsis; }
.pool-item__desc { margin-top:8rpx; @include text-caption($color-text-light); @include text-ellipsis; }
.pool-item__meta { display:flex; gap:18rpx; margin-top:12rpx; font-size:24rpx; color:$color-text-regular; }
.pool-item__meta text:first-child { color:$color-primary; font-weight:$font-weight-bold; }
.select-dot { @include flex-center; flex-shrink:0; width:46rpx; height:46rpx; color:#fff; background:$gradient-primary; border-radius:50%; font-size:28rpx; font-weight:$font-weight-bold; }
.summary-bar { position:fixed; left:0; right:0; bottom:calc(142rpx + env(safe-area-inset-bottom)); z-index:40; display:flex; align-items:center; gap:20rpx; padding:18rpx 24rpx; background:rgba(255,253,249,.98); box-shadow:$shadow-bottom-sm; border-top:1rpx solid $color-border-light; }
.create-group--editing .summary-bar { bottom:0; z-index:60; padding-bottom:calc(18rpx + env(safe-area-inset-bottom)); }
.summary-bar > view { flex:1; min-width:0; color:$color-text-main; font-size:26rpx; font-weight:$font-weight-bold; }
.summary-bar > view > text { color:$color-primary; font-size:32rpx; margin-right:6rpx; }
.summary-bar > view view { margin-top:6rpx; color:$color-text-light; font-size:22rpx; font-weight:$font-weight-regular; @include text-ellipsis; }
.summary-bar button { flex:0 0 220rpx; display:flex; align-items:center; justify-content:center; height:82rpx; margin:0; padding:0 18rpx; color:#fff; background:$color-primary; border-radius:$radius-md; font-size:28rpx; font-weight:$font-weight-heavy; line-height:1; text-align:center; box-shadow:none; }
.summary-bar button::after { border:0; }
.summary-bar button[disabled] { background:$color-text-light; box-shadow:none; }
</style>
