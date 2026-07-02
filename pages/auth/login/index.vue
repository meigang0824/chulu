<template>
  <view class="login">
    <view class="login__bg">
      <image class="login__bg-top" :src="assets.bgTop" mode="widthFix" />
      <view class="login__bg-fill"></view>
      <image class="login__bg-bottom" :src="assets.bgBottom" mode="widthFix" />
    </view>
    <view class="top">
      <view class="nav-back" @tap="goBack"></view>
    </view>

    <view class="panel">
      <view class="panel__arch"></view>
      <image class="panel__icon" :src="assets.bread" mode="aspectFit" />
      <view class="panel__title">
        <image class="panel__title-leaf panel__title-leaf--left" :src="assets.heart" mode="aspectFit" />
        <text>欢迎回来</text>
        <image class="panel__title-leaf panel__title-leaf--right" :src="assets.heart" mode="aspectFit" />
      </view>
      <view class="panel__desc">选择登录方式，开启甜蜜之旅</view>

      <view v-if="errorText" class="error">{{ errorText }}</view>

      <!-- 微信一键登录 -->
      <button class="wechat-btn" :disabled="loading" @tap="handleWechatLogin">
        <image class="btn-icon" :src="assets.wechat" mode="aspectFit" />
        <text>微信一键登录</text>
      </button>

      <!-- 游客登录 -->
      <button class="guest-btn" :disabled="loading" @tap="handleGuestLogin">
        <image class="btn-icon" :src="assets.user" mode="aspectFit" />
        <text>游客登录</text>
      </button>

      <!-- 协议勾选 -->
      <view class="agreement">
        <view class="agreement__radio" :class="{ checked: agreed }" @tap.stop="agreed = !agreed"></view>
        <view class="agreement__text" @tap.stop="agreed = !agreed">
          我已阅读并同意
          <text class="agreement__link" @tap.stop="openAgreement('user')">《用户协议》</text>
          <text class="agreement__link" @tap.stop="openAgreement('privacy')">《隐私政策》</text>
        </view>
      </view>
    </view>

    <!-- 底部保障 -->
    <view class="assurance">
      <view class="assurance__item">
        <image class="assurance__icon" :src="assets.ingredients" mode="aspectFit" />
        <view>
          <view>严选食材</view>
          <text>品质安心</text>
        </view>
      </view>
      <view class="assurance__item">
        <image class="assurance__icon" :src="assets.fresh" mode="aspectFit" />
        <view>
          <view>新鲜现做</view>
          <text>当日制作</text>
        </view>
      </view>
      <view class="assurance__item">
        <image class="assurance__icon" :src="assets.delivery" mode="aspectFit" />
        <view>
          <view>明日配送</view>
          <text>准时送达</text>
        </view>
      </view>
    </view>

    <view v-if="profileDialogVisible" class="profile-dialog-mask">
      <view class="profile-dialog">
        <view class="profile-dialog__title">完善微信资料</view>
        <view class="profile-dialog__desc">选择头像和昵称后继续登录</view>
        <button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
          <image v-if="profileAvatarPreview" class="avatar-picker__image" :src="profileAvatarPreview" mode="aspectFill" />
          <text v-else>选择头像</text>
        </button>
        <input
          v-model="profileName"
          class="nickname-input"
          type="nickname"
          placeholder="选择或填写微信昵称"
          placeholder-class="nickname-input__placeholder"
        />
        <view class="profile-dialog__actions">
          <button class="profile-dialog__cancel" :disabled="loading" @tap="closeProfileDialog">取消</button>
          <button class="profile-dialog__confirm" :disabled="loading" @tap="confirmWechatProfile">
            {{ loading ? '登录中...' : '确认登录' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getRoleHome, isAdminRole, loginWithWechat, redirectLoggedInFromLogin, loginAsGuest, updateAuthSessionUser } from '@/utils/auth'
import { setPortalMode } from '@/services/dataService'
import { cloudImage, resolveImageUrl, uploadImageToCloud } from '@/utils/image'
import { callFunction } from '@/services/apiClient'
import { normalizeCloudError } from '@/utils/apiError'

export default {
  data() {
    return {
      redirect: '',
      requiredRole: '',
      loading: false,
      errorText: '',
      agreed: false,
      profileDialogVisible: false,
      profileName: '',
      profileAvatarPreview: '',
      profileAvatarTemp: '',
      pendingWechatSession: null,
      assets: {
        bgTop: cloudImage('login/login_bg_top.jpg'),
        bgBottom: cloudImage('login/login_bg_bottom.jpg'),
        bread: cloudImage('login/icon_bread.svg'),
        delivery: cloudImage('login/feature_delivery.jpg'),
        fresh: cloudImage('login/feature_fresh.jpg'),
        heart: cloudImage('login/icon_heart.svg'),
        ingredients: cloudImage('login/feature_ingredients.jpg'),
        user: cloudImage('login/icon_user.svg'),
        wechat: cloudImage('login/icon_wechat.png')
      }
    }
  },
  onLoad(query) {
    if (query && query.redirect) {
      this.redirect = decodeURIComponent(query.redirect)
    }
    if (query && query.requiredRole) {
      this.requiredRole = query.requiredRole
    }
    this.resolveLoginAssets()
  },
  onShow() {
    // 延迟执行，避免与用户操作产生竞态
    setTimeout(() => {
      redirectLoggedInFromLogin(this.requiredRole)
    }, 100)
  },
  methods: {
    async resolveLoginAssets() {
      const entries = Object.entries(this.assets)
      const resolved = await Promise.all(entries.map(async ([key, value]) => [key, await resolveImageUrl(value, value)]))
      this.assets = resolved.reduce((map, [key, value]) => ({ ...map, [key]: value }), {})
    },
    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.switchTab({ url: '/pages/home/index' })
      }
    },
    goAfterLogin(session) {
      const role = (session.user && session.user.role) || session.role || 'buyer'
      const isAdmin = isAdminRole(role)
      if (isAdmin) setPortalMode('admin')
      else setPortalMode('buyer')
      const target = this.redirect || getRoleHome(role)
      // uni.switchTab 不支持携带 query 参数，需拆分
      const [path] = target.split('?')
      if (path.startsWith('/pages/home') || path.startsWith('/pages/category') || path.startsWith('/pages/order/list') || path.startsWith('/pages/mine')) {
        uni.switchTab({ url: path })
      } else {
        uni.redirectTo({ url: target })
      }
    },
    async handleWechatLogin() {
      if (this.loading) return
      if (!this.agreed) {
        this.errorText = '请先阅读并同意相关协议'
        return
      }
      this.errorText = ''
      this.loading = true
      try {
        const result = await this.loginWithProfile({}, { manageLoading: false })
        const user = result && result.user
        if (this.hasCompleteWechatProfile(user)) {
          this.goAfterLogin(result)
          return
        }
        this.pendingWechatSession = result
        this.profileName = String((user && user.displayName) || '').trim()
        this.profileAvatarPreview = String((user && user.avatar) || '').trim()
        this.profileAvatarTemp = ''
        this.profileDialogVisible = true
      } catch (error) {
        this.handleWechatLoginError(error)
      } finally {
        this.loading = false
      }
    },
    async confirmWechatProfile() {
      if (this.loading) return
      const displayName = this.profileName.trim()
      this.loading = true
      this.errorText = ''
      try {
        let avatar = ''
        if (this.profileAvatarTemp) {
          avatar = await uploadImageToCloud(this.profileAvatarTemp, 'avatars')
        }
        const existingAvatar = this.pendingWechatSession && this.pendingWechatSession.user
          ? String(this.pendingWechatSession.user.avatar || '').trim()
          : ''
        if (!displayName || !(avatar || existingAvatar)) {
          this.errorText = '请选择头像并填写昵称'
          return
        }
        const profilePatch = {}
        if (displayName) profilePatch.displayName = displayName
        if (avatar) profilePatch.avatar = avatar
        const result = this.pendingWechatSession
          ? await this.updateWechatProfile(this.pendingWechatSession, profilePatch)
          : await this.loginWithProfile(profilePatch, { manageLoading: false })
        this.profileDialogVisible = false
        this.pendingWechatSession = null
        this.goAfterLogin(result)
      } catch (error) {
        this.handleWechatLoginError(error)
      } finally {
        this.loading = false
      }
    },
    closeProfileDialog() {
      if (this.loading) return
      this.profileDialogVisible = false
    },
    hasCompleteWechatProfile(user = {}) {
      const displayName = String(user.displayName || user.nickName || '').trim()
      const avatar = String(user.avatar || user.avatarUrl || '').trim()
      return Boolean(displayName && avatar)
    },
    async loginWithProfile(profile = {}, options = {}) {
      const manageLoading = options.manageLoading !== false
      if (manageLoading) {
        this.loading = true
        this.errorText = ''
      }
      try {
        const displayName = String(profile.displayName || profile.nickName || '').trim()
        const avatar = String(profile.avatar || profile.avatarUrl || '').trim()
        const result = await loginWithWechat({
          displayName,
          nickName: displayName,
          avatar,
          avatarUrl: avatar
        })
        const profilePatch = {}
        if (displayName) profilePatch.displayName = displayName
        if (avatar) profilePatch.avatar = avatar
        if (Object.keys(profilePatch).length && result && result.token) {
          const profileResult = await callFunction('businessApi', {
            action: 'updateProfile',
            payload: profilePatch,
            authToken: result.token
          })
          if (profileResult && profileResult.user) {
            result.user = profileResult.user
            updateAuthSessionUser(profileResult.user)
          }
        }
        if (manageLoading) this.goAfterLogin(result)
        return result
      } catch (error) {
        if (manageLoading) {
          this.handleWechatLoginError(error)
          return null
        }
        throw error
      } finally {
        if (manageLoading) this.loading = false
      }
    },
    async updateWechatProfile(session, profilePatch = {}) {
      if (!session || !session.token) return session
      if (!Object.keys(profilePatch).length) return session
      const profileResult = await callFunction('businessApi', {
        action: 'updateProfile',
        payload: profilePatch,
        authToken: session.token
      })
      if (profileResult && profileResult.user) {
        session.user = profileResult.user
        updateAuthSessionUser(profileResult.user)
      }
      return session
    },
    handleWechatLoginError(error) {
      console.error('微信登录失败:', error)
      const normalized = normalizeCloudError(error)
      if (normalized.code && String(normalized.code).indexOf('CONTENT_SECURITY') === 0) {
        this.errorText = normalized.message
        return
      }
      if (error.message && error.message.includes('小程序环境')) {
        this.errorText = '微信登录需要在微信小程序环境中运行'
      } else if (error.message && error.message.includes('微信授权码')) {
        this.errorText = '获取微信授权失败，请重试'
      } else {
        this.errorText = error.message || '微信登录失败，请稍后重试'
      }
    },
    async handleGuestLogin() {
      if (this.loading) return
      if (!this.agreed) {
        this.errorText = '请先阅读并同意相关协议'
        return
      }
      // 防抖处理 - 防止快速双击
      if (this._guestLoginClicked) return
      this._guestLoginClicked = true
      setTimeout(() => { this._guestLoginClicked = false }, 1000)
      
      this.loading = true
      this.errorText = ''
      try {
        const result = await loginAsGuest()
        this.goAfterLogin(result)
      } catch (error) {
        this.errorText = error.message || '游客登录失败'
      } finally {
        this.loading = false
      }
    },
    handleChooseAvatar(event) {
      const avatarUrl = event && event.detail && event.detail.avatarUrl
      if (!avatarUrl) return
      this.profileAvatarPreview = avatarUrl
      this.profileAvatarTemp = avatarUrl
    },
    openAgreement(type) {
      uni.navigateTo({ url: `/pages/legal/index?type=${type}` })
    },
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.login {
  position: relative;
  height: 100vh;
  min-height: 100vh;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: hidden;
  padding: 0 32rpx calc(28rpx + env(safe-area-inset-bottom));
  background-color: #fff7ec;
  @include font-base;
}

.login__bg {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  pointer-events: none;
}

.login__bg-top,
.login__bg-bottom {
  display: block;
  flex: 0 0 auto;
  width: 100%;
}

.login__bg-fill {
  flex: 1;
  min-height: 0;
  background: #fff2df;
}

.top {
  position: relative;
  z-index: 1;
  height: 468rpx;
  margin: 0 -32rpx;
  overflow: hidden;
}

.nav-back {
  position: absolute;
  left: 26rpx;
  top: calc(24rpx + env(safe-area-inset-top));
  z-index: 4;
  width: 64rpx;
  height: 64rpx;
  color: transparent;
}

.panel {
  position: relative;
  z-index: 5;
  margin: -22rpx 0 0;
  padding: 54rpx 34rpx 36rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 38rpx;
  box-shadow: 0 28rpx 88rpx rgba(90, 46, 27, 0.13);
  backdrop-filter: blur(18rpx);
}

.panel__arch {
  position: absolute;
  left: 50%;
  top: -76rpx;
  width: 420rpx;
  height: 152rpx;
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  border-bottom: none;
  border-radius: 50% 50% 0 0;
  transform: translateX(-50%);
}

.panel__icon {
  position: relative;
  z-index: 1;
  display: block;
  width: 92rpx;
  height: 76rpx;
  margin: -4rpx auto 18rpx;
}

.panel__title {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30rpx;
  margin-top: 0;
  color: #5a2e1b;
  text-align: center;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.2;
}

.panel__title text {
  position: relative;
}

.panel__title-leaf {
  flex: 0 0 auto;
  width: 36rpx;
  height: 30rpx;
  opacity: 0.82;
}

.panel__title-leaf--left {
  transform: rotate(-26deg);
}

.panel__title-leaf--right {
  transform: rotate(26deg);
}

.panel__desc {
  position: relative;
  z-index: 1;
  margin-top: 14rpx;
  color: #8b6a58;
  text-align: center;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 1.35;
}

.profile-dialog-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  background: rgba(62, 35, 24, 0.36);
}

