<template>
  <view class="order-detail">
    <CustomNavBar title="订单详情" showBack />

    <!-- 加载中骨架屏 -->
    <view v-if="pageLoading" class="skeleton-wrap">
      <view class="skeleton-card"><SkeletonBlock variant="list" :rows="3" /></view>
      <view class="skeleton-card"><SkeletonBlock variant="list" :rows="3" /></view>
      <view class="skeleton-card"><SkeletonBlock variant="list" :rows="4" /></view>
      <view class="skeleton-card"><SkeletonBlock variant="list" :rows="2" /></view>
    </view>

    <template v-else-if="!order.id">
      <EmptyState title="未找到订单" desc="订单可能已过期或被删除。" action-text="返回订单列表" @action="goOrderList" />
    </template>

    <template v-else>
      <AddressCard class="detail-card" :address="addressInfo" variant="receiver" />

      <view class="goods-card card">
        <view class="section-head">
          <view class="section-title">商品清单</view>
          <StatusTag type="normal" :text="mainItemTag" size="sm" plain />
        </view>
        <view class="goods-item" v-for="item in renderItems" :key="item._renderKey">
          <image class="goods-item__image" :src="item.image" mode="aspectFill" lazy-load />
          <view class="goods-item__info">
            <view class="goods-item__name">{{ item.name }}</view>
            <text>￥{{ money(item.price) }} × {{ item.count }}</text>
          </view>
          <view class="goods-item__amount">￥{{ itemAmount(item) }}</view>
        </view>
      </view>

      <view class="amount-card card">
        <view class="amount-row"><text>商品金额</text><view>￥{{ money(order.productAmount || itemTotal) }}</view></view>
        <view class="amount-row"><text>配送费</text><view>￥{{ money(order.deliveryFee || 0) }}</view></view>
        <view class="amount-row"><text>优惠</text><view>-￥{{ money(order.discount || 0) }}</view></view>
        <view class="amount-total"><text>实付款</text><view>￥{{ money(order.payable || order.amount) }}</view></view>
      </view>

      <view class="info-card card">
        <view class="info-card__title">订单信息</view>
        <view class="info-row">
          <text>订单编号</text>
          <view>{{ order.detailId }} <button @tap="copyOrderId">复制</button></view>
        </view>
        <view class="info-row"><text>下单时间</text><view>{{ order.createDateTime }}</view></view>
        <view class="info-row"><text>支付方式</text><view>{{ order.payMethod }}</view></view>
        <view class="info-row"><text>配送时间</text><view>{{ order.deliveryText }}</view></view>
        <view v-if="noteText" class="info-row"><text>订单备注</text><view>{{ noteText }}</view></view>
      </view>

      <view v-if="refundNoticeVisible" class="refund-notice card">
        <view class="refund-notice__head">
          <view>{{ refundNoticeTitle }}</view>
          <StatusTag type="refund" text="处理中" size="sm" plain />
        </view>
        <text>{{ refundNoticeText }}</text>
        <view v-if="order.refundError" class="refund-notice__error">
          <view>上次退款失败：{{ order.refundError }}</view>
          <button @tap="copyRefundError">复制原因</button>
        </view>
      </view>

      <view class="progress-card card">
        <view class="section-title">履约进度</view>
        <view class="progress-list">
          <view
            class="progress-step"
            :class="{ 'progress-step--done': step.done, 'progress-step--active': step.active }"
            v-for="(step, index) in order.progress"
            :key="step.key"
          >
            <view class="progress-step__rail">
              <view class="progress-step__icon" :class="{ 'progress-step__icon--done': step.done, 'progress-step__icon--active': step.active }">
                {{ progressIcon(step, index) }}
              </view>
            </view>
            <view class="progress-step__text">
              <view>{{ step.text }}</view>
              <text>{{ step.subText }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 配送信息 -->
      <view v-if="order.deliveryStatus === 'delivering' || order.deliveryStatus === 'completed'" class="driver-card card">
        <view class="driver-card__title">配送信息</view>
        <view class="driver-card__row">
          <text class="driver-card__label">配送员</text>
          <view class="driver-card__value">
            <text>{{ order.driverName || '初炉配送员' }}</text>
            <text class="driver-card__phone" @tap="callDriver">{{ order.driverPhone || shop.phone }}</text>
          </view>
        </view>
        <view class="driver-card__row">
          <text class="driver-card__label">配送时间</text>
          <view class="driver-card__value">{{ order.deliveryTime || '配送中' }}</view>
        </view>
      </view>

      <view class="assurance">{{ shop.assurance }} <text>初炉新鲜，趁热成团♡</text></view>
    </template>

    <view v-if="!pageLoading && order.id" class="bottom-actions">
      <button class="action-btn action-btn--ghost" @tap="contact">联系客服</button>
      <button v-if="moreActions.length" class="action-btn action-btn--ghost" @tap="showMoreActions">更多</button>
      <button class="action-btn action-btn--primary" :class="{ 'action-btn--disabled': primaryAction.disabled }" @tap="handlePrimaryAction">
        {{ primaryAction.text }}
      </button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AddressCard from '@/components/AddressCard/AddressCard.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import { cancelBuyerOrder, cancelRefundRequest, getBuyerOrderById, getShopConfig } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'
import { money } from '@/utils/format'

export default {
  components: { CustomNavBar, AddressCard, StatusTag, SkeletonBlock, EmptyState },
  data() {
    return {
      order: { items: [], progress: [] },
      shop: {},
      pageLoading: true
    }
  },
  computed: {
    mainItem() {
      return this.order.items && this.order.items.length ? this.order.items[0] : {}
    },
    itemTotal() {
      const total = Number(this.mainItem.price || 0) * Number(this.mainItem.count || 0)
      return money(total)
    },
    renderItems() {
      return (this.order.items || []).map((item, index) => ({
        ...item,
        _renderKey: item.productId || item.id || item.name || `order_item_${index}`
      }))
    },
    mainItemTag() {
      return '每日配送'
    },
    noteText() {
      const note = String(this.order.note || '').trim()
      if (!note || note === '无' || note === 'undefined' || note === 'null') return ''
      return note
    },
    addressInfo() {
      return {
        receiver: this.order.receiver,
        phone: this.order.phone,
        fullPhone: this.order.fullPhone,
        address: this.order.address
      }
    },
    canCancel() {
      return ['paid', 'pendingDelivery'].includes(this.order.status) && this.order.refundStatus !== 'pending'
    },
    canRefund() {
      return ['delivering', 'completed'].includes(this.order.status)
    },
    refundActionText() {
      return this.order.refundStatus === 'pending' ? '退款处理中' : '申请退款'
    },
    refundNoticeVisible() {
      return this.order.refundStatus === 'pending' || Boolean(this.order.refundError)
    },
    refundNoticeTitle() {
      return this.order.refundType === 'cancelOrder' ? '取消申请待审核' : '售后申请待处理'
    },
    refundNoticeText() {
      if (this.order.refundError) return '退款暂未成功，店长可以在售后管理中重试；处理前你仍可以撤回申请。'
      return '店长处理前可以撤回申请，撤回后如仍需处理，可以重新提交。'
    },
    primaryAction() {
      if (this.canCancel) return { text: '申请取消', action: 'cancel' }
      if (this.order.status === 'delivering') return { text: '查看物流', action: 'logistics' }
      if (this.order.refundStatus === 'pending') return { text: '撤回售后', action: 'cancelRefund' }
      if (this.order.status === 'completed') return { text: '再次购买', action: 'buyAgain' }
      if (this.order.status === 'cancelled') return { text: '再次购买', action: 'buyAgain' }
      return { text: '再次购买', action: 'buyAgain' }
    },
    moreActions() {
      const actions = []
      if (this.canRefund && this.order.refundStatus !== 'pending') {
        actions.push({ text: '申请退款', action: 'refund' })
      }
      return actions
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/order/detail/index', '登录后查看订单详情')) return
    this.shop = await getShopConfig()
    if (query.id) {
      const result = await getBuyerOrderById(query.id)
      if (result) this.order = result
    }
    this.pageLoading = false
  },
  methods: {
    money,
    progressIcon(step, index) {
      if (step.done) return '✓'
      if (step.active) return String(index + 1)
      return ''
    },
    itemAmount(item) {
      const total = Number(item.price || 0) * Number(item.count || 0)
      return money(total)
    },
    copyOrderId() {
      uni.setClipboardData({ data: this.order.detailId || this.order.id })
    },
    copyRefundError() {
      uni.setClipboardData({ data: this.order.refundError || '' })
    },
    callDriver() {
      const phone = String(this.order.driverPhone || this.shop.phone || '').replace(/[^\d]/g, '')
      if (!phone) {
        uni.showToast({ title: '暂无联系电话', icon: 'none' })
        return
      }
      uni.makePhoneCall({ phoneNumber: phone })
    },
    viewLogistics() {
      const driver = this.order.driverName || '初炉配送员'
      const phone = String(this.order.driverPhone || this.shop.phone || '').replace(/[^\d]/g, '') || '暂无'
      const deliveryTime = this.order.deliveryTime || this.order.deliveryText || '配送中'
      uni.showModal({
        title: '配送信息',
        content: `配送员：${driver}\n联系电话：${phone}\n当前状态：${deliveryTime}`,
        confirmText: '联系配送员',
        success: ({ confirm }) => {
          if (confirm && phone && phone !== '暂无') this.callDriver()
        }
      })
    },
    contact() {
      const serviceTime = this.shop.customerService || '以门店实际服务时间为准'
      const phone = String(this.shop.phone || '').replace(/[^\d-]/g, '')
      if (!phone) {
        uni.showModal({
          title: '联系客服',
          content: `客服时间：${serviceTime}\n暂无客服电话，请稍后再试。`,
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
      uni.showModal({
        title: '联系客服',
        content: `客服时间：${serviceTime}\n客服电话：${phone}`,
        confirmText: '拨打电话',
        success: ({ confirm }) => {
          if (confirm) uni.makePhoneCall({ phoneNumber: phone })
        }
      })
    },
    handlePrimaryAction() {
      const action = this.primaryAction.action
      if (action === 'cancel') return this.cancelOrder()
      if (action === 'logistics') return this.viewLogistics()
      if (action === 'cancelRefund') return this.cancelRefund()
      return this.buyAgain()
    },
    showMoreActions() {
      const actions = this.moreActions
      if (!actions.length) return
      uni.showActionSheet({
        itemList: actions.map(item => item.text),
        success: res => {
          const action = actions[res.tapIndex]
          if (!action) return
          if (action.action === 'refund') this.goRefund()
        }
      })
    },
    goRefund() {
      if (this.order.refundStatus === 'pending') {
        uni.showToast({ title: '退款申请处理中', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/pages/order/refund/index?id=${this.order.id || this.order.detailId || ''}` })
    },
    buyAgain() {
      if (!this.mainItem.productId) {
        uni.showToast({ title: '商品不存在', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/pages/product/detail?id=${this.mainItem.productId}` })
    },
    goOrderList() {
      uni.switchTab({ url: '/pages/order/list/index' })
    },
    cancelOrder() {
      uni.showModal({
        title: '申请取消订单',
        content: '提交后需要店长审核，店长同意后会为你退款并取消订单。',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '提交中' })
            await cancelBuyerOrder(this.order.id)
            this.order = await getBuyerOrderById(this.order.id)
            uni.hideLoading()
            uni.showToast({ title: '已提交申请', icon: 'success' })
          } catch (error) {
            uni.hideLoading()
            showCloudError(error)
          }
        }
      })
    },
    cancelRefund() {
      uni.showModal({
        title: '撤回售后',
        content: '确认撤回当前售后申请吗？撤回后如仍需处理，可以重新提交申请。',
        confirmText: '撤回',
        confirmColor: '#ff5c72',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '撤回中' })
            await cancelRefundRequest(this.order.id)
            this.order = await getBuyerOrderById(this.order.id)
            uni.hideLoading()
            uni.showToast({ title: '已撤回售后', icon: 'success' })
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

.order-detail { min-height: 100vh; padding: 0 24rpx 190rpx; background: $gradient-page; }
.skeleton-wrap .skeleton-card { padding: 24rpx; border-radius: $radius-card; margin-top: 20rpx; background: #fff; }

.detail-card, .goods-card, .info-card, .amount-card, .progress-card, .refund-notice { margin-top: 20rpx; }

.goods-card, .info-card, .amount-card, .progress-card, .refund-notice { padding: 28rpx; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-bottom: 8rpx; }
.goods-item { display: flex; align-items: center; gap: 18rpx; padding: 20rpx 0; border-bottom: 1rpx solid $color-border-light; }
.goods-item:last-child { padding-bottom: 0; border-bottom: none; }
.goods-item__image { flex-shrink: 0; width: 112rpx; height: 112rpx; border-radius: 22rpx; background: $color-bg-deep; }
.goods-item__info { flex: 1; min-width: 0; }
.goods-item__name { color: $color-text-main; font-size: 28rpx; font-weight: 700; line-height: 1.35; @include multi-ellipsis(2); }
.goods-item__info text { display: block; margin-top: 10rpx; color: $color-text-light; font-size: 24rpx; }
.goods-item__amount { flex-shrink: 0; min-width: 112rpx; color: $color-text-main; font-size: 28rpx; font-weight: 800; text-align: right; }

.info-card__title, .section-title { margin-bottom: 22rpx; color: $color-text-main; font-size: 34rpx; font-weight: 800; }

.info-row { display: flex; justify-content: space-between; gap: 24rpx; padding-top: 18rpx; color: $color-text-regular; font-size: 28rpx; line-height: 1.45; }
.info-row text { flex-shrink: 0; color: $color-text-main; }
.info-row view { min-width: 0; text-align: right; }
.info-row button { display: inline-flex; align-items: center; justify-content: center; height: 42rpx; margin-left: 12rpx; padding: 0 14rpx; color: $color-orange; background: #fff; border: 1rpx solid $color-orange; border-radius: $radius-pill; font-size: 22rpx; }

.refund-notice {
  background: #fff7f8;
  border: 1rpx solid rgba(255, 92, 114, 0.16);
}

.refund-notice__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.refund-notice__head view {
  color: $color-text-main;
  font-size: 30rpx;
  font-weight: 800;
}

.refund-notice > text {
  display: block;
  margin-top: 12rpx;
  color: $color-text-regular;
  font-size: 25rpx;
  line-height: 1.45;
}

.refund-notice__error {
  margin-top: 16rpx;
  padding: 16rpx;
  color: $color-primary;
  background: #fff;
  border: 1rpx solid rgba(255, 92, 114, 0.18);
  border-radius: 18rpx;
  font-size: 24rpx;
  line-height: 1.4;
}

.refund-notice__error button {
  @include flex-center;
  width: 150rpx;
  height: 52rpx;
  margin: 14rpx 0 0;
  padding: 0;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(255, 92, 114, 0.18);
  border-radius: $radius-pill;
  font-size: 23rpx;
  font-weight: 700;
}

.amount-row, .amount-total { display: flex; justify-content: space-between; gap: 24rpx; padding-top: 18rpx; color: $color-text-regular; font-size: 26rpx; line-height: 1.35; }
.amount-row:first-child { padding-top: 0; }
.amount-row text, .amount-total text { color: $color-text-main; }
.amount-row view, .amount-total view { min-width: 0; text-align: right; }
.amount-total { margin-top: 12rpx; padding-top: 24rpx; border-top: 1rpx dashed $color-border; }
.amount-total text { font-size: 30rpx; font-weight: 800; }
.amount-total view { color: $color-primary; font-size: 42rpx; font-weight: 800; }

.progress-list { display: flex; flex-direction: column; padding-top: 4rpx; }
.progress-step { position: relative; display: flex; align-items: flex-start; gap: 18rpx; min-width: 0; padding-bottom: 26rpx; }
.progress-step:last-child { padding-bottom: 0; }
.progress-step__rail { position: relative; flex-shrink: 0; display: flex; justify-content: center; width: 62rpx; }
.progress-step__rail::after { content: ''; position: absolute; top: 68rpx; bottom: -26rpx; left: 50%; width: 2rpx; background: $color-border-light; transform: translateX(-50%); }
.progress-step:last-child .progress-step__rail::after { display: none; }
.progress-step--done .progress-step__rail::after { background: rgba(255, 92, 114, 0.26); }
.progress-step__icon { position: relative; z-index: 1; @include flex-center; width: 62rpx; height: 62rpx; color: $color-text-placeholder; background: $color-bg-deep; border: 1rpx solid $color-border-light; border-radius: 50%; font-size: 24rpx; font-weight: 800; }
.progress-step__icon--done { color: #fff; background: $gradient-primary; border-color: transparent; box-shadow: 0 8rpx 18rpx rgba(255, 92, 114, 0.14); }
.progress-step__icon--active { color: #fff; background: $color-orange; border-color: transparent; box-shadow: 0 8rpx 18rpx rgba(200, 121, 50, 0.16); }
.progress-step__text { flex: 1; min-width: 0; padding: 16rpx 18rpx; background: $color-bg-light; border: 1rpx solid $color-border-light; border-radius: $radius-card; }
.progress-step--active .progress-step__text { background: $color-orange-light; border-color: rgba(200, 121, 50, 0.2); }
.progress-step__text view { color: $color-text-main; font-size: 27rpx; font-weight: 800; line-height: 1.3; }
.progress-step__text text { display: block; margin-top: 6rpx; color: $color-text-light; font-size: 23rpx; line-height: 1.35; @include multi-ellipsis(2); }

.driver-card { padding: 24rpx; }
.driver-card__title { @include text-card-title; font-size: 28rpx; font-weight: $font-weight-heavy; margin-bottom: 16rpx; }
.driver-card__row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid $color-border-light; }
.driver-card__row:last-child { border-bottom: none; }
.driver-card__label { color: $color-text-regular; font-size: 26rpx; }
.driver-card__value { color: $color-text-main; font-size: 26rpx; font-weight: $font-weight-medium; }
.driver-card__phone { margin-left: 16rpx; color: $color-primary; text-decoration: underline; }

.assurance { display: flex; flex-wrap: wrap; gap: 12rpx; justify-content: space-between; margin-top: 20rpx; padding: 22rpx 28rpx; color: $color-text-main; background: $color-orange-light; border: 1rpx solid rgba(200, 121, 50, 0.18); border-radius: $radius-card; font-size: 26rpx; }
.assurance text { color: $color-primary; font-weight: 700; }

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 253, 249, 0.98);
  border-top: 1rpx solid $color-border-light;
  box-shadow: $shadow-bottom;
}
.action-btn { @include flex-center; flex: 0 0 154rpx; min-width: 0; height: 76rpx; margin: 0; padding: 0 16rpx; border-radius: $radius-pill; font-size: 25rpx; font-weight: 700; line-height: 1.2; }
.action-btn--ghost { color: $color-text-main; background: #fff; border: 1rpx solid $color-border; }
.action-btn--primary { flex: 1; color: #fff; background: $gradient-primary; border: none; box-shadow: $shadow-btn; font-size: 28rpx; }
.action-btn--disabled { opacity: .72; box-shadow: none; }
</style>
