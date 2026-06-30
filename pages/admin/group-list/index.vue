<template>
  <view class="page group-list">
    <CustomNavBar title="团购管理" showBack />

    <view class="stats-bar">
      <view class="stat-item">
        <text class="stat-num">{{ groups.length }}</text>
        <text class="stat-label">全部团</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ activeGroups }}</text>
        <text class="stat-label">进行中</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ endedGroups }}</text>
        <text class="stat-label">已结束</text>
      </view>
    </view>

    <view class="filter-bar">
      <view class="filter-item" :class="{ active: filter === 'all' }" @tap="filter = 'all'">全部</view>
      <view class="filter-item" :class="{ active: filter === 'active' }" @tap="filter = 'active'">进行中</view>
      <view class="filter-item" :class="{ active: filter === 'ended' }" @tap="filter = 'ended'">已结束</view>
    </view>

    <view v-if="loading" class="loading-state">
      <SkeletonBlock height="160" />
      <SkeletonBlock height="160" />
    </view>

    <view v-else-if="filteredGroups.length" class="group-list__content">
      <view v-for="group in filteredGroups" :key="group.id" class="group-card card">
        <view class="group-card__header">
          <view class="group-card__title">{{ group.name }}</view>
          <StatusTag :type="group.status === 'active' ? 'active' : 'completed'" :text="group.status === 'active' ? '进行中' : '已结束'" />
        </view>
        <view class="group-card__meta">
          <text>{{ (group.products && group.products.length) || 0 }} 款商品</text>
          <text>{{ group.deadline || '已截单' }}</text>
          <text>{{ formatTime(group.createdAt) }}</text>
        </view>
        <view class="group-card__products">
          <view v-for="p in (group.products || []).slice(0, 3)" :key="p.id" class="product-mini">
            <image :src="p.image || productFallback" mode="aspectFill" />
            <text>{{ p.name }}</text>
          </view>
          <view v-if="(group.products || []).length > 3" class="product-more">
            还有 {{ (group.products || []).length - 3 }} 款商品
          </view>
        </view>
        <view class="group-card__actions">
          <button class="ghost-btn" @tap="viewGroup(group)">详情</button>
          <button class="ghost-btn ghost-btn--edit" @tap="editGroup(group)">编辑</button>
          <button v-if="group.status === 'active'" class="ghost-btn danger" @tap="endGroup(group)">结束</button>
          <button class="ghost-btn ghost-btn--muted" @tap="deleteGroup(group)">删除</button>
        </view>
      </view>
    </view>

    <EmptyState
      v-else
      title="还没有团购记录"
      desc="发布团购后，在这里管理所有团购活动。"
      action-text="发布团购"
      @action="goCreate"
    />

    <view class="bottom-action">
      <button @tap="goCreate">发布新团购</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import { ensurePageAccess, getAuthSession } from '@/utils/auth'
import { groupAPI } from '@/services/apiClient'
import { IMAGE_ASSETS } from '@/utils/image'
import { hydrateGroupImages } from '@/services/dataService'

