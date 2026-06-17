<template>
  <view class="detail">
    <CustomNavBar title="商品详情" showBack />

    <!-- 加载中骨架屏 -->
    <view v-if="pageLoading" class="skeleton-wrap">
      <view class="skeleton-gallery"><SkeletonBlock variant="hero" /></view>
      <view class="skeleton-panel card">
        <SkeletonBlock variant="card" :rows="6" />
      </view>
      <view class="skeleton-section card">
        <SkeletonBlock variant="list" :rows="4" />
      </view>
      <view class="skeleton-section card">
        <SkeletonBlock variant="list" :rows="2" />
      </view>
    </view>

    <!-- 数据加载完成 -->
    <template v-else>
      <view class="gallery">
        <image class="gallery__image" :src="product.bannerImage || product.image" mode="aspectFill" lazy-load />
        <StatusTag class="gallery__tag" type="normal" :text="product.deliveryLabel || product.tag" size="lg" />
        <view class="gallery__count">{{ currentImageIndex + 1 }}/{{ galleryCount }}</view>
      </view>

      <view class="panel">
        <view class="panel__top">
          <view>
            <view class="name">{{ product.name }}</view>
            <view class="desc">{{ product.desc }}</view>
          </view>
          <view class="favorite" :class="{ 'is-favorited': isFavorited }" @tap="toggleFavorite">
            <view>{{ isFavorited ? '♥' : '♡' }}</view>
            <text>收藏</text>
          </view>
        </view>

        <view class="price-row">
          <text class="price">￥{{ product.price }}</text>
          <text v-if="product.originPrice" class="origin">￥{{ product.originPrice }}</text>
        </view>

        <view class="stats">
          <view>已售 {{ product.sold || 0 }} 份</view>
          <view>仅剩 {{ product.stock || 0 }} 份</view>
          <view v-if="product.deadline">{{ product.deadline }}</view>
        </view>

        <!-- 拼团进度条 -->
        <view v-if="product.groupCount && product.groupTarget" class="group-progress">
          <view class="group-progress__head">
            <text class="group-progress__label">拼团进度</text>
            <text class="group-progress__value">{{ product.groupCount }}/{{ product.groupTarget }}人已参团</text>
          </view>
          <view class="group-progress__bar">
            <view class="group-progress__fill" :style="{ width: groupPercent + '%' }"></view>
          </view>
          <text v-if="product.groupTarget - product.groupCount > 0" class="group-progress__hint">还差 {{ product.groupTarget - product.groupCount }} 人成团，快分享给朋友吧～</text>
          <text v-else class="group-progress__hint group-progress__hint--done">🎉 已成团！</text>
        </view>

        <!-- 截单提醒 -->
        <view v-if="product.deadline" class="reminder-card" @tap="subscribeReminder">
          <view class="reminder-card__icon">⏰</view>
          <view class="reminder-card__text">
            <view class="reminder-card__title">{{ product.deadline }}</view>
            <text class="reminder-card__desc">点击开启截单提醒，不怕错过</text>
          </view>
          <view class="reminder-card__arrow">›</view>
        </view>

        <view class="delivery-card">
          <view class="delivery-card__icon">▣</view>
          <view class="delivery-card__title">{{ product.deliveryLabel || product.tag }}</view>
          <view class="delivery-card__text">配送范围：{{ product.deliveryRange }}</view>
          <view class="delivery-card__arrow">›</view>
        </view>

        <view class="info-card">
          <view class="info-card__label">
            <view>储存方式</view>
            <view>口感描述</view>
          </view>
          <view class="info-card__content">
            <view>{{ product.storage || '-' }}</view>
            <view>{{ product.taste || '-' }}</view>
          </view>
        </view>
      </view>

      <!-- 图文详情 -->
      <view v-if="product.detailContent && product.detailContent.length" class="detail-content card">
        <view class="detail-content__title">商品详情</view>
        <view v-for="(item, idx) in product.detailContent" :key="idx" class="detail-content__item">
          <text v-if="item.type === 'text'" class="detail-content__text">{{ item.content }}</text>
          <image v-else-if="item.type === 'image'" :src="item.content" mode="widthFix" class="detail-content__image" lazy-load />
        </view>
      </view>

      <view class="activity card">
        <view class="section__head">
          <view class="section__title">大家都在团</view>
          <view class="link" @tap="showAllActivity">查看全部 〉</view>
        </view>
        <view v-if="!activities.length" class="activity-empty">
          <text>暂无拼团动态，成为第一个下单的人吧～</text>
        </view>
        <view v-else class="activity__list">
          <view class="activity__item" v-for="item in activities" :key="item.id">
            <view class="activity__avatar">{{ avatarMap[item.avatar] || '甜' }}</view>
            <view>
              <view><text>{{ item.customer }}</text> {{ item.text }}</view>
              <view>{{ product.name }}</view>
            </view>
          </view>
        </view>
      </view>

      <view class="buy-card card" v-if="!pageLoading">
        <view>
          <view class="buy-title">购买数量</view>
          <view class="limit">限购 {{ product.limit || 5 }} 份</view>
        </view>
        <QuantityStepper v-model="count" :max="stepperMax" :disabled="product.stock <= 0" />
      </view>
    </template>

    <view class="bottom-bar">
      <button class="share" open-type="share">⇧<text>分享</text></button>
      <button class="join" :class="{ 'join--disabled': pageLoading || product.stock <= 0 }" :disabled="pageLoading || product.stock <= 0" @tap="goConfirm">
        <block v-if="pageLoading">加载中...</block>
        <block v-else-if="product.stock > 0">立即参团 ￥{{ totalPrice }}</block>
        <block v-else>已售罄</block>
      </button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import QuantityStepper from '@/components/QuantityStepper/QuantityStepper.vue'
