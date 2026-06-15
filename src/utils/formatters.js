export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function formatMonth(monthStr) {
  if (!monthStr) return ''
  const [y, m] = monthStr.split('-')
  return new Date(y, m - 1).toLocaleString('en-AU', { month: 'short', year: 'numeric' })
}

export function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function daysUntil(dueDay) {
  const now = new Date()
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay)
  if (due < now) due.setMonth(due.getMonth() + 1)
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  return diff
}

export function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function initials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Current budget/tracking cycle window for a given start day.
// startDay = 1 -> calendar month; 15 -> 15th to 14th next month.
export function cycleWindow(startDay = 1, ref = new Date()) {
  const d = Math.min(Math.max(parseInt(startDay, 10) || 1, 1), 28)
  let y = ref.getFullYear(), m = ref.getMonth()
  if (ref.getDate() < d) { m -= 1; if (m < 0) { m = 11; y -= 1 } }
  const start = new Date(y, m, d)
  const end = new Date(y, m + 1, d)            // next cycle start (exclusive)
  const msDay = 86400000
  const daysTotal = Math.round((end - start) / msDay)
  const daysPassed = Math.min(daysTotal, Math.max(1, Math.floor((ref - start) / msDay) + 1))
  const daysLeft = Math.max(0, daysTotal - daysPassed)
  return { start, end, daysTotal, daysPassed, daysLeft }
}

// e.g. "15 Jun – 14 Jul"
export function cycleLabel(startDay = 1, ref = new Date()) {
  if ((parseInt(startDay, 10) || 1) === 1) return ref.toLocaleString('en-AU', { month: 'long' })
  const { start, end } = cycleWindow(startDay, ref)
  const last = new Date(end.getTime() - 86400000)
  const opt = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('en-AU', opt)} – ${last.toLocaleDateString('en-AU', opt)}`
}
