<template>
  <view class="page admin-stats">
    <CustomNavBar title="数据统计" showBack />

    <view class="overview card">
      <view v-for="item in overview" :key="item.key" class="overview__item">
        <text>{{ item.value }}</text>
        <view>{{ item.label }}</view>
      </view>
    </view>

    <view class="insight card">
      <view class="section__title">今日经营提示</view>
      <view class="insight__grid">
        <view class="insight__item">
          <text>{{ pendingCount }}</text>
          <view>待发货订单</view>
        </view>
        <view class="insight__item">
          <text>{{ lowStockCount }}</text>
          <view>低库存商品</view>
        </view>
      </view>
      <view class="insight__tip">{{ insightText }}</view>
    </view>

    <view class="card section">
      <view class="section__title">订单状态分布</view>
      <view v-for="item in statusStats" :key="item.key" class="status-row">
        <text>{{ item.label }}</text>
        <view>{{ item.value }} 单</view>
      </view>
    </view>

    <view class="card section">
      <view class="section__title">热销商品 Top 5</view>
      <view v-for="item in topProducts" :key="item.id" class="product-row">
        <image :src="item.image" mode="aspectFill" lazy-load />
        <view class="product-row__main">
          <view class="product-row__name">{{ item.name }}</view>
          <view class="product-row__meta">已售 {{ item.sold }} 份 · 库存 {{ item.stock }} 份</view>
        </view>
        <view class="product-row__price">￥{{ item.price }}</view>
      </view>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getAdminStatsData } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar },
  data() {
    return {
      overview: [],
      statusStats: [],
      topProducts: []
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/stats/index', '需要店长权限')) return
  },
  async onShow() {
    if (!ensurePageAccess('/pages/admin/stats/index', '需要店长权限')) return
    const data = await getAdminStatsData()
    this.overview = data.overview
    this.statusStats = data.statusStats
    this.topProducts = data.topProducts
  },
  computed: {
    pendingCount() {
      const found = this.statusStats.find(item => ['pendingDelivery', 'paid'].includes(item.key))
      return found ? Number(found.value || 0) : 0
    },
    lowStockCount() {
      return this.topProducts.filter(item => Number(item.stock || 0) <= 5).length
    },
    insightText() {
      if (this.pendingCount > 0) return `有 ${this.pendingCount} 单需要优先安排发货。`
      if (this.lowStockCount > 0) return `有 ${this.lowStockCount} 款热销商品库存偏低，建议及时补货或下架。`
      return '当前履约压力较低，可以关注热销商品和新团发布。'
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.admin-stats { padding-bottom: 80rpx; }
.overview,.insight,.section { margin-top:24rpx; }
.overview { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; padding:24rpx; }
.overview__item { min-height:140rpx; padding:24rpx 20rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.overview__item text { color:$color-primary; font-size:42rpx; font-weight:800; }
.overview__item view { margin-top:12rpx; color:$color-text-regular; font-size:24rpx; }
.section { padding:28rpx; }
.section__title { color:$color-text-main; font-size:32rpx; font-weight:800; }
.insight { padding:28rpx; }
.insight__grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; margin-top:20rpx; }
.insight__item { padding:20rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.insight__item text { color:$color-primary; font-size:38rpx; font-weight:800; }
.insight__item view { margin-top:8rpx; color:$color-text-regular; font-size:24rpx; }
.insight__tip { margin-top:18rpx; padding:16rpx 18rpx; color:$color-orange-dark; background:$color-orange-light; border:1rpx solid #f1ddc6; border-radius:$radius-md; font-size:24rpx; line-height:1.45; }
.status-row { display:flex; justify-content:space-between; padding-top:20rpx; color:$color-text-regular; font-size:26rpx; }
.status-row text { color:$color-text-main; }
.product-row { display:flex; align-items:center; gap:18rpx; padding-top:20rpx; }
.product-row image { width:92rpx; height:92rpx; border-radius:$radius-card; flex-shrink:0; }
.product-row__main { flex:1; min-width:0; }
.product-row__name { color:$color-text-main; font-size:28rpx; font-weight:700; @include text-ellipsis; }
.product-row__meta { margin-top:8rpx; color:$color-text-light; font-size:24rpx; }
.product-row__price { color:$color-primary; font-size:30rpx; font-weight:800; }
</style>
