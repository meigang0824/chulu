<template>
  <view class="page activity-page">
    <CustomNavBar title="团购记录" showBack />

    <view v-if="loading" class="record-list">
      <view v-for="index in 4" :key="index" class="record-card card">
        <view class="record-card__avatar record-card__avatar--loading"></view>
        <view class="record-card__body">
          <SkeletonBlock variant="list" :rows="2" />
        </view>
      </view>
    </view>

    <EmptyState
      v-else-if="!activities.length"
      title="还没有团购记录"
      desc="有人下单参团后，这里会展示最新动态。"
    />

    <view v-else class="record-list">
      <view v-for="item in activities" :key="item.id" class="record-card card" @tap="goProduct(item)">
        <view class="record-card__avatar">
          <image v-if="item.avatar" :src="item.avatar" mode="aspectFill" />
          <text v-else>{{ item.avatarText || '甜' }}</text>
        </view>
        <view class="record-card__body">
          <view class="record-card__title">
            <text>{{ item.customer }}</text>
            {{ item.text }}
          </view>
          <view class="record-card__product">{{ item.productName }}</view>
        </view>
        <view class="record-card__time">{{ item.timeText }}</view>
      </view>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import { getBuyerActivities } from '@/services/dataService'

export default {
  components: { CustomNavBar, EmptyState, SkeletonBlock },
  data() {
    return {
      loading: true,
      productId: '',
      activities: []
    }
  },
  onLoad(query) {
    this.productId = query.productId || ''
    this.loadActivities()
  },
  methods: {
    async loadActivities() {
      this.loading = true
      try {
        this.activities = await getBuyerActivities(this.productId, 100)
      } catch {
        this.activities = []
      } finally {
        this.loading = false
      }
    },
    goProduct(item) {
      if (!item.productId) return
      uni.navigateTo({ url: `/pages/product/detail?id=${item.productId}` })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.activity-page {
  padding-bottom: 80rpx;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}

.record-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
}

.record-card__avatar {
  @include flex-center;
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  overflow: hidden;
  color: #fff;
  background: $gradient-primary;
  border-radius: $radius-md;
  font-size: 30rpx;
  font-weight: 800;
}

.record-card__avatar image {
  width: 100%;
  height: 100%;
}

.record-card__avatar--loading {
  background: $color-bg-deep;
}

.record-card__body {
  flex: 1;
  min-width: 0;
}

.record-card__title {
  color: $color-text-main;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.4;
}

.record-card__title text {
  color: $color-primary;
}

.record-card__product {
  margin-top: 8rpx;
  color: $color-text-light;
  font-size: 24rpx;
  @include text-ellipsis;
}

.record-card__time {
  flex-shrink: 0;
  color: $color-text-light;
  font-size: 22rpx;
}
</style>
