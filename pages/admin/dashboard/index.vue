<template>
  <view class="page dashboard">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />
    <view class="dashboard-nav-action" :style="navActionStyle" @tap="switchToBuyer">
      <AppIcon name="home" :size="28" color="#FF5C72" />
      <text>用户端</text>
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
        <view class="quick-card__head">
          <view class="quick-card__icon" :class="'quick-card__icon--' + item.theme">
            <AppIcon :name="item.icon" :size="32" color="#FFFFFF" />
          </view>
          <view class="quick-card__title">{{ item.title }}</view>
        </view>
        <view class="quick-card__desc">{{ item.desc }}</view>
        <view v-if="item.badge" class="quick-card__badge">{{ item.badge }}</view>
      </view>
    </view>

    <view class="section dashboard-groups">
      <view class="section__head dashboard-groups__head">
        <view class="section__main">
          <view class="section__title-row">
            <view class="section__title">正在开团</view>
            <view class="section__subtitle">{{ activeGroups.length ? `${activeGroups.length} 个团正在进行` : '当前正在团购的商品' }}</view>
          </view>
        </view>
        <view class="link" @tap="go('/pages/admin/group-list/index')">查看全部 〉</view>
      </view>
      <view v-if="activeGroups.length" class="dashboard-group-list">
        <view v-for="group in activeGroups" :key="group.id" class="dashboard-group">
          <view class="dashboard-group__head">
            <view class="dashboard-group__copy">
              <view class="dashboard-group__title">{{ group.title }}</view>
              <view class="dashboard-group__subtitle">
                <text>{{ group.productCount }} 款商品</text>
                <text>{{ group.deadline || '未设置截单' }}</text>
              </view>
            </view>
            <view class="dashboard-group__actions">
              <button
                class="dashboard-group__share"
                open-type="share"
                :data-group-id="group.id"
                :data-group-title="group.title"
              >
                <AppIcon name="wechat" :size="26" color="#18BF61" />
                <text>分享</text>
              </button>
              <button class="dashboard-group__manage" @tap="goGroup(group)">管理</button>
            </view>
          </view>
          <scroll-view class="dashboard-product-scroll" scroll-x show-scrollbar="false">
            <view class="dashboard-product-strip">
              <ProductCard
                v-for="item in group.products"
                :key="item._dashboardKey"
                class="dashboard-product-card"
                :product="item"
                variant="home-grid"
                :show-deadline="false"
                :show-desc="false"
                @tap="goGroup(group)"
                @join="goGroup(group)"
              />
              <view class="dashboard-product-more" @tap="goGroup(group)">
                <view>查看全部</view>
                <text>本团商品</text>
              </view>
            </view>
          </scroll-view>
        </view>
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
import { cloudImageHttpsUrl, IMAGE_ASSETS } from '@/utils/image'

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
      groups: [],
      orders: [],
      navActionStyle: ''
    }
  },
  computed: {
    activeProducts() {
      return this.products
    },
    activeGroups() {
      return this.groups
    }
  },
  methods: {
    updateNavActionStyle() {
      try {
        const system = uni.getSystemInfoSync()
        if (typeof uni.getMenuButtonBoundingClientRect !== 'function') return
        const menu = uni.getMenuButtonBoundingClientRect()
        if (!menu || !menu.left || !system.windowWidth) return
        const right = Math.max(system.windowWidth - menu.left + 8, 96)
        const top = menu.top || 44
        const height = menu.height || 32
        this.navActionStyle = `right:${right}px;top:${top}px;height:${height}px;line-height:${height}px;`
      } catch {
        this.navActionStyle = ''
      }
    },
    switchToBuyer() {
      setPortalMode('buyer')
      uni.switchTab({ url: '/pages/home/index' })
    },
    async loadDashboard() {
      const [data, shopConfig] = await Promise.all([getAdminDashboardData(), getShopConfig()])
      this.dashboardStats = data.dashboardStats
      this.products = (data.products || []).map((item, index) => ({
        ...item,
        _dashboardKey: `${item.groupId || 'product'}_${item.productId || item.id || index}`
      }))
      this.groups = (data.groups || []).map((group, index) => ({
        ...group,
        _dashboardKey: group.id || group._id || `group_${index}`,
        products: (group.products || []).map((item, productIndex) => ({
          ...item,
          _dashboardKey: `${group.id || index}_${item.productId || item.id || productIndex}`
        }))
      }))
      this.orders = data.orders
      const refundCount = (data.refundOrders || []).filter(item => item.refundStatus === 'pending').length
      this.quickActions = this.quickActions.map(item => {
        if (item.key === 'refund') return { ...item, badge: refundCount }
        return item
      })
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
      const groupId = product.groupId || product.group_id || product.groupID
      if (groupId) {
        uni.navigateTo({ url: `/pages/admin/group-detail/index?id=${groupId}` })
        return
      }

      const id = product.productId || product.id || product._id || product.docId
      if (!id) {
        uni.navigateTo({ url: '/pages/admin/group-list/index' })
        return
      }
      uni.navigateTo({ url: `/pages/admin/product-edit/index?id=${id}` })
    },
    goGroup(group) {
      const id = group && (group.id || group._id || group.groupId)
      if (!id) {
        uni.navigateTo({ url: '/pages/admin/group-list/index' })
        return
      }
      uni.navigateTo({ url: `/pages/admin/group-detail/index?id=${id}` })
    },
    shareCoverImage(groupId = '') {
      const group = (this.groups || []).find(item => String(item.id || item._id || item.groupId || '') === String(groupId)) || {}
      const product = (group.products && group.products[0]) || (this.products && this.products[0]) || {}
      const image = product.bannerImage || product.image || product.imageFileID || product.bannerImageFileID || ''
      if (String(image).startsWith('cloud://')) return cloudImageHttpsUrl(image) || image
      return image || cloudImageHttpsUrl(IMAGE_ASSETS.banner)
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/dashboard/index', '需要店长权限')) return
    this.updateNavActionStyle()
  },
  onShareAppMessage(options = {}) {
    const dataset = options.target && options.target.dataset ? options.target.dataset : {}
    const groupId = dataset.groupId || ''
    const groupTitle = dataset.groupTitle || '初炉新鲜烘焙团购'
    return {
      title: `${groupTitle} · 初炉新鲜烘焙`,
      path: groupId ? `/pages/category/index?groupId=${groupId}` : '/pages/home/index',
      imageUrl: this.shareCoverImage(groupId)
    }
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
.dashboard-nav-action { position:absolute; right:210rpx; top:calc(44px + 12rpx); z-index:35; display:flex; align-items:center; justify-content:center; gap:8rpx; width:150rpx; height:64rpx; color:$color-primary; background:rgba(255,253,249,.96); border:1rpx solid $color-border; border-radius:$radius-pill; font-size:24rpx; font-weight:$font-weight-bold; box-shadow:0 8rpx 20rpx rgba(94,58,43,.08); box-sizing:border-box; }
.stats { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; margin-top:22rpx; padding:0; background:transparent; border:none; box-shadow:none; }
.stats ::v-deep .stat-card { padding:22rpx 16rpx; }
.quick-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; margin-top:22rpx; }
.quick-card { position:relative; min-height:112rpx; padding:20rpx 18rpx; text-align:left; box-sizing:border-box; }
.quick-card__head { display:flex; align-items:center; gap:14rpx; min-width:0; }
.quick-card__icon { @include flex-center; flex-shrink:0; width:54rpx; height:54rpx; margin:0; color:#fff; background:$gradient-primary; border-radius:16rpx; font-size:32rpx; font-weight:800; }
.quick-card__icon--orange { background:$color-orange; }
.quick-card__icon--green { background:$color-green; }
.quick-card__icon--blue { background:$color-blue; }
.quick-card__icon--purple { background:#7157c8; }
.quick-card__title { flex:1; min-width:0; @include text-body-strong; font-size:29rpx; font-weight:$font-weight-bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.quick-card__desc { margin-top:10rpx; @include text-helper($color-text-light); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
.dashboard-groups { padding:0; background:transparent; border:none; box-shadow:none; }
.dashboard-groups__head { display:flex; align-items:center; justify-content:space-between; gap:18rpx; padding:0 6rpx; margin-bottom:16rpx; }
.section__main { flex:1; min-width:0; }
.section__title-row { display:flex; align-items:center; gap:12rpx; min-width:0; }
.section__title { flex-shrink:0; color:$color-text-main; font-size:32rpx; line-height:1; font-weight:$font-weight-heavy; }
.section__subtitle { flex:1; min-width:0; color:$color-text-light; font-size:22rpx; line-height:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dashboard-group-list { display:flex; flex-direction:column; gap:18rpx; }
.dashboard-group { padding:22rpx 18rpx 18rpx; background:$color-card; border:1rpx solid $color-border-light; border-radius:$radius-card; box-shadow:$shadow-card; overflow:hidden; }
.dashboard-group__head { display:flex; align-items:flex-start; justify-content:space-between; gap:18rpx; }
.dashboard-group__copy { flex:1; min-width:0; }
.dashboard-group__title { color:$color-text-main; font-size:30rpx; line-height:1.25; font-weight:$font-weight-heavy; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dashboard-group__subtitle { display:flex; align-items:center; gap:12rpx; margin-top:8rpx; color:$color-text-light; font-size:22rpx; line-height:1.2; }
.dashboard-group__subtitle text { max-width:50%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dashboard-group__subtitle text + text { color:$color-text-regular; font-weight:$font-weight-semibold; }
.dashboard-group__actions { flex-shrink:0; display:flex; align-items:center; gap:10rpx; }
.dashboard-group__actions button { display:flex; align-items:center; justify-content:center; height:48rpx; margin:0; padding:0 14rpx; border-radius:$radius-pill; font-size:22rpx; font-weight:$font-weight-bold; line-height:48rpx; box-sizing:border-box; }
.dashboard-group__actions button::after { border:0; }
.dashboard-group__share { gap:6rpx; min-width:108rpx; color:#18BF61; background:#fff; border:1rpx solid rgba(24,191,97,.35); }
.dashboard-group__manage { min-width:96rpx; color:$color-primary; background:$color-primary-light; }
.dashboard-product-scroll { width:100%; margin-top:20rpx; white-space:nowrap; }
.dashboard-product-strip { display:inline-flex; gap:14rpx; padding:0 2rpx 6rpx; }
.dashboard-product-card { flex:0 0 auto; width:214rpx; border-radius:18rpx; box-shadow:0 8rpx 22rpx rgba(94,58,43,.08); }
.dashboard-product-card ::v-deep .product-card__image { height:150rpx; }
.dashboard-product-card ::v-deep .product-card__body { padding:12rpx 10rpx; }
.dashboard-product-card ::v-deep .product-card__name { display:block; min-height:28rpx; font-size:22rpx; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; -webkit-line-clamp:initial; }
.dashboard-product-card ::v-deep .product-card__desc { display:none; }
.dashboard-product-card ::v-deep .product-card__price-row { margin-top:6rpx; }
.dashboard-product-card ::v-deep .product-card__price { font-size:30rpx; }
.dashboard-product-card ::v-deep .product-card__origin { margin-left:6rpx; font-size:16rpx; }
.dashboard-product-card ::v-deep .product-card__meta { display:none; }
.dashboard-product-card ::v-deep .product-card__btn { display:none; }
.dashboard-product-more { flex:0 0 auto; width:150rpx; min-height:292rpx; display:flex; align-items:center; justify-content:center; flex-direction:column; color:$color-primary; background:$color-primary-light; border:1rpx dashed rgba(255,92,114,.26); border-radius:18rpx; font-size:24rpx; font-weight:$font-weight-bold; box-sizing:border-box; }
.dashboard-product-more text { margin-top:8rpx; color:$color-text-regular; font-size:20rpx; font-weight:$font-weight-regular; }
.state-card { margin-top:18rpx; padding:38rpx 24rpx; text-align:center; color:$color-text-light; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; font-size:26rpx; }
</style>
