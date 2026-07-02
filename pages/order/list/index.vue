<template>
  <view class="page buyer-orders">
    <CustomNavBar title="我的订单" showBack />
    <scroll-view scroll-x class="order-tabs card" show-scrollbar="false">
      <view class="order-tabs__inner">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="order-tab"
          :class="{ active: active === tab.key }"
          @tap="active = tab.key"
        >
          {{ tab.text }}{{ tab.count ? `(${tab.count})` : '' }}
        </view>
      </view>
    </scroll-view>
    <view v-if="isLoggedIn" class="time-filter card">
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
    </view>
    <view v-if="isLoggedIn" class="search-card card">
      <text>⌕</text>
      <input v-model.trim="keyword" placeholder="搜索订单号、商品、收货人或手机号" />
      <text v-if="keyword" class="search-card__clear" @tap="keyword = ''">×</text>
    </view>
    <view v-if="isLoggedIn && !loading" class="order-hint">
      {{ orderHintText }}
    </view>
    <view v-if="loading" class="order-skeleton">
      <view v-for="index in 3" :key="index" class="order-skeleton__card card">
        <SkeletonBlock variant="list" :rows="4" />
      </view>
    </view>
    <EmptyState
      v-else-if="!isLoggedIn"
      title="登录后查看订单"
      desc="登录后可以查看订单进度、发起售后和再次购买。"
      action-text="去登录"
      @action="goLogin"
    />
    <EmptyState
      v-else-if="!filteredOrders.length"
      :title="emptyTitle"
      :desc="emptyDesc"
      action-text="去首页看看"
      @action="goHome"
    />
    <template v-else>
      <OrderCard
        v-for="item in filteredOrders"
        :key="item.id"
        :order="item"
        :action-text="cardActionText(item)"
        @view="viewOrder"
        @updateStatus="handlePrimary"
      />
    </template>
    <BuyerTabBar active="orders" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import OrderCard from '@/components/OrderCard/OrderCard.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import BuyerTabBar from '@/components/BuyerTabBar/BuyerTabBar.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import { ensurePageAccess, isLoggedIn } from '@/utils/auth'
import { cancelBuyerOrder, cancelRefundRequest, getBuyerOrders } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'

