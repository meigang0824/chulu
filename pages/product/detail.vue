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
          <view class="price-row__main">
            <text class="price">￥{{ money(product.price) }}</text>
            <text v-if="product.originPrice" class="origin">￥{{ money(product.originPrice) }}</text>
            <view class="limit">{{ limitText }}</view>
          </view>
          <view class="detail-stepper">
            <view
              class="detail-stepper__btn"
              :class="{ 'detail-stepper__btn--disabled': count <= 1 }"
              @tap.stop="decreaseCount"
            >−</view>
            <view class="detail-stepper__value">{{ count }}</view>
            <view
              class="detail-stepper__btn"
              :class="{ 'detail-stepper__btn--disabled': count >= stepperMax }"
              @tap.stop="increaseCount"
            >+</view>
          </view>
        </view>

        <view v-if="specText" class="spec-line">
          <text>规格</text>
          <view>{{ specText }}</view>
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
            <view class="activity__avatar">
              <image v-if="item.avatar" :src="item.avatar" mode="aspectFill" />
              <text v-else>{{ item.avatarText || '甜' }}</text>
            </view>
            <view>
              <view><text>{{ item.customer }}</text> {{ item.text }}</view>
              <view>{{ product.name }}</view>
            </view>
          </view>
        </view>
      </view>

    </template>

    <view class="bottom-bar">
      <button class="share" open-type="share">
        <AppIcon name="wechat" :size="34" color="#18BF61" />
        <text>分享</text>
      </button>
      <button class="cart-action" @tap="addToCart">加入购物车</button>
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
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import { getBuyerActivities, getProductById } from '@/services/dataService'
import { subscribeOrderReminder } from '@/utils/subscribeMessage'
import { requireLogin } from '@/utils/auth'
import { addCartItem, getCartItemCount, isFavorite, setFavorite } from '@/utils/shopState'
import { cloudImageHttpsUrl, IMAGE_ASSETS } from '@/utils/image'
import { money } from '@/utils/format'

