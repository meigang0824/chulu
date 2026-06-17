<template>
  <view class="page order-list">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="filter-section card">
      <scroll-view scroll-x class="status-scroll" show-scrollbar="false">
        <view class="category-tabs">
          <view
            v-for="tab in orderStatusTabs"
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
      keyword: '',
      loading: true,
      list: []
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/order-list/index', '需要店长权限')) return
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/order-list/index', '需要店长权限')) return
    this.loadOrders()
  },
  computed: {
    filteredOrders() {
      const keyword = this.keyword.trim()
      const result = this.list.filter(item => {
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
      this.orderStatusTabs = this.orderStatusTabs.map(tab => ({
        ...tab,
        count: tab.key === 'all'
          ? this.list.length
          : this.list.filter(item => item.status === tab.key).length
      }))
      this.loading = false
    },
    resetFilters() {
      this.active = 'all'
      this.keyword = ''
    },
    viewOrder(order) {
      uni.navigateTo({ url: `/pages/admin/order-detail/index?id=${order.id}` })
    },
    async updateStatus(order) {
      const target = this.list.find(item => item.id === order.id)
      if (!target) return
      if (target.status === 'completed') {
        uni.showToast({ title: '已为顾客创建复购提醒', icon: 'none' })
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
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 26rpx;
  white-space: nowrap;
}

.category-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(232, 79, 95, 0.18);
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

.search-card {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 24rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
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
