<template>
  <view class="page after-sales">
    <CustomNavBar title="售后管理" showBack />

    <view class="tabs card">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: active === tab.key }"
        @tap="active = tab.key"
      >
        {{ tab.text }}<text>{{ tab.count }}</text>
      </view>
    </view>

    <view v-if="loading" class="loading-list">
      <view v-for="index in 3" :key="index" class="loading-card card">
        <SkeletonBlock variant="list" :rows="4" />
      </view>
    </view>

    <EmptyState
      v-else-if="!filteredOrders.length"
      :title="emptyTitle"
      desc="用户取消订单或提交售后后，会在这里集中查看和处理。"
      action-text="刷新"
      @action="loadOrders"
    />

    <view v-else class="refund-list">
      <view v-for="order in filteredOrders" :key="order.id" class="refund-card card">
        <view class="refund-card__head">
          <view>
            <view class="refund-card__title">订单号：{{ order.id }}</view>
            <text>{{ order.customer || order.receiver }} · {{ order.phone || '暂无电话' }}</text>
          </view>
          <StatusTag :type="tagType(order)" :text="tagText(order)" />
        </view>

        <view class="refund-card__body">
          <view><text>{{ amountLabel(order) }}</text><view>￥{{ money(order.refundAmount || order.payable || order.amount) }}</view></view>
          <view><text>{{ reasonLabel(order) }}</text><view>{{ reasonText(order) }}</view></view>
          <view><text>{{ noLabel(order) }}</text><view>{{ isCancelledOrder(order) ? (order.cancelledAt || '-') : (order.refundNo || '-') }}</view></view>
        </view>

        <view class="refund-card__items">
          <view v-for="item in refundItems(order)" :key="item._renderKey" class="refund-item">
            <image :src="item.image" mode="aspectFill" />
            <view>
              <view>{{ item.name }}</view>
              <text>×{{ item.count }}</text>
            </view>
          </view>
        </view>

        <view class="refund-card__actions">
          <button class="refund-card__btn" @tap="viewOrder(order)">查看订单</button>
          <button v-if="order.refundStatus === 'pending'" class="refund-card__btn" @tap="handleRefund(order, 'rejected')">拒绝售后</button>
          <button v-if="order.refundStatus === 'pending'" class="refund-card__btn refund-card__btn--primary" @tap="handleRefund(order, 'approved')">{{ approveText(order) }}</button>
        </view>
      </view>
    </view>

    <AdminTabBar active="dashboard" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { getAdminOrders, handleRefundRequest } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'
import { money } from '@/utils/format'

