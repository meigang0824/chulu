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
    <view v-if="isLoggedIn && !loading" class="order-hint">
      {{ active === 'all' ? `共 ${orders.length} 笔订单` : `当前筛选 ${filteredOrders.length} 笔订单` }}
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
      title="还没有相关订单"
      desc="下单成功后，订单进度会在这里更新。"
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
import { cancelBuyerOrder, getBuyerOrders } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'

export default {
  components: { CustomNavBar, OrderCard, EmptyState, SkeletonBlock, BuyerTabBar },
  data() {
    return {
      orders: [],
      loading: true,
      active: 'all',
      isLoggedIn: false,
      tabs: [
        { key: 'all', text: '全部' },
        { key: 'pendingDelivery', text: '待配送' },
        { key: 'delivering', text: '配送中' },
        { key: 'completed', text: '已完成' },
        { key: 'cancelled', text: '已取消' }
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
    this.loadOrders()
  },
  onShareAppMessage() {
    return {
      title: '初炉 · 我的订单',
      path: '/pages/order/list/index'
    }
  },
  watch: {
    active() {
      this.loadOrders()
    }
  },
  computed: {
    filteredOrders() {
      return this.active === 'all' ? this.orders : this.orders.filter(item => item.status === this.active)
    }
  },
  methods: {
    cardActionText(order) {
      if (['paid', 'pendingDelivery'].includes(order.status)) return '取消订单'
      if (order.status === 'delivering') return '查看物流'
      if (order.status === 'completed') return '再次购买'
      if (order.status === 'cancelled') return '申请退款'
      return '查看进度'
    },
    async loadOrders() {
      this.loading = true
      const seq = ++this.loadSeq
      const orders = await getBuyerOrders('all')
      if (seq !== this.loadSeq) return
      this.orders = orders
      this.tabs = this.tabs.map(tab => ({
        ...tab,
        count: tab.key === 'all' ? this.orders.length : this.orders.filter(item => item.status === tab.key).length
      }))
      this.loading = false
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
        // 再次购买：先检查商品是否上架
        if (order.items && order.items.length && order.items[0].productId) {
          uni.navigateTo({ url: `/pages/product/detail?id=${order.items[0].productId}` })
        } else {
          uni.showToast({ title: '商品已下架', icon: 'none' })
        }
        return
      }
      if (order.status === 'cancelled') {
        // 已取消订单：跳转退款页面
        uni.navigateTo({ url: `/pages/order/refund/index?id=${order.id}` })
        return
      }
      this.viewOrder(order)
    },
    viewLogistics(order) {
      const driver = order.driverName || '初炉配送员'
      const phone = order.driverPhone || order.shopPhone || '暂无'
      const trackingNo = order.trackingNo || '暂无物流单号'
      uni.showModal({
        title: '物流信息',
        content: `配送员：${driver}\n联系电话：${phone}\n物流单号：${trackingNo}\n当前状态：配送中`,
        confirmText: '联系配送员',
        success: ({ confirm }) => {
          if (confirm && phone && phone !== '暂无') {
            uni.makePhoneCall({ phoneNumber: phone })
          }
        }
      })
    },
    cancelOrder(order) {
      uni.showModal({
        title: '取消订单',
        content: '确认取消该订单吗？取消后库存会自动回补。',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '取消中' })
            await cancelBuyerOrder(order.id)
            uni.hideLoading()
            uni.showToast({ title: '订单已取消', icon: 'success' })
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
}

.order-tabs {
  margin: 20rpx 0 22rpx;
  padding: 18rpx;
  white-space: nowrap;
}

.order-tabs__inner {
  display: inline-flex;
  gap: 14rpx;
}

.order-tab {
  @include flex-center;
  flex: 0 0 auto;
  min-width: 128rpx;
  height: 64rpx;
  padding: 0 20rpx;
  color: $color-text-regular;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 26rpx;
}

.order-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(232,79,95,.18);
  font-weight: 800;
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
