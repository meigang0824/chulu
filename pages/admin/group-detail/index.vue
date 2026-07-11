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
          <view class="info-card__actions">
            <StatusTag :type="group.status === 'active' ? 'active' : 'completed'" :text="group.status === 'active' ? '进行中' : '已结束'" />
            <button class="info-card__edit" @tap="editGroup">编辑</button>
          </view>
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
                <text>￥{{ money(product.price) }}</text>
                <text>库存 {{ product.stock || product.totalStock || 0 }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 商品销售统计 -->
      <view class="sales-card card">
        <view class="card-title">商品销售统计</view>
        <view class="sales-summary">
          <view>
            <text>{{ salesSummary.soldCount }}</text>
            <view>已售份数</view>
          </view>
          <view>
            <text>￥{{ money(salesSummary.salesAmount) }}</text>
            <view>销售额</view>
          </view>
        </view>
        <view v-if="salesNotice" class="participant-notice">{{ salesNotice }}</view>
        <view v-if="!salesStats.length" class="empty-products">暂无销售数据</view>
        <view v-else class="sales-list">
          <view v-for="item in salesStats" :key="item.productId" class="sales-row">
            <view class="sales-row__main">
              <view class="sales-row__name">{{ item.name }}</view>
              <view class="sales-row__meta">库存 {{ item.stock || 0 }} · 单价 ￥{{ money(item.price) }}</view>
            </view>
            <view class="sales-row__stat">
              <text>{{ item.soldCount }}</text>
              <view>份</view>
            </view>
            <view class="sales-row__amount">￥{{ money(item.salesAmount) }}</view>
          </view>
        </view>
      </view>

      <!-- 参与用户（基于订单统计） -->
      <view class="participants-card card">
        <view class="card-title">参与用户 ({{ participantCount }}人)</view>
        <view v-if="participantNotice" class="participant-notice">{{ participantNotice }}</view>
        <view v-if="!participants.length" class="empty-participants">暂无参与用户</view>
        <view v-else class="participant-list">
          <view v-for="user in participants" :key="user.id" class="participant-item">
            <view class="participant-avatar">
              <image v-if="user.avatar" :src="user.avatar" mode="aspectFill" />
              <text v-else>{{ user.avatarText }}</text>
            </view>
            <view class="participant-info">
              <view class="participant-line">
                <view class="participant-name">{{ user.displayName }}</view>
                <StatusTag :type="user.paid ? 'paid' : 'normal'" :text="user.payText" size="sm" plain />
              </view>
              <view class="participant-order">{{ user.itemSummary }}</view>
              <view v-if="user.phone" class="participant-contact" @tap="callUser(user)">联系 {{ user.phone }}</view>
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

  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import { groupAPI } from '@/services/apiClient'
import { getAdminOrders, hydrateGroupImages } from '@/services/dataService'
import { ensurePageAccess, getAuthSession } from '@/utils/auth'
import { cloudImageHttpsUrl, IMAGE_ASSETS } from '@/utils/image'
import { formatDeadlineText, money } from '@/utils/format'
import { buildGroupParticipants, buildGroupProductSalesStats } from '@/utils/orderStats'

export default {
  components: { CustomNavBar, StatusTag, SkeletonBlock, EmptyState },
  data() {
    return {
      loading: true,
      group: null,
      products: [],
      salesStats: [],
      salesSummary: { soldCount: 0, salesAmount: 0 },
      salesNotice: '',
      participants: [],
      participantCount: 0,
      participantNotice: '',
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
  onShareAppMessage(options = {}) {
    const dataset = options.target && options.target.dataset ? options.target.dataset : {}
    const groupId = dataset.groupId || (this.group && this.group.id) || ''
    const groupTitle = dataset.groupTitle || (this.group && this.group.name) || '初炉新鲜烘焙团购'

    return {
      title: `${groupTitle} · 初炉新鲜烘焙`,
      path: groupId ? `/pages/category/index?groupId=${groupId}` : '/pages/home/index',
      imageUrl: this.shareCoverImage()
    }
  },
  methods: {
    money,
    shareCoverImage() {
      const product = (this.products && this.products[0]) || {}
      const image = product.bannerImage || product.image || product.imageFileID || product.bannerImageFileID || ''
      if (String(image).startsWith('cloud://')) return cloudImageHttpsUrl(image) || image
      return image || cloudImageHttpsUrl(IMAGE_ASSETS.banner)
    },
    authToken() {
      const session = getAuthSession()
      return session && session.token ? session.token : ''
    },
    async loadGroup(id) {
      this.loading = true
      try {
        // 加载团购详情
        const rawGroup = await groupAPI.get(id, this.authToken())
        const group = rawGroup ? await hydrateGroupImages(rawGroup) : null
        if (group) group.deadline = formatDeadlineText(group.deadlineAt, group.deadline || '')
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
        const groupId = String(this.group && (this.group.id || this.group._id || this.group.groupId) || '')
        const groupProductIds = this.groupProductIdSet()
        const exactOrders = orders.filter(order => this.orderHasGroupId(order, groupId))
        const groupOrders = exactOrders.length
          ? exactOrders
          : orders.filter(order => this.orderBelongsToGroup(order, groupId, groupProductIds))
        this.buildSalesStats(exactOrders.length ? exactOrders : orders, !exactOrders.length)
        this.participantNotice = exactOrders.length
          ? ''
          : (groupOrders.length ? '部分历史订单缺少团购编号，当前按关联商品估算参与用户。' : '')
        const { participants } = buildGroupParticipants({
          orders: groupOrders,
          groupId,
          productIds: groupProductIds,
          allowProductFallback: !exactOrders.length
        })
        this.participants = participants.slice(0, 20) // 最多显示20人
        this.participantCount = participants.length
      } catch (e) {
        console.error('加载参与用户失败:', e)
      }
    },
    buildSalesStats(orders = [], allowProductFallback = false) {
      const groupId = String(this.group && (this.group.id || this.group._id || this.group.groupId) || '')
      const stats = buildGroupProductSalesStats({
        products: this.products,
        orders,
        groupId,
        allowProductFallback
      })
      const soldCount = stats.reduce((sum, item) => sum + Number(item.soldCount || 0), 0)
      const salesAmount = stats.reduce((sum, item) => sum + Number(item.salesAmount || 0), 0)
      this.salesStats = stats
      this.salesSummary = { soldCount, salesAmount: Number(salesAmount.toFixed(2)) }
      this.salesNotice = allowProductFallback && soldCount
        ? '部分历史订单缺少团购编号，当前按关联商品估算销售统计。'
        : ''
    },
    groupProductIdSet() {
      const values = [
        ...(Array.isArray(this.group && this.group.productIds) ? this.group.productIds : []),
        ...(Array.isArray(this.products) ? this.products.flatMap(item => [item.productId, item.id, item._id]) : [])
      ]
      return new Set(values.filter(Boolean).map(item => String(item)))
    },
    orderBelongsToGroup(order, groupId, groupProductIds = new Set()) {
      if (!groupId) return false
      if (this.orderHasGroupId(order, groupId)) return true
      const items = Array.isArray(order.items) ? order.items : []
      return items.some(item => this.orderItemBelongsToGroup(item, groupId, groupProductIds))
    },
    orderHasGroupId(order, groupId) {
      if (String(order.groupId || order.group_id || order.groupID || '') === groupId) return true
      const items = Array.isArray(order.items) ? order.items : []
      return items.some(item => String(item.groupId || item.group_id || item.groupID || '') === groupId)
    },
    orderItemBelongsToGroup(item, groupId, groupProductIds = new Set()) {
      if (String(item.groupId || item.group_id || item.groupID || '') === groupId) return true
      const productId = String(item.productId || item.id || item._id || '')
      return productId && groupProductIds.has(productId)
    },
    callUser(user) {
      const phone = String(user.phone || '').replace(/[^\d]/g, '')
      if (!phone) {
        uni.showToast({ title: '暂无联系电话', icon: 'none' })
        return
      }
      uni.makePhoneCall({ phoneNumber: phone })
    },
    formatTime(time) {
      if (!time) return ''
      const d = new Date(time)
      if (Number.isNaN(d.getTime())) return ''
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
    goBack() {
      uni.navigateBack()
    },
    editGroup() {
      if (!this.group || !this.group.id) return
      uni.navigateTo({ url: `/pages/admin/create-group/index?id=${this.group.id}` })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.group-detail-page { padding-bottom: 80rpx; }

.loading-state { padding: 24rpx; }

.info-card { margin-top: 20rpx; padding: 24rpx; }
.info-card__head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.info-card__title { flex: 1; min-width: 0; font-size: 34rpx; font-weight: 800; color: $color-text-main; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.info-card__actions { flex-shrink: 0; display: flex; align-items: center; gap: 12rpx; }
.info-card__edit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 44rpx;
  margin: 0;
  padding: 0;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: $radius-pill;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 44rpx;
}
.info-card__edit::after { border: 0; }
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

.sales-card { margin-top: 20rpx; padding: 24rpx; }
.sales-summary { display:grid; grid-template-columns:repeat(2,1fr); gap:14rpx; margin-bottom:16rpx; }
.sales-summary > view { min-width:0; padding:18rpx; background:$color-primary-pale; border:1rpx solid rgba(255,92,114,.12); border-radius:16rpx; }
.sales-summary text { color:$color-primary; font-size:34rpx; font-weight:800; line-height:1; }
.sales-summary view view { margin-top:8rpx; color:$color-text-regular; font-size:22rpx; }
.sales-list { display:flex; flex-direction:column; gap:12rpx; }
.sales-row { display:flex; align-items:center; gap:14rpx; padding:14rpx; background:$color-bg-light; border-radius:16rpx; }
.sales-row__main { flex:1; min-width:0; }
.sales-row__name { color:$color-text-main; font-size:26rpx; font-weight:700; @include text-ellipsis; }
.sales-row__meta { margin-top:6rpx; color:$color-text-light; font-size:22rpx; @include text-ellipsis; }
.sales-row__stat { flex-shrink:0; width:86rpx; text-align:center; color:$color-text-light; font-size:20rpx; }
.sales-row__stat text { display:block; color:$color-primary; font-size:32rpx; font-weight:800; line-height:1; }
.sales-row__stat view { margin-top:4rpx; }
.sales-row__amount { flex-shrink:0; min-width:116rpx; color:$color-text-main; font-size:26rpx; font-weight:800; text-align:right; }

.participants-card { margin-top: 20rpx; padding: 24rpx; }
.participant-notice { margin-bottom:14rpx; padding:12rpx 16rpx; color:$color-text-regular; background:$color-orange-light; border:1rpx solid rgba(200,121,50,.16); border-radius:14rpx; font-size:22rpx; line-height:1.35; }
.participant-list { display: flex; flex-direction: column; gap: 12rpx; }
.participant-item { display: flex; align-items: center; gap: 16rpx; padding: 12rpx; background: $color-bg-light; border-radius: 16rpx; }
.participant-avatar { @include flex-center; flex-shrink:0; width:64rpx; height:64rpx; overflow:hidden; background:$color-primary-light; color:$color-primary; border-radius:50%; font-size:26rpx; font-weight:700; }
.participant-avatar image { width:100%; height:100%; }
.participant-info { flex: 1; min-width:0; }
.participant-line { display:flex; align-items:center; justify-content:space-between; gap:12rpx; }
.participant-name { flex:1; min-width:0; font-size:26rpx; font-weight:600; color:$color-text-main; @include text-ellipsis; }
.participant-order { margin-top:6rpx; font-size:22rpx; color:$color-text-regular; line-height:1.35; @include multi-ellipsis(2); }
.participant-contact { display:inline-flex; margin-top:8rpx; padding:6rpx 14rpx; color:$color-primary; background:$color-primary-light; border-radius:$radius-pill; font-size:22rpx; font-weight:700; }
</style>
