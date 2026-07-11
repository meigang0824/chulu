<template>
  <view class="page home">
    <CustomNavBar mode="search" search-placeholder="搜索商品名称、口味或食材" @search-tap="goSearch" />

    <view class="hero">
      <view v-if="loading" class="hero__loading">
        <SkeletonBlock variant="hero" />
      </view>
      <view v-else class="hero__inner">
        <view class="hero__content">
          <view class="hero__tag">今日推荐</view>
        </view>

        <view class="hero__media">
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
              <view class="hero__slide" @tap="goBanner(banner)">
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

    <view class="home-section">
      <view class="group-section__head">
        <view class="group-section__main">
          <view class="group-section__title-row">
            <view class="section__title group-section__title">
              <text class="section__icon">🔥</text>
              <text>今日开团</text>
            </view>
            <view class="group-section__meta">
              <text>{{ groupSubtitle }}</text>
            </view>
          </view>
        </view>
        <view class="section__more group-section__more" @tap="goCategory">查看更多 〉</view>
      </view>
      <view v-if="loading" class="group-list">
        <view v-for="index in 2" :key="index" class="group-card card group-card--loading">
          <SkeletonBlock variant="list" :rows="4" />
        </view>
      </view>
      <EmptyState
        v-else-if="!groupSections.length"
        title="今日开团暂未上新"
        desc="店长正在准备中，稍后回来看看会更热闹。"
      />
      <view v-else class="group-list">
        <view v-for="group in groupSections" :key="group.id" class="group-card card">
          <view class="group-card__head">
            <view class="group-card__copy">
              <view class="group-card__title">{{ group.title }}</view>
              <view class="group-card__metrics">
                <view class="group-card__metric">
                  <text>{{ group.productCount }}</text>
                  <view>款商品</view>
                </view>
                <view class="group-card__metric group-card__metric--hot">
                  <text>{{ group.participantCount || 0 }}</text>
                  <view>人跟团</view>
                </view>
                <view v-if="group.deadline" class="group-card__deadline">
                  {{ group.deadline }}
                </view>
              </view>
            </view>
            <view class="group-card__actions">
              <button
                class="group-card__share"
                open-type="share"
                :data-group-id="group.id"
                :data-group-title="group.title"
              >
                <AppIcon name="wechat" :size="28" color="#FF5C72" />
                <text>分享</text>
              </button>
              <view class="section__more group-card__more" @tap="goCategory(group)">去跟团</view>
            </view>
          </view>
          <scroll-view class="product-list-scroll" scroll-x show-scrollbar="false">
            <view class="product-strip">
              <ProductCard
                v-for="item in group.products"
                :key="item.id"
                class="home-product-card"
                :product="item"
                variant="home-grid"
                action-text="去跟团"
                :show-deadline="false"
                :show-desc="false"
                @tap="goDetail"
                @join="goDetail"
              />
              <view class="product-more-card" @tap="goCategory(group)">
                <view>查看更多</view>
                <text>本团商品</text>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
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
          <view class="activity__avatar">
            <image v-if="item.avatar" :src="item.avatar" mode="aspectFill" />
            <text v-else>{{ item.avatarText || '甜' }}</text>
          </view>
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
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import { getActiveBanners, getBannerConfig } from '@/utils/bannerConfig'
import { getHomeData, getShopConfig, shouldAutoEnterAdmin } from '@/services/dataService'
import { cloudImageHttpsUrl, IMAGE_ASSETS } from '@/utils/image'

