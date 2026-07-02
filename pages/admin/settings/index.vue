<template>
  <view class="page settings-page">
    <CustomNavBar title="配置中心" showBack />

    <view class="intro card">
      <view class="intro__title">门店配置</view>
      <view class="intro__desc">店铺信息、消息提醒、首页展示和权限统一在这里维护。</view>
    </view>

    <view class="notice-card card">
      <view class="notice-card__icon">
        <AppIcon name="bell" :size="38" color="#FFFFFF" />
      </view>
      <view class="notice-card__main">
        <view class="notice-card__title">微信消息提醒</view>
        <text>{{ subscriptionText }}</text>
        <view v-if="subscriptionDetails.length" class="notice-card__details">
          <view v-for="item in subscriptionDetails" :key="item.label">
            <text>{{ item.label }}</text>
            <view>{{ item.value }}</view>
          </view>
        </view>
      </view>
      <button class="notice-card__btn" :disabled="subscribing" @tap="enableMessageNotice">
        {{ subscriptionButtonText }}
      </button>
    </view>

    <view class="settings-list">
      <view
        v-for="item in settingsItems"
        :key="item.key"
        class="settings-item card"
        @tap="go(item.url)"
      >
        <view class="settings-item__icon" :class="'settings-item__icon--' + item.theme">
          <AppIcon :name="item.icon" :size="40" color="#FFFFFF" />
        </view>
        <view class="settings-item__main">
          <view class="settings-item__title">{{ item.title }}</view>
          <view class="settings-item__desc">{{ item.desc }}</view>
        </view>
        <view class="settings-item__arrow">›</view>
      </view>
    </view>

  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import { getAdminSubscriptionStatus, requestAdminAfterSalesSubscribe } from '@/services/dataService'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, AppIcon },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/settings/index', '需要店长权限')) return
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/settings/index', '需要店长权限')) return
    this.loadSubscriptionStatus()
  },
  data() {
    return {
      subscriptionStatus: {},
      subscribing: false,
      settingsItems: [
        {
          key: 'store',
          title: '店铺信息',
          desc: '品牌名称、门店地址、电话、客服时间、履约说明',
          icon: 'store',
          theme: 'orange',
          url: '/pages/admin/store-settings/index'
        },
        {
          key: 'banner',
          title: '轮播图配置',
          desc: '首页轮播文案、图片、排序、启停和跳转',
          icon: 'banner',
          theme: 'blue',
          url: '/pages/admin/banner-config/index'
        },
        {
          key: 'category',
          title: '分类管理',
          desc: '新增、编辑、删除商品分类',
          icon: 'grid',
          theme: 'green',
          url: '/pages/admin/category-manage/index'
        },
        {
          key: 'permissions',
          title: '权限设置',
          desc: '查看用户账号，将普通用户设置为店长',
          icon: 'users',
          theme: 'purple',
          url: '/pages/admin/permission/index'
        }
      ]
    }
  },
  computed: {
    subscriptionText() {
      const hasOrder = !!this.subscriptionStatus.orderTemplateId
      const hasAfterSales = !!(this.subscriptionStatus.afterSalesTemplateId || this.subscriptionStatus.templateId)
      if (!hasOrder && !hasAfterSales) return '请先填写下单或售后订阅模板ID，再开启服务通知。'
      if (this.subscriptionStatus.orderEnabled && this.subscriptionStatus.afterSalesEnabled) return '已开启，下单、售后申请和取消订单都会提醒店长。'
      if (this.subscriptionStatus.orderEnabled) return '已开启下单提醒；可继续授权售后提醒。'
      if (this.subscriptionStatus.afterSalesEnabled) return '已开启售后提醒；可继续授权下单提醒。'
      return '未开启，点击后授权接收下单、售后与取消订单提醒。'
    },
    subscriptionButtonText() {
      if (this.subscribing) return '处理中'
      if (!this.subscriptionStatus.orderTemplateId && !(this.subscriptionStatus.afterSalesTemplateId || this.subscriptionStatus.templateId)) return '去配置'
      return this.subscriptionStatus.enabled ? '重新授权' : '开启提醒'
    },
    subscriptionDetails() {
      if (!this.subscriptionStatus.enabled) return []
      const configuredCount = this.subscriptionStatus.configuredTemplateCount || Number(!!this.subscriptionStatus.orderTemplateId) + Number(!!(this.subscriptionStatus.afterSalesTemplateId || this.subscriptionStatus.templateId)) || 2
      const adminNames = Array.isArray(this.subscriptionStatus.enabledAdminNames)
        ? this.subscriptionStatus.enabledAdminNames.filter(Boolean).join('、')
        : ''
      return [
        { label: '当前账号', value: `${this.subscriptionStatus.enabledCount || Number(!!this.subscriptionStatus.orderEnabled) + Number(!!this.subscriptionStatus.afterSalesEnabled)}/${configuredCount}` },
        { label: '接收店长', value: this.subscriptionStatus.enabledAdminCount ? `${this.subscriptionStatus.enabledAdminCount}人` : '仅当前账号' },
        { label: '上次授权', value: this.formatTime(this.subscriptionStatus.updatedAt) || '暂无记录' }
      ]
        .concat(adminNames ? [{ label: '已授权', value: adminNames }] : [])
    }
  },
  methods: {
    formatTime(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    },
    async loadSubscriptionStatus() {
      try {
        this.subscriptionStatus = await getAdminSubscriptionStatus()
      } catch (error) {
        this.subscriptionStatus = { enabled: false, templateId: '' }
      }
    },
    async enableMessageNotice() {
      const hasOrder = !!this.subscriptionStatus.orderTemplateId
      const hasAfterSales = !!(this.subscriptionStatus.afterSalesTemplateId || this.subscriptionStatus.templateId)
      if (!hasOrder && !hasAfterSales) {
        this.go('/pages/admin/store-settings/index')
        return
      }
      if (this.subscribing) return
      this.subscribing = true
      try {
        this.subscriptionStatus = await requestAdminAfterSalesSubscribe(this.subscriptionStatus)
        uni.showToast({ title: '消息提醒已开启', icon: 'success' })
      } catch (error) {
        uni.showModal({
          title: '开启提醒失败',
          content: this.subscriptionErrorText(error),
          showCancel: false,
          confirmText: '知道了'
        })
      } finally {
        this.subscribing = false
      }
    },
    subscriptionErrorText(error) {
      const message = String(error && error.message || '')
      if (message.includes('reject') || message.includes('没有勾选') || message.includes('未授权')) {
        return '你刚刚没有允许订阅消息。需要重新点击开启，并在微信弹窗里勾选允许通知。'
      }
      if (message.includes('template') || message.includes('模板')) {
        return '请检查下单/售后订阅模板ID是否属于当前小程序，并且模板已在微信公众平台启用。'
      }
      if (message.includes('openid')) return '当前账号缺少微信身份，请重新微信登录店长账号后再开启。'
      return message || '请稍后重试，或检查小程序订阅消息配置。'
    },
    go(url) {
      uni.navigateTo({ url })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.settings-page { padding-bottom: 80rpx; }

.intro {
  margin-top: 20rpx;
  padding: 30rpx 28rpx;
  background: $color-card;
}

.intro__title {
  @include text-card-title;
  font-size: 38rpx;
  font-weight: $font-weight-heavy;
}

.intro__desc {
  margin-top: 10rpx;
  @include text-caption($color-text-regular);
  line-height: 1.5;
}

.notice-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 24rpx;
}

.notice-card__icon {
  @include flex-center;
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  color: #fff;
  background: $gradient-primary;
  border-radius: $radius-md;
}

.notice-card__main {
  flex: 1;
  min-width: 0;
}

.notice-card__title {
  @include text-body-strong;
  font-size: 30rpx;
  font-weight: $font-weight-heavy;
}

.notice-card__main text {
  display: block;
  margin-top: 8rpx;
  @include text-helper($color-text-light);
  line-height: 1.35;
}

.notice-card__details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.notice-card__details > view {
  min-width: 0;
  padding: 12rpx 10rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
}

.notice-card__details text {
  margin: 0;
  color: $color-text-light;
  font-size: 20rpx;
  line-height: 1.2;
}

.notice-card__details view view {
  margin-top: 6rpx;
  color: $color-text-main;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-card__btn {
  @include flex-center;
  flex-shrink: 0;
  min-width: 146rpx;
  height: 66rpx;
  margin: 0;
  padding: 0 22rpx;
  color: #fff;
  background: $gradient-primary;
  border: none;
  border-radius: $radius-pill;
  font-size: 24rpx;
  font-weight: $font-weight-bold;
  box-shadow: $shadow-btn;
}

.notice-card__btn[disabled] {
  opacity: .62;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.settings-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
}

.settings-item__icon {
  @include flex-center;
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
}

.settings-item__icon--orange { background: $color-orange; }
.settings-item__icon--green { background: $color-green; }
.settings-item__icon--blue { background: $color-blue; }
.settings-item__icon--purple { background: #7157c8; }
.settings-item__icon--red { background: $color-danger; }

.settings-item__main {
  flex: 1;
  min-width: 0;
}

.settings-item__title {
  @include text-body-strong;
  font-size: 30rpx;
  font-weight: $font-weight-heavy;
}

.settings-item__desc {
  margin-top: 8rpx;
  @include text-helper($color-text-light);
  line-height: 1.35;
}

.settings-item__arrow {
  flex-shrink: 0;
  color: $color-text-light;
  font-size: 52rpx;
  line-height: 1;
}
</style>
