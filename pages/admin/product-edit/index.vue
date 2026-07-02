<template>
  <view class="page product-edit">
    <CustomNavBar :title="isEditMode ? '编辑商品' : '新增商品'" showBack />

    <view class="form-card card">
      <view class="upload-box">
        <view class="form-label">商品图片 <text>*</text></view>
        <scroll-view v-if="galleryItems.length" scroll-x class="gallery-edit-scroll" show-scrollbar="false">
          <view class="gallery-edit-list">
            <view
              v-for="(item, index) in galleryItems"
              :key="item.id"
              class="gallery-edit-item"
              :class="{ 'is-cover': index === 0 }"
              @tap="setCover(index)"
            >
              <image :src="item.preview || item.url" mode="aspectFill" />
              <view class="gallery-edit-cover">{{ index === 0 ? '主图' : '设主图' }}</view>
              <view class="gallery-edit-remove" @tap.stop="removeGalleryImage(index)">×</view>
            </view>
            <view v-if="galleryItems.length < maxGalleryCount" class="gallery-add-card" @tap="chooseImage">
              <view>＋</view>
              <text>继续添加</text>
            </view>
          </view>
        </scroll-view>
        <view v-else class="upload-box__inner" @tap="chooseImage">
          <view>
            <view>＋</view>
            <text>上传图片</text>
            <text>最多 {{ maxGalleryCount }} 张，第一张作为列表主图</text>
          </view>
        </view>
        <view class="upload-tip">建议上传全图、切面图、包装图等，第一张会展示在商品列表。</view>
      </view>

      <view class="form-line" v-for="field in baseFields" :key="field.key">
        <view class="form-label">{{ field.label }} <text v-if="field.required">*</text></view>
        <input v-if="field.type === 'input'" v-model.trim="form[field.key]" :placeholder="field.placeholder" />
        <picker v-else-if="field.type === 'category'" :range="categoryOptions" range-key="text" :value="categoryIndex" @change="setCategory">
          <view class="picker-line">{{ categoryLabel }} <text>〉</text></view>
        </picker>
      </view>

      <view class="form-row">
        <view class="form-line form-line--half" v-for="field in priceFields" :key="field.key">
          <view class="form-label">{{ field.label }} <text v-if="field.required">*</text></view>
          <input v-model.trim="form[field.key]" type="digit" :placeholder="field.placeholder" />
        </view>
      </view>

      <view class="form-row">
        <view class="form-line form-line--half" v-for="field in stockFields" :key="field.key">
          <view class="form-label">{{ field.label }} <text v-if="field.required">*</text></view>
          <input v-model.trim="form[field.key]" type="digit" :placeholder="field.placeholder" />
        </view>
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
          <image :src="coverPreview" mode="aspectFill" />
          <view class="preview-product__info">
            <view class="preview-product__name">{{ form.name || '商品名称' }}</view>
            <view class="preview-product__desc">{{ form.desc || '商品描述' }}</view>
            <view class="preview-product__price">
              <text>￥{{ money(form.price || 0) }}</text>
              <text v-if="form.originPrice" class="origin">￥{{ money(form.originPrice) }}</text>
            </view>
            <view class="preview-product__stock">
              <text>库存 {{ form.stock || '0' }} 份</text>
              <text v-if="form.spec">规格 {{ form.spec }}</text>
              <text>{{ limitPreviewText }}</text>
            </view>
          </view>
        </view>
        <view class="preview-detail">
          <view>
            <text>{{ galleryItems.length || 0 }}</text>
            <view>张图片</view>
          </view>
          <view>
            <text>{{ form.spec || '未填' }}</text>
            <view>规格</view>
          </view>
          <view>
            <text>{{ detailPreview }}</text>
            <view>详情摘要</view>
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
import { money } from '@/utils/format'

