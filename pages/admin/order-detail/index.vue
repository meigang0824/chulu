<template>
  <view class="page admin-order-detail">
    <CustomNavBar title="订单详情" showBack />

    <view class="status-banner">
      <view class="status-banner__avatar">{{ avatarText }}</view>
      <view class="status-banner__main">
        <view class="status-banner__title">{{ order.statusText || '订单处理中' }}</view>
        <text>{{ order.customer || order.receiver || '顾客' }} · {{ order.phone || '暂无电话' }}</text>
        <text>{{ order.deliveryText || '等待打包发货' }}</text>
      </view>
      <StatusTag :type="order.status" :text="order.statusText || '处理中'" />
    </view>

    <AddressCard class="detail-card" :address="addressInfo" variant="receiver" />

    <view v-if="order.refundStatus" class="refund-card card">
      <view class="refund-card__head">
        <view>
          <view class="section-title">{{ order.refundStatus === 'pending' ? '售后申请' : '售后记录' }}</view>
          <text>{{ order.refundNo || '待生成编号' }}</text>
        </view>
        <StatusTag :type="refundTagType" :text="refundTagText" />
      </view>
      <view class="refund-card__body">
        <view><text>申请金额</text><view>￥{{ order.refundAmount || order.payable || order.amount }}</view></view>
        <view><text>申请原因</text><view>{{ order.refundReasonText || '用户已提交售后申请' }}</view></view>
      </view>
      <view v-if="order.refundStatus === 'pending'" class="refund-card__actions">
        <button class="refund-card__btn" @tap="handleRefund('rejected')">拒绝售后</button>
        <button class="refund-card__btn refund-card__btn--primary" @tap="handleRefund('approved')">同意退款</button>
      </view>
    </view>

    <view class="quick-actions card">
      <view class="section-head">
        <view class="section-title">处理动作</view>
        <text>{{ nextActionText || '订单已到最终状态' }}</text>
      </view>
      <view class="quick-actions__grid">
        <button @tap="copyAddress">复制地址</button>
        <button @tap="contactCustomer">联系顾客</button>
        <button @tap="copyOrderId">复制订单号</button>
        <button @tap="goDelivery">配送地址</button>
      </view>
    </view>

    <view class="card goods-card">
      <view class="section-title">商品清单</view>
      <view class="goods-item" v-for="item in renderItems" :key="item._renderKey">
        <image class="goods-item__image" :src="item.image" mode="aspectFill" lazy-load />
        <view class="goods-item__main">
          <view class="goods-item__name">{{ item.name }}</view>
          <view class="goods-item__meta">单价 ￥{{ item.price }} · 数量 ×{{ item.count }}</view>
        </view>
        <view class="goods-item__amount">￥{{ itemAmount(item) }}</view>
      </view>
    </view>

    <view class="card info-card">
      <view class="section-title">订单信息</view>
      <view class="info-row"><text>订单编号</text><view>{{ order.detailId }}</view></view>
      <view class="info-row"><text>下单时间</text><view>{{ order.createDateTime }}</view></view>
      <view class="info-row"><text>支付状态</text><view>{{ order.payStatusText }}</view></view>
      <view v-if="order.refundStatus" class="info-row"><text>退款状态</text><view>{{ refundText }}</view></view>
      <view class="info-row"><text>发货时间</text><view>{{ order.deliveryTime || order.deliveryText }}</view></view>
      <view class="info-row"><text>订单备注</text><view>{{ order.note || '无' }}</view></view>
    </view>

    <view class="card amount-card">
      <view class="amount-row"><text>商品金额</text><view>￥{{ order.productAmount }}</view></view>
      <view class="amount-row"><text>运费</text><view>￥{{ order.deliveryFee }}</view></view>
      <view class="amount-row"><text>团购优惠</text><view>-￥{{ order.discount }}</view></view>
      <view class="amount-total"><text>实付金额</text><view>￥{{ order.payable || order.amount }}</view></view>
    </view>

    <view class="card progress-card">
      <view class="section-title">履约进度</view>
      <view class="progress-step" v-for="step in order.progress" :key="step.key">
        <view class="progress-step__dot" :class="{ 'progress-step__dot--done': step.done, 'progress-step__dot--active': step.active }"></view>
        <view class="progress-step__body">
          <view>{{ step.text }}</view>
          <text>{{ step.subText }}</text>
        </view>
      </view>
    </view>

    <view class="bottom-actions">
      <button class="ghost-btn" @tap="copyOrderId">复制订单号</button>
      <button v-if="nextActionText" class="primary-btn" @tap="advanceStatus">{{ nextActionText }}</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AddressCard from '@/components/AddressCard/AddressCard.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import { getAdminOrderById, handleRefundRequest, updateOrderStatus } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, AddressCard, StatusTag },
  data() {
    return {
      order: {
        items: [],
        progress: []
      }
    }
  },
  computed: {
    avatarText() {
      return (this.order.customer || '顾').slice(0, 1)
    },
    addressInfo() {
      return {
        receiver: this.order.receiver,
        phone: this.order.fullPhone || this.order.phone,
        fullPhone: this.order.fullPhone || this.order.phone,
        address: this.order.address,
        note: this.order.note
      }
    },
    nextActionText() {
      if (this.order.status === 'pendingDelivery' || this.order.status === 'paid') return '标记发货'
      if (this.order.status === 'delivering') return '标记已完成'
      return ''
    },
    refundText() {
      if (this.order.refundStatus === 'pending') return `处理中${this.order.refundNo ? ' · ' + this.order.refundNo : ''}`
      if (this.order.refundStatus === 'approved') return '已同意退款'
      if (this.order.refundStatus === 'rejected') return '已拒绝退款'
      return this.order.refundStatus
    },
    refundTagType() {
      if (this.order.refundStatus === 'approved') return 'refundApproved'
      if (this.order.refundStatus === 'rejected') return 'refundRejected'
      return 'refund'
    },
    refundTagText() {
      if (this.order.refundStatus === 'approved') return '已同意'
      if (this.order.refundStatus === 'rejected') return '已拒绝'
      return '待处理'
    },
    renderItems() {
      return (this.order.items || []).map((item, index) => ({
        ...item,
        _renderKey: item.productId || item.name || `admin_order_item_${index}`
      }))
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/admin/order-detail/index', '需要店长权限')) return
    if (query.id) {
      await this.loadOrder(query.id)
    }
  },
  methods: {
    async loadOrder(id = this.order.id) {
      const result = await getAdminOrderById(id)
      if (result) this.order = result
    },
    itemAmount(item) {
      return (Number(item.price || 0) * Number(item.count || 0)).toFixed(1).replace(/\.0$/, '')
    },
    copyAddress() {
      uni.setClipboardData({
        data: `${this.order.receiver || ''} ${this.order.phone || ''}\n${this.order.address || ''}`
      })
    },
    contactCustomer() {
      if (!this.order.phone) {
        uni.showToast({ title: '暂无联系电话', icon: 'none' })
        return
      }
      uni.makePhoneCall({ phoneNumber: String(this.order.phone).replace(/\s+/g, '') })
    },
    copyOrderId() {
      uni.setClipboardData({ data: this.order.detailId || this.order.id || '' })
    },
    goDelivery() {
      uni.navigateTo({ url: '/pages/admin/delivery-address/index' })
    },
    async advanceStatus() {
      const nextStatus = this.order.status === 'delivering' ? 'completed' : 'delivering'
      try {
        uni.showLoading({ title: '更新中' })
        await updateOrderStatus(this.order.id, nextStatus)
        await this.loadOrder(this.order.id)
        uni.hideLoading()
        uni.showToast({ title: nextStatus === 'completed' ? '已标记完成' : '已标记发货', icon: 'success' })
      } catch (error) {
        uni.hideLoading()
        showCloudError(error)
      }
    },
    handleRefund(status) {
      const approved = status === 'approved'
      uni.showModal({
        title: approved ? '同意退款' : '拒绝售后',
        content: approved
          ? '确认同意该退款申请吗？订单会标记为已同意退款。'
          : '确认拒绝该售后申请吗？订单会标记为已拒绝退款。',
        confirmText: approved ? '同意' : '拒绝',
        confirmColor: approved ? '#ff5c72' : '#8f4d20',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '处理中' })
            await handleRefundRequest(this.order.id, status)
            await this.loadOrder(this.order.id)
            uni.hideLoading()
            uni.showToast({ title: approved ? '已同意退款' : '已拒绝售后', icon: 'success' })
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

.admin-order-detail {
  padding-bottom: 190rpx;
}

.status-banner,
.detail-card,
.refund-card,
.quick-actions,
.goods-card,
.info-card,
.amount-card,
.progress-card {
  margin-top: 22rpx;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx;
  background: $color-card;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-xl;
  box-shadow: $shadow-card;
}

.quick-actions {
  padding: 24rpx;
}

.refund-card {
  padding: 24rpx;
  border-color: rgba(200, 121, 50, 0.22);
  background: linear-gradient(180deg, #fffaf2 0%, #fffdf9 100%);
}

.refund-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.refund-card__head text {
  display: block;
  margin-top: 6rpx;
  color: $color-text-light;
  font-size: 24rpx;
}

.refund-card__body {
  margin-top: 18rpx;
  border-top: 1rpx dashed $color-border-light;
}

.refund-card__body > view {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding-top: 16rpx;
  color: $color-text-regular;
  font-size: 26rpx;
}

.refund-card__body text {
  flex-shrink: 0;
  color: $color-text-main;
  font-weight: 600;
}

.refund-card__body view view {
  text-align: right;
}

.refund-card__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.refund-card__btn {
  @include flex-center;
  flex: 1;
  height: 72rpx;
  margin: 0;
  color: $color-orange-dark;
  background: #fff;
  border: 1rpx solid rgba(200, 121, 50, 0.32);
  border-radius: $radius-pill;
  font-size: 26rpx;
  font-weight: 700;
}

.refund-card__btn--primary {
  color: #fff;
  background: $gradient-primary;
  border-color: transparent;
  box-shadow: $shadow-btn;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 16rpx;
}

.section-head text {
  flex-shrink: 0;
  color: $color-text-light;
  font-size: 24rpx;
}

.quick-actions__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.quick-actions__grid button {
  @include flex-center;
  height: 64rpx;
  margin: 0;
  padding: 0 10rpx;
  color: $color-text-main;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 24rpx;
  line-height: 1.2;
}

.status-banner__avatar {
  @include flex-center;
  width: 88rpx;
  height: 88rpx;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: $radius-md;
  font-size: 34rpx;
  font-weight: 800;
}

.status-banner__main {
  flex: 1;
  min-width: 0;
}

.status-banner__title {
  color: $color-text-main;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.25;
}

.status-banner__main text {
  display: block;
  margin-top: 10rpx;
  color: $color-text-regular;
  font-size: 24rpx;
}

.goods-card,
.info-card,
.amount-card,
.progress-card {
  padding: 28rpx;
}

.section-title {
  color: $color-text-main;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.25;
}

.goods-item {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $color-border-light;
}

.goods-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.goods-item__image {
  flex-shrink: 0;
  width: 96rpx;
  height: 96rpx;
  border-radius: 16rpx;
  background: $color-bg-deep;
}

.goods-item__main {
  flex: 1;
  min-width: 0;
}

.goods-item__name {
  color: $color-text-main;
  font-size: 28rpx;
  font-weight: 700;
  @include text-ellipsis;
}

.goods-item__meta {
  margin-top: 8rpx;
  color: $color-text-light;
  font-size: 24rpx;
}

.goods-item__amount {
  flex-shrink: 0;
  min-width: 106rpx;
  color: $color-primary;
  font-size: 30rpx;
  font-weight: 800;
  text-align: right;
}

.info-row,
.amount-row,
.amount-total {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding-top: 18rpx;
  color: $color-text-regular;
  font-size: 26rpx;
  line-height: 1.4;
}

.info-row text,
.amount-row text,
.amount-total text {
  color: $color-text-main;
}

.info-row view,
.amount-row view,
.amount-total view {
  min-width: 0;
  text-align: right;
}

.amount-total {
  margin-top: 10rpx;
  padding-top: 22rpx;
  border-top: 1rpx dashed $color-border;
}

.amount-total view {
  color: $color-primary;
  font-size: 38rpx;
  font-weight: 800;
}

.progress-step {
  display: flex;
  gap: 18rpx;
  padding-top: 20rpx;
  position: relative;
}

.progress-step__dot {
  width: 18rpx;
  height: 18rpx;
  margin-top: 10rpx;
  background: #e8ddd5;
  border-radius: $radius-sm;
}

.progress-step__dot--done {
  background: $color-primary;
}

.progress-step__dot--active {
  background: $color-orange;
}

.progress-step__body view {
  color: $color-text-main;
  font-size: 28rpx;
  font-weight: 700;
}

.progress-step__body text {
  display: block;
  margin-top: 8rpx;
  color: $color-text-light;
  font-size: 24rpx;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 253, 249, 0.98);
  border-top: 1rpx solid $color-border-light;
  box-shadow: $shadow-bottom;
}

.ghost-btn,
.primary-btn {
  @include flex-center;
  flex: 1;
  min-width: 0;
  height: 84rpx;
  margin: 0;
  border-radius: $radius-md;
  font-size: 30rpx;
  font-weight: 700;
}

.ghost-btn {
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
}

.primary-btn {
  color: #fff;
  background: $gradient-primary;
  border: none;
  box-shadow: $shadow-btn;
}

@media screen and (max-width: 360px) {
  .quick-actions__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bottom-actions {
    gap: 12rpx;
  }

  .ghost-btn,
  .primary-btn {
    font-size: 26rpx;
  }
}
</style>
