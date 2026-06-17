<template>
  <view class="page delivery-page">
    <CustomNavBar mode="brand" :brand="shop.name" :slogan="shop.slogan" :logo="shop.logo" />

    <view class="filter-section card">
      <scroll-view scroll-x class="status-scroll" show-scrollbar="false">
        <view class="category-tabs">
          <view
            v-for="tab in deliveryTabs"
            :key="tab.key"
            class="category-tab"
            :class="{ active: active === tab.key }"
            @tap="active = tab.key"
          >
            {{ tab.text }}
            <text class="category-tab__count">{{ tab.count }}</text>
          </view>
        </view>
      </scroll-view>

      <scroll-view scroll-x class="fulfillment-scroll" show-scrollbar="false" style="margin-top:14rpx;">
        <view class="fulfillment-tabs">
          <view
            v-for="method in fulfillmentMethods"
            :key="method.key"
            class="fulfillment-tab"
            :class="{ active: fulfillmentFilter === method.key }"
            @tap="fulfillmentFilter = method.key"
          >
            {{ method.text }}
          </view>
        </view>
      </scroll-view>

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
      desc="可以切换状态或履约方式，或者稍后再看看。"
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
      <button class="export" @tap="exportAddress">导出快递单</button>
      <button class="done" @tap="markDone">标记已发货</button>
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
import { buildDeliveryCsvRows, deliveryCsvHeaders, exportCsvFile } from '@/utils/exportCsv'

export default {
  components: { CustomNavBar, AddressCard, EmptyState, AdminTabBar },
  data() {
    return {
      shop: {},
      deliveryTabs: [],
      fulfillmentMethods: [
        { key: 'all', text: '全部履约' },
        { key: '快递发货', text: '快递发货' },
        { key: '门店自提', text: '门店自提' },
        { key: '同城配送', text: '同城配送' }
      ],
      active: 'all',
      fulfillmentFilter: 'all',
      keyword: '',
      sortAsc: true,
      selectedIds: [],
      list: []
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
    filteredOrders() {
      const keyword = this.keyword.trim()
      const list = this.list.filter(item => {
        const statusOk = this.active === 'all' || item.status === this.active
        const fulfillmentOk = this.fulfillmentFilter === 'all' || item.fulfillmentMethod === this.fulfillmentFilter
        const keywordOk = !keyword || [item.receiver, item.customer, item.phone, item.address].join(' ').includes(keyword)
        return statusOk && fulfillmentOk && keywordOk
      })
      return list.sort((a, b) => this.sortAsc ? a.routeNo - b.routeNo : b.routeNo - a.routeNo)
    },
    allSelected() {
      return this.filteredOrders.length > 0 && this.filteredOrders.every(item => this.selectedIds.includes(item.id))
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
      this.fulfillmentFilter = 'all'
      this.keyword = ''
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
        exportCsvFile({
          fileName: `初炉发货清单_${date}.csv`,
          headers: deliveryCsvHeaders,
          rows: buildDeliveryCsvRows(selected)
        })
        uni.showToast({ title: `已导出 ${selected.length} 条`, icon: 'success' })
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
      try {
        await Promise.all(this.selectedIds.map(id => updateOrderStatus(id, 'completed')))
        this.selectedIds = []
        await this.loadDeliveryData()
        uni.showToast({ title: '已批量完成', icon: 'success' })
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

.status-scroll, .fulfillment-scroll {
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
  opacity: 0.8;
}

.fulfillment-tabs {
  display: inline-flex;
  gap: 12rpx;
}

.fulfillment-tab {
  @include flex-center;
  flex: 0 0 auto;
  min-width: 100rpx;
  height: 56rpx;
  padding: 0 16rpx;
  color: $color-text-light;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 24rpx;
  white-space: nowrap;
}

.fulfillment-tab.active {
  color: $color-orange;
  background: $color-orange-light;
  border-color: #f1ddc6;
  font-weight: 700;
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
