<template>
  <view class="page admin-stats">
    <CustomNavBar title="数据统计" showBack />

    <view class="filter-card card">
      <view class="filter-card__head">
        <view>
          <view class="filter-card__title">统计时间</view>
          <text>{{ rangeText }}</text>
        </view>
        <button class="filter-card__refresh" :disabled="loading" @tap="loadStats">
          {{ loading ? '统计中' : '刷新' }}
        </button>
      </view>
      <scroll-view scroll-x class="quick-scroll" show-scrollbar="false">
        <view class="quick-list">
          <view
            v-for="item in quickOptions"
            :key="item.key"
            class="quick-chip"
            :class="{ active: activeQuick === item.key }"
            @tap="setQuickRange(item.key)"
          >
            {{ item.text }}
          </view>
        </view>
      </scroll-view>
      <view class="date-row">
        <picker mode="date" :value="startDate" :end="todayDate" @change="setStartDate">
          <view class="date-picker">
            <text>开始</text>
            <view>{{ startDate || '不限' }}</view>
          </view>
        </picker>
        <view class="date-row__dash">至</view>
        <picker mode="date" :value="endDate" :end="todayDate" @change="setEndDate">
          <view class="date-picker">
            <text>结束</text>
            <view>{{ endDate || '不限' }}</view>
          </view>
        </picker>
      </view>
    </view>

    <view class="overview card">
      <view v-for="item in overview" :key="item.key" class="overview__item">
        <text>{{ item.value }}</text>
        <view>{{ item.label }}</view>
      </view>
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
        <view class="product-row__price">￥{{ money(item.price) }}</view>
      </view>
      <EmptyState
        v-if="!topProducts.length"
        title="暂无热销数据"
        desc="当前时间范围内还没有有效订单，可切换到近7天/全部时间，或确认今天是否已经成单。"
      />
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import { getAdminStatsData } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'
import { money } from '@/utils/format'
import { showCloudError } from '@/utils/apiError'

function formatDate(date = new Date()) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default {
  components: { CustomNavBar, EmptyState },
  data() {
    const today = formatDate()
    return {
      overview: [],
      statusStats: [],
      topProducts: [],
      loading: false,
      activeQuick: 'today',
      startDate: today,
      endDate: today,
      todayDate: today,
      quickOptions: [
        { key: 'today', text: '今日' },
        { key: 'yesterday', text: '昨日' },
        { key: 'last7', text: '近7天' },
        { key: 'last30', text: '近30天' },
        { key: 'month', text: '本月' },
        { key: 'all', text: '全部' }
      ]
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/stats/index', '需要店长权限')) return
  },
  async onShow() {
    if (!ensurePageAccess('/pages/admin/stats/index', '需要店长权限')) return
    this.loadStats()
  },
  computed: {
    rangeText() {
      if (!this.startDate && !this.endDate) return '全部时间'
      if (this.startDate && this.endDate && this.startDate === this.endDate) return this.startDate
      return `${this.startDate || '不限'} 至 ${this.endDate || '不限'}`
    },
  },
  methods: {
    money,
    async loadStats() {
      try {
        this.loading = true
        const data = await getAdminStatsData({ startDate: this.startDate, endDate: this.endDate })
        this.overview = data.overview
        this.statusStats = data.statusStats
        this.topProducts = data.topProducts
      } catch (error) {
        showCloudError(error)
      } finally {
        this.loading = false
      }
    },
    setQuickRange(key) {
      const today = new Date()
      this.activeQuick = key
      if (key === 'today') {
        this.startDate = formatDate(today)
        this.endDate = formatDate(today)
      } else if (key === 'yesterday') {
        const yesterday = addDays(today, -1)
        this.startDate = formatDate(yesterday)
        this.endDate = formatDate(yesterday)
      } else if (key === 'last7') {
        this.startDate = formatDate(addDays(today, -6))
        this.endDate = formatDate(today)
      } else if (key === 'last30') {
        this.startDate = formatDate(addDays(today, -29))
        this.endDate = formatDate(today)
      } else if (key === 'month') {
        this.startDate = formatDate(monthStart(today))
        this.endDate = formatDate(today)
      } else {
        this.startDate = ''
        this.endDate = ''
      }
      this.loadStats()
    },
    setStartDate(event) {
      this.startDate = event.detail.value
      if (this.endDate && this.startDate > this.endDate) this.endDate = this.startDate
      this.activeQuick = 'custom'
      this.loadStats()
    },
    setEndDate(event) {
      this.endDate = event.detail.value
      if (this.startDate && this.endDate < this.startDate) this.startDate = this.endDate
      this.activeQuick = 'custom'
      this.loadStats()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.admin-stats { padding-bottom: 80rpx; }
.filter-card,.overview,.section { margin-top:24rpx; }
.filter-card { padding:26rpx 24rpx; }
.filter-card__head { display:flex; align-items:center; justify-content:space-between; gap:18rpx; }
.filter-card__title { color:$color-text-main; font-size:32rpx; font-weight:800; }
.filter-card__head text { display:block; margin-top:8rpx; color:$color-text-light; font-size:24rpx; }
.filter-card__refresh { flex-shrink:0; min-width:116rpx; height:62rpx; margin:0; padding:0 22rpx; color:#fff; background:$gradient-primary; border-radius:$radius-pill; font-size:24rpx; font-weight:700; line-height:62rpx; }
.filter-card__refresh[disabled] { opacity:.62; }
.quick-scroll { width:100%; margin-top:22rpx; white-space:nowrap; }
.quick-list { display:flex; gap:12rpx; width:max-content; }
.quick-chip { flex-shrink:0; padding:14rpx 24rpx; color:$color-text-regular; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-pill; font-size:25rpx; line-height:1; }
.quick-chip.active { color:$color-primary; background:$color-primary-pale; border-color:rgba(255,92,114,.28); font-weight:700; }
.date-row { display:flex; align-items:center; gap:14rpx; margin-top:20rpx; }
.date-row picker { flex:1; min-width:0; }
.date-row__dash { color:$color-text-light; font-size:24rpx; }
.date-picker { display:flex; align-items:center; justify-content:space-between; min-height:72rpx; padding:0 18rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-md; }
.date-picker text { color:$color-text-light; font-size:24rpx; }
.date-picker view { color:$color-text-main; font-size:26rpx; font-weight:700; }
.overview { display:grid; grid-template-columns:repeat(2,1fr); gap:16rpx; padding:24rpx; }
.overview__item { min-height:140rpx; padding:24rpx 20rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.overview__item text { color:$color-primary; font-size:42rpx; font-weight:800; }
.overview__item view { margin-top:12rpx; color:$color-text-regular; font-size:24rpx; }
.section { padding:28rpx; }
.section__title { color:$color-text-main; font-size:32rpx; font-weight:800; }
.status-row { display:flex; justify-content:space-between; padding-top:20rpx; color:$color-text-regular; font-size:26rpx; }
.status-row text { color:$color-text-main; }
.product-row { display:flex; align-items:center; gap:18rpx; padding-top:20rpx; }
.product-row image { width:92rpx; height:92rpx; border-radius:$radius-card; flex-shrink:0; }
.product-row__main { flex:1; min-width:0; }
.product-row__name { color:$color-text-main; font-size:28rpx; font-weight:700; @include text-ellipsis; }
.product-row__meta { margin-top:8rpx; color:$color-text-light; font-size:24rpx; }
.product-row__price { color:$color-primary; font-size:30rpx; font-weight:800; }
</style>
