<template>
  <view class="page product-edit">
    <CustomNavBar :title="isEditMode ? '编辑商品' : '新增商品'" showBack />

    <view class="tip-bar">
      {{ isEditMode ? '维护商品信息，保持团购页展示准确' : '发布优质团购商品，丰富每日团购内容' }}
    </view>

    <view class="form-card card">
      <view class="upload-box">
        <view class="form-label">商品图片 <text>*</text></view>
        <view class="upload-box__inner" @tap="chooseImage">
          <view class="upload-box__preview" v-if="form.image">
            <image :src="form.imagePreview || form.image" mode="aspectFill" />
          </view>
          <view v-else>
            <view>＋</view>
            <text>上传图片</text>
            <text>建议尺寸 800×800px，大小不超过5MB</text>
          </view>
        </view>
      </view>

      <view class="form-line" v-for="field in fields" :key="field.key">
        <view class="form-label">{{ field.label }} <text v-if="field.required">*</text></view>
        <input v-if="field.type === 'input'" v-model.trim="form[field.key]" :placeholder="field.placeholder" />
        <input v-else-if="field.type === 'number'" v-model.trim="form[field.key]" type="digit" :placeholder="field.placeholder" />
        <picker v-else-if="field.type === 'category'" :range="categoryOptions" range-key="text" :value="categoryIndex" @change="setCategory">
          <view class="picker-line">{{ categoryLabel }} <text>〉</text></view>
        </picker>
      </view>

      <view class="form-line form-line--textarea">
        <view class="form-label">商品描述</view>
        <textarea v-model="form.desc" placeholder="请输入商品描述，向顾客介绍卖点、口味、食材等" />
        <view class="counter">{{ form.desc.length }}/200</view>
      </view>

      <view class="form-line form-line--textarea">
        <view class="form-label">商品详情</view>
        <textarea v-model="form.detailText" placeholder="可填写保存方式、食用建议、规格说明等" style="height:160rpx;" />
        <view class="counter">{{ (form.detailText || '').length }}/500</view>
      </view>

      <view class="operate">
        <view>
          <view class="form-label">运营设置</view>
          <text>在商品详情页显示购买动态</text>
        </view>
        <switch :checked="form.showActivity" color="#FF5C72" @change="form.showActivity = $event.detail.value" />
      </view>
    </view>

    <view class="preview">
      <view class="preview-card card">
        <view class="preview-title">商品预览</view>
        <view class="preview-product">
          <image :src="form.imagePreview || form.image || ''" mode="aspectFill" />
          <view class="preview-product__info">
            <view class="preview-product__name">{{ form.name || '商品名称' }}</view>
            <view class="preview-product__desc">{{ form.desc || '商品描述' }}</view>
            <view class="preview-product__price">
              <text>￥{{ form.price || '0' }}</text>
              <text v-if="form.originPrice" class="origin">￥{{ form.originPrice }}</text>
            </view>
            <view class="preview-product__stock">库存 {{ form.stock || '0' }} 份</view>
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-action">
      <button :disabled="publishing" @tap="submit">
        {{ publishing ? '保存中...' : (isEditMode ? '保存修改' : '新增商品') }}
      </button>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import { getAdminProductById, getCategories, saveProduct } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'
import { uploadImageToCloud } from '@/utils/image'

