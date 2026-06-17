const path = require('path')
const moduleAlias = require('module-alias')

moduleAlias.addAlias(
  '@vue/component-compiler-utils',
  path.resolve(__dirname, 'node_modules/@dcloudio/vue-cli-plugin-uni/packages/@vue/component-compiler-utils')
)

module.exports = {
  parallel: false
}