export default {
  components: { CustomNavBar, EmptyState, SkeletonBlock, StatusTag, AdminTabBar },
  data() {
    return {
      active: 'pending',
      loading: true,
      orders: []
    }
  },
  computed: {
    tabs() {
      return [
        { key: 'pending', text: '待处理', count: this.orders.filter(item => item.refundStatus === 'pending').length },
        { key: 'cancelled', text: '已取消', count: this.orders.filter(item => item.status === 'cancelled').length },
        { key: 'done', text: '已处理', count: this.orders.filter(item => ['approved', 'rejected'].includes(item.refundStatus)).length }
      ]
    },
    filteredOrders() {
      if (this.active === 'pending') return this.orders.filter(item => item.refundStatus === 'pending')
      if (this.active === 'cancelled') return this.orders.filter(item => item.status === 'cancelled')
      return this.orders.filter(item => ['approved', 'rejected'].includes(item.refundStatus))
    },
    emptyTitle() {
      if (this.active === 'pending') return '暂无待处理售后'
      if (this.active === 'cancelled') return '暂无取消订单'
      return '暂无售后记录'
    }
  },
  onLoad(query = {}) {
    if (!ensurePageAccess('/pages/admin/after-sales/index', '需要店长权限')) return
    if (['pending', 'cancelled', 'done'].includes(query.active)) this.active = query.active
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/after-sales/index', '需要店长权限')) return
    this.loadOrders()
  },
  methods: {
    money,
    async loadOrders() {
      this.loading = true
      const orders = await getAdminOrders('all')
      this.orders = (orders || []).filter(item => item.refundStatus || item.status === 'cancelled')
      if (this.active === 'pending' && !this.orders.some(item => item.refundStatus === 'pending') && this.orders.some(item => item.status === 'cancelled')) {
        this.active = 'cancelled'
      }
      this.loading = false
    },
    isCancelledOrder(order) {
      return order.status === 'cancelled'
    },
    isCancelRequest(order) {
      return order.refundType === 'cancelOrder'
    },
    amountLabel(order) {
      return this.isCancelRequest(order) || this.isCancelledOrder(order) ? '取消退款金额' : '申请金额'
    },
    reasonLabel(order) {
      return this.isCancelRequest(order) || this.isCancelledOrder(order) ? '取消说明' : '申请原因'
    },
    noLabel(order) {
      return this.isCancelledOrder(order) ? '取消时间' : '退款编号'
    },
    approveText(order) {
      return this.isCancelRequest(order) ? '同意并退款' : '同意退款'
    },
    tagType(order) {
      if (this.isCancelledOrder(order)) return 'cancelled'
      if (order.refundStatus === 'approved') return 'refundApproved'
      if (order.refundStatus === 'rejected') return 'refundRejected'
      return 'refund'
    },
    tagText(order) {
      if (this.isCancelledOrder(order)) return '已取消'
      if (this.isCancelRequest(order) && order.refundStatus === 'pending') return '取消待审核'
      if (order.refundStatus === 'approved') return '已同意'
      if (order.refundStatus === 'rejected') return '已拒绝'
      return '待处理'
    },
    reasonText(order) {
      if (this.isCancelledOrder(order)) return '店长已同意取消，库存已自动回补'
      if (this.isCancelRequest(order)) return order.refundReasonText || '用户申请取消订单，待同意后退款'
      return order.refundReasonText || '用户已提交售后申请'
    },
    refundItems(order) {
      return (order.items || []).slice(0, 2).map((item, index) => ({
        ...item,
        _renderKey: item.productId || item.id || item.name || `refund_item_${index}`
      }))
    },
    viewOrder(order) {
      uni.navigateTo({ url: `/pages/admin/order-detail/index?id=${order.id}` })
    },
    handleRefund(order, status) {
      const approved = status === 'approved'
      uni.showModal({
        title: approved ? this.approveText(order) : '拒绝售后',
        content: approved ? '确认同意该申请吗？同意后会执行退款并取消订单。' : '确认拒绝该售后申请吗？',
        confirmText: approved ? '同意' : '拒绝',
        confirmColor: approved ? '#ff5c72' : '#8f4d20',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '处理中' })
            await handleRefundRequest(order.id, status)
            await this.loadOrders()
            uni.hideLoading()
            uni.showToast({ title: approved ? '已同意处理' : '已拒绝售后', icon: 'success' })
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

.after-sales { padding-bottom: 190rpx; }
.tabs { display:flex; gap:14rpx; margin-top:18rpx; padding:16rpx; }
.tab { @include flex-center; flex:1; height:64rpx; color:$color-text-regular; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-pill; font-size:26rpx; }
.tab text { margin-left:8rpx; color:$color-text-light; font-size:22rpx; }
.tab.active { color:$color-primary; background:$color-primary-light; border-color:rgba(255,92,114,.22); font-weight:800; }
.loading-list,.refund-list { margin-top:18rpx; }
.loading-card,.refund-card { margin-bottom:18rpx; }
.loading-card { padding:24rpx; }
.refund-card { padding:24rpx; }
.refund-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:18rpx; }
.refund-card__title { color:$color-text-main; font-size:28rpx; font-weight:800; @include text-ellipsis; }
.refund-card__head text { display:block; margin-top:8rpx; color:$color-text-light; font-size:24rpx; }
.refund-card__body { margin-top:18rpx; padding-top:4rpx; border-top:1rpx dashed $color-border-light; }
.refund-card__body > view { display:flex; justify-content:space-between; gap:20rpx; padding-top:14rpx; color:$color-text-regular; font-size:25rpx; }
.refund-card__body text { flex-shrink:0; color:$color-text-main; font-weight:700; }
.refund-card__body view view { min-width:0; text-align:right; @include text-ellipsis; }
.refund-card__items { display:flex; flex-direction:column; gap:12rpx; margin-top:18rpx; padding:14rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.refund-item { display:flex; align-items:center; gap:14rpx; min-width:0; }
.refund-item image { flex-shrink:0; width:68rpx; height:68rpx; border-radius:14rpx; background:$color-bg-deep; }
.refund-item view { min-width:0; }
.refund-item view view { color:$color-text-main; font-size:25rpx; font-weight:700; @include text-ellipsis; }
.refund-item text { color:$color-text-light; font-size:22rpx; }
.refund-card__actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:14rpx; margin-top:20rpx; }
.refund-card__btn { @include flex-center; min-width:150rpx; height:64rpx; margin:0; padding:0 20rpx; color:$color-text-main; background:#fff; border:1rpx solid $color-border; border-radius:$radius-pill; font-size:25rpx; font-weight:700; }
.refund-card__btn--primary { color:#fff; background:$gradient-primary; border-color:transparent; box-shadow:$shadow-btn; }
</style>
