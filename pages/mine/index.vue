<template>
  <view class="page mine">
    <CustomNavBar title="我的" />

    <view class="profile card">
      <view class="profile__avatar" @tap="handleAvatarTap">
        <image v-if="userAvatar" class="profile__avatar-img" :src="userAvatar" mode="aspectFill" />
        <text v-else>{{ profileAvatar }}</text>
      </view>
      <view class="profile__info">
        <view>{{ profileName }}</view>
        <text>{{ identity.isGuest ? '登录后即可下单、管理地址和查看完整订单' : (identity.isLoggedIn ? '点击头像可更换头像' : '登录后可查看订单、地址和售后记录') }}</text>
      </view>
      <view class="profile__tag" :class="{ 'profile__tag--guest': identity.isGuest }" @tap="handleProfileAction">{{ identity.isGuest ? '登录/注册' : (identity.isLoggedIn ? shop.bakeryTag : '去登录') }}</view>
    </view>

    <view v-if="identity.isAdmin" class="mode-switch card">
      <view class="mode-switch__main">
        <view class="mode-switch__title">当前账号已开通店长权限</view>
        <view class="mode-switch__desc">选择默认进入的页面端口，下次打开小程序会按这里的模式进入。</view>
      </view>
      <view class="mode-switch__actions">
        <button class="mode-switch__btn" :class="{ 'mode-switch__btn--active': portalMode === 'buyer' }" @tap="switchPortal('buyer')">
          用户端
        </button>
        <button class="mode-switch__btn" :class="{ 'mode-switch__btn--active': portalMode === 'admin' }" @tap="switchPortal('admin')">
          店长端
        </button>
      </view>
    </view>

    <view class="order-entry card">
      <view class="order-entry__head">
        <view>我的订单</view>
        <text @tap="goOrders">全部订单 〉</text>
      </view>
      <view class="stats">
        <view v-for="item in stats" :key="item.label" @tap="goOrders">
        <text>{{ item.value }}</text>
        <view>{{ item.label }}</view>
        </view>
      </view>
    </view>

    <view class="menu card">
      <view class="menu__item" v-for="item in visibleMenus" :key="item.text" @tap="handleMenu(item)">
        <view class="menu__icon">
          <AppIcon :name="item.icon" :size="24" :color="'#FF5C72'" />
        </view>
        <text>{{ item.text }}</text>
        <view class="menu__arrow">›</view>
      </view>
    </view>

    <view class="shop-info card">
      <view class="shop-info__title">{{ shop.bakeryName }}</view>
      <view>配送范围：{{ shop.deliveryRange }}</view>
      <view>客服时间：{{ shop.customerService }}</view>
      <view>门店地址：{{ shop.address }}</view>
    </view>
    <BuyerTabBar active="mine" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import BuyerTabBar from '@/components/BuyerTabBar/BuyerTabBar.vue'
import { getBuyerProfileSummary, getPortalMode, getShopConfig, getUserIdentity, setPortalMode } from '@/services/dataService'
import { callFunction } from '@/services/apiClient'
import { getAuthToken, logoutAuth, requireLogin, updateAuthSessionUser } from '@/utils/auth'
import { resolveImageUrl, uploadImageToCloud } from '@/utils/image'

