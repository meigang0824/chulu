const path = require('path')
const Module = require('module')

function loadUniPostcssPlugin() {
  const resolveFilename = Module._resolveFilename
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'postcss') {
      return require.resolve('postcss-loader/node_modules/postcss')
    }
    if (request === 'postcss/package.json') {
      return require.resolve('postcss-loader/node_modules/postcss/package.json')
    }
    return resolveFilename.call(this, request, parent, isMain, options)
  }

  try {
    return require('@dcloudio/vue-cli-plugin-uni/packages/postcss')
  } finally {
    Module._resolveFilename = resolveFilename
  }
}

module.exports = {
  parser: require('postcss-comment'),
  plugins: [
    require('postcss-import')({
      resolve(id) {
        if (id.startsWith('~@/')) {
          return path.resolve(process.env.UNI_INPUT_DIR, id.slice(3))
        }
        if (id.startsWith('@/')) {
          return path.resolve(process.env.UNI_INPUT_DIR, id.slice(2))
        }
        if (id.startsWith('/') && !id.startsWith('//')) {
          return path.resolve(process.env.UNI_INPUT_DIR, id.slice(1))
        }
        return id
      }
    }),
    require('autoprefixer')({
      remove: process.env.UNI_PLATFORM !== 'h5'
    }),
    loadUniPostcssPlugin()
  ]
}
