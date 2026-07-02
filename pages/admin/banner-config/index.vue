<template>
  <view class="page banner-page">
    <CustomNavBar title="轮播配置" showBack />

    <view class="preview card">
      <view class="preview__head">
        <view>
          <view class="preview__title">首页轮播预览</view>
          <view class="preview__sub">当前启用 {{ activeCount }} 张</view>
        </view>
        <view class="preview__badge">{{ settings.autoplay ? '自动播放' : '手动切换' }}</view>
      </view>
      <swiper
        class="preview__swiper"
        :autoplay="settings.autoplay"
        :circular="settings.circular"
        :interval="settings.interval"
        :duration="settings.duration"
        :current="previewIndex"
        @change="handlePreviewChange"
      >
        <swiper-item v-for="banner in activeBanners" :key="banner.id">
          <view class="preview__slide">
            <view class="preview__media">
              <image class="preview__image" :src="banner.image" mode="aspectFill" />
            </view>
            <view class="preview__copy">
              <view class="preview__tag">今日推荐</view>
            </view>
          </view>
        </swiper-item>
      </swiper>
      <view v-if="settings.showDots && activeBanners.length > 1" class="preview__dots">
        <text
          v-for="(banner, index) in activeBanners"
          :key="banner.id"
          :class="{ 'is-active': index === previewIndex }"
          @tap="setPreviewBanner(index)"
        ></text>
      </view>
    </view>

    <view class="settings card">
      <view class="form-row">
        <view>
          <view class="form-row__label">自动播放</view>
          <view class="form-row__hint">首页打开后自动轮播</view>
        </view>
        <switch :checked="settings.autoplay" color="#e84f5f" @change="setSetting('autoplay', $event.detail.value)" />
      </view>
      <view class="form-row">
        <view>
          <view class="form-row__label">循环播放</view>
          <view class="form-row__hint">最后一张后回到第一张</view>
        </view>
        <switch :checked="settings.circular" color="#e84f5f" @change="setSetting('circular', $event.detail.value)" />
      </view>
      <view class="form-row">
        <view>
          <view class="form-row__label">显示圆点</view>
          <view class="form-row__hint">首页底部轮播指示器</view>
        </view>
        <switch :checked="settings.showDots" color="#e84f5f" @change="setSetting('showDots', $event.detail.value)" />
      </view>
      <view class="number-grid">
        <label>
          <text>切换间隔(ms)</text>
          <input type="number" :value="settings.interval" @input="setSetting('interval', $event.detail.value)" />
        </label>
        <label>
          <text>动画时长(ms)</text>
          <input type="number" :value="settings.duration" @input="setSetting('duration', $event.detail.value)" />
        </label>
      </view>
    </view>

    <view class="banner-card card" v-for="(banner, index) in banners" :key="banner.id">
      <view class="banner-card__top">
        <image :src="banner.image" mode="aspectFill" />
        <view class="banner-card__main">
          <view class="banner-card__title">轮播图 {{ index + 1 }}</view>
          <view class="banner-card__meta">排序 {{ banner.sort }} · {{ banner.enabled ? '已启用' : '已停用' }}</view>
        </view>
        <switch :checked="banner.enabled" color="#e84f5f" @change="setBanner(index, 'enabled', $event.detail.value)" />
      </view>

      <view class="edit-grid">
        <label>
          <text>点击跳转</text>
          <picker :range="routeOptions" range-key="label" :value="routeIndex(banner.route)" @change="setRoute(index, $event)">
            <view class="picker-text">{{ routeLabel(banner.route) }}</view>
          </picker>
        </label>
        <label>
          <text>图片</text>
          <picker :range="imageOptions" range-key="label" :value="imageIndex(banner.imageFileID || banner.image)" @change="setImage(index, $event)">
            <view class="picker-text">{{ imageLabel(banner.imageFileID || banner.image) }}</view>
          </picker>
          <button class="upload-inline" :disabled="uploadingIndex === index" @tap="chooseBannerImage(index)">
            {{ uploadingIndex === index ? '上传中...' : '上传新图' }}
          </button>
        </label>
      </view>

      <view class="banner-card__actions">
        <button class="secondary-btn" :disabled="index === 0" @tap="move(index, -1)">上移</button>
        <button class="secondary-btn" :disabled="index === banners.length - 1" @tap="move(index, 1)">下移</button>
      </view>
    </view>

    <view class="bottom-actions">
      <button class="secondary-btn" @tap="reset">恢复默认</button>
      <button class="primary-btn" @tap="save">保存配置</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getActiveBanners, getDefaultBannerConfig, saveBannerConfig } from '@/utils/bannerConfig'