export default {
  components: { CustomNavBar, OrderCard, EmptyState, SkeletonBlock, BuyerTabBar },
  data() {
    return {
      orders: [],
      keyword: '',
      timeFilter: 'all',
      startDate: '',
      endDate: '',
      loading: true,
      active: 'all',
      isLoggedIn: false,
      tabs: [
        { key: 'all', text: '全部' },
        { key: 'pendingDelivery', text: '待配送' },
        { key: 'delivering', text: '配送中' },
        { key: 'finished', text: '已结束' }
      ],
      timeOptions: [
        { key: 'all', text: '全部时间' },
        { key: 'today', text: '今天' },
        { key: 'yesterday', text: '昨天' },
        { key: 'last7', text: '近7天' },
        { key: 'last30', text: '近30天' },
        { key: 'custom', text: '自定义' }
      ],
      loadSeq: 0
    }
  },
  onShow() {
    if (!ensurePageAccess('/pages/order/list/index', '登录后查看订单')) return
    this.isLoggedIn = isLoggedIn()
    if (!this.isLoggedIn) {
      this.loading = false
      return
    }
    this.loadOrders({ silent: this.orders.length > 0 })
  },
  onShareAppMessage() {
    return {
      title: '初炉 · 我的订单',
      path: '/pages/order/list/index'
    }
  },
  watch: {
    active() {
      this.loadOrders({ silent: this.orders.length > 0 })
    }
  },
  computed: {
    today() {
      return this.formatDate(new Date())
    },
    dateFilteredOrders() {
      return this.orders.filter(item => this.matchTimeRange(item))
    },
    filteredOrders() {
      const keyword = this.keyword.trim().toLowerCase()
      let list = this.dateFilteredOrders
      if (this.active === 'finished') {
        list = list.filter(item => ['completed', 'cancelled'].includes(item.status))
      } else if (this.active !== 'all') {
        list = list.filter(item => item.status === this.active)
      }
      if (!keyword) return list
      return list.filter(item => this.orderSearchText(item).includes(keyword))
    },
    orderHintText() {
      if (this.keyword.trim()) return `找到 ${this.filteredOrders.length} 笔订单`
      return this.active === 'all' ? `共 ${this.dateFilteredOrders.length} 笔订单` : `当前筛选 ${this.filteredOrders.length} 笔订单`
    },
    emptyTitle() {
      return this.keyword.trim() ? '没有匹配订单' : '还没有相关订单'
    },
    emptyDesc() {
      return this.keyword.trim() ? '换个订单号、商品名或手机号再试试。' : '下单成功后，订单进度会在这里更新。'
    }
  },
  methods: {
    orderSearchText(order = {}) {
      const items = Array.isArray(order.items) ? order.items : []
      const values = [
        order.id,
        order.orderNo,
        order.detailId,
        order.customer,
        order.receiver,
        order.phone,
        order.fullPhone,
        order.address,
        order.shortAddress,
        order.statusText,
        order.payStatusText,
        order.deliveryText,
        order.fulfillmentMethod,
        order.amount,
        order.payable,
        ...items.flatMap(item => [item.name, item.productId, item.count, item.price])
      ]
      return values.filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
    },
    cardActionText(order) {
      if (order.refundStatus === 'pending') return '撤回售后'
      if (['paid', 'pendingDelivery'].includes(order.status)) return '申请取消'
      if (order.status === 'delivering') return '查看物流'
      if (order.status === 'completed') return '申请退款'
      if (order.status === 'cancelled') return '再次购买'
      return '查看进度'
    },
    async loadOrders(options = {}) {
      const silent = options.silent === true
      if (!silent) this.loading = true
      const seq = ++this.loadSeq
      const orders = await getBuyerOrders('all')
      if (seq !== this.loadSeq) return
      this.orders = orders
      this.tabs = this.tabs.map(tab => ({
        ...tab,
        count: this.getTabCount(tab.key)
      }))
      this.loading = false
    },
    getTabCount(key) {
      if (key === 'all') return this.dateFilteredOrders.length
      if (key === 'finished') return this.dateFilteredOrders.filter(item => ['completed', 'cancelled'].includes(item.status)).length
      return this.dateFilteredOrders.filter(item => item.status === key).length
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
      this.refreshTabCounts()
    },
    setStartDate(event) {
      this.startDate = event.detail.value
      if (this.endDate && this.startDate > this.endDate) this.endDate = this.startDate
      this.refreshTabCounts()
    },
    setEndDate(event) {
      this.endDate = event.detail.value
      if (this.startDate && this.endDate < this.startDate) this.startDate = this.endDate
      this.refreshTabCounts()
    },
    refreshTabCounts() {
      this.tabs = this.tabs.map(tab => ({
        ...tab,
        count: this.getTabCount(tab.key)
      }))
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
      uni.navigateTo({ url: `/pages/order/detail/index?id=${order.id}` })
    },
    goHome() {
      uni.switchTab({ url: '/pages/home/index' })
    },
    goLogin() {
      uni.navigateTo({ url: '/pages/auth/login/index' })
    },
    handlePrimary(order) {
      if (order.refundStatus === 'pending') {
        this.cancelRefund(order)
        return
      }
      if (['paid', 'pendingDelivery'].includes(order.status)) {
        this.cancelOrder(order)
        return
      }
      if (order.status === 'delivering') {
        // 配送中状态：查看物流
        this.viewLogistics(order)
        return
      }
      if (order.status === 'completed') {
        uni.navigateTo({ url: `/pages/order/refund/index?id=${order.id}` })
        return
      }
      if (order.status === 'cancelled') {
        // 再次购买：先检查商品是否上架
        if (order.items && order.items.length && order.items[0].productId) {
          uni.navigateTo({ url: `/pages/product/detail?id=${order.items[0].productId}` })
        } else {
          uni.showToast({ title: '商品已下架', icon: 'none' })
        }
        return
      }
      this.viewOrder(order)
    },
    viewLogistics(order) {
      const driver = order.driverName || '初炉配送员'
      const phone = String(order.driverPhone || order.shopPhone || '').replace(/[^\d]/g, '')
      const trackingNo = order.trackingNo || '暂无物流单号'
      uni.showModal({
        title: '物流信息',
        content: `配送员：${driver}\n联系电话：${phone || '暂无'}\n物流单号：${trackingNo}\n当前状态：配送中`,
        confirmText: '联系配送员',
        success: ({ confirm }) => {
          if (confirm && phone) {
            uni.makePhoneCall({ phoneNumber: phone })
          }
        }
      })
    },
    cancelOrder(order) {
      uni.showModal({
        title: '申请取消订单',
        content: '提交后需要店长审核，店长同意后会为你退款并取消订单。',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '提交中' })
            await cancelBuyerOrder(order.id)
            uni.hideLoading()
            uni.showToast({ title: '已提交申请', icon: 'success' })
            this.loadOrders()
          } catch (error) {
            uni.hideLoading()
            showCloudError(error)
          }
        }
      })
    },
    cancelRefund(order) {
      uni.showModal({
        title: '撤回售后',
        content: '确认撤回当前售后申请吗？撤回后如仍需处理，可以重新提交申请。',
        confirmText: '撤回',
        confirmColor: '#ff5c72',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '撤回中' })
            await cancelRefundRequest(order.id)
            uni.hideLoading()
            uni.showToast({ title: '已撤回售后', icon: 'success' })
            this.loadOrders()
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

.buyer-orders {
  padding-bottom: 180rpx;
  overflow-x: hidden;
}

.order-tabs {
  width: 100%;
  box-sizing: border-box;
  margin: 20rpx 0 22rpx;
  padding: 18rpx;
  white-space: nowrap;
  overflow: hidden;
}

.order-tabs__inner {
  display: flex;
  gap: 14rpx;
  width: max-content;
  min-width: 100%;
}

.order-tab {
  @include flex-center;
  flex: 0 0 auto;
  min-width: 118rpx;
  height: 64rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  color: $color-text-regular;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
  font-size: 26rpx;
}

.order-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255,92,114,.20);
  font-weight: 800;
}

