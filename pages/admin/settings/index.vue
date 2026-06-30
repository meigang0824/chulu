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
    }
  },
  methods: {
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
        uni.showToast({ title: error.message || '开启失败', icon: 'none' })
      } finally {
        this.subscribing = false
      }
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
