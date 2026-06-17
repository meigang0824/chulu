<template>
  <view class="page edit-page">
    <CustomNavBar :title="form._id ? '编辑地址' : '新增地址'" showBack />

    <view class="card form-card">
      <view v-for="field in fields" :key="field.key" class="form-line">
        <view class="form-line__label">{{ field.label }}</view>
        <input
          v-if="field.type !== 'textarea'"
          v-model.trim="form[field.key]"
          :type="field.inputType || 'text'"
          :maxlength="field.maxlength || 140"
          :placeholder="field.placeholder"
        />
        <textarea
          v-else
          v-model.trim="form[field.key]"
          :maxlength="field.maxlength || 240"
          :placeholder="field.placeholder"
        />
      </view>

      <view class="switch-line">
        <view>
          <view class="switch-line__title">设为默认地址</view>
          <view class="switch-line__desc">确认订单时优先使用这条地址</view>
        </view>
        <switch :checked="form.isDefault" color="#FF4F66" @change="form.isDefault = $event.detail.value" />
      </view>
    </view>

    <view class="footer">
      <button class="primary-btn" @tap="submit">保存地址</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getAddresses, saveAddress } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

export default {
  components: { CustomNavBar },
  data() {
    return {
      form: {
        _id: '',
        receiver: '',
        phone: '',
        address: '',
        note: '',
        tag: '',
        isDefault: true
      },
      fields: [
        { key: 'receiver', label: '收货人', placeholder: '请输入收货人姓名', maxlength: 20 },
        { key: 'phone', label: '联系电话', placeholder: '请输入手机号', inputType: 'number', maxlength: 11 },
        { key: 'address', label: '详细地址', placeholder: '请输入小区 / 楼栋 / 门牌号', type: 'textarea', maxlength: 120 },
        { key: 'tag', label: '地址标签', placeholder: '例如：家 / 公司 / 常用', maxlength: 12 },
        { key: 'note', label: '配送备注', placeholder: '例如：到了请电话联系', type: 'textarea', maxlength: 80 }
      ]
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/address/edit/index', '收货地址需要登录后使用')) return
    if (!query.id) return
    const rows = await getAddresses()
    const found = rows.find(item => item.id === query.id || item._id === query.id)
    if (found) this.form = { ...this.form, ...found }
  },
  methods: {
    validate() {
      if (!this.form.receiver) return '请填写收货人'
      if (!/^1\d{10}$/.test(this.form.phone)) return '请填写正确手机号'
      if (!this.form.address || this.form.address.length < 6) return '请填写详细地址'
      return ''
    },
    async submit() {
      const message = this.validate()
      if (message) {
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      try {
        uni.showLoading({ title: '保存中' })
        await saveAddress(this.form)
        uni.hideLoading()
        uni.showToast({ title: '地址已保存', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 500)
      } catch (error) {
        uni.hideLoading()
        showCloudError(error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.edit-page {
  padding-bottom: 180rpx;
}

.form-card {
  margin-top: 24rpx;
  padding: 12rpx 28rpx;
}

.form-line {
  padding: 22rpx 0;
  border-bottom: 1rpx solid $color-border-light;
}

.form-line:last-of-type {
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
  color: $color-text-main;
  font-size: 28rpx;
}

.form-line input {
  height: 60rpx;
}

.form-line textarea {
  min-height: 120rpx;
  line-height: 1.55;
}

.switch-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 22rpx 0 10rpx;
}

.switch-line__title {
  color: $color-text-main;
  font-size: 28rpx;
  font-weight: 700;
}

.switch-line__desc {
  margin-top: 8rpx;
  color: $color-text-light;
  font-size: 24rpx;
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
</style>