.time-filter {
  margin-bottom: 20rpx;
  padding: 16rpx 18rpx;
  overflow: hidden;
}

.time-scroll {
  width: 100%;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.time-tabs {
  display: inline-flex;
  gap: 12rpx;
  padding-right: 4rpx;
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
  border-color: rgba(255,92,114,.20);
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
  height: 82rpx;
  margin-bottom: 20rpx;
  padding: 0 26rpx;
  background: $color-card;
  border-radius: $radius-pill;
  box-sizing: border-box;
}

.search-card text {
  flex-shrink: 0;
  margin-right: 14rpx;
  color: $color-text-placeholder;
  font-size: 34rpx;
}

.search-card input {
  flex: 1;
  min-width: 0;
  color: $color-text-main;
  font-size: 28rpx;
}

.search-card__clear {
  margin: 0 0 0 12rpx;
  color: $color-text-placeholder;
  font-size: 30rpx;
}

.order-hint {
  margin: -8rpx 0 16rpx;
  color: $color-text-light;
  font-size: 24rpx;
}

.empty {
  @include flex-center;
  min-height: 180rpx;
  color: $color-text-light;
  font-size: 28rpx;
}

.order-skeleton {
  margin-top: 12rpx;
}

.order-skeleton__card {
  margin-bottom: 22rpx;
  padding: 24rpx;
}
</style>
