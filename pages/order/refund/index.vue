<template>
  <view class="page refund-page">
    <CustomNavBar :title="submitted ? '退款申请' : '申请退款'" showBack />

    <!-- 已提交状态 -->
    <view v-if="submitted" class="submitted-card card">
      <view class="submitted__icon">✓</view>
      <view class="submitted__title">退款申请已提交</view>
      <view class="submitted__desc">客服会在 24 小时内审核并联系您，请耐心等待。</view>
      <view class="submitted__info">
        <view>退款编号：<text>{{ refundNo }}</text></view>
        <view>申请金额：<text class="submitted__amount">￥{{ money(form.refundAmount) }}</text></view>
        <view>退款原因：<text>{{ reasonText }}</text></view>
      </view>
      <view class="submitted-actions">
        <button class="ghost-btn" @tap="copyRefundNo">复制退款编号</button>
        <button class="primary-btn" @tap="callStore">联系客服</button>
      </view>
    </view>

    <!-- 申请表单 -->
    <template v-else>
      <!-- 订单信息 -->
      <view class="order-info card">
        <view class="order-info__head">
          <text>退款订单</text>
          <view class="order-info__amount">￥{{ money(order.payable || order.amount) }}</view>
        </view>
        <view class="order-info__detail">
          <text>订单编号：{{ order.detailId || order.id }}</text>
          <text>下单时间：{{ order.createDateTime }}</text>
        </view>
      </view>

      <!-- 退款表单 -->
      <view class="form-card card">
        <view class="form-line">
          <view class="form-label">退款原因 <text>*</text></view>
          <view class="reason-list">
            <view
              v-for="item in reasonOptions"
              :key="item.key"
              class="reason-item"
              :class="{ 'reason-item--active': form.refundReason === item.key }"
              @tap="form.refundReason = item.key"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>

        <view class="form-line" v-if="form.refundReason === 'other'">
          <view class="form-label">具体原因 <text>*</text></view>
          <textarea
            v-model="form.refundDesc"
            placeholder="请详细描述退款原因，以便客服快速处理"
            maxlength="200"
          />
          <view class="counter">{{ form.refundDesc.length }}/200</view>
        </view>

        <view class="form-line">
          <view class="form-label">退款金额 <text>*</text></view>
          <view class="amount-input">
            <text class="amount-prefix">￥</text>
            <input
              v-model="form.refundAmount"
              type="digit"
              placeholder="请输入退款金额"
              :maxlength="10"
            />
          </view>
          <text class="amount-tip">最高可退 ￥{{ money(order.payable || order.amount || 0) }}</text>
        </view>

        <view class="form-line">
          <view class="form-label">联系手机 <text>*</text></view>
          <input
            v-model="form.contactPhone"
            type="number"
            maxlength="11"
            placeholder="请输入手机号，方便客服联系"
          />
        </view>

        <view class="form-line">
          <view class="form-label">补充说明</view>
          <textarea
            v-model="form.remark"
            placeholder="如有凭证照片或其他说明，请填写在这里（选填）"
            maxlength="300"
          />
          <view class="counter">{{ form.remark.length }}/300</view>
        </view>
      </view>

      <!-- 退款说明 -->
      <view class="policy card">
        <view class="policy__title">退款须知</view>
        <view class="policy__item">• 烘焙商品如已开始制作或已配送，退款需客服确认后方可处理。</view>
        <view class="policy__item">• 取消订单会自动回补库存，已取消订单不可再次恢复。</view>
        <view class="policy__item">• 退款审核通过后，金额将在 1-3 个工作日内原路返回。</view>
      </view>
    </template>

    <!-- 底部提交 -->
    <view v-if="!submitted" class="bottom-actions">
      <button class="ghost-btn" @tap="callStore">联系客服</button>
      <button class="primary-btn" @tap="submitRefund">提交申请</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getBuyerOrderById, getShopConfig, submitRefundRequest } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'
import { money } from '@/utils/format'

