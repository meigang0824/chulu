<template>
  <view class="login">
    <view class="top">
      <image class="top__cake" :src="cakeImage" mode="aspectFill" />
      <image class="top__bread" :src="breadImage" mode="aspectFill" />
      <view class="nav-back" @tap="goBack">‹</view>

      <view class="brand">
        <view class="oven">
          <view class="oven__heart">♥</view>
          <view class="oven__steam">⌇⌇</view>
          <view class="oven__body">
            <view class="oven__mouth">
              <view class="oven__bread"></view>
            </view>
          </view>
        </view>
        <view class="brand__name">初炉</view>
        <view class="brand__slogan">— 每日新鲜 · 团购更甜蜜 —<text>♥</text></view>
      </view>
    </view>

    <view class="panel">
      <view class="panel__title">欢迎回来</view>
      <view class="panel__desc">选择登录方式，开启甜蜜之旅</view>

      <view v-if="errorText" class="error">{{ errorText }}</view>

      <!-- 微信一键登录 -->
      <button class="wechat-btn" :disabled="loading" @tap="handleWechatLogin">
        微信一键登录
      </button>

      <!-- 游客登录 -->
      <button class="guest-btn" :disabled="loading" @tap="handleGuestLogin">
        游客登录
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
        <view class="assurance__icon">♢</view>
        <view>
          <view>严选食材</view>
          <text>品质安心</text>
        </view>
      </view>
      <view class="assurance__line"></view>
      <view class="assurance__item">
        <view class="assurance__icon">▣</view>
        <view>
          <view>新鲜现做</view>
          <text>当日制作</text>
        </view>
      </view>
      <view class="assurance__line"></view>
      <view class="assurance__item">
        <view class="assurance__icon">◷</view>
        <view>
          <view>明日配送</view>
          <text>准时送达</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getRoleHome, isAdminRole, loginWithWechat, redirectLoggedInFromLogin, loginAsGuest } from '@/utils/auth'
import { setPortalMode } from '@/services/dataService'
import { IMAGE_ASSETS, resolveImageUrl } from '@/utils/image'

