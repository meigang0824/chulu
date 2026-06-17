<template>
  <view class="page dashboard">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="dashboard-hero">
      <view>
        <view class="dashboard-hero__title">店长工作台</view>
        <view class="dashboard-hero__subtitle">今日经营一览</view>
        <view class="dashboard-hero__switch" @tap="switchToBuyer">切回用户端</view>
      </view>
      <image :src="shop.adminHero.image" mode="aspectFill" lazy-load />
    </view>

    <view class="stats card">
      <StatCard
        v-for="item in dashboardStats"
        :key="item.key"
        :icon="item.icon"
        :label="item.label"
        :value="formatValue(item.value)"
        :unit="item.unit"
        :trend="item.trend"
        :trend-type="item.trendType"
        :theme="item.theme"
      />
    </view>

    <view class="quick-grid">
      <view
        class="quick-card card"
        v-for="item in quickActions"
        :key="item.key"
        @tap="go(item.route)"
      >
        <view class="quick-card__icon" :class="'quick-card__icon--' + item.theme">
          <AppIcon :name="item.icon" :size="38" color="#FFFFFF" />
        </view>
        <view class="quick-card__title">{{ item.title }}</view>
        <view class="quick-card__desc">{{ item.desc }}</view>
      </view>
    </view>

    <view class="section card">
      <view class="section__head">
        <view>
          <view class="section__title">正在开团</view>
          <view class="section__subtitle">当前正在团购的商品</view>
        </view>
        <view class="link" @tap="go('/pages/admin/product-manage/index')">查看全部 〉</view>
      </view>
      <view v-if="activeProducts.length" class="dashboard-product-list">
        <ProductCard
          v-for="item in activeProducts"
          :key="item.id"
          :product="item"
          variant="home-list"
          action-text="管理"
          show-desc
          :show-deadline="false"
          @tap="goProduct"
          @join="goProduct"
        />
      </view>
      <view v-else class="state-card">暂无正在团购的商品</view>
    </view>
    <AdminTabBar active="dashboard" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import StatCard from '@/components/StatCard/StatCard.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { getAdminDashboardData, getShopConfig, setPortalMode } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, AppIcon, StatCard, ProductCard, AdminTabBar },
  data() {
    return {
      shop: {},
      dashboardStats: [],
      quickActions: [
        { key: 'settings', title: '配置中心', desc: '店铺、轮播、分类、发货批次', icon: 'store', theme: 'orange', route: '/pages/admin/settings/index' },
        { key: 'groups', title: '团购管理', desc: '查看、结束或删除团购活动', icon: 'users', theme: 'green', route: '/pages/admin/group-list/index' },
        { key: 'stats', title: '数据统计', desc: '销售额、订单状态、热销商品', icon: 'chart', theme: 'blue', route: '/pages/admin/stats/index' }
      ],
      products: [],
      orders: []
    }
  },
  computed: {
    activeProducts() {
      return this.products.filter(item => item.status === 'active')
    }
  },
  methods: {
    switchToBuyer() {
      setPortalMode('buyer')
      uni.switchTab({ url: '/pages/home/index' })
    },
    async loadDashboard() {
      const [data, shopConfig] = await Promise.all([getAdminDashboardData(), getShopConfig()])
      this.dashboardStats = data.dashboardStats
      this.products = data.products
      this.orders = data.orders
      this.shop = shopConfig
    },
    formatValue(value) {
      return typeof value === 'number' ? value.toLocaleString() : value
    },
    go(url) {
      const tabPages = ['/pages/home/index', '/pages/category/index', '/pages/order/list/index', '/pages/mine/index']
      if (tabPages.includes(url)) {
        uni.switchTab({ url })
      } else if (url.startsWith('/pages/admin/')) {
        uni.redirectTo({ url })
      } else {
        uni.navigateTo({ url })
      }
    },
    goProduct(product) {
      const id = product.id || product._id || product.docId
      if (!id) {
        uni.showToast({ title: '商品编号缺失，无法编辑', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/pages/admin/product-edit/index?id=${id}` })
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/dashboard/index', '需要店长权限')) return
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/dashboard/index', '需要店长权限')) return
    setPortalMode('admin')
    this.loadDashboard()
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.dashboard { padding-bottom: 190rpx; }
.dashboard-hero { position:relative; display:flex; min-height:186rpx; margin-top:18rpx; overflow:hidden; border:1rpx solid $color-border-light; border-radius:$radius-xl; background:$color-card; box-shadow:$shadow-card; }
.dashboard-hero > view { position:relative; z-index:2; max-width:460rpx; padding:34rpx 30rpx; }
.dashboard-hero__title { @include text-page-title; font-size:42rpx; font-weight:$font-weight-heavy; line-height:1.15; }
.dashboard-hero__subtitle { margin-top:12rpx; @include text-body($font-weight-regular, $color-text-regular); }
.dashboard-hero__switch { display:inline-flex; align-items:center; justify-content:center; min-width:168rpx; height:56rpx; margin-top:18rpx; padding:0 20rpx; color:$color-primary; background:$color-primary-light; border:1rpx solid rgba(232,79,95,0.16); border-radius:$radius-md; box-shadow:none; @include text-caption($color-primary); font-weight:$font-weight-semibold; }
.dashboard-hero image { position:absolute; right:0; top:0; width:260rpx; height:100%; opacity:.2; }
.stats { display:grid; grid-template-columns:repeat(2,1fr); gap:1rpx; margin-top:22rpx; padding:0; overflow:hidden; background:$color-border-light; }
.stats ::v-deep .stat-card { box-shadow:none; border:none; border-radius:0; padding:22rpx 16rpx; }
.quick-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; margin-top:22rpx; }
.quick-card { padding:24rpx 18rpx; text-align:left; }
.quick-card__icon { @include flex-center; width:68rpx; height:68rpx; margin:0 0 18rpx; color:#fff; background:$color-primary; border-radius:$radius-md; font-size:38rpx; font-weight:800; }
.quick-card__icon--orange { background:$color-orange; }
.quick-card__icon--green { background:$color-green; }
.quick-card__icon--blue { background:$color-blue; }
.quick-card__icon--purple { background:#7157c8; }
.quick-card__title { @include text-body-strong; font-size:30rpx; font-weight:$font-weight-bold; }
.quick-card__desc { margin-top:8rpx; @include text-helper($color-text-light); }
.section { margin-top:22rpx; padding:24rpx 18rpx; }
.link { @include text-body($font-weight-regular, $color-text-light); font-size:26rpx; }
.section__subtitle { margin-top:8rpx; @include text-caption($color-text-light); }
.dashboard-product-list { display:flex; flex-direction:column; gap:16rpx; margin-top:18rpx; }
.state-card { margin-top:18rpx; padding:38rpx 24rpx; text-align:center; color:$color-text-light; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; font-size:26rpx; }
</style>
