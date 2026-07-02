<template>
  <view class="page store-settings">
    <CustomNavBar title="门店配置" showBack />

    <view class="config-tabs card">
      <view
        v-for="tab in configTabs"
        :key="tab.key"
        class="config-tab"
        :class="{ active: activeConfigTab === tab.key }"
        @tap="activeConfigTab = tab.key"
      >{{ tab.text }}</view>
    </view>

    <view v-if="activeConfigTab === 'store'" class="card form-card">
      <view class="section-title">基础信息</view>
      <view class="logo-setting">
        <view class="logo-setting__label">店铺Logo</view>
        <view class="logo-setting__body">
          <view class="logo-setting__preview" @tap="chooseLogo">
            <image v-if="logoPreview" :src="logoPreview" mode="aspectFill" />
            <text v-else>{{ logoText }}</text>
          </view>
          <view class="logo-setting__main">
            <view class="logo-setting__title">用于导航栏、我的页面等品牌展示</view>
            <view class="logo-setting__path">{{ form.logoFileID || form.logo || '未设置' }}</view>
            <button class="logo-setting__btn" :disabled="uploadingLogo" @tap="chooseLogo">
              {{ uploadingLogo ? '上传中...' : '上传Logo' }}
            </button>
          </view>
        </view>
      </view>
      <view v-for="field in baseFields" :key="field.key" class="form-line">
        <view class="form-line__label">{{ field.label }}</view>
        <input
          v-if="field.type !== 'textarea'"
          v-model.trim="form[field.key]"
          :placeholder="field.placeholder"
          :maxlength="field.maxlength || 120"
        />
        <textarea
          v-else
          v-model.trim="form[field.key]"
          :placeholder="field.placeholder"
          :maxlength="field.maxlength || 240"
        />
      </view>
    </view>

    <view v-if="activeConfigTab === 'store'" class="card form-card">
      <view class="section-title">履约与客服</view>
      <view v-for="field in serviceFields" :key="field.key" class="form-line">
        <view class="form-line__label">{{ field.label }}</view>
        <input
          v-if="field.type !== 'textarea'"
          v-model.trim="form[field.key]"
          :placeholder="field.placeholder"
          :maxlength="field.maxlength || 120"
        />
        <textarea
          v-else
          v-model.trim="form[field.key]"
          :placeholder="field.placeholder"
          :maxlength="field.maxlength || 240"
        />
      </view>
    </view>

    <view v-if="activeConfigTab === 'order'" class="card form-card">
      <view class="section-title">下单规则</view>
      <view v-for="field in checkoutFields" :key="field.key" class="form-line">
        <view class="form-line__label">{{ field.label }}</view>
        <input
          v-if="!field.number"
          v-model.trim="form.checkout[field.key]"
          :placeholder="field.placeholder"
          :maxlength="field.maxlength || 120"
        />
        <input
          v-else
          v-model.trim="form.checkout[field.key]"
          type="number"
          :placeholder="field.placeholder"
        />
      </view>
    </view>

    <view v-if="activeConfigTab === 'message'" class="card form-card">
      <view class="section-title">消息模板</view>
      <view v-for="field in templateFields" :key="field.key" class="form-line">
        <view class="form-line__label">{{ field.label }}</view>
        <input
          v-model.trim="form[field.key]"
          :placeholder="field.placeholder"
          :maxlength="field.maxlength || 120"
        />
      </view>
    </view>

    <view class="footer">
      <button class="primary-btn" :disabled="saving" @tap="submit">
        {{ saving ? '保存中' : saveButtonText }}
      </button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getShopConfig, saveShopConfigToCloud } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'
import { resolveImageUrl, uploadImageToCloud } from '@/utils/image'

function createInitialForm() {
  return {
    name: '',
    bakeryName: '',
    slogan: '',
    bakeryTag: '',
    assurance: '',
    deliveryRange: '统一配送',
    deliveryRangeDetail: '满额后统一配送，按团购截单后打包发货',
    deliveryTime: '次日打包发货',
    customerService: '',
    phone: '',
    address: '',
    orderTemplateId: '',
    afterSalesTemplateId: '',
    checkout: {
      deliveryTime: '次日打包发货',
      notePlaceholder: '口味、偏好或建议等(选填)',
      serviceText: '',
      payText: '微信支付',
      deliveryFee: 0,
      minimumOrderAmount: 88,
      groupDiscount: 0
    }
  }
}

