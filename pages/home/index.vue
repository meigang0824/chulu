<template>
  <view class="page home">
    <CustomNavBar mode="search" search-placeholder="搜索商品名称、口味或食材" @search-tap="goSearch" />

    <view class="hero">
      <view v-if="loading" class="hero__loading">
        <SkeletonBlock variant="hero" />
      </view>
      <view v-else class="hero__inner">
        <view class="hero__content">
          <view class="hero__tag">{{ heroContent.tag }}</view>
          <view class="hero__title">
            {{ heroContent.title }}
            <text>{{ heroContent.subtitle }}</text>
          </view>
          <view class="hero__features">
            <view v-for="item in heroFeatures" :key="item">{{ item }}</view>
          </view>
        </view>

        <view class="hero__media" @tap="goBanner(currentBanner)">
          <swiper
            class="hero__swiper"
            :autoplay="bannerSettings.autoplay"
            :circular="bannerSettings.circular"
            :interval="bannerSettings.interval"
            :duration="bannerSettings.duration"
            :current="bannerIndex"
            @change="handleBannerChange"
          >
            <swiper-item v-for="banner in activeBanners" :key="banner.id">
              <view class="hero__slide">
                <image class="hero__image" :src="banner.image" mode="aspectFill" lazy-load />
              </view>
            </swiper-item>
          </swiper>
        </view>
      </view>
      <view v-if="bannerSettings.showDots && activeBanners.length > 1" class="hero__dots">
        <text
          v-for="(banner, index) in activeBanners"
          :key="banner.id"
          :class="{ 'is-active': index === bannerIndex }"
          @tap="setBanner(index)"
        ></text>
      </view>
    </view>

    <view class="home-section card">
      <view class="section__head">
        <view class="section__title-wrap">
          <view class="section__title">
            <text class="section__icon">🔥</text>
            <text>今日开团</text>
          </view>
          <view class="section__subtitle">{{ groupSubtitle }}</view>
        </view>
        <view class="section__actions">
          <view class="section__badge">{{ groupBadge }}</view>
          <view class="section__more" @tap="goCategory">查看更多 〉</view>
        </view>
      </view>
      <view v-if="loading" class="product-list-scroll product-grid--loading">
        <view v-for="index in 3" :key="index" class="product-list-loading-item">
          <SkeletonBlock variant="list" :rows="4" />
        </view>
      </view>
      <EmptyState
        v-else-if="!featuredProducts.length"
        title="今日开团暂未上新"
        desc="店长正在准备中，稍后回来看看会更热闹。"
      />
      <scroll-view v-else class="product-list-scroll" scroll-x show-scrollbar="false">
        <view class="product-strip">
          <ProductCard
            v-for="item in featuredProducts"
            :key="item.id"
            class="home-product-card"
            :product="item"
            variant="home-grid"
            action-text="去参团"
            :show-deadline="true"
            :show-desc="false"
            @tap="goDetail"
            @join="goDetail"
          />
          <view class="product-more-card" @tap="goCategory">
            <view>查看更多</view>
            <text>全部商品</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="activity card">
      <view class="section__head">
        <view class="section__title">
          <text class="section__icon">💗</text>
          <text>大家都在团</text>
        </view>
        <view class="link" @tap="showAllActivity">查看全部 〉</view>
      </view>
      <view v-if="loading" class="activity__loading">
        <view v-for="index in 3" :key="index" class="activity__loading-item">
          <view class="activity__loading-avatar"></view>
          <SkeletonBlock variant="list" :rows="2" />
        </view>
      </view>
      <EmptyState
        v-else-if="!activities.length"
        title="还没有拼团动态"
        desc="首批下单后，这里会实时展示大家的团购热度。"
      />
      <scroll-view v-else class="activity__scroll" scroll-x show-scrollbar="false">
        <view class="activity__list">
        <view class="activity__item" v-for="item in activities" :key="item.id">
          <view class="activity__avatar">{{ avatarMap[item.avatar] || '甜' }}</view>
          <view class="activity__text">
            <view><text>{{ item.customer }}</text> {{ item.text }}</view>
            <view>{{ item.productName }}</view>
          </view>
        </view>
        </view>
      </scroll-view>
    </view>

    <BuyerTabBar active="home" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import BuyerTabBar from '@/components/BuyerTabBar/BuyerTabBar.vue'
