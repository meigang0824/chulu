<template>
  <view class="page category-manage">
    <CustomNavBar title="分类管理" showBack />

    <view class="tip-bar">
      管理商品分类，分类将显示在商品页筛选中。
    </view>

    <view class="category-list">
      <view v-for="(cat, index) in categories" :key="cat.key" class="category-item card">
        <view class="category-item__main">
          <view class="category-item__sort">{{ index + 1 }}</view>
          <view class="category-item__info">
            <view class="category-item__name">{{ cat.text }}</view>
            <view class="category-item__key">key: {{ cat.key }}</view>
          </view>
          <view class="category-item__count">{{ getProductCount(cat.key) }} 款商品</view>
        </view>
        <view class="category-item__actions">
          <button class="ghost-btn" @tap="editCategory(cat)">编辑</button>
          <button class="ghost-btn danger" @tap="deleteCategory(cat)" :disabled="getProductCount(cat.key) > 0">删除</button>
        </view>
      </view>

      <view class="category-add" @tap="addCategory">
        <text>+ 新增分类</text>
      </view>
    </view>

    <!-- 编辑弹窗 -->
    <view v-if="showEditModal" class="modal-overlay" @tap="showEditModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text>{{ editingCategory ? '编辑分类' : '新增分类' }}</text>
          <text class="modal-close" @tap="showEditModal = false">×</text>
        </view>
        <view class="modal-body">
          <view class="form-line">
            <text class="form-label">分类名称</text>
            <input v-model="form.text" placeholder="如：蛋糕甜点" />
          </view>
          <view class="form-line">
            <text class="form-label">分类Key</text>
            <input v-model="form.key" placeholder="如：cake（英文，唯一标识）" />
          </view>
          <view class="form-tip">
            分类Key用于商品数据关联，建议使用英文小写，如 cake、bread、snack
          </view>
        </view>
        <view class="modal-footer">
          <button class="cancel-btn" @tap="showEditModal = false">取消</button>
          <button class="confirm-btn" @tap="saveCategory">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { productAPI, shopAPI } from '@/services/apiClient'
import { ensurePageAccess, getAuthSession } from '@/utils/auth'