export default {
  components: { CustomNavBar },
  data() {
    return {
      form: createInitialForm(),
      saving: false,
      uploadingLogo: false,
      logoPreview: '',
      activeConfigTab: 'store',
      configTabs: [
        { key: 'store', text: '门店资料' },
        { key: 'order', text: '下单规则' },
        { key: 'message', text: '消息模板' }
      ],
      baseFields: [
        { key: 'name', label: '品牌名称', placeholder: '例如：初炉' },
        { key: 'bakeryName', label: '门店全称', placeholder: '例如：初炉烘焙坊' },
        { key: 'slogan', label: '品牌标语', placeholder: '例如：初炉新鲜，趁热成团 ♡' },
        { key: 'bakeryTag', label: '品牌角标', placeholder: '例如：安心烘焙' },
        { key: 'assurance', label: '服务承诺', placeholder: '例如：食材严格把控 · 新鲜现做 · 冷链打包', type: 'textarea', maxlength: 120 }
      ],
      serviceFields: [
        { key: 'deliveryRange', label: '配送方式', placeholder: '统一配送' },
        { key: 'deliveryRangeDetail', label: '配送说明', placeholder: '例如：满额后统一配送，按团购截单后打包发货', type: 'textarea', maxlength: 120 },
        { key: 'deliveryTime', label: '默认配送时间', placeholder: '例如：次日打包发货' },
        { key: 'customerService', label: '客服时间', placeholder: '例如：8:00–20:00' },
        { key: 'phone', label: '联系电话', placeholder: '例如：400-888-2025' },
        { key: 'address', label: '门店地址', placeholder: '请输入门店详细地址', type: 'textarea', maxlength: 120 }
      ],
      templateFields: [
        { key: 'orderTemplateId', label: '下单订阅模板ID', placeholder: '微信公众平台订阅消息模板ID' },
        { key: 'afterSalesTemplateId', label: '售后订阅模板ID', placeholder: '微信公众平台订阅消息模板ID' }
      ],
      checkoutFields: [
        { key: 'deliveryTime', label: '确认订单配送文案', placeholder: '例如：次日打包发货' },
        { key: 'notePlaceholder', label: '订单备注提示', placeholder: '例如：口味、偏好或建议等(选填)' },
        { key: 'serviceText', label: '支付说明', placeholder: '例如：新鲜现做，按单打包发货，感谢等待～' },
        { key: 'payText', label: '支付按钮文案', placeholder: '例如：微信支付' },
        { key: 'deliveryFee', label: '默认运费', placeholder: '例如：6', number: true },
        { key: 'minimumOrderAmount', label: '最低下单金额', placeholder: '例如：88', number: true },
        { key: 'groupDiscount', label: '默认团购优惠', placeholder: '例如：4', number: true }
      ]
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/store-settings/index', '需要店长权限')) return
  },
  async onShow() {
    if (!ensurePageAccess('/pages/admin/store-settings/index', '需要店长权限')) return
    // 只在表单为空时从后端加载，避免编辑中切换页面后表单被重置
    if (!this.form.name) {
      const config = await getShopConfig()
      this.form = {
        ...createInitialForm(),
        ...config,
        checkout: {
          ...createInitialForm().checkout,
          ...(config.checkout || {}),
          minimumOrderAmount: Number(config.checkout && config.checkout.minimumOrderAmount !== undefined && config.checkout.minimumOrderAmount !== ''
            ? config.checkout.minimumOrderAmount
            : (config.checkout && config.checkout.freeShippingAmount !== undefined && config.checkout.freeShippingAmount !== '')
              ? config.checkout.freeShippingAmount
              : 88)
        }
      }
      await this.resolveLogoPreview()
    }
  },
  computed: {
    logoText() {
      return (this.form.name || this.form.bakeryName || '初').slice(0, 1)
    },
    activeTabText() {
      const tab = this.configTabs.find(item => item.key === this.activeConfigTab)
      return tab ? tab.text : '门店配置'
    },
    saveButtonText() {
      return `保存${this.activeTabText}`
    }
  },
  methods: {
    async resolveLogoPreview() {
      const logo = this.form.logoFileID || this.form.logo
      this.logoPreview = logo ? await resolveImageUrl(logo, logo) : ''
    },
    chooseLogo() {
      if (this.uploadingLogo) return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async res => {
          const filePath = res.tempFilePaths && res.tempFilePaths[0]
          if (!filePath) return
          this.uploadingLogo = true
          uni.showLoading({ title: '上传中' })
          try {
            const fileID = await uploadImageToCloud(filePath, 'icons')
            this.$set(this.form, 'logoFileID', fileID)
            this.$set(this.form, 'logo', fileID)
            this.logoPreview = await resolveImageUrl(fileID, fileID)
            uni.showToast({ title: 'Logo已上传', icon: 'success' })
          } catch (error) {
            showCloudError(error)
          } finally {
            uni.hideLoading()
            this.uploadingLogo = false
          }
        }
      })
    },
    validate() {
      if (this.activeConfigTab === 'store') {
        if (!this.form.name) return '请填写品牌名称'
        if (!this.form.slogan) return '请填写品牌标语'
        if (!this.form.address) return '请填写门店地址'
        if (!this.form.phone) return '请填写联系电话'
      }
      if (this.activeConfigTab === 'order') {
        if (!this.form.checkout.deliveryTime) return '请填写发货时间文案'
        if (Number(this.form.checkout.minimumOrderAmount || 0) < 0) return '最低下单金额不能小于0'
        if (Number(this.form.checkout.deliveryFee || 0) < 0) return '默认运费不能小于0'
      }
      if (this.activeConfigTab === 'message') {
        if (!this.form.orderTemplateId && !this.form.afterSalesTemplateId) return '请至少填写一个订阅模板ID'
      }
      return ''
    },
    async submit() {
      const message = this.validate()
      if (message) {
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      this.saving = true
      try {
        const payload = {
          ...this.form,
          logo: this.form.logoFileID || this.form.logo,
          checkout: {
            ...this.form.checkout,
            deliveryFee: Number(this.form.checkout.deliveryFee || 0),
            minimumOrderAmount: Number(this.form.checkout.minimumOrderAmount || 0),
            freeShippingAmount: Number(this.form.checkout.minimumOrderAmount || 0),
            groupDiscount: Number(this.form.checkout.groupDiscount || 0)
          }
        }
        await saveShopConfigToCloud(payload)
        uni.showToast({ title: `${this.activeTabText}已保存`, icon: 'success' })
      } catch (error) {
        showCloudError(error)
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.store-settings {
  padding-bottom: 180rpx;
}

.config-tabs {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 12rpx;
}

.config-tab {
  @include flex-center;
  flex: 1;
  min-width: 0;
  height: 60rpx;
  color: $color-text-regular;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-pill;
  font-size: 24rpx;
  font-weight: 700;
}

.config-tab.active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(255, 92, 114, .2);
}

.form-card {
  margin-top: 24rpx;
  padding: 16rpx 28rpx;
}

.section-title {
  padding: 12rpx 0 8rpx;
  color: $color-text-main;
  font-size: 34rpx;
  font-weight: 800;
}

.logo-setting {
  padding: 22rpx 0;
  border-bottom: 1rpx solid $color-border-light;
}

.logo-setting__label {
  color: $color-text-main;
  font-size: 28rpx;
  font-weight: 700;
}

.logo-setting__body {
  display: flex;
  gap: 20rpx;
  margin-top: 18rpx;
}

.logo-setting__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 116rpx;
  height: 116rpx;
  overflow: hidden;
  color: #fff;
  background: $color-primary;
  border-radius: $radius-md;
  font-size: 42rpx;
  font-weight: 800;
}

.logo-setting__preview image {
  width: 100%;
  height: 100%;
}

.logo-setting__main {
  flex: 1;
  min-width: 0;
}

.logo-setting__title {
  color: $color-text-main;
  font-size: 26rpx;
  font-weight: 700;
}

.logo-setting__path {
  margin-top: 8rpx;
  color: $color-text-light;
  font-size: 22rpx;
  line-height: 1.35;
  word-break: break-all;
}

.logo-setting__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 176rpx;
  height: 62rpx;
  margin: 16rpx 0 0;
  padding: 0 24rpx;
  color: $color-primary;
  background: $color-primary-light;
  border: 1rpx solid rgba(255, 92, 114, 0.18);
  border-radius: $radius-pill;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 62rpx;
}

.logo-setting__btn[disabled] {
  color: $color-text-light;
  background: $color-bg-light;
}

.form-line {
  padding: 22rpx 0;
  border-bottom: 1rpx solid $color-border-light;
}

.form-line:last-child {
  border-bottom: none;
}

.form-line__label {
  color: $color-text-main;
  font-size: 28rpx;
  font-weight: 700;
}

.form-line input,
.form-line textarea {
  width: 100%;
  margin-top: 14rpx;
  padding: 0 18rpx;
  color: $color-text-main;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 28rpx;
}

.form-line input {
  height: 72rpx;
}

.form-line textarea {
  min-height: 110rpx;
  padding-top: 16rpx;
  padding-bottom: 16rpx;
  line-height: 1.55;
}

.footer {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 0;
  padding: 16rpx 0;
  @include safe-bottom(24rpx);
  background: linear-gradient(180deg, rgba($color-bg, 0) 0%, rgba($color-bg, 0.94) 30%, $color-bg 100%);
}

.primary-btn {
  @include primary-button;
  width: 100%;
  margin: 0;
}

.primary-btn[disabled] {
  background: #f4bdc8;
  box-shadow: none;
}
</style>