import { IMAGE_OPTIONS, resolveImageUrl, uploadImageToCloud } from '@/utils/image'
import { adminAction, getActiveGroups, getAdminProducts, getDisplayBannerConfigFromCloud } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar },
  data() {
    const config = getDefaultBannerConfig()
    return {
      settings: config.settings,
      banners: config.banners,
      imageOptions: IMAGE_OPTIONS,
      routeOptions: [{ label: '不跳转', value: '' }],
      uploadingIndex: -1,
      previewIndex: 0
    }
  },
  computed: {
    activeBanners() {
      return getActiveBanners({ settings: this.settings, banners: this.banners })
    },
    activeCount() {
      return this.banners.filter(item => item.enabled).length
    }
  },
  methods: {
    handlePreviewChange(event) {
      this.previewIndex = event.detail.current || 0
    },
    setPreviewBanner(index) {
      this.previewIndex = index
    },
    setSetting(key, value) {
      const next = key === 'interval' || key === 'duration' ? Math.max(Number(value || 0), 100) : value
      this.$set(this.settings, key, next)
    },
    setBanner(index, key, value) {
      this.$set(this.banners[index], key, value)
      if (this.previewIndex >= this.activeBanners.length) this.previewIndex = 0
    },
    setRoute(index, event) {
      const option = this.routeOptions[Number(event.detail.value || 0)]
      this.setBanner(index, 'route', option ? option.value : '')
    },
    async setImage(index, event) {
      const option = this.imageOptions[Number(event.detail.value || 0)]
      if (!option) return
      this.setBanner(index, 'imageFileID', option.value)
      this.setBanner(index, 'image', await resolveImageUrl(option.value, option.value))
    },
    addImageOption(value, label = '自定义图片') {
      if (!value || this.imageOptions.some(item => item.value === value)) return
      this.imageOptions = [...this.imageOptions, { label, value }]
    },
    chooseBannerImage(index) {
      if (this.uploadingIndex >= 0) return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: async res => {
          const filePath = res.tempFilePaths && res.tempFilePaths[0]
          if (!filePath) return
          this.uploadingIndex = index
          uni.showLoading({ title: '上传中' })
          try {
            const fileID = await uploadImageToCloud(filePath, 'banners')
            this.addImageOption(fileID, `自定义图片 ${index + 1}`)
            this.setBanner(index, 'imageFileID', fileID)
            this.setBanner(index, 'image', await resolveImageUrl(fileID, fileID))
          } catch (error) {
            showCloudError(error)
          } finally {
            uni.hideLoading()
            this.uploadingIndex = -1
          }
        }
      })
    },
    move(index, step) {
      const nextIndex = index + step
      if (nextIndex < 0 || nextIndex >= this.banners.length) return
      const list = this.banners.slice()
      const current = list[index]
      list.splice(index, 1)
      list.splice(nextIndex, 0, current)
      this.banners = list.map((item, sortIndex) => ({ ...item, sort: sortIndex + 1 }))
    },
    imageIndex(value) {
      return Math.max(this.imageOptions.findIndex(item => item.value === value), 0)
    },
    imageLabel(value) {
      const item = this.imageOptions.find(option => option.value === value)
      return item ? item.label : '自定义图片'
    },
    routeIndex(value) {
      return Math.max(this.routeOptions.findIndex(item => item.value === value), 0)
    },
    routeLabel(value) {
      const item = this.routeOptions.find(option => option.value === value)
      return item ? item.label : '不跳转'
    },
    async applyBannerConfig(config) {
      const banners = await Promise.all((config.banners || []).map(async item => {
        const imageFileID = item.imageFileID || item.image
        this.addImageOption(imageFileID, item.label || `轮播图 ${item.sort || ''}`.trim() || '当前图片')
        return {
          ...item,
          imageFileID,
          image: await resolveImageUrl(imageFileID, imageFileID)
        }
      }))
      this.settings = config.settings
      this.banners = banners
      if (this.previewIndex >= this.activeBanners.length) this.previewIndex = 0
      this.banners.forEach(item => this.addImageOption(item.imageFileID || item.image))
      saveBannerConfig({ settings: this.settings, banners: this.banners })
    },
    async reset() {
      const config = getDefaultBannerConfig()
      await this.applyBannerConfig(config)
      uni.showToast({ title: '已恢复默认', icon: 'none' })
    },
    async save() {
      const payload = {
        settings: this.settings,
        banners: this.banners.map(item => {
          const { _id, createdAt, updatedAt, ...banner } = item || {}
          return {
            ...banner,
            title: '',
            highlight: '',
            subtitle: '',
            tag: '',
            features: []
          }
        })
      }
      try {
        uni.showLoading({ title: '保存中' })
        const saved = await adminAction('saveBannerConfig', payload)
        uni.hideLoading()
        await this.applyBannerConfig(saved && saved.settings ? saved : payload)
        uni.showToast({ title: '已保存', icon: 'success' })
      } catch (error) {
        uni.hideLoading()
        showCloudError(error)
        return
      }
    },
    async loadBannerConfig() {
      const config = await getDisplayBannerConfigFromCloud(true)
      await this.applyBannerConfig(config)
    }
  },
  async onLoad() {
    if (!ensurePageAccess('/pages/admin/banner-config/index', '需要店长权限')) return
    try {
      await this.loadBannerConfig()
    } catch (error) {
      showCloudError(error)
      const config = getDefaultBannerConfig()
      this.settings = config.settings
      this.banners = config.banners
    }
  },
  async onShow() {
    try {
      const [products, groups] = await Promise.all([
        getAdminProducts(),
        getActiveGroups().catch(() => [])
      ])
      this.routeOptions = [
        { label: '不跳转', value: '' },
        ...groups.map(item => ({
          label: `团购：${item.title || item.name || '未命名团购'}`,
          value: `/pages/category/index?groupId=${item.id || item._id || item.groupId}`
        })),
        ...products.map(item => ({ label: item.name, value: `/pages/product/detail?id=${item.id}` }))
      ]
    } catch {
      this.routeOptions = [{ label: '不跳转', value: '' }]
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.banner-page { padding-bottom: 150rpx; }
.preview { margin-top: 20rpx; padding: 24rpx; }
.preview__head { @include flex-between; margin-bottom: 20rpx; }
.preview__title { color: $color-text-main; font-size: 34rpx; font-weight: 800; }
.preview__sub { margin-top: 8rpx; color: $color-text-light; font-size: 24rpx; }
.preview__badge { padding: 10rpx 18rpx; color: $color-primary; background: $color-primary-light; border: 1rpx solid rgba(255,92,114,.18); border-radius: $radius-pill; font-size: 24rpx; font-weight: 700; }
.preview__swiper { height: 338rpx; overflow: hidden; border-radius: $radius-xl; background: $color-bg-deep; }
.preview__slide { position: relative; height: 100%; overflow: hidden; border-radius: $radius-xl; }
.preview__slide::after { content: ''; position: absolute; left: 0; top: 0; z-index: 2; width: 68%; height: 100%; background: linear-gradient(90deg, rgba(24,22,20,.68) 0%, rgba(24,22,20,.38) 58%, rgba(24,22,20,0) 100%); pointer-events: none; }
.preview__media { position: absolute; left: 0; top: 0; z-index: 1; width: 100%; height: 100%; }
.preview__image { display: block; width: 100%; height: 100%; }
.preview__copy { position: relative; z-index: 3; box-sizing: border-box; width: 54%; height: 100%; padding: 38rpx 26rpx 30rpx 30rpx; }
.preview__tag { display: inline-flex; align-items: center; max-width: 100%; box-sizing: border-box; height: 40rpx; padding: 0 18rpx; color: #fff; background: rgba(255,255,255,.18); border: 1rpx solid rgba(255,255,255,.26); border-radius: $radius-pill; font-size: 20rpx; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview__dots { position: relative; z-index: 4; display: flex; justify-content: center; gap: 12rpx; height: 0; transform: translateY(-28rpx); }
.preview__dots text { width: 22rpx; height: 8rpx; background: rgba(255,255,255,.9); border-radius: $radius-pill; transition: width .2s ease, background .2s ease; }
.preview__dots text.is-active { width: 32rpx; background: $color-primary; }
.settings { margin-top: 22rpx; padding: 8rpx 24rpx 24rpx; }
.form-row { @include flex-between; min-height: 104rpx; border-bottom: 1rpx solid $color-border-light; }
.form-row__label { color: $color-text-main; font-size: 30rpx; font-weight: 800; }
.form-row__hint { margin-top: 8rpx; color: $color-text-light; font-size: 23rpx; }
.number-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18rpx; margin-top: 24rpx; }
label text { display: block; margin-bottom: 10rpx; color: $color-text-light; font-size: 23rpx; }
input, .picker-text { min-height: 76rpx; padding: 0 18rpx; color: $color-text-main; background: #fff; border: 1rpx solid $color-border-light; border-radius: $radius-pill; font-size: 26rpx; line-height: 76rpx; }
.upload-inline { width: 100%; height: 70rpx; margin-top: 14rpx; color: $color-primary; background: $color-primary-light; border: 1rpx solid rgba(255,92,114,.18); border-radius: $radius-pill; font-size: 25rpx; font-weight: 700; line-height: 70rpx; }
.banner-card { margin-top: 22rpx; padding: 24rpx; }
.banner-card__top { display: flex; align-items: center; gap: 18rpx; }
.banner-card__top image { width: 126rpx; height: 96rpx; border-radius: $radius-card; }
.banner-card__main { flex: 1; min-width: 0; }
.banner-card__title { color: $color-text-main; font-size: 31rpx; font-weight: 800; @include text-ellipsis; }
.banner-card__meta { margin-top: 10rpx; color: $color-text-light; font-size: 23rpx; }
.edit-grid { display: grid; grid-template-columns: 1fr; gap: 18rpx; margin-top: 24rpx; }
.banner-card__actions { display: flex; gap: 18rpx; margin-top: 22rpx; }
.banner-card__actions button { flex: 1; }
.bottom-actions { position: fixed; left: 0; right: 0; bottom: 0; z-index: 61; display: flex; gap: 18rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255,253,249,.98); border-top: 1rpx solid $color-border-light; }
.bottom-actions button { flex: 1; }
button[disabled] { opacity: .45; }
</style>