.profile-dialog {
  width: 100%;
  padding: 42rpx 34rpx 32rpx;
  background: rgba(255, 255, 255, 0.98);
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 36rpx;
  box-shadow: 0 30rpx 90rpx rgba(90, 46, 27, 0.22);
}

.profile-dialog__title {
  color: #5a2e1b;
  text-align: center;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.25;
}

.profile-dialog__desc {
  margin-top: 10rpx;
  color: #8b6a58;
  text-align: center;
  font-size: 25rpx;
  line-height: 1.4;
}

.profile-dialog__actions {
  display: flex;
  gap: 18rpx;
  margin-top: 28rpx;
}

.profile-dialog__cancel,
.profile-dialog__confirm {
  @include flex-center;
  flex: 1;
  height: 82rpx;
  margin: 0;
  border-radius: 22rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.profile-dialog__cancel {
  color: #5a2e1b;
  background: #fff;
  border: 1rpx solid rgba(150, 83, 43, 0.28);
}

.profile-dialog__confirm {
  color: #fff;
  background: linear-gradient(180deg, #19d467 0%, #12b854 100%);
  border: none;
  box-shadow: 0 16rpx 34rpx rgba(22, 195, 91, 0.22);
}

.avatar-picker {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  margin: 30rpx auto 22rpx;
  padding: 0;
  overflow: hidden;
  color: #9b6a4b;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(150, 83, 43, 0.18);
  border-radius: 50%;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.25;
}

.avatar-picker::after {
  border: none;
}

.avatar-picker__image {
  width: 100%;
  height: 100%;
}

.nickname-input {
  width: 100%;
  height: 82rpx;
  box-sizing: border-box;
  padding: 0 24rpx;
  color: #5a2e1b;
  background: rgba(255, 248, 240, 0.82);
  border: 1rpx solid rgba(150, 83, 43, 0.16);
  border-radius: 22rpx;
  font-size: 27rpx;
  font-weight: 700;
}

.nickname-input__placeholder {
  color: rgba(139, 106, 88, 0.72);
  font-weight: 500;
}

.error {
  position: relative;
  z-index: 1;
  margin-top: 18rpx;
  color: #ff6f7d;
  font-size: 25rpx;
  line-height: 1.4;
  text-align: center;
}

.wechat-btn {
  position: relative;
  z-index: 1;
  @include flex-center;
  gap: 12rpx;
  width: 100%;
  height: 104rpx;
  margin-top: 40rpx;
  color: #fff;
  background: linear-gradient(180deg, #19d467 0%, #12b854 100%);
  border-radius: 20rpx;
  box-shadow: 0 22rpx 44rpx rgba(22, 195, 91, 0.26);
  font-size: 30rpx;
  font-weight: 800;
}

.btn-icon {
  flex: 0 0 auto;
  width: 34rpx;
  height: 34rpx;
}

.wechat-btn[disabled] {
  opacity: 0.7;
}

.guest-btn {
  position: relative;
  z-index: 1;
  @include flex-center;
  gap: 12rpx;
  width: 100%;
  height: 92rpx;
  margin-top: 18rpx;
  color: #5a2e1b;
  background: rgba(255, 255, 255, 0.7);
  border: 2rpx solid rgba(150, 83, 43, 0.78);
  border-radius: 20rpx;
  font-size: 29rpx;
  font-weight: 800;
  box-shadow: 0 12rpx 30rpx rgba(90, 46, 27, 0.06);
}

.guest-btn[disabled] {
  opacity: 0.7;
}

.agreement {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin-top: 28rpx;
  padding: 0 12rpx;
}

.agreement__radio {
  flex: 0 0 auto;
  width: 30rpx;
  height: 30rpx;
  margin-top: 5rpx;
  border: 3rpx solid rgba(160, 98, 51, 0.32);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
}

.agreement__radio.checked {
  border-color: #ff6f7d;
  background: radial-gradient(circle, #ff6f7d 0%, #ff6f7d 45%, #fff 48%, #fff 100%);
}

.agreement__text {
  flex: 1;
  min-width: 0;
  color: #8b6a58;
  font-size: 23rpx;
  line-height: 1.55;
}

.agreement__text text {
  color: #ff6f7d;
  margin-left: 8rpx;
  font-weight: 700;
}

.assurance {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: center;
  gap: 16rpx;
  margin: 22rpx 0 0;
}

.assurance__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 184rpx;
  padding: 20rpx 8rpx 18rpx;
  background: rgba(255, 255, 255, 0.9);
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 20rpx;
  box-shadow: 0 18rpx 54rpx rgba(90, 46, 27, 0.08);
}

.assurance__icon {
  flex: 0 0 auto;
  width: 58rpx;
  height: 58rpx;
}

.assurance__item view view {
  margin-top: 16rpx;
  color: #5a2e1b;
  text-align: center;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.25;
}

.assurance__item text {
  display: block;
  margin-top: 10rpx;
  color: #8b6a58;
  text-align: center;
  font-size: 22rpx;
  line-height: 1.2;
}

@media screen and (max-width: 430px) {
  .login {
    padding-left: 30rpx;
    padding-right: 30rpx;
  }

  .top {
    margin-left: -30rpx;
    margin-right: -30rpx;
    height: 462rpx;
  }

  .panel {
    padding: 52rpx 32rpx 34rpx;
  }

  .assurance {
    margin-left: 0;
    margin-right: 0;
    gap: 14rpx;
  }

  .assurance__item {
    min-height: 176rpx;
  }

  .assurance__icon {
    width: 56rpx;
    height: 56rpx;
  }

  .assurance__item view view {
    font-size: 24rpx;
  }

  .assurance__item text {
    font-size: 21rpx;
  }
}
</style>
