<template>
  <view class="page permission-page">
    <CustomNavBar title="权限设置" showBack />

    <view class="summary-grid">
      <view class="summary-card card">
        <text>{{ accounts.length }}</text>
        <view>全部用户</view>
      </view>
      <view class="summary-card card">
        <text>{{ managerCount }}</text>
        <view>店长账号</view>
      </view>
      <view class="summary-card card">
        <text>{{ buyerCount }}</text>
        <view>普通用户</view>
      </view>
    </view>

    <view class="search-card card">
      <AppIcon name="search" :size="30" color="#9A7D70" />
      <input v-model="keyword" placeholder="搜索昵称、账号或手机号" />
      <text v-if="keyword" class="search-card__clear" @tap="keyword = ''">×</text>
    </view>

    <view class="hint-card card">
      设置为店长后，该用户重新进入小程序即可访问店长端。当前登录账号、游客和店主账号不可在这里修改。
    </view>

    <view class="account-list">
      <EmptyState
        v-if="!loading && !filteredAccounts.length"
        title="暂无用户"
        desc="用户登录后会出现在这里。"
      />
      <view v-for="item in filteredAccounts" :key="item.id" class="account-card card">
        <view class="account-card__main">
          <view class="account-card__avatar">
            <image v-if="item.avatarDisplay" :src="item.avatarDisplay" mode="aspectFill" />
            <text v-else>{{ item.avatarText || '用' }}</text>
          </view>
          <view class="account-card__info">
            <view class="account-card__name-row">
              <text class="account-card__name">{{ item.displayName }}</text>
              <text class="role-tag" :class="'role-tag--' + item.role">{{ roleText(item.role) }}</text>
              <text v-if="item.isSelf" class="self-tag">当前账号</text>
            </view>
            <view class="account-card__meta">
              {{ item.username || item.id }}
            </view>
            <view class="account-card__meta">
              {{ item.openidBound ? '已绑定微信' : '未绑定微信' }}{{ item.phone ? ` · ${item.phone}` : '' }}
            </view>
          </view>
        </view>
        <view class="account-card__actions">
          <button
            class="permission-btn"
            :class="{ 'permission-btn--danger': isManager(item.role) }"
            :disabled="!canEdit(item) || savingId === item.id"
            @tap="confirmRoleChange(item)"
          >
            {{ actionText(item) }}
          </button>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import { accountAPI } from '@/services/apiClient'
import { ensurePageAccess, getAuthSession } from '@/utils/auth'
import { resolveImageUrl } from '@/utils/image'
import { showCloudError } from '@/utils/apiError'

