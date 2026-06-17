<template>
  <view class="page route-manage">
    <CustomNavBar title="发货批次" showBack />

    <view class="toolbar card">
      <view class="toolbar__title">发货批次</view>
      <button class="toolbar__add" @tap="openCreate">新增批次</button>
    </view>

    <EmptyState
      v-if="!routes.length"
      title="还没有发货批次"
      desc="可以按快递、自提、同城创建批次，方便分拣打包。"
      action-text="新增批次"
      @action="openCreate"
    />

    <view v-else class="list">
      <view v-for="item in routes" :key="item.id" class="route-card card">
        <view class="route-card__head">
          <view class="route-card__name">{{ item.name }}</view>
          <view class="route-card__status">{{ routeStatusText(item.status) }}</view>
        </view>
        <view class="route-card__line">日期：{{ item.date }}</view>
        <view class="route-card__line">时间：{{ item.startTime }} - {{ item.endTime }}</view>
        <view class="route-card__line">订单数：{{ item.orderCount }} 单</view>
        <view class="route-card__line">摘要：{{ item.summary }}</view>
        <view class="route-card__actions">
          <button class="ghost-btn" @tap="editRoute(item)">编辑</button>
          <button class="ghost-btn ghost-btn--danger" @tap="removeRoute(item)">删除</button>
        </view>
      </view>
    </view>

    <view v-if="showForm" class="route-modal">
      <view class="route-modal__mask" @tap="closeForm"></view>
      <view class="route-modal__panel card">
        <view class="route-modal__title">{{ form.id ? '编辑批次' : '新增批次' }}</view>
        <view class="form-line"><text>批次名称</text><input v-model.trim="form.name" placeholder="例如：快递发货批次 A" /></view>
        <view class="form-line"><text>发货日期</text><input v-model.trim="form.date" placeholder="例如：2026-06-05" /></view>
        <view class="form-line"><text>开始时间</text><input v-model.trim="form.startTime" placeholder="例如：09:00" /></view>
        <view class="form-line"><text>结束时间</text><input v-model.trim="form.endTime" placeholder="例如：12:00" /></view>
        <view class="form-line"><text>状态</text><input v-model.trim="form.status" placeholder="planned / delivering / completed" /></view>
        <view class="order-picker">
          <view class="order-picker__head">
            <text>绑定订单</text>
            <view>已选 {{ form.orderIds.length }} 单</view>
          </view>
          <view v-if="!orders.length" class="order-picker__empty">暂无可绑定订单</view>
          <view
            v-for="order in orders"
            :key="order.id"
            class="order-option"
            :class="{ 'order-option--active': form.orderIds.includes(order.id) }"
            @tap="toggleOrder(order)"
          >
            <view class="order-option__check"></view>
            <view class="order-option__main">
              <view>{{ order.receiver || order.customer }} · ￥{{ order.payable || order.amount }}</view>
              <text>{{ order.shortAddress || order.address }}</text>
            </view>
            <view class="order-option__status">{{ order.statusText }}</view>
          </view>
        </view>
        <view class="route-modal__actions">
          <button class="ghost-btn" @tap="closeForm">取消</button>
          <button class="primary-btn" @tap="submitRoute">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import CustomNavBar from '@/components/CustomNavBar/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import { deleteRouteConfig, getAdminOrders, getRouteData, saveRouteConfig } from '@/services/dataService'
import { showCloudError } from '@/utils/apiError'
import { ensurePageAccess } from '@/utils/auth'

function createForm() {
  return { id: '', name: '', date: '', startTime: '', endTime: '', status: 'planned', orderIds: [] }
}