export default {
  components: { CustomNavBar, AppIcon, BuyerTabBar },
  data() {
    return {
      shop: {},
      identity: { isLoggedIn: false, isGuest: false, isAdmin: false, role: 'guest', user: null },
      portalMode: 'buyer',
      summary: {
        totalOrders: 0,
        pendingDelivery: 0,
        completed: 0
      },
      avatarDisplay: '',
      menus: [
        { icon: 'receipt', text: '我的订单', url: '/pages/order/list/index' },
        { icon: 'heart', text: '我的收藏', url: '/pages/favorite/index', type: 'navigateTo' },
        { icon: 'store', text: '店长入口', url: '/pages/admin/dashboard/index', type: 'navigateTo' },
        { icon: 'user', text: '登录/注册', url: '/pages/auth/login/index', type: 'navigateTo', guestOnly: true },
        { icon: 'phone', text: '联系客服' },
        { icon: 'location', text: '收货地址', url: '/pages/address/list/index', type: 'navigateTo', authRequired: true },
        { icon: 'info', text: '关于门店', url: '/pages/store/about/index', type: 'navigateTo' },
        { icon: 'logout', text: '退出登录', action: 'logout', authOnly: true }
      ]
    }
  },
  async onShow() {
    const [summary, shopConfig, identity] = await Promise.all([getBuyerProfileSummary(), getShopConfig(), getUserIdentity(true)])
    this.summary = summary
    this.shop = shopConfig
    this.identity = identity
    this.portalMode = getPortalMode()
    await this.resolveUserAvatar()
  },
  computed: {
    stats() {
      return [
        { label: '全部订单', value: this.summary.totalOrders },
        { label: '待配送', value: this.summary.pendingDelivery },
        { label: '已完成', value: this.summary.completed }
      ]
    },
    visibleMenus() {
      return this.menus.filter(item => {
        if (item.text === '店长入口') return this.identity.isLoggedIn && this.identity.isAdmin
        if (item.guestOnly) return !this.identity.isLoggedIn || this.identity.isGuest
        if (item.authOnly) return this.identity.isLoggedIn
        if (item.authRequired) return this.identity.isLoggedIn && !this.identity.isGuest
        return true
      })
    },
    profileName() {
      if (this.identity.isGuest) return '游客模式'
      return (this.identity.user && this.identity.user.displayName) || (this.identity.isLoggedIn ? '初炉用户' : '未登录用户')
    },
    profileAvatar() {
      if (this.identity.isGuest) return '游'
      return (this.identity.user && this.identity.user.avatarText) || (this.identity.isLoggedIn ? '甜' : '未')
    },
    userAvatar() {
      return this.avatarDisplay || (this.identity.user && this.identity.user.avatar) || null
    }
  },
  methods: {
    async resolveUserAvatar() {
      const avatar = this.identity.user && this.identity.user.avatar
      this.avatarDisplay = avatar ? await resolveImageUrl(avatar, avatar) : ''
    },
    handleAvatarTap() {
      if (!this.identity.isLoggedIn || this.identity.isGuest) {
        uni.navigateTo({ url: '/pages/auth/login/index' })
        return
      }
      uni.showActionSheet({
        itemList: ['选择图片', '拍照'],
        success: (res) => {
          const sourceType = res.tapIndex === 0 ? ['album'] : ['camera']
          uni.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType,
            success: async (res) => {
              const tempFilePath = res.tempFilePaths[0]
              if (!tempFilePath) return
              try {
                uni.showLoading({ title: '上传中' })
                const avatar = await uploadImageToCloud(tempFilePath, 'avatars')
                const result = await callFunction('businessApi', {
                  action: 'updateProfile',
                  payload: { avatar },
                  authToken: getAuthToken()
                })
                const user = result.user || { ...(this.identity.user || {}), avatar }
                updateAuthSessionUser(user)
                this.identity = { ...this.identity, user }
                await this.resolveUserAvatar()
                uni.hideLoading()
                uni.showToast({ title: '头像已更新', icon: 'success' })
              } catch (error) {
                uni.hideLoading()
                uni.showToast({ title: error.message || '头像上传失败', icon: 'none' })
              }
            }
          })
        }
      })
    },
    handleProfileAction() {
      if (!this.identity.isLoggedIn || this.identity.isGuest) {
        uni.navigateTo({ url: '/pages/auth/login/index' })
      }
    },
    switchPortal(mode) {
      this.portalMode = setPortalMode(mode)
      if (mode === 'admin') {
        if (!this.identity.isAdmin) {
          uni.navigateTo({ url: '/pages/auth/login/index?requiredRole=admin' })
          return
        }
        uni.navigateTo({ url: '/pages/admin/dashboard/index' })
      } else {
        uni.switchTab({ url: '/pages/home/index' })
      }
    },
    goOrders() {
      uni.switchTab({ url: '/pages/order/list/index' })
    },
    async handleMenu(item) {
      if (item.action === 'logout') {
        await logoutAuth()
        this.identity = { isLoggedIn: false, isGuest: false, isAdmin: false, role: 'guest', user: null }
        setPortalMode('buyer')
        uni.showToast({ title: '已退出登录', icon: 'none' })
        uni.switchTab({ url: '/pages/home/index' })
        return
      }
      if (item.authRequired && !requireLogin('该功能需要登录后使用')) {
        return
      }
      if (item.text === '店长入口') {
        if (!this.identity.isAdmin) {
          uni.navigateTo({ url: '/pages/auth/login/index?requiredRole=admin' })
          return
        }
        setPortalMode('admin')
        this.portalMode = 'admin'
        uni.navigateTo({ url: '/pages/admin/dashboard/index' })
      } else if (item.url) {
        if (item.type === 'navigateTo') {
          uni.navigateTo({ url: item.url })
        } else {
          uni.switchTab({ url: item.url })
        }
      } else if (item.text === '联系客服') {
        uni.makePhoneCall({ phoneNumber: this.shop.phone })
      } else {
        uni.showToast({ title: item.text, icon: 'none' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.mine {
  padding-bottom: 180rpx;
}

.profile {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding: 34rpx 30rpx;
  background: $gradient-cream;
}

.profile__avatar {
  @include flex-center;
  width: 96rpx;
  height: 96rpx;
  color: #fff;
  background: $gradient-primary;
  border-radius: 50%;
  @include font-base;
  font-size: 34rpx;
  font-weight: $font-weight-heavy;
  overflow: hidden;
}

.profile__avatar-img {
  width: 100%;
  height: 100%;
}

.profile__info {
  flex: 1;
  min-width: 0;
  margin-left: 22rpx;
}

.profile__info view {
  @include text-page-title;
  font-size: 38rpx;
  font-weight: $font-weight-heavy;
}

.profile__info text {
  display: block;
  margin-top: 10rpx;
  @include text-caption($color-text-light);
}

.profile__tag {
  padding: 8rpx 18rpx;
  color: $color-orange;
  background: $color-orange-light;
  border-radius: $radius-pill;
  @include text-caption($color-orange);
}

.profile__tag--guest {
  color: #fff;
  background: $gradient-primary;
  font-weight: 600;
}

.order-entry {
  margin-top: 24rpx;
  padding: 24rpx 0 26rpx;
}

.order-entry__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28rpx 20rpx;
  border-bottom: 1rpx solid $color-border-light;
}

.order-entry__head view {
  @include text-card-title;
  font-size: 30rpx;
}

.order-entry__head text {
  color: $color-text-light;
  font-size: 24rpx;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding-top: 24rpx;
  text-align: center;
}

.mode-switch {
  margin-top: 24rpx;
  padding: 26rpx 28rpx;
}

.mode-switch__title {
  @include text-card-title;
  font-size: 30rpx;
}

.mode-switch__desc {
  margin-top: 10rpx;
  @include text-caption($color-text-regular);
}

.mode-switch__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.mode-switch__btn {
  flex: 1;
  @include outline-button($color-text-main);
  height: 76rpx;
  font-size: 28rpx;
}

.mode-switch__btn--active {
  color: #fff;
  background: $gradient-primary;
  border-color: transparent;
  box-shadow: $shadow-btn;
  border-color: transparent;
  box-shadow: none;
}

.stats text {
  @include text-price(42rpx);
  font-weight: $font-weight-heavy;
}

.stats view view {
  margin-top: 8rpx;
  @include text-caption($color-text-regular);
}

.menu,
.shop-info {
  margin-top: 24rpx;
  padding: 8rpx 28rpx;
}

.menu__item {
  display: flex;
  align-items: center;
  min-height: 92rpx;
  border-bottom: 1rpx solid $color-border-light;
}

.menu__item:last-child {
  border-bottom: none;
}

.menu__icon {
  @include flex-center;
  width: 52rpx;
  height: 52rpx;
  margin-right: 18rpx;
  color: $color-primary;
  background: $color-primary-light;
  border-radius: 16rpx;
  @include font-base;
  font-size: 24rpx;
}

.menu__item text {
  flex: 1;
  @include text-body-strong;
  font-weight: $font-weight-semibold;
}

.menu__arrow {
  @include text-page-title;
  font-size: 42rpx;
  color: $color-text-light;
}

.shop-info {
  padding: 28rpx;
  @include text-body($font-weight-regular, $color-text-regular);
  font-size: 26rpx;
  line-height: 1.6;
}

.shop-info__title {
  margin-bottom: 12rpx;
  @include text-card-title;
  font-size: 32rpx;
  font-weight: $font-weight-heavy;
}
</style>
