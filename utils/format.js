export function money(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatDeadlineText(deadlineAt = '', fallback = '') {
  if (!deadlineAt) return fallback || ''
  const target = new Date(deadlineAt)
  if (Number.isNaN(target.getTime())) return fallback || ''

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const targetKey = dateKey(target)
  const dateLabel = targetKey === dateKey(now)
    ? '今日'
    : targetKey === dateKey(tomorrow)
      ? '明日'
      : `${target.getMonth() + 1}月${target.getDate()}日`

  return `${dateLabel} ${pad2(target.getHours())}:${pad2(target.getMinutes())} 截单`
}
