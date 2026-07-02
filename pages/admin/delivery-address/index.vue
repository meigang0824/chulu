<template>
  <view class="page delivery-page">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="filter-section card">
      <scroll-view scroll-x class="status-scroll" show-scrollbar="false">
        <view class="category-tabs">
          <view
            v-for="tab in deliveryTabsWithCounts"
            :key="tab.key"
            class="category-tab"
            :class="{ active: active === tab.key }"
            @tap="setStatusFilter(tab.key)"
          >
            {{ tab.text }}
            <text class="category-tab__count">{{ tab.count }}</text>
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
          v-model="keyword"
          placeholder="搜索收件人、手机号或地址"
          placeholder-class="search-placeholder"
        />
        <text v-if="keyword" class="search-clear" @tap="keyword = ''">✕</text>
      </view>
    </view>

    <EmptyState
      v-if="!filteredOrders.length"
      title="当前筛选下没有发货单"
      desc="可以切换状态筛选，或者稍后再看看。"
      action-text="恢复全部"
      @action="resetFilters"
    />
    <template v-else>
      <AddressCard
        v-for="item in filteredOrders"
        :key="item.id"
        class="address-item"
        :address="item"
        variant="delivery"
        selectable
        show-actions
        :show-fulfillment="false"
        :checked="selectedIds.includes(item.id)"
        @select="toggle"
        @navigate="navigate"
        @contact="contact"
      />
    </template>

    <view class="batch-bar">
      <view class="batch-check" :class="{ active: allSelected }" @tap="toggleAll"></view>
      <view>全选</view>
      <view class="selected">已选 {{ selectedIds.length }} 单</view>
      <button class="export" @tap="exportAddress">转发快递单</button>
      <button class="done" @tap="markDone">{{ batchActionText }}</button>
    </view>
    <AdminTabBar active="delivery" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AddressCard from '@/components/AddressCard/AddressCard.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { getDeliveryData, updateOrderStatus, getShopConfig } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'
import { buildDeliveryCsvRows, deliveryCsvHeaders, shareExcelFile } from '@/utils/exportCsv'

