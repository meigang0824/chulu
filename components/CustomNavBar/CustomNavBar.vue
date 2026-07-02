<template>
  <view class="nav" :class="navClass" :style="navStyle">
    <view class="nav__inner" :style="innerStyle">
      <view v-if="showBack" class="nav__back" @tap="handleBack">‹</view>

      <!-- 搜索模式 -->
      <view v-if="isSearchMode" class="nav__search">
        <view class="nav__search-input" @tap="handleSearchTap">
          <text class="nav__search-icon">⌕</text>
          <text class="nav__search-placeholder">{{ searchPlaceholder }}</text>
        </view>
      </view>

      <!-- 品牌模式 -->
      <view v-else-if="isBrandMode" class="nav__brand" @tap="$emit('brandTap')">
        <image v-if="displayLogo" class="nav__logo" :src="displayLogo" mode="aspectFill" />
        <view class="nav__brand-text">
          <view class="nav__brand-name">{{ brand || title }}</view>
          <view v-if="slogan || subtitle" class="nav__slogan">{{ slogan || subtitle }}</view>
        </view>
      </view>

      <!-- 标题模式 -->
      <view v-else class="nav__title">{{ title }}</view>

      <view v-if="showCapsule" class="nav__capsule">
        <view class="nav__dots">•••</view>
        <view class="nav__split"></view>
        <view class="nav__circle"></view>
      </view>
    </view>
  </view>
</template>

<script>
import { resolveImageUrl } from '@/utils/image'

export default {
  name: 'CustomNavBar',
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    brand: { type: String, default: '' },
    slogan: { type: String, default: '' },
    logo: { type: String, default: 'cloud://cloudbase-d7gp8xx126047f577/icons/logo.png' },
    mode: { type: String, default: '' },
    background: { type: String, default: '' },
    showBack: { type: Boolean, default: false },
    fixed: { type: Boolean, default: false },
    showCapsule: { type: Boolean, default: false },
    searchPlaceholder: { type: String, default: '搜索商品名称、口味或食材' }
  },
  data() {
    return {
      statusBarHeight: 44,
      navBarHeight: 44,
      displayLogo: ''
    }
  },
  watch: {
    logo: {
      immediate: true,
      handler(value) {
        this.updateDisplayLogo(value)
      }
    }
  },
  computed: {
    isSearchMode() {
      return this.mode === 'search'
    },
    isBrandMode() {
      return this.mode === 'brand' || !!this.brand
    },
    navClass() {
      return {
        'nav--fixed': this.fixed,
        'nav--brand': this.isBrandMode,
        'nav--title': !this.isBrandMode && !this.isSearchMode,
        'nav--search': this.isSearchMode
      }
    },
    navStyle() {
      const background = this.background ? `background:${this.background};` : ''
      return `padding-top:${this.statusBarHeight}px;${background}`
    },
    innerStyle() {
      return `height:${this.navBarHeight}px;`
    }
  },
  created() {
    const info = uni.getSystemInfoSync()
    const isIOS = /ios/i.test(info.platform || '')
    const minTop = isIOS ? 44 : 32
    let statusBarHeight = info.statusBarHeight || minTop
    let navBarHeight = 44
    if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
      const menu = uni.getMenuButtonBoundingClientRect()
      if (menu && menu.top && menu.height) {
        if (!info.statusBarHeight) statusBarHeight = menu.top
        const gap = Math.max(menu.top - statusBarHeight, 4)
        navBarHeight = menu.height + gap * 2
      }
    }
    this.statusBarHeight = Math.max(statusBarHeight, minTop)
    this.navBarHeight = Math.max(navBarHeight, 44)
  },
  methods: {
    async updateDisplayLogo(value) {
      const source = value || ''
      this.displayLogo = source
      const resolved = await resolveImageUrl(source, '')
      if (this.logo === source) this.displayLogo = resolved
    },
    handleBack() {
      this.$emit('back')
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.switchTab({ url: '/pages/home/index' })
      }
    },
    handleSearchTap() {
      this.$emit('searchTap')
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.nav {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(255, 248, 239, 0.98);
  padding-top: 44px;
  padding-bottom: 10rpx;
}

.nav--fixed { position: fixed; left: 0; right: 0; }

.nav__inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: 0 28rpx;
}

.nav__back {
  position: absolute;
  left: 18rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 72rpx;
  height: 72rpx;
  color: $color-text-main;
  font-size: 64rpx;
  line-height: 58rpx;
  text-align: center;
}

.nav__search {
  position: absolute;
  left: 28rpx;
  right: 180rpx;
  top: 50%;
  transform: translateY(-50%);
}

.nav__search-input {
  display: flex;
  align-items: center;
  height: 68rpx;
  padding: 0 22rpx;
  background: rgba(255, 253, 249, 0.96);
  border: 1rpx solid $color-border;
  border-radius: $radius-pill;
  box-shadow: none;
}

.nav__search-icon {
  margin-right: 14rpx;
  color: $color-text-placeholder;
  font-size: 30rpx;
}

.nav__search-placeholder {
  color: $color-text-placeholder;
  font-size: 26rpx;
  @include text-ellipsis;
}

.nav__title {
  max-width: 360rpx;
  @include text-page-title;
  font-size: 38rpx;
  @include text-ellipsis;
}

.nav__brand {
  position: absolute;
  left: 28rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  max-width: 360rpx;
}

.nav__logo {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  margin-right: 18rpx;
  border-radius: 20rpx;
}

.nav__brand-text { min-width: 0; }

.nav__brand-name {
  @include text-page-title;
  font-size: 36rpx;
  font-weight: $font-weight-heavy;
  line-height: 1.15;
  @include text-ellipsis;
}

.nav__slogan {
  margin-top: 6rpx;
  @include text-helper($color-text-light);
  line-height: 1.2;
  @include text-ellipsis;
}

.nav__capsule {
  position: absolute;
  right: 28rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 152rpx;
  height: 68rpx;
  color: $color-text-main;
  background: rgba(255, 253, 249, 0.94);
  border: 1rpx solid $color-border;
  border-radius: $radius-pill;
  box-shadow: none;
}

.nav__dots {
  width: 72rpx;
  @include font-base;
  font-size: 26rpx;
  font-weight: $font-weight-heavy;
  letter-spacing: 4rpx;
  text-align: center;
}

.nav__split {
  width: 1rpx;
  height: 36rpx;
  background: #e5d6c8;
}

.nav__circle {
  width: 36rpx;
  height: 36rpx;
  margin-left: 20rpx;
  border: 5rpx solid #111;
  border-radius: 50%;
}
</style>