export default {
  components: { CustomNavBar },
  data() {
    return {
      publishing: false,
      maxGalleryCount: 6,
      originalProduct: null,
      categoryOptions: [{ key: 'cake', text: '蛋糕甜点' }, { key: 'bread', text: '面包吐司' }, { key: 'snack', text: '下午茶' }],
      form: {
        id: '',
        image: '',
        imagePreview: '',
        gallery: [],
        categoryKey: 'cake',
        name: '',
        price: '',
        originPrice: '',
        stock: '',
        spec: '',
        limit: '0',
        desc: '',
        detailText: '',
        showActivity: true
      },
      baseFields: [
        { key: 'categoryKey', label: '商品分类', type: 'category', placeholder: '请选择分类', required: true },
        { key: 'name', label: '商品名称', type: 'input', placeholder: '请输入商品名称，如 草莓奶油盒子', required: true },
        { key: 'spec', label: '商品规格', type: 'input', placeholder: '如 6枚装 / 500g / 1盒' }
      ],
      priceFields: [
        { key: 'price', label: '团购价（元）', type: 'number', placeholder: '请输入团购价', required: true },
        { key: 'originPrice', label: '原价（元）', type: 'number', placeholder: '请输入原价', required: true }
      ],
      stockFields: [
        { key: 'stock', label: '库存数量（份）', type: 'number', placeholder: '请输入库存数量', required: true },
        { key: 'limit', label: '单次限购数量（份）', type: 'number', placeholder: '填0表示不限购' }
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
    },
    limitPreviewText() {
      const limit = Number(this.form.limit || 0)
      return limit > 0 ? `单次最多 ${limit} 份` : '不限购'
    },
    galleryItems() {
      return Array.isArray(this.form.gallery) ? this.form.gallery : []
    },
    coverPreview() {
      const cover = this.galleryItems[0] || {}
      return cover.preview || cover.url || this.form.imagePreview || this.form.image || ''
    },
    detailPreview() {
      const text = String(this.form.detailText || '').trim().replace(/\s+/g, ' ')
      return text ? text.slice(0, 18) : '未填写'
    }
  },
  methods: {
    money,
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
        count: Math.max(1, this.maxGalleryCount - this.galleryItems.length),
        sizeType: ['compressed'],
        success: res => {
          const nextItems = (res.tempFilePaths || []).map(path => ({
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            url: path,
            preview: path,
            isLocal: true
          }))
          this.form.gallery = [...this.galleryItems, ...nextItems].slice(0, this.maxGalleryCount)
          this.syncCoverFromGallery()
        }
      })
    },
    syncCoverFromGallery() {
      const cover = this.galleryItems[0] || {}
      this.form.image = cover.url || ''
      this.form.imagePreview = cover.preview || cover.url || ''
    },
    setCover(index) {
      if (index <= 0) return
      const list = this.galleryItems.slice()
      const [target] = list.splice(index, 1)
      list.unshift(target)
      this.form.gallery = list
      this.syncCoverFromGallery()
    },
    removeGalleryImage(index) {
      const list = this.galleryItems.slice()
      list.splice(index, 1)
      this.form.gallery = list
      this.syncCoverFromGallery()
    },
    validate() {
      const required = ['name', 'price', 'originPrice', 'stock']
      for (const key of required) {
        const field = [...this.baseFields, ...this.priceFields, ...this.stockFields].find(f => f.key === key)
        if (!String(this.form[key] || '').trim()) return `请填写"${(field && field.label) || key}"`
      }
      if (!this.galleryItems.length) return '请至少上传 1 张商品图片'
      if (Number(this.form.price) <= 0) return '团购价需大于 0'
      if (Number(this.form.stock) <= 0) return '库存需大于 0'
      if (Number(this.form.originPrice) < Number(this.form.price)) return '原价不能低于团购价'
      if (Number(this.form.limit || 0) < 0) return '限购数量不能小于 0'
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
        const gallery = []
        for (let index = 0; index < this.galleryItems.length; index += 1) {
          const item = this.galleryItems[index]
          try {
            gallery.push(await uploadImageToCloud(item.url || item.preview, 'products'))
          } catch (error) {
            throw new Error(`第 ${index + 1} 张商品图片上传失败，请重新选择后再保存`)
          }
        }
        const image = gallery[0] || ''
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
          limit: Number(this.form.limit || 0),
          deadline: '今日 22:00 截单',
          deliveryTime: '次日打包发货',
          deliveryRange: '统一配送',
          storage: '0~4℃冷藏保存',
          taste: this.form.desc || '新鲜烘焙',
          ingredients: [],
          specs: this.form.spec ? [{ name: '规格', value: this.form.spec }] : [],
          image,
          bannerImage: image,
          gallery,
          galleryFileIDs: gallery,
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
      const spec = Array.isArray(product.specs) && product.specs.length
        ? String(product.specs[0].value || product.specs[0].text || product.specs[0].name || '').trim()
        : ''
      this.form = {
        id: product.id,
        image: product.imageFileID || product.image || '',
        imagePreview: product.image || product.imageFileID || '',
        gallery: this.normalizeGallery(product),
        categoryKey: product.categoryKey || 'cake',
        name: product.name || '',
        price: String(product.price || ''),
        originPrice: String(product.originPrice || ''),
        stock: String(product.totalStock || product.stock || ''),
        spec,
        limit: String(product.limit || 0),
        desc: product.desc || product.subtitle || '',
        detailText: (product.detail || []).join('\n'),
        showActivity: Boolean(product.priority)
      }
      this.syncCoverFromGallery()
    },
    normalizeGallery(product = {}) {
      const rawGallery = Array.isArray(product.galleryFileIDs) && product.galleryFileIDs.length
        ? product.galleryFileIDs
        : Array.isArray(product.gallery) && product.gallery.length
          ? product.gallery
          : [product.imageFileID || product.image].filter(Boolean)
      return rawGallery.map((url, index) => ({
        id: `remote_${index}_${url}`,
        url,
        preview: url,
        isLocal: false
      }))
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

.product-edit { padding-bottom: 280rpx; }
.form-card { margin-top: 22rpx; padding: 28rpx; }
.form-label { color: $color-text-main; font-size: 28rpx; font-weight: 800; }
.form-label text { color: $color-primary; }
.gallery-edit-scroll { width: 100%; margin-top: 18rpx; white-space: nowrap; }
.gallery-edit-list { display: inline-flex; gap: 16rpx; padding-right: 4rpx; }
.gallery-edit-item {
  position: relative;
  flex: 0 0 auto;
  width: 180rpx;
  height: 180rpx;
  overflow: hidden;
  background: $color-bg-light;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
}
.gallery-edit-item.is-cover {
  border-color: rgba(255, 92, 114, 0.42);
  box-shadow: 0 8rpx 18rpx rgba(255, 92, 114, 0.12);
}
.gallery-edit-item image { width: 100%; height: 100%; }
.gallery-edit-cover {
  position: absolute;
  left: 10rpx;
  bottom: 10rpx;
  height: 34rpx;
  padding: 0 12rpx;
  color: #fff;
  background: rgba(255, 92, 114, 0.92);
  border-radius: $radius-pill;
  font-size: 20rpx;
  line-height: 34rpx;
}
.gallery-edit-remove {
  position: absolute;
  right: 8rpx;
  top: 8rpx;
  width: 36rpx;
  height: 36rpx;
  color: #fff;
  background: rgba(75, 36, 23, 0.62);
  border-radius: 50%;
  font-size: 28rpx;
  line-height: 34rpx;
  text-align: center;
}
.gallery-add-card {
  @include flex-center;
  flex-direction: column;
  flex: 0 0 auto;
  width: 180rpx;
  height: 180rpx;
  color: $color-primary;
  background: $color-bg-light;
  border: 1rpx dashed $color-border;
  border-radius: $radius-card;
}
.gallery-add-card view { font-size: 44rpx; line-height: 1; }
.gallery-add-card text { margin-top: 10rpx; color: $color-text-light; font-size: 23rpx; }
.upload-tip { margin-top: 12rpx; color: $color-text-light; font-size: 23rpx; line-height: 1.4; }
.upload-box__inner { position: relative; min-height: 200rpx; margin-top: 18rpx; background: $color-bg-light; border: 1rpx dashed $color-border; border-radius: $radius-card; overflow: hidden; }
.upload-box__preview { width: 100%; height: 100%; min-height: 200rpx; }
.upload-box__preview image { width: 100%; height: 100%; min-height: 200rpx; }
.upload-box__inner > view { @include flex-center; flex-direction: column; height: 200rpx; color: $color-primary; }
.upload-box__inner > view view { font-size: 48rpx; }
.upload-box__inner > view text { margin-top: 8rpx; font-size: 24rpx; color: $color-text-light; }
.upload-box__inner > view text:last-child { font-size: 22rpx; }
.form-line { padding: 22rpx 0; border-bottom: 1rpx solid $color-border-light; }
.form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; border-bottom: 1rpx solid $color-border-light; }
.form-row .form-line { min-width: 0; border-bottom: none; }
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
.preview-product__stock { display: flex; flex-direction: column; gap: 4rpx; margin-top: 8rpx; font-size: 24rpx; color: $color-text-regular; }
.preview-detail { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12rpx; margin-top:16rpx; }
.preview-detail > view { min-width:0; padding:14rpx 12rpx; background:#fff; border:1rpx solid $color-border-light; border-radius:$radius-md; }
.preview-detail text { display:block; color:$color-text-main; font-size:24rpx; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.preview-detail view view { margin-top:6rpx; color:$color-text-light; font-size:21rpx; }
.bottom-action { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255,253,249,.98); box-shadow: $shadow-bottom; border-top: 1rpx solid $color-border-light; }
.bottom-action button { width: 100%; height: 88rpx; color: #fff; background: $gradient-primary; border-radius: $radius-pill; font-size: 30rpx; font-weight: 700; line-height: 88rpx; box-shadow: $shadow-btn; }
.bottom-action button[disabled] { background: $color-text-light; box-shadow: none; }
</style>