export default {
  components: { CustomNavBar, AddressCard, EmptyState, AdminTabBar },
  data() {
    return {
      shop: {},
      deliveryTabs: [],
      active: 'all',
      timeFilter: 'all',
      startDate: '',
      endDate: '',
      keyword: '',
      sortAsc: true,
      selectedIds: [],
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
  onLoad() {
    if (!ensurePageAccess('/pages/admin/delivery-address/index', '需要店长权限')) return
  },
  async onShow() {
    if (!ensurePageAccess('/pages/admin/delivery-address/index', '需要店长权限')) return
    await this.loadDeliveryData()
  },
  computed: {
    today() {
      return this.formatDate(new Date())
    },
    dateFilteredOrders() {
      return this.list.filter(item => this.matchTimeRange(item))
    },
    deliveryTabsWithCounts() {
      return this.deliveryTabs.map(tab => ({
        ...tab,
        count: tab.key === 'all'
          ? this.dateFilteredOrders.length
          : this.dateFilteredOrders.filter(item => item.status === tab.key).length
      }))
    },
    filteredOrders() {
      const keyword = this.keyword.trim()
      const list = this.dateFilteredOrders.filter(item => {
        const statusOk = this.active === 'all' || item.status === this.active
        const keywordOk = !keyword || [item.receiver, item.customer, item.phone, item.address].join(' ').includes(keyword)
        return statusOk && keywordOk
      })
      return list.sort((a, b) => this.sortAsc ? a.routeNo - b.routeNo : b.routeNo - a.routeNo)
    },
    allSelected() {
      return this.filteredOrders.length > 0 && this.filteredOrders.every(item => this.selectedIds.includes(item.id))
    },
    selectedOrders() {
      return this.list.filter(item => this.selectedIds.includes(item.id))
    },
    batchActionText() {
      return this.active === 'delivering' ? '标记已完成' : '标记已发货'
    },
    batchTargetStatus() {
      return this.active === 'delivering' ? 'completed' : 'delivering'
    }
  },
  methods: {
    async loadDeliveryData() {
      const [data, shopConfig] = await Promise.all([getDeliveryData(), getShopConfig()])
      this.deliveryTabs = data.deliveryTabs
      this.list = data.deliveryOrders
      this.shop = shopConfig
    },
    resetFilters() {
      this.active = 'all'
      this.timeFilter = 'all'
      this.startDate = ''
      this.endDate = ''
      this.keyword = ''
      this.pruneSelectedIds()
    },
    setStatusFilter(key) {
      this.active = key
      this.$nextTick(() => this.pruneSelectedIds())
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
      this.$nextTick(() => this.pruneSelectedIds())
    },
    setStartDate(event) {
      this.startDate = event.detail.value
      if (this.endDate && this.startDate > this.endDate) this.endDate = this.startDate
      this.$nextTick(() => this.pruneSelectedIds())
    },
    setEndDate(event) {
      this.endDate = event.detail.value
      if (this.startDate && this.endDate < this.startDate) this.startDate = this.endDate
      this.$nextTick(() => this.pruneSelectedIds())
    },
    pruneSelectedIds() {
      const visibleIds = new Set(this.filteredOrders.map(item => item.id))
      this.selectedIds = this.selectedIds.filter(id => visibleIds.has(id))
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
    toggle(order) {
      const index = this.selectedIds.indexOf(order.id)
      if (index >= 0) this.selectedIds.splice(index, 1)
      else this.selectedIds.push(order.id)
    },
    toggleAll() {
      if (this.allSelected) {
        this.selectedIds = this.selectedIds.filter(id => !this.filteredOrders.some(item => item.id === id))
      } else {
        this.selectedIds = Array.from(new Set([...this.selectedIds, ...this.filteredOrders.map(item => item.id)]))
      }
    },
    navigate(order) {
      uni.setClipboardData({
        data: order.address || '',
        success: () => uni.showToast({ title: `已复制${order.receiver || order.customer}地址`, icon: 'none' })
      })
    },
    contact(order) {
      if (!order.fullPhone && !order.phone) {
        uni.showToast({ title: '暂无联系电话', icon: 'none' })
        return
      }
      uni.makePhoneCall({ phoneNumber: String(order.fullPhone || order.phone).replace(/[^\d]/g, '') })
    },
    exportAddress() {
      const selected = this.list.filter(item => this.selectedIds.includes(item.id))
      if (!selected.length) {
        uni.showToast({ title: '请先勾选地址', icon: 'none' })
        return
      }
      try {
        const date = new Date().toISOString().slice(0, 10)
        shareExcelFile({
          fileName: `初炉发货清单_${date}.xlsx`,
          sheetName: '初炉发货清单',
          headers: deliveryCsvHeaders,
          rows: buildDeliveryCsvRows(selected),
          onShared: () => uni.showToast({ title: '快递单已转发', icon: 'success' }),
          onOpened: () => uni.showToast({ title: '已打开文件，可从右上角转发', icon: 'none' })
        })
        uni.showToast({ title: `已生成 ${selected.length} 条，准备转发`, icon: 'none' })
      } catch (error) {
        const text = selected.map(item => `${item.receiver} ${item.phone}\n${item.address}\n${(item.items || []).map(goods => `${goods.name}x${goods.count}`).join('、')}`).join('\n\n')
        uni.setClipboardData({
          data: text,
          success: () => uni.showToast({ title: `导出失败，已复制 ${selected.length} 条`, icon: 'none' })
        })
      }
    },
    async markDone() {
      if (!this.selectedIds.length) {
        uni.showToast({ title: '请先勾选订单', icon: 'none' })
        return
      }
      const targetStatus = this.batchTargetStatus
      const actionable = this.selectedOrders.filter(item => {
        if (targetStatus === 'completed') return item.status === 'delivering'
        return ['paid', 'pendingDelivery'].includes(item.status)
      })
      if (!actionable.length) {
        uni.showToast({ title: targetStatus === 'completed' ? '请选择已发货订单' : '请选择待发货订单', icon: 'none' })
        return
      }
      try {
        await Promise.all(actionable.map(item => updateOrderStatus(item.id, targetStatus)))
        this.selectedIds = []
        await this.loadDeliveryData()
        uni.showToast({ title: targetStatus === 'completed' ? '已标记完成' : '已标记发货', icon: 'success' })
      } catch (error) {
        showCloudError(error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.delivery-page { padding-bottom: 330rpx; }

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
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
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
  opacity: 0.8;
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
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
}

.search-card text:first-child {
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

.address-item { margin-top: 18rpx; }

.batch-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(142rpx + env(safe-area-inset-bottom));
  z-index: 41;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14rpx 18rpx;
  padding: 18rpx 24rpx;
  background: rgba(255,255,255,.98);
  border-top: 1rpx solid $color-border-light;
  box-shadow: $shadow-bottom-sm;
}

.batch-check {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $color-text-placeholder;
  border-radius: 8rpx;
}

.batch-check.active {
  background: $color-primary;
  border-color: $color-primary;
}

.batch-bar view {
  color: $color-text-main;
  font-size: 28rpx;
}

.selected {
  flex: 1;
  color: $color-text-regular !important;
}

.batch-bar button {
  @include flex-center;
  height: 76rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 700;
}

.export {
  flex: 1;
  min-width: 180rpx;
  color: $color-primary;
  background: #fff;
  border: 1rpx solid $color-primary;
}

.done {
  flex: 1.2;
  min-width: 220rpx;
  color: #fff;
  background: $color-primary;
}
</style>