export default {
  components: { CustomNavBar },
  data() {
    return {
      categories: [],
      products: [],
      showEditModal: false,
      editingCategory: null,
      form: { key: '', text: '' }
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/category-manage/index', '需要店长权限')) return
  },
  onShow() {
    if (!ensurePageAccess('/pages/admin/category-manage/index', '需要店长权限')) return
    this.loadData()
  },
  methods: {
    authToken() {
      const session = getAuthSession()
      return session && session.token ? session.token : ''
    },
    async loadData() {
      try {
        // 获取分类（从店铺配置）
        const shop = await shopAPI.get()
        this.categories = shop.categories || [
          { key: 'cake', text: '蛋糕甜点' },
          { key: 'bread', text: '面包吐司' },
          { key: 'snack', text: '下午茶' }
        ]

        // 获取商品统计
        this.products = await productAPI.list({}, this.authToken()) || []
      } catch (e) {
        console.error('加载失败:', e)
        // 使用默认分类
        this.categories = [
          { key: 'cake', text: '蛋糕甜点' },
          { key: 'bread', text: '面包吐司' },
          { key: 'snack', text: '下午茶' }
        ]
      }
    },
    getProductCount(key) {
      return this.products.filter(p => p.categoryKey === key).length
    },
    addCategory() {
      this.editingCategory = null
      this.form = { key: '', text: '' }
      this.showEditModal = true
    },
    editCategory(cat) {
      this.editingCategory = cat
      this.form = { key: cat.key, text: cat.text }
      this.showEditModal = true
    },
    deleteCategory(cat) {
      if (this.getProductCount(cat.key) > 0) {
        uni.showToast({ title: '该分类下有商品，无法删除', icon: 'none' })
        return
      }
      uni.showModal({
        title: '删除分类',
        content: `确认删除分类"${cat.text}"吗？`,
        success: async ({ confirm }) => {
          if (confirm) {
            const nextCategories = this.categories.filter(c => c.key !== cat.key)
            try {
              await this.saveCategories(nextCategories)
              this.categories = nextCategories
              uni.showToast({ title: '已删除', icon: 'success' })
            } catch (e) {
              console.error('删除分类失败:', e)
              uni.showToast({ title: '删除失败，请重试', icon: 'none' })
            }
          }
        }
      })
    },
    async saveCategory() {
      if (!this.form.text.trim()) {
        uni.showToast({ title: '请输入分类名称', icon: 'none' })
        return
      }
      if (!this.form.key.trim()) {
        uni.showToast({ title: '请输入分类Key', icon: 'none' })
        return
      }
      
      // 检查Key是否重复
      const existing = this.categories.find(c => c.key === this.form.key && c !== this.editingCategory)
      if (existing) {
        uni.showToast({ title: '分类Key已存在', icon: 'none' })
        return
      }

      let nextCategories = this.categories.slice()
      if (this.editingCategory) {
        // 编辑
        const index = this.categories.findIndex(c => c === this.editingCategory)
        if (index >= 0) nextCategories.splice(index, 1, { ...this.form })
      } else {
        // 新增
        nextCategories = [...nextCategories, { ...this.form }]
      }

      try {
        await this.saveCategories(nextCategories)
        this.categories = nextCategories
        this.showEditModal = false
        uni.showToast({ title: '保存成功', icon: 'success' })
      } catch (e) {
        console.error('保存分类失败:', e)
        uni.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    },
    async saveCategories(categories) {
      const shop = await shopAPI.get()
      await shopAPI.update({ ...shop, categories }, this.authToken())
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.category-manage { padding-bottom: 40rpx; }

.tip-bar {
  margin: 16rpx 24rpx;
  padding: 14rpx 22rpx;
  color: $color-text-regular;
  font-size: 24rpx;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
}

.category-list { padding: 0 24rpx; }
.category-item { margin-top: 16rpx; padding: 20rpx; }
.category-item__main {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.category-item__sort {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-primary-light;
  border-radius: 12rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: $color-primary;
}
.category-item__info { flex: 1; }
.category-item__name {
  font-size: 28rpx;
  font-weight: 700;
  color: $color-text-main;
}
.category-item__key {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $color-text-light;
}
.category-item__count {
  font-size: 24rpx;
  color: $color-text-regular;
}
.category-item__actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}
.category-item__actions button { flex: 1; }
.ghost-btn.danger { color: $color-danger; border-color: $color-danger; }
.ghost-btn.danger[disabled] { opacity: 0.4; }

.category-add {
  margin-top: 24rpx;
  padding: 28rpx;
  text-align: center;
  background: $color-bg-light;
  border: 1rpx dashed $color-border;
  border-radius: $radius-card;
  color: $color-primary;
  font-size: 28rpx;
  font-weight: 600;
}

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-content {
  width: 80%;
  max-width: 600rpx;
  background: #fff;
  border-radius: $radius-xl;
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid $color-border-light;
  font-size: 32rpx;
  font-weight: 700;
}
.modal-close {
  font-size: 40rpx;
  color: $color-text-light;
}
.modal-body { padding: 24rpx; }
.form-line {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 24rpx;
}
.form-label {
  font-size: 26rpx;
  color: $color-text-main;
  font-weight: 600;
}
.form-line input {
  height: 72rpx;
  padding: 0 16rpx;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 28rpx;
}
.form-tip {
  font-size: 22rpx;
  color: $color-text-light;
  line-height: 1.5;
}
.modal-footer {
  display: flex;
  gap: 16rpx;
  padding: 24rpx;
  border-top: 1rpx solid $color-border-light;
}
.modal-footer button {
  flex: 1;
  height: 80rpx;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: $radius-md;
}
.cancel-btn {
  color: $color-text-regular;
  background: $color-bg-light;
}
.confirm-btn {
  color: #fff;
  background: $color-primary;
}
</style>
