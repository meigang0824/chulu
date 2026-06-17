import App from './App'
import Vue from 'vue'
import { installAuthGuards } from '@/utils/auth'

Vue.config.productionTip = false
App.mpType = 'app'

installAuthGuards()

const app = new Vue({
  ...App
})

app.$mount()