export default {
  components: { CustomNavBar, StatusTag, SkeletonBlock, EmptyState },
  data() {
    return {
      loading: true,
      groups: [],
      filter: 'all',
      productFallback: IMAGE_ASSETS.product
    }
  },
  computed: {
    filteredGroups() {
      if (this.filter === 'all') return this.groups
      return this.groups.filter(g => g.status === this.filter)
    },
    activeGroups() {
      return this.groups.filter(g => g.status === 'active').length
    },
    endedGroups() {
      return this.groups.filter(g => g.status !== 'active').length
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/group-list/index', '需要店长权限')) return
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/group-list/index', '需要店长权限')) return
    this.loadGroups()
  },
  methods: {
    authToken() {
      const session = getAuthSession()
      return session && session.token ? session.token : ''
    },
    async loadGroups() {
      this.loading = true
      try {
        const groups = await groupAPI.list({}, this.authToken())
        this.groups = await Promise.all((groups || []).map(hydrateGroupImages))
      } catch (e) {
        console.error('加载团购失败:', e)
        this.groups = []
      }
      this.loading = false
    },
    formatTime(time) {
      if (!time) return ''
      const d = new Date(time)
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    },
    viewGroup(group) {
      uni.navigateTo({ url: `/pages/admin/group-detail/index?id=${group.id}` })
    },
    editGroup(group) {
      uni.navigateTo({ url: `/pages/admin/create-group/index?id=${group.id}` })
    },
    endGroup(group) {
      uni.showModal({
        title: '结束团购',
        content: `确认结束团购"${group.name}"吗？结束后用户将无法继续下单。`,
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            await groupAPI.updateStatus(group.id, 'ended', this.authToken())
            uni.showToast({ title: '团购已结束', icon: 'success' })
            this.loadGroups()
          } catch (e) {
            uni.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      })
    },
    deleteGroup(group) {
      uni.showModal({
        title: '删除团购',
        content: `确认删除团购"${group.name}"吗？此操作不可恢复。`,
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            await groupAPI.delete(group.id, this.authToken())
            uni.showToast({ title: '已删除', icon: 'success' })
            this.loadGroups()
          } catch (e) {
            uni.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      })
    },
    goCreate() {
      uni.navigateTo({ url: '/pages/admin/create-group/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.group-list { padding-bottom: 200rpx; }

.stats-bar {
  display: flex;
  gap: 24rpx;
  margin-top: 18rpx;
  padding: 24rpx;
  background: $color-card;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
}
.stat-item {
  flex: 1;
  text-align: center;
}
.stat-num {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  color: $color-text-main;
}
.stat-label {
  font-size: 22rpx;
  color: $color-text-light;
}

.filter-bar {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx;
}
.filter-item {
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  color: $color-text-regular;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
}
.filter-item.active {
  color: $color-primary;
  border-color: rgba(255,92,114,.20);
  background: $color-primary-light;
}

.group-list__content { padding: 0 24rpx; }
.group-card { margin-top: 20rpx; padding: 26rpx; }
.group-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}
.group-card__title {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 800;
  color: $color-text-main;
  line-height: 1.35;
  @include text-ellipsis;
}
.group-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 18rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $color-text-light;
}
.group-card__products {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
  padding: 14rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: 18rpx;
}
.product-mini {
  display: flex;
  align-items: center;
  gap: 14rpx;
  width: 100%;
  min-width: 0;
}
.product-mini image {
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 14rpx;
  background: $color-bg-deep;
}
.product-mini text {
  flex: 1;
  min-width: 0;
  color: $color-text-main;
  font-size: 24rpx;
  line-height: 1.35;
  font-weight: 700;
  @include text-ellipsis;
}
.product-more {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 48rpx;
  padding: 0 14rpx;
  background: #fff;
  border: 1rpx dashed $color-border;
  border-radius: $radius-pill;
  font-size: 22rpx;
  color: $color-text-regular;
}
.group-card__actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 22rpx;
}
.group-card__actions button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 0;
  height: 68rpx;
  margin: 0;
  padding: 0;
  border-radius: $radius-pill;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
}
.group-card__actions button::after {
  border: 0;
}
.group-card__actions .ghost-btn {
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
}
.group-card__actions .ghost-btn--edit {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255, 92, 114, 0.22);
}
.group-card__actions .ghost-btn.danger {
  color: $color-danger;
  background: #fff7f7;
  border-color: rgba(232, 79, 95, 0.34);
}
.group-card__actions .ghost-btn--muted {
  color: $color-text-regular;
}

.bottom-action {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255,255,255,0.98);
  border-top: 1rpx solid $color-border-light;
  box-shadow: $shadow-bottom;
}
.bottom-action button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 88rpx;
  margin: 0;
  padding: 0;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1;
  text-align: center;
}
.bottom-action button::after {
  border: 0;
}
</style>
