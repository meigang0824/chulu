<template>
  <view class="page review-page">
    <CustomNavBar title="订单评价" showBack />

    <view class="order-summary card">
      <text>订单编号：{{ order.detailId || order.id }}</text>
      <text>商品：{{ mainItem.name }}</text>
    </view>

    <view class="rating-card card">
      <view class="rating-card__title">整体评分</view>
      <view class="star-row">
        <text v-for="i in 5" :key="i" class="star" :class="{ 'star--active': i <= form.rating }" @tap="form.rating = i">★</text>
      </view>
      <text class="rating-text">{{ ratingText }}</text>
    </view>

    <view class="tag-card card">
      <view class="tag-card__title">商品标签</view>
      <view class="tag-list">
        <view v-for="tag in tagOptions" :key="tag" class="tag-item" :class="{ 'tag-item--active': form.tags.includes(tag) }" @tap="toggleTag(tag)">{{ tag }}</view>
      </view>
    </view>

    <view class="comment-card card">
      <view class="comment-card__title">评价内容</view>
      <textarea v-model="form.content" placeholder="分享你的品尝体验，帮助其他顾客做决定~" maxlength="300" />
      <view class="counter">{{ form.content.length }}/300</view>
    </view>

    <view class="bottom-actions">
      <button class="ghost-btn" @tap="cancel">取消</button>
      <button class="primary-btn" :disabled="submitting" @tap="submitReview">{{ submitting ? '提交中...' : '提交评价' }}</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getBuyerOrderById } from '@/services/dataService'
import { callFunction } from '@/services/apiClient'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess, getAuthToken } from '@/utils/auth'

export default {
  components: { CustomNavBar },
  data() {
    return {
      order: {},
      tagOptions: ['新鲜好吃', '配送准时', '包装精美', '分量十足', '口感细腻', '性价比高'],
      form: {
        rating: 5,
        tags: [],
        content: ''
      },
      submitting: false
    }
  },
  computed: {
    mainItem() {
      return this.order.items && this.order.items.length ? this.order.items[0] : {}
    },
    ratingText() {
      const texts = ['很差', '较差', '一般', '满意', '非常满意']
      return texts[this.form.rating - 1] || ''
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/order/review/index', '评价功能需要登录后使用')) return
    if (query.id) {
      const order = await getBuyerOrderById(query.id)
      if (!order) {
        uni.showToast({ title: '订单不存在', icon: 'none' })
        setTimeout(() => uni.navigateBack(), 600)
        return
      }
      this.order = order
    }
  },
  methods: {
    toggleTag(tag) {
      const idx = this.form.tags.indexOf(tag)
      if (idx >= 0) this.form.tags.splice(idx, 1)
      else this.form.tags.push(tag)
    },
    cancel() {
      uni.navigateBack()
    },
    async submitReview() {
      if (!this.form.content.trim()) {
        uni.showToast({ title: '请填写评价内容', icon: 'none' })
        return
      }
      if (this.submitting) return
      this.submitting = true
      try {
        await callFunction('businessApi', {
          action: 'submitReview',
          payload: { orderId: this.order.id || this.order.detailId, ...this.form },
          authToken: getAuthToken()
        })
        uni.showToast({ title: '评价提交成功', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 1200)
      } catch (error) {
        showCloudError(error)
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.review-page { min-height: 100vh; padding: 0 24rpx 180rpx; background: $gradient-page; }
.card { margin-top: 24rpx; padding: 28rpx; background: #fff; border-radius: $radius-card; box-shadow: $shadow-card; }
.order-summary { @include text-caption; font-size: 24rpx; }
.order-summary text { display: block; padding: 6rpx 0; }

.rating-card__title { @include text-card-title; font-size: 30rpx; font-weight: $font-weight-heavy; margin-bottom: 20rpx; }
.star-row { display: flex; gap: 12rpx; }
.star { font-size: 60rpx; color: $color-border; transition: color 0.2s ease; }
.star--active { color: #FFB800; }
.rating-text { margin-top: 12rpx; @include text-body-strong; font-size: 26rpx; color: $color-text-main; }

.tag-card__title { @include text-card-title; font-size: 30rpx; font-weight: $font-weight-heavy; margin-bottom: 20rpx; }
.tag-list { display: flex; flex-wrap: wrap; gap: 16rpx; }
.tag-item { padding: 14rpx 24rpx; background: $color-bg-light; border: 1rpx solid $color-border; border-radius: $radius-pill; font-size: 26rpx; }
.tag-item--active { color: $color-primary; background: $color-primary-light; border-color: $color-primary; }

.comment-card__title { @include text-card-title; font-size: 30rpx; font-weight: $font-weight-heavy; margin-bottom: 20rpx; }
textarea { width: 100%; height: 200rpx; padding: 16rpx; border: 1rpx solid $color-border; border-radius: 16rpx; font-size: 26rpx; line-height: 1.6; }
.counter { margin-top: 8rpx; text-align: right; font-size: 22rpx; color: $color-text-light; }

.bottom-actions { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 20rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.98); border-top: 1rpx solid $color-border-light; }
.ghost-btn, .primary-btn { @include flex-center; flex: 1; height: 88rpx; margin: 0; border-radius: $radius-pill; font-size: 30rpx; font-weight: $font-weight-bold; }
.ghost-btn { color: $color-text-main; background: #fff; border: 1rpx solid $color-border; }
.primary-btn { color: #fff; background: $gradient-primary; border: none; }
</style>