import { getActiveBanners, getBannerConfig } from '@/utils/bannerConfig'
import { getHomeData, getShopConfig, shouldAutoEnterAdmin } from '@/services/dataService'

export default {
  components: { CustomNavBar, ProductCard, EmptyState, SkeletonBlock, BuyerTabBar },
  data() {
    return {
      products: [],
      activities: [],
      activeProductCount: 0,
      loading: true,
      bannerConfig: getBannerConfig(),
      bannerIndex: 0,
      shop: {},
      avatarMap: { bear: '熊', rabbit: '兔', girl: '莉' }
    }
  },
  computed: {
    featuredProducts() {
      return this.products
    },
    groupSubtitle() {
      return this.activeProductCount ? `${this.activeProductCount} 款商品正在团购` : '新鲜出炉，限时团购'
    },
    groupBadge() {
      return '今晚22:00截单'
    },
    activeBanners() {
      return getActiveBanners(this.bannerConfig)
    },
    currentBanner() {
      return this.activeBanners[this.bannerIndex] || this.activeBanners[0] || {}
    },
    bannerSettings() {
      return this.bannerConfig.settings
    },
    heroContent() {
      const banner = this.currentBanner || {}
      return {
        tag: banner.tag || '新鲜烘焙 · 团购更划算',
        title: banner.title || '每日新鲜烘焙',
        subtitle: banner.highlight || banner.subtitle || '一起团 更甜蜜'
      }
    },
    heroFeatures() {
      const features = this.currentBanner && this.currentBanner.features
      return Array.isArray(features) && features.length ? features.slice(0, 4) : ['严选食材', '新鲜现做', '明日配送']
    }
  },
  onShow() {
    this.checkAdminPortal()
    this.loading = true
    this.bannerConfig = getBannerConfig()
    if (this.bannerIndex >= this.activeBanners.length) this.bannerIndex = 0
    this.loadHomeData()
    this.loadShop()
  },
  onShareAppMessage() {
    return {
      title: '初炉新鲜烘焙 · 每日新鲜出炉',
      path: '/pages/home/index'
    }
  },
  methods: {
    async checkAdminPortal() {
      try {
        const shouldEnter = await shouldAutoEnterAdmin()
        if (shouldEnter) {
          uni.redirectTo({ url: '/pages/admin/dashboard/index?mode=admin' })
        }
      } catch {}
    },
    async loadShop() {
      try {
        this.shop = await getShopConfig()
      } catch {
        this.shop = this.shop || {}
      }
    },
    async loadHomeData() {
      this.loading = true
      try {
        const data = await getHomeData()
        this.products = data.products || []
        this.activities = data.activities || []
        this.activeProductCount = data.activeProductCount || this.products.length
        if (data.banners && data.bannerSettings) {
          this.bannerConfig = {
            settings: data.bannerSettings,
            banners: data.banners
          }
        }
      } catch {
        this.products = []
        this.activities = []
        this.activeProductCount = 0
      } finally {
        this.loading = false
      }
    },
    applyHomeBannerConfig(data) {
      if (data && data.banners && data.bannerSettings) {
        this.bannerConfig = {
          settings: data.bannerSettings,
          banners: data.banners
        }
      }
    },
    goDetail(product) {
      uni.navigateTo({ url: `/pages/product/detail?id=${product.id}` })
    },
    handleBannerChange(event) {
      this.bannerIndex = event.detail.current || 0
    },
    setBanner(index) {
      this.bannerIndex = index
    },
    goBanner(banner) {
      if (!banner.route) return
      uni.navigateTo({ url: banner.route })
    },
    goSearch() {
      uni.switchTab({ url: '/pages/category/index' })
    },
    goCategory() {
      uni.switchTab({ url: '/pages/category/index' })
    },
    showAllActivity() {
      uni.switchTab({ url: '/pages/category/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.home {
  padding-bottom: 180rpx;
}

.hero {
  position: relative;
  height: 338rpx;
  margin-top: 18rpx;
  overflow: hidden;
  background: $gradient-hero;
  border-radius: $radius-xl;
  border: 1rpx solid $color-border-light;
  box-shadow: $shadow-card;
}

.hero::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  width: 68%;
  height: 100%;
  background: linear-gradient(90deg, rgba(24, 22, 20, 0.68) 0%, rgba(24, 22, 20, 0.38) 58%, rgba(24, 22, 20, 0) 100%);
  pointer-events: none;
}

.hero__loading {
  padding: 54rpx 36rpx;
}

.hero__inner {
  position: relative;
  width: 100%;
  height: 100%;
}

.hero__content {
  position: relative;
  z-index: 3;
  box-sizing: border-box;
  width: 54%;
  height: 100%;
  padding: 38rpx 26rpx 30rpx 30rpx;
}

.hero__tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  box-sizing: border-box;
  height: 40rpx;
  padding: 0 18rpx;
  color: #fff;
  background: rgba(255, 255, 255, 0.18);
  border: 1rpx solid rgba(255, 255, 255, 0.26);
  border-radius: 8rpx;
  @include font-base;
  font-size: 20rpx;
  font-weight: $font-weight-semibold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero__title {
  margin-top: 18rpx;
  @include text-display;
  color: #fff;
  font-size: 34rpx;
  line-height: 1.18;
  font-weight: $font-weight-heavy;
  word-break: break-all;
}

.hero__title text {
  display: block;
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.92);
  font-size: 28rpx;
  line-height: 1.18;
  @include text-ellipsis;
}

.hero__features {
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  margin-top: 16rpx;
  padding: 8rpx 6rpx;
  background: rgba(255, 255, 255, 0.16);
  border: 1rpx solid rgba(255, 255, 255, 0.24);
  border-radius: $radius-md;
}

.hero__features view {
  @include flex-center;
  flex: 1;
  min-width: 0;
  height: 34rpx;
  padding: 0 6rpx;
  color: #fff;
  font-size: 18rpx;
  font-weight: $font-weight-medium;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero__features view + view {
  margin-left: 0;
  border-left: 1rpx solid rgba(255, 255, 255, 0.26);
}

.hero__media {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: $radius-xl;
  background: $color-bg-deep;
}

.hero__swiper,
.hero__slide {
  width: 100%;
  height: 100%;
}

.hero__slide {
  @include flex-center;
  padding: 0;
}

.hero__image {
  width: 100%;
  height: 100%;
}

.hero__dots {
  position: absolute;
  left: 50%;
  bottom: 14rpx;
  z-index: 4;
  display: flex;
  gap: 12rpx;
  transform: translateX(-50%);
}

.hero__dots text {
  width: 22rpx;
  height: 8rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: $radius-pill;
  transition: width 0.2s ease, background 0.2s ease;
}

.hero__dots text.is-active {
  width: 32rpx;
  background: $color-primary;
}

.home-section {
  margin-top: 20rpx;
  padding: 26rpx 16rpx 24rpx;
  background: $color-card;
}

.section__title {
  display: flex;
  align-items: center;
  gap: 16rpx;
  @include text-page-title;
  font-size: 34rpx;
  font-weight: $font-weight-heavy;
}

.section__icon {
  display: none;
  font-size: 28rpx;
  line-height: 1;
}

.section__title text {
  line-height: 1;
}

.section__title-wrap {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
  min-width: 0;
}

.section__badge {
  display: flex;
  align-items: center;
  height: 46rpx;
  padding: 0 18rpx;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(232, 79, 95, 0.16);
  border-radius: $radius-md;
  @include text-caption($color-primary);
  font-size: 22rpx;
  font-weight: $font-weight-semibold;
}

.section__actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.section__more {
  color: $color-text-light;
  font-size: 24rpx;
  white-space: nowrap;
}

.section__subtitle {
  flex-shrink: 0;
  @include text-body($font-weight-regular, $color-text-light);
  font-size: 22rpx;
  line-height: 1.2;
}

.product-list-scroll {
  width: 100%;
  margin-top: 20rpx;
  white-space: nowrap;
}

.product-strip {
  display: inline-flex;
  gap: 18rpx;
  padding: 0 2rpx 4rpx;
}

.home-product-card {
  flex: 0 0 auto;
  width: 214rpx;
}

.home-product-card ::v-deep .product-card__image {
  height: 150rpx;
}

.home-product-card ::v-deep .product-card__body {
  padding: 10rpx 10rpx 12rpx;
}

.home-product-card ::v-deep .product-card__name {
  display: block;
  min-height: 28rpx;
  font-size: 22rpx;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: initial;
}

.home-product-card ::v-deep .product-card__desc {
  display: none;
}

.home-product-card ::v-deep .product-card__price-row {
  margin-top: 4rpx;
}

.home-product-card ::v-deep .product-card__price {
  font-size: 28rpx;
}

.home-product-card ::v-deep .product-card__origin {
  margin-left: 6rpx;
  font-size: 16rpx;
}

.home-product-card ::v-deep .product-card__meta {
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  margin-top: 2rpx;
  font-size: 16rpx;
  line-height: 1.2;
}

.home-product-card ::v-deep .product-card__meta text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-product-card ::v-deep .product-card__deadline {
  height: 34rpx;
  min-height: 34rpx;
  margin-top: 6rpx;
  padding: 0 6rpx;
  font-size: 15rpx;
}

.home-product-card ::v-deep .product-card__btn {
  height: 42rpx;
  margin-top: 6rpx;
  font-size: 20rpx;
}

.product-more-card {
  flex: 0 0 auto;
  width: 150rpx;
  min-height: 312rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(232, 79, 95, 0.16);
  border-radius: $radius-card;
  font-size: 26rpx;
  font-weight: 700;
}

.product-more-card text {
  margin-top: 10rpx;
  color: $color-text-light;
  font-size: 22rpx;
  font-weight: 400;
}

.product-skeleton {
  min-height: 330rpx;
  padding: 22rpx;
  background: $color-bg-light;
  border-radius: $radius-card;
}

.product-list-loading-item {
  padding: 18rpx;
  margin-bottom: 16rpx;
  background: $color-bg-light;
  border-radius: $radius-card;
}

.activity,
.shop-card {
  margin-top: 24rpx;
  padding: 26rpx 20rpx;
  background: $color-card;
}

.link {
  @include text-body($font-weight-regular, $color-text-light);
  font-size: 26rpx;
}

.activity__list {
  display: inline-flex;
  flex-direction: row;
  gap: 16rpx;
  min-width: 100%;
}

.activity__scroll {
  margin-top: 22rpx;
  white-space: nowrap;
}

.activity__loading {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}

.activity__loading-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 86rpx;
  padding: 16rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
}

.activity__loading-avatar {
  width: 58rpx;
  height: 58rpx;
  flex-shrink: 0;
  background: #f8efe7;
  border-radius: 50%;
}

.activity__item {
  flex: 0 0 auto;
  min-width: 0;
  width: 238rpx;
  display: flex;
  align-items: center;
  padding: 16rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
}

.activity__avatar {
  @include flex-center;
  flex-shrink: 0;
  width: 54rpx;
  height: 54rpx;
  margin-right: 12rpx;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: $radius-md;
  @include font-base;
  font-size: 22rpx;
  font-weight: $font-weight-bold;
}

.activity__text {
  min-width: 0;
  flex: 1;
  @include text-helper($color-text-regular);
  line-height: 1.45;
}

.activity__text view {
  @include text-ellipsis;
}

.activity__text text {
  color: $color-text-main;
  font-weight: $font-weight-bold;
}

.shop-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.shop-card__store {
  @include flex-center;
  width: 112rpx;
  height: 112rpx;
  margin-right: 24rpx;
  color: $color-orange;
  background: linear-gradient(135deg, #fff9ef 0%, #ffeed8 100%);
  border-radius: 28rpx;
  @include font-base;
  font-size: 42rpx;
  font-weight: $font-weight-heavy;
}

.shop-card__main {
  flex: 1;
  min-width: 360rpx;
}

.shop-card__name {
  @include text-card-title;
  font-weight: $font-weight-heavy;
}

.shop-card__name text {
  margin-left: 14rpx;
  padding: 6rpx 16rpx;
  color: $color-orange;
  background: $color-orange-light;
  border-radius: $radius-pill;
  @include text-helper($color-orange);
}

.shop-card__line {
  margin-top: 12rpx;
  @include text-body($font-weight-regular, $color-text-regular);
  font-size: 26rpx;
}

.shop-card__side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10rpx 18rpx;
  width: 100%;
  margin-top: 20rpx;
  padding-top: 20rpx;
  padding-left: 0;
  border-top: 1rpx solid $color-border-light;
  border-left: none;
  @include text-body-strong;
  font-size: 26rpx;
  font-weight: $font-weight-bold;
}

.shop-card__side text {
  display: block;
  margin: 0;
  @include text-helper;
}

</style>
