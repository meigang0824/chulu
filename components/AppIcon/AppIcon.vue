<template>
  <uni-icons :type="iconType" :size="iconSize" :color="color" />
</template>

<script>
// Map custom icon names to uni-icons types
const iconMap = {
  home: 'home-filled',
  grid: 'bars',
  receipt: 'checkbox-filled',
  user: 'person-filled',
  dashboard: 'staff-filled',
  plus: 'plus-filled',
  box: 'gift-filled',
  location: 'location-filled',
  phone: 'phone-filled',
  info: 'info-filled',
  search: 'search',
  truck: 'cart-filled',
  cart: 'cart-filled',
  heart: 'heart-filled',
  users: 'personadd-filled',
  chart: 'fire-filled',
  route: 'map-filled',
  banner: 'image-filled',
  store: 'shop-filled',
  yuan: 'wallet-filled',
  logout: 'arrow-right',
  'add-group': 'plus-filled',
  'order-list': 'checkbox-filled',
  stock: 'gift-filled',
  delivery: 'cart-filled',
  close: 'closeempty',
  'chevron-right': 'right'
}

export default {
  name: 'AppIcon',
  props: {
    name: { type: String, default: '' },
    size: { type: [Number, String], default: 24 },
    color: { type: String, default: '#5A2E1D' },
    strokeWidth: { type: [Number, String], default: 2 }
  },
  computed: {
    iconType() {
      const normalizedName = this.normalizedName
      return iconMap[normalizedName] || 'info'
    },
    iconSize() {
      // uni-icons size is in px, pass the rpx value directly
      // uni-icons internally handles the conversion
      if (typeof this.size === 'number') {
        return this.size / 2 // rpx to px (1rpx ≈ 0.5px on most devices)
      }
      return parseInt(this.size)
    },
    normalizedName() {
      const alias = {
        '⌂': 'home',
        '▦': 'grid',
        '▤': 'receipt',
        '○': 'user',
        '□': 'box',
        '⌖': 'location',
        '+': 'plus',
        category: 'grid',
        order: 'receipt',
        mine: 'user',
        orders: 'receipt',
        goods: 'box',
        about: 'info'
      }
      return alias[this.name] || this.name
    }
  }
}
</script>

<style lang="scss" scoped>
</style>