export default {
  components: { CustomNavBar, EmptyState },
  data() {
    return {
      routes: [],
      orders: [],
      showForm: false,
      form: createForm()
    }
  },
  onLoad() {
    if (!ensurePageAccess('/pages/admin/route-manage/index', '需要店长权限')) return
  },
  async onShow() {
    if (!ensurePageAccess('/pages/admin/route-manage/index', '需要店长权限')) return
    await this.loadRoutes()
  },
  methods: {
    async loadRoutes() {
      const [routes, orders] = await Promise.all([getRouteData(), getAdminOrders('all')])
      this.routes = routes
      this.orders = orders.filter(item => ['paid', 'pendingDelivery', 'delivering'].includes(item.status))
    },
    routeStatusText(status) {
      return { planned: '待发货', delivering: '已发货', completed: '已完成' }[status] || '待发货'
    },
    openCreate() {
      this.form = createForm()
      this.showForm = true
    },
    editRoute(item) {
      this.form = {
        id: item.id,
        name: item.name,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        status: item.status,
        orderIds: item.orderIds || []
      }
      this.showForm = true
    },
    closeForm() {
      this.showForm = false
    },
    toggleOrder(order) {
      const index = this.form.orderIds.indexOf(order.id)
      if (index >= 0) this.form.orderIds.splice(index, 1)
      else this.form.orderIds.push(order.id)
    },
    async submitRoute() {
      if (!this.form.name || !this.form.date || !this.form.startTime || !this.form.endTime) {
        uni.showToast({ title: '请先完善批次信息', icon: 'none' })
        return
      }
      try {
        await saveRouteConfig(this.form)
        this.showForm = false
        await this.loadRoutes()
        uni.showToast({ title: '批次已保存', icon: 'success' })
      } catch (error) {
        showCloudError(error)
      }
    },
    removeRoute(item) {
      uni.showModal({
        title: '删除批次',
        content: `确认删除“${item.name}”吗？`,
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            await deleteRouteConfig(item.id)
            await this.loadRoutes()
            uni.showToast({ title: '已删除', icon: 'success' })
          } catch (error) {
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

.route-manage { padding-bottom: 80rpx; }
.toolbar,.route-card { margin-top:24rpx; }
.toolbar { display:flex; align-items:center; justify-content:space-between; padding:24rpx; }
.toolbar__title { color:$color-text-main; font-size:32rpx; font-weight:800; }
.toolbar__add { min-width:160rpx; height:66rpx; margin:0; color:#fff; background:$color-primary; border:none; border-radius:$radius-md; font-size:26rpx; line-height:66rpx; }
.route-card { padding:24rpx; }
.route-card__head { display:flex; justify-content:space-between; gap:18rpx; }
.route-card__name { color:$color-text-main; font-size:30rpx; font-weight:800; }
.route-card__status { color:$color-primary; font-size:24rpx; }
.route-card__line { margin-top:12rpx; color:$color-text-regular; font-size:26rpx; line-height:1.5; }
.route-card__actions { display:flex; justify-content:flex-end; gap:16rpx; margin-top:18rpx; }
.ghost-btn,.primary-btn { min-width:120rpx; height:60rpx; margin:0; padding:0 22rpx; border-radius:$radius-md; font-size:24rpx; line-height:60rpx; }
.ghost-btn { color:$color-text-main; background:#fff; border:1rpx solid $color-border; }
.ghost-btn--danger { color:$color-primary; border-color:rgba(232,79,95,.22); }
.primary-btn { color:#fff; background:$color-primary; border:none; }
.route-modal { position:fixed; inset:0; z-index:60; }
.route-modal__mask { position:absolute; inset:0; background:rgba(0,0,0,.28); }
.route-modal__panel { position:absolute; left:24rpx; right:24rpx; bottom:24rpx; padding:28rpx; }
.route-modal__title { color:$color-text-main; font-size:32rpx; font-weight:800; }
.form-line { padding-top:18rpx; }
.form-line text { display:block; color:$color-text-main; font-size:26rpx; font-weight:700; }
.form-line input { width:100%; height:70rpx; margin-top:12rpx; padding:0 18rpx; color:$color-text-main; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-md; font-size:26rpx; }
.order-picker { margin-top:22rpx; }
.order-picker__head { display:flex; justify-content:space-between; align-items:center; }
.order-picker__head text { color:$color-text-main; font-size:26rpx; font-weight:700; }
.order-picker__head view { color:$color-primary; font-size:24rpx; }
.order-picker__empty { margin-top:14rpx; color:$color-text-light; font-size:24rpx; }
.order-option { display:flex; align-items:center; gap:14rpx; margin-top:14rpx; padding:16rpx; background:$color-bg-light; border:1rpx solid $color-border-light; border-radius:$radius-card; }
.order-option--active { border-color:rgba(232,79,95,.38); background:$color-primary-light; }
.order-option__check { width:28rpx; height:28rpx; border:2rpx solid $color-text-placeholder; border-radius:8rpx; }
.order-option--active .order-option__check { background:$color-primary; border-color:$color-primary; }
.order-option__main { flex:1; min-width:0; }
.order-option__main view { color:$color-text-main; font-size:24rpx; font-weight:700; @include text-ellipsis; }
.order-option__main text { display:block; margin-top:6rpx; color:$color-text-light; font-size:22rpx; @include text-ellipsis; }
.order-option__status { flex-shrink:0; color:$color-orange; font-size:22rpx; }
.route-modal__actions { display:flex; justify-content:flex-end; gap:16rpx; margin-top:24rpx; }
</style>
