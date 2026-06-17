<template>
  <view class="page address-page">
    <CustomNavBar title="收货地址" showBack />

    <view v-if="addresses.length" class="address-list">
      <view v-for="item in renderAddresses" :key="item._renderKey" class="address-wrap">
        <AddressCard
          class="address-card"
          :address="displayAddress(item)"
          variant="receiver"
          :selectable="selectMode"
          :checked="selectedId === addressId(item)"
          @select="handleSelect(item)"
        />
        <view class="address-actions">
          <view class="address-meta">
            <text v-if="item.isDefault" class="default-tag">默认地址</text>
            <text v-else class="set-default" @tap.stop="makeDefault(item)">设为默认</text>
          </view>
          <view class="address-buttons">
            <button class="ghost-btn" @tap.stop="editAddress(item)">编辑</button>
            <button class="ghost-btn ghost-btn--danger" @tap.stop="removeAddress(item)">删除</button>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty card">
      <view class="empty__title">还没有收货地址</view>
      <view class="empty__desc">先添加一个常用地址，下单会更顺手。</view>
    </view>

    <view class="footer">
      <button class="primary-btn" @tap="addAddress">新增收货地址</button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AddressCard from '@/components/AddressCard/AddressCard.vue'
import { deleteAddress, getAddresses, setDefaultAddress } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

const SELECTED_ADDRESS_KEY = 'buyer_selected_address'

export default {
  components: { CustomNavBar, AddressCard },
  data() {
    return {
      addresses: [],
      selectMode: false,
      selectedId: ''
    }
  },
  computed: {
    renderAddresses() {
      return this.addresses.map((item, index) => ({
        ...item,
        _renderKey: item._id || item.address || `address_${index}`
      }))
    }
  },
  onLoad(query) {
    if (!ensurePageAccess('/pages/address/list/index', '收货地址需要登录后使用')) return
    this.selectMode = String(query.select || '') === '1'
  },
  onShow() {
    if (!ensurePageAccess('/pages/address/list/index', '收货地址需要登录后使用')) return
    this.loadAddresses()
    const selected = uni.getStorageSync(SELECTED_ADDRESS_KEY)
    this.selectedId = selected ? this.addressId(selected) : ''
  },
  methods: {
    async loadAddresses() {
      this.addresses = await getAddresses()
    },
    displayAddress(item) {
      return {
        ...item,
        tag: item.isDefault ? '默认' : (item.tag || '')
      }
    },
    addressId(item) {
      return (item && (item.id || item._id)) || ''
    },
    handleSelect(item) {
      if (!this.selectMode) return
      uni.setStorageSync(SELECTED_ADDRESS_KEY, item)
      uni.navigateBack()
    },
    addAddress() {
      uni.navigateTo({ url: '/pages/address/edit/index' })
    },
    editAddress(item) {
      const id = this.addressId(item)
      if (!id) {
        uni.showToast({ title: '请先新增真实地址后再编辑', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/pages/address/edit/index?id=${id}` })
    },
    async makeDefault(item) {
      const id = this.addressId(item)
      if (!id) {
        uni.showToast({ title: '当前已是默认演示地址', icon: 'none' })
        return
      }
      try {
        uni.showLoading({ title: '设置中' })
        await setDefaultAddress(id)
        uni.hideLoading()
        uni.showToast({ title: '已设为默认', icon: 'success' })
        this.loadAddresses()
      } catch (error) {
        uni.hideLoading()
        showCloudError(error)
      }
    },
    removeAddress(item) {
      const id = this.addressId(item)
      if (!id) {
        uni.showToast({ title: '默认演示地址不可删除', icon: 'none' })
        return
      }
      uni.showModal({
        title: '删除地址',
        content: `确认删除“${item.receiver}”的收货地址吗？`,
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            uni.showLoading({ title: '删除中' })
            await deleteAddress(id)
            uni.hideLoading()
            uni.showToast({ title: '已删除', icon: 'success' })
            if (this.selectedId === id) {
              uni.removeStorageSync(SELECTED_ADDRESS_KEY)
              this.selectedId = ''
            }
            this.loadAddresses()
          } catch (error) {
            uni.hideLoading()
            showCloudError(error)
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.address-page {
  padding-bottom: 180rpx;
}

.address-list {
  margin-top: 24rpx;
}

.address-wrap + .address-wrap {
  margin-top: 20rpx;
}

.address-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 12rpx 12rpx 0;
}

.address-meta {
  display: flex;
  align-items: center;
  min-height: 64rpx;
}

.default-tag,
.set-default {
  padding: 10rpx 18rpx;
  border-radius: $radius-pill;
  font-size: 24rpx;
}

.default-tag {
  color: $color-primary;
  background: $color-primary-light;
}

.set-default {
  color: $color-orange;
  background: $color-orange-light;
}

.address-buttons {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.ghost-btn {
  min-width: 120rpx;
  height: 64rpx;
  margin: 0;
  padding: 0 24rpx;
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid rgba(123, 90, 77, 0.2);
  border-radius: $radius-pill;
  font-size: 26rpx;
  line-height: 64rpx;
}

.ghost-btn--danger {
  color: $color-primary;
  border-color: rgba(255, 79, 102, 0.22);
}

.empty {
  margin-top: 24rpx;
  padding: 40rpx 32rpx;
  text-align: center;
}

.empty__title {
  color: $color-text-main;
  font-size: 34rpx;
  font-weight: 800;
}

.empty__desc {
  margin-top: 14rpx;
  color: $color-text-regular;
  font-size: 26rpx;
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