import StatusTag from '@/components/StatusTag/StatusTag.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import { getBuyerActivities, getProductById } from '@/services/dataService'
import { subscribeOrderReminder } from '@/utils/subscribeMessage'
import { requireLogin } from '@/utils/auth'

const FAVORITE_KEY = 'chulu_favorite_'

export default {
  components: { CustomNavBar, QuantityStepper, StatusTag, SkeletonBlock },
  data() {
    return {
      product: {},
      productId: '',
      count: 1,
      activities: [],
      pageLoading: true,
      currentImageIndex: 0,
      avatarMap: { bear: '熊', rabbit: '兔', girl: '莉' },
      isFavorited: false
    }
  },
  computed: {
    totalPrice() {
      return (this.product.price * this.count).toFixed(1)
    },
    galleryCount() {
      return this.product.gallery ? this.product.gallery.length : 1
    },
    stepperMax() {
      const limit = this.product.limit || 5
      const stock = this.product.stock || 0
      return Math.min(limit, stock)
    },
    groupPercent() {
      const target = this.product.groupTarget || 0
      if (!target) return 0
      return Math.min(100, Math.round((this.product.groupCount || 0) / target * 100))
    }
  },
  async onLoad(query) {
    this.pageLoading = true
    // H5模式下从$route.query获取参数
    const productId = query.id || (this.$route && this.$route.query && this.$route.query.id)
    if (productId) {
      this.productId = productId
      this.isFavorited = !!uni.getStorageSync(FAVORITE_KEY + productId)
      try {
        await this.loadProduct(productId)
        this.activities = await getBuyerActivities(productId)
      } catch (error) {
        console.error('加载商品失败:', error)
        uni.showToast({ title: '商品加载失败', icon: 'none' })
      }
    } else {
      uni.showToast({ title: '商品ID不能为空', icon: 'none' })
    }
    this.pageLoading = false
  },
  async onShow() {
    // 只在首次加载且商品数据为空时加载，避免覆盖用户操作
    if (this.productId && !this.product.id && !this.pageLoading) {
      try {
        const product = await getProductById(this.productId)
        if (product) this.product = product
      } catch {}
    }
  },
  onShareAppMessage() {
    return {
      title: this.product.name || '初炉新鲜烘焙',
      path: `/pages/product/detail?id=${this.productId || ''}`
    }
  },
  methods: {
    async loadProduct(id) {
      try {
        const product = await getProductById(id)
        if (!product) {
          uni.showToast({ title: '商品不存在', icon: 'none' })
          setTimeout(() => uni.navigateBack(), 600)
          return
        }
        this.product = product
      } catch (error) {
        console.error('获取商品失败:', error)
        uni.showToast({ title: '网络异常，请检查连接', icon: 'none' })
        throw error
      }
    },
    goConfirm() {
      if (this.pageLoading || this.product.stock <= 0) {
        uni.showToast({ title: this.pageLoading ? '商品加载中' : '商品已售罄', icon: 'none' })
        return
      }
      if (!requireLogin('请先登录后再参与团购')) return
      uni.navigateTo({ url: `/pages/order/confirm/index?id=${this.product.id}&count=${this.count}` })
    },
    toggleFavorite() {
      const key = FAVORITE_KEY + this.productId
      this.isFavorited = !this.isFavorited
      if (this.isFavorited) {
        uni.setStorageSync(key, true)
        uni.showToast({ title: '已收藏', icon: 'success' })
      } else {
        uni.removeStorageSync(key)
        uni.showToast({ title: '已取消收藏', icon: 'none' })
      }
    },
    subscribeReminder() {
      subscribeOrderReminder().then(res => {
        if (res && res.ok) {
          uni.showToast({ title: res.message, icon: 'success' })
        }
      })
    },
    showAllActivity() {
      uni.switchTab({ url: '/pages/order/list/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.detail {
  min-height: 100vh;
  padding-bottom: 170rpx;
  background: $gradient-page;
}

.skeleton-wrap { padding: 0 24rpx; }
.skeleton-gallery { height: 560rpx; border-radius: $radius-xl; overflow: hidden; margin-bottom: 24rpx; }
.skeleton-panel { padding: 24rpx; }
.skeleton-section { padding: 24rpx; margin-top: 24rpx; }

.gallery {
  position: relative;
  margin: 0 24rpx;
  overflow: hidden;
  border-radius: $radius-xl;
}
.gallery__image { display: block; width: 100%; height: 560rpx; }
.gallery__tag { position: absolute; left: 22rpx; top: 22rpx; }
.gallery__count {
  position: absolute; right: 22rpx; top: 22rpx;
  @include flex-center; width: 84rpx; height: 54rpx;
  color: #fff; background: $color-mask;
  border-radius: $radius-md; font-size: 28rpx;
}

.panel {
  position: relative; margin: -34rpx 24rpx 0;
  padding: 36rpx 32rpx 30rpx; background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-xl; box-shadow: $shadow-card;
}
.panel__top { display: flex; justify-content: space-between; gap: 24rpx; }
.name { color: $color-text-main; font-size: 44rpx; font-weight: 800; line-height: 1.2; }
.desc { margin-top: 12rpx; color: $color-text-regular; font-size: 28rpx; line-height: 1.45; }

.favorite {
  flex-shrink: 0; width: 88rpx; text-align: center;
  color: $color-text-light; font-size: 24rpx;
  transition: color 0.2s ease;
}
.favorite.is-favorited { color: $color-primary; }
.favorite view { font-size: 52rpx; line-height: 1; }

.price-row { display: flex; align-items: baseline; margin-top: 24rpx; }
.price { color: $color-primary; font-size: 58rpx; font-weight: 800; }
.origin { margin-left: 18rpx; color: $color-text-light; font-size: 28rpx; text-decoration: line-through; }

.stats { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 24rpx; }
.stats view {
  flex: 1; min-width: 190rpx; @include flex-center; height: 64rpx;
  color: $color-primary; background: $color-primary-pale; border: 1rpx solid rgba(232, 79, 95, 0.12); border-radius: $radius-md; font-size: 24rpx;
}
.stats view:first-child { color: $color-text-regular; }

.reminder-card {
  display: flex; align-items: center; gap: 18rpx;
  margin-top: 24rpx; padding: 22rpx 24rpx;
  background: $color-orange-light; border: 1rpx solid #f1ddc6; border-radius: $radius-card;
}
.reminder-card__icon { font-size: 40rpx; }
.reminder-card__text { flex: 1; min-width: 0; }
.reminder-card__title { @include text-body-strong; font-size: 26rpx; color: $color-text-main; }
.reminder-card__desc { @include text-caption($color-text-regular); font-size: 22rpx; }
.reminder-card__arrow { color: $color-text-light; font-size: 40rpx; }

.delivery-card {
  display: flex; align-items: center; min-height: 76rpx; margin-top: 26rpx;
  padding: 0 22rpx; border: 1rpx solid $color-border; border-radius: $radius-card;
}
.delivery-card__icon, .delivery-card__title { flex-shrink: 0; color: $color-text-main; font-size: 28rpx; font-weight: 700; }
.delivery-card__icon { margin-right: 14rpx; color: $color-orange; }
.delivery-card__text { flex: 1; min-width: 0; margin-left: 24rpx; color: $color-text-regular; font-size: 24rpx; @include text-ellipsis; }
.delivery-card__arrow { color: $color-text-light; font-size: 40rpx; }

.info-card { display: flex; margin-top: 26rpx; overflow: hidden; border: 1rpx solid $color-border; border-radius: $radius-card; }
.info-card__label { flex-shrink: 0; width: 148rpx; background: $color-bg-light; color: $color-text-main; font-size: 26rpx; font-weight: 700; }
.info-card__label view, .info-card__content view { min-height: 78rpx; padding: 22rpx; border-bottom: 1rpx solid $color-border-light; }
.info-card__label view:last-child, .info-card__content view:last-child { border-bottom: none; }
.detail-content { padding: 24rpx; }
.detail-content__title { @include text-card-title; font-size: 30rpx; font-weight: $font-weight-heavy; margin-bottom: 20rpx; }
.detail-content__item { margin-bottom: 20rpx; }
.detail-content__text { @include text-body; font-size: 26rpx; line-height: 1.7; color: $color-text-regular; }
.detail-content__image { width: 100%; border-radius: 16rpx; margin: 8rpx 0; }

.info-card__content { flex: 1; min-width: 0; color: $color-text-regular; font-size: 25rpx; line-height: 1.45; }

.activity, .buy-card { margin: 24rpx 24rpx 0; padding: 28rpx; }
.activity-empty { margin-top: 16rpx; @include text-caption($color-text-light); text-align: center; padding: 16rpx 0; }
.activity__list { display: flex; flex-direction: column; gap: 18rpx; margin-top: 22rpx; }
.activity__item {
  flex: 1; min-width: 0; display: flex; align-items: center; padding: 16rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light; border-radius: $radius-card;
  color: $color-text-regular; font-size: 22rpx; line-height: 1.45;
}
.activity__item view:last-child { min-width: 0; }
.activity__item view:last-child view { @include text-ellipsis; }
.activity__item text { color: $color-text-main; font-weight: 700; }
.activity__avatar {
  @include flex-center; flex-shrink: 0; width: 54rpx; height: 54rpx; margin-right: 12rpx;
  color: $color-primary; background: $color-primary-light; border-radius: $radius-md; font-size: 20rpx; font-weight: 700;
}

.buy-card { display: flex; align-items: center; justify-content: space-between; }
.buy-title { color: $color-text-main; font-size: 34rpx; font-weight: 800; }
.limit { margin-top: 10rpx; color: $color-text-light; font-size: 24rpx; }
.link { color: $color-text-light; font-size: 26rpx; }

.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  display: flex; align-items: center; gap: 22rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid $color-border-light; box-shadow: $shadow-bottom;
}
.share {
  @include flex-center; flex-direction: column; width: 150rpx; height: 88rpx;
  color: $color-text-main; background: #fff; border: 1rpx solid $color-border;
  border-radius: $radius-md; font-size: 28rpx;
}
.share text { margin-top: 2rpx; font-size: 22rpx; }
.join {
  @include flex-center; flex: 1; min-width: 0; height: 88rpx;
  color: #fff; background: $color-primary; border-radius: $radius-md;
  font-size: 30rpx; font-weight: 700;
}
.join--disabled { background: $color-text-light; box-shadow: none; }
</style>