export default {
  components: { CustomNavBar, ProductCard, EmptyState, SkeletonBlock, BuyerTabBar, AppIcon },
  data() {
    return {
      products: [],
      groups: [],
      activities: [],
      activeProductCount: 0,
      currentGroupId: '',
      currentGroupTitle: '',
      loading: true,
      bannerConfig: getBannerConfig(),
      bannerIndex: 0,
      shop: {}
    }
  },
  computed: {
    featuredProducts() {
      return this.products
    },
    groupSections() {
      return (this.groups || []).map((group, index) => {
        const products = Array.isArray(group.products) ? group.products : []
        return {
          ...group,
          id: group.id || group._id || `group_${index}`,
          title: group.title || group.name || `团购 ${index + 1}`,
          products,
          productCount: Number(group.productCount || products.length || 0),
          participantCount: Number(group.participantCount || 0)
        }
      }).filter(group => group.productCount > 0)
    },
    groupSubtitle() {
      if (this.groupSections.length) return `${this.groupSections.length} 个团正在进行 · ${this.activeProductCount} 款商品`
      return '新鲜出炉，限时团购'
    },
    activeBanners() {
      return getActiveBanners(this.bannerConfig)
    },
    currentBanner() {
      return this.activeBanners[this.bannerIndex] || this.activeBanners[0] || {}
    },
    bannerSettings() {
      return this.bannerConfig.settings
    }
  },
  onShow() {
    this.checkAdminPortal()
    const hasVisibleData = this.products.length || this.groups.length || this.activities.length
    this.loading = !hasVisibleData
    this.bannerConfig = getBannerConfig()
    if (this.bannerIndex >= this.activeBanners.length) this.bannerIndex = 0
    this.loadHomeData({ silent: hasVisibleData })
    this.loadShop()
  },
  onShareAppMessage(options = {}) {
    const dataset = options.target && options.target.dataset ? options.target.dataset : {}
    const groupId = dataset.groupId || this.currentGroupId
    const groupTitle = dataset.groupTitle || this.currentGroupTitle
    if (groupId) {
      return {
        title: groupTitle ? `${groupTitle} · 初炉新鲜烘焙` : '初炉今日团购 · 一起买更划算',
        path: `/pages/category/index?groupId=${groupId}`,
        imageUrl: this.shareCoverImage()
      }
    }
    return {
      title: '初炉新鲜烘焙 · 每日新鲜出炉',
      path: '/pages/home/index',
      imageUrl: this.shareCoverImage()
    }
  },
  methods: {
    shareCoverImage() {
      const product = (this.products && this.products[0]) || {}
      const banner = this.currentBanner || {}
      const image = product.bannerImage || product.image || banner.image || banner.imageFileID || ''
      if (String(image).startsWith('cloud://')) return cloudImageHttpsUrl(image) || image
      return image || cloudImageHttpsUrl(IMAGE_ASSETS.banner)
    },
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
    async loadHomeData(options = {}) {
      const silent = options.silent === true
      if (!silent) this.loading = true
      try {
        const data = await getHomeData()
        this.products = data.products || []
        this.groups = data.groups || []
        this.activities = data.activities || []
        this.activeProductCount = data.activeProductCount !== undefined ? data.activeProductCount : this.products.length
        this.currentGroupId = data.groupId || ''
        this.currentGroupTitle = data.groupTitle || ''
        if (data.banners && data.bannerSettings) {
          this.bannerConfig = {
            settings: data.bannerSettings,
            banners: data.banners
          }
        }
      } catch {
        if (!silent) {
          this.products = []
          this.groups = []
          this.activities = []
          this.activeProductCount = 0
          this.currentGroupId = ''
          this.currentGroupTitle = ''
        }
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
      const id = product && (product.productId || product.id || product._id)
      if (!id) return
      uni.setStorageSync(`buyer_product_context_${id}`, product)
      if (product.id && product.id !== id) uni.setStorageSync(`buyer_product_context_${product.id}`, product)
      uni.navigateTo({ url: `/pages/product/detail?id=${id}` })
    },
    handleBannerChange(event) {
      this.bannerIndex = event.detail.current || 0
    },
    setBanner(index) {
      this.bannerIndex = index
    },
    goBanner(banner) {
      const route = banner && banner.route
      if (!route) {
        uni.removeStorageSync('buyer_selected_group_id')
        uni.switchTab({ url: '/pages/category/index' })
        return
      }
      if (route.indexOf('/pages/category/index') === 0 || route.indexOf('pages/category/index') === 0) {
        const match = String(route).match(/[?&]groupId=([^&]+)/)
        const groupId = match && match[1] ? decodeURIComponent(match[1]) : ''
        if (groupId) uni.setStorageSync('buyer_selected_group_id', groupId)
        else uni.removeStorageSync('buyer_selected_group_id')
        uni.switchTab({ url: '/pages/category/index' })
        return
      }
      uni.navigateTo({ url: route })
    },
    goSearch() {
      uni.removeStorageSync('buyer_selected_group_id')
      uni.switchTab({ url: '/pages/category/index' })
    },
    goCategory(group = null) {
      const groupId = group && (group.id || group._id || group.groupId)
      if (groupId) {
        uni.setStorageSync('buyer_selected_group_id', groupId)
      } else {
        uni.removeStorageSync('buyer_selected_group_id')
      }
      uni.switchTab({ url: '/pages/category/index' })
    },
    showAllActivity() {
      uni.navigateTo({ url: '/pages/activity/list/index' })
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
  height: 348rpx;
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
  width: 46%;
  height: 100%;
  background: linear-gradient(90deg, rgba(75, 36, 23, 0.48) 0%, rgba(75, 36, 23, 0.18) 60%, rgba(75, 36, 23, 0) 100%);
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
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
  box-sizing: border-box;
  width: 100%;
  padding: 28rpx 30rpx;
  pointer-events: none;
}

.hero__tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  box-sizing: border-box;
  height: 46rpx;
  padding: 0 20rpx;
  color: #fff;
  background: rgba(75, 36, 23, 0.42);
  border: 1rpx solid rgba(255, 255, 255, 0.38);
  border-radius: $radius-pill;
  @include font-base;
  font-size: 22rpx;
  font-weight: $font-weight-semibold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  padding: 0;
  background: transparent;
}

.section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.group-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 0 6rpx;
  margin-bottom: 16rpx;
}

.group-section__main {
  flex: 1;
  min-width: 0;
}

.group-section__title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.section__title {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
  @include text-page-title;
  font-size: 34rpx;
  font-weight: $font-weight-heavy;
}

.group-section__title {
  align-items: center;
  font-size: 32rpx;
  line-height: 1;
}

.section__icon {
  display: none;
  font-size: 28rpx;
  line-height: 1;
}

.section__title text {
  line-height: 1;
}

.group-section__meta {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex: 0 1 auto;
  min-width: 0;
  color: $color-text-light;
  font-size: 22rpx;
  line-height: 1;
  white-space: nowrap;
}

.group-section__meta > text:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section__more {
  flex-shrink: 0;
  color: $color-text-light;
  font-size: 24rpx;
  white-space: nowrap;
}

.group-section__more {
  display: flex;
  align-items: center;
  height: 42rpx;
  color: $color-text-regular;
  font-size: 22rpx;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.group-card {
  padding: 22rpx 18rpx 18rpx;
  background: $color-card;
  overflow: hidden;
}

.group-card--loading {
  min-height: 220rpx;
}

.group-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.group-card__copy {
  flex: 1;
  min-width: 0;
}

.group-card__title {
  color: $color-text-main;
  font-size: 30rpx;
  line-height: 1.25;
  font-weight: $font-weight-heavy;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-card__metrics {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8rpx;
  margin-top: 12rpx;
  color: $color-text-light;
  font-size: 22rpx;
  line-height: 1.2;
  min-width: 0;
}

.group-card__metric {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 4rpx;
  height: 42rpx;
  padding: 0 10rpx;
  color: $color-text-regular;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
}

.group-card__metric text {
  color: $color-text-main;
  font-size: 26rpx;
  font-weight: $font-weight-heavy;
  line-height: 1;
}

.group-card__metric view {
  font-size: 20rpx;
  line-height: 1;
}

.group-card__metric--hot {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255, 92, 114, 0.16);
}

.group-card__metric--hot text {
  color: $color-primary;
}

.group-card__metrics text + text {
  color: $color-text-regular;
  font-weight: $font-weight-semibold;
}

.group-card__deadline {
  min-width: 0;
  max-width: 220rpx;
  flex: 0 1 auto;
  height: 42rpx;
  padding: 0 12rpx;
  color: $color-primary !important;
  background: $color-primary-light;
  border-radius: $radius-pill;
  font-weight: $font-weight-semibold;
  line-height: 42rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-card__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.group-card__share {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  width: 118rpx;
  height: 42rpx;
  margin: 0;
  padding: 0;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(255, 92, 114, 0.22);
  border-radius: $radius-pill;
  font-size: 22rpx;
  font-weight: $font-weight-semibold;
  line-height: 42rpx;
}

.group-card__share::after {
  border: 0;
}

.group-card__more {
  display: flex;
  align-items: center;
  height: 42rpx;
  padding: 0 14rpx;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: $radius-pill;
  font-size: 22rpx;
  font-weight: $font-weight-semibold;
}

.section__badge {
  display: inline-flex;
  align-items: center;
  height: 46rpx;
  padding: 0 18rpx;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(255, 92, 114, 0.18);
  border-radius: $radius-pill;
  @include text-caption($color-primary);
  font-size: 22rpx;
  font-weight: $font-weight-semibold;
}

.section__subtitle {
  flex-shrink: 1;
  min-width: 0;
  @include text-body($font-weight-regular, $color-text-light);
  font-size: 22rpx;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-list-scroll {
  width: 100%;
  margin-top: 20rpx;
  white-space: nowrap;
}

.product-strip {
  display: inline-flex;
  gap: 14rpx;
  padding: 0 2rpx 6rpx;
}

.home-product-card {
  flex: 0 0 auto;
  width: 214rpx;
  border-radius: 18rpx;
  box-shadow: 0 8rpx 22rpx rgba(94, 58, 43, 0.08);
}

.home-product-card ::v-deep .product-card__image {
  height: 150rpx;
}

.home-product-card ::v-deep .product-card__body {
  padding: 12rpx 10rpx 12rpx;
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
  margin-top: 6rpx;
}

.home-product-card ::v-deep .product-card__price {
  font-size: 30rpx;
}

.home-product-card ::v-deep .product-card__origin {
  margin-left: 6rpx;
  font-size: 16rpx;
}

.home-product-card ::v-deep .product-card__meta {
  display: none;
}

.home-product-card ::v-deep .product-card__btn {
  height: 48rpx;
  margin-top: 8rpx;
  font-size: 21rpx;
  box-shadow: 0 8rpx 18rpx rgba(255, 92, 114, 0.18);
}

.product-more-card {
  flex: 0 0 auto;
  width: 150rpx;
  min-height: 292rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(255, 92, 114, 0.18);
  border-radius: $radius-card;
  box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.58);
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
  overflow: hidden;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: $radius-md;
  @include font-base;
  font-size: 22rpx;
  font-weight: $font-weight-bold;
}

.activity__avatar image {
  width: 100%;
  height: 100%;
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