export default {
  components: { CustomNavBar, AppIcon, EmptyState },
  data() {
    return {
      accounts: [],
      keyword: '',
      loading: true,
      savingId: ''
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/permission/index', '需要店长权限')) return
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/permission/index', '需要店长权限')) return
    this.loadAccounts()
  },
  computed: {
    filteredAccounts() {
      const keyword = this.keyword.trim().toLowerCase()
      if (!keyword) return this.accounts
      return this.accounts.filter(item => [
        item.displayName,
        item.username,
        item.phone,
        item.id,
        this.roleText(item.role)
      ].join(' ').toLowerCase().includes(keyword))
    },
    managerCount() {
      return this.accounts.filter(item => this.isManager(item.role)).length
    },
    buyerCount() {
      return this.accounts.filter(item => item.role === 'buyer').length
    }
  },
  methods: {
    authToken() {
      const session = getAuthSession()
      return session && session.token ? session.token : ''
    },
    async loadAccounts() {
      try {
        this.loading = true
        const rows = await accountAPI.list(this.authToken())
        this.accounts = await Promise.all((rows || []).map(async item => ({
          ...item,
          avatarDisplay: item.avatar ? await resolveImageUrl(item.avatar, item.avatar) : ''
        })))
      } catch (error) {
        showCloudError(error)
      } finally {
        this.loading = false
      }
    },
    isManager(role) {
      return ['owner', 'manager', 'staff'].includes(role)
    },
    roleText(role) {
      const map = { owner: '店主', manager: '店长', staff: '店员', buyer: '普通用户', guest: '游客' }
      return map[role] || '普通用户'
    },
    canEdit(item) {
      return item && !item.isSelf && !['guest', 'owner'].includes(item.role)
    },
    actionText(item) {
      if (this.savingId === item.id) return '保存中'
      if (!this.canEdit(item)) return '不可修改'
      return this.isManager(item.role) ? '设普通' : '设店长'
    },
    confirmRoleChange(item) {
      if (!this.canEdit(item) || this.savingId) return
      const nextRole = this.isManager(item.role) ? 'buyer' : 'manager'
      const nextText = nextRole === 'manager' ? '店长' : '普通用户'
      uni.showModal({
        title: '修改权限',
        content: `确认将“${item.displayName}”设置为${nextText}吗？`,
        success: async ({ confirm }) => {
          if (!confirm) return
          await this.updateRole(item, nextRole)
        }
      })
    },
    async updateRole(item, role) {
      try {
        this.savingId = item.id
        const next = await accountAPI.updateRole(item.id, role, this.authToken())
        this.accounts = this.accounts.map(account => account.id === item.id
          ? { ...account, ...(next || {}), avatarDisplay: account.avatarDisplay }
          : account)
        uni.showToast({ title: role === 'manager' ? '已设为店长' : '已设为普通用户', icon: 'success' })
      } catch (error) {
        showCloudError(error)
      } finally {
        this.savingId = ''
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.permission-page {
  padding-bottom: 80rpx;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 20rpx;
}

.summary-card {
  padding: 22rpx 10rpx;
  text-align: center;
}

.summary-card text {
  @include text-price(42rpx);
  font-weight: $font-weight-heavy;
}

.summary-card view {
  margin-top: 6rpx;
  @include text-caption($color-text-regular);
}

.search-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  height: 82rpx;
  margin-top: 22rpx;
  padding: 0 24rpx;
  border-radius: $radius-pill;
}

.search-card input {
  flex: 1;
  min-width: 0;
  color: $color-text-main;
  font-size: 28rpx;
}

.search-card__clear {
  color: $color-text-placeholder;
  font-size: 34rpx;
}

.hint-card {
  margin-top: 18rpx;
  padding: 22rpx 24rpx;
  @include text-caption($color-text-regular);
  line-height: 1.5;
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}

.account-card {
  padding: 24rpx;
}

.account-card__main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.account-card__avatar {
  @include flex-center;
  flex-shrink: 0;
  width: 84rpx;
  height: 84rpx;
  overflow: hidden;
  color: #fff;
  background: $gradient-primary;
  border-radius: 50%;
  font-size: 28rpx;
  font-weight: $font-weight-heavy;
}

.account-card__avatar image {
  width: 100%;
  height: 100%;
}

.account-card__info {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
}

.account-card__name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.account-card__name {
  max-width: 260rpx;
  @include text-body-strong;
  @include text-ellipsis;
}

.account-card__meta {
  margin-top: 8rpx;
  @include text-helper($color-text-light);
  @include text-ellipsis;
}

.role-tag,
.self-tag {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border-radius: $radius-pill;
  font-size: 22rpx;
  line-height: 1.25;
}

.role-tag {
  color: $color-text-regular;
  background: $color-bg-deep;
}

.role-tag--owner,
.role-tag--manager,
.role-tag--staff {
  color: $color-primary;
  background: $color-primary-pale;
}

.role-tag--guest {
  color: $color-text-light;
  background: $color-border-light;
}

.self-tag {
  color: $color-orange;
  background: $color-orange-light;
}

.account-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20rpx;
}

.permission-btn {
  min-width: 168rpx;
  height: 64rpx;
  padding: 0 28rpx;
  color: #fff;
  background: $gradient-primary;
  border-radius: $radius-pill;
  font-size: 26rpx;
  font-weight: $font-weight-semibold;
  line-height: 64rpx;
}

.permission-btn--danger {
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
}

.permission-btn[disabled] {
  color: $color-text-light;
  background: $color-bg-deep;
  border-color: transparent;
}
</style>
