<template>
  <view class="page order-list">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="filter-section card">
      <scroll-view scroll-x class="status-scroll" show-scrollbar="false">
        <view class="category-tabs">
          <view
            v-for="tab in statusTabs"
            :key="tab.key"
            class="category-tab"
            :class="{ active: active === tab.key }"
            @tap="active = tab.key"
          >
            {{ tab.text }}
            <text v-if="tab.count !== undefined" class="category-tab__count">{{ tab.count }}</text>
          </view>
        </view>
      </scroll-view>

      <scroll-view scroll-x class="time-scroll" show-scrollbar="false">
        <view class="time-tabs">
          <view
            v-for="item in timeOptions"
            :key="item.key"
            class="time-tab"
            :class="{ active: timeFilter === item.key }"
            @tap="setTimeFilter(item.key)"
          >{{ item.text }}</view>
        </view>
      </scroll-view>

      <view v-if="timeFilter === 'custom'" class="date-range">
        <picker mode="date" :value="startDate || today" @change="setStartDate">
          <view class="date-picker">{{ startDate || '开始日期' }}</view>
        </picker>
        <view class="date-separator">至</view>
        <picker mode="date" :value="endDate || today" @change="setEndDate">
          <view class="date-picker">{{ endDate || '结束日期' }}</view>
        </picker>
      </view>

      <view class="search-card" style="margin-top:18rpx;">
        <text>⌕</text>
        <input
          :value="keyword"
          placeholder="搜索收件人、手机号、地址或商品"
          placeholder-class="search-placeholder"
          @input="keyword = $event.detail.value"
        />
        <text v-if="keyword" class="search-clear" @tap="keyword = ''">✕</text>
      </view>
    </view>

    <view v-if="loading" class="order-skeleton">
      <view v-for="index in 3" :key="index" class="order-skeleton__card card">
        <SkeletonBlock variant="list" :rows="4" />
      </view>
    </view>
    <EmptyState
      v-else-if="!filteredOrders.length"
      title="当前筛选下没有订单"
      desc="可以切换状态筛选，或者稍后再回来看看。"
      action-text="恢复全部"
      @action="resetFilters"
    />
    <template v-else>
      <OrderCard
        v-for="item in filteredOrders"
        :key="item.id"
        :order="item"
        :max-items="0"
        @view="viewOrder"
        @updateStatus="updateStatus"
      />
    </template>
    <AdminTabBar active="orders" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import OrderCard from '@/components/OrderCard/OrderCard.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { getAdminOrders, updateOrderStatus, getShopConfig } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, OrderCard, EmptyState, SkeletonBlock, AdminTabBar },
  data() {
    return {
      shop: {},
      orderStatusTabs: [
        { key: 'all', text: '全部', statusKey: 'all' },
        { key: 'pendingDelivery', text: '待发货', statusKey: 'pendingDelivery' },
        { key: 'delivering', text: '配送中', statusKey: 'delivering' },
        { key: 'completed', text: '已完成', statusKey: 'completed' },
        { key: 'cancelled', text: '已取消', statusKey: 'cancelled' }
      ],
      active: 'all',
      timeFilter: 'all',
      startDate: '',
      endDate: '',
      keyword: '',
      loading: true,
      list: [],
      timeOptions: [
        { key: 'all', text: '全部时间' },
        { key: 'today', text: '今天' },
        { key: 'yesterday', text: '昨天' },
        { key: 'last7', text: '近7天' },
        { key: 'last30', text: '近30天' },
        { key: 'custom', text: '自定义' }
      ]
    }
  },
  onLoad(query = {}) {
    if (!ensurePageAccess('/pages/admin/order-list/index', '需要店长权限')) return
    const status = query.status || query.active
    if (this.orderStatusTabs.some(tab => tab.key === status)) this.active = status
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/order-list/index', '需要店长权限')) return
    this.loadOrders()
  },
  computed: {
    today() {
      return this.formatDate(new Date())
    },
    dateFilteredOrders() {
      return this.list.filter(item => this.matchTimeRange(item))
    },
    statusTabs() {
      return this.orderStatusTabs.map(tab => ({
        ...tab,
        count: tab.key === 'all'
          ? this.dateFilteredOrders.length
          : this.dateFilteredOrders.filter(item => item.status === tab.key).length
      }))
    },
    filteredOrders() {
      const keyword = this.keyword.trim()
      const result = this.dateFilteredOrders.filter(item => {
        const matchedStatus = this.active === 'all' || item.status === this.active
        const matchedKeyword = !keyword || [item.customer, item.phone, item.address, ...(item.items || []).map(i => i.name)].join(' ').includes(keyword)
        return matchedStatus && matchedKeyword
      })
      return result
    }
  },
  methods: {
    async loadOrders() {
      this.loading = true
      const [orders, shopConfig] = await Promise.all([getAdminOrders('all'), getShopConfig()])
      this.list = orders
      this.shop = shopConfig
      this.loading = false
    },
    resetFilters() {
      this.active = 'all'
      this.timeFilter = 'all'
      this.startDate = ''
      this.endDate = ''
      this.keyword = ''
    },
    setTimeFilter(key) {
      this.timeFilter = key
      if (key !== 'custom') {
        this.startDate = ''
        this.endDate = ''
      } else {
        this.startDate = this.startDate || this.today
        this.endDate = this.endDate || this.today
      }
    },
    setStartDate(event) {
      this.startDate = event.detail.value
      if (this.endDate && this.startDate > this.endDate) this.endDate = this.startDate
    },
    setEndDate(event) {
      this.endDate = event.detail.value
      if (this.startDate && this.endDate < this.startDate) this.startDate = this.endDate
    },
    formatDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    orderTime(order = {}) {
      const raw = order.createdAt || order.createDateTime || order.createTime || order.payTime || ''
      if (!raw) return 0
      if (typeof raw === 'number') return raw < 10000000000 ? raw * 1000 : raw
      const text = String(raw).trim()
      if (/^\d+$/.test(text)) {
        const value = Number(text)
        return value < 10000000000 ? value * 1000 : value
      }
      const normalized = text.replace(/-/g, '/').replace('T', ' ').replace(/\.\d+Z?$/, '')
      const time = new Date(normalized).getTime()
      return Number.isNaN(time) ? 0 : time
    },
    dateStart(dateText) {
      return new Date(`${dateText.replace(/-/g, '/')} 00:00:00`).getTime()
    },
    dateEnd(dateText) {
      return new Date(`${dateText.replace(/-/g, '/')} 23:59:59`).getTime()
    },
    timeRange() {
      const todayStart = this.dateStart(this.today)
      const oneDay = 24 * 60 * 60 * 1000
      if (this.timeFilter === 'today') return { start: todayStart, end: todayStart + oneDay - 1 }
      if (this.timeFilter === 'yesterday') return { start: todayStart - oneDay, end: todayStart - 1 }
      if (this.timeFilter === 'last7') return { start: todayStart - oneDay * 6, end: todayStart + oneDay - 1 }
      if (this.timeFilter === 'last30') return { start: todayStart - oneDay * 29, end: todayStart + oneDay - 1 }
      if (this.timeFilter === 'custom') {
        return {
          start: this.startDate ? this.dateStart(this.startDate) : 0,
          end: this.endDate ? this.dateEnd(this.endDate) : Number.MAX_SAFE_INTEGER
        }
      }
      return null
    },
    matchTimeRange(order) {
      const range = this.timeRange()
      if (!range) return true
      const time = this.orderTime(order)
      if (!time) return false
      return time >= range.start && time <= range.end
    },
    viewOrder(order) {
      uni.navigateTo({ url: `/pages/admin/order-detail/index?id=${order.id}` })
    },
    async updateStatus(order) {
      const target = this.list.find(item => item.id === order.id)
      if (!target) return
      if (target.refundStatus === 'pending') {
        this.viewOrder(target)
        return
      }
      if (target.status === 'completed') {
        this.viewOrder(target)
        return
      }
      const nextStatus = target.status === 'delivering' ? 'completed' : 'delivering'
      try {
        await updateOrderStatus(target.id, nextStatus)
        await this.loadOrders()
        uni.showToast({ title: nextStatus === 'completed' ? '已标记完成' : '已标记发货', icon: 'success' })
      } catch (error) {
        showCloudError(error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.order-list { padding-bottom: 190rpx; }

.filter-section {
  margin-top: 18rpx;
  padding: 18rpx;
}

.status-scroll {
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.category-tabs {
  display: inline-flex;
  gap: 14rpx;
}

.category-tab {
  @include flex-center;
  flex: 0 0 auto;
  min-width: 120rpx;
  height: 64rpx;
  padding: 0 18rpx;
  color: $color-text-regular;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
  font-size: 26rpx;
  white-space: nowrap;
}

.category-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255, 92, 114, 0.20);
  font-weight: 800;
}

.category-tab__count {
  margin-left: 8rpx;
  font-size: 20rpx;
  font-weight: 400;
  opacity: 0.8;
}

.category-tab.active .category-tab__count {
  opacity: 1;
}

.time-scroll {
  margin-top: 18rpx;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.time-tabs {
  display: inline-flex;
  gap: 12rpx;
}

.time-tab {
  @include flex-center;
  flex: 0 0 auto;
  height: 54rpx;
  padding: 0 18rpx;
  color: $color-text-regular;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
  font-size: 24rpx;
}

.time-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255, 92, 114, 0.20);
  font-weight: 800;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 16rpx;
}

.date-range picker {
  flex: 1;
  min-width: 0;
}

.date-picker {
  @include flex-center;
  height: 64rpx;
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
  font-size: 24rpx;
}

.date-separator {
  color: $color-text-light;
  font-size: 24rpx;
}

.search-card {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
}

.search-card text {
  margin-right: 12rpx;
  color: $color-text-placeholder;
  font-size: 30rpx;
}

.search-card input {
  flex: 1;
  min-width: 0;
  color: $color-text-main;
  font-size: 26rpx;
}

.search-placeholder {
  color: $color-text-placeholder;
  font-size: 26rpx;
}

.search-clear {
  flex-shrink: 0;
  margin-left: 4rpx;
  color: $color-text-placeholder;
  font-size: 26rpx;
}

.order-skeleton { margin-top: 18rpx; }
.order-skeleton__card { margin-bottom: 18rpx; padding: 22rpx; }
</style>