export default {
  components: { CustomNavBar, SkeletonBlock, AppIcon },
  data() {
    return {
      product: {},
      productId: '',
      count: 1,
      activities: [],
      pageLoading: true,
      currentImageIndex: 0,
      isFavorited: false
    }
  },
  computed: {
    totalPrice() {
      return money(Number(this.product.price || 0) * Number(this.count || 0))
    },
    galleryCount() {
      return this.product.gallery ? this.product.gallery.length : 1
    },
    stepperMax() {
      if (Number(this.product && this.product.stock) <= 0) return 0
      const limit = Number(this.product && this.product.limit)
      return limit > 0 ? limit : 99
    },
    limitText() {
      const limit = Number(this.product && this.product.limit)
      return limit > 0 ? `单次最多 ${limit} 份` : '不限购'
    },
    specText() {
      const product = this.product || {}
      if (product.spec || product.specification) return String(product.spec || product.specification).trim()
      const specs = product.specs
      if (!Array.isArray(specs) || !specs.length) return ''
      return specs
        .map(item => {
          if (!item) return ''
          if (typeof item === 'string') return item
          const name = String(item.name || '').trim()
          const value = String(item.value || item.text || '').trim()
          return value || name
        })
        .filter(Boolean)
        .join(' / ')
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
      this.isFavorited = isFavorite(productId)
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
      path: `/pages/product/detail?id=${this.productId || ''}`,
      imageUrl: this.shareCoverImage()
    }
  },
  methods: {
    money,
    shareCoverImage() {
      const image = this.product.bannerImage || this.product.image || this.product.imageFileID || this.product.bannerImageFileID || ''
      if (String(image).startsWith('cloud://')) return cloudImageHttpsUrl(image) || image
      return image || cloudImageHttpsUrl(IMAGE_ASSETS.banner)
    },
    async loadProduct(id) {
      try {
        const product = await getProductById(id)
        const context = uni.getStorageSync(`buyer_product_context_${id}`) || {}
        if (!product) {
          uni.showToast({ title: '商品不存在', icon: 'none' })
          setTimeout(() => uni.navigateBack(), 600)
          return
        }
        this.product = {
          ...product,
          ...context,
          id: product.id || context.id,
          _id: product._id || context._id,
          productId: product.productId || context.productId || product.id
        }
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
    decreaseCount() {
      if (this.count <= 1) return
      this.count -= 1
    },
    increaseCount() {
      if (this.pageLoading || this.product.stock <= 0) {
        uni.showToast({ title: this.pageLoading ? '商品加载中' : '商品已售罄', icon: 'none' })
        return
      }
      if (this.count >= this.stepperMax) {
        uni.showToast({ title: '已到最大购买数量', icon: 'none' })
        return
      }
      this.count += 1
    },
    addToCart() {
      if (this.pageLoading || this.product.stock <= 0) {
        uni.showToast({ title: this.pageLoading ? '商品加载中' : '商品已售罄', icon: 'none' })
        return
      }
      addCartItem(this.product, this.count)
      const cartCount = getCartItemCount(this.product.id)
      uni.showToast({ title: `购物车已有 ${cartCount} 份`, icon: 'success' })
    },
    toggleFavorite() {
      this.isFavorited = !this.isFavorited
      setFavorite(this.product, this.isFavorited)
      if (this.isFavorited) {
        uni.showToast({ title: '已收藏', icon: 'success' })
      } else {
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
      uni.navigateTo({ url: `/pages/activity/list/index?productId=${this.productId}` })
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
  box-shadow: $shadow-card;
}
.gallery__image { display: block; width: 100%; height: 560rpx; }
.gallery__count {
  position: absolute; right: 22rpx; top: 22rpx;
  @include flex-center; width: 84rpx; height: 54rpx;
  color: #fff; background: $color-mask;
  border-radius: $radius-pill; font-size: 28rpx;
}

.panel {
  position: relative; margin: -34rpx 24rpx 0;
  padding: 36rpx 32rpx 30rpx; background: $color-card;
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

.price-row { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 24rpx; }
.price-row__main { flex: 1; min-width: 0; }
.price { color: $color-primary; font-size: 58rpx; font-weight: 800; }
.origin { margin-left: 18rpx; color: $color-text-light; font-size: 28rpx; text-decoration: line-through; }
.detail-stepper {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}
.detail-stepper__btn {
  @include flex-center;
  width: 56rpx;
  height: 56rpx;
  color: $color-primary;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1;
  background: #fff;
  border: 1rpx solid rgba(255, 92, 114, 0.22);
  border-radius: 50%;
  box-shadow: 0 8rpx 18rpx rgba(255, 92, 114, 0.1);
}
.detail-stepper__btn--disabled {
  color: $color-text-placeholder;
  background: $color-bg-deep;
  border-color: $color-border-light;
  box-shadow: none;
}
.detail-stepper__value {
  width: 52rpx;
  color: $color-text-main;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
}

.spec-line {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  color: $color-text-regular;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 26rpx;
}
.spec-line text { flex-shrink: 0; color: $color-text-light; }
.spec-line view { flex: 1; min-width: 0; color: $color-text-main; font-weight: $font-weight-semibold; @include text-ellipsis; }

.stats { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 24rpx; }
.stats view {
  flex: 1; min-width: 190rpx; @include flex-center; height: 64rpx;
  color: $color-primary; background: $color-primary-pale; border: 1rpx solid rgba(255, 92, 114, 0.12); border-radius: $radius-pill; font-size: 24rpx;
}
.stats view:first-child { color: $color-text-regular; }

.reminder-card {
  display: flex; align-items: center; gap: 18rpx;
  margin-top: 24rpx; padding: 22rpx 24rpx;
  background: $color-orange-light; border: 1rpx solid rgba(200, 121, 50, 0.18); border-radius: $radius-card;
}
.reminder-card__icon { font-size: 40rpx; }
.reminder-card__text { flex: 1; min-width: 0; }
.reminder-card__title { @include text-body-strong; font-size: 26rpx; color: $color-text-main; }
.reminder-card__desc { @include text-caption($color-text-regular); font-size: 22rpx; }
.reminder-card__arrow { color: $color-text-light; font-size: 40rpx; }

.activity { margin: 24rpx 24rpx 0; padding: 28rpx; }
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
  @include flex-center; flex-shrink: 0; width: 54rpx; height: 54rpx; margin-right: 12rpx; overflow: hidden;
  color: $color-primary; background: $color-primary-light; border-radius: 50%; font-size: 20rpx; font-weight: 700;
}
.activity__avatar image { width: 100%; height: 100%; }

.limit { margin-top: 10rpx; color: $color-text-light; font-size: 24rpx; }
.link { color: $color-text-light; font-size: 26rpx; }

.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  display: flex; align-items: center; gap: 22rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 253, 249, 0.98);
  border-top: 1rpx solid $color-border-light; box-shadow: $shadow-bottom;
}
.share {
  @include flex-center;
  flex-direction: column;
  width: 150rpx;
  height: 88rpx;
  margin: 0;
  padding: 0;
  color: #18BF61;
  background: #fff;
  border: 1rpx solid rgba(24, 191, 97, 0.35);
  border-radius: $radius-pill;
  font-size: 28rpx;
  font-weight: 800;
}
.share::after { border: 0; }
.share text { margin-top: 2rpx; font-size: 22rpx; line-height: 1; }
.cart-action {
  @include flex-center;
  flex: 0 0 190rpx;
  height: 88rpx;
  margin: 0;
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
  border-radius: $radius-pill;
  font-size: 28rpx;
  font-weight: 800;
}
.join {
  @include flex-center; flex: 1; min-width: 0; height: 88rpx;
  color: #fff; background: $gradient-primary; border-radius: $radius-pill;
  box-shadow: $shadow-btn;
  font-size: 30rpx; font-weight: 700;
}
.join--disabled { background: $color-text-light; box-shadow: none; }
</style>