export default {
  data() {
    return {
      redirect: '',
      requiredRole: '',
      loading: false,
      errorText: '',
      agreed: false,
      cakeImage: IMAGE_ASSETS.product,
      breadImage: IMAGE_ASSETS.productToast,
    }
  },
  onLoad(query) {
    if (query && query.redirect) {
      this.redirect = decodeURIComponent(query.redirect)
    }
    if (query && query.requiredRole) {
      this.requiredRole = query.requiredRole
    }
    this.resolveImages()
  },
  onShow() {
    // 延迟执行，避免与用户操作产生竞态
    setTimeout(() => {
      redirectLoggedInFromLogin(this.requiredRole)
    }, 100)
  },
  methods: {
    async resolveImages() {
      const [cakeImage, breadImage] = await Promise.all([
        resolveImageUrl(IMAGE_ASSETS.product, IMAGE_ASSETS.product),
        resolveImageUrl(IMAGE_ASSETS.productToast, IMAGE_ASSETS.productToast)
      ])
      this.cakeImage = cakeImage
      this.breadImage = breadImage
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
      this.loading = true
      this.errorText = ''
      try {
        // 调用真实的微信登录接口
        const result = await loginWithWechat()
        this.goAfterLogin(result)
      } catch (error) {
        console.error('微信登录失败:', error)
        // 区分不同错误类型
        if (error.message && error.message.includes('小程序环境')) {
          this.errorText = '微信登录需要在微信小程序环境中运行'
        } else if (error.message && error.message.includes('微信授权码')) {
          this.errorText = '获取微信授权失败，请重试'
        } else {
          this.errorText = error.message || '微信登录失败，请稍后重试'
        }
      } finally {
        this.loading = false
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
    openAgreement(type) {
      // 打开协议页面
      const title = type === 'user' ? '用户协议' : '隐私政策'
      const content = type === 'user' 
        ? '欢迎使用初炉烘焙！\n\n1. 用户注册与账户安全\n2. 商品购买与支付\n3. 配送与售后服务\n4. 隐私保护政策\n\n（完整协议内容请访问官网）'
        : '初炉烘焙重视您的隐私保护！\n\n1. 信息收集范围\n2. 信息使用方式\n3. 信息保护措施\n4. 用户权利说明\n\n（完整政策内容请访问官网）'
      uni.showModal({
        title,
        content,
        showCancel: false,
        confirmText: '我知道了'
      })
    },
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.login {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: $gradient-page;
  @include font-base;
}

.top {
  position: relative;
  height: 430rpx;
  overflow: hidden;
  background: $color-card;
  border-bottom: 1rpx solid $color-border-light;
}

.top::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120rpx;
  background: linear-gradient(180deg, rgba(246, 247, 249, 0) 0%, $color-bg 100%);
}

.top__cake,
.top__bread {
  position: absolute;
  bottom: 8rpx;
  width: 250rpx;
  height: 220rpx;
  opacity: 0.16;
  filter: none;
}

.top__cake {
  left: -70rpx;
  border-radius: 0 80rpx 0 0;
}

.top__bread {
  right: -58rpx;
  border-radius: 80rpx 0 0 0;
}

.nav-back {
  position: absolute;
  left: 34rpx;
  top: calc(64rpx + env(safe-area-inset-top));
  z-index: 4;
  width: 70rpx;
  height: 70rpx;
  color: #1f1510;
  @include font-base;
  font-size: 72rpx;
  font-weight: 300;
  line-height: 60rpx;
}

.brand {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(128rpx + env(safe-area-inset-top));
}

.oven {
  display: none;
}

.oven__heart {
  position: absolute;
  top: -10rpx;
  left: 50%;
  z-index: 4;
  color: #ff4f66;
  @include font-base;
  font-size: 38rpx;
  transform: translateX(-50%);
  text-shadow: 0 8rpx 20rpx rgba(255, 79, 102, 0.25);
}

.oven__steam {
  position: absolute;
  right: 18rpx;
  top: 0;
  z-index: 4;
  color: #7f3a16;
  font-size: 30rpx;
  letter-spacing: 6rpx;
  transform: rotate(-16deg);
}

.oven__body {
  position: absolute;
  left: 12rpx;
  right: 12rpx;
  bottom: 0;
  height: 112rpx;
  overflow: hidden;
  background: linear-gradient(180deg, #f8d3a4 0%, #c97837 100%);
  border: 5rpx solid #7a3514;
  border-bottom-width: 10rpx;
  border-radius: 88rpx 88rpx 10rpx 10rpx;
  box-shadow: inset 0 0 0 10rpx rgba(255, 232, 190, 0.45);
}

.oven__body::before,
.oven__body::after {
  content: '';
  position: absolute;
  top: 42rpx;
  bottom: 0;
  width: 4rpx;
  background: rgba(122, 53, 20, 0.72);
}

.oven__body::before {
  left: 26rpx;
}

.oven__body::after {
  right: 26rpx;
}

.oven__mouth {
  position: absolute;
  left: 38rpx;
  right: 38rpx;
  bottom: 18rpx;
  height: 72rpx;
  overflow: hidden;
  background: linear-gradient(180deg, #8d3d12 0%, #3f1a0b 100%);
  border-radius: 52rpx 52rpx 8rpx 8rpx;
  box-shadow: inset 0 -8rpx 18rpx rgba(0, 0, 0, 0.22);
}

.oven__bread {
  position: absolute;
  left: 16rpx;
  right: 16rpx;
  bottom: 12rpx;
  height: 34rpx;
  background: linear-gradient(180deg, #ffd474 0%, #d87b22 100%);
  border-radius: 50rpx 50rpx 8rpx 8rpx;
}

.brand__name {
  margin-top: 0;
  color: $color-text-main;
  font-size: 58rpx;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  text-indent: 0;
  text-shadow: none;
}

.brand__slogan {
  margin-top: 18rpx;
  color: $color-text-regular;
  font-size: 27rpx;
  font-weight: 500;
  letter-spacing: 0;
}

.brand__slogan text {
  color: #ff6b78;
  letter-spacing: 0;
}

.panel {
  position: relative;
  z-index: 5;
  min-height: calc(100vh - 500rpx);
  margin: -28rpx 24rpx 0;
  padding: 40rpx 32rpx 34rpx;
  background: rgba(255, 255, 255, 0.98);
  border: 1rpx solid $color-border-light;
  border-radius: $radius-xl;
  box-shadow: $shadow-card;
}

.panel__title {
  margin-top: 22rpx;
  color: $color-text-main;
  text-align: center;
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1.2;
}

.panel__desc {
  margin-top: 18rpx;
  color: $color-text-light;
  text-align: center;
  font-size: 27rpx;
  line-height: 1.35;
}

.error {
  margin-top: 18rpx;
  color: #ff4f66;
  font-size: 25rpx;
  line-height: 1.4;
  text-align: center;
}

/* 微信一键登录按钮 */
.wechat-btn {
  @include flex-center;
  width: 100%;
  height: 96rpx;
  margin-top: 42rpx;
  color: #fff;
  background: #1aad19;
  border-radius: $radius-md;
  box-shadow: none;
  font-size: 34rpx;
  font-weight: 800;
}

.wechat-btn[disabled] {
  opacity: 0.7;
}

/* 游客登录按钮 */
.guest-btn {
  @include flex-center;
  width: 100%;
  height: 88rpx;
  margin-top: 24rpx;
  color: $color-text-main;
  background: $color-bg-light;
  border: 1rpx solid $color-border;
  border-radius: $radius-md;
  font-size: 30rpx;
  font-weight: 700;
}

.guest-btn[disabled] {
  opacity: 0.7;
}

/* 协议 */
.agreement {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 34rpx;
}

.agreement__radio {
  flex: 0 0 auto;
  width: 24rpx;
  height: 24rpx;
  margin-top: 6rpx;
  border: 2rpx solid #d8d2cd;
  border-radius: 50%;
}

.agreement__radio.checked {
  border-color: $color-primary;
  background: radial-gradient(circle, $color-primary 0%, $color-primary 45%, #fff 48%, #fff 100%);
}

.agreement__text {
  flex: 1;
  min-width: 0;
  color: $color-text-regular;
  font-size: 25rpx;
  line-height: 1.55;
}

.agreement__text text {
  color: $color-primary;
  margin-left: 8rpx;
}

/* 底部保障 */
.assurance {
  display: grid;
  grid-template-columns: 1fr 1rpx 1fr 1rpx 1fr;
  align-items: center;
  gap: 18rpx;
  margin: 22rpx 24rpx 0;
  padding: 22rpx 22rpx;
  background: $color-card;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
}

.assurance__item {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12rpx;
}

.assurance__icon {
  flex: 0 0 auto;
  width: 42rpx;
  color: $color-primary;
  text-align: center;
  font-size: 38rpx;
}

.assurance__item view view {
  color: $color-text-main;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.25;
}

.assurance__item text {
  display: block;
  margin-top: 6rpx;
  color: $color-text-light;
  font-size: 22rpx;
  line-height: 1.2;
}

.assurance__line {
  width: 1rpx;
  height: 42rpx;
  background: $color-border-light;
}

</style>
