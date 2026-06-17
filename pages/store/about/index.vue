<template>
  <view class="page store-about">
    <CustomNavBar title="关于门店" showBack />

    <view class="hero card">
      <image class="hero__logo" :src="shop.logo" mode="aspectFill" lazy-load />
      <view class="hero__title">{{ shop.bakeryName }}</view>
      <view class="hero__subtitle">{{ shop.slogan }}</view>
      <view class="hero__tag">{{ shop.bakeryTag }}</view>
    </view>

    <view class="card section">
      <view class="section__title">门店信息</view>
      <view class="info-row"><text>配送范围</text><view>{{ shop.deliveryRange }}</view></view>
      <view class="info-row"><text>覆盖区域</text><view>{{ shop.deliveryRangeDetail }}</view></view>
      <view class="info-row"><text>配送时间</text><view>{{ shop.deliveryTime }}</view></view>
      <view class="info-row"><text>客服时间</text><view>{{ shop.customerService }}</view></view>
      <view class="info-row"><text>联系电话</text><view>{{ shop.phone }}</view></view>
      <view class="info-row"><text>门店地址</text><view>{{ shop.address }}</view></view>
    </view>

    <view class="card section">
      <view class="section__title">服务承诺</view>
      <view class="assurance">{{ shop.assurance }}</view>
      <view class="badge-list">
        <view v-for="item in shop.serviceBadges" :key="item.text" class="badge">{{ item.text }}</view>
      </view>
    </view>

    <view class="card section">
      <view class="section__title">门店说明</view>
      <view class="notice">{{ shop.notice }}</view>
      <view v-for="(item, index) in shop.operationTips" :key="index" class="tip">{{ index + 1 }}. {{ item }}</view>
    </view>

    <view class="bottom-actions">
      <button class="ghost-btn" @tap="copyAddress">复制地址</button>
      <button class="primary-btn" @tap="callStore">联系门店</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getShopAboutData } from '@/services/dataService'

export default {
  components: { CustomNavBar },
  data() {
    return {
      shop: {}
    }
  },
  async onShow() {
    this.shop = await getShopAboutData()
  },
  methods: {
    copyAddress() {
      uni.setClipboardData({ data: this.shop.address || '' })
    },
    callStore() {
      uni.makePhoneCall({ phoneNumber: this.shop.phone })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.store-about { padding-bottom: 180rpx; }
.hero,.section { margin-top:24rpx; }
.hero { padding:36rpx 28rpx; text-align:center; background:$gradient-hero; }
.hero__logo { width:112rpx; height:112rpx; margin:0 auto; border-radius:50%; }
.hero__title { margin-top:20rpx; color:$color-text-main; font-size:40rpx; font-weight:800; }
.hero__subtitle { margin-top:12rpx; color:$color-text-regular; font-size:26rpx; }
.hero__tag { display:inline-flex; margin-top:18rpx; padding:10rpx 20rpx; color:$color-orange; background:$color-orange-light; border-radius:$radius-pill; font-size:24rpx; }
.section { padding:28rpx; }
.section__title { color:$color-text-main; font-size:32rpx; font-weight:800; }
.info-row { display:flex; justify-content:space-between; gap:24rpx; padding-top:18rpx; color:$color-text-regular; font-size:26rpx; }
.info-row text { flex-shrink:0; color:$color-text-main; }
.info-row view { min-width:0; text-align:right; line-height:1.5; }
.assurance,.notice,.tip { margin-top:18rpx; color:$color-text-regular; font-size:26rpx; line-height:1.6; }
.badge-list { display:flex; flex-wrap:wrap; gap:14rpx; margin-top:20rpx; }
.badge { padding:12rpx 18rpx; color:$color-text-main; background:$color-bg-light; border-radius:16rpx; font-size:24rpx; }
.bottom-actions { position:fixed; left:0; right:0; bottom:0; display:flex; gap:20rpx; padding:18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background:rgba(255,255,255,.98); border-top:1rpx solid $color-border-light; }
.ghost-btn,.primary-btn { @include flex-center; flex:1; height:88rpx; margin:0; border-radius:$radius-pill; font-size:30rpx; font-weight:700; }
.ghost-btn { color:$color-text-main; background:#fff; border:1rpx solid $color-border; }
.primary-btn { color:#fff; background:$gradient-primary; border:none; }
</style>