export default {
  components: { CustomNavBar },
  data() {
    return {
      publishing: false,
      originalProduct: null,
      categoryOptions: [{ key: 'cake', text: '蛋糕甜点' }, { key: 'bread', text: '面包吐司' }, { key: 'snack', text: '下午茶' }],
      form: {
        id: '',
        image: '',
        imagePreview: '',
        categoryKey: 'cake',
        name: '',
        price: '',
        originPrice: '',
        stock: '',
        desc: '',
        detailText: '',
        showActivity: true
      },
      fields: [
        { key: 'categoryKey', label: '商品分类', type: 'category', placeholder: '请选择分类', required: true },
        { key: 'name', label: '商品名称', type: 'input', placeholder: '请输入商品名称，如 草莓奶油盒子', required: true },
        { key: 'price', label: '团购价（元）', type: 'number', placeholder: '请输入团购价', required: true },
        { key: 'originPrice', label: '原价（元）', type: 'number', placeholder: '请输入原价', required: true },
        { key: 'stock', label: '库存数量（份）', type: 'number', placeholder: '请输入库存数量', required: true }
      ]
    }
  },
  computed: {
    isEditMode() {
      return Boolean(this.form.id)
    },
    categoryIndex() {
      return Math.max(0, this.categoryOptions.findIndex(item => item.key === this.form.categoryKey))
    },
    categoryLabel() {
      const found = this.categoryOptions.find(item => item.key === this.form.categoryKey)
      return found ? found.text : '请选择分类'
    }
  },
  methods: {
    async loadCategories() {
      try {
        const list = await getCategories()
        if (list && list.length) {
          this.categoryOptions = list.filter(item => item.key !== 'all')
        }
      } catch {}
    },
    setCategory(event) {
      const option = this.categoryOptions[event.detail.value]
      if (option) this.form.categoryKey = option.key
    },
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: res => {
          this.form.image = res.tempFilePaths[0]
          this.form.imagePreview = res.tempFilePaths[0]
        }
      })
    },
    validate() {
      const required = ['name', 'price', 'originPrice', 'stock']
      for (const key of required) {
        const field = this.fields.find(f => f.key === key)
        if (!String(this.form[key] || '').trim()) return `请填写"${(field && field.label) || key}"`
      }
      if (!this.form.image && !this.isEditMode) return '请上传商品图片'
      if (Number(this.form.price) <= 0) return '团购价需大于 0'
      if (Number(this.form.stock) <= 0) return '库存需大于 0'
      if (Number(this.form.originPrice) < Number(this.form.price)) return '原价不能低于团购价'
      return ''
    },
    async submit() {
      const message = this.validate()
      if (message) {
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      if (this.publishing) return
      this.publishing = true
      try {
        let image = this.form.image
        if (this.isEditMode && !image && this.originalProduct) {
          image = this.originalProduct.image
        }
        image = await uploadImageToCloud(image, 'products')
        const productData = {
          categoryKey: this.form.categoryKey,
          name: this.form.name,
          desc: this.form.desc,
          subtitle: this.form.desc,
          price: Number(this.form.price),
          originPrice: Number(this.form.originPrice),
          sold: (this.originalProduct && Number(this.originalProduct.sold)) || 0,
          stock: Number(this.form.stock),
          totalStock: Number(this.form.stock),
          limit: 5,
          deadline: '今日 22:00 截单',
          deliveryTime: '次日打包发货',
          deliveryRange: '快递发货 / 门店自提 / 同城配送',
          storage: '0~4℃冷藏保存',
          taste: this.form.desc || '新鲜烘焙',
          ingredients: [],
          image,
          bannerImage: image,
          gallery: image ? [image] : [],
          priority: this.form.showActivity,
          status: (this.originalProduct && this.originalProduct.status) || 'active',
          sort: (this.originalProduct && this.originalProduct.sort) || Date.now(),
          detail: this.form.detailText ? this.form.detailText.split('\n').filter(Boolean) : []
        }
        // 只有编辑模式才传 id
        if (this.isEditMode && this.form.id) {
          productData.id = this.form.id
        }
        await saveProduct(productData)
        uni.showToast({ title: this.isEditMode ? '商品已更新' : '商品已添加', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch (error) {
        showCloudError(error)
      } finally {
        this.publishing = false
      }
    },
    async loadProduct(id) {
      const product = await getAdminProductById(id)
      if (!product) {
        uni.showToast({ title: '商品不存在', icon: 'none' })
        setTimeout(() => uni.navigateBack(), 600)
        return
      }
      this.originalProduct = product
      this.form = {
        id: product.id,
        image: product.imageFileID || product.image || '',
        imagePreview: product.image || product.imageFileID || '',
        categoryKey: product.categoryKey || 'cake',
        name: product.name || '',
        price: String(product.price || ''),
        originPrice: String(product.originPrice || ''),
        stock: String(product.totalStock || product.stock || ''),
        desc: product.desc || product.subtitle || '',
        detailText: (product.detail || []).join('\n'),
        showActivity: Boolean(product.priority)
      }
    }
  },
  async onLoad(query) {
    if (!ensurePageAccess('/pages/admin/product-edit/index', '需要店长权限')) return
    await this.loadCategories()
    if (query.id) {
      await this.loadProduct(query.id)
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.product-edit { padding-bottom: 240rpx; }
.tip-bar { margin-top: 16rpx; padding: 14rpx 22rpx; color: $color-text-regular; font-size: 24rpx; background: $color-bg-light; border: 1rpx solid $color-border-light; border-radius: $radius-md; }
.form-card { margin-top: 22rpx; padding: 28rpx; }
.form-label { color: $color-text-main; font-size: 28rpx; font-weight: 800; }
.form-label text { color: $color-primary; }
.upload-box__inner { position: relative; min-height: 200rpx; margin-top: 18rpx; background: $color-bg-light; border: 1rpx dashed $color-border; border-radius: $radius-card; overflow: hidden; }
.upload-box__preview { width: 100%; height: 100%; min-height: 200rpx; }
.upload-box__preview image { width: 100%; height: 100%; min-height: 200rpx; }
.upload-box__inner > view { @include flex-center; flex-direction: column; height: 200rpx; color: $color-primary; }
.upload-box__inner > view view { font-size: 48rpx; }
.upload-box__inner > view text { margin-top: 8rpx; font-size: 24rpx; color: $color-text-light; }
.upload-box__inner > view text:last-child { font-size: 22rpx; }
.form-line { padding: 22rpx 0; border-bottom: 1rpx solid $color-border-light; }
.form-line input, .picker-line { width: 100%; height: 72rpx; margin-top: 12rpx; padding: 0 18rpx; color: $color-text-main; background: $color-bg-light; border: 1rpx solid $color-border-light; border-radius: $radius-md; font-size: 26rpx; }
.picker-line { display: flex; align-items: center; justify-content: space-between; color: $color-text-regular; }
.form-line textarea { width: 100%; height: 110rpx; margin-top: 14rpx; padding: 16rpx 18rpx; background: $color-bg-light; border: 1rpx solid $color-border-light; border-radius: $radius-md; color: $color-text-main; font-size: 25rpx; }
.counter { color: $color-text-light; font-size: 22rpx; text-align: right; margin-top: 6rpx; }
.operate { display: flex; align-items: center; justify-content: space-between; padding-top: 24rpx; }
.operate text { display: block; margin-top: 12rpx; color: $color-text-light; font-size: 24rpx; }
.preview { min-width: 0; }
.preview-card { margin-top: 22rpx; padding: 24rpx; }
.preview-title { margin-bottom: 18rpx; color: $color-text-main; font-size: 28rpx; font-weight: 800; }
.preview-product { display: flex; gap: 18rpx; padding: 18rpx; background: $color-bg-light; border: 1rpx solid $color-border-light; border-radius: $radius-card; }
.preview-product image { width: 140rpx; height: 140rpx; border-radius: $radius-card; }
.preview-product__info { flex: 1; min-width: 0; }
.preview-product__name { @include text-body-strong; font-size: 28rpx; font-weight: 700; @include text-ellipsis; }
.preview-product__desc { margin-top: 8rpx; @include text-caption($color-text-light); @include text-ellipsis; }
.preview-product__price { margin-top: 14rpx; display: flex; align-items: baseline; gap: 12rpx; }
.preview-product__price text { color: $color-primary; font-size: 34rpx; font-weight: 800; }
.preview-product__price .origin { color: $color-text-light; font-size: 24rpx; text-decoration: line-through; font-weight: 400; }
.preview-product__stock { margin-top: 8rpx; font-size: 24rpx; color: $color-text-regular; }
.bottom-action { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255,253,249,.98); box-shadow: $shadow-bottom; border-top: 1rpx solid $color-border-light; }
.bottom-action button { width: 100%; height: 88rpx; color: #fff; background: $gradient-primary; border-radius: $radius-pill; font-size: 30rpx; font-weight: 700; line-height: 88rpx; box-shadow: $shadow-btn; }
.bottom-action button[disabled] { background: $color-text-light; box-shadow: none; }
</style>
