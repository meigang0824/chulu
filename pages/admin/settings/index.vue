<template>
  <view class="page settings-page">
    <CustomNavBar title="配置中心" showBack />

    <view class="intro card">
      <view class="intro__title">门店配置</view>
      <view class="intro__desc">店铺信息、首页展示、分类和发货批次统一在这里维护。</view>
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

    <AdminTabBar active="dashboard" />
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import AdminTabBar from '@/components/AdminTabBar/AdminTabBar.vue'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar, AppIcon, AdminTabBar },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/settings/index', '需要店长权限')) return
  },
  data() {
    return {
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
          key: 'route',
          title: '发货批次',
          desc: '按快递、自提、同城创建批次，方便分拣打包',
          icon: 'route',
          theme: 'purple',
          url: '/pages/admin/route-manage/index'
        }
      ]
    }
  },
  methods: {
    go(url) {
      uni.navigateTo({ url })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.settings-page { padding-bottom: 190rpx; }

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
