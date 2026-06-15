const { getPool } = require('./_db')
const { requireAuth } = require('./_auth')
const { handleCors } = require('./_cors')
const { cycleWindow, getUserCycleStartDay } = require('./_period')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()
  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })

  const pool = getPool()
  try {
    const now = new Date()
    const months = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        label: d.toLocaleString('en-AU', { month: 'short', year: 'numeric' }),
        start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      })
    }
    const cycle = cycleWindow(await getUserCycleStartDay(pool, auth.userId))
    const [categoryRes, monthlyRes, summaryRes, accountRes, merchantRes] = await Promise.all([
      pool.query(
        `SELECT category, type, SUM(amount) AS total FROM nest.transactions
         WHERE household_id=$1 AND date >= $2 GROUP BY category, type ORDER BY total DESC`,
        [auth.householdId, months[0].start]
      ),
      pool.query(
        `SELECT TO_CHAR(date, 'YYYY-MM') AS month, type, SUM(amount) AS total
         FROM nest.transactions WHERE household_id=$1 AND date >= $2
         GROUP BY month, type ORDER BY month`,
        [auth.householdId, months[0].start]
      ),
      pool.query(
        `SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
                SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expenses,
                SUM(CASE WHEN type='expense' AND category='savings' THEN amount ELSE 0 END) AS savings
         FROM nest.transactions WHERE household_id=$1 AND date BETWEEN $2 AND $3`,
        [auth.householdId, cycle.start, cycle.endInclusive]
      ),
      pool.query(
        `SELECT source, type, SUM(amount) AS total FROM nest.transactions
         WHERE household_id=$1 AND date BETWEEN $2 AND $3 GROUP BY source, type`,
        [auth.householdId, cycle.start, cycle.endInclusive]
      ),
      pool.query(
        `SELECT description, SUM(amount) AS total, COUNT(*) AS count FROM nest.transactions
         WHERE household_id=$1 AND type='expense' AND date BETWEEN $2 AND $3
         GROUP BY description ORDER BY total DESC LIMIT 6`,
        [auth.householdId, cycle.start, cycle.endInclusive]
      )
    ])
    const income = parseFloat(summaryRes.rows[0]?.income || 0)
    const expenses = parseFloat(summaryRes.rows[0]?.expenses || 0)
    const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0
    const savingsThisMonth = parseFloat(summaryRes.rows[0]?.savings || 0)
    res.json({
      categoryBreakdown: categoryRes.rows,
      monthlyTrends: monthlyRes.rows,
      months: months.map(m => m.label),
      savingsRate: parseFloat(savingsRate),
      currentMonth: { income, expenses, net: income - expenses },
      accountBreakdown: accountRes.rows,
      topMerchants: merchantRes.rows,
      savingsThisMonth,
      cycle
    })
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }) }
}
