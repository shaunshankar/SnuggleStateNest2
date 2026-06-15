// Compute the current budget/tracking cycle window for a given start day.
// startDay = 1 means calendar month. startDay = 15 means 15th → 14th next month.
// Returns YYYY-MM-DD strings: start (inclusive) and endInclusive (last day of cycle).

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cycleWindow(startDay, ref = new Date()) {
  const d = Math.min(Math.max(parseInt(startDay, 10) || 1, 1), 28)
  let year = ref.getFullYear()
  let month = ref.getMonth()
  if (ref.getDate() < d) {
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
  }
  const start = new Date(year, month, d)
  const nextStart = new Date(year, month + 1, d)          // exclusive upper bound
  const endInclusive = new Date(year, month + 1, d - 1)   // last day of this cycle
  return { startDay: d, start: fmt(start), endInclusive: fmt(endInclusive), nextStart: fmt(nextStart) }
}

// Look up a user's configured cycle start day (defaults to 1).
async function getUserCycleStartDay(pool, userId) {
  try {
    const { rows } = await pool.query('SELECT budget_cycle_start_day FROM nest.users WHERE id=$1', [userId])
    return rows[0]?.budget_cycle_start_day || 1
  } catch { return 1 }
}

module.exports = { cycleWindow, getUserCycleStartDay }
