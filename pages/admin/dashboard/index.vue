<template>
  <view class="page dashboard">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="portal-switch" @tap="switchToBuyer">
      <view class="portal-switch__main">
        <AppIcon name="home" :size="34" color="#FF5C72" />
        <text>切回用户端</text>
      </view>
      <AppIcon name="chevron-right" :size="30" color="#A8ADB5" />
    </view>

    <view class="notice-card card">
      <view class="notice-card__main">
        <view class="notice-card__title">微信消息提醒</view>
        <text>{{ subscriptionText }}</text>
      </view>
      <button class="notice-card__btn" :disabled="subscribing" @tap="enableAfterSalesNotice">
        {{ subscriptionButtonText }}
      </button>
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
        <view v-if="item.badge" class="quick-card__badge">{{ item.badge }}</view>
      </view>
    </view>

    <view class="section card">
      <view class="section__head">
        <view>
          <view class="section__title">正在开团</view>
          <view class="section__subtitle">当前正在团购的商品</view>
        </view>
        <view class="link" @tap="go('/pages/admin/group-list/index')">查看全部 〉</view>
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
import { getAdminDashboardData, getAdminSubscriptionStatus, getShopConfig, requestAdminAfterSalesSubscribe, setPortalMode } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, AppIcon, StatCard, ProductCard, AdminTabBar },
  data() {
    return {
      shop: {},
      dashboardStats: [],
      quickActions: [
        { key: 'refund', title: '售后管理', desc: '处理退款、售后与取消订单', icon: 'receipt', theme: 'red', route: '/pages/admin/after-sales/index', badge: 0 },
        { key: 'settings', title: '配置中心', desc: '店铺、轮播和分类配置', icon: 'store', theme: 'orange', route: '/pages/admin/settings/index' },
        { key: 'groups', title: '团购管理', desc: '查看、结束或删除团购活动', icon: 'users', theme: 'green', route: '/pages/admin/group-list/index' },
        { key: 'stats', title: '数据统计', desc: '销售额、订单状态、热销商品', icon: 'chart', theme: 'blue', route: '/pages/admin/stats/index' }
      ],
      products: [],
      orders: [],
      subscriptionStatus: {},
      subscribing: false
    }
  },
  computed: {
    activeProducts() {
      return this.products
    },
    subscriptionText() {
      const hasOrder = !!this.subscriptionStatus.orderTemplateId
      const hasAfterSales = !!(this.subscriptionStatus.afterSalesTemplateId || this.subscriptionStatus.templateId)
      if (!hasOrder && !hasAfterSales) return '请先到门店设置填写下单或售后订阅模板ID'
      if (this.subscriptionStatus.orderEnabled && this.subscriptionStatus.afterSalesEnabled) return '已开启，下单、售后申请和取消订单都会通过微信服务通知提醒店长'
      if (this.subscriptionStatus.orderEnabled) return '已开启下单提醒；售后模板配置后可继续授权售后提醒'
      if (this.subscriptionStatus.afterSalesEnabled) return '已开启售后提醒；下单模板配置后可继续授权下单提醒'
      return '未开启，点击授权后可接收下单、售后与取消订单提醒'
    },
    subscriptionButtonText() {
      if (this.subscribing) return '处理中'
      if (!this.subscriptionStatus.orderTemplateId && !(this.subscriptionStatus.afterSalesTemplateId || this.subscriptionStatus.templateId)) return '去配置'
      return this.subscriptionStatus.enabled ? '重新授权' : '开启提醒'
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
      const refundCount = (data.refundOrders || []).length
      const cancelledCount = (data.cancelledOrders || []).length
      this.quickActions = this.quickActions.map(item => {
        if (item.key === 'refund') return { ...item, badge: refundCount + cancelledCount }
        return item
      })
      this.shop = shopConfig
      this.loadSubscriptionStatus()
    },
    async loadSubscriptionStatus() {
      try {
        this.subscriptionStatus = await getAdminSubscriptionStatus()
      } catch (error) {
        this.subscriptionStatus = { enabled: false, templateId: '' }
      }
    },
    async enableAfterSalesNotice() {
      if (!this.subscriptionStatus.templateId) {
        this.go('/pages/admin/store-settings/index')
        return
      }
      if (this.subscribing) return
      this.subscribing = true
      try {
        this.subscriptionStatus = await requestAdminAfterSalesSubscribe()
        uni.showToast({ title: '售后提醒已开启', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || '开启失败', icon: 'none' })
      } finally {
        this.subscribing = false
      }
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
.portal-switch { display:flex; align-items:center; justify-content:space-between; min-height:86rpx; margin-top:16rpx; padding:0 24rpx; background:$color-card; border:1rpx solid $color-border-light; border-radius:$radius-card; box-shadow:$shadow-card; }
.portal-switch__main { display:flex; align-items:center; gap:14rpx; color:$color-primary; font-size:28rpx; font-weight:$font-weight-semibold; }
.notice-card { display:flex; align-items:center; justify-content:space-between; gap:18rpx; margin-top:18rpx; padding:22rpx 24rpx; }
.notice-card__main { flex:1; min-width:0; }
.notice-card__title { color:$color-text-main; font-size:29rpx; font-weight:$font-weight-bold; line-height:1.35; }
.notice-card__main text { display:block; margin-top:6rpx; color:$color-text-light; font-size:24rpx; line-height:1.35; }
.notice-card__btn { @include flex-center; flex-shrink:0; min-width:144rpx; height:62rpx; margin:0; padding:0 22rpx; color:#fff; background:$gradient-primary; border:none; border-radius:$radius-pill; font-size:24rpx; font-weight:$font-weight-bold; box-shadow:$shadow-btn; }
.notice-card__btn[disabled] { opacity:.6; }
.stats { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; margin-top:22rpx; padding:0; background:transparent; border:none; box-shadow:none; }
.stats ::v-deep .stat-card { padding:22rpx 16rpx; }
.quick-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; margin-top:22rpx; }
.quick-card { position:relative; padding:26rpx 20rpx; text-align:left; }
.quick-card__icon { @include flex-center; width:70rpx; height:70rpx; margin:0 0 18rpx; color:#fff; background:$gradient-primary; border-radius:22rpx; font-size:38rpx; font-weight:800; }
.quick-card__icon--orange { background:$color-orange; }
.quick-card__icon--green { background:$color-green; }
.quick-card__icon--blue { background:$color-blue; }
.quick-card__icon--purple { background:#7157c8; }
.quick-card__title { @include text-body-strong; font-size:30rpx; font-weight:$font-weight-bold; }
.quick-card__desc { margin-top:8rpx; @include text-helper($color-text-light); }
.quick-card__badge {
  position:absolute;
  right:18rpx;
  top:18rpx;
  min-width:34rpx;
  height:34rpx;
  padding:0 10rpx;
  color:#fff;
  background:$color-primary;
  border-radius:$radius-pill;
  font-size:22rpx;
  line-height:34rpx;
  font-weight:$font-weight-bold;
  text-align:center;
  box-shadow:0 6rpx 14rpx rgba(255,92,114,.22);
  box-sizing:border-box;
}
.section { margin-top:22rpx; padding:26rpx 20rpx; }
.link { @include text-body($font-weight-regular, $color-text-light); font-size:26rpx; }
.section__subtitle { margin-top:8rpx; @include text-caption($color-text-light); }
.dashboard-product-list { display:flex; flex-direction:column; gap:16rpx; margin-top:18rpx; }
.state-card { margin-top:18rpx; padding:38rpx 24rpx; text-align:center; color:$color-text-light; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; font-size:26rpx; }
</style>
