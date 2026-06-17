<template>
  <view class="filter-bar">
    <view v-if="tabs.length" class="filter-bar__tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="filter-bar__tab"
        :class="{ 'filter-bar__tab--active': tab.key === active }"
        @tap="changeTab(tab)"
      >
        <text>{{ tab.text }}</text>
        <text v-if="tab.count !== undefined" class="filter-bar__count">{{ tab.count }}</text>
      </view>
    </view>

    <view v-if="showSearch || filters.length" class="filter-bar__tools">
      <view v-if="showSearch" class="filter-bar__search">
        <text class="filter-bar__search-icon">⌕</text>
        <input
          class="filter-bar__input"
          :value="keyword"
          :placeholder="searchPlaceholder"
          placeholder-class="filter-bar__placeholder"
          @input="handleSearch"
          confirm-type="search"
        />
      </view>
      <button
        v-for="filter in filters"
        :key="filter.key"
        class="filter-bar__filter"
        @tap="$emit('filter', filter)"
      >
        {{ filter.text }}
      </button>
      <button v-if="showFilterButton" class="filter-bar__filter" @tap="$emit('filter')">筛选</button>
    </view>

    <slot></slot>
  </view>
</template>

<script>
export default {
  name: 'FilterBar',
  props: {
    tabs: { type: Array, default: () => [] },
    active: { type: String, default: '' },
    keyword: { type: String, default: '' },
    searchPlaceholder: { type: String, default: '搜索客户姓名、手机号或商品名称' },
    showSearch: { type: Boolean, default: false },
    showFilterButton: { type: Boolean, default: false },
    filters: { type: Array, default: () => [] }
  },
  methods: {
    changeTab(tab) {
      this.$emit('changeTab', tab.key, tab)
      this.$emit('update:active', tab.key)
    },
    handleSearch(event) {
      const value = event.detail.value
      this.$emit('search', value)
      this.$emit('update:keyword', value)
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.filter-bar {
  padding: 18rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 1rpx solid $color-border-light;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
}

.filter-bar__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.filter-bar__tab {
  @include flex-center;
  flex: 0 0 auto;
  min-width: 126rpx;
  height: 64rpx;
  padding: 0 20rpx;
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
  font-size: 26rpx;
}

.filter-bar__tab--active {
  color: $color-primary;
  background: $color-primary-light;
  border-color: rgba(232,79,95,.18);
  font-weight: 700;
}

.filter-bar__count {
  @include flex-center;
  min-width: 52rpx;
  height: 44rpx;
  margin-left: 10rpx;
  padding: 0 12rpx;
  color: inherit;
  background: rgba(255, 255, 255, 0.65);
  border-radius: $radius-sm;
}

.filter-bar__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.filter-bar__search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 78rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 1rpx solid $color-border-light;
  border-radius: $radius-md;
}

.filter-bar__search-icon {
  flex-shrink: 0;
  margin-right: 12rpx;
  color: $color-text-placeholder;
  font-size: 34rpx;
}

.filter-bar__input {
  flex: 1;
  min-width: 0;
  color: $color-text-main;
  font-size: 28rpx;
}

.filter-bar__placeholder {
  color: $color-text-placeholder;
}

.filter-bar__filter {
  @include flex-center;
  flex-shrink: 0;
  min-width: 132rpx;
  height: 78rpx;
  padding: 0 24rpx;
  color: $color-text-main;
  background: #fff;
  border: 1rpx solid $color-border;
  border-radius: $radius-md;
  font-size: 28rpx;
}
</style>
