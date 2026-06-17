<template>
  <view class="page group-detail-page">
    <CustomNavBar title="团购详情" showBack />

    <view v-if="loading" class="loading-state">
      <SkeletonBlock variant="card" :rows="6" />
    </view>

    <template v-else-if="group">
      <!-- 团购基本信息 -->
      <view class="info-card card">
        <view class="info-card__head">
          <view class="info-card__title">{{ group.name }}</view>
          <StatusTag :type="group.status === 'active' ? 'active' : 'completed'" :text="group.status === 'active' ? '进行中' : '已结束'" />
        </view>
        <view class="info-card__meta">
          <view class="meta-item">
            <text class="meta-label">截单时间</text>
            <text class="meta-value">{{ group.deadline || '未设置' }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">创建时间</text>
            <text class="meta-value">{{ formatTime(group.createdAt) }}</text>
          </view>
        </view>
      </view>

      <!-- 关联商品 -->
      <view class="products-card card">
        <view class="card-title">关联商品 ({{ products.length }}款)</view>
        <view v-if="!products.length" class="empty-products">暂无关联商品</view>
        <view v-else class="product-list">
          <view v-for="product in products" :key="product.id" class="product-item">
            <image class="product-item__image" :src="product.image || productFallback" mode="aspectFill" lazy-load />
            <view class="product-item__info">
              <view class="product-item__name">{{ product.name }}</view>
              <view class="product-item__meta">
                <text>￥{{ product.price }}</text>
                <text>库存 {{ product.stock || product.totalStock || 0 }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 参与用户（基于订单统计） -->
      <view class="participants-card card">
        <view class="card-title">参与用户 ({{ participantCount }}人)</view>
        <view v-if="!participants.length" class="empty-participants">暂无参与用户</view>
        <view v-else class="participant-list">
          <view v-for="user in participants" :key="user.id" class="participant-item">
            <view class="participant-avatar">{{ user.avatarText }}</view>
            <view class="participant-info">
              <view class="participant-name">{{ user.displayName }}</view>
              <view class="participant-order">订单 {{ user.orderCount }} 笔</view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <EmptyState
      v-else
      title="团购不存在"
      desc="该团购可能已被删除或过期。"
      action-text="返回团购列表"
      @action="goBack"
    />

    <AdminTabBar active="create" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { groupAPI } from '@/services/apiClient'
import { getAdminOrders, hydrateGroupImages } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'
import { IMAGE_ASSETS } from '@/utils/image'

export default {
  components: { CustomNavBar, StatusTag, SkeletonBlock, EmptyState, AdminTabBar },
  data() {
    return {
      loading: true,
      group: null,
      products: [],
      participants: [],
      participantCount: 0,
      productFallback: IMAGE_ASSETS.product
    }
  },
  onLoad(query) {
    if (!ensurePageAccess('/pages/admin/group-detail/index', '需要店长权限')) return
    if (query.id) {
      this.loadGroup(query.id)
    } else {
      uni.showToast({ title: '团购ID不能为空', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 600)
    }
  },
  methods: {
    async loadGroup(id) {
      this.loading = true
      try {
        // 加载团购详情
        const rawGroup = await groupAPI.get(id)
        const group = rawGroup ? await hydrateGroupImages(rawGroup) : null
        this.group = group
        // 解析关联商品
        if (group && group.products) {
          this.products = Array.isArray(group.products) ? group.products : []
        }
        // 加载参与用户统计
        await this.loadParticipants()
      } catch (e) {
        console.error('加载团购详情失败:', e)
        this.group = null
      }
      this.loading = false
    },
    async loadParticipants() {
      try {
        const orders = await getAdminOrders('all')
        // 按用户统计订单数
        const userMap = {}
        orders.forEach(order => {
          const key = order._openid || order.customer
          if (!userMap[key]) {
            userMap[key] = {
              id: key,
              displayName: order.customer || order.receiver || '匿名用户',
              avatarText: (order.customer || order.receiver || '用').slice(0, 1),
              orderCount: 0
            }
          }
          userMap[key].orderCount++
        })
        const participants = Object.values(userMap).sort((a, b) => b.orderCount - a.orderCount)
        this.participants = participants.slice(0, 20) // 最多显示20人
        this.participantCount = participants.length
      } catch (e) {
        console.error('加载参与用户失败:', e)
      }
    },
    formatTime(time) {
      if (!time) return ''
      const d = new Date(time)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.group-detail-page { padding-bottom: 200rpx; }

.loading-state { padding: 24rpx; }

.info-card { margin-top: 20rpx; padding: 24rpx; }
.info-card__head { display: flex; align-items: center; justify-content: space-between; }
.info-card__title { font-size: 34rpx; font-weight: 800; color: $color-text-main; }
.info-card__meta { display: flex; gap: 40rpx; margin-top: 20rpx; }
.meta-item { display: flex; flex-direction: column; }
.meta-label { font-size: 22rpx; color: $color-text-light; }
.meta-value { font-size: 26rpx; color: $color-text-main; font-weight: 600; margin-top: 4rpx; }

.products-card { margin-top: 20rpx; padding: 24rpx; }
.card-title { font-size: 30rpx; font-weight: 700; color: $color-text-main; margin-bottom: 16rpx; }
.empty-products, .empty-participants { padding: 30rpx; text-align: center; color: $color-text-light; font-size: 26rpx; background: $color-bg-light; border-radius: 16rpx; }
.product-list { display: flex; flex-direction: column; gap: 16rpx; }
.product-item { display: flex; gap: 16rpx; padding: 12rpx; background: $color-bg-light; border-radius: 16rpx; }
.product-item__image { width: 100rpx; height: 100rpx; border-radius: 12rpx; flex-shrink: 0; }
.product-item__info { flex: 1; min-width: 0; }
.product-item__name { font-size: 28rpx; font-weight: 600; color: $color-text-main; @include text-ellipsis; }
.product-item__meta { display: flex; gap: 20rpx; margin-top: 8rpx; font-size: 22rpx; color: $color-text-regular; }
.product-item__meta text:first-child { color: $color-primary; font-weight: 700; }

.participants-card { margin-top: 20rpx; padding: 24rpx; }
.participant-list { display: flex; flex-direction: column; gap: 12rpx; }
.participant-item { display: flex; align-items: center; gap: 16rpx; padding: 12rpx; background: $color-bg-light; border-radius: 16rpx; }
.participant-avatar { @include flex-center; width: 64rpx; height: 64rpx; background: $color-primary-light; color: $color-primary; border-radius: 50%; font-size: 26rpx; font-weight: 700; }
.participant-info { flex: 1; }
.participant-name { font-size: 26rpx; font-weight: 600; color: $color-text-main; }
.participant-order { font-size: 22rpx; color: $color-text-light; margin-top: 2rpx; }
</style>
