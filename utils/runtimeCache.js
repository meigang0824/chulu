const runtimeCache = {}

export function getRuntimeCache(key) {
  const item = runtimeCache[key]
  if (!item) return undefined
  if (item.expireAt <= Date.now()) {
    delete runtimeCache[key]
    return undefined
  }
  return item.value
}

export function setRuntimeCache(key, value, ttl = 10000) {
  runtimeCache[key] = {
    value,
    expireAt: Date.now() + ttl
  }
  return value
}

export async function cachedRuntime(key, ttl, loader) {
  const cached = getRuntimeCache(key)
  if (cached !== undefined) return cached
  const value = await loader()
  return setRuntimeCache(key, value, ttl)
}

export function clearRuntimeCache(prefix = '') {
  Object.keys(runtimeCache).forEach(key => {
    if (!prefix || key.indexOf(prefix) === 0) delete runtimeCache[key]
  })
}