export default {
  components: { CustomNavBar },
  data() {
    return {
      shop: {},
      order: {},
      submitted: false,
      refundNo: '',
      reasonText: '',
      reasonOptions: [
        { key: 'no_receive', label: '未收到货' },
        { key: 'quality', label: '商品质量问题' },
        { key: 'wrong_item', label: '商品发错/漏发' },
        { key: 'delay', label: '配送超时' },
        { key: 'other', label: '其他原因' }
      ],
      form: {
        refundReason: '',
        refundDesc: '',
        refundAmount: '',
        contactPhone: '',
        remark: ''
      }
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/order/refund/index', '登录后申请退款')) return
    this.shop = await getShopConfig()
    if (query.id) {
      const result = await getBuyerOrderById(query.id)
      if (result) {
        this.order = result
        this.form.refundAmount = String(result.payable || result.amount || '')
        this.form.contactPhone = result.fullPhone || result.phone || ''
        if (result.refundStatus === 'pending') {
          this.submitted = true
          this.refundNo = result.refundNo || ''
          this.form.refundAmount = String(result.refundAmount || result.payable || result.amount || '')
          this.reasonText = result.refundReasonText || '退款申请处理中'
        }
      }
    }
  },
  methods: {
    money,
    validate() {
      if (!['delivering', 'completed'].includes(this.order.status)) {
        return this.order.status === 'cancelled' ? '已取消订单无需申请退款' : '当前订单还未配送，如需取消请直接取消订单'
      }
      if (this.order.refundStatus === 'pending') return '退款申请已提交，请勿重复申请'
      if (!this.form.refundReason) return '请选择退款原因'
      if (this.form.refundReason === 'other' && !this.form.refundDesc.trim()) return '请填写具体原因'
      const amount = Number(this.form.refundAmount)
      const maxAmount = Number(this.order.payable || this.order.amount || 0)
      if (!amount || amount <= 0) return '请输入退款金额'
      if (amount > maxAmount) return '退款金额不能超过订单实付金额'
      if (!/^1\d{10}$/.test(this.form.contactPhone)) return '请输入正确的手机号'
      return ''
    },
    async submitRefund() {
      const message = this.validate()
      if (message) {
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      // 生成退款编号
      this.refundNo = `RF${Date.now()}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`
      const reasonItem = this.reasonOptions.find(r => r.key === this.form.refundReason)
      this.reasonText = reasonItem ? reasonItem.label : (this.form.refundDesc || '其他')

      try {
        uni.showLoading({ title: '提交中' })
        await submitRefundRequest({
          refundNo: this.refundNo,
          orderId: this.order.id,
          amount: Number(this.form.refundAmount),
          reason: this.form.refundReason,
          reasonText: this.reasonText,
          refundDesc: this.form.refundDesc,
          contactPhone: this.form.contactPhone,
          remark: this.form.remark
        })
        uni.hideLoading()
        this.submitted = true
        uni.showToast({ title: '申请已提交', icon: 'success' })
      } catch (error) {
        uni.hideLoading()
        uni.showToast({ title: error.message || '提交失败', icon: 'none' })
      }
    },
    copyRefundNo() {
      uni.setClipboardData({ data: this.refundNo })
    },
    callStore() {
      uni.makePhoneCall({ phoneNumber: this.shop.phone })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.refund-page { min-height: 100vh; padding: 0 24rpx 180rpx; background: $gradient-page; }

.card { margin-top: 24rpx; }

// 已提交状态
.submitted-card { padding: 40rpx 32rpx; text-align: center; }
.submitted__icon { @include flex-center; width: 120rpx; height: 120rpx; margin: 0 auto; color: #fff; background: $gradient-primary; border-radius: 50%; font-size: 60rpx; font-weight: 800; }
.submitted__title { margin-top: 24rpx; @include text-page-title; font-size: 38rpx; }
.submitted__desc { margin-top: 12rpx; @include text-body; font-size: 26rpx; }
.submitted__info { margin-top: 28rpx; padding: 24rpx; background: $color-bg-light; border-radius: 20rpx; text-align: left; @include text-body; font-size: 26rpx; }
.submitted__info view { padding: 8rpx 0; }
.submitted__info text { color: $color-text-main; font-weight: $font-weight-medium; }
.submitted__amount { color: $color-primary; font-size: 34rpx; font-weight: $font-weight-bold; }
.submitted-actions { margin-top: 32rpx; display: flex; gap: 20rpx; }

// 订单信息
.order-info { padding: 24rpx; }
.order-info__head { display: flex; justify-content: space-between; align-items: center; }
.order-info__head text { @include text-body-strong; font-size: 28rpx; }
.order-info__amount { @include text-price(36rpx); }
.order-info__detail { margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx dashed $color-border; }
.order-info__detail text { display: block; @include text-caption; font-size: 24rpx; padding: 4rpx 0; }

// 表单
.form-card { padding: 24rpx; }
.form-line { padding: 20rpx 0; border-bottom: 1rpx solid $color-border-light; }
.form-line:last-child { border-bottom: none; }
.form-label { @include text-body-strong; font-size: 28rpx; margin-bottom: 16rpx; }
.form-label text { color: $color-primary; }

.reason-list { display: flex; flex-wrap: wrap; gap: 16rpx; }
.reason-item {
  padding: 14rpx 24rpx; background: $color-bg-light; border: 1rpx solid $color-border;
  border-radius: $radius-pill; @include text-body; font-size: 26rpx;
  transition: all 0.2s ease;
}
.reason-item--active { color: $color-primary; background: $color-primary-light; border-color: $color-primary; font-weight: $font-weight-semibold; }

textarea { width: 100%; height: 120rpx; padding: 16rpx; border: 1rpx solid $color-border; border-radius: $radius-card; @include text-body; font-size: 26rpx; }
.counter { margin-top: 8rpx; text-align: right; @include text-caption; font-size: 22rpx; }

.amount-input { display: flex; align-items: center; height: 88rpx; padding: 0 24rpx; border: 1rpx solid $color-border; border-radius: $radius-pill; background: #fff; }
.amount-prefix { @include text-price(40rpx); margin-right: 8rpx; }
.amount-input input { flex: 1; @include text-price(40rpx); }
.amount-tip { margin-top: 12rpx; display: block; @include text-caption; font-size: 22rpx; }

// 须知
.policy { padding: 24rpx; }
.policy__title { @include text-card-title; font-size: 28rpx; font-weight: $font-weight-heavy; margin-bottom: 16rpx; }
.policy__item { margin-top: 12rpx; @include text-body($font-weight-regular, $color-text-regular); font-size: 24rpx; line-height: 1.6; }

// 底部
.bottom-actions { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 20rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255, 253, 249, 0.98); border-top: 1rpx solid $color-border-light; }
.ghost-btn, .primary-btn { @include flex-center; flex: 1; height: 88rpx; margin: 0; border-radius: $radius-pill; font-size: 30rpx; font-weight: $font-weight-bold; }
.ghost-btn { color: $color-text-main; background: #fff; border: 1rpx solid $color-border; }
.primary-btn { color: #fff; background: $gradient-primary; border: none; }
</style>
