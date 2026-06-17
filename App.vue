<script>
import { guardCurrentPage, installAuthGuards, refreshAuthState } from '@/utils/auth'

export default {
  onLaunch() {
    console.log('初炉启动 · 微信云开发模式')
    // #ifdef MP-WEIXIN
    if (wx.cloud) {
      wx.cloud.init({
        env: 'aiwork-8g5erw9d885e24b4',
        traceUser: true
      })
    }
    // #endif
    installAuthGuards()
    refreshAuthState().finally(() => {
      guardCurrentPage()
    })
    // #ifdef H5
    if (typeof window !== 'undefined' && !window.__bakeryAuthHashGuardInstalled__) {
      window.__bakeryAuthHashGuardInstalled__ = true
      window.addEventListener('hashchange', () => {
        setTimeout(() => {
          guardCurrentPage()
        }, 0)
      })
    }
    // #endif
  },
  onShow() {
    refreshAuthState().finally(() => {
      guardCurrentPage()
    })
  }
}
</script>

<style lang="scss">
@import '@/common/theme.scss';
@import '@/common/components.scss';
@import '@dcloudio/uni-ui/lib/uni-icons/uniicons.css';

page {
  min-height: 100%;
  background: $color-bg;
  color: $color-text-main;
  font-family: $font-family-base;
}

view, text, image, button, input, textarea {
  box-sizing: border-box;
}

view, text, button, input, textarea {
  font-family: $font-family-base;
  letter-spacing: 0;
}

button {
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  line-height: 1;
}

button::after {
  border: none;
}
</style>
